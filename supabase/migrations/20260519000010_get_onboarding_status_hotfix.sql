-- ============================================================
-- SPORTMAPS — Hotfix: re-grant + reload de get_onboarding_status
--
-- Sintoma en staging (2026-05-19): POST /rest/v1/rpc/get_onboarding_status
-- devuelve 404. La columna business_model existe en schools, la funcion
-- esta en information_schema.routines, pero PostgREST no la expone.
--
-- Causa probable: schema cache stale en PostgREST + permisos perdidos
-- entre redefiniciones consecutivas de la funcion (la pasada
-- 20260519000001 hizo CREATE OR REPLACE y aunque incluye GRANT EXECUTE,
-- PostgREST cache puede no haber refrescado).
--
-- Esta migracion:
--   1. Reafirma GRANT EXECUTE a anon + authenticated (PostgREST necesita
--      ambos para exponer la funcion).
--   2. Dispara NOTIFY explicito de schema (no solo config).
--   3. ALTER FUNCTION para forzar invalidate del cache.
-- ============================================================

BEGIN;

-- 1. Re-grant explicito (idempotente)
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO anon;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO service_role;

-- 2. Toque cosmetico que dispara invalidate sin cambiar la logica
ALTER FUNCTION public.get_onboarding_status() SET search_path = pg_catalog, public, pg_temp;

COMMIT;

-- 3. Forzar reload de schema (no solo config). PostgREST escucha ambos.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
