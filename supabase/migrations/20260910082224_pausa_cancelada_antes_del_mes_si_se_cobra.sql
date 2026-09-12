-- =============================================================================
-- 20260910082224_pausa_cancelada_antes_del_mes_si_se_cobra.sql
-- Autor: brylop   Fecha: 2026-09-10   Versión anterior: 20260910080313
-- Objetivo: fix de la Fase 1 de docs/specs/pausa-vacaciones-enrollments.md.
--
-- APLICADA EN LA BASE 2026-09-10 vía `apply_migration`
-- (versión registrada: 20260910082323 · pausa_cancelada_antes_del_mes_si_se_cobra).
-- =============================================================================
--
-- EL BUG
--
-- La regla de COBRO (`enrollment_pausada_en` + el `NOT EXISTS` de `open_month`)
-- ignoraba `resumed_at` a propósito: "un mes que ya se saltó sigue saltado
-- aunque el atleta vuelva antes". Eso es correcto cuando el mes YA EMPEZÓ — la
-- plata de ese mes ya se decidió y el cobro se anuló al aprobar la pausa.
--
-- Pero se llevaba puesto un caso que no estaba contemplado: una pausa
-- PROGRAMADA para un mes futuro y CANCELADA antes de que ese mes arranque. Ahí
-- no hay nada decidido y, sin embargo, el mes quedaba sin cobro para siempre.
-- Es plata que se pierde en silencio: el admin programa julio por error, lo
-- cancela en junio, y julio no se factura nunca.
--
-- LA REGLA CORREGIDA
--
-- El mes M no se cobra si una pausa aprobada lo cubre Y la pausa no terminó
-- ANTES de que M empezara:
--
--   resumed_at IS NULL        → sigue pausado                    → no se cobra
--   mes(resumed_at) >= M      → volvió durante o después de M,
--                               M ya estaba decidido              → no se cobra
--   mes(resumed_at) <  M      → se canceló antes de que M
--                               empezara                          → SÍ se cobra
--
-- La regla OPERATIVA (`v_enrollment_pauses_effective` /
-- `enrollment_pausada_el`) NO cambia: sigue recortando en `resumed_at` por día,
-- que es lo que hace que el que vuelve el 12 reaparezca en la lista de
-- asistencia el 12.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · Los GRANT de estas tres funciones ya los puso 20260910080206/080313 y
--     CREATE OR REPLACE no los toca.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.enrollment_pausada_en(
  p_enrollment_id uuid, p_year int, p_month int
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollment_pause_requests r
    WHERE r.enrollment_id = p_enrollment_id
      AND r.status = 'approved'
      AND make_date(p_year, p_month, 1) BETWEEN r.month_from AND r.month_to
      -- Una pausa cancelada ANTES de que el mes empiece no lo exime del cobro.
      AND (
        r.resumed_at IS NULL
        OR date_trunc('month', (r.resumed_at AT TIME ZONE 'America/Bogota')::date)::date
             >= make_date(p_year, p_month, 1)
      )
  );
$fn$;

COMMENT ON FUNCTION public.enrollment_pausada_en(uuid, int, int) IS
  'Regla de COBRO (granularidad de mes): TRUE si una pausa aprobada cubre ese mes calendario entero y no fue cancelada antes de que el mes empezara. Un mes ya empezado sigue saltado aunque el atleta vuelva antes (la plata ya se decidio); una pausa programada y cancelada antes SI se cobra. La usan open_month y preview_open_month.';

-- Mismo criterio, inline, en las dos funciones de generación. Se repite en vez
-- de llamar al helper para no meter una llamada a función por fila en el CTE
-- principal (los helpers sin envolver son la causa conocida de la lentitud de
-- agosto). Si se toca acá, tocar el helper de arriba también.
CREATE OR REPLACE FUNCTION public.open_month(
  p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_month_start date := make_date(p_year, p_month, 1);
  v_month_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff      int;
  v_due         date;
  v_created     int := 0;
  v_caller      uuid := auth.uid();
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

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
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(c.branch_id, t.branch_id)                             AS branch_id,
      c.parent_id,
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
      SELECT CASE
               WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
               ELSE COALESCE(
                 NULLIF(e.monthly_fee, 0),
                 NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
                 NULLIF(t.price_monthly, 0),
                 NULLIF(c.monthly_fee, 0),
                 0
               )
             END AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      -- PAUSA: el mes pausado no se cobra, salvo que la pausa se haya
      -- cancelado ANTES de que el mes empezara (ver encabezado).
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
          AND (
            r.resumed_at IS NULL
            OR date_trunc('month', (r.resumed_at AT TIME ZONE 'America/Bogota')::date)::date
                 >= v_month_start
          )
      )
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
             OR (p2.period_year IS NULL
                   AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  ),
  ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month, payment_category
    )
    SELECT
      el.school_id, el.branch_id, el.parent_id, el.child_id, el.user_id,
      el.unregistered_athlete_id, el.team_id, el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount, v_due, 'pending', 'subscription',
      p_year::smallint, p_month::smallint, 'mensualidad'
    FROM elegibles el
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date',  v_due, 'generados', v_created
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.preview_open_month(
  p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
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

  -- MISMO CTE que open_month. Si acá el criterio difiere, la pantalla de
  -- confirmacion miente respecto de lo que se va a generar.
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
      SELECT CASE
               WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
               ELSE COALESCE(
                 NULLIF(e.monthly_fee, 0),
                 NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
                 NULLIF(t.price_monthly, 0),
                 NULLIF(c.monthly_fee, 0), 0)
             END AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
          AND (
            r.resumed_at IS NULL
            OR date_trunc('month', (r.resumed_at AT TIME ZONE 'America/Bogota')::date)::date
                 >= v_month_start
          )
      )
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
$fn$;

COMMIT;
