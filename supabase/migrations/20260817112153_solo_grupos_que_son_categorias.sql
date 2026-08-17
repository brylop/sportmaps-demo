-- ============================================================================
-- Solo los grupos que de verdad son categorías
--
-- Fecha: 2026-08-17
-- Corrige a 20260816200754 (school_sport_categories).
--
-- ── El problema ─────────────────────────────────────────────────────────────
-- `sports_categories.categorias_oficiales` es un objeto con 49 grupos distintos
-- a lo largo de los 99 deportes, y NO todos son categorías de equipo:
--
--   SÍ lo son (deciden contra quién compite un atleta):
--     categorias_edad (79 deportes), categorias_peso*, kumite_*, kyorugi_*,
--     niveles, clases / clasificacion / clases_funcionamiento / sistema_puntos
--     (clasificación funcional paralímpica), handicap, divisiones, cinturones
--
--   NO lo son (formato de competencia, prueba, aparato, superficie):
--     modalidades (55 deportes) y modalidades_*, pruebas, pruebas_pista,
--     pruebas_campo, distancias, distancias_estilos, formatos, aparatos*,
--     armas, levantamientos, fases, disciplinas, embarcaciones, superficies,
--     clases_olimpicas / clases_no_olimpicas (clases de embarcación), genero
--
-- `school_sport_categories` aplanaba TODOS. Consecuencia concreta, vista en el
-- selector de «Crear equipo»: golf ofrecía «72 hoyos stroke play individual» y
-- «Stableford» como categorías, y tenis «Tierra batida (Clay)» y «Singles
-- masculino». Eso no es una categoría de equipo: es cómo se juega.
--
-- ── La regla ────────────────────────────────────────────────────────────────
-- Lista blanca, no lista negra. Un grupo nuevo que nadie clasificó queda FUERA.
-- Es la falla segura: si falta una categoría, la escuela la agrega a mano desde
-- «Deportes y categorías»; si sobra basura, se le ensucia la configuración y no
-- hay quien la limpie.
--
-- Y el grupo se sigue devolviendo: la UI lo usa para agrupar el selector, y
-- mezclar «Sub-15» con «-56kg» en una lista plana es lo que lo hace ilegible.
-- ============================================================================

BEGIN;

-- ── 1. ¿Este grupo es una categoría de equipo? ──────────────────────────────
CREATE OR REPLACE FUNCTION public.is_category_group(p_grupo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    -- starts_with() y no LIKE: 'categorias\_%' obliga a razonar sobre el escape
    -- del guion bajo, y ese es justo el tipo de detalle que se cuela mal.
    SELECT p_grupo IS NOT NULL
       AND (
             -- categorias_edad, categorias_peso, categorias_peso_femenino,
             -- categorias_peso_sanda_masculino, …
             pg_catalog.starts_with(p_grupo, 'categorias_')
             -- pesos que la federación llama por el nombre de su combate
          OR pg_catalog.starts_with(p_grupo, 'kumite_')
          OR pg_catalog.starts_with(p_grupo, 'kyorugi_')
          OR p_grupo IN (
                 'niveles', 'divisiones', 'cinturones',
                 -- clasificación funcional paralímpica: define contra quién
                 -- compite el atleta, igual que una categoría de peso
                 'clases', 'clasificacion', 'clases_funcionamiento',
                 'sistema_puntos', 'handicap'
             )
           );
$$;

REVOKE ALL ON FUNCTION public.is_category_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_category_group(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_category_group(text) IS
    'Lista blanca de los grupos de sports_categories.categorias_oficiales que son categorías de '
    'equipo. Deja fuera formato de competencia (modalidades, formatos), pruebas, aparatos, '
    'superficies y género, que no agrupan atletas entre sí. Un grupo nuevo queda fuera por '
    'defecto: falta una categoría es recuperable a mano, basura en la configuración no.';


-- ── 2. La RPC deja de ofrecer lo que no es categoría ────────────────────────
-- Igual a 20260816200754 salvo el filtro `is_category_group(g.grupo)`.
CREATE OR REPLACE FUNCTION public.school_sport_categories(
    p_school_id uuid,
    p_sport     text
)
RETURNS TABLE (
    nombre    text,
    origen    text,      -- 'oficial' | 'propia'
    adoptada  boolean,   -- ya está en sport_configs.rules de esta escuela
    detalle   jsonb      -- la regla completa (min/max, min_rating/max_rating, …)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
    IF NOT (public.is_school_member(auth.uid(), p_school_id) OR public.is_super_admin()) THEN
        RAISE EXCEPTION 'sin acceso a esta escuela' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    -- Lo que la escuela YA tiene configurado. Esto NO se filtra: si adoptó algo,
    -- se le muestra, aunque hoy no clasifiquemos su grupo como categoría. Que
    -- una categoría en uso desaparezca del selector es peor que mostrarla.
    SELECT r->>'name',
           COALESCE(r->>'origen', 'oficial'),
           true,
           r
      FROM public.sport_configs sc,
           LATERAL jsonb_array_elements(COALESCE(sc.rules, '[]'::jsonb)) r
     WHERE sc.school_id = p_school_id AND sc.sport = p_sport AND sc.is_active

    UNION ALL

    -- Lo que el catálogo oficial ofrece y la escuela todavía NO adoptó, ya sin
    -- modalidades, pruebas, superficies ni género.
    SELECT cat.valor,
           'oficial',
           false,
           jsonb_build_object('name', cat.valor, 'origen', 'oficial', 'grupo', g.grupo)
      FROM public.sports_categories s
      CROSS JOIN LATERAL jsonb_each(COALESCE(s.categorias_oficiales, '{}'::jsonb)) AS g(grupo, lista)
      CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(g.lista) = 'array' THEN g.lista ELSE '[]'::jsonb END
      ) AS cat(valor)
     WHERE s.slug = p_sport
       AND public.is_category_group(g.grupo)
       AND NOT EXISTS (
             SELECT 1 FROM public.sport_configs sc2,
                    LATERAL jsonb_array_elements(COALESCE(sc2.rules, '[]'::jsonb)) r2
              WHERE sc2.school_id = p_school_id AND sc2.sport = p_sport
                AND lower(r2->>'name') = lower(cat.valor)
           );
END;
$$;

REVOKE ALL ON FUNCTION public.school_sport_categories(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_sport_categories(uuid, text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación: qué entra y qué sale, por grupo.
-- Se espera que caigan modalidades, pruebas, superficies, aparatos y genero;
-- y que sobrevivan categorias_edad y los pesos.
-- ────────────────────────────────────────────────────────────────────────────
SELECT g.grupo,
       public.is_category_group(g.grupo)            AS es_categoria,
       count(DISTINCT s.slug)                       AS deportes,
       min(left(g.lista::text, 48))                 AS muestra
  FROM public.sports_categories s
  CROSS JOIN LATERAL jsonb_each(COALESCE(s.categorias_oficiales, '{}'::jsonb)) AS g(grupo, lista)
 GROUP BY g.grupo
 ORDER BY es_categoria DESC, deportes DESC;
