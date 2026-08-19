-- ============================================================================
-- Avisar cuando la pasarela rechaza. Hasta ahora no se avisaba a NADIE.
--
-- El webhook llama a `notify_school_payment_paid` cuando el pago entra, y no
-- llama a nada cuando se cae. Resultado: la familia que abandonó el reto 3DS
-- no se entera de que quedó debiendo, y la escuela ve «Pendiente» sin saber
-- que hubo un intento. Los 10 rechazos de Dynasty de agosto pasaron en
-- silencio absoluto por los dos lados.
--
-- Se avisa a los dos, con mensajes distintos porque las acciones son
-- distintas: el pagador tiene que reintentar, la escuela tiene que saber a
-- quién NO llamarle con el discurso de moroso.
--
-- Ver 20260819083012 para el resto del ciclo (el CHECK y record_payment_failure).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_payment_attempt_failed(
    p_payment_id UUID,
    p_reason TEXT DEFAULT NULL,
    -- ERROR/VOIDED: no sabemos si el dinero se movió. Cambia los dos mensajes:
    -- al pagador NO se le puede decir «volvé a pagar» si quizá ya pagó.
    p_ambiguous BOOLEAN DEFAULT false
)
RETURNS VOID
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

    -- Quién paga: el acudiente si la familia tiene cuenta, si no el atleta
    -- adulto. Con menores sin cuenta vinculada no hay a quién avisarle — ese
    -- caso lo cubre el aviso a la escuela.
    v_payer := COALESCE(v_parent_id, v_user_id);

    v_monto := '$' || to_char(COALESCE(v_amount, 0), 'FM999G999G999');

    -- ── Al pagador ───────────────────────────────────────────────────────────
    IF v_payer IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, school_id, type, title, message, link)
        VALUES (
            v_payer,
            v_school_id,
            CASE WHEN p_ambiguous THEN 'warning' ELSE 'error' END,
            CASE WHEN p_ambiguous
                 THEN '⚠️ No pudimos confirmar tu pago'
                 ELSE '❌ Tu pago no se pudo procesar' END,
            CASE WHEN p_ambiguous
                 THEN format(
                     'El pago de %s por %s quedó sin confirmar. NO vuelvas a pagar todavía: '
                     'estamos verificándolo con la pasarela y te avisamos.',
                     v_monto, COALESCE(v_concept, 'tu cobro'))
                 ELSE format(
                     'El pago de %s por %s fue rechazado%s. Podés intentar de nuevo, '
                     'con el mismo medio o con otro.',
                     v_monto,
                     COALESCE(v_concept, 'tu cobro'),
                     CASE WHEN p_reason IS NOT NULL AND p_reason <> ''
                          THEN ': ' || p_reason ELSE '' END)
            END,
            '/my-payments'
        );
    END IF;

    -- ── A la escuela ─────────────────────────────────────────────────────────
    -- Lo importante acá no es la plata (no entró), es que la familia SÍ intentó.
    v_data := public._payment_notif_data(v_parent_id, v_child_id, v_team_id, v_school_id, v_amount);

    PERFORM public._notify_school_staff(
        v_school_id,
        'payment',
        CASE WHEN p_ambiguous THEN 'warning' ELSE 'error' END,
        CASE WHEN p_ambiguous THEN 'Pago sin confirmar' ELSE 'Intento de pago rechazado' END,
        CASE WHEN p_ambiguous
             THEN format('%s (%s): la pasarela no confirmó el resultado. Verificá antes de volver a cobrar.',
                         v_data->>'payer_name', v_data->>'concept')
             ELSE format('%s (%s) intentó pagar y el banco lo rechazó%s. El cobro sigue pendiente.',
                         v_data->>'payer_name', v_data->>'concept',
                         CASE WHEN p_reason IS NOT NULL AND p_reason <> ''
                              THEN ': ' || p_reason ELSE '' END)
        END,
        '/payments-automation',
        v_data
    );
END;
$$;

COMMENT ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) IS
    'Avisa al pagador y al staff cuando la pasarela rechaza un cobro. p_ambiguous=true (ERROR/VOIDED) cambia el mensaje: no se invita a reintentar si quizá ya se cobró.';

-- Solo el webhook la llama.
REVOKE ALL ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) TO service_role;

COMMIT;
