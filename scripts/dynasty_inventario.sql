-- ============================================================================
-- Inventario de Dynasty: planes, equipos y distribución de deportistas
--
-- Objetivo: conocer las CATEGORÍAS REALES (y si hay dato de sexo) para
-- regenerar la hoja de umbrales del coach con las categorías que existen, en
-- vez de una escalera estándar inventada.
--
-- Privacidad: NO pide nombres de deportistas. Solo conteos agregados — para
-- definir umbrales por categoría no hace falta saber quién es quién.
--
-- Corre los bloques de a uno y pega el resultado. Cada uno devuelve un JSON.
-- Convención del SQL editor de Supabase: sin CREATE TEMP TABLE ni RAISE NOTICE.
-- ============================================================================


-- ── 0. ¿Qué columnas existen? (para no adivinar el esquema) ─────────────────
-- Corre este primero: me dice qué hay en teams y offering_plans, y si el sexo
-- del deportista se guarda en algún lado.
SELECT jsonb_pretty(jsonb_agg(x ORDER BY x->>'tabla', x->>'columna'))
FROM (
    SELECT jsonb_build_object(
               'tabla', c.table_name,
               'columna', c.column_name,
               'tipo', c.data_type
           ) AS x
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND (
          c.table_name IN ('teams', 'offering_plans')
          -- cualquier columna de sexo/género donde viva el dato del atleta
          OR (c.table_name IN ('children', 'profiles', 'school_athletes')
              AND c.column_name ~* 'sex|gender|genero|género')
      )
) s;


-- ── 1. La escuela ───────────────────────────────────────────────────────────
SELECT jsonb_pretty(to_jsonb(s))
FROM (
    SELECT id, name, category_id
    FROM public.schools
    WHERE name ILIKE '%dynasty%'
) s;


-- ── 2. Equipos + cuántos deportistas activos tiene cada uno ─────────────────
-- Esto es lo que necesito para las categorías de la hoja de umbrales.
SELECT jsonb_pretty(jsonb_agg(x ORDER BY x->>'equipo'))
FROM (
    SELECT jsonb_build_object(
               'equipo',            t.name,
               'deporte',           t.sport,
               'categoria_edad',    t.age_group,
               'cuota_mensual',     t.price_monthly,
               'atletas_activos',   count(sa.id),
               'menores',           count(*) FILTER (WHERE sa.athlete_type = 'child'),
               'adultos',           count(*) FILTER (WHERE sa.athlete_type = 'adult'),
               'sin_registrar',     count(*) FILTER (WHERE sa.athlete_type = 'unregistered')
           ) AS x
    FROM public.teams t
    LEFT JOIN public.school_athletes sa
           ON sa.enrolled_team_id = t.id
          AND sa.is_active
    WHERE t.school_id = (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1)
    GROUP BY t.id, t.name, t.sport, t.age_group, t.price_monthly
) y;


-- ── 3. Planes que la escuela le vende a las familias ────────────────────────
-- OJO: offering_plans (catálogo que la escuela VENDE), no school_subscriptions
-- (el plan SaaS que la escuela le paga a SportMaps). Son cosas distintas.
SELECT jsonb_pretty(jsonb_agg(x ORDER BY x->>'plan'))
FROM (
    SELECT jsonb_build_object(
               'plan',            op.name,
               'precio',          op.price,
               'activo',          op.is_active,
               'atletas_activos', count(sa.id)
           ) AS x
    FROM public.offering_plans op
    LEFT JOIN public.school_athletes sa
           ON sa.offering_plan_id = op.id
          AND sa.is_active
    WHERE op.school_id = (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1)
    GROUP BY op.id, op.name, op.price, op.is_active
) y;


-- ── 4. Panorama general (una sola fila, para dimensionar) ───────────────────
SELECT jsonb_pretty(to_jsonb(r))
FROM (
    SELECT
        count(*)                                              AS atletas_activos,
        count(*) FILTER (WHERE athlete_type = 'child')         AS menores,
        count(*) FILTER (WHERE athlete_type = 'adult')         AS adultos,
        count(*) FILTER (WHERE athlete_type = 'unregistered')  AS sin_registrar,
        count(*) FILTER (WHERE enrolled_team_id IS NULL)       AS sin_equipo,
        count(DISTINCT enrolled_team_id)                       AS equipos_con_atletas
    FROM public.school_athletes
    WHERE school_id = (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1)
      AND is_active
) r;


-- ── 5. BONUS — cuántas familias tienen cuenta activa (el dato de R7) ────────
-- Este es el número que decide si el emisor de informes es urgente o prematuro:
-- un menor sin acudiente vinculado no tiene a quién recibirle el informe.
-- Ver docs/specs/athlete-reports-module.md, D16 y R7.
SELECT jsonb_pretty(to_jsonb(r))
FROM (
    SELECT
        count(*)                                    AS menores_activos,
        count(c.parent_id)                          AS con_acudiente_vinculado,
        count(*) - count(c.parent_id)               AS sin_acudiente,
        round(100.0 * count(c.parent_id) / NULLIF(count(*), 0), 1) AS pct_vinculados
    FROM public.school_athletes sa
    JOIN public.children c ON c.id = sa.id
    WHERE sa.school_id = (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1)
      AND sa.is_active
      AND sa.athlete_type = 'child'
) r;
