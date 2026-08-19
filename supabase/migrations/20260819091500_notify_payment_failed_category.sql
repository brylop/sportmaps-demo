-- ============================================================================
-- Faltaba `category` en el aviso al pagador de 20260819090123.
--
-- La columna es nullable, así que el INSERT pasaba igual — pero sin category
-- la notificación no se agrupa con las demás de pago ni la toma el filtro por
-- categoría del despachador. `data` tampoco viajaba: el deep-link del push
-- necesita el payment_id.
--
-- Migración aparte y no edición de la anterior: esa ya está aplicada contra la
-- base compartida, y tocarla dejaría el archivo diciendo algo distinto de lo
-- que corrió.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_payment_attempt_failed(
    p_payment_id UUID,
    p_reason TEXT DEFAULT NULL,
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
                 ELSE format('El pago de %s por %s fue rechazado%s. Podés intentar de nuevo, con el mismo medio o con otro.',
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
             THEN format('%s (%s): la pasarela no confirmó el resultado. Verificá antes de volver a cobrar.',
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

REVOKE ALL ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_payment_attempt_failed(UUID, TEXT, BOOLEAN) TO service_role;

COMMIT;
