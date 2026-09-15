-- Notificar al PADRE cuando su pago se aprueba.
--
-- Habia una asimetria que nadie noto porque falla hacia el lado silencioso:
-- cuando el pago se rechaza, `notify_payment_attempt_failed` le avisa al padre
-- Y a la escuela. Cuando se aprueba, `notify_school_payment_paid` le avisa solo
-- a la escuela — el nombre lo dice, nunca se escribio para el padre.
--
-- Medido el 2026-09-14 sobre datos reales: de 131 pagos por Wompi con acudiente
-- identificado, **5 recibieron alguna notificacion**. Los otros 126 pagaron con
-- tarjeta o PSE y no se enteraron de nada: la unica forma de saber que el pago
-- quedo registrado era entrar a mirar.
--
-- Se agrega la funcion gemela en vez de tocar la existente: `notify_school_payment_paid`
-- la llaman Wompi y Mercado Pago, y cambiarle el alcance por dentro afectaria
-- caminos que hoy funcionan.

CREATE OR REPLACE FUNCTION public.notify_parent_payment_paid(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id UUID;
    v_parent_id UUID;
    v_user_id   UUID;
    v_child_id  UUID;
    v_team_id   UUID;
    v_amount    NUMERIC;
    v_paid      NUMERIC;
    v_concept   TEXT;
    v_payer     UUID;
    v_data      JSONB;
    v_monto     TEXT;
BEGIN
    SELECT school_id, parent_id, user_id, child_id, team_id, amount,
           COALESCE(amount_paid, amount), concept
      INTO v_school_id, v_parent_id, v_user_id, v_child_id, v_team_id, v_amount,
           v_paid, v_concept
    FROM public.payments
    WHERE id = p_payment_id;

    IF v_school_id IS NULL THEN RETURN; END IF;

    -- Igual que en el camino del fallo: si no hay acudiente vinculado se usa el
    -- usuario del cobro. Si no hay ninguno de los dos no hay a quien avisarle
    -- —el caso de los cobros de menores sin acudiente— y se sale en silencio.
    v_payer := COALESCE(v_parent_id, v_user_id);
    IF v_payer IS NULL THEN RETURN; END IF;

    v_monto := '$' || to_char(COALESCE(v_paid, v_amount, 0), 'FM999G999G999');
    v_data  := public._payment_notif_data(v_parent_id, v_child_id, v_team_id, v_school_id, v_paid);

    INSERT INTO public.notifications (user_id, school_id, category, type, title, message, link, data)
    VALUES (
        v_payer,
        v_school_id,
        'payment',
        'success',
        '✅ Recibimos tu pago',
        format('Tu pago de %s por %s quedó registrado. Ya puedes ver el comprobante en tu cuenta.',
               v_monto, COALESCE(v_concept, 'tu cobro')),
        '/my-payments',
        COALESCE(v_data, '{}'::jsonb) || jsonb_build_object('payment_id', p_payment_id, 'paid', true)
    );
END;
$$;

COMMENT ON FUNCTION public.notify_parent_payment_paid(uuid) IS
    'Avisa al acudiente que su pago se aprobo. Gemela de notify_school_payment_paid, '
    'que solo avisa a la escuela. Sin esta, quien paga por pasarela no se entera de nada.';

REVOKE ALL ON FUNCTION public.notify_parent_payment_paid(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_parent_payment_paid(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.notify_parent_payment_paid(uuid) FROM authenticated;
-- Solo la llama el BFF desde los webhooks de las pasarelas. Ningun cliente
-- deberia poder decirle a alguien que su pago se aprobo.
GRANT EXECUTE ON FUNCTION public.notify_parent_payment_paid(uuid) TO service_role;


-- ── De paso: el mensaje del pago rechazado estaba en voseo ──────────────────
--
-- «Podés intentar de nuevo» / «Verificá antes de volver a cobrar»: es argentino,
-- y el producto es colombiano. Lo lee un papá al que acaban de rechazarle un
-- pago, que es el peor momento para sonar ajeno.
CREATE OR REPLACE FUNCTION public.notify_payment_attempt_failed(
    p_payment_id uuid,
    p_reason     text DEFAULT NULL,
    p_ambiguous  boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id UUID;
    v_parent_id UUID;
    v_user_id   UUID;
    v_child_id  UUID;
    v_team_id   UUID;
    v_amount    NUMERIC;
    v_concept   TEXT;
    v_payer     UUID;
    v_data      JSONB;
    v_monto     TEXT;
BEGIN
    SELECT school_id, parent_id, user_id, child_id, team_id, amount, concept
      INTO v_school_id, v_parent_id, v_user_id, v_child_id, v_team_id, v_amount, v_concept
    FROM public.payments
    WHERE id = p_payment_id;

    IF v_school_id IS NULL THEN RETURN; END IF;

    v_payer := COALESCE(v_parent_id, v_user_id);
    v_monto := '$' || to_char(COALESCE(v_amount, 0), 'FM999G999G999');
    v_data  := public._payment_notif_data(v_parent_id, v_child_id, v_team_id, v_school_id, v_amount);

    IF v_payer IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, school_id, category, type, title, message, link, data)
        VALUES (
            v_payer,
            v_school_id,
            'payment',
            CASE WHEN p_ambiguous THEN 'warning' ELSE 'error' END,
            CASE WHEN p_ambiguous
                 THEN '⚠️ No pudimos confirmar tu pago'
                 ELSE '❌ Tu pago no se pudo procesar' END,
            CASE WHEN p_ambiguous
                 THEN format('El pago de %s por %s quedó sin confirmar. NO vuelvas a pagar todavía: estamos verificándolo con la pasarela y te avisamos.',
                     v_monto, COALESCE(v_concept, 'tu cobro'))
                 ELSE format('El pago de %s por %s fue rechazado%s. Puedes intentar de nuevo, con el mismo medio o con otro.',
                     v_monto, COALESCE(v_concept, 'tu cobro'),
                     CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ': ' || p_reason ELSE '' END)
            END,
            '/my-payments',
            COALESCE(v_data, '{}'::jsonb) || jsonb_build_object('payment_id', p_payment_id, 'attempt_failed', true)
        );
    END IF;

    PERFORM public._notify_school_staff(
        v_school_id,
        'payment',
        CASE WHEN p_ambiguous THEN 'warning' ELSE 'error' END,
        CASE WHEN p_ambiguous THEN 'Pago sin confirmar' ELSE 'Intento de pago rechazado' END,
        CASE WHEN p_ambiguous
             THEN format('%s (%s): la pasarela no confirmó el resultado. Verifica antes de volver a cobrar.',
                         v_data->>'payer_name', v_data->>'concept')
             ELSE format('%s (%s) intentó pagar y el banco lo rechazó%s. El cobro sigue pendiente.',
                         v_data->>'payer_name', v_data->>'concept',
                         CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ': ' || p_reason ELSE '' END)
        END,
        '/payments-automation',
        COALESCE(v_data, '{}'::jsonb) || jsonb_build_object('payment_id', p_payment_id, 'attempt_failed', true)
    );
END;
$$;
