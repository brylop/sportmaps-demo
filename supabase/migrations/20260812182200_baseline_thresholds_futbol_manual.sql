-- =============================================================================
-- 20260812132614_baseline_thresholds_futbol_manual.sql
-- Autor: judegor99   Fecha: 2026-08-12   Versión anterior: 20260812132025
-- Objetivo: línea base de bandas de umbral para las 2 métricas de fútbol que
--           SÍ se quedan como carga manual (a diferencia de goles/asistencias/
--           minutos_jugados/duelos_ganados, que en la Fase 2/3 del módulo de
--           fútbol pasan a derivarse de football_match_events/match_lineups
--           -- ver 20260812131456_futbol_metricas_alineacion.sql).
--
-- Por qué estas dos quedan manuales: `pases_completados_pct` (%) y
-- `distancia_recorrida` (km) no son eventos discretos como un gol o una
-- tarjeta -- no hay forma de derivarlas de football_match_events sin
-- hardware (GPS/tracking), que está explícitamente fuera de alcance. Igual
-- que `duelos_ganados` en la migración anterior, estas dos venían con drift
-- (sembradas en producción sin migración de origen, sin bandas de umbral) --
-- confirmado por consulta directa antes de este fix, cero filas en
-- sport_metric_thresholds para ninguna de las dos.
--
-- Bandas: derivadas de la distribución real observada en
-- performance_entries (data demo, cuentas coach.futboldemo@/owner.futboldemo@
-- -- no hay usuario real afectado), no de un estándar externo:
--   · pases_completados_pct: observado 40-92%, promedio ~72% → red <60,
--     yellow 60-75, green >75.
--   · distancia_recorrida: observado 3.0-10 km, promedio ~6.3 → red <5,
--     yellow 5-7.5, green >7.5.
-- Son valores por defecto razonables, no una constante técnica -- el
-- producto/coach los puede ajustar después.
--
-- `asistencia_entrenamiento` (otra de las 7 con drift) queda deliberadamente
-- FUERA de este fix: se solapa con attendance_records, que ya usa
-- report-snapshot.service.ts para el informe mensual. Es un hallazgo aparte,
-- no se resuelve acá.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
-- =============================================================================

BEGIN;

-- Se busca metric_id por metric_key dentro de la propia migración -- nunca se
-- hardcodea un uuid generado (regla general para migraciones de datos).
INSERT INTO public.sport_metric_thresholds (metric_id, band, min_value, max_value)
SELECT smd.id, bands.band, bands.min_value, bands.max_value
FROM public.sport_metric_definitions smd
JOIN public.sports_categories sc ON sc.id = smd.sport_category_id
JOIN (VALUES
        ('pases_completados_pct', 'red',    NULL::numeric, 59.9),
        ('pases_completados_pct', 'yellow', 60,            74.9),
        ('pases_completados_pct', 'green',  75,             NULL),
        ('distancia_recorrida',   'red',    NULL,           4.9),
        ('distancia_recorrida',   'yellow', 5,               7.4),
        ('distancia_recorrida',   'green',  7.5,             NULL)
     ) AS bands(metric_key, band, min_value, max_value)
     ON bands.metric_key = smd.metric_key
WHERE sc.name = 'Fútbol'
ON CONFLICT (metric_id, band) DO NOTHING;

COMMIT;
