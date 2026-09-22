-- =============================================================================
-- 20260921131039_fix_more_identity_spoofing_and_execute_grants.sql
-- Autor: brylop   Fecha: 2026-09-21   Versión anterior: 20260921130849
-- Objetivo: TODO — qué problema resuelve esta migración.
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

-- TODO

COMMIT;
