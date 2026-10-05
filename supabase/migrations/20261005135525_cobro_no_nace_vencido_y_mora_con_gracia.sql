-- =============================================================================
-- 20261005135525_cobro_no_nace_vencido_y_mora_con_gracia.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005135518
-- Objetivo: que el primer cobro de un mes no nazca vencido el día en que se
--   genera, y que el motor de mora no le cobre recargo ese mismo día.
--   Hallazgo H-01 de docs/qa/monster-prelanzamiento-2026-10-05.md.
-- =============================================================================
--
-- Lo que pasaba (Monster: corte día 1, gracia 5, mora 5 %): el cron
-- generate_monthly_charges abre el mes EN CURSO todos los días a las 01:30 COT.
-- Mientras ninguna inscripción tiene precio no emite nada; el día que la escuela
-- pone precio (p. ej. el 8), esa noche open_month emite el mes con vencimiento
-- el día 1 —ya pasado— y a las 02:00 apply_late_fees lo marca overdue y le suma
-- el 5 %. Ya ocurrió en la viva (cobros 6a78fc04…, b242a3dd…, 9b69a4d0…: creados
-- 01:30, recargo 02:00 del mismo día). Simulado para Monster: 125 cobros,
-- $18.125.000 y $906.250 de recargo antes de que ninguna familia se enterara.
--
-- Decisión (documentada aquí y en el informe):
--   · Se RESPETA el día de corte configurable de la escuela
--     (school_settings.payment_cutoff_day; default 10 si no hay fila/valor).
--   · Si el vencimiento del corte YA PASÓ cuando se emite el cobro, el
--     vencimiento pasa a HOY + payment_grace_days (default 5 si es NULL). Es la
--     misma regla que ya usan billingDue (alta/cambio de plan en el BFF) y
--     qr_first_charge_due_date (QR): una sola regla para las tres vías.
--   · El PERIODO (period_year/period_month) no se toca: si la familia cursó el
--     mes, la deuda es de ese mes; solo se corre la FECHA DE PAGO.
--   · preview_open_month calcula el mismo vencimiento (lo que se ve es lo que se
--     emite).
--   · apply_late_fees: además de due_date + gracia < hoy, exige
--     fecha_de_creación + gracia < hoy. Cubre los 13 caminos que crean cobros
--     (no solo open_month): ninguno queda en mora ni con recargo el día en que
--     nace. No cambia nada para los cobros que se emiten a tiempo (nacen antes
--     del corte, así que la condición nueva ya se cumple cuando vence la gracia).
--
-- Pruebas: supabase/tests/monster_cobros/M04_cobro_no_nace_vencido.sql.
-- =============================================================================

BEGIN;

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
  v_grace            int;
  v_today            date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(payment_grace_days, 5),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_grace, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_grace  := COALESCE(v_grace, 5);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );
  -- FIX 2026-10-05 (H-01): un cobro NUEVO nunca nace vencido. Si el corte del
  -- mes ya pasó (el cron abre el mes en curso todos los días, y una escuela que
  -- pone precio el 8 con corte el 1 recibía cobros vencidos esa misma noche), el
  -- vencimiento pasa a hoy + días de gracia: la MISMA regla que billingDue
  -- (bff/src/services/enrollmentBilling.ts) y qr_first_charge_due_date. El
  -- PERIODO no cambia: sigue siendo p_year/p_month.
  IF v_due < v_today THEN
    v_due := v_today + v_grace;
  END IF;

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

CREATE OR REPLACE FUNCTION public.preview_open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_items            jsonb;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
  v_grace            int;
  v_today            date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(payment_grace_days, 5),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_grace, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_grace  := COALESCE(v_grace, 5);
  v_due := make_date(p_year, p_month, LEAST(v_cutoff, extract(day from (v_month_end - 1))::int));
  -- Mismo piso que open_month (FIX 2026-10-05, H-01): lo que se previsualiza es
  -- lo que se emite.
  IF v_due < v_today THEN
    v_due := v_today + v_grace;
  END IF;

  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS athlete_name,
      CASE WHEN e.child_id IS NOT NULL THEN 'menor'
           WHEN e.user_id  IS NOT NULL THEN 'adulto'
           ELSE 'no_registrado' END                                AS tipo,
      fee.amount                                                   AS amount,
      fee.sibling_discount_applied                                 AS sibling_discount_applied
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
           'sibling_discount_applied', el.sibling_discount_applied,
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
$function$;

CREATE OR REPLACE FUNCTION public.apply_late_fees()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_today        date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_overdue      integer := 0;
    v_fees_applied integer := 0;
    v_total_fees   numeric := 0;
BEGIN
    WITH candidates AS (
        SELECT
            p.id,
            p.status,
            p.amount,
            p.late_fee_applied_at,
            -- Recargo a aplicar (0 si la escuela no tiene mora o ya se aplicó)
            CASE
                WHEN ss.late_fee_enabled IS TRUE
                     AND p.late_fee_applied_at IS NULL
                THEN round(
                        COALESCE(ss.late_fee_percentage, 0)::numeric / 100
                        * GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                     )
                ELSE 0
            END AS fee
        FROM public.payments p
        JOIN public.school_settings ss ON ss.school_id = p.school_id
        WHERE p.status IN ('pending', 'partial')
          -- Ya pasó el período de gracia posterior al vencimiento
          AND (p.due_date + COALESCE(ss.payment_grace_days, 0)) < v_today
          -- Un cobro de un mes que todavía no empieza no está en mora, sin
          -- importar qué diga su due_date (cobros del QR generados por
          -- adelantado, ver migración 20260804125644).
          AND (p.period_year IS NULL
               OR p.period_month IS NULL
               OR make_date(p.period_year::int, p.period_month::int, 1)
                  <= date_trunc('month', v_today)::date)
          -- FIX 2026-10-05 (H-01): la gracia también corre desde que el cobro
          -- EXISTE. Un cobro que nace hoy con un vencimiento ya pasado (alta
          -- tardía, registro por otra vía, mes abierto a destiempo) no se marca
          -- overdue ni recibe recargo el mismo día: la familia tiene los mismos
          -- días de gracia que cualquier otra para enterarse y pagar.
          AND ((COALESCE(p.created_at, now()) AT TIME ZONE 'America/Bogota')::date
               + COALESCE(ss.payment_grace_days, 0)) < v_today
          -- Sólo filas que realmente cambian: marcar 'pending'->'overdue',
          -- o aplicar recargo pendiente cuando la mora está habilitada.
          AND (
                p.status = 'pending'
                OR (ss.late_fee_enabled IS TRUE AND p.late_fee_applied_at IS NULL)
              )
    ), updated AS (
        UPDATE public.payments p
        SET
            late_fee_amount     = p.late_fee_amount + c.fee,
            amount              = p.amount + c.fee,
            late_fee_applied_at = CASE WHEN c.fee > 0 THEN now()
                                       ELSE p.late_fee_applied_at END,
            -- 'partial' conserva su estado (aún es un abono con saldo);
            -- 'pending' pasa a 'overdue'. Literal sin cast: unifica con
            -- p.status sea TEXT o enum pay_status.
            status              = CASE WHEN p.status = 'pending' THEN 'overdue'
                                       ELSE p.status END,
            updated_at          = now()
        FROM candidates c
        WHERE p.id = c.id
        RETURNING (c.status = 'pending') AS became_overdue, c.fee
    )
    SELECT
        COUNT(*) FILTER (WHERE became_overdue),
        COUNT(*) FILTER (WHERE fee > 0),
        COALESCE(SUM(fee), 0)
    INTO v_overdue, v_fees_applied, v_total_fees
    FROM updated;

    RETURN jsonb_build_object(
        'run_date',       v_today,
        'overdue_marked', v_overdue,
        'fees_applied',   v_fees_applied,
        'total_fees',     v_total_fees
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.open_month(uuid, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_month(uuid, integer, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_month(uuid, integer, integer, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apply_late_fees() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_late_fees() FROM anon;
REVOKE ALL ON FUNCTION public.apply_late_fees() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_fees() TO service_role;

COMMIT;
