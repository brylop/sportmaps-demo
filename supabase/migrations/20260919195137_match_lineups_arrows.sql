-- =============================================================================
-- 20260919195137_match_lineups_arrows.sql
-- Autor: judegor99   Fecha: 2026-09-20   Versión anterior: 20260917152834
-- Objetivo: el tablero táctico dibuja flechas/curvas/zonas/objetos (modo
-- pizarra, P2d) sobre la alineación de UN partido/entrenamiento puntual, pero
-- el botón "Guardar" de esa alineación (match_lineups, POST /api/v1/school/
-- football/lineups) nunca tuvo dónde persistirlos -- solo viajaban si el
-- coach los guardaba aparte como Plantilla con nombre (team_tactical_presets,
-- 20260819142729). Resultado: dibujar la jugada de un partido puntual y
-- apretar "Guardar" los perdía en silencio, sin error. Ver TacticalBoard.tsx
-- (handleSave) y bff/src/routes/school/football.ts.
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
-- Mismo mecanismo que team_tactical_presets.arrows (20260819142729): jsonb
-- crudo, validado en el BFF (validateArrows), no en SQL -- las figuras no
-- tienen identidad propia ni se consultan por columna individual. Sin RLS
-- nueva: las 4 policies de match_lineups (20260812182000) ya cubren la fila
-- completa, no por columna. NOT NULL DEFAULT '[]' para que las alineaciones
-- ya existentes (sin flechas guardadas nunca) no queden en NULL -- el
-- frontend siempre espera un array, nunca null.

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.match_lineups
    ADD COLUMN IF NOT EXISTS arrows jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
