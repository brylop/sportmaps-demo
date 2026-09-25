-- =============================================================================
-- 20260925170003_performance_entries_checkpoint.sql
-- Autor: judegor99   Fecha: 2026-09-25   Versión anterior: 20260925170002
-- Objetivo: cierra el defecto de PER-8 (ROADMAP.md, modo `individual` de la
-- rúbrica de mesociclo, deshabilitado en MesocycleFormDialog desde el
-- 2026-09-21). El modo `team` guarda 6 indicadores × 5 cortes en
-- training_mesocycle_evaluations (columna `checkpoint`, UNIQUE por
-- mesociclo+indicador+corte). El modo `individual` reusa performance_entries
-- (context_type='evaluation'), pero esa tabla NO tenía dónde guardar el
-- corte -- cada guardado insertaba una fila nueva distinguida solo por
-- `recorded_at`, y el front (MesocycleRubricTable.tsx) armaba un mapa
-- keyeado SOLO por metric_key: la última fila pisaba a todas las
-- anteriores en la UI. Los 5 cortes nunca convivían, quedaba uno solo.
--
-- Columna nullable a propósito: performance_entries es compartida por otras
-- features (asistencia, evaluaciones sueltas, etc.) que nunca usan corte --
-- el CHECK solo obliga el valor cuando SÍ se manda uno, nunca exige que
-- exista.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE. (Acá la
--     tabla no es nueva, pero el criterio de text+CHECK se mantiene igual.)
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.performance_entries
    ADD COLUMN IF NOT EXISTS checkpoint text
    CHECK (checkpoint IS NULL OR checkpoint IN ('inicial', 'semana_2', 'semana_3', 'semana_4', 'final'));

COMMIT;
