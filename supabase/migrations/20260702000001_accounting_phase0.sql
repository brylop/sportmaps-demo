-- ============================================================
-- SPORTMAPS — Módulo Contable · Fase 0 (libro de caja)
--
-- Objetivo: registrar EGRESOS (gastos manuales) y unificarlos con los
-- INGRESOS existentes (payments pagados) en un solo libro: cash_ledger.
--
-- Alcance Fase 0 (aditivo, no toca payments):
--   - enums expense_status / expense_kind
--   - expense_categories (categorías; sistema globales + por escuela)
--   - expenses (movimientos de egreso)
--   - cash_ledger (VIEW security_invoker: payments 'paid' + expenses 'paid')
--   - RLS por escuela con helper is_school_admin
--
-- Fases siguientes agregan: comprobantes, proveedores/CxP, nómina CO,
-- presupuesto, reportes P&L y auditoría. NO se referencian aquí (aún no existen).
-- ============================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE public.expense_status AS ENUM ('draft','pending_approval','approved','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.expense_kind AS ENUM ('manual','payroll','supplier_bill');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Categorías de egreso ─────────────────────────────────────────────────────
-- school_id NULL = categoría de sistema (global, visible por todas las escuelas).
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id  uuid        REFERENCES public.schools(id) ON DELETE CASCADE,
    name       text        NOT NULL,
    parent_id  uuid        REFERENCES public.expense_categories(id) ON DELETE SET NULL,
    is_system  boolean     NOT NULL DEFAULT false,
    active     boolean     NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicidad: una categoría de sistema por nombre; una por (escuela, nombre).
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_cat_system
    ON public.expense_categories (name) WHERE school_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_cat_school
    ON public.expense_categories (school_id, name) WHERE school_id IS NOT NULL;

-- Seed de categorías de sistema (globales). Idempotente.
INSERT INTO public.expense_categories (name, is_system)
VALUES
    ('Nómina', true),
    ('Arriendo de sede', true),
    ('Servicios públicos', true),
    ('Insumos deportivos', true),
    ('Mantenimiento', true),
    ('Transporte', true),
    ('Marketing', true),
    ('Comisiones de pasarela', true),
    ('Impuestos y legal', true),
    ('Otros', true)
ON CONFLICT (name) WHERE school_id IS NULL DO NOTHING;

-- ─── Egresos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
    id             uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid                  NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    branch_id      uuid                  REFERENCES public.school_branches(id),
    category_id    uuid                  NOT NULL REFERENCES public.expense_categories(id),
    kind           public.expense_kind   NOT NULL DEFAULT 'manual',
    status         public.expense_status NOT NULL DEFAULT 'draft',
    concept        text                  NOT NULL,
    amount         numeric               NOT NULL CHECK (amount > 0),
    expense_date   date                  NOT NULL,   -- fecha de causación
    paid_date      date,                             -- cuándo salió la plata
    payment_method public.pay_method,
    reference      text,                             -- # comprobante/transferencia
    notes          text,
    created_by     uuid                  NOT NULL REFERENCES auth.users(id),
    approved_by    uuid                  REFERENCES auth.users(id),
    approved_at    timestamptz,
    created_at     timestamptz           NOT NULL DEFAULT now(),
    updated_at     timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_school_date   ON public.expenses (school_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_school_status ON public.expenses (school_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_category      ON public.expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch        ON public.expenses (branch_id) WHERE branch_id IS NOT NULL;

-- ─── Triggers updated_at (helper estándar del proyecto) ───────────────────────
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_expense_categories_updated_at ON public.expense_categories';
        EXECUTE 'CREATE TRIGGER trg_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses';
        EXECUTE 'CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses           ENABLE ROW LEVEL SECURITY;

-- Categorías: leer sistema (school_id NULL) o las de mi escuela (si soy admin);
-- escribir solo las de mi escuela.
DROP POLICY IF EXISTS exp_cat_read ON public.expense_categories;
CREATE POLICY exp_cat_read ON public.expense_categories
    FOR SELECT TO authenticated
    USING (school_id IS NULL OR public.is_school_admin(school_id));

DROP POLICY IF EXISTS exp_cat_write ON public.expense_categories;
CREATE POLICY exp_cat_write ON public.expense_categories
    FOR ALL TO authenticated
    USING (school_id IS NOT NULL AND public.is_school_admin(school_id))
    WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(school_id));

-- Egresos: solo owner/admin de la escuela dueña.
DROP POLICY IF EXISTS expenses_school_admin ON public.expenses;
CREATE POLICY expenses_school_admin ON public.expenses
    FOR ALL TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));

-- ─── Vista unificada: libro de caja ───────────────────────────────────────────
-- security_invoker => aplica la RLS de payments/expenses al usuario que consulta.
DROP VIEW IF EXISTS public.cash_ledger;
CREATE VIEW public.cash_ledger
    WITH (security_invoker = true) AS
    SELECT
        'income'::text        AS direction,
        p.id                  AS id,
        p.school_id           AS school_id,
        p.branch_id           AS branch_id,
        p.concept             AS concept,
        NULL::uuid            AS category_id,
        p.amount              AS amount,
        p.payment_date        AS movement_date,
        'payment'::text       AS source,
        p.status::text        AS status
    FROM public.payments p
    WHERE p.status = 'paid'
    UNION ALL
    SELECT
        'expense'::text       AS direction,
        e.id                  AS id,
        e.school_id           AS school_id,
        e.branch_id           AS branch_id,
        e.concept             AS concept,
        e.category_id         AS category_id,
        e.amount              AS amount,
        e.paid_date           AS movement_date,
        'expense'::text       AS source,
        e.status::text        AS status
    FROM public.expenses e
    WHERE e.status = 'paid';

COMMENT ON VIEW public.cash_ledger IS
    'Libro de caja Fase 0: ingresos (payments paid) + egresos (expenses paid). security_invoker: respeta RLS por escuela.';

-- ─── Grants (RLS sigue restringiendo filas por escuela) ───────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE          ON public.expenses           TO authenticated;
GRANT SELECT                          ON public.cash_ledger        TO authenticated;
