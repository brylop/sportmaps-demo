-- ============================================================================
-- Ajustes al catálogo de VOLEIBOL — sport_metric_definitions
--
-- Arregla los rangos de las 5 métricas con min_value NULL.
--
-- Por qué importa: la UI de captura usa `min={m.min_value ?? 0}` y
-- NumberStepper clampea con Math.max(min, …). Ese default es correcto para
-- cuatro de las cinco, pero en FLEXIBILIDAD está mal: el test sit-and-reach
-- admite negativos (no alcanzar la punta de los pies), y hoy un −5 se guarda
-- como 0. Eso no es un dato faltante, es un dato falso.
--
-- NO hace falta cambiar el frontend: basta poblar min_value explícitamente.
--
-- Convención del SQL editor de Supabase: sin CREATE TEMP TABLE ni RAISE
-- NOTICE (el pooler los pierde) — el reporte va en el SELECT final.
-- ============================================================================

WITH vol AS (
    SELECT id FROM public.sports_categories WHERE name ILIKE 'voleibol' LIMIT 1
),
rangos(metric_key, nuevo_min, nuevo_max, motivo) AS (
    VALUES
    -- El único que necesita abrirse a negativos.
    -- −20 cm es un piso holgado para sit-and-reach; ajústalo al protocolo real
    -- que use la escuela.
    ('fis_flexibilidad',          -20::numeric, NULL::numeric,
     'sit-and-reach admite negativos: no llegar a los pies es valor negativo'),

    -- Porcentajes: además del piso les faltaba el techo. Sin max, hoy se puede
    -- registrar 150% de asistencia.
    ('asistencia_entrenamiento',    0::numeric,  100::numeric,
     'porcentaje: 0 a 100'),
    ('saques_efectivos',            0::numeric,  100::numeric,
     'porcentaje: 0 a 100'),

    -- Conteos: el piso es 0 y no hay techo natural.
    ('ataques_efectivos',           0::numeric, NULL::numeric,
     'conteo de partido: no hay negativos'),
    ('bloqueos',                    0::numeric, NULL::numeric,
     'conteo de partido: no hay negativos')
)
UPDATE public.sport_metric_definitions d
SET min_value = r.nuevo_min,
    max_value = COALESCE(r.nuevo_max, d.max_value)
FROM rangos r, vol
WHERE d.metric_key = r.metric_key
  AND d.sport_category_id = vol.id;


-- ────────────────────────────────────────────────────────────────────────────
-- NO INCLUIDO A PROPÓSITO: mover «Ubicación Tiempo-Espacio» a táctica
-- ────────────────────────────────────────────────────────────────────────────
-- Se evaluó y se descartó. Las cuatro métricas `rating` 0-10 de `physical`
-- (coord. visomanual, visopedal, lateralidad, ubicación tiempo-espacio) son
-- CAPACIDADES COORDINATIVAS, y la clasificación estándar de ciencias del
-- deporte las ubica bajo capacidades motoras, no bajo táctica. El catálogo es
-- consistente tal como está.
--
-- Si algún día se decide moverla: hay que mover también `subcategory` (si no
-- queda un 'fisico' dentro de 'tactical'), y quedaría como la única táctica en
-- escala 0-10 frente a 0-6 de las otras once.
--
-- ⚠️ NUNCA renombrar `metric_key` para que combine con la categoría nueva.
--    `performance_entries.metric_key` es TEXT sin FK: al renombrar la
--    definición, TODAS las mediciones históricas quedan huérfanas y el atleta
--    pierde su evolución.


-- ── Reporte final ───────────────────────────────────────────────────────────
SELECT
    d.metric_key,
    d.display_name,
    d.data_type,
    d.unit,
    d.min_value,
    d.max_value,
    (SELECT count(*) FROM public.sport_metric_thresholds t WHERE t.metric_id = d.id) AS bandas,
    CASE
        WHEN d.min_value IS NULL THEN '⚠️ sigue NULL → la UI lo pisa con 0'
        ELSE 'ok'
    END AS estado_min
FROM public.sport_metric_definitions d
WHERE d.sport_category_id = (
      SELECT id FROM public.sports_categories WHERE name ILIKE 'voleibol' LIMIT 1
  )
  AND d.metric_key IN ('fis_flexibilidad', 'asistencia_entrenamiento',
                       'saques_efectivos', 'ataques_efectivos', 'bloqueos')
ORDER BY d.metric_key;
