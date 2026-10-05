-- =====================================================================
-- PASO 2 — Contabilidad v2 (correr DESPUÉS del paso 1)
-- Generado 2026-10-04. Pegar COMPLETO en el SQL Editor de Supabase y Run.
-- Cada migración trae su propio BEGIN/COMMIT: si una falla, las anteriores
-- quedan aplicadas y registradas; corregir y seguir desde la que falló.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 20261003202416_finanzas_permiso_y_rol_contador.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003202416_finanzas_permiso_y_rol_contador.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202413
-- Objetivo: Contabilidad v2 · F0 · M1. Matriz de permisos financieros (§3.8 del
--   spec) en UNA función, rol 'accountant' (contador, solo lectura + cierre) y
--   lectura contable para ese rol.
-- Plan: docs/specs/contabilidad-v2-f0-plan-migraciones.md §2 M1 (N1, N2, N4;
--   decisiones U1 = B, U2 = sí a nómina, U7 = sí, U10 = gate de addon solo en
--   finance_permission).
--
-- Qué hace:
--   1. CHECK de school_members.role acepta 'accountant'.
--   2. N1: el contador NO es staff. staff_school_ids() y user_staff_school_ids()
--      lo excluyen EN LA MISMA TRANSACCIÓN en que el valor entra al CHECK (si
--      no, un contador podría insertar cobros, escribir en 36 policies de 18
--      tablas y pasar el guard de pagos de la Fase 1).
--   3. school_has_addon(), _finance_actor_role(), finance_permission(),
--      finance_read_school_ids() (nuevas).
--   4. can_manage_finances() pasa a ser envoltorio de _finance_actor_role() con
--      la MISMA semántica de hoy (sin gate de addon: N4, Dynasty factura sin el
--      addon accounting) + reconoce a super admin y al owner por
--      schools.owner_id (U7, igual que el BFF invoicing.routes.ts). Devuelve
--      SIEMPRE boolean (nunca NULL): run_payroll/post_payroll_run/pay_supplier_bill
--      hacen `IF NOT can_manage_finances(...)` y con NULL el IF no entraría.
--   5. Policies PERMISIVAS de SELECT para lectura financiera (se suman con OR a
--      las existentes). En M4 (…202424) se quitan las FOR ALL y estas quedan
--      como la única lectura.
-- No toca: los 10 procs que usan NOT IN ('parent','athlete') (radio 0 hoy, se
--   revisan en el PR), las policies existentes (conservan su semántica).
-- Rollback: migración nueva que restaure el CHECK previo (falla si ya hay filas
--   'accountant'), los cuerpos previos de can_manage_finances/staff_school_ids/
--   user_staff_school_ids y DROP POLICY de las *_finance_read.
-- =============================================================================

BEGIN;

-- ─── 1) rol ──────────────────────────────────────────────────────────────────
ALTER TABLE public.school_members DROP CONSTRAINT IF EXISTS school_members_role_check;
ALTER TABLE public.school_members ADD CONSTRAINT school_members_role_check CHECK (role IN
  ('owner','admin','school_admin','coach','staff','parent','athlete','viewer','reporter','super_admin','accountant'));

-- ─── 2) N1: el contador NO es staff (cuerpos idénticos salvo la lista) ──────
CREATE OR REPLACE FUNCTION public.staff_school_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT COALESCE(ARRAY_AGG(school_id), ARRAY[]::uuid[])
  FROM public.school_members
  WHERE profile_id = auth.uid()
    AND status = 'active'
    AND role::text NOT IN ('parent', 'athlete', 'accountant');
$function$;

CREATE OR REPLACE FUNCTION public.user_staff_school_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT COALESCE(ARRAY(
    SELECT sm.school_id
      FROM public.school_members sm
     WHERE sm.profile_id = auth.uid()
       AND sm.status = 'active'
       AND sm.role NOT IN ('parent', 'athlete', 'accountant')
    UNION
    SELECT ss.school_id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.status = 'active'
    UNION
    SELECT ss.school_id
      FROM public.school_staff ss
      JOIN auth.users au ON LOWER(au.email) = LOWER(ss.email)
     WHERE au.id = auth.uid()
       AND ss.coach_auth_id IS NULL
       AND ss.status = 'active'
    UNION
    SELECT s.id
      FROM public.schools s
     WHERE s.owner_id = auth.uid()
  ), '{}'::uuid[]);
$function$;
-- Grants de las dos funciones de staff: SIN CAMBIO (CLAUDE.md: nunca revocar
-- helpers de RLS al rol que los invoca desde policies).

-- ─── 3) addon ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.school_has_addon(p_school_id uuid, p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.school_addons
     WHERE school_id = p_school_id AND addon_key = p_key AND enabled
  );
$function$;

-- ─── 4) núcleo: qué es el usuario respecto de un dueño ───────────────────────
-- 'admin' | 'accountant' | NULL. Solo la llaman funciones DEFINER (sin grant).
CREATE OR REPLACE FUNCTION public._finance_actor_role(p_owner_type text, p_owner_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_owner_id IS NULL THEN NULL
    WHEN public.is_super_admin() THEN 'admin'
    WHEN p_owner_type = 'school' THEN (
      SELECT CASE WHEN bool_or(x.r IN ('owner','admin','school_admin','super_admin')) THEN 'admin'
                  WHEN bool_or(x.r = 'accountant') THEN 'accountant' END
        FROM (SELECT sm.role AS r
                FROM public.school_members sm
               WHERE sm.school_id = p_owner_id
                 AND sm.profile_id = auth.uid()
                 AND sm.status = 'active'
              UNION ALL
              SELECT 'owner'
                FROM public.schools s
               WHERE s.id = p_owner_id AND s.owner_id = auth.uid()) x)
    WHEN p_owner_type = 'vendor' AND EXISTS (
           SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.id = p_owner_id AND vp.user_id = auth.uid()) THEN 'admin'
    WHEN p_owner_type = 'organizer' AND p_owner_id = auth.uid() THEN 'admin'
  END;
$function$;

-- ─── 5) matriz §3.8 (+ gate de addon solo para escritura, solo escuelas) ────
CREATE OR REPLACE FUNCTION public.finance_permission(p_owner_type text, p_owner_id uuid, p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_role text;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('read','write','pay','void','close','reopen','configure','export') THEN
    RAISE EXCEPTION 'finance_permission: acción inválida %', p_action USING ERRCODE = '22023';
  END IF;
  v_role := public._finance_actor_role(p_owner_type, p_owner_id);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  -- U10: el addon 'accounting' se exige en la base solo para lo que escribe en
  -- el libro. La lectura de ingresos sigue sin addon (Gestión de Pagos la usa).
  IF p_owner_type = 'school'
     AND p_action IN ('write','pay','void','close','reopen','configure')
     AND NOT public.is_super_admin()
     AND NOT public.school_has_addon(p_owner_id, 'accounting') THEN
    RETURN false;
  END IF;
  RETURN v_role = 'admin'
      OR (v_role = 'accountant' AND p_action IN ('read','export','close'));
END;
$function$;

-- ─── 6) escuelas cuyas finanzas puede LEER el usuario ────────────────────────
-- Para policies y vistas: evaluarla una sola vez con `(SELECT …)` (InitPlan).
CREATE OR REPLACE FUNCTION public.finance_read_school_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT COALESCE(ARRAY(
    SELECT sm.school_id
      FROM public.school_members sm
     WHERE sm.profile_id = auth.uid()
       AND sm.status = 'active'
       AND sm.role IN ('owner','admin','school_admin','super_admin','accountant')
    UNION
    SELECT s.id
      FROM public.schools s
     WHERE s.owner_id = auth.uid()
  ), '{}'::uuid[]);
$function$;

-- ─── 7) envoltorio: misma semántica de hoy + U7 ──────────────────────────────
CREATE OR REPLACE FUNCTION public.can_manage_finances(p_owner_type text, p_owner_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT COALESCE(public._finance_actor_role(p_owner_type, p_owner_id) = 'admin', false);
$function$;

-- ─── GRANT / REVOKE de funciones (trampa 3: revocar explícito a anon y authenticated) ─
REVOKE ALL ON FUNCTION public._finance_actor_role(text, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.finance_permission(text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_read_school_ids()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_has_addon(uuid, text)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_permission(text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_read_school_ids()            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.school_has_addon(uuid, text)          TO authenticated, service_role;

-- can_manage_finances: hoy la tienen PUBLIC y anon. Se queda authenticated
-- (la exigen las policies) y service_role.
REVOKE EXECUTE ON FUNCTION public.can_manage_finances(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_finances(text, uuid) TO authenticated, service_role;

-- ─── 8) lectura financiera: policies PERMISIVAS de SELECT ───────────────────
DROP POLICY IF EXISTS expenses_finance_read ON public.expenses;
CREATE POLICY expenses_finance_read ON public.expenses
  FOR SELECT TO authenticated
  USING (public.finance_permission(owner_type, owner_id, 'read'));

DROP POLICY IF EXISTS suppliers_finance_read ON public.suppliers;
CREATE POLICY suppliers_finance_read ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.finance_permission(owner_type, owner_id, 'read'));

DROP POLICY IF EXISTS supplier_bills_finance_read ON public.supplier_bills;
CREATE POLICY supplier_bills_finance_read ON public.supplier_bills
  FOR SELECT TO authenticated
  USING (public.finance_permission(owner_type, owner_id, 'read'));

DROP POLICY IF EXISTS payroll_runs_finance_read ON public.payroll_runs;
CREATE POLICY payroll_runs_finance_read ON public.payroll_runs
  FOR SELECT TO authenticated
  USING (public.finance_permission(owner_type, owner_id, 'read'));

-- U2: el contador ve salarios (D-ROL: "lectura total").
DROP POLICY IF EXISTS payroll_employees_finance_read ON public.payroll_employees;
CREATE POLICY payroll_employees_finance_read ON public.payroll_employees
  FOR SELECT TO authenticated
  USING (public.finance_permission(owner_type, owner_id, 'read'));

DROP POLICY IF EXISTS payroll_items_finance_read ON public.payroll_items;
CREATE POLICY payroll_items_finance_read ON public.payroll_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payroll_runs r
                  WHERE r.id = payroll_items.run_id
                    AND public.finance_permission(r.owner_type, r.owner_id, 'read')));

DROP POLICY IF EXISTS budgets_finance_read ON public.budgets;
CREATE POLICY budgets_finance_read ON public.budgets
  FOR SELECT TO authenticated
  USING (public.finance_permission(owner_type, owner_id, 'read'));

DROP POLICY IF EXISTS expense_categories_finance_read ON public.expense_categories;
CREATE POLICY expense_categories_finance_read ON public.expense_categories
  FOR SELECT TO authenticated
  USING (owner_id IS NULL OR public.finance_permission(owner_type, owner_id, 'read'));

DROP POLICY IF EXISTS expense_attachments_finance_read ON public.expense_attachments;
CREATE POLICY expense_attachments_finance_read ON public.expense_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e
                  WHERE e.id = expense_attachments.expense_id
                    AND public.finance_permission(e.owner_type, e.owner_id, 'read')));

DROP POLICY IF EXISTS einvoices_finance_read ON public.electronic_invoices;
CREATE POLICY einvoices_finance_read ON public.electronic_invoices
  FOR SELECT TO authenticated
  USING (public.finance_permission(owner_type, owner_id, 'read'));

DROP POLICY IF EXISTS einvoice_items_finance_read ON public.electronic_invoice_items;
CREATE POLICY einvoice_items_finance_read ON public.electronic_invoice_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.electronic_invoices i
                  WHERE i.id = electronic_invoice_items.invoice_id
                    AND public.finance_permission(i.owner_type, i.owner_id, 'read')));

-- Comprobantes de gasto (bucket privado accounting-receipts): lectura.
DROP POLICY IF EXISTS accounting_receipts_finance_read ON storage.objects;
CREATE POLICY accounting_receipts_finance_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'accounting-receipts'
         AND EXISTS (SELECT 1 FROM public.expenses e
                      WHERE e.id::text = (storage.foldername(objects.name))[1]
                        AND public.finance_permission(e.owner_type, e.owner_id, 'read')));

-- Cobros: el contador los lee (ya no entra por `Payments: select staff`).
DROP POLICY IF EXISTS "Payments: select finance reader" ON public.payments;
CREATE POLICY "Payments: select finance reader" ON public.payments
  FOR SELECT TO authenticated
  USING (school_id = ANY ((SELECT public.finance_read_school_ids())::uuid[]));

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003202416', '20261003202416_finanzas_permiso_y_rol_contador', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261003202419_finanzas_formula_unica_ingreso.sql
-- ─────────────────────────────────────────────────────────────────────
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

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003202419', '20261003202419_finanzas_formula_unica_ingreso', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261003202421_finanzas_libro_paginado.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003202421_finanzas_libro_paginado.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202419
-- Objetivo: Contabilidad v2 · F0 · M3. Libro de caja paginado en el servidor
--   (blindaje 2.7 / H7: hoy la pantalla lee cash_ledger entero y PostgREST lo
--   corta en 1.000 filas, y los totales se suman en el cliente sobre lo que
--   llegó). Tres RPC nuevas sobre cash_ledger (SECURITY INVOKER: heredan la RLS
--   y el filtro de ingreso de M2) con gate explícito para devolver 42501 y no
--   una lista vacía:
--   · finance_ledger_page   — keyset por (movement_date DESC NULLS LAST, id DESC).
--   · finance_ledger_totals — totales del rango (nunca la suma de la página),
--                             con los movimientos SIN fecha aparte.
--   · finance_pnl_monthly   — estado de resultados del año agregado en el servidor.
-- Plan: docs/specs/contabilidad-v2-f0-plan-migraciones.md §2 M3.
-- Rollback: DROP FUNCTION ×3 (sin dependientes en la base).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.finance_ledger_page(
    p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL, p_direction text DEFAULT NULL,
    p_cursor_date date DEFAULT NULL, p_cursor_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 50, p_include_undated boolean DEFAULT false)
 RETURNS SETOF public.cash_ledger
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_direction IS NOT NULL AND p_direction NOT IN ('income','expense') THEN
    RAISE EXCEPTION 'finance_ledger_page: dirección inválida %', p_direction USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT l.*
      FROM public.cash_ledger l
     WHERE l.owner_type = p_owner_type
       AND l.owner_id = p_owner_id
       AND (p_branch_id IS NULL OR l.branch_id = p_branch_id OR l.branch_id IS NULL)
       AND (p_direction IS NULL OR l.direction = p_direction)
       AND ((l.movement_date BETWEEN p_from AND p_to)
            OR (p_include_undated AND l.movement_date IS NULL))
       -- keyset: el orden es (fecha DESC NULLS LAST, id DESC). Los sin fecha van
       -- al final; un cursor sin fecha significa "ya estamos en la cola sin fecha".
       AND (p_cursor_id IS NULL
            OR (p_cursor_date IS NOT NULL
                AND (l.movement_date IS NULL
                     OR (l.movement_date, l.id) < (p_cursor_date, p_cursor_id)))
            OR (p_cursor_date IS NULL
                AND l.movement_date IS NULL AND l.id < p_cursor_id))
     ORDER BY l.movement_date DESC NULLS LAST, l.id DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_ledger_totals(
    p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL)
 RETURNS TABLE (direction text, total numeric, n integer, undated_total numeric, undated_n integer)
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT d.dir,
           COALESCE(SUM(l.amount) FILTER (WHERE l.movement_date IS NOT NULL), 0)::numeric,
           (COUNT(l.id) FILTER (WHERE l.movement_date IS NOT NULL))::integer,
           COALESCE(SUM(l.amount) FILTER (WHERE l.movement_date IS NULL), 0)::numeric,
           (COUNT(l.id) FILTER (WHERE l.movement_date IS NULL))::integer
      FROM (VALUES ('income'::text), ('expense'::text)) AS d(dir)
      LEFT JOIN public.cash_ledger l
        ON l.direction = d.dir
       AND l.owner_type = p_owner_type
       AND l.owner_id = p_owner_id
       AND (p_branch_id IS NULL OR l.branch_id = p_branch_id OR l.branch_id IS NULL)
       AND ((l.movement_date BETWEEN p_from AND p_to) OR l.movement_date IS NULL)
     GROUP BY d.dir
     ORDER BY d.dir DESC;   -- income, expense
END;
$function$;

-- Estado de resultados del año: una fila por (mes, dirección, categoría).
-- month NULL = movimientos sin fecha (C8): cuentan en el total del año, no en
-- ningún mes. Ingresos: category_id NULL y concept_key = payment_category.
CREATE OR REPLACE FUNCTION public.finance_pnl_monthly(
    p_owner_type text, p_owner_id uuid, p_year integer, p_branch_id uuid DEFAULT NULL)
 RETURNS TABLE (month integer, direction text, category_id uuid, concept_key text, total numeric, n integer)
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'finance_pnl_monthly: año inválido %', p_year USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT EXTRACT(MONTH FROM l.movement_date)::integer,
           l.direction,
           l.category_id,
           CASE WHEN l.direction = 'income' THEN COALESCE(l.payment_category, 'sin_categoria') END,
           SUM(l.amount)::numeric,
           COUNT(*)::integer
      FROM public.cash_ledger l
     WHERE l.owner_type = p_owner_type
       AND l.owner_id = p_owner_id
       AND (p_branch_id IS NULL OR l.branch_id = p_branch_id OR l.branch_id IS NULL)
       AND (l.movement_date BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
            OR l.movement_date IS NULL)
     GROUP BY 1, 2, 3, 4
     ORDER BY 1 NULLS LAST, 2, 3, 4;
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_ledger_page(text, uuid, date, date, uuid, text, date, uuid, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_ledger_totals(text, uuid, date, date, uuid)                                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_pnl_monthly(text, uuid, integer, uuid)                                      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_ledger_page(text, uuid, date, date, uuid, text, date, uuid, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_ledger_totals(text, uuid, date, date, uuid)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_pnl_monthly(text, uuid, integer, uuid)                                      TO authenticated;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003202421', '20261003202421_finanzas_libro_paginado', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261003202424_egresos_sin_borrado_y_auditoria.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003202424_egresos_sin_borrado_y_auditoria.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202421
-- Objetivo: Contabilidad v2 · F0 · M4. Parte barata de "egresos inmutables":
--   1. Trampa 3 / C11: anon sin ningún privilegio sobre las tablas contables,
--      payroll_config ni audit_logs; authenticated sin escritura en audit_logs.
--   2. Sin borrado ni edición directa del dinero: expenses y supplier_bills
--      solo INSERT desde el cliente; payroll_runs/payroll_items solo por RPC
--      (C5 / H13: hoy cualquiera con can_manage_finances devolvía un run
--      'paid' a 'draft' con un UPDATE).
--   3. Las FOR ALL se parten (trampa 1): la lectura queda en las *_finance_read
--      de M1 y la escritura en policies INSERT/UPDATE con WITH CHECK explícito.
--   4. CHECK supplier_bills.amount_paid <= amount (0 violaciones hoy).
--   5. pay_supplier_bill, post_payroll_run y run_payroll → SECURITY DEFINER
--      (si no, al quitar UPDATE a authenticated se romperían: escribían a
--      través de las policies). Cuerpos copiados de la versión vigente:
--      pay_supplier_bill = la viva; run_payroll y post_payroll_run =
--      20261003201142 (NO la 20261002130001, que está rota), conservando
--      `p_paid_date date DEFAULT NULL`. Única adición: como DEFINER saltan el
--      trial_block RESTRICTIVE de expenses, así que pay_supplier_bill y
--      post_payroll_run comprueban school_is_operational() a mano (paridad).
--   6. Auditoría con old y new: audit_finance_row() (audit_trigger_func nunca
--      guarda old_data y en un DELETE pierde la fila).
--   7. U8: se borra la policy accounting_receipts_delete (comprobantes de gasto
--      borrables).
-- Plan: docs/specs/contabilidad-v2-f0-plan-migraciones.md §2 M4.
-- Requiere: 20261003201142 aplicada (verificar que post_payroll_run vivo
--   contenga `r.total_gross + r.total_employer`).
-- Rollback: migración nueva que restaure las policies FOR ALL (texto en el
--   plan §1.5), los grants a authenticated (NUNCA volver a dar nada a anon) y
--   los cuerpos INVOKER de las 3 RPC. Triggers y CHECK se pueden dejar.
-- =============================================================================

BEGIN;

-- ─── 1) trampa 3 / C11 ───────────────────────────────────────────────────────
REVOKE ALL ON public.expenses, public.supplier_bills, public.suppliers, public.payroll_runs,
              public.payroll_items, public.payroll_employees, public.budgets,
              public.expense_attachments, public.expense_categories, public.payroll_config
  FROM anon, PUBLIC;
REVOKE ALL ON public.audit_logs FROM anon, PUBLIC;
-- Solo escriben triggers DEFINER y el BFF (service_role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated;

-- ─── 2) sin borrado ni edición directa del dinero ───────────────────────────
REVOKE UPDATE, DELETE, TRUNCATE ON public.expenses       FROM authenticated;  -- el front solo inserta (AccountingPage.tsx:206)
REVOKE UPDATE, DELETE, TRUNCATE ON public.supplier_bills FROM authenticated;  -- el front solo inserta (AccountingSuppliersPage.tsx:359)
REVOKE DELETE, TRUNCATE ON public.suppliers, public.payroll_employees, public.expense_attachments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payroll_runs, public.payroll_items FROM authenticated;  -- solo por RPC
REVOKE TRUNCATE ON public.budgets, public.expense_categories, public.payroll_config FROM authenticated;

-- ─── 3) partir las FOR ALL ───────────────────────────────────────────────────
-- Inventario previo (trampa 1), verificado en la viva y en el gemelo:
--   expenses: expenses_owner (ALL) + trial_block_{insert,update,delete} (RESTRICTIVE, quedan)
--   supplier_bills: supplier_bills_owner (ALL) · suppliers: suppliers_owner (ALL)
--   payroll_runs: payroll_runs_owner (ALL) · payroll_items: payroll_items_owner (ALL)
--   payroll_employees: payroll_employees_owner (ALL) · budgets: budgets_owner (ALL)
--   expense_attachments: exp_att_all (ALL)
--   expense_categories: exp_cat_read (SELECT, queda) + exp_cat_write (ALL)
-- La lectura queda en las *_finance_read de 20261003202416.

-- expenses: solo INSERT manual (payroll / supplier_bill solo por RPC DEFINER)
DROP POLICY IF EXISTS expenses_owner ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_manual ON public.expenses;
CREATE POLICY expenses_insert_manual ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finances(owner_type, owner_id) AND kind = 'manual');

-- supplier_bills: solo INSERT de factura nueva sin abonos
DROP POLICY IF EXISTS supplier_bills_owner ON public.supplier_bills;
DROP POLICY IF EXISTS supplier_bills_insert ON public.supplier_bills;
CREATE POLICY supplier_bills_insert ON public.supplier_bills
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finances(owner_type, owner_id)
              AND amount_paid = 0 AND status = 'open');

-- payroll_runs / payroll_items: solo lectura (M1); escritura por RPC
DROP POLICY IF EXISTS payroll_runs_owner ON public.payroll_runs;
DROP POLICY IF EXISTS payroll_items_owner ON public.payroll_items;

-- suppliers
DROP POLICY IF EXISTS suppliers_owner ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finances(owner_type, owner_id));
CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE TO authenticated
  USING (public.can_manage_finances(owner_type, owner_id))
  WITH CHECK (public.can_manage_finances(owner_type, owner_id));

-- payroll_employees (PayrollPage: insert, update y "borrado" = active=false)
DROP POLICY IF EXISTS payroll_employees_owner ON public.payroll_employees;
DROP POLICY IF EXISTS payroll_employees_insert ON public.payroll_employees;
DROP POLICY IF EXISTS payroll_employees_update ON public.payroll_employees;
CREATE POLICY payroll_employees_insert ON public.payroll_employees
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finances(owner_type, owner_id));
CREATE POLICY payroll_employees_update ON public.payroll_employees
  FOR UPDATE TO authenticated
  USING (public.can_manage_finances(owner_type, owner_id))
  WITH CHECK (public.can_manage_finances(owner_type, owner_id));

-- budgets (AccountingBudgetPage: upsert)
DROP POLICY IF EXISTS budgets_owner ON public.budgets;
DROP POLICY IF EXISTS budgets_insert ON public.budgets;
DROP POLICY IF EXISTS budgets_update ON public.budgets;
CREATE POLICY budgets_insert ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finances(owner_type, owner_id));
CREATE POLICY budgets_update ON public.budgets
  FOR UPDATE TO authenticated
  USING (public.can_manage_finances(owner_type, owner_id))
  WITH CHECK (public.can_manage_finances(owner_type, owner_id));

-- expense_attachments (por el gasto padre)
DROP POLICY IF EXISTS exp_att_all ON public.expense_attachments;
DROP POLICY IF EXISTS exp_att_insert ON public.expense_attachments;
DROP POLICY IF EXISTS exp_att_update ON public.expense_attachments;
CREATE POLICY exp_att_insert ON public.expense_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e
                       WHERE e.id = expense_attachments.expense_id
                         AND public.can_manage_finances(e.owner_type, e.owner_id)));
CREATE POLICY exp_att_update ON public.expense_attachments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e
                  WHERE e.id = expense_attachments.expense_id
                    AND public.can_manage_finances(e.owner_type, e.owner_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.expenses e
                       WHERE e.id = expense_attachments.expense_id
                         AND public.can_manage_finances(e.owner_type, e.owner_id)));

-- expense_categories: exp_cat_write (ALL) → INSERT / UPDATE / DELETE explícitos
-- (una categoría no es dinero; el FK desde expenses impide borrar una en uso).
DROP POLICY IF EXISTS exp_cat_write ON public.expense_categories;
DROP POLICY IF EXISTS exp_cat_insert ON public.expense_categories;
DROP POLICY IF EXISTS exp_cat_update ON public.expense_categories;
DROP POLICY IF EXISTS exp_cat_delete ON public.expense_categories;
CREATE POLICY exp_cat_insert ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (owner_id IS NOT NULL AND public.can_manage_finances(owner_type, owner_id));
CREATE POLICY exp_cat_update ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (owner_id IS NOT NULL AND public.can_manage_finances(owner_type, owner_id))
  WITH CHECK (owner_id IS NOT NULL AND public.can_manage_finances(owner_type, owner_id));
CREATE POLICY exp_cat_delete ON public.expense_categories
  FOR DELETE TO authenticated
  USING (owner_id IS NOT NULL AND public.can_manage_finances(owner_type, owner_id));

-- U8: el comprobante de un gasto no se borra.
DROP POLICY IF EXISTS accounting_receipts_delete ON storage.objects;

-- ─── 4) integridad ───────────────────────────────────────────────────────────
ALTER TABLE public.supplier_bills DROP CONSTRAINT IF EXISTS supplier_bills_paid_le_amount;
ALTER TABLE public.supplier_bills ADD CONSTRAINT supplier_bills_paid_le_amount CHECK (amount_paid <= amount);

-- ─── 5) RPC → SECURITY DEFINER ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pay_supplier_bill(p_bill_id uuid, p_amount numeric, p_paid_date date, p_payment_method pay_method DEFAULT 'transfer'::pay_method, p_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_bill      public.supplier_bills;
    v_supplier  text;
    v_saldo     numeric;
    v_expense   uuid;
    v_new_paid  numeric;
    v_new_status public.bill_status;
BEGIN
    SELECT * INTO v_bill FROM public.supplier_bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_not_found');
    END IF;
    -- DEFINER: este es EL control de acceso (la RLS ya no filtra).
    IF NOT public.can_manage_finances(v_bill.owner_type, v_bill.owner_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
    -- Paridad con el trial_block RESTRICTIVE de expenses que el DEFINER salta.
    IF v_bill.owner_type = 'school' AND auth.uid() IS NOT NULL
       AND public.school_is_operational(v_bill.owner_id) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_not_operational');
    END IF;

    v_saldo := v_bill.amount - v_bill.amount_paid;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
    END IF;
    IF p_amount > v_saldo THEN
        RETURN jsonb_build_object('ok', false, 'error', 'amount_exceeds_balance', 'saldo', v_saldo);
    END IF;

    SELECT name INTO v_supplier FROM public.suppliers WHERE id = v_bill.supplier_id;

    -- 1. Egreso enlazado (entra al libro de caja).
    INSERT INTO public.expenses (
        owner_type, owner_id,
        school_id, branch_id,
        category_id, kind, status,
        concept, amount, expense_date, paid_date,
        payment_method, reference,
        created_by, supplier_id, bill_id
    ) VALUES (
        v_bill.owner_type, v_bill.owner_id,
        CASE WHEN v_bill.owner_type = 'school' THEN v_bill.owner_id ELSE NULL END,
        NULL,
        v_bill.category_id, 'supplier_bill', 'paid',
        'Pago proveedor: ' || COALESCE(v_supplier, 'proveedor')
            || COALESCE(' · ' || v_bill.invoice_no, ''),
        p_amount, p_paid_date, p_paid_date,
        p_payment_method, p_reference,
        auth.uid(), v_bill.supplier_id, v_bill.id
    )
    RETURNING id INTO v_expense;

    -- 2. Actualizar saldo y estado de la factura.
    v_new_paid   := v_bill.amount_paid + p_amount;
    v_new_status := CASE WHEN v_new_paid >= v_bill.amount THEN 'paid'::public.bill_status
                         ELSE 'partially_paid'::public.bill_status END;
    UPDATE public.supplier_bills
       SET amount_paid = v_new_paid,
           status      = v_new_status,
           updated_at  = now()
     WHERE id = p_bill_id;

    RETURN jsonb_build_object('ok', true, 'expense_id', v_expense,
                              'amount_paid', v_new_paid, 'status', v_new_status);
END;
$function$;

-- = 20261003201142 + SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.run_payroll(p_owner_type text, p_owner_id uuid, p_year integer, p_month integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    c            public.payroll_config;
    v_run_id     uuid;
    v_existing   public.payroll_runs;
    e            public.payroll_employees;
    v_base numeric; v_aux numeric; v_ibc numeric;
    v_he numeric; v_pe numeric; v_fsp numeric; v_ded numeric;
    v_exon boolean;
    v_hr numeric; v_pr numeric; v_arl numeric; v_caja numeric; v_sena numeric; v_icbf numeric; v_er numeric;
    v_arl_rate numeric;
    v_baseprest numeric; v_ces numeric; v_int numeric; v_prima numeric; v_vac numeric; v_prov numeric;
    v_net numeric;
    t_gross numeric := 0; t_ded numeric := 0; t_net numeric := 0; t_er numeric := 0; t_prov numeric := 0; t_cnt integer := 0;
BEGIN
    IF NOT public.can_manage_finances(p_owner_type, p_owner_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
    IF p_month < 1 OR p_month > 12 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_month');
    END IF;

    SELECT * INTO c FROM public.payroll_config WHERE year = p_year;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_config_for_year', 'year', p_year);
    END IF;

    -- Run existente del período.
    SELECT * INTO v_existing FROM public.payroll_runs
     WHERE owner_type = p_owner_type AND owner_id = p_owner_id
       AND period_year = p_year AND period_month = p_month AND status <> 'void'
     FOR UPDATE;

    IF FOUND THEN
        IF v_existing.status <> 'draft' THEN
            RETURN jsonb_build_object('ok', false, 'error', 'run_locked', 'status', v_existing.status);
        END IF;
        v_run_id := v_existing.id;
        DELETE FROM public.payroll_items WHERE run_id = v_run_id;  -- recalcular
    ELSE
        INSERT INTO public.payroll_runs (owner_type, owner_id, period_year, period_month, status, created_by)
        VALUES (p_owner_type, p_owner_id, p_year, p_month, 'draft', auth.uid())
        RETURNING id INTO v_run_id;
    END IF;

    FOR e IN
        SELECT * FROM public.payroll_employees
         WHERE owner_type = p_owner_type AND owner_id = p_owner_id AND active
    LOOP
        v_base := e.base_salary;
        v_aux  := CASE WHEN e.transport_aid_eligible
                        AND v_base <= c.transport_aid_threshold_smmlv * c.smmlv
                       THEN c.transport_aid ELSE 0 END;
        v_ibc  := GREATEST(v_base, c.smmlv);   -- IBC mínimo 1 SMMLV (auxilio no es IBC)

        -- Deducciones empleado
        v_he  := round(v_ibc * c.health_pct);
        v_pe  := round(v_ibc * c.pension_pct);
        v_fsp := CASE WHEN v_ibc >= c.fsp_threshold_smmlv * c.smmlv THEN round(v_ibc * c.fsp_pct) ELSE 0 END;
        v_ded := v_he + v_pe + v_fsp;

        -- Exoneración Ley 1607 (IBC < umbral SMMLV)
        v_exon := c.exoneration_enabled AND v_ibc < c.exoneration_threshold_smmlv * c.smmlv;

        -- Aportes patronales
        v_hr   := CASE WHEN v_exon THEN 0 ELSE round(v_ibc * c.emp_health_pct) END;
        v_pr   := round(v_ibc * c.emp_pension_pct);
        v_arl_rate := COALESCE((c.arl_rates ->> COALESCE(e.arl_class, 1)::text)::numeric, 0);
        v_arl  := round(v_ibc * v_arl_rate);
        v_caja := round(v_ibc * c.caja_pct);
        v_sena := CASE WHEN v_exon THEN 0 ELSE round(v_ibc * c.sena_pct) END;
        v_icbf := CASE WHEN v_exon THEN 0 ELSE round(v_ibc * c.icbf_pct) END;
        v_er   := v_hr + v_pr + v_arl + v_caja + v_sena + v_icbf;

        -- Provisiones (base prestacional = salario + auxilio)
        v_baseprest := v_base + v_aux;
        v_ces  := round(v_baseprest * c.cesantias_pct);
        v_int  := round(v_ces * c.intereses_cesantias_pct);   -- «C2»: 12 % anual sobre la cesantía causada = porción del mes
        v_prima := round(v_baseprest * c.prima_pct);
        v_vac   := round(v_base * c.vacaciones_pct);                -- vacaciones sobre salario
        v_prov  := v_ces + v_int + v_prima + v_vac;

        v_net := v_base + v_aux - v_ded;

        INSERT INTO public.payroll_items (
            run_id, employee_id, employee_name, base_salary, transport_aid, ibc,
            health_emp, pension_emp, fsp_emp, total_deductions,
            health_er, pension_er, arl_er, caja_er, sena_er, icbf_er, total_employer, exonerated,
            cesantias, intereses_cesantias, prima, vacaciones, total_provisions, net_pay
        ) VALUES (
            v_run_id, e.id, e.full_name, v_base, v_aux, v_ibc,
            v_he, v_pe, v_fsp, v_ded,
            v_hr, v_pr, v_arl, v_caja, v_sena, v_icbf, v_er, v_exon,
            v_ces, v_int, v_prima, v_vac, v_prov, v_net
        );

        t_gross := t_gross + v_base + v_aux;
        t_ded   := t_ded + v_ded;
        t_net   := t_net + v_net;
        t_er    := t_er + v_er;
        t_prov  := t_prov + v_prov;
        t_cnt   := t_cnt + 1;
    END LOOP;

    UPDATE public.payroll_runs
       SET employee_count = t_cnt, total_gross = t_gross, total_deductions = t_ded,
           total_net = t_net, total_employer = t_er, total_provisions = t_prov,
           status = 'draft', updated_at = now()
     WHERE id = v_run_id;

    RETURN jsonb_build_object('ok', true, 'run_id', v_run_id, 'employees', t_cnt,
        'total_net', t_net, 'total_employer', t_er, 'total_provisions', t_prov,
        'cash_cost', t_gross + t_er);   -- «C1»: bruto + patronal (lo deducido también se paga, por PILA)
END;
$fn$;

-- = 20261003201142 + SECURITY DEFINER + paridad trial_block. Conserva el DEFAULT.
CREATE OR REPLACE FUNCTION public.post_payroll_run(p_run_id uuid, p_paid_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    r          public.payroll_runs;
    v_cat      uuid;
    v_expense  uuid;
    v_amount   numeric;
    v_date     date;
BEGIN
    SELECT * INTO r FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'run_not_found'); END IF;
    IF NOT public.can_manage_finances(r.owner_type, r.owner_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
    IF r.status = 'paid' THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true, 'expense_id', r.expense_id);
    END IF;
    IF r.status = 'void' THEN RETURN jsonb_build_object('ok', false, 'error', 'run_void'); END IF;
    -- Paridad con el trial_block RESTRICTIVE de expenses que el DEFINER salta.
    IF r.owner_type = 'school' AND auth.uid() IS NOT NULL
       AND public.school_is_operational(r.owner_id) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_not_operational');
    END IF;

    -- «C1»: salida de caja del mes = devengado (salario + auxilio) + aportes
    -- patronales. Neto al empleado + sus deducciones (que la escuela paga en la
    -- PILA) = devengado. Provisiones = devengo, aparte.
    v_amount := r.total_gross + r.total_employer;
    v_date   := COALESCE(p_paid_date, (make_date(r.period_year, r.period_month, 1) + interval '1 month - 1 day')::date);

    -- Categoría 'Nómina' (propia de la entidad o de sistema).
    SELECT id INTO v_cat FROM public.expense_categories
     WHERE name = 'Nómina' AND (owner_id = r.owner_id OR owner_id IS NULL)
     ORDER BY owner_id NULLS LAST LIMIT 1;

    INSERT INTO public.expenses (
        owner_type, owner_id, school_id, branch_id,
        category_id, kind, status, concept, amount, expense_date, paid_date,
        payment_method, created_by
    ) VALUES (
        r.owner_type, r.owner_id,
        CASE WHEN r.owner_type = 'school' THEN r.owner_id ELSE NULL END, NULL,
        v_cat, 'payroll', 'paid',
        'Nómina ' || lpad(r.period_month::text, 2, '0') || '/' || r.period_year
            || ' (' || r.employee_count || ' empleados)',
        v_amount, v_date, v_date, 'transfer', auth.uid()
    )
    RETURNING id INTO v_expense;

    UPDATE public.payroll_runs
       SET status = 'paid', expense_id = v_expense, approved_by = auth.uid(),
           approved_at = COALESCE(approved_at, now()), paid_at = now(), updated_at = now()
     WHERE id = p_run_id;

    RETURN jsonb_build_object('ok', true, 'expense_id', v_expense, 'amount', v_amount);
END;
$fn$;

REVOKE ALL ON FUNCTION public.pay_supplier_bill(uuid, numeric, date, pay_method, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_payroll(text, uuid, integer, integer)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_payroll_run(uuid, date)                            FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_supplier_bill(uuid, numeric, date, pay_method, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_payroll(text, uuid, integer, integer)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_payroll_run(uuid, date)                            TO authenticated, service_role;

-- ─── 6) auditoría con old y new ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_finance_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_row     jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_school  uuid;
  v_profile uuid;
BEGIN
  IF v_row->>'owner_type' = 'school' THEN
    v_school := NULLIF(v_row->>'owner_id', '')::uuid;
  ELSIF TG_TABLE_NAME = 'expense_attachments' THEN
    SELECT e.school_id INTO v_school FROM public.expenses e
     WHERE e.id = NULLIF(v_row->>'expense_id', '')::uuid;
  ELSE
    v_school := NULLIF(v_row->>'school_id', '')::uuid;
  END IF;
  -- audit_logs.profile_id tiene FK a profiles: un uid sin perfil no puede
  -- tumbar la escritura de dinero.
  SELECT p.id INTO v_profile FROM public.profiles p WHERE p.id = auth.uid();

  INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
  VALUES (v_school, v_profile, TG_TABLE_NAME,
          COALESCE(v_row->>'id', v_row->>'year'), TG_OP,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END;
$function$;
REVOKE ALL ON FUNCTION public.audit_finance_row() FROM PUBLIC, anon, authenticated;

-- payroll_items NO: run_payroll lo reescribe entero en cada recálculo; el run
-- ya queda auditado.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['expenses','supplier_bills','suppliers','payroll_runs','payroll_employees',
                           'payroll_config','budgets','expense_attachments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_finance_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_finance_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I '
                   'FOR EACH ROW EXECUTE FUNCTION public.audit_finance_row()', t);
  END LOOP;
END $$;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003202424', '20261003202424_egresos_sin_borrado_y_auditoria', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261003202426_factura_electronica_guard_pago.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003202426_factura_electronica_guard_pago.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202424
-- Objetivo: Contabilidad v2 · F0 · M5. Guard DIAN en la base (H6 / T-07):
--   (a) un cobro 'paid' con factura electrónica VIVA (queued/sent/accepted, sin
--       anular) no sale de 'paid' sin nota crédito antes → 55000 PAYMENT_INVOICED.
--       Lo hace cualquier camino: PostgREST, RPC, BFF con service_role, SQL.
--   (b) no se crea una factura (document_type='invoice') de un cobro que no esté
--       'paid' → 55000 INVOICE_PAYMENT_NOT_PAID (cinturón además del BFF,
--       invoicing.service.ts:380). FOR SHARE serializa con (a).
--   U5: válvula de escape `sportmaps.allow_unpay_invoiced = 'on'`, que SOLO se
--       enciende con SET LOCAL dentro de admin_unpay_invoiced_payment(): RPC de
--       admin de plataforma que exige motivo (≥ 10 caracteres) y deja rastro en
--       audit_logs. El cliente no puede fijar GUCs por PostgREST.
-- Plan: docs/specs/contabilidad-v2-f0-plan-migraciones.md §2 M5 (U5 = sí, U6:
--   3490fed0 se re-aprueba; el guard no mira la entrada a 'paid').
-- Rollback: DROP TRIGGER ×2 (+ DROP FUNCTION de la RPC de escape).
-- =============================================================================

BEGIN;

-- ─── (a) no se sale de 'paid' con factura viva ───────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_payment_invoiced()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid'
     AND current_setting('sportmaps.allow_unpay_invoiced', true) IS DISTINCT FROM 'on'
     AND EXISTS (SELECT 1 FROM public.electronic_invoices ei
                  WHERE ei.payment_id = OLD.id
                    AND ei.document_type = 'invoice'
                    AND ei.status IN ('queued','sent','accepted')
                    AND ei.voided_at IS NULL)
  THEN
    RAISE EXCEPTION 'PAYMENT_INVOICED: el pago tiene factura electrónica vigente; emite la nota crédito antes de anularlo'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_zy_guard_pago_facturado ON public.payments;
CREATE TRIGGER trg_zy_guard_pago_facturado
  BEFORE UPDATE OF status ON public.payments
  FOR EACH ROW
  WHEN (OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION public.guard_payment_invoiced();

-- ─── (b) no se factura un pago que no esté 'paid' ───────────────────────────
CREATE OR REPLACE FUNCTION public.guard_invoice_requires_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_status text;
BEGIN
  IF NEW.payment_id IS NOT NULL AND NEW.document_type = 'invoice' THEN
    SELECT p.status INTO v_status FROM public.payments p WHERE p.id = NEW.payment_id FOR SHARE;
    IF v_status IS DISTINCT FROM 'paid' THEN
      RAISE EXCEPTION 'INVOICE_PAYMENT_NOT_PAID: %', COALESCE(v_status, 'inexistente')
        USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_factura_pago_pagado ON public.electronic_invoices;
CREATE TRIGGER trg_guard_factura_pago_pagado
  BEFORE INSERT ON public.electronic_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_invoice_requires_paid();

REVOKE ALL ON FUNCTION public.guard_payment_invoiced()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_invoice_requires_paid() FROM PUBLIC, anon, authenticated;

-- ─── U5: escape auditado para soporte ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unpay_invoiced_payment(p_payment_id uuid, p_new_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_old public.payments;
  v_new public.payments;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: solo un admin de plataforma' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'REASON_REQUIRED: el motivo debe tener al menos 10 caracteres' USING ERRCODE = '22023';
  END IF;
  IF p_new_status IS NULL OR p_new_status = 'paid' THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', p_new_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_found');
  END IF;
  IF v_old.status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_paid', 'status', v_old.status);
  END IF;

  PERFORM set_config('sportmaps.allow_unpay_invoiced', 'on', true);
  UPDATE public.payments SET status = p_new_status WHERE id = p_payment_id
  RETURNING * INTO v_new;
  PERFORM set_config('sportmaps.allow_unpay_invoiced', 'off', true);

  INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
  VALUES (v_old.school_id,
          (SELECT p.id FROM public.profiles p WHERE p.id = auth.uid()),
          'payments', p_payment_id::text, 'UNPAY_INVOICED',
          jsonb_build_object('status', v_old.status),
          jsonb_build_object('status', v_new.status, 'reason', btrim(p_reason)));

  RETURN jsonb_build_object('ok', true, 'payment_id', p_payment_id, 'status', v_new.status);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_unpay_invoiced_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unpay_invoiced_payment(uuid, text, text) TO authenticated;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003202426', '20261003202426_factura_electronica_guard_pago', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261003202429_contabilidad_bandeja_eventos.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003202429_contabilidad_bandeja_eventos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202426
-- Objetivo: Contabilidad v2 · F0 · M6 (U9 = sí). Adelanta de F1 SOLO la bandeja
--   de eventos contables (accounting_outbox) y su función de emisión, para que
--   la tienda v2 emita desde su F0 sin una segunda pasada.
--   DECISIÓN (plan §6.1): la tienda NO agrega ramas a cash_ledger ni escribe en
--   tablas contables. Su única salida contable es accounting_emit_event(),
--   llamada dentro de la misma transacción de la RPC SECURITY DEFINER que cambia
--   el estado (pago confirmado, liquidación, payout, reembolso, contracargo).
--   El procesador process_accounting_outbox() y su job siguen en F1.
-- Contrato: docs/specs/contabilidad-v2-f0-plan-migraciones.md §6.2.
--   · idempotency_key = '<event_kind>:<source_id>[:<seq>]' (los reintentos del
--     webhook reusan la clave).
--   · Misma clave + mismo evento → devuelve el id existente (no duplica).
--   · Misma clave + OTRO evento/payload → excepción (es un bug del emisor).
--   · No valida negocio (montos que no cuadran los marca 'failed' el procesador).
-- Rollback: DROP FUNCTION + DROP TABLE (si no tiene filas).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.accounting_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind     text NOT NULL CHECK (source_kind IN ('payment','order','order_item','settlement','payout',
                                                       'refund','reservation_payment','delegation_payment')),
  source_id       uuid NOT NULL,
  event_kind      text NOT NULL CHECK (event_kind IN ('payment_income','payment_reversal','commerce_sale',
                                                      'commerce_commission','commerce_gateway_fee','commerce_payout',
                                                      'commerce_refund','commerce_chargeback','reservation_payment',
                                                      'delegation_payment')),
  owner_type      text NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
  owner_id        uuid NOT NULL,
  payload         jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  idempotency_key text NOT NULL UNIQUE CHECK (length(btrim(idempotency_key)) > 0),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed','skipped')),
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  posted_at       timestamptz
);

COMMENT ON TABLE public.accounting_outbox IS
  'Bandeja de eventos contables (Contabilidad v2 §3.4/§6). Solo se escribe con accounting_emit_event() desde RPC DEFINER o service_role. El procesador (F1) postea al mayor.';

-- Para el procesador de F1 (FOR UPDATE SKIP LOCKED sobre pendientes) y para
-- consultar por dueño / por origen.
CREATE INDEX IF NOT EXISTS idx_accounting_outbox_pending
  ON public.accounting_outbox (created_at) WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_accounting_outbox_owner
  ON public.accounting_outbox (owner_type, owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_outbox_source
  ON public.accounting_outbox (source_kind, source_id);

-- Sin policies: nadie la lee ni la escribe por PostgREST.
ALTER TABLE public.accounting_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accounting_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_emit_event(
    p_source_kind text, p_source_id uuid, p_event_kind text,
    p_owner_type text, p_owner_id uuid, p_payload jsonb, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_id  uuid;
  v_old public.accounting_outbox;
BEGIN
  INSERT INTO public.accounting_outbox (source_kind, source_id, event_kind, owner_type, owner_id,
                                        payload, idempotency_key)
  VALUES (p_source_kind, p_source_id, p_event_kind, p_owner_type, p_owner_id,
          p_payload, p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- La clave ya existía: si es el MISMO evento, idempotente; si no, es un bug.
  SELECT * INTO v_old FROM public.accounting_outbox WHERE idempotency_key = p_idempotency_key;
  IF v_old.source_kind IS DISTINCT FROM p_source_kind
     OR v_old.source_id IS DISTINCT FROM p_source_id
     OR v_old.event_kind IS DISTINCT FROM p_event_kind
     OR v_old.owner_type IS DISTINCT FROM p_owner_type
     OR v_old.owner_id IS DISTINCT FROM p_owner_id
     OR v_old.payload IS DISTINCT FROM p_payload THEN
    RAISE EXCEPTION 'ACCOUNTING_EVENT_CONFLICT: la clave % ya existe con otro evento', p_idempotency_key
      USING ERRCODE = '23505';
  END IF;
  RETURN v_old.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accounting_emit_event(text, uuid, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_emit_event(text, uuid, text, text, uuid, jsonb, text) TO service_role;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003202429', '20261003202429_contabilidad_bandeja_eventos', 'sql-editor 2026-10-04') on conflict (version) do nothing;
