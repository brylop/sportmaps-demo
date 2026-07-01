-- ============================================================
-- SPORTMAPS — Fix H-04 (auditoria de duplicacion de pagos)
--
-- Conciliacion/deteccion: detecta señales de duplicacion en la propia BD y
-- las registra en payment_anomalies (dedup por dedup_key para no re-insertar
-- la misma anomalia en cada corrida). Un cron diario llama
-- detect_payment_anomalies() y alerta por logs las criticas.
--
-- Cubre:
--   duplicate_split        (critico) — >1 payment_split para el mismo payment_id
--   duplicate_marketplace  (critico) — >1 marketplace_transaction 'paid' con la
--                                       misma provider_reference
--   rapid_duplicate        (warning) — 2 payments 'paid' mismo parent+school+monto
--                                       en < 5 min
--   stale_orphan_webhook   (warning) — webhook_events orphan/failed > 2h sin resolver
--
-- NOTA: la conciliacion contra el REPORTE de la pasarela (Wompi/MP) requiere
-- integrar sus APIs de reportes; queda como mejora futura. Esta version cubre
-- la consistencia interna, que es donde se materializa el doble cobro.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_anomalies (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         text        NOT NULL,
    severity     text        NOT NULL DEFAULT 'warning'
                   CHECK (severity IN ('info','warning','critical')),
    dedup_key    text        NOT NULL UNIQUE,   -- evita re-insertar la misma anomalia
    entity_type  text,
    entity_id    text,
    reference    text,
    details      jsonb       NOT NULL DEFAULT '{}',
    status       text        NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','resolved','ignored')),
    detected_at  timestamptz NOT NULL DEFAULT now(),
    resolved_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payment_anomalies_open
    ON public.payment_anomalies (severity, detected_at DESC)
    WHERE status = 'open';

ALTER TABLE public.payment_anomalies ENABLE ROW LEVEL SECURITY;
-- Solo service_role (bypass RLS) escribe. Lectura por admins se hace via BFF
-- con service role; no se exponen policies a authenticated/anon.

COMMENT ON TABLE public.payment_anomalies IS
    'Fix H-04: anomalias de conciliacion de pagos (duplicados, huerfanos). dedup_key evita duplicar la misma alerta.';


CREATE OR REPLACE FUNCTION public.detect_payment_anomalies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_dup_split int := 0;
    v_dup_mkt   int := 0;
    v_rapid     int := 0;
    v_orphan    int := 0;
BEGIN
    -- 1. Splits duplicados por payment_id (doble contabilizacion / payout).
    WITH dups AS (
        SELECT payment_id, count(*) AS n, array_agg(id) AS split_ids
          FROM public.payment_splits
         WHERE payment_id IS NOT NULL
         GROUP BY payment_id
        HAVING count(*) > 1
    ), ins AS (
        INSERT INTO public.payment_anomalies (kind, severity, dedup_key, entity_type, entity_id, details)
        SELECT 'duplicate_split', 'critical', 'duplicate_split:' || payment_id,
               'payment', payment_id::text,
               jsonb_build_object('splits', n, 'split_ids', split_ids)
          FROM dups
        ON CONFLICT (dedup_key) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_dup_split FROM ins;

    -- 2. Marketplace 'paid' duplicadas por provider_reference.
    WITH dups AS (
        SELECT provider_reference, count(*) AS n, array_agg(id) AS tx_ids
          FROM public.marketplace_transactions
         WHERE provider_reference IS NOT NULL AND status = 'paid'
         GROUP BY provider_reference
        HAVING count(*) > 1
    ), ins AS (
        INSERT INTO public.payment_anomalies (kind, severity, dedup_key, entity_type, reference, details)
        SELECT 'duplicate_marketplace', 'critical', 'duplicate_marketplace:' || provider_reference,
               'marketplace_transaction', provider_reference,
               jsonb_build_object('count', n, 'tx_ids', tx_ids)
          FROM dups
        ON CONFLICT (dedup_key) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_dup_mkt FROM ins;

    -- 3. Pagos 'paid' repetidos: mismo parent+school+monto en < 5 min.
    WITH pairs AS (
        SELECT a.id AS a_id, b.id AS b_id, a.amount
          FROM public.payments a
          JOIN public.payments b
            ON b.parent_id = a.parent_id
           AND b.school_id = a.school_id
           AND b.amount   = a.amount
           AND b.id > a.id
           AND b.created_at BETWEEN a.created_at - interval '5 minutes'
                                AND a.created_at + interval '5 minutes'
         WHERE a.status = 'paid' AND b.status = 'paid'
    ), ins AS (
        INSERT INTO public.payment_anomalies (kind, severity, dedup_key, entity_type, entity_id, details)
        SELECT 'rapid_duplicate', 'warning',
               'rapid_duplicate:' || least(a_id, b_id)::text || ':' || greatest(a_id, b_id)::text,
               'payment', a_id::text,
               jsonb_build_object('payment_a', a_id, 'payment_b', b_id, 'amount', amount)
          FROM pairs
        ON CONFLICT (dedup_key) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_rapid FROM ins;

    -- 4. Webhooks huerfanos/fallidos estancados (> 2h).
    WITH stale AS (
        SELECT id, provider, reference
          FROM public.webhook_events
         WHERE status IN ('orphan','failed')
           AND created_at < now() - interval '2 hours'
    ), ins AS (
        INSERT INTO public.payment_anomalies (kind, severity, dedup_key, entity_type, entity_id, reference, details)
        SELECT 'stale_orphan_webhook', 'warning', 'stale_webhook:' || id::text,
               'webhook_event', id::text, reference,
               jsonb_build_object('provider', provider)
          FROM stale
        ON CONFLICT (dedup_key) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_orphan FROM ins;

    RETURN jsonb_build_object(
        'ok', true,
        'duplicate_split', v_dup_split,
        'duplicate_marketplace', v_dup_mkt,
        'rapid_duplicate', v_rapid,
        'stale_orphan_webhook', v_orphan
    );
END;
$$;

REVOKE ALL ON FUNCTION public.detect_payment_anomalies() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.detect_payment_anomalies() TO service_role;
