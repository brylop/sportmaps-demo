-- =============================================================================
-- 20260824140944_restaurar_cron_generacion_mensual.sql
-- Autor: brylop   Fecha: 2026-08-24   Versión anterior: 20260821201424
-- Objetivo: re-agendar el cron 'generate-monthly-charges-daily', que desapareció
-- de cron.job el 2026-07-28 sin ninguna migración que lo desagende (perfil de
-- cron.unschedule() corrido a mano en el SQL editor durante el apagón de
-- incendios de Dynasty esos mismos días). Afecta a las 17 escuelas con
-- school_settings.auto_generate_payments = true — ninguna ha recibido cobros
-- automáticos desde entonces (verificado: 'SOLO MILLOS LOKA' y 'Academia
-- deportiva porras', ambas reales y activas hoy, tienen su último payment del
-- 2026-07-14 y ~50 inscripciones activas cada una sin cobro nuevo desde julio).
--
-- No se toca generate_monthly_charges(): sigue viva y correcta (reescrita en
-- 20260724000003_generate_monthly_charges_delegates.sql para delegar en
-- open_month(), que ya tiene advisory lock + dedup por período/atleta). Solo
-- faltaba el cron.schedule.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    PERFORM cron.unschedule('generate-monthly-charges-daily');
EXCEPTION WHEN OTHERS THEN
    NULL; -- el job no existía (es justamente el caso de hoy)
END $$;

-- 06:30 UTC = 01:30 COT, mismo horario original (entre cobros recurrentes y mora).
SELECT cron.schedule(
    'generate-monthly-charges-daily',
    '30 6 * * *',
    $cron$ SELECT public.generate_monthly_charges(); $cron$
);

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--   SELECT jobid, jobname, schedule, active FROM cron.job
--    WHERE jobname = 'generate-monthly-charges-daily';
--   Esperado: 1 fila, active = true, schedule = '30 6 * * *'.
