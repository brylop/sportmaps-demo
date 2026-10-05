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
