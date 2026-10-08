-- =============================================================================
-- 20261007134859_autopay_f2_motor.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261007095911
-- Objetivo: F2 del débito automático (docs/specs/debito-automatico.md §7, §10.2).
--   Lo que el motor del BFF (bff/src/services/autopay.service.ts) necesita de la base
--   y que F1 dejó para esta fase:
--     1. autopay_sweep_due: lo que el barrido de 15 min tiene que reconsultar
--        (PENDING con next_check_at vencido y `processing` con lease vencido), con la
--        referencia SCH- del enlace del intento.
--     2. autopay_reschedule_check: backoff de la reconsulta de un PENDING (2, 10, 30
--        min y luego cada hora). finish_attempt solo sabe poner +2 min.
--     3. Incidentes stale_* y merchant_mismatch: uno abierto por cobro (el barrido
--        corre cada 15 min; sin esto abriría uno por corrida).
--     4. Cron (pg_cron → pg_net → BFF): autopay-daily 12:00 UTC (07:00 Bogotá, después
--        de generate-monthly-charges 06:30) y autopay-sweep cada 15 min.
--
--   RADIO CERO al aplicar: el cron no llama a nadie mientras
--   platform_config['autopay_runner'].base_url sea null o falte el secreto
--   'autopay_cron_secret' en vault. Y el BFF responde 204 sin hacer nada mientras
--   AUTOPAY_RUNNER_ENABLED no sea 'true'. Hoy: 0 suscripciones, 0 escuelas ofreciendo.
--
--   Para encenderlo (a mano, no va en el repo):
--     select vault.create_secret('<32+ chars>', 'autopay_cron_secret');
--     update platform_config set value = '{"base_url":"https://<bff>"}'
--      where key = 'autopay_runner';
--   y en el BFF que corre el motor: AUTOPAY_CRON_SECRET=<el mismo>, AUTOPAY_RUNNER_ENABLED=true.
--   UN SOLO BFF: la base es compartida, apuntar a uno (el de producción).
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

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Barrido (§7.5)
-- ════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION public.autopay_sweep_due(p_limit int DEFAULT 100)
RETURNS TABLE (
  attempt_id               uuid,
  cycle_id                 uuid,
  payment_id               uuid,
  school_id                uuid,
  subscription_id          uuid,
  status                   text,
  provider_transaction_id  text,
  provider_reference       text,
  payment_link_id          uuid,
  created_at               timestamptz,
  lease_expired            boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT a.id, a.cycle_id, a.payment_id, c.school_id, c.subscription_id, a.status,
         a.provider_transaction_id,
         COALESCE(a.provider_reference, l.provider_reference, l.wompi_reference),
         COALESCE(a.payment_link_id, l.id),
         a.created_at,
         (a.status = 'processing' AND a.lease_until < now())
    FROM public.recurring_charge_attempts a
    JOIN public.autopay_cycles c ON c.id = a.cycle_id
    LEFT JOIN public.payment_links l ON l.recurring_attempt_id = a.id
   WHERE (a.status = 'pending_provider' AND a.next_check_at <= now())
      OR (a.status = 'processing' AND a.lease_until < now())
   ORDER BY a.created_at
   LIMIT p_limit;
$$;

-- Backoff de la reconsulta. Solo para un intento que sigue en PENDING.
CREATE FUNCTION public.autopay_reschedule_check(p_attempt_id uuid, p_next_check_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.recurring_charge_attempts
     SET next_check_at = p_next_check_at, updated_at = now()
   WHERE id = p_attempt_id AND status = 'pending_provider';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending_provider');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Un incidente abierto por cobro para stale_* y merchant_mismatch. El
--    INSERT de autopay_record_incident captura unique_violation → 'unchanged'.
-- ════════════════════════════════════════════════════════════════════════════
CREATE UNIQUE INDEX uq_autopay_incidents_open_per_payment
  ON public.autopay_incidents (kind, payment_id)
  WHERE state = 'open' AND kind IN ('stale_pending', 'stale_lease', 'merchant_mismatch') AND payment_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Cron → BFF (§7.1). Secreto en vault, URL en platform_config.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.platform_config (key, value, description) VALUES
  ('autopay_runner', '{"base_url": null}'::jsonb,
   'Débito automático: URL base del ÚNICO BFF que corre el motor (cron → POST <base_url>/internal/autopay/{daily|sweep}). null = apagado.')
ON CONFLICT (key) DO NOTHING;

CREATE FUNCTION public.autopay_cron_tick(p_run text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_base   text;
  v_secret text;
BEGIN
  IF p_run NOT IN ('daily', 'sweep') THEN
    RAISE EXCEPTION 'autopay_cron_tick: corrida desconocida %', p_run;
  END IF;

  SELECT value->>'base_url' INTO v_base FROM public.platform_config WHERE key = 'autopay_runner';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'autopay_cron_secret';
  IF v_base IS NULL OR v_base = '' OR v_secret IS NULL THEN
    RETURN;  -- apagado
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_base, '/') || '/internal/autopay/' || p_run,
    body    := jsonb_build_object('run', p_run),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-autopay-secret', v_secret),
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.autopay_sweep_due(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_reschedule_check(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_cron_tick(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.autopay_sweep_due(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.autopay_reschedule_check(uuid, timestamptz) TO service_role;
-- autopay_cron_tick: solo la corre pg_cron (como postgres); nadie más.

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('autopay-daily', 'autopay-sweep');
  PERFORM cron.schedule('autopay-daily', '0 12 * * *',    $c$SELECT public.autopay_cron_tick('daily')$c$);
  PERFORM cron.schedule('autopay-sweep', '*/15 * * * *', $c$SELECT public.autopay_cron_tick('sweep')$c$);
END $$;

COMMIT;
