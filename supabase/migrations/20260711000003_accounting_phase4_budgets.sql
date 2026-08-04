-- ============================================================
-- SPORTMAPS — Contabilidad · Fase 4: presupuesto por categoría
--
-- Presupuesto por categoría de egreso, por año. period_month = 0 → anual;
-- 1-12 → mensual (period_month NOT NULL con sentinela 0 para que el UPSERT
-- por índice único funcione sin el problema de NULLs). Multi-owner + RLS.
-- El "ejecutado" se calcula desde expenses/cash_ledger (no se guarda aquí).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.budgets (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type   text        NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
    owner_id     uuid        NOT NULL,
    category_id  uuid        NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
    period_year  integer     NOT NULL,
    period_month integer     NOT NULL DEFAULT 0 CHECK (period_month BETWEEN 0 AND 12), -- 0 = anual
    amount       numeric     NOT NULL CHECK (amount >= 0),
    created_by   uuid        NOT NULL REFERENCES auth.users(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_budget
    ON public.budgets (owner_type, owner_id, category_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_budgets_owner ON public.budgets (owner_type, owner_id, period_year);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budgets_owner ON public.budgets;
CREATE POLICY budgets_owner ON public.budgets
    FOR ALL TO authenticated
    USING (public.can_manage_finances(owner_type, owner_id))
    WITH CHECK (public.can_manage_finances(owner_type, owner_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets';
        EXECUTE 'CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON public.budgets
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;
