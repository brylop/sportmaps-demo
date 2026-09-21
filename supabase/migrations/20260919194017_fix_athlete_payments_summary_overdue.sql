-- =============================================================================
-- 20260919194017_fix_athlete_payments_summary_overdue.sql
-- Autor: brylop   Fecha: 2026-09-20   Versión anterior: 20260919193702
-- Objetivo: get_athlete_payments() (usada por AthletePaymentsPage vía la v2)
-- calculaba `count_pending`/`pending_cents` filtrando SOLO status='pending',
-- pero el frontend trata 'overdue' como "Pendiente" visualmente
-- (statusConfig[payment.status] || statusConfig.pending, AthletePaymentsPage.tsx:640).
-- Resultado confirmado en vivo con Daniel Ospina (en mora): la tarjeta de
-- resumen mostraba "Pendientes: 0 / $0" mientras la lista de abajo mostraba 3
-- cobros reales con badge "Pendiente" (los 3 con status='overdue' en la base).
-- Fix: sumar 'overdue' al mismo bucket que 'pending' en el resumen, sin tocar
-- la lista paginada ni el resto de la función.
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

CREATE OR REPLACE FUNCTION public.get_athlete_payments(p_limit integer DEFAULT 20, p_page integer DEFAULT 1, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  uid      uuid    := auth.uid();
  v_offset integer := (p_page - 1) * p_limit;
  v_data   jsonb;
BEGIN
  WITH all_payments AS (

    -- Pagos de athlete_payments (atletas adultos con bookings)
    SELECT
      ap.id,
      ap.amount_cents,
      (ap.amount_cents::numeric / 100)            AS amount,
      ap.currency,
      ap.status,
      ap.payment_method::text,
      ap.due_date,
      ap.paid_at                                  AS payment_date,
      ap.receipt_url,
      ap.created_at,
      ap.enrollment_id,
      ap.booking_id,
      b.booking_type,
      b.scheduled_at,
      b.status                                    AS booking_status,
      e.team_id                                   AS resolved_program_id,
      COALESCE(t.name, op.name)                   AS program_name,
      t.sport                                     AS program_sport,
      t.name                                      AS team_name,
      op.name                                     AS plan_name,
      NULL::text                                  AS child_name,
      NULL::uuid                                  AS child_id,
      NULL::text                                  AS concept,
      NULL::uuid                                  AS team_id,
      NULL::uuid                                  AS offering_plan_id,
      s.id                                        AS school_id,
      s.name                                      AS school_name,
      s.logo_url                                  AS school_logo,
      COALESCE(s.branding_settings->>'primary_color', '#0ea5e9') AS school_primary_color,
      NULL::text                                  AS enrollment_status,
      NULL::date                                  AS enrollment_start,
      -- ── pronto pago: athlete_payments no tiene la columna, ni ventana ──
      NULL::numeric                               AS early_payment_discount_applied,
      false                                       AS early_payment_discount_enabled,
      NULL::integer                               AS early_payment_discount_days,
      NULL::numeric                                AS early_payment_discount_percentage
    FROM athlete_payments ap
    LEFT JOIN bookings       b  ON b.id  = ap.booking_id
    LEFT JOIN enrollments    e  ON e.id  = ap.enrollment_id
    LEFT JOIN teams          t  ON t.id  = e.team_id
    LEFT JOIN offering_plans op ON op.id = e.offering_plan_id
    LEFT JOIN schools        s  ON s.id  = t.school_id
    WHERE ap.athlete_id = uid

    UNION ALL

    -- Pagos de tabla payments (padres + atletas + no_registrados)
    SELECT
      p.id,
      (p.amount * 100)::integer                   AS amount_cents,
      p.amount,
      'COP',
      CASE p.status::text
        WHEN 'paid'              THEN 'approved'
        WHEN 'awaiting_approval' THEN 'processing'
        ELSE p.status::text
      END,
      p.payment_method::text,
      p.due_date,
      p.payment_date,
      p.receipt_url,
      p.created_at,
      p.id,
      NULL::uuid,
      NULL::text,
      NULL::timestamptz,
      NULL::text,
      NULL::uuid,
      COALESCE(t.name, op.name)                   AS program_name,
      t.sport                                     AS program_sport,
      t.name                                      AS team_name,
      op.name                                     AS plan_name,
      c.full_name                                 AS child_name,
      p.child_id,
      p.concept,
      p.team_id,
      p.offering_plan_id,
      p.school_id,
      s.name                                      AS school_name,
      s.logo_url                                  AS school_logo,
      COALESCE(s.branding_settings->>'primary_color', '#0ea5e9') AS school_primary_color,
      NULL::text                                  AS enrollment_status,
      NULL::date                                  AS enrollment_start,
      -- ── pronto pago: monto congelado en el pago + config vigente de la escuela ──
      p.early_payment_discount_applied            AS early_payment_discount_applied,
      COALESCE(ss.early_payment_discount_enabled, false)    AS early_payment_discount_enabled,
      ss.early_payment_discount_days              AS early_payment_discount_days,
      ss.early_payment_discount_percentage        AS early_payment_discount_percentage
    FROM payments p
    LEFT JOIN teams          t  ON t.id  = p.team_id
    LEFT JOIN offering_plans op ON op.id = p.offering_plan_id
    LEFT JOIN schools        s  ON s.id  = p.school_id
    LEFT JOIN children       c  ON c.id  = p.child_id
    LEFT JOIN school_settings ss ON ss.school_id = p.school_id
    WHERE
      p.user_id   = uid
      OR p.parent_id = uid
      OR p.child_id IN (SELECT id FROM children WHERE parent_id = uid)
  ),

  filtered AS (
    SELECT * FROM all_payments
    WHERE p_status IS NULL OR status = p_status
  ),

  summary AS (
    SELECT
      COUNT(*)                                          AS count_total,
      -- 'overdue' se suma al mismo bucket que 'pending': el frontend ya los
      -- trata igual visualmente (statusConfig[status] || statusConfig.pending),
      -- así que el resumen debe contarlos igual o la tarjeta de KPIs miente.
      COUNT(*) FILTER (WHERE status IN ('pending', 'overdue'))        AS count_pending,
      COUNT(*) FILTER (WHERE status = 'approved')       AS count_approved,
      COUNT(*) FILTER (WHERE status = 'processing')     AS count_processing,
      COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('pending', 'overdue')),  0) AS pending_cents,
      COALESCE(SUM(amount_cents) FILTER (WHERE status = 'approved'), 0) AS approved_cents
    FROM filtered
  ),

  paged AS (
    SELECT * FROM filtered
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'overdue' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
      due_date ASC NULLS LAST,
      created_at DESC
    LIMIT p_limit OFFSET v_offset
  )

  SELECT jsonb_build_object(
    'data',  COALESCE(jsonb_agg(row_to_json(paged.*)), '[]'::jsonb),
    'total', (SELECT count_total FROM summary),
    'page',  p_page,
    'pages', CEIL((SELECT count_total FROM summary)::float / NULLIF(p_limit, 0)),
    'summary', jsonb_build_object(
      'count_total',      (SELECT count_total      FROM summary),
      'count_pending',    (SELECT count_pending     FROM summary),
      'count_approved',   (SELECT count_approved    FROM summary),
      'count_processing', (SELECT count_processing  FROM summary),
      'pending_cents',    (SELECT pending_cents     FROM summary),
      'approved_cents',   (SELECT approved_cents    FROM summary)
    )
  ) INTO v_data FROM paged;

  RETURN v_data;
END;
$function$;

COMMIT;
