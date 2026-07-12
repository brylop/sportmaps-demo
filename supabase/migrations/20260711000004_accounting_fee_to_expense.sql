-- ============================================================
-- SPORTMAPS — Contabilidad · Conector fee-pasarela → egreso
--
-- Cierra el gap del análisis de pagos: cuando la ESCUELA absorbe el fee online
-- (school_settings.fee_payer='school'), el fee de pasarela debe ser un EGRESO
-- para que el P&L sea exacto. Al marcarse un payment como 'paid', si la escuela
-- absorbe el fee y hay sportmaps_fee>0, se genera un expense en la categoría
-- 'Comisiones de pasarela'. Idempotente por source_payment_id (un egreso por pago).
--
-- Opt-in: NO hace nada con fee_payer='parent' (default, el padre paga el fee) ni
-- 'split' (ratio no definido). Trigger SECURITY DEFINER → no toca el webhook.
-- ============================================================

ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS source_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;

-- Un solo egreso de comisión por pago (idempotencia del conector).
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_source_payment
    ON public.expenses (source_payment_id) WHERE source_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_school_fee_to_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_fee   numeric;
    v_payer text;
    v_cat   uuid;
BEGIN
    IF NEW.school_id IS NULL THEN RETURN NEW; END IF;
    v_fee := COALESCE(NEW.sportmaps_fee, 0);
    IF v_fee <= 0 THEN RETURN NEW; END IF;

    SELECT fee_payer INTO v_payer FROM public.school_settings WHERE school_id = NEW.school_id;
    IF v_payer IS DISTINCT FROM 'school' THEN RETURN NEW; END IF;  -- solo si la escuela absorbe

    SELECT id INTO v_cat FROM public.expense_categories
     WHERE name = 'Comisiones de pasarela' AND owner_id IS NULL
     LIMIT 1;

    INSERT INTO public.expenses (
        owner_type, owner_id, school_id, branch_id,
        category_id, kind, status, concept, amount, expense_date, paid_date,
        payment_method, created_by, source_payment_id
    ) VALUES (
        'school', NEW.school_id, NEW.school_id, NEW.branch_id,
        v_cat, 'manual', 'paid',
        'Comisión pasarela · ' || COALESCE(NEW.reference, NEW.id::text),
        v_fee, COALESCE(NEW.payment_date, current_date), COALESCE(NEW.payment_date, current_date),
        NULL, NEW.parent_id, NEW.id
    )
    ON CONFLICT (source_payment_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Dispara tanto en UPDATE a 'paid' (webhook) como en INSERT 'paid' (recurrentes).
DROP TRIGGER IF EXISTS trg_payment_fee_to_expense_upd ON public.payments;
CREATE TRIGGER trg_payment_fee_to_expense_upd
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid')
    EXECUTE FUNCTION public.fn_school_fee_to_expense();

DROP TRIGGER IF EXISTS trg_payment_fee_to_expense_ins ON public.payments;
CREATE TRIGGER trg_payment_fee_to_expense_ins
    AFTER INSERT ON public.payments
    FOR EACH ROW
    WHEN (NEW.status = 'paid')
    EXECUTE FUNCTION public.fn_school_fee_to_expense();

COMMENT ON FUNCTION public.fn_school_fee_to_expense() IS
    'Conector: genera egreso Comisiones de pasarela cuando la escuela absorbe el fee (fee_payer=school). Idempotente por source_payment_id.';
