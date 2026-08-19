-- =============================================================================
-- 20260819142730_tactical_presets_arrows.sql
-- Autor: judegor99   Fecha: 2026-08-19   Versión anterior: 20260819142729
-- (Renumerada al sincronizar con origin/develop -- escrita originalmente
-- como 20260819124510.)
-- Objetivo: modo pizarra (P2d) -- flechas de movimiento sobre la cancha,
-- guardadas junto con la plantilla táctica (mismo mecanismo de "Guardar
-- como plantilla" de team_tactical_presets, 20260819142729). No es tabla
-- nueva: una columna jsonb más en la tabla que ya existe.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- Sin RLS/grants nuevos: son las mismas policies de team_tactical_presets
-- (20260819142729) las que ya gobiernan esta columna, porque son del mismo
-- registro, no de una tabla aparte.

BEGIN;

ALTER TABLE public.team_tactical_presets
    ADD COLUMN IF NOT EXISTS arrows jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
