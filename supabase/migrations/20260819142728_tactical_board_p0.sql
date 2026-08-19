-- =============================================================================
-- 20260819142728_tactical_board_p0.sql
-- Autor: judegor99   Fecha: 2026-08-19   Versión anterior: 20260819113555
-- (Renumerada al sincronizar con origin/develop -- escrita originalmente el
-- 2026-08-14 como 20260814182011, ver docs/plan-p0-tablero-tactico.md.)
-- Objetivo: tablero táctico P0 — formación libre (slot_label + x/y) sobre
-- match_lineup_players, y soporte de entrenamiento (source_type) sobre
-- match_lineups. Ver docs/plan-p0-tablero-tactico.md.
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
-- Extiende match_lineups/match_lineup_players (20260812182000) en vez de
-- crear tablas nuevas -- ya tienen identidad polimórfica de partido/jugador
-- y RLS probada; ver sección 0 del plan para el porqué. NO se toca
-- position_code (reemplazo por desuso, D2 de la spec) ni se agrega RLS
-- nueva (las 8 policies de 20260812182000 ya cubren estas columnas).
--
-- Validado contra la base viva (luebjarufsiadojhvxgi) antes de escribir esto:
-- sin drift, los nombres de constraint de abajo coinciden con los reales.
-- report-snapshot.service.ts (Informe Mensual, en producción) filtra
-- source_type IN ('team_match','tournament_match') explícitamente, así que
-- las filas nuevas de 'training_session' quedan afuera del conteo de
-- "partidos jugados" sin tocar ese archivo.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. match_lineups: permitir entrenamiento como fuente ───────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'match_lineups_source_type_check_v2'
          AND conrelid = 'public.match_lineups'::regclass
    ) THEN
        ALTER TABLE public.match_lineups
            DROP CONSTRAINT IF EXISTS match_lineups_source_type_check;
        ALTER TABLE public.match_lineups
            ADD CONSTRAINT match_lineups_source_type_check_v2
            CHECK (source_type = ANY (ARRAY['team_match','tournament_match','training_session']));
    END IF;
END $$;

-- ─── 2. match_lineup_players: slot libre (formación sin catálogo) ───────────
-- Nullable a propósito: filas viejas (position_code, sin x/y) siguen siendo
-- válidas; el tablero nuevo puebla estas 3 columnas hacia adelante.
ALTER TABLE public.match_lineup_players
    ADD COLUMN IF NOT EXISTS slot_label text,
    ADD COLUMN IF NOT EXISTS x numeric(5,2) CHECK (x IS NULL OR (x >= 0 AND x <= 100)),
    ADD COLUMN IF NOT EXISTS y numeric(5,2) CHECK (y IS NULL OR (y >= 0 AND y <= 100));

COMMIT;
