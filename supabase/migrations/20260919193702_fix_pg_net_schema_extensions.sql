-- =============================================================================
-- 20260919193702_fix_pg_net_schema_extensions.sql
-- Autor: brylop   Fecha: 2026-09-20   Versión anterior: 20260918140634
-- Objetivo: linter de Supabase (SEG, advisory `extension_in_public`) marca
-- `pg_net` como instalado en el schema `public`. Es solo metadata del catálogo
-- de extensiones: pg_net ya crea sus funciones reales (http_get/http_post/...)
-- en su propio schema `net` (confirmado en pg_proc), así que este ALTER no
-- mueve ninguna función ni requiere tocar las 5 migraciones que llaman
-- `net.http_post(...)` calificado (cron de billing/suscripciones,
-- notification_deliveries_outbox). Bajo riesgo: solo re-registra a qué
-- schema pertenece la extensión.
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

ALTER EXTENSION pg_net SET SCHEMA extensions;

COMMIT;
