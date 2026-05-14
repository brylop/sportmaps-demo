-- ============================================================
-- SPORTMAPS — Linter Fase 2 ronda 2 + Fase 1 ronda 4
--
-- 1. ERROR nuevo: vendor_shipments_summary se cree con SECURITY
--    DEFINER en 20260511000020/21/22/23 (CREATE VIEW sin
--    security_invoker). Cada vez que la migracion mas reciente
--    la recrea, vuelve a quedar DEFINER. La pasamos a INVOKER
--    con la misma definicion que tiene hoy (igual que hicimos
--    con school_athletes en 20260511000012).
--
-- 2. WARN reincidente: trg_release_on_delivered.
--    20260511000005 la creo sin SET search_path.
--    20260511000008 (commiteada) hace DROP CASCADE + CREATE
--    de nuevo sin SET search_path.
--    20260511000013 le aplico ALTER FUNCTION ... SET search_path.
--    Pero el cache_key del linter cambio (2296d2... -> 02377...),
--    asi que la funcion fue redefinida despues. Re-aplicamos el
--    ALTER. Para que no vuelva a aparecer, hay que parchar el
--    archivo de origen \-- 20260511000008 esta commiteado y la
--    politica del proyecto prohibe editarlo. La proxima migracion
--    que recree la funcion (CREATE OR REPLACE) tiene que incluir
--    SET search_path = pg_catalog, public, pg_temp.
-- ============================================================


-- ============================================================
-- 1. vendor_shipments_summary → SECURITY INVOKER
-- ============================================================

CREATE OR REPLACE VIEW public.vendor_shipments_summary
WITH (security_invoker = true) AS
SELECT
    s.vendor_profile_id,
    COUNT(*) FILTER (WHERE s.status = 'pending')                          AS pending_count,
    COUNT(*) FILTER (WHERE s.status IN ('picked_up','in_transit'))        AS in_transit_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')                        AS delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'returned')                         AS returned_count,
    COUNT(*)                                                              AS total,
    AVG(EXTRACT(EPOCH FROM (s.delivered_at - s.shipped_at)) / 86400)
        FILTER (WHERE s.delivered_at IS NOT NULL AND s.shipped_at IS NOT NULL)
                                                                          AS avg_delivery_days
  FROM public.shipments s
 GROUP BY s.vendor_profile_id;

COMMENT ON VIEW public.vendor_shipments_summary IS
    'Resumen agregado de shipments por vendor. SECURITY INVOKER desde 2026-05-13 (Linter Fase 2 ronda 2). RLS de shipments manda.';


-- ============================================================
-- 2. trg_release_on_delivered → reaplicar SET search_path
-- ============================================================

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS fn_name,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'trg_release_on_delivered'
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, pg_temp',
            r.schema_name, r.fn_name, r.args
        );
        RAISE NOTICE 'search_path fijado en %.%(%)', r.schema_name, r.fn_name, r.args;
    END LOOP;
END $$;


-- ============================================================
-- 3. Refresh schema cache.
-- ============================================================

NOTIFY pgrst, 'reload config';
