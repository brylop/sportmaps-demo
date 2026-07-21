-- ============================================================
-- SPORTMAPS — Comprobantes v2, Fase 4: marcas de idempotencia de correo de glosa
-- Spec: docs/specs/receipt-extraction-v2-glosas.md §5.5
-- ------------------------------------------------------------
-- El recordatorio "vence mañana" y el correo de ratificación automática se envían
-- desde el JOB del BFF (el cron SQL no puede mandar email). El BFF usa claim atómico
-- (UPDATE ... RETURNING) sobre estas marcas para no duplicar correos entre réplicas.
-- La transición de estado de ratificación SIGUE en el pg_cron `ratify_expired_glosas`
-- de Fase 3 (robusta aunque el BFF esté caído); el BFF solo agrega los correos.
-- Fecha: 2026-07-18
-- ============================================================

ALTER TABLE public.payment_glosas
    ADD COLUMN IF NOT EXISTS reminder_sent_at     timestamptz,
    ADD COLUMN IF NOT EXISTS ratify_email_sent_at timestamptz;

COMMENT ON COLUMN public.payment_glosas.reminder_sent_at IS
    'Marca de idempotencia del correo "vence mañana" enviado por el job del BFF. NULL = pendiente.';
COMMENT ON COLUMN public.payment_glosas.ratify_email_sent_at IS
    'Marca de idempotencia del correo de ratificación automática (resolved_by NULL) enviado por el job del BFF.';

-- reopen_glosa: al reabrir hay un nuevo plazo → los correos deben poder volver a
-- dispararse, así que se resetean AMBAS marcas. Migración nueva (no edita la anterior).
CREATE OR REPLACE FUNCTION public.reopen_glosa(p_actor uuid, p_glosa_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_status     text;
    v_payment_id uuid;
    v_parent_id  uuid;
    v_days       int;
    v_today      date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
    IF p_note IS NULL OR btrim(p_note) = '' THEN
        RAISE EXCEPTION 'La nota de reapertura es obligatoria' USING ERRCODE = '22023';
    END IF;
    SELECT school_id, status, payment_id INTO v_school_id, v_status, v_payment_id
    FROM public.payment_glosas WHERE id = p_glosa_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Glosa no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT public._glosa_actor_is_admin(p_actor, v_school_id) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_status <> 'RATIFICADA' THEN
        RAISE EXCEPTION 'Solo se puede reabrir una glosa RATIFICADA (actual: %)', v_status
            USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(glosa_response_days, 5) INTO v_days
    FROM public.school_settings WHERE school_id = v_school_id;

    UPDATE public.payment_glosas
    SET status = 'GLOSADA',
        responds_by = v_today + COALESCE(v_days, 5),
        resolution_note = p_note,
        resolved_at = NULL, resolved_by = NULL, responded_at = NULL,
        reminder_sent_at = NULL, ratify_email_sent_at = NULL,
        updated_at = now()
    WHERE id = p_glosa_id;

    UPDATE public.payments SET status = 'glosado', updated_at = now()
    WHERE id = v_payment_id;

    SELECT parent_id INTO v_parent_id FROM public.payments WHERE id = v_payment_id;
    PERFORM public._glosa_notify(
        v_parent_id, v_school_id,
        'Reabrimos tu aclaración',
        'Reabrimos la aclaración de tu comprobante. Ábrela para responder de nuevo.',
        '/my-payments'
    );
END;
$$;
REVOKE ALL ON FUNCTION public.reopen_glosa(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_glosa(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
