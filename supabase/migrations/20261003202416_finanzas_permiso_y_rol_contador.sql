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
