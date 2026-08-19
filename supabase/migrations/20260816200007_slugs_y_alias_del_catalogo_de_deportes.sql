-- ============================================================================
-- Catálogo de deportes — cerrar los 20 que quedaron sin mapear
--
-- Fecha: 2026-08-16
-- Sigue a 20260816195545, que llevó el catálogo del frontend a la base y dejó
-- 79 de 99 deportes con `categorias_oficiales`.
--
-- ── Por qué quedaron 20 afuera ──────────────────────────────────────────────
-- No es que falten en el catálogo: **ninguno tiene `slug`**, y el cruce se hacía
-- por slug. Se parten en tres grupos distintos, y NO se tratan igual:
--
--   A) Alias inequívocos de un deporte que ya quedó mapeado. Se les copia la
--      categoría del canónico. Son 5.
--   B) Alias AMBIGUOS: apuntan a dos o más canónicos (Gimnasia → artística y
--      rítmica; Ciclismo → ruta, pista, MTB y BMX). Se les pone slug pero NO se
--      les inventa una categoría: elegir una de las dos sería una decisión de
--      producto disfrazada de dato.
--   C) Disciplinas propias sin mapear: las variantes de cheer (Sideline,
--      Performance/Pom, Jazz, Hip Hop, Stunt Groups, Scholastic, Porras) son
--      categorías reales y distintas en ese deporte, no basura. Y los genéricos
--      (Multideporte, Deportes Extremos, Capoeira, Aikido). Necesitan que
--      alguien del lado deportivo escriba sus categorías.
--
-- ── Lo que esta migración NO hace ───────────────────────────────────────────
-- **No borra ni desactiva nada.** `Gimnasia` está EN USO (4 filas de
-- `sport_metric_definitions` cuelgan de ella), y las variantes de cheer son
-- disciplinas legítimas. Fusionar o desactivar exige decidir qué pasa con lo
-- que ya apunta ahí, y eso es una conversación, no una migración.
--
-- Después de esto: 84 de 99 con categorías. Los 15 restantes quedan listados en
-- la consulta 2, agrupados por qué les falta.
-- ============================================================================

BEGIN;

-- ── 1. Slug para los 20 ─────────────────────────────────────────────────────
-- Sin slug no cruzan con nada: ni con el catálogo, ni con sport_configs, ni con
-- lo que venga. Es el identificador estable del deporte.
UPDATE public.sports_categories SET slug = 'artes_marciales'          WHERE name = 'Artes Marciales'          AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'mma'                      WHERE name = 'MMA'                      AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'multideporte'             WHERE name = 'Multideporte'             AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'stunt_groups'             WHERE name = 'Stunt Groups'             AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'kung_fu'                  WHERE name = 'Kung fu'                  AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'porras'                   WHERE name = 'Porras'                   AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'jazz_cheer'               WHERE name = 'Jazz Cheer'               AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'performance_cheer_pom'    WHERE name = 'Performance Cheer (Pom)'  AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'ciclismo'                 WHERE name = 'Ciclismo'                 AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'sideline_cheer'           WHERE name = 'Sideline Cheer'           AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'capoeira'                 WHERE name = 'Capoeira'                 AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'deportes_extremos'        WHERE name = 'Deportes Extremos'        AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'beisbol'                  WHERE name = 'Béisbol'                  AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'gimnasia'                 WHERE name = 'Gimnasia'                 AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'hip_hop_cheer'            WHERE name = 'Hip Hop Cheer'            AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'aikido'                   WHERE name = 'Aikido'                   AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'acrobacia_y_tumbling'     WHERE name = 'Acrobacia y Tumbling'     AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'cheerleading'             WHERE name = 'Cheerleading'             AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'cheerleading_scholastic'  WHERE name = 'Cheerleading Scholastic'  AND slug IS NULL;
UPDATE public.sports_categories SET slug = 'cheerleading_all_star'    WHERE name = 'Cheerleading All-Star'    AND slug IS NULL;

-- ── 2. Grupo A: copiar del canónico donde el alias es inequívoco ────────────
-- Solo donde hay UN canónico posible. Se copian también federación y estado
-- olímpico, que también venían vacíos.
WITH alias(destino, origen) AS (
  VALUES
    ('mma',                   'mma_artes_marciales_mixtas'),
    ('kung_fu',               'wushu_kung_fu'),
    ('beisbol',               'beisbol_softbol'),
    ('cheerleading_all_star', 'cheerleading_all_stars'),
    ('acrobacia_y_tumbling',  'acrobacias_cheerleading_tumbling')
)
UPDATE public.sports_categories d
   SET categorias_oficiales      = o.categorias_oficiales,
       federacion_internacional  = COALESCE(d.federacion_internacional, o.federacion_internacional),
       acronimo_fi               = COALESCE(d.acronimo_fi, o.acronimo_fi),
       estado_olimpico           = COALESCE(d.estado_olimpico, o.estado_olimpico)
  FROM alias a
  JOIN public.sports_categories o ON o.slug = a.origen
 WHERE d.slug = a.destino
   AND (d.categorias_oficiales IS NULL OR d.categorias_oficiales = '{}'::jsonb);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Cobertura. Debería quedar en 84 de 99, y CERO sin slug.
-- ────────────────────────────────────────────────────────────────────────────
SELECT count(*)                                                        AS deportes,
       count(*) FILTER (WHERE slug IS NULL)                            AS sin_slug,
       count(*) FILTER (WHERE categorias_oficiales IS NOT NULL
                          AND categorias_oficiales <> '{}'::jsonb)     AS con_categorias
  FROM public.sports_categories;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Los que siguen sin categorías, agrupados por QUÉ les falta.
--    Esta es la lista de trabajo, y no es de código: es de definición
--    deportiva. Alguien tiene que escribir las categorías del cheer.
-- ────────────────────────────────────────────────────────────────────────────
SELECT CASE
         WHEN slug IN ('gimnasia','ciclismo')
              THEN 'B — alias ambiguo: decidir a cuál canónico apunta'
         WHEN slug LIKE '%cheer%' OR slug IN ('porras','stunt_groups')
              THEN 'C — variante de cheer: falta escribir sus categorías'
         ELSE 'C — genérico o sin federación'
       END                                           AS grupo,
       count(*)                                      AS cuantos,
       string_agg(name, ', ' ORDER BY name)          AS deportes
  FROM public.sports_categories
 WHERE categorias_oficiales IS NULL OR categorias_oficiales = '{}'::jsonb
 GROUP BY 1
 ORDER BY 2 DESC;
