-- =============================================================================
-- 20260924111620_futsal_en_catalogo_de_deportes.sql
-- Autor: brylop   Fecha: 2026-09-24   Versión anterior: 20260924102935
-- Objetivo: agregar Fútbol Sala (futsal) al catálogo de deportes. No existía en
--           ninguna lista: solo figuraba como "modalidad" dentro de Fútbol, y
--           una escuela de fútbol sala no es una escuela de fútbol 11.
-- =============================================================================
-- Qué hace (todo idempotente; no toca nada existente):
--   1. Fila en public.sports_categories (slug 'futsal', nombre 'Fútbol Sala').
--      Es la fuente que leen useSportsCatalog, RegisterPage, CreateTeamModal,
--      /explorar y el módulo de rendimiento (que busca por nombre, ilike).
--   2. Plantillas de categorías por edad y rama en sport_category_templates
--      (sugerencias; la escuela adopta y ajusta). Rangos según
--      docs/specs/sport-categories-and-multi-category.md §3.1; roster 5–14
--      (5 en cancha + hasta 9 suplentes, reglas FIFA de futsal).
--   3. Métricas de rendimiento: copia de las de Fútbol (mismo modelo técnico,
--      táctico, físico y post-entreno). Sin esto, un equipo de Fútbol Sala
--      abriría el módulo de rendimiento vacío.
-- El slug 'futsal' es el que ya reservaba el spec. El mismo deporte se agregó a
-- la constante de respaldo frontend/src/lib/constants/sportsCatalog.ts (id 129).
-- =============================================================================

BEGIN;

-- 1. Catálogo maestro ---------------------------------------------------------
INSERT INTO public.sports_categories
    (name, slug, description, icon, is_active,
     federacion_internacional, acronimo_fi, estado_olimpico,
     categorias_oficiales, uses_sets_scoring)
SELECT 'Fútbol Sala', 'futsal',
       'Fútbol de cinco jugadores en cancha cubierta (futsal FIFA)', '⚽', true,
       'FIFA', 'FIFA', 'No Olímpico',
       '{"modalidades":["5v5 (Futsal FIFA)"],
         "categorias_edad":["Sub-6","Sub-8","Sub-10","Sub-12","Sub-14","Sub-16","Sub-18","Sub-20","Libre"],
         "genero":["Masculino","Femenino"]}'::jsonb,
       false
WHERE NOT EXISTS (
    SELECT 1 FROM public.sports_categories
     WHERE slug = 'futsal' OR lower(name) = lower('Fútbol Sala')
);

-- 2. Plantillas de categorías -------------------------------------------------
INSERT INTO public.sport_category_templates
    (sport, archetype, division, category, rama, level, age_min, age_max, team_min, team_max, sort_order)
SELECT v.sport, v.archetype, v.division, v.category, v.rama, v.level,
       v.age_min, v.age_max, v.team_min, v.team_max, v.sort_order
  FROM (VALUES
    ('futsal','team','Sub-6', 'Sub-6', 'Mixto',     NULL::text,  4,  6, 5, 12,  1),
    ('futsal','team','Sub-8', 'Sub-8', 'Mixto',     NULL::text,  7,  8, 5, 12,  2),
    ('futsal','team','Sub-10','Sub-10','Masculino', NULL::text,  9, 10, 5, 14,  3),
    ('futsal','team','Sub-10','Sub-10','Femenino',  NULL::text,  9, 10, 5, 14,  4),
    ('futsal','team','Sub-12','Sub-12','Masculino', NULL::text, 11, 12, 5, 14,  5),
    ('futsal','team','Sub-12','Sub-12','Femenino',  NULL::text, 11, 12, 5, 14,  6),
    ('futsal','team','Sub-14','Sub-14','Masculino', NULL::text, 13, 14, 5, 14,  7),
    ('futsal','team','Sub-14','Sub-14','Femenino',  NULL::text, 13, 14, 5, 14,  8),
    ('futsal','team','Sub-16','Sub-16','Masculino', NULL::text, 15, 16, 5, 14,  9),
    ('futsal','team','Sub-16','Sub-16','Femenino',  NULL::text, 15, 16, 5, 14, 10),
    ('futsal','team','Sub-18','Sub-18','Masculino', NULL::text, 17, 18, 5, 14, 11),
    ('futsal','team','Sub-18','Sub-18','Femenino',  NULL::text, 17, 18, 5, 14, 12),
    ('futsal','team','Sub-20','Sub-20','Masculino', NULL::text, 19, 20, 5, 14, 13),
    ('futsal','team','Sub-20','Sub-20','Femenino',  NULL::text, 19, 20, 5, 14, 14),
    ('futsal','team','Libre', 'Libre', 'Masculino', NULL::text, 16, 99, 5, 14, 15),
    ('futsal','team','Libre', 'Libre', 'Femenino',  NULL::text, 16, 99, 5, 14, 16)
  ) AS v(sport, archetype, division, category, rama, level, age_min, age_max, team_min, team_max, sort_order)
 WHERE NOT EXISTS (
    SELECT 1 FROM public.sport_category_templates WHERE lower(sport) = 'futsal'
 );

-- 3. Métricas de rendimiento, copiadas de Fútbol ------------------------------
INSERT INTO public.sport_metric_definitions
    (sport_category_id, metric_key, display_name, data_type, unit, category, subcategory,
     min_value, max_value, higher_is_better, parent_label, parent_hint,
     aggregation, options, required, is_active)
SELECT fs.id, m.metric_key, m.display_name, m.data_type, m.unit, m.category, m.subcategory,
       m.min_value, m.max_value, m.higher_is_better, m.parent_label, m.parent_hint,
       m.aggregation, m.options, m.required, m.is_active
  FROM public.sport_metric_definitions m
  JOIN public.sports_categories f  ON f.id = m.sport_category_id AND f.slug = 'futbol'
  JOIN public.sports_categories fs ON fs.slug = 'futsal'
 WHERE m.is_active
ON CONFLICT (sport_category_id, metric_key) DO NOTHING;

COMMIT;

-- Verificación:
--   select slug, name, icon from public.sports_categories where slug = 'futsal';
--   select count(*) from public.sport_category_templates where sport = 'futsal';        -- 16
--   select count(*) from public.sport_metric_definitions m
--     join public.sports_categories s on s.id = m.sport_category_id
--    where s.slug = 'futsal';                                                            -- 31
