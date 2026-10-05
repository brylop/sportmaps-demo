-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 1 de 5 (ver README.md).

-- =============================================================================
-- 20261005133939_anular_gasto_con_motivo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005133932
-- Objetivo: anular gastos y facturas de proveedor con motivo, y editar una
--   factura antes de que tenga pagos. Contabilidad v2 §3.5 (reversos) en su
--   parte que no depende del mayor (F1 aún no existe: no hay journal_entries;
--   cuando exista, void_expense / void_supplier_bill emitirán el asiento de
--   reverso desde aquí mismo).
-- =============================================================================
-- Contexto: desde 20261003202424 (M4) un gasto no se edita ni se borra
-- (authenticated sin UPDATE/DELETE en expenses ni supplier_bills). Faltaba la
-- salida legítima para un error: ANULAR con motivo, que deja la fila (tachada)
-- y su rastro en audit_logs (trigger audit_finance_row: old_data + new_data).
--
-- 1. Columnas de anulación en expenses y supplier_bills: void_reason,
--    voided_at, voided_by (FK a profiles, regla de FKs de negocio).
-- 2. void_expense(p_expense_id, p_reason) — SECURITY DEFINER:
--      · motivo ≥ 10 caracteres (22023), finance_permission(..., 'void') (42501;
--        el contador NO anula: matriz §3.8), escuela operativa (paridad con el
--        trial_block RESTRICTIVE que el DEFINER salta), gasto ya anulado (55000).
--      · status → 'void'. cash_ledger solo suma status='paid': sale del libro,
--        de los totales y del EdR automáticamente.
--      · kind='supplier_bill' con bill_id: se revierte el abono en la factura
--        (amount_paid -= monto; estado 'open' si queda en 0, 'partially_paid'
--        si no). Bloqueo factura → gasto, mismo orden que pay_supplier_bill.
--      · kind='payroll' (nómina pagada) — DECISIÓN: anular el egreso anula el
--        run entero (payroll_runs.status='void'). La nómina se paga como un solo
--        egreso del run (post_payroll_run), así que no hay anulación parcial
--        coherente. El run anulado conserva sus payroll_items (historial) y el
--        período queda libre: uq_payroll_run_period excluye 'void', de modo que
--        run_payroll + post_payroll_run crean un run nuevo si hay que repetirla.
--        El motivo vive en el gasto; el cambio del run queda en audit_logs.
--      · source_payment_id (comisión de pasarela creada por
--        fn_school_fee_to_expense): NO se anula aquí (55000) — nace del cobro y
--        se corrige anulando el cobro; anularla suelta dejaría el EdR sin la
--        comisión que sí se pagó y el índice único impediría regenerarla.
-- 3. void_supplier_bill(p_bill_id, p_reason): solo sin pagos (amount_paid = 0
--    y ningún gasto vivo enlazado). Con pagos: primero anular cada pago con
--    void_expense (eso revierte el saldo) y luego la factura.
-- 4. update_supplier_bill(...): editar proveedor/número/monto/fechas/categoría/
--    notas de una factura SIN pagos (open/overdue, amount_paid = 0).
--    Permiso 'write'. Con pagos no se edita: se anulan los pagos.
-- 5. pay_supplier_bill: cuerpo vivo (= 20261003202424, verificado contra la viva
--    2026-10-05) + rechazo 'bill_void': hoy una factura anulada con saldo
--    se podía seguir pagando.
-- Contrato de errores: las tres RPC nuevas levantan excepción con ERRCODE
-- (el frontend muestra error.message); pay_supplier_bill conserva su jsonb.
-- =============================================================================

BEGIN;

-- ─── 1) columnas de anulación ────────────────────────────────────────────────
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS void_reason text,
    ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
    ADD COLUMN IF NOT EXISTS voided_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_bills
    ADD COLUMN IF NOT EXISTS void_reason text,
    ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
    ADD COLUMN IF NOT EXISTS voided_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 0 filas 'void' en la viva hoy (2026-10-05): el CHECK entra validado.
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_void_reason_chk;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_void_reason_chk
    CHECK (void_reason IS NULL OR length(btrim(void_reason)) >= 10);
ALTER TABLE public.supplier_bills DROP CONSTRAINT IF EXISTS supplier_bills_void_reason_chk;
ALTER TABLE public.supplier_bills ADD CONSTRAINT supplier_bills_void_reason_chk
    CHECK (void_reason IS NULL OR length(btrim(void_reason)) >= 10);

COMMENT ON COLUMN public.expenses.void_reason IS 'Motivo de la anulación (≥ 10 caracteres). Solo lo escribe void_expense().';
COMMENT ON COLUMN public.supplier_bills.void_reason IS 'Motivo de la anulación (≥ 10 caracteres). Solo lo escribe void_supplier_bill().';

-- ─── 2) void_expense ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_expense(p_expense_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_reason   text := btrim(COALESCE(p_reason, ''));
    v_exp      public.expenses;
    v_bill     public.supplier_bills;
    v_run_id   uuid;
    v_profile  uuid;
    v_new_paid numeric;
    v_bill_out jsonb;
BEGIN
    IF length(v_reason) < 10 THEN
        RAISE EXCEPTION 'El motivo de la anulación debe tener al menos 10 caracteres.'
            USING ERRCODE = '22023', HINT = 'VOID_REASON_TOO_SHORT';
    END IF;

    -- Lectura sin bloqueo para saber si hay factura; el orden de bloqueo es
    -- factura → gasto, igual que pay_supplier_bill (sin ciclos).
    SELECT * INTO v_exp FROM public.expenses WHERE id = p_expense_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gasto no encontrado.' USING ERRCODE = 'P0002', HINT = 'EXPENSE_NOT_FOUND';
    END IF;
    -- DEFINER: este es EL control de acceso.
    IF NOT public.finance_permission(v_exp.owner_type, v_exp.owner_id, 'void') THEN
        RAISE EXCEPTION 'No tienes permiso para anular gastos.' USING ERRCODE = '42501', HINT = 'FINANCE_FORBIDDEN';
    END IF;
    IF v_exp.owner_type = 'school' AND auth.uid() IS NOT NULL
       AND public.school_is_operational(v_exp.owner_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'La escuela no está operativa.' USING ERRCODE = '42501', HINT = 'SCHOOL_NOT_OPERATIONAL';
    END IF;

    IF v_exp.bill_id IS NOT NULL THEN
        SELECT * INTO v_bill FROM public.supplier_bills WHERE id = v_exp.bill_id FOR UPDATE;
    END IF;
    SELECT * INTO v_exp FROM public.expenses WHERE id = p_expense_id FOR UPDATE;

    IF v_exp.status = 'void' THEN
        RAISE EXCEPTION 'Este gasto ya está anulado.' USING ERRCODE = '55000', HINT = 'EXPENSE_ALREADY_VOID';
    END IF;
    IF v_exp.source_payment_id IS NOT NULL THEN
        RAISE EXCEPTION 'Esta comisión de pasarela nace de un cobro: se corrige anulando el cobro.'
            USING ERRCODE = '55000', HINT = 'EXPENSE_FROM_PAYMENT';
    END IF;

    SELECT p.id INTO v_profile FROM public.profiles p WHERE p.id = auth.uid();

    UPDATE public.expenses
       SET status = 'void', void_reason = v_reason, voided_at = now(), voided_by = v_profile,
           updated_at = now()
     WHERE id = p_expense_id;

    -- Pago a proveedor: revertir el abono en la factura.
    IF v_exp.kind = 'supplier_bill' AND v_bill.id IS NOT NULL THEN
        v_new_paid := GREATEST(v_bill.amount_paid - v_exp.amount, 0);
        UPDATE public.supplier_bills
           SET amount_paid = v_new_paid,
               status = CASE WHEN v_bill.status = 'void' THEN v_bill.status
                             WHEN v_new_paid = 0 THEN 'open'::public.bill_status
                             ELSE 'partially_paid'::public.bill_status END,
               updated_at = now()
         WHERE id = v_bill.id;
        v_bill_out := jsonb_build_object('bill_id', v_bill.id, 'amount_paid', v_new_paid);
    END IF;

    -- Nómina pagada: se anula el run entero (ver encabezado).
    IF v_exp.kind = 'payroll' THEN
        UPDATE public.payroll_runs
           SET status = 'void', updated_at = now()
         WHERE expense_id = p_expense_id AND status <> 'void'
        RETURNING id INTO v_run_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'expense_id', p_expense_id, 'status', 'void',
                              'bill', v_bill_out, 'payroll_run_id', v_run_id);
END;
$fn$;

-- ─── 3) void_supplier_bill ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_supplier_bill(p_bill_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_reason  text := btrim(COALESCE(p_reason, ''));
    v_bill    public.supplier_bills;
    v_profile uuid;
BEGIN
    IF length(v_reason) < 10 THEN
        RAISE EXCEPTION 'El motivo de la anulación debe tener al menos 10 caracteres.'
            USING ERRCODE = '22023', HINT = 'VOID_REASON_TOO_SHORT';
    END IF;
    SELECT * INTO v_bill FROM public.supplier_bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada.' USING ERRCODE = 'P0002', HINT = 'BILL_NOT_FOUND';
    END IF;
    IF NOT public.finance_permission(v_bill.owner_type, v_bill.owner_id, 'void') THEN
        RAISE EXCEPTION 'No tienes permiso para anular facturas.' USING ERRCODE = '42501', HINT = 'FINANCE_FORBIDDEN';
    END IF;
    IF v_bill.owner_type = 'school' AND auth.uid() IS NOT NULL
       AND public.school_is_operational(v_bill.owner_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'La escuela no está operativa.' USING ERRCODE = '42501', HINT = 'SCHOOL_NOT_OPERATIONAL';
    END IF;
    IF v_bill.status = 'void' THEN
        RAISE EXCEPTION 'Esta factura ya está anulada.' USING ERRCODE = '55000', HINT = 'BILL_ALREADY_VOID';
    END IF;
    IF v_bill.amount_paid > 0 OR EXISTS (
        SELECT 1 FROM public.expenses e WHERE e.bill_id = p_bill_id AND e.status <> 'void') THEN
        RAISE EXCEPTION 'La factura tiene pagos registrados: anula primero cada pago.'
            USING ERRCODE = '55000', HINT = 'BILL_HAS_PAYMENTS';
    END IF;

    SELECT p.id INTO v_profile FROM public.profiles p WHERE p.id = auth.uid();
    UPDATE public.supplier_bills
       SET status = 'void', void_reason = v_reason, voided_at = now(), voided_by = v_profile,
           updated_at = now()
     WHERE id = p_bill_id;

    RETURN jsonb_build_object('ok', true, 'bill_id', p_bill_id, 'status', 'void');
END;
$fn$;

-- ─── 4) update_supplier_bill (solo sin pagos) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_supplier_bill(
    p_bill_id     uuid,
    p_supplier_id uuid,
    p_invoice_no  text,
    p_amount      numeric,
    p_issue_date  date,
    p_due_date    date,
    p_category_id uuid DEFAULT NULL,
    p_notes       text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_bill public.supplier_bills;
BEGIN
    SELECT * INTO v_bill FROM public.supplier_bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada.' USING ERRCODE = 'P0002', HINT = 'BILL_NOT_FOUND';
    END IF;
    IF NOT public.finance_permission(v_bill.owner_type, v_bill.owner_id, 'write') THEN
        RAISE EXCEPTION 'No tienes permiso para editar facturas.' USING ERRCODE = '42501', HINT = 'FINANCE_FORBIDDEN';
    END IF;
    IF v_bill.owner_type = 'school' AND auth.uid() IS NOT NULL
       AND public.school_is_operational(v_bill.owner_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'La escuela no está operativa.' USING ERRCODE = '42501', HINT = 'SCHOOL_NOT_OPERATIONAL';
    END IF;
    IF v_bill.status NOT IN ('open', 'overdue') OR v_bill.amount_paid > 0 OR EXISTS (
        SELECT 1 FROM public.expenses e WHERE e.bill_id = p_bill_id AND e.status <> 'void') THEN
        RAISE EXCEPTION 'Solo se edita una factura abierta y sin pagos.'
            USING ERRCODE = '55000', HINT = 'BILL_NOT_EDITABLE';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor que cero.' USING ERRCODE = '22023', HINT = 'INVALID_AMOUNT';
    END IF;
    IF p_issue_date IS NULL OR p_due_date IS NULL OR p_due_date < p_issue_date THEN
        RAISE EXCEPTION 'El vencimiento no puede ser antes de la emisión.' USING ERRCODE = '22023', HINT = 'INVALID_DATES';
    END IF;
    -- El proveedor y la categoría deben ser del mismo dueño (o de sistema).
    IF NOT EXISTS (SELECT 1 FROM public.suppliers s
                    WHERE s.id = p_supplier_id
                      AND s.owner_type = v_bill.owner_type AND s.owner_id = v_bill.owner_id) THEN
        RAISE EXCEPTION 'Proveedor inválido.' USING ERRCODE = '22023', HINT = 'INVALID_SUPPLIER';
    END IF;
    IF p_category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.expense_categories c
         WHERE c.id = p_category_id AND (c.owner_id IS NULL OR c.owner_id = v_bill.owner_id)) THEN
        RAISE EXCEPTION 'Categoría inválida.' USING ERRCODE = '22023', HINT = 'INVALID_CATEGORY';
    END IF;

    UPDATE public.supplier_bills
       SET supplier_id = p_supplier_id,
           invoice_no  = NULLIF(btrim(COALESCE(p_invoice_no, '')), ''),
           amount      = p_amount,
           issue_date  = p_issue_date,
           due_date    = p_due_date,
           category_id = p_category_id,
           notes       = NULLIF(btrim(COALESCE(p_notes, '')), ''),
           updated_at  = now()
     WHERE id = p_bill_id;

    RETURN jsonb_build_object('ok', true, 'bill_id', p_bill_id);
END;
$fn$;

-- ─── 5) pay_supplier_bill: = viva + rechazo de factura anulada ───────────────
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
    -- 20261005133939: una factura anulada no se paga.
    IF v_bill.status = 'void' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bill_void');
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

-- ─── GRANT / REVOKE (trampa 3: explícito a anon y authenticated) ─────────────
REVOKE ALL ON FUNCTION public.void_expense(uuid, text)                                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_supplier_bill(uuid, text)                                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_supplier_bill(uuid, uuid, text, numeric, date, date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pay_supplier_bill(uuid, numeric, date, pay_method, text)         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_expense(uuid, text)                                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_supplier_bill(uuid, text)                                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_supplier_bill(uuid, uuid, text, numeric, date, date, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_supplier_bill(uuid, numeric, date, pay_method, text)         TO authenticated, service_role;

COMMENT ON FUNCTION public.void_expense(uuid, text) IS
    'Anula un gasto con motivo (≥10). Permiso void (no contador). Revierte el abono si era pago a '
    'proveedor; si era nómina anula el run entero. No anula comisiones de pasarela (source_payment_id). '
    '20261005133939.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261005133939', '20261005133939_anular_gasto_con_motivo', 'sql-editor 2026-10-05') on conflict (version) do nothing;
