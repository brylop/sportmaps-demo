-- ============================================================================
-- Categorías por escuela: las oficiales del catálogo + las propias
--
-- Fecha: 2026-08-16
-- Cierra el bloque del catálogo (20260816195545, 20260816200007, hook del front).
--
-- ── El caso que hay que resolver ────────────────────────────────────────────
-- «Escojo fútbol pero manejo Sub-19»: FIFA define Sub-11, Sub-13, Sub-15,
-- Sub-17, Sub-20, Sub-23 y Senior. Sub-19 no existe en el catálogo oficial, y
-- sin embargo media Colombia juega Sub-19. La escuela tiene que poder crearla y
-- que quede **mapeada**, no escrita a mano en el nombre del equipo.
--
-- Y al revés: en cheer, las categorías oficiales SÍ están completas (Novice,
-- Prep, Elite, IASF Worlds, con sus niveles 1, 1.1, 2.1, 2.2 y sus ramas Tiny,
-- Mini, Youth, Junior, Senior, Open). Esas no hay que inventarlas: hay que
-- ofrecerlas.
--
-- ── Dónde viven ─────────────────────────────────────────────────────────────
-- No se toca `sports_categories`: ese es el catálogo GLOBAL y lo que una
-- escuela use no puede ensuciarlo. Lo propio va en `sport_configs.rules`, que
-- ya existe, ya es por escuela + deporte, y ya tiene un validador de forma por
-- eje (`trg_validate_sport_config_rules`).
--
-- Cada regla lleva `origen`: 'oficial' (vino del catálogo) o 'propia' (la
-- agregó la escuela). Sin esa marca no se puede distinguir «Sub-19 porque así
-- juegan» de «Sub-19 porque alguien se equivocó tecleando».
--
-- ── Estado hoy ──────────────────────────────────────────────────────────────
-- No hay NINGUNA pantalla que administre sport_configs: nadie los escribe desde
-- el frontend. Las categorías son, en la práctica, el nombre del equipo escrito
-- a mano. Estas RPC son la base para que dejen de serlo.
-- ============================================================================

BEGIN;

-- ── 1. Leer las categorías de una escuela para un deporte ───────────────────
-- Devuelve la unión: lo que la escuela ya tiene configurado + lo que el
-- catálogo oficial ofrece y todavía no adoptó. Con `origen` y `adoptada` para
-- que la UI pueda mostrarlas distinto.
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
DECLARE
    v_eje text;
BEGIN
    IF NOT (public.is_school_member(auth.uid(), p_school_id) OR public.is_super_admin()) THEN
        RAISE EXCEPTION 'sin acceso a esta escuela' USING ERRCODE = '42501';
    END IF;

    SELECT categorization_axis INTO v_eje
      FROM public.sport_configs
     WHERE school_id = p_school_id AND sport = p_sport AND is_active
     LIMIT 1;

    RETURN QUERY
    -- Lo que la escuela YA tiene configurado.
    SELECT r->>'name',
           COALESCE(r->>'origen', 'oficial'),
           true,
           r
      FROM public.sport_configs sc,
           LATERAL jsonb_array_elements(COALESCE(sc.rules, '[]'::jsonb)) r
     WHERE sc.school_id = p_school_id AND sc.sport = p_sport AND sc.is_active

    UNION ALL

    -- Lo que el catálogo oficial ofrece y la escuela todavía NO adoptó.
    -- Se leen las listas de texto de `categorias_oficiales` (categorias_edad,
    -- niveles, modalidades, …); cada deporte usa las suyas.
    -- `grupo` se conserva para que la UI pueda separar «categorias_edad» de
    -- «modalidades»: mezclar Sub-15 con «Fútbol Playa» en una sola lista es lo
    -- que hace que nadie entienda el selector.
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


-- ── 2. Agregar una categoría propia ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.school_add_sport_category(
    p_school_id uuid,
    p_sport     text,
    p_nombre    text,
    p_min       integer DEFAULT NULL,   -- eje 'age'
    p_max       integer DEFAULT NULL,
    p_origen    text    DEFAULT 'propia'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_eje    text;
    v_regla  jsonb;
    v_reglas jsonb;
BEGIN
    IF NOT (public.is_school_admin(p_school_id) OR public.is_super_admin()) THEN
        RAISE EXCEPTION 'solo un administrador de la escuela puede agregar categorías'
            USING ERRCODE = '42501';
    END IF;

    IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
        RAISE EXCEPTION 'la categoría necesita un nombre' USING ERRCODE = '22023';
    END IF;

    SELECT categorization_axis, COALESCE(rules, '[]'::jsonb)
      INTO v_eje, v_reglas
      FROM public.sport_configs
     WHERE school_id = p_school_id AND sport = p_sport AND is_active
     LIMIT 1;

    IF v_eje IS NULL THEN
        RAISE EXCEPTION 'la escuela no tiene configurado el deporte %. Actívalo primero.', p_sport
            USING ERRCODE = '23503';
    END IF;

    -- Duplicados: sin esto, «Sub-19» y «sub-19» conviven y el selector muestra
    -- las dos.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_reglas) r
                WHERE lower(r->>'name') = lower(btrim(p_nombre))) THEN
        RAISE EXCEPTION 'la categoría "%" ya existe en % para esta escuela', btrim(p_nombre), p_sport
            USING ERRCODE = '23505';
    END IF;

    -- La forma la exige el validador `trg_validate_sport_config_rules`, y es
    -- distinta por eje. Se arma acá para que quien llame no tenga que saberlo.
    v_regla := jsonb_build_object('name', btrim(p_nombre), 'origen', p_origen);

    IF v_eje = 'age' THEN
        IF p_min IS NULL OR p_max IS NULL THEN
            RAISE EXCEPTION 'en % las categorías van por edad: falta el rango (min y max)', p_sport
                USING ERRCODE = '22023';
        END IF;
        v_regla := v_regla || jsonb_build_object('min', p_min, 'max', p_max);
    ELSIF v_eje = 'level' THEN
        v_regla := v_regla || jsonb_build_object(
            'min_rating', COALESCE(p_min, 1),
            'max_rating', COALESCE(p_max, 10));
    ELSIF v_eje = 'weight' THEN
        IF p_min IS NULL OR p_max IS NULL THEN
            RAISE EXCEPTION 'en % las categorías van por peso: falta el rango en kg', p_sport
                USING ERRCODE = '22023';
        END IF;
        v_regla := v_regla || jsonb_build_object('min_kg', p_min, 'max_kg', p_max);
    ELSIF v_eje = 'belt' THEN
        v_regla := v_regla || jsonb_build_object('order', COALESCE(p_min, jsonb_array_length(v_reglas) + 1));
    ELSIF v_eje = 'none' THEN
        RAISE EXCEPTION '% no usa categorías (eje "none")', p_sport USING ERRCODE = '22023';
    END IF;

    UPDATE public.sport_configs
       SET rules      = v_reglas || jsonb_build_array(v_regla),
           updated_at = now()
     WHERE school_id = p_school_id AND sport = p_sport AND is_active;

    RETURN jsonb_build_object('ok', true, 'sport', p_sport, 'eje', v_eje, 'categoria', v_regla);
END;
$$;

REVOKE ALL ON FUNCTION public.school_add_sport_category(uuid, text, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_add_sport_category(uuid, text, text, integer, integer, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.school_add_sport_category(uuid, text, text, integer, integer, text) IS
    'Agrega una categoría a sport_configs.rules de una escuela, armando la forma que exige '
    'trg_validate_sport_config_rules según el eje del deporte. Marca origen=propia para poder '
    'distinguirla de las que vinieron del catálogo oficial. No toca sports_categories: el '
    'catálogo global no se ensucia con lo que use una escuela.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación con el caso real: fútbol no trae Sub-19 en el catálogo oficial.
-- ────────────────────────────────────────────────────────────────────────────
SELECT s.name,
       jsonb_array_length(COALESCE(s.categorias_oficiales->'categorias_edad', '[]'::jsonb)) AS edades_oficiales,
       s.categorias_oficiales->'categorias_edad'                                            AS cuales,
       (s.categorias_oficiales->'categorias_edad') @> '["Sub-19"]'::jsonb                   AS trae_sub19
  FROM public.sports_categories s
 WHERE s.slug IN ('futbol', 'cheerleading_all_stars');
