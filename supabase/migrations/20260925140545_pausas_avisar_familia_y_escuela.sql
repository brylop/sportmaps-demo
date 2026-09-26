-- =============================================================================
-- 20260925140545_pausas_avisar_familia_y_escuela.sql
-- Autor: brylop   Fecha: 2026-09-25   Versión anterior: 20260925135705
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
