-- =============================================================================
-- 20261003202419_finanzas_formula_unica_ingreso.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202416
-- Objetivo: Contabilidad v2 · F0 · M2. UNA sola fórmula de ingreso (D-ING) y
--   sus consumidores redirigidos:
--   · finance_income_amount / finance_income_excess (IMMUTABLE, la regla).
--   · finance_income_lines / finance_income_summary (RPC, una fila por cobro /
--     agregado por mes|concepto|método|sede, con bucket 'sin_fecha' — C8).
--   · cash_ledger: mismas 13 columnas; el ingreso solo para quien LEE finanzas
--     de la escuela (C4: coach/staff/reporter → 0 filas de ingreso).
--   · school_payment_kpis: gate finance_permission(read) con 42501; la sede
--     incluye los cobros SIN sede (A3); montos con la fórmula única.
--   · get_school_dashboard_stats (U3): cierra la fuga C12 (cualquier owner/admin
--     de cualquier escuela leía el total de otra pasando su p_user_id) y suma
--     con la fórmula única (sede con NULL).
-- Plan: docs/specs/contabilidad-v2-f0-plan-migraciones.md §2 M2.
-- D-FECHA: solo prospectivo (no se recalcula el pasado; U4). Fecha = payment_date.
-- Rollback: migración nueva con pg_get_viewdef/pg_get_functiondef previos.
--   Las funciones nuevas quedan inertes.
-- =============================================================================

BEGIN;

-- ─── regla de monto D-ING (un solo lugar) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_income_amount(p_status text, p_amount numeric, p_amount_paid numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT CASE p_status
    WHEN 'paid'    THEN LEAST(p_amount, COALESCE(p_amount_paid, p_amount))
    WHEN 'partial' THEN LEAST(p_amount, COALESCE(p_amount_paid, 0))
    ELSE 0::numeric
  END;
$function$;

-- Excedente sobre el cobro (en F1 va a 2805 anticipos; en F0 solo se informa).
CREATE OR REPLACE FUNCTION public.finance_income_excess(p_status text, p_amount numeric, p_amount_paid numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT CASE WHEN p_status IN ('paid','partial')
              THEN GREATEST(COALESCE(p_amount_paid, 0) - p_amount, 0)
              ELSE 0::numeric
         END;
$function$;

-- ─── líneas: una por cobro cobrado ───────────────────────────────────────────
-- F0: solo owner_type='school'; vendor/organizer devuelven vacío hasta F6.
-- service_role sin JWT puede leer (BFF). Un usuario sin permiso recibe 42501,
-- NUNCA ceros (memoria "RPC con gate interno = ceros").
CREATE OR REPLACE FUNCTION public.finance_income_lines(
    p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL, p_include_undated boolean DEFAULT false)
 RETURNS TABLE (payment_id uuid, school_id uuid, branch_id uuid, payment_date date,
                period_year integer, period_month integer, concept_key text, concept text,
                payment_method text, payment_provider text, status text,
                amount_charged numeric, amount_paid numeric, income_amount numeric,
                excess_amount numeric, electronic_invoice_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_owner_type IS DISTINCT FROM 'school' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.school_id, p.branch_id, p.payment_date,
           p.period_year::integer, p.period_month::integer,
           COALESCE(p.payment_category, 'sin_categoria'), p.concept,
           p.payment_method::text, p.payment_provider::text, p.status,
           p.amount, p.amount_paid,
           public.finance_income_amount(p.status, p.amount, p.amount_paid),
           public.finance_income_excess(p.status, p.amount, p.amount_paid),
           (SELECT ei.id FROM public.electronic_invoices ei
             WHERE ei.payment_id = p.id AND ei.document_type = 'invoice'
               AND ei.status = 'accepted' AND ei.voided_at IS NULL
             ORDER BY ei.created_at DESC
             LIMIT 1)
      FROM public.payments p
     WHERE p.school_id = p_owner_id
       AND p.status IN ('paid','partial')
       AND (p_branch_id IS NULL OR p.branch_id = p_branch_id OR p.branch_id IS NULL)   -- A3
       AND ((p.payment_date BETWEEN p_from AND p_to)
            OR (p_include_undated AND p.payment_date IS NULL));                         -- C8 visible
END;
$function$;

-- ─── resumen: p_group ∈ month | concept | method | branch ────────────────────
-- Las filas SIN payment_date van siempre al bucket 'sin_fecha' (no se adivina
-- la fecha, C8), cualquiera sea el agrupamiento.
CREATE OR REPLACE FUNCTION public.finance_income_summary(
    p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL, p_group text DEFAULT 'month')
 RETURNS TABLE (bucket text, income_amount numeric, tx_count integer, excess_amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF p_group IS NULL OR p_group NOT IN ('month','concept','method','branch') THEN
    RAISE EXCEPTION 'finance_income_summary: agrupamiento inválido %', p_group USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.b, SUM(g.inc)::numeric, COUNT(*)::integer, SUM(g.exc)::numeric
      FROM (
        SELECT CASE
                 WHEN l.payment_date IS NULL THEN 'sin_fecha'
                 WHEN p_group = 'month'   THEN to_char(l.payment_date, 'YYYY-MM')
                 WHEN p_group = 'concept' THEN l.concept_key
                 WHEN p_group = 'method'  THEN COALESCE(l.payment_method, 'sin_metodo')
                 ELSE COALESCE(l.branch_id::text, 'sin_sede')
               END AS b,
               l.income_amount AS inc,
               l.excess_amount AS exc
          FROM public.finance_income_lines(p_owner_type, p_owner_id, p_from, p_to, p_branch_id, true) l
      ) g
     GROUP BY g.b
     ORDER BY g.b;
END;
$function$;

-- ─── cash_ledger: mismas 13 columnas, misma vista invoker ────────────────────
CREATE OR REPLACE VIEW public.cash_ledger WITH (security_invoker = true) AS
 SELECT 'income'::text AS direction,
    p.id,
    'school'::text AS owner_type,
    p.school_id AS owner_id,
    p.school_id,
    p.branch_id,
    p.concept,
    NULL::uuid AS category_id,
    public.finance_income_amount(p.status, p.amount, p.amount_paid) AS amount,
    p.payment_date AS movement_date,
    'payment'::text AS source,
    p.status,
    p.payment_category
   FROM public.payments p
  WHERE p.status = ANY (ARRAY['paid'::text, 'partial'::text])
    -- C4: el ingreso solo lo ve quien LEE las finanzas de la escuela
    -- (owner/admin/school_admin/accountant). Coach/staff/reporter → 0 filas.
    AND p.school_id = ANY ((SELECT public.finance_read_school_ids())::uuid[])
UNION ALL
 SELECT 'expense'::text AS direction,
    e.id,
    e.owner_type,
    e.owner_id,
    e.school_id,
    e.branch_id,
    e.concept,
    e.category_id,
    e.amount,
    e.paid_date AS movement_date,
    'expense'::text AS source,
    e.status::text AS status,
    NULL::text AS payment_category
   FROM public.expenses e
  WHERE e.status = 'paid'::public.expense_status;   -- la RLS de expenses hace el resto

-- La vista no es actualizable (UNION): el grant de escritura sobra.
REVOKE ALL ON public.cash_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cash_ledger TO authenticated, service_role;

-- ─── KPIs de Gestión de Pagos: mismas claves de salida ───────────────────────
CREATE OR REPLACE FUNCTION public.school_payment_kpis(p_school_id uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_out    jsonb;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT public.finance_permission('school', p_school_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN: no autorizado para ver los KPIs de pagos de esta escuela.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'revenue_total',
      COALESCE(SUM(public.finance_income_amount(p.status, p.amount, p.amount_paid)), 0),
    'revenue_articulos',
      COALESCE(SUM(public.finance_income_amount(p.status, p.amount, p.amount_paid))
               FILTER (WHERE p.payment_category = 'articulos'), 0),
    -- Desglose (20260908152538): NO se resta de revenue_total.
    'revenue_torneo',
      COALESCE(SUM(public.finance_income_amount(p.status, p.amount, p.amount_paid))
               FILTER (WHERE p.payment_category = 'torneo'), 0),

    'tx_count',      count(*) FILTER (WHERE p.status IN ('paid', 'partial')),
    'charges_total', count(*),

    'awaiting_count',
      count(*) FILTER (WHERE p.status = 'awaiting_approval'
                          OR (p.status = 'pending' AND COALESCE(p.receipt_url, '') <> '')),
    'awaiting_amount',
      COALESCE(SUM(CASE WHEN p.status = 'awaiting_approval'
                          OR (p.status = 'pending' AND COALESCE(p.receipt_url, '') <> '')
                        THEN GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                        ELSE 0 END), 0),

    'debt_count',  count(*) FILTER (WHERE p.status IN ('pending', 'overdue', 'glosado')),
    'debt_amount',
      COALESCE(SUM(CASE WHEN p.status IN ('pending', 'overdue', 'glosado')
                        THEN GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                        ELSE 0 END), 0),

    'attempts', count(*) FILTER (WHERE p.status IN ('paid', 'partial', 'rejected', 'failed')),
    'approval_rate',
      CASE WHEN count(*) FILTER (WHERE p.status IN ('paid', 'partial', 'rejected', 'failed')) = 0
           THEN NULL
           ELSE round(
                  100.0 * count(*) FILTER (WHERE p.status IN ('paid', 'partial'))
                  / count(*) FILTER (WHERE p.status IN ('paid', 'partial', 'rejected', 'failed')),
                  1)
      END
  )
  INTO v_out
  FROM public.payments p
  WHERE p.school_id = p_school_id
    -- A3: un cobro SIN sede no es "de otra sede".
    AND (p_branch_id IS NULL OR p.branch_id = p_branch_id OR p.branch_id IS NULL);

  RETURN COALESCE(v_out, jsonb_build_object(
    'revenue_total', 0, 'revenue_articulos', 0, 'revenue_torneo', 0, 'tx_count', 0, 'charges_total', 0,
    'awaiting_count', 0, 'awaiting_amount', 0,
    'debt_count', 0, 'debt_amount', 0, 'attempts', 0, 'approval_rate', NULL
  ));
END;
$function$;

-- ─── get_school_dashboard_stats (U3): misma firma y claves; cierra C12 ───────
CREATE OR REPLACE FUNCTION public.get_school_dashboard_stats(p_user_id uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_school_id uuid;
  v_result    json;
  v_revenue   numeric := 0;
BEGIN
  -- C12: antes cualquier owner/admin de CUALQUIER escuela (o un profiles.role
  -- autoasignado) podía pasar el p_user_id de otro y leer su total. Ahora solo
  -- el propio usuario o un admin de plataforma.
  IF auth.uid() IS NULL
     OR NOT (auth.uid() = p_user_id OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT s.id INTO v_school_id
    FROM public.schools s
   WHERE s.owner_id = p_user_id
   ORDER BY s.created_at
   LIMIT 1;
  IF v_school_id IS NULL THEN
    SELECT sm.school_id INTO v_school_id
      FROM public.school_members sm
     WHERE sm.profile_id = p_user_id
       AND sm.role IN ('owner','admin')
       AND sm.status = 'active'
     LIMIT 1;
  END IF;
  IF v_school_id IS NULL THEN
    RETURN json_build_object('programs',0,'active_programs',0,'active_teams',0,
                             'total_students',0,'pending_payments',0,'total_revenue',0);
  END IF;

  -- Ingreso: fórmula única, solo con permiso de lectura financiera (el
  -- dueño/admin de esa escuela o un admin de plataforma). Sede con NULL (A3).
  IF public.finance_permission('school', v_school_id, 'read') THEN
    SELECT COALESCE(SUM(public.finance_income_amount(p.status, p.amount, p.amount_paid)), 0)
      INTO v_revenue
      FROM public.payments p
     WHERE p.school_id = v_school_id
       AND p.status IN ('paid','partial')
       AND (p_branch_id IS NULL OR p.branch_id = p_branch_id OR p.branch_id IS NULL);
  END IF;

  SELECT json_build_object(
    'programs',         (SELECT COUNT(*) FROM public.teams WHERE school_id = v_school_id AND (p_branch_id IS NULL OR branch_id = p_branch_id)),
    'active_programs',  (SELECT COUNT(*) FROM public.teams WHERE school_id = v_school_id AND status = 'active' AND (p_branch_id IS NULL OR branch_id = p_branch_id)),
    'active_teams',     (SELECT COUNT(*) FROM public.teams WHERE school_id = v_school_id AND status = 'active' AND (p_branch_id IS NULL OR branch_id = p_branch_id)),
    'total_students',   (SELECT COUNT(*) FROM public.enrollments e JOIN public.teams t ON e.team_id = t.id WHERE t.school_id = v_school_id AND e.status = 'active' AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)),
    'pending_payments', (SELECT COUNT(*) FROM public.payments p WHERE p.school_id = v_school_id AND p.status = 'pending' AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)),
    'total_revenue',    v_revenue
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

-- ─── GRANT / REVOKE ──────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.finance_income_amount(text, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_income_excess(text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_income_amount(text, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_income_excess(text, numeric, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.finance_income_lines(text, uuid, date, date, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_income_summary(text, uuid, date, date, uuid, text)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_income_lines(text, uuid, date, date, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_income_summary(text, uuid, date, date, uuid, text)  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.school_payment_kpis(uuid, uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_school_dashboard_stats(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_payment_kpis(uuid, uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_school_dashboard_stats(uuid, uuid) TO authenticated, service_role;

COMMIT;
