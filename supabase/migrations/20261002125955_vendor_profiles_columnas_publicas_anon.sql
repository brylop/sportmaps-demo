-- =============================================================================
-- 20261002125955_vendor_profiles_columnas_publicas_anon.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-02   Versión anterior: 20260930230003
-- Objetivo: T1 de docs/auditoria-contabilidad-tienda-2026-10-02.md. Un anónimo
--   leía vendor_profiles.bank_data (número de cuenta, titular, documento),
--   nit, teléfono y documento de verificación: la policy select_public alcanza
--   a {public} y anon tenía SELECT sobre las 28 columnas. RLS filtra FILAS, no
--   COLUMNAS (trampa 4). Se dejan a anon solo las columnas publicables, por
--   grant de columna — no con una vista, porque useExplorarGlobal.ts hace un
--   embed vendor_profiles!inner desde PostgREST que una vista rompería.
--   authenticated no cambia en esta fase (spec blindaje-dinero §1.1; F2 mueve
--   las 3 lecturas sensibles del dueño al BFF y recorta también a authenticated).
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

-- 1. vendor_profiles: anon solo ve columnas publicables.
REVOKE ALL ON public.vendor_profiles FROM anon;
GRANT SELECT (
    id, user_id, vendor_type, display_name, slug, description,
    logo_url, cover_image_url, city, website_url,
    verification_status, is_active,
    avg_rating, reviews_count, response_rate, avg_response_hours,
    created_at, updated_at
) ON public.vendor_profiles TO anon;
-- Fuera para anon: bank_data, nit, verification_doc_url, commission_rate,
-- payment_methods, metadata, phone, email, address, capabilities.

-- 2. vendor_bank_accounts: anon no tiene nada que hacer ahí (la RLS ya lo
--    frenaba, pero REVOKE de PUBLIC no alcanza: trampa 3).
REVOKE ALL ON public.vendor_bank_accounts FROM anon;

COMMIT;
