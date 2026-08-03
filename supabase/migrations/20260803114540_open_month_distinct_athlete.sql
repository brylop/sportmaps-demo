-- =============================================================================
-- 20260803114540_open_month_distinct_athlete.sql
-- Autor: brylop   Fecha: 2026-08-03   Versión anterior: 20260803112616
-- Objetivo: un cobro por ATLETA y no por inscripción. Cierra la ventana
--   intra-sentencia de open_month, que con dos inscripciones activas insertaba dos
--   veces y abortaba la apertura de mes de toda la escuela.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- Implementa **M1** de docs/plan-f0-generacion-de-mes-y-cobros-duplicados.md (§3.1, §5),
-- con el cinturón de §11.3.
--
-- EL BUG
--
-- `open_month` es un solo `INSERT … SELECT` con `NOT EXISTS`. Las subconsultas de una
-- sentencia ven el snapshot ANTERIOR a la sentencia, así que las filas que el propio
-- INSERT va produciendo son invisibles para su `NOT EXISTS`. Con dos inscripciones
-- activas del mismo atleta, ambas pasan el filtro y ambas insertan.
--
-- El advisory lock no cubre esto: no es concurrencia entre transacciones, es una sola
-- sentencia. El lock serializa dos llamadas, no dos filas dentro de la misma.
--
-- Hoy lo frena el índice único: la segunda fila revienta con 23505 y **aborta el
-- open_month completo**. El síntoma no es "dos cobros" sino "el mes no se generó para
-- toda la escuela" — y por el cron es peor, porque su `EXCEPTION WHEN OTHERS` la salta
-- en silencio y reporta éxito global (§11.1 del plan).
--
-- EL DESEMPATE NO MIRA EL MONTO
--
-- Deliberado, y es la corrección de §2 del plan. Con `fee.amount DESC` se reintroduce un
-- sobrecobro real y medido: una atleta de Dynasty tiene una huérfana de $180.000 y un
-- plan de $150.000 — el monto alto era dato rancio, no una cuota mayor. Cobrarle el
-- máximo son $30.000 de más cada mes.
--
--   1. la que tiene plan     — el plan gobierna el cobro
--   2. antes que la que solo tiene equipo
--   3. antes que la huérfana
--   4. created_at ASC        — determinista, y es la que carga el historial
--
-- Es el mismo criterio con el que M3 fusionará: la fila que gana el DISTINCT ON es la
-- que sobreviviría al merge, y cobra por su propia fuente.
--
-- ORDEN DE LOS FILTROS
--
-- `fee.amount > 0` y el `NOT EXISTS` quedan DENTRO del CTE, antes del DISTINCT ON. Así
-- se elige entre las filas que de verdad facturan: si el desempate corriera primero y la
-- ganadora tuviera monto 0, el atleta se caería del mes entero aunque su otra
-- inscripción sí cobrara. Hoy una fila con monto 0 simplemente no genera y la otra sí;
-- esto lo preserva.
--
-- El `NOT EXISTS` depende del atleta y no de la fila, así que da igual a qué lado del
-- DISTINCT ON esté.
--
-- SUB-FACTURACIÓN CONOCIDA (§11.6)
--
-- Para los 80 atletas con dos inscripciones activas, esto genera UN cobro y elige el del
-- plan. Si alguno debiera pagar dos conceptos, queda sub-facturado y el código no puede
-- saberlo. Eso lo salda M3 (el merge con revisión de la escuela); M1 solo evita que el
-- mes aborte o que se cobre doble.
--
-- PREVIEW Y REAL, EL MISMO CRITERIO
--
-- El cambio va en las DOS funciones. Si `preview_open_month` no lleva el mismo desempate,
-- la pantalla de confirmación miente respecto de lo que se va a generar.

BEGIN;

CREATE OR REPLACE FUNCTION public.open_month(
  p_school_id uuid,
  p_year      int,
  p_month     int,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_month_start date := make_date(p_year, p_month, 1);
  v_month_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff      int;
  v_due         date;
  v_created     int := 0;
  v_caller      uuid := auth.uid();
BEGIN
  -- Autorización: admin de la escuela / super admin. El cron y service_role
  -- corren sin auth.uid() (v_caller NULL) y pasan.
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  -- Serializa por (escuela, periodo): dos disparadores concurrentes (doble-clic,
  -- cron + botón el mismo día) esperan en fila → cero duplicados por carrera.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10) INTO v_cutoff
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );

  WITH elegibles AS (
    -- Una fila por ATLETA. Ver el encabezado: el desempate no mira el monto.
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(c.branch_id, t.branch_id)                             AS branch_id,
      c.parent_id,                       -- solo el menor tiene acudiente; adulto/unreg → NULL
      e.child_id,
      e.user_id,
      e.unregistered_athlete_id,
      e.team_id,
      e.offering_plan_id,
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')    AS athlete_name,
      fee.amount                                                     AS amount
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(e.monthly_fee, 0),
        NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
        NULLIF(t.price_monthly, 0),
        NULLIF(c.monthly_fee, 0),
        0
      ) AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))  -- adulto (incl. legacy en parent_id)
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL
                   AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)  -- legacy sin periodo
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,   -- 1. el plan gobierna el cobro
             (e.team_id IS NOT NULL)          DESC,   -- 2. antes que una huérfana
             e.created_at ASC                         -- 3. la más antigua: carga el historial
  ),
  ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month
    )
    SELECT
      el.school_id,
      el.branch_id,
      el.parent_id,
      el.child_id,
      el.user_id,
      el.unregistered_athlete_id,
      el.team_id,
      el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount,
      v_due,
      'pending',
      'subscription',
      p_year::smallint,
      p_month::smallint
    FROM elegibles el
    -- Cinturón (§11.3): el DISTINCT ON deduplica por la clave que elegimos. Basta una
    -- vía futura que produzca un choque no contemplado para volver a abortar un lote de
    -- 400 cobros. Con esto, ese fallo pasa a ser "se salta esa fila".
    -- No falsea el contador: RETURNING no devuelve las filas que chocan.
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object(
    'school_id', p_school_id,
    'year',      p_year,
    'month',     p_month,
    'due_date',  v_due,
    'generados', v_created
  );
END;
$$;

COMMENT ON FUNCTION public.open_month(uuid, int, int, uuid) IS
  'Genera las cuotas del mes para una escuela por una sola vía canónica (period poblado, subscription, sin prorrateo, dedup por mes calendario, advisory lock). Un cobro por ATLETA: DISTINCT ON con desempate plan > equipo > más antigua, sin mirar el monto. Idempotente. Reemplaza cron/botón/insert client-side. OJO: no persiste ninguna apertura — monthly_closes no existe todavía, así que abrir el mes no deja rastro (desviación consciente respecto del spec del ciclo de mes).';

-- Preview: qué generaría, sin persistir (reemplaza el loadPreview client-side)
CREATE OR REPLACE FUNCTION public.preview_open_month(
  p_school_id uuid,
  p_year      int,
  p_month     int,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_month_start date := make_date(p_year, p_month, 1);
  v_month_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff      int;
  v_due         date;
  v_items       jsonb;
  v_caller      uuid := auth.uid();
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT COALESCE(payment_cutoff_day, 10) INTO v_cutoff
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_due := make_date(p_year, p_month, LEAST(v_cutoff, extract(day from (v_month_end - 1))::int));

  -- MISMO CTE que open_month. Si acá el criterio difiere, la pantalla de confirmación
  -- miente respecto de lo que se va a generar.
  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS athlete_name,
      CASE WHEN e.child_id IS NOT NULL THEN 'menor'
           WHEN e.user_id  IS NOT NULL THEN 'adulto'
           ELSE 'no_registrado' END                                AS tipo,
      fee.amount                                                   AS amount
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(e.monthly_fee, 0),
        NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
        NULLIF(t.price_monthly, 0),
        NULLIF(c.monthly_fee, 0), 0) AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'athlete',  el.athlete_name,
           'tipo',     el.tipo,
           'amount',   el.amount,
           'due_date', v_due
         )), '[]'::jsonb)
  INTO v_items
  FROM elegibles el;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date', v_due,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION public.preview_open_month(uuid, int, int, uuid) IS
  'Vista previa de open_month sin persistir. Para la pantalla de confirmación del botón Generar. Lleva el MISMO DISTINCT ON y el mismo desempate que open_month: si difieren, el preview miente.';

-- Grants: authenticated (gate interno por is_school_admin) + service_role (cron/BFF)
REVOKE ALL ON FUNCTION public.open_month(uuid, int, int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_open_month(uuid, int, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_month(uuid, int, int, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_open_month(uuid, int, int, uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- Se puede verificar TODO sin escribir un solo cobro, porque preview_open_month lleva el
-- mismo criterio y no persiste nada.
--
-- 1) Las dos funciones quedaron con el DISTINCT ON:
--
--    SELECT p.proname,
--           (pg_get_functiondef(p.oid) LIKE '%DISTINCT ON%')  AS tiene_distinct,
--           (pg_get_functiondef(p.oid) LIKE '%ON CONFLICT%')  AS tiene_cinturon
--      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname = 'public' AND p.proname IN ('open_month','preview_open_month')
--
-- 2) El preview de Dynasty para agosto debe bajar de 23 filas a 15, y de $3.690.000 a
--    $2.310.000 — un cobro por atleta:
--
--    SELECT (public.preview_open_month('2d509571-3238-4c04-ac3f-6dfe20539226', 2026, 8) -> 'count') AS cobros
--
-- 3) Y ninguno de esos 15 debe repetir atleta:
--
--    SELECT item ->> 'athlete' AS atleta, count(*)
--      FROM jsonb_array_elements(
--             public.preview_open_month('2d509571-3238-4c04-ac3f-6dfe20539226', 2026, 8) -> 'items'
--           ) AS item
--     GROUP BY 1 HAVING count(*) > 1
--
--    Esperado: cero filas. Si sale alguna, el DISTINCT ON no está agrupando por el
--    sujeto correcto (p.ej. hermanos colapsando bajo el acudiente — el error del V5 del
--    plan, §4).
--
-- Vuelta atrás: migración nueva con el cuerpo de 20260724000002.
