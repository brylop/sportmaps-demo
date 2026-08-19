-- =============================================================================
-- 20260812132025_fix_duelos_ganados_thresholds_futbol.sql
-- Autor: judegor99   Fecha: 2026-08-12   Versión anterior: 20260812131456
-- Objetivo: revertir un efecto colateral de 20260812131456_futbol_metricas_alineacion.
--
-- Qué pasó: esa migración asumía -- por lo que mostraba el repo -- que
-- `sport_metric_definitions` no tenía NINGUNA métrica de fútbol todavía. Al
-- aplicarla contra la base real (brylop's Project) apareció drift no
-- versionado: ya existían 7 métricas de fútbol sembradas directo en
-- producción, sin migración que las respalde (mismo patrón de drift ya
-- documentado en 20260731160301_regularize_performance_schema_lockfree.sql
-- para las tablas de rendimiento). Una de esas 7, `duelos_ganados`
-- (category=tactical, data_type=count), coincidió en metric_key con la que
-- esta migración quería sembrar (category=technical, data_type=rating 1-5).
--
-- El INSERT de la definición se saltó correctamente por
-- `ON CONFLICT (sport_category_id, metric_key) DO NOTHING` -- no se duplicó
-- ni se corrompió la fila existente. Pero el INSERT de bandas de umbral que
-- venía después filtraba solo por `metric_key IN (...)`, sin verificar que la
-- definición fuera la que esta migración esperaba -- así que le puso bandas
-- de escala 1-5 (red 1-2 / yellow 3 / green 4-5) a una métrica que en
-- realidad es un conteo (`count`), donde esa escala no tiene sentido.
--
-- Esta migración borra esas 3 bandas mal puestas por id exacto (verificadas
-- antes de este fix: las 3 con created_at = timestamp de aplicación de
-- 20260812131456, cero bandas existían antes en esa métrica). No se vuelve a
-- sembrar `duelos_ganados` bajo ningún otro nombre -- el concepto ya existe
-- en producción como conteo, sembrar una segunda métrica equivalente
-- duplicaría lo que el coach ya puede cargar.
--
-- Pendiente, fuera de este fix (a decidir con el equipo, no autoasignado
-- acá): las otras 6 métricas de fútbol con drift (`goles`, `asistencias`,
-- `minutos_jugados`, `pases_completados_pct`, `distancia_recorrida`,
-- `asistencia_entrenamiento`) tampoco tienen migración de origen ni bandas de
-- umbral. Candidatas a una migración de "línea base" igual a la que ya se
-- hizo para performance_entries/competition_results.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
-- =============================================================================

BEGIN;

DELETE FROM public.sport_metric_thresholds
WHERE id IN (
    '8c2823e6-9b53-4276-b98a-64faee315e0f',
    '4edd9d12-bc58-4791-8a24-8b800d89d3a4',
    '976de48c-3f9c-4689-9559-5e20f6c11505'
);

COMMIT;
