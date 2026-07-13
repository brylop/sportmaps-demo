-- ============================================================
-- SPORTMAPS — Motor de recordatorios de pago (cron)
-- ------------------------------------------------------------
-- PROBLEMA:
--   school_settings.reminder_enabled / reminder_days_before se configuraban
--   pero NADIE los leía: no se enviaba ningún recordatorio antes del
--   vencimiento. El toggle "Enviar recordatorios" era decorativo.
--
-- QUÉ HACE:
--   send_payment_reminders(): para escuelas con reminder_enabled, busca los
--   pagos 'pending' cuyo due_date cae dentro de los próximos
--   reminder_days_before días y crea UNA notificación in-app al pagador.
--
-- IDEMPOTENCIA:
--   payments.reminder_sent_at marca el envío. Sólo se envía una vez por pago
--   (evita spam al correr el cron a diario). Si el pago se reprograma o se
--   crea uno nuevo, ese nuevo pago tendrá reminder_sent_at NULL y recibirá su
--   propio recordatorio.
--
--   Programado a diario 13:00 UTC = 08:00 COT (mañana, hora razonable para
--   notificar al padre).
-- Fecha: 2026-07-13
-- ============================================================

-- 1. Marca de idempotencia ----------------------------------------------------
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN public.payments.reminder_sent_at IS
    'Cuándo se envió el recordatorio de pago (in-app). NULL = aún no enviado.';

-- 2. Función del motor de recordatorios ---------------------------------------
CREATE OR REPLACE FUNCTION public.send_payment_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_sent  integer := 0;
BEGIN
    WITH candidates AS (
        SELECT
            p.id,
            p.parent_id,
            p.school_id,
            p.concept,
            GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0) AS saldo,
            p.due_date
        FROM public.payments p
        JOIN public.school_settings ss
            ON ss.school_id = p.school_id
           AND ss.reminder_enabled IS TRUE
        WHERE p.status = 'pending'
          AND p.reminder_sent_at IS NULL
          AND p.parent_id IS NOT NULL
          AND p.due_date >= v_today
          AND p.due_date <= v_today + COALESCE(ss.reminder_days_before, 3)
    ), ins AS (
        INSERT INTO public.notifications (user_id, school_id, type, title, message, link)
        SELECT
            c.parent_id,
            c.school_id,
            'payment_reminder',
            '🔔 Recordatorio de pago',
            'Tu pago de "' || c.concept || '" por $'
                || to_char(round(c.saldo), 'FM999,999,999')
                || ' vence el ' || to_char(c.due_date, 'DD/MM/YYYY') || '.',
            '/my-payments'
        FROM candidates c
        RETURNING 1
    ), upd AS (
        UPDATE public.payments p
        SET reminder_sent_at = now()
        WHERE p.id IN (SELECT id FROM candidates)
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_sent FROM ins;

    RAISE NOTICE '[send_payment_reminders] fecha=% recordatorios_enviados=%', v_today, v_sent;
    RETURN jsonb_build_object('run_date', v_today, 'reminders_sent', v_sent);
END;
$$;

COMMENT ON FUNCTION public.send_payment_reminders() IS
    'Crea recordatorios in-app de pagos próximos a vencer según school_settings.reminder_*. Idempotente vía payments.reminder_sent_at. Ejecutado a diario por pg_cron.';

REVOKE ALL ON FUNCTION public.send_payment_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_payment_reminders() TO service_role;

-- 3. Programación diaria vía pg_cron ------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    PERFORM cron.unschedule('send-payment-reminders-daily');
EXCEPTION WHEN OTHERS THEN
    NULL; -- el job no existía
END $$;

-- 13:00 UTC = 08:00 COT (mañana).
SELECT cron.schedule(
    'send-payment-reminders-daily',
    '0 13 * * *',
    $cron$ SELECT public.send_payment_reminders(); $cron$
);

NOTIFY pgrst, 'reload schema';
