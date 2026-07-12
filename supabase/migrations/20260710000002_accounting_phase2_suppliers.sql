-- ============================================================
-- SPORTMAPS — Módulo Contable · Fase 2 (proveedores + cuentas por pagar)
--
-- Proveedores y facturas por pagar, en el mismo eje multi-owner
-- (owner_type/owner_id) y permiso can_manage_finances. Pagar una factura
-- genera un egreso (expenses.kind='supplier_bill') enlazado, así el pago
-- entra al libro de caja sin duplicar lógica.
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.bill_status AS ENUM ('open','partially_paid','paid','overdue','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Proveedores ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type   text        NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
    owner_id     uuid        NOT NULL,
    name         text        NOT NULL,
    nit          text,
    contact_name text,
    email        text,
    phone        text,
    notes        text,
    active       boolean     NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_owner ON public.suppliers (owner_type, owner_id) WHERE active;

-- ─── Facturas por pagar (cuentas por pagar) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_bills (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type   text        NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
    owner_id     uuid        NOT NULL,
    supplier_id  uuid        NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    category_id  uuid        REFERENCES public.expense_categories(id),
    invoice_no   text,
    amount       numeric     NOT NULL CHECK (amount > 0),
    amount_paid  numeric     NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    issue_date   date        NOT NULL,
    due_date     date        NOT NULL,
    status       public.bill_status NOT NULL DEFAULT 'open',
    notes        text,
    created_by   uuid        NOT NULL REFERENCES auth.users(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_owner  ON public.supplier_bills (owner_type, owner_id, due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_status ON public.supplier_bills (owner_type, owner_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_supplier ON public.supplier_bills (supplier_id);

-- ─── Enlazar egresos a proveedor/factura ──────────────────────────────────────
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id),
    ADD COLUMN IF NOT EXISTS bill_id     uuid REFERENCES public.supplier_bills(id);

-- ─── Triggers updated_at ──────────────────────────────────────────────────────
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers';
        EXECUTE 'CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_supplier_bills_updated_at ON public.supplier_bills';
        EXECUTE 'CREATE TRIGGER trg_supplier_bills_updated_at BEFORE UPDATE ON public.supplier_bills
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

-- ─── RLS (mismo helper multi-owner) ───────────────────────────────────────────
ALTER TABLE public.suppliers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_owner ON public.suppliers;
CREATE POLICY suppliers_owner ON public.suppliers
    FOR ALL TO authenticated
    USING (public.can_manage_finances(owner_type, owner_id))
    WITH CHECK (public.can_manage_finances(owner_type, owner_id));

DROP POLICY IF EXISTS supplier_bills_owner ON public.supplier_bills;
CREATE POLICY supplier_bills_owner ON public.supplier_bills
    FOR ALL TO authenticated
    USING (public.can_manage_finances(owner_type, owner_id))
    WITH CHECK (public.can_manage_finances(owner_type, owner_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_bills TO authenticated;

-- ─── RPC: pagar una factura (genera egreso + actualiza saldo) ─────────────────
-- SECURITY INVOKER: la RLS de supplier_bills/expenses gatea al dueño; created_by
-- se fija con auth.uid() (no spoofable). Idempotencia práctica: valida saldo.
CREATE OR REPLACE FUNCTION public.pay_supplier_bill(
    p_bill_id        uuid,
    p_amount         numeric,
    p_paid_date      date,
    p_payment_method public.pay_method DEFAULT 'transfer',
    p_reference      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
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
    -- La RLS ya restringe a facturas del dueño; doble check defensivo.
    IF NOT public.can_manage_finances(v_bill.owner_type, v_bill.owner_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
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
$$;

GRANT EXECUTE ON FUNCTION public.pay_supplier_bill(uuid, numeric, date, public.pay_method, text) TO authenticated;
