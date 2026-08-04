-- ============================================================================
-- Bandas (semáforo) para el catálogo de VOLEIBOL — sport_metric_thresholds
--
-- Hoy solo 6 de 51 métricas tienen bandas (abdominal, flexibilidad, flexión de
-- pecho, sentadilla, Léger, velocidad T). Sin umbrales no hay verde/ámbar/rojo,
-- y la sección «en qué se va a trabajar» del informe al padre queda vacía.
--
-- Este script agrega bandas a 38 métricas: las que están en ESCALA ACOTADA,
-- donde el corte es una fracción del rango y no una norma deportiva. NO toca
-- las 6 que ya tienen bandas.
--
-- ⚠️ QUEDAN 7 SIN BANDAS A PROPÓSITO — ver el bloque del final. Requieren
--    normas por edad y sexo que solo puede dar el coach.
--
-- SUPUESTO A VALIDAR: se asume captura en ENTEROS (0-2 / 3-4 / 5-6). Si el
-- coach usa medios puntos (3,5), un 2,5 no caería en ninguna banda y el
-- semáforo saldría vacío — habría que usar cortes decimales.
--
-- Idempotente: solo inserta donde la métrica tiene CERO bandas.
-- Convención del SQL editor de Supabase: reporte en el SELECT final.
-- ============================================================================

WITH vol AS (
    SELECT id FROM public.sports_categories WHERE name ILIKE 'voleibol' LIMIT 1
),
-- Cortes por tipo de escala. La escala se deriva del propio catálogo, así que
-- si mañana se agrega una métrica 0-6 nueva, este script la cubre sin editarlo.
cortes(escala, band, min_value, max_value) AS (
    VALUES
    -- Escala 0-6 (11 tácticas + 21 técnicas): tercios del rango.
    ('r6',  'red',     0::numeric,   2::numeric),
    ('r6',  'yellow',  3::numeric,   4::numeric),
    ('r6',  'green',   5::numeric,   6::numeric),

    -- Escala 0-10 (4 capacidades coordinativas): tercios del rango.
    ('r10', 'red',     0::numeric,   4::numeric),
    ('r10', 'yellow',  5::numeric,   7::numeric),
    ('r10', 'green',   8::numeric,  10::numeric),

    -- Asistencia %. Este corte SÍ es una decisión de producto, no aritmética:
    -- 90% = excelente, 75-89% = aceptable, <75% = hay que hablar con la familia.
    ('asi', 'red',     0::numeric,  74::numeric),
    ('asi', 'yellow', 75::numeric,  89::numeric),
    ('asi', 'green',  90::numeric, 100::numeric),

    -- Saques efectivos %. Corte deportivo — VALIDAR CON EL COACH.
    ('saq', 'red',     0::numeric,  59::numeric),
    ('saq', 'yellow', 60::numeric,  79::numeric),
    ('saq', 'green',  80::numeric, 100::numeric)
),
-- Clasifica cada métrica en su escala a partir del catálogo real.
clasificadas AS (
    SELECT
        d.id AS metric_id,
        d.metric_key,
        CASE
            WHEN d.metric_key = 'asistencia_entrenamiento' THEN 'asi'
            WHEN d.metric_key = 'saques_efectivos'         THEN 'saq'
            WHEN d.data_type = 'rating' AND d.max_value = 6  THEN 'r6'
            WHEN d.data_type = 'rating' AND d.max_value = 10 THEN 'r10'
        END AS escala
    FROM public.sport_metric_definitions d, vol
    WHERE d.sport_category_id = vol.id
      AND d.is_active
      -- No tocar las 6 que el coach ya configuró.
      AND NOT EXISTS (
          SELECT 1 FROM public.sport_metric_thresholds t WHERE t.metric_id = d.id
      )
)
INSERT INTO public.sport_metric_thresholds (metric_id, band, min_value, max_value)
SELECT c.metric_id, k.band, k.min_value, k.max_value
FROM clasificadas c
JOIN cortes k ON k.escala = c.escala
WHERE c.escala IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- LAS 7 QUE QUEDAN SIN BANDAS, Y POR QUÉ NO LAS INVENTO
-- ────────────────────────────────────────────────────────────────────────────
--
-- Cinco medidas físicas absolutas en cm:
--   fis_alcance                   Alcance con el brazo extendido
--   fis_salto_bloqueo             Altura de salto en el bloqueo
--   fis_salto_remate              Altura de salto en el remate
--   fis_lanzamiento_medicinal     Lanzamiento de medicinal sobre la cabeza
--   fis_empuje_pecho_medicinal    Empuje desde el pecho (medicinal 2 kg)
--
-- Un salto de bloqueo de 40 cm es excelente en una sub-12 y pobre en una
-- sub-17. Poner un umbral único inventado haría que el informe le diga a una
-- familia «por debajo» cuando la niña está bien para su edad — es peor que no
-- tener semáforo. Necesito las normas del coach por edad y sexo.
--
-- ⚠️ PROBLEMA DE ESQUEMA: `sport_metric_thresholds` no tiene dimensión de edad
--    ni de categoría (solo metric_id, band, min, max). Es UNA banda por métrica
--    para toda la escuela. Con sub-12 a sub-17 en la misma tabla, estas cinco
--    NO SE PUEDEN configurar correctamente hoy sin agregar esa dimensión.
--    Esa es una decisión de modelo, no un dato faltante.
--
-- Dos conteos de partido:
--   ataques_efectivos             Ataques que terminaron en punto
--   bloqueos                      Bloqueos conseguidos
--
-- Son conteos absolutos sin techo: 6 ataques efectivos es bueno o malo según
-- cuántos partidos y minutos jugó. Sin normalizar por oportunidades, cualquier
-- umbral miente. Si se quiere semáforo aquí, primero hay que decidir el
-- denominador (por set, por partido, por intentos).


-- ── Reporte final ───────────────────────────────────────────────────────────
SELECT
    d.category,
    d.metric_key,
    d.display_name,
    d.data_type,
    d.unit,
    d.max_value,
    count(t.id) AS bandas,
    CASE
        WHEN count(t.id) = 3 THEN 'ok'
        WHEN count(t.id) = 0 THEN '⚠️ sin semáforo'
        ELSE '⚠️ revisar: ' || count(t.id)::text || ' bandas'
    END AS estado
FROM public.sport_metric_definitions d
LEFT JOIN public.sport_metric_thresholds t ON t.metric_id = d.id
WHERE d.sport_category_id = (
    SELECT id FROM public.sports_categories WHERE name ILIKE 'voleibol' LIMIT 1
)
GROUP BY d.id, d.category, d.metric_key, d.display_name, d.data_type, d.unit, d.max_value
ORDER BY count(t.id), d.category, d.display_name;
