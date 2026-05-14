-- ============================================================
-- SPORTMAPS — pg_cron schedule para cobros recurrentes
--
-- Cada dia a las 06:00 UTC (01:00 Bogota) dispara la Edge Function
-- `run-recurring-charges`, que a su vez llama al BFF POST
-- /api/v1/recurring/run con header x-cron-secret. El BFF procesa
-- todas las subs vencidas (next_charge_at <= now()).
--
-- Requisitos previos:
--   - Extensiones pg_cron y pg_net habilitadas (ya estan en Supabase Cloud).
--   - GUCs configuradas via 'ALTER DATABASE postgres SET' o vault:
--       app.supabase_url          = 'https://<proj>.supabase.co'
--       app.supabase_anon_key     = '<anon-key>'   (suficiente para invocar edge function)
--     Ambas las setea el equipo DevOps fuera de esta migracion para no commitearlas.
--   - La Edge Function `run-recurring-charges` desplegada con secrets
--     BFF_PUBLIC_URL y RECURRING_CRON_SECRET.
--
-- Para desactivar: SELECT cron.unschedule('recurring-charges-daily');
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Quitar el job previo si existe (la migracion debe ser idempotente)
DO $$
BEGIN
    PERFORM cron.unschedule('recurring-charges-daily');
EXCEPTION WHEN OTHERS THEN
    -- El job no existia; no es error
    NULL;
END $$;

-- Schedule diario 06:00 UTC = 01:00 Bogota.
-- Le damos pocas horas despues de medianoche para que las subs cuyo
-- billing_day caiga "hoy" ya esten elegibles.
SELECT cron.schedule(
    'recurring-charges-daily',
    '0 6 * * *',
    $cron$
    SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/run-recurring-charges',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
        ),
        body := jsonb_build_object('limit', 200)
    );
    $cron$
);

COMMENT ON EXTENSION pg_cron IS 'Scheduler interno usado por recurring-charges-daily y otros jobs.';
