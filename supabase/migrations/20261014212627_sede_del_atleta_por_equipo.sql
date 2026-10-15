-- =============================================================================
-- 20261014212627_sede_del_atleta_por_equipo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014212620
-- Objetivo: S2 (y el backfill de S3) de docs/specs/multisede-selector-y-sede-del-atleta.md.
--   Regla ÚNICA de sede del atleta: la del EQUIPO de la inscripción; si no
--   tiene, la de la ficha (children.branch_id / unregistered_athletes.branch_id).
--   Base: definiciones VIVAS al 2026-10-14; solo cambia la expresión de sede.
--
--   1. Vista school_athletes (security_invoker se mantiene):
--      · niño con cuenta: COALESCE(equipo, c.branch_id, sede única). Antes
--        ignoraba el equipo. El nombre de la sede sale del mismo id (JOIN).
--      · adulto con cuenta: sin cambios (ya era equipo → membresía → única).
--      · ficha: COALESCE(equipo, ua.branch_id, sede única). El nombre pasa de
--        subconsulta escalar a LEFT JOIN (una activación de RLS menos por fila).
--      Sin subconsultas correlacionadas nuevas: la sede del equipo viaja en el
--      LATERAL de equipo que ya existía (patrón del fix 57014).
--   2. open_month y preview_open_month: payments.branch_id y el filtro
--      p_branch_id usan COALESCE(t.branch_id, c.branch_id, ua.branch_id).
--      Antes era COALESCE(c.branch_id, t.branch_id) y nunca usaba ua.branch_id.
--   3. _confirm_overage_into_payment (cobros_f1): la misma regla.
--      NO se toca _plan_charge_operation (56 KB): ya incluye ua.branch_id pero
--      prioriza la ficha sobre el equipo (COALESCE(v_branch, team_branch)).
--      Queda pendiente para una migración propia.
--   4. Backfill acotado:
--      · school_categories de Monster's Volley Club con sede NULL (13, las de
--        Suba) → Sede Suba.
--      · payments con sede NULL cuyo team_id apunta a un equipo de la MISMA
--        escuela con sede: 79 filas en 7 escuelas al 2026-10-14. Las demás
--        (~2.900 sin equipo) no se deducen sin ambigüedad y no se tocan.
--        Los triggers de payments que corren en UPDATE solo reaccionan a
--        cambios de status/monto; este UPDATE solo cambia branch_id.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ── 1. Vista school_athletes ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.school_athletes
WITH (security_invoker = true) AS
 SELECT c.id,
    c.full_name,
    c.avatar_url,
    c.school_id,
    COALESCE(te.team_branch_id, c.branch_id, get_single_branch_id(c.school_id)) AS branch_id,
    c.team_id,
    c.date_of_birth,
    c.is_active,
    'child'::text AS athlete_type,
    c.parent_id,
    NULL::uuid AS user_id,
    c.medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE COALESCE(c.monthly_fee, 0::numeric)
            END
        END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE COALESCE(p.email, c.parent_email_temp)
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE COALESCE(p.phone, c.parent_phone_temp)
        END AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    c.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN school_branches b ON b.id = COALESCE(te.team_branch_id, c.branch_id)
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(c.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = c.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN coach_contact_masked_school(c.school_id) THEN NOT (COALESCE(c.team_id = ANY ((( SELECT user_coached_team_ids() AS user_coached_team_ids))::uuid[]), false) OR (EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.child_id = c.id AND e.status = 'active'::text AND (e.team_id = ANY ((( SELECT user_coached_team_ids() AS user_coached_team_ids))::uuid[])))))
                    ELSE false
                END AS hide_contact) hc ON true
UNION ALL
 SELECT pr.id,
    pr.full_name,
    pr.avatar_url,
    sm.school_id,
    COALESCE(te.team_branch_id, sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    te.team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE pr.email
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE pr.phone
        END AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = te.team_branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = sm.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(sm.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    sm.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(sm.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = sm.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN coach_contact_masked_school(sm.school_id) THEN NOT (EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND (e.team_id = ANY ((( SELECT user_coached_team_ids() AS user_coached_team_ids))::uuid[]))))
                    ELSE false
                END AS hide_contact) hc ON true
UNION ALL
 SELECT ua.id,
    ua.full_name,
    ua.avatar_url,
    ua.school_id,
    COALESCE(te.team_branch_id, ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE ua.email
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE ua.phone
        END AS parent_phone,
    COALESCE(bua.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    ua.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN school_branches bua ON bua.id = COALESCE(te.team_branch_id, ua.branch_id)
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(ua.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = ua.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN coach_contact_masked_school(ua.school_id) THEN NOT (EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND (e.team_id = ANY ((( SELECT user_coached_team_ids() AS user_coached_team_ids))::uuid[]))))
                    ELSE false
                END AS hide_contact) hc ON true
  WHERE ua.linked_profile_id IS NULL;

-- ── 2. open_month / preview_open_month ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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

  -- 20261014212627 (S2): sede = la del EQUIPO de la inscripción; si no hay,
  -- la de la ficha (children.branch_id / unregistered_athletes.branch_id).
  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(t.branch_id, c.branch_id, ua.branch_id)                             AS branch_id,
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
      -- F2 hermanos escalonado (20261013192955): % del escalón según el
      -- rango del niño en su familia ACTIVA (mismo parent_id o vínculo de
      -- school_sibling_links; ya no exige c.parent_id). Un niño con varias
      -- inscripciones cuenta una vez; fee_is_manual no recibe pero cuenta.
      SELECT CASE
               WHEN v_sibling_enabled AND e.child_id IS NOT NULL AND NOT e.fee_is_manual
               THEN public._sibling_tier_pct(e.school_id, public._sibling_rank(e.school_id, e.child_id))
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
      AND (p_branch_id IS NULL OR COALESCE(t.branch_id, c.branch_id, ua.branch_id) = p_branch_id)
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
          -- 20261005221734: inscripción / seguro / excedente no son la
          -- mensualidad del período aunque traigan period_year/period_month.
          -- 20261007095911: tampoco artículos, torneo, clase extra, vacacional
          -- ni viaje (cobros sueltos de servicio, ventas por WhatsApp).
          AND COALESCE(p2.payment_category, '') NOT IN (
                'inscripcion', 'seguro', 'excedente',
                'articulos', 'torneo', 'clase_extra', 'vacacional', 'viaje')
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

REVOKE ALL ON FUNCTION public.open_month(uuid, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_month(uuid, integer, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_month(uuid, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_month(uuid, integer, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.preview_open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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

  -- 20261014212627 (S2): mismo filtro de sede que open_month.
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
      -- F2 hermanos escalonado (20261013192955): % del escalón según el
      -- rango del niño en su familia ACTIVA (mismo parent_id o vínculo de
      -- school_sibling_links; ya no exige c.parent_id). Un niño con varias
      -- inscripciones cuenta una vez; fee_is_manual no recibe pero cuenta.
      SELECT CASE
               WHEN v_sibling_enabled AND e.child_id IS NOT NULL AND NOT e.fee_is_manual
               THEN public._sibling_tier_pct(e.school_id, public._sibling_rank(e.school_id, e.child_id))
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
      AND (p_branch_id IS NULL OR COALESCE(t.branch_id, c.branch_id, ua.branch_id) = p_branch_id)
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
          -- 20261005221734: inscripción / seguro / excedente no son la
          -- mensualidad del período aunque traigan period_year/period_month.
          -- F2 hermanos escalonado (20261013192955): misma lista que open_month
          -- (20261007095911) para que lo previsualizado sea lo que se emite.
          AND COALESCE(p2.payment_category, '') NOT IN (
                'inscripcion', 'seguro', 'excedente',
                'articulos', 'torneo', 'clase_extra', 'vacacional', 'viaje')
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

REVOKE ALL ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) TO service_role;

-- ── 3. _confirm_overage_into_payment (interna: solo service_role) ───────────
CREATE OR REPLACE FUNCTION public._confirm_overage_into_payment(p_id uuid, p_actor uuid, p_amount numeric DEFAULT NULL::numeric, p_due_date date DEFAULT NULL::date, p_batch_id uuid DEFAULT NULL::uuid, p_payment_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_row        public.hour_bank_overage_charges%ROWTYPE;
  v_period     record;
  v_enr        record;
  v_payment_id uuid;
  v_today      date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_months     text[] := ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
BEGIN
  SELECT * INTO v_row
    FROM public.hour_bank_overage_charges
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_row.status <> 'suggested' THEN
    RETURN jsonb_build_object('error', 'not_suggested', 'status', v_row.status,
                              'payment_id', v_row.payment_id);
  END IF;
  IF COALESCE(v_row.amount, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;
  IF p_amount IS NOT NULL AND p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;

  SELECT period_start INTO v_period
    FROM public.hour_bank_periods WHERE id = v_row.period_id;

  -- Mismo armado de pagador que open_month: parent_id = acudiente del menor;
  -- el adulto paga como user_id; el no registrado queda sin parent_id.
  SELECT e.child_id, e.user_id, e.unregistered_athlete_id, e.team_id,
         c.parent_id,
         -- 20261014212627 (S2): sede del equipo; si no, la de la ficha.
         COALESCE(t.branch_id, c.branch_id, ua.branch_id) AS branch_id
    INTO v_enr
    FROM public.enrollments e
    LEFT JOIN public.children c ON c.id = e.child_id
    LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams    t ON t.id = e.team_id
   WHERE e.id = v_row.enrollment_id;

  INSERT INTO public.payments (
    id,
    school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
    team_id, offering_plan_id, amount, concept, due_date, status, payment_type,
    payment_category, period_year, period_month, period_uniqueness_exempt,
    charge_batch_id, created_by, notes
  ) VALUES (
    COALESCE(p_payment_id, gen_random_uuid()),
    v_row.school_id,
    v_enr.branch_id,
    v_enr.parent_id,
    v_enr.child_id,
    v_enr.user_id,
    v_enr.unregistered_athlete_id,
    v_enr.team_id,
    NULL,                                   -- sin plan: no extiende vigencia (B3)
    COALESCE(p_amount, v_row.amount),
    format('Horas por encima del plan — %s %s — %s h × $%s',
           v_months[extract(month FROM v_period.period_start)::int],
           extract(year FROM v_period.period_start)::int,
           public.hour_bank_fmt_es(v_row.billable_hours),
           public.hour_bank_fmt_es(v_row.hourly_rate)),
    COALESCE(p_due_date, v_today + 5),      -- decisión usuario 2026-10-05
    'pending',
    'one_time',
    'excedente',                            -- requiere F-A (CHECK)
    extract(year  FROM v_period.period_start)::smallint,
    extract(month FROM v_period.period_start)::smallint,
    true,                                   -- convive con la mensualidad del mes
    p_batch_id,
    CASE WHEN p_batch_id IS NOT NULL THEN p_actor END,
    p_notes
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.hour_bank_overage_charges
     SET status     = 'confirmed',
         payment_id = v_payment_id,
         decided_by = p_actor,
         decided_at = now(),
         updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('payment_id', v_payment_id);
END;
$function$;

REVOKE ALL ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text) TO service_role;

-- ── 4. Backfill acotado ─────────────────────────────────────────────────────
-- 4a. Categorías de Suba (Monster's Volley Club) sin sede → Sede Suba.
UPDATE public.school_categories
   SET branch_id = '531a2df9-dab4-47bb-a1cf-5a904b276c46'
 WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
   AND branch_id IS NULL;

-- 4b. Cobros sin sede cuyo equipo (de la misma escuela) sí la tiene.
UPDATE public.payments p
   SET branch_id = t.branch_id
  FROM public.teams t
  JOIN public.school_branches sb ON sb.id = t.branch_id
 WHERE p.branch_id IS NULL
   AND p.team_id   = t.id
   AND t.school_id = p.school_id
   AND sb.school_id = p.school_id;

COMMIT;
