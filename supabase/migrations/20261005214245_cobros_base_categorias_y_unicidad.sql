-- =============================================================================
-- 20261005214245_cobros_base_categorias_y_unicidad.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005135530
-- Objetivo: F-A del plan docs/specs/dreamers-reglas-completas-plan.md — base de
-- cobros compartida para inscripción / seguro / excedente (cobros que NO son una
-- mensualidad aunque el trigger trg_payments_fill_period les ponga período).
--
--   B2  uniq_payment_active_period_per_adult / _per_unreg no tenían la cláusula
--       `NOT period_uniqueness_exempt` (la de menores sí, desde 20260903103757).
--       Se recrean con ella. SOLO AFLOJA: toda fila que hoy cumple el índice lo
--       sigue cumpliendo (el predicado nuevo es más estrecho).
--   ·   payments_payment_category_check += 'seguro', 'excedente' (solo amplía).
--   B3  fn_extend_enrollment_on_payment_paid: pagar una inscripción / seguro /
--       excedente ya NO suma duration_days a la inscripción (antes pagar la
--       inscripción regalaba un mes de vigencia si la fila traía offering_plan_id).
--   ·   open_month: un cobro inscripcion/seguro/excedente del mes NO cuenta como
--       "este período ya está cobrado" (si no, la mensualidad del mes de alta se
--       saltaba porque el trigger le estampa el período del due_date).
--
-- Bases vivas (pg_get_functiondef, 2026-10-05):
--   · fn_extend_enrollment_on_payment_paid  oid 185292 — único cambio: la
--     condición `AND COALESCE(NEW.payment_category,'') NOT IN (...)`.
--   · open_month(uuid,int,int,uuid)         oid 187157 — único cambio: la misma
--     condición dentro del NOT EXISTS de cobros del período. ACL intacta
--     (CREATE OR REPLACE conserva los GRANT existentes).
--   · Índices: definición viva de pg_indexes + la cláusula nueva.
--
-- Radio medido 2026-10-05: 0 filas con payment_category IN
-- ('inscripcion','seguro','excedente') → los cambios de función son no-op para
-- los datos de hoy. Ninguna fila existente cambia.
-- =============================================================================

BEGIN;

-- ── B2: índices únicos de adulto / no registrado con la exención ────────────
DROP INDEX IF EXISTS public.uniq_payment_active_period_per_adult;
CREATE UNIQUE INDEX uniq_payment_active_period_per_adult
  ON public.payments USING btree (user_id, period_year, period_month)
  WHERE child_id IS NULL
    AND user_id IS NOT NULL
    AND period_year IS NOT NULL
    AND period_month IS NOT NULL
    AND status = ANY (ARRAY['pending','awaiting_approval','paid','partial','overdue','glosado'])
    AND NOT period_uniqueness_exempt;

DROP INDEX IF EXISTS public.uniq_payment_active_period_per_unreg;
CREATE UNIQUE INDEX uniq_payment_active_period_per_unreg
  ON public.payments USING btree (unregistered_athlete_id, period_year, period_month)
  WHERE unregistered_athlete_id IS NOT NULL
    AND period_year IS NOT NULL
    AND period_month IS NOT NULL
    AND status = ANY (ARRAY['pending','awaiting_approval','paid','partial','overdue','glosado'])
    AND NOT period_uniqueness_exempt;

-- ── payment_category: += seguro, excedente (solo amplía) ────────────────────
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_category_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_category_check
  CHECK (payment_category IS NULL OR payment_category = ANY (ARRAY[
    'mensualidad','inscripcion','articulos','torneo','otro','seguro','excedente'
  ]));

-- ── B3: pagar inscripción/seguro/excedente no extiende la vigencia ──────────
CREATE OR REPLACE FUNCTION public.fn_extend_enrollment_on_payment_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_enrollment record;
    v_duration   integer;
BEGIN
    IF NEW.status = 'paid'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
       AND NEW.offering_plan_id IS NOT NULL
       -- 20261005214245: un cobro único (inscripción, seguro, excedente) no es
       -- un período de servicio; pagarlo no regala duration_days.
       AND COALESCE(NEW.payment_category, '') NOT IN ('inscripcion', 'seguro', 'excedente') THEN

        SELECT e.id, e.expires_at, e.status
        INTO v_enrollment
        FROM public.enrollments e
        WHERE e.school_id = NEW.school_id
          AND e.offering_plan_id = NEW.offering_plan_id
          AND e.status IN ('active', 'cancelled')
          AND (
                (NEW.child_id IS NOT NULL AND e.child_id = NEW.child_id)
                OR
                (NEW.unregistered_athlete_id IS NOT NULL
                 AND e.unregistered_athlete_id = NEW.unregistered_athlete_id)
                OR
                (NEW.child_id IS NULL AND NEW.unregistered_athlete_id IS NULL
                 AND e.child_id IS NULL AND e.unregistered_athlete_id IS NULL
                 AND e.user_id IN (NEW.user_id, NEW.parent_id))
              )
        ORDER BY (e.status = 'active') DESC, e.created_at DESC
        LIMIT 1;

        IF FOUND THEN
            SELECT duration_days INTO v_duration
            FROM public.offering_plans
            WHERE id = NEW.offering_plan_id;

            UPDATE public.enrollments
            SET status      = 'active',
                expires_at  = GREATEST(COALESCE(v_enrollment.expires_at, CURRENT_DATE), CURRENT_DATE)
                               + COALESCE(v_duration, 30),
                updated_at  = now()
            WHERE id = v_enrollment.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- ── open_month: los cobros únicos no ocupan el período ──────────────────────
CREATE OR REPLACE FUNCTION public.open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_created          int := 0;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_sibling_enabled, v_sibling_pct
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
      fee.amount                                                     AS amount,
      fee.sibling_discount_applied                                   AS sibling_discount_applied
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
             ) AS base_amount
    ) base
    CROSS JOIN LATERAL (
      SELECT CASE
               WHEN v_sibling_enabled AND v_sibling_pct > 0 AND c.parent_id IS NOT NULL
                    AND EXISTS (
                      SELECT 1 FROM public.enrollments e2
                      JOIN public.children c2 ON c2.id = e2.child_id
                      WHERE c2.parent_id = c.parent_id
                        AND e2.school_id = e.school_id
                        AND e2.status = 'active'
                        AND e2.child_id <> e.child_id
                        AND (e2.created_at < e.created_at
                             OR (e2.created_at = e.created_at AND e2.child_id < e.child_id))
                    )
               THEN v_sibling_pct
               ELSE 0
             END AS pct
    ) sib
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
             ELSE ROUND(base.base_amount * (1 - sib.pct / 100.0))
        END AS amount,
        CASE WHEN NOT e.fee_is_manual AND sib.pct > 0
             THEN ROUND(base.base_amount * sib.pct / 100.0)
        END AS sibling_discount_applied
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
          -- 20261005214245: inscripción / seguro / excedente no son la
          -- mensualidad del período aunque traigan period_year/period_month.
          AND COALESCE(p2.payment_category, '') NOT IN ('inscripcion', 'seguro', 'excedente')
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
      period_year, period_month, payment_category, sibling_discount_applied
    )
    SELECT
      el.school_id, el.branch_id, el.parent_id, el.child_id, el.user_id,
      el.unregistered_athlete_id, el.team_id, el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount, v_due, 'pending', 'subscription',
      p_year::smallint, p_month::smallint, 'mensualidad', el.sibling_discount_applied
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
$function$;

COMMIT;
