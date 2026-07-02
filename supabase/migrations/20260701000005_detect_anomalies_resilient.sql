-- ============================================================
-- SPORTMAPS — Fix H-04.1: detect_payment_anomalies resiliente a tablas ausentes
--
-- Problema: detect_payment_anomalies() (migracion 20260701000004) referenciaba
-- public.marketplace_transactions y public.webhook_events directamente. En
-- ambientes donde el marketplace no esta desplegado (esas migraciones no
-- aplicadas), la funcion FALLA en runtime con 42P01 "relation does not exist".
--
-- Fix: cada bloque se ejecuta solo si su tabla existe (to_regclass), via SQL
-- dinamico. Asi la conciliacion corre en cualquier ambiente y solo evalua las
-- tablas presentes. Los bloques cuya tabla falta devuelven 0.
-- ============================================================

CREATE OR REPLACE FUNCTION public.detect_payment_anomalies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_dup_split int := 0;
    v_dup_mkt   int := 0;
    v_rapid     int := 0;
    v_orphan    int := 0;
BEGIN
    -- 1. Splits duplicados por payment_id (doble contabilizacion / payout).
    IF to_regclass('public.payment_splits') IS NOT NULL THEN
        EXECUTE $q$
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
            SELECT count(*) FROM ins
        $q$ INTO v_dup_split;
    END IF;

    -- 2. Marketplace 'paid' duplicadas por provider_reference (solo si existe).
    IF to_regclass('public.marketplace_transactions') IS NOT NULL THEN
        EXECUTE $q$
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
            SELECT count(*) FROM ins
        $q$ INTO v_dup_mkt;
    END IF;

    -- 3. Pagos 'paid' repetidos: mismo parent+school+monto en < 5 min.
    IF to_regclass('public.payments') IS NOT NULL THEN
        EXECUTE $q$
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
            SELECT count(*) FROM ins
        $q$ INTO v_rapid;
    END IF;

    -- 4. Webhooks huerfanos/fallidos estancados (> 2h) (solo si existe).
    IF to_regclass('public.webhook_events') IS NOT NULL THEN
        EXECUTE $q$
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
            SELECT count(*) FROM ins
        $q$ INTO v_orphan;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'duplicate_split', v_dup_split,
        'duplicate_marketplace', v_dup_mkt,
        'rapid_duplicate', v_rapid,
        'stale_orphan_webhook', v_orphan
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.detect_payment_anomalies() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.detect_payment_anomalies() TO service_role;
