-- ============================================================
-- SPORTMAPS — Módulo Contable · Fase 0.1 (multi-owner)
--
-- Generaliza el libro de caja a TODAS las entidades con responsabilidad
-- financiera (no solo escuelas): eje polimórfico owner_type + owner_id.
--
--   owner_type='school'    -> schools.id   (escuelas y venues/gym; facility_manager)
--   owner_type='vendor'    -> vendor_profiles.id (coach, personal_trainer, wellness, store)
--   owner_type='organizer' -> auth.users.id (el organizador es el usuario)
--
-- Un helper único can_manage_finances(owner_type, owner_id) centraliza el
-- permiso: agregar un rol nuevo = tocar SOLO esa función. Facturación
-- electrónica (DIAN) es una fase futura sobre el lado de ingresos.
-- ============================================================

-- ─── 1. Columnas owner_* (aditivo) ────────────────────────────────────────────
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS owner_type text,
    ADD COLUMN IF NOT EXISTS owner_id   uuid;

ALTER TABLE public.expense_categories
    ADD COLUMN IF NOT EXISTS owner_type text,
    ADD COLUMN IF NOT EXISTS owner_id   uuid;

-- ─── 2. Backfill desde el modelo escuela de Fase 0 ────────────────────────────
UPDATE public.expenses
   SET owner_type = 'school', owner_id = school_id
 WHERE owner_type IS NULL AND school_id IS NOT NULL;

UPDATE public.expense_categories
   SET owner_type = 'school', owner_id = school_id
 WHERE owner_type IS NULL AND school_id IS NOT NULL;
-- Las categorías de sistema (school_id NULL) quedan owner_* NULL = globales.

-- ─── 3. Constraints de coherencia ─────────────────────────────────────────────
ALTER TABLE public.expenses ALTER COLUMN school_id DROP NOT NULL;  -- school_id solo aplica a owner_type='school'
ALTER TABLE public.expenses ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN owner_id   SET NOT NULL;

DO $$ BEGIN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_owner_type_chk
        CHECK (owner_type IN ('school','vendor','organizer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    -- Si es escuela, school_id debe reflejar el owner; branch solo para escuela.
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_school_coherence_chk
        CHECK (
            (owner_type = 'school' AND school_id = owner_id)
            OR (owner_type <> 'school' AND school_id IS NULL AND branch_id IS NULL)
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.expense_categories ADD CONSTRAINT expense_cat_owner_type_chk
        CHECK (owner_type IS NULL OR owner_type IN ('school','vendor','organizer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unicidad por entidad (system ya cubierto por uq_expense_cat_system).
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_cat_owner
    ON public.expense_categories (owner_type, owner_id, name) WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_owner ON public.expenses (owner_type, owner_id, expense_date DESC);

-- ─── 4. Helper único de permisos (extensible) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_manage_finances(p_owner_type text, p_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE p_owner_type
        WHEN 'school' THEN public.is_school_admin(p_owner_id)
        WHEN 'vendor' THEN EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
             WHERE vp.id = p_owner_id AND vp.user_id = auth.uid()
        )
        WHEN 'organizer' THEN p_owner_id = auth.uid()
        ELSE false
    END;
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_finances(text, uuid) TO authenticated;
COMMENT ON FUNCTION public.can_manage_finances(text, uuid) IS
    'Contabilidad multi-owner: TRUE si el usuario puede gestionar las finanzas de la entidad. Punto único para sumar roles.';

-- ─── 5. RLS con el helper ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS expenses_school_admin ON public.expenses;
DROP POLICY IF EXISTS expenses_owner        ON public.expenses;
CREATE POLICY expenses_owner ON public.expenses
    FOR ALL TO authenticated
    USING (public.can_manage_finances(owner_type, owner_id))
    WITH CHECK (public.can_manage_finances(owner_type, owner_id));

DROP POLICY IF EXISTS exp_cat_read  ON public.expense_categories;
DROP POLICY IF EXISTS exp_cat_write ON public.expense_categories;
CREATE POLICY exp_cat_read ON public.expense_categories
    FOR SELECT TO authenticated
    USING (owner_id IS NULL OR public.can_manage_finances(owner_type, owner_id));
CREATE POLICY exp_cat_write ON public.expense_categories
    FOR ALL TO authenticated
    USING (owner_id IS NOT NULL AND public.can_manage_finances(owner_type, owner_id))
    WITH CHECK (owner_id IS NOT NULL AND public.can_manage_finances(owner_type, owner_id));

-- ─── 6. cash_ledger multi-owner (dinámico: incluye marketplace si existe) ──────
DO $do$
DECLARE
    v_sql text;
BEGIN
    v_sql := $base$
        SELECT 'income'::text        AS direction, p.id AS id,
               'school'::text         AS owner_type, p.school_id AS owner_id,
               p.school_id            AS school_id, p.branch_id AS branch_id,
               p.concept              AS concept,   NULL::uuid  AS category_id,
               p.amount               AS amount,    p.payment_date AS movement_date,
               'payment'::text        AS source,    p.status::text AS status
          FROM public.payments p
         WHERE p.status = 'paid'
        UNION ALL
        SELECT 'expense'::text, e.id,
               e.owner_type, e.owner_id,
               e.school_id, e.branch_id,
               e.concept, e.category_id,
               e.amount, e.paid_date,
               'expense'::text, e.status::text
          FROM public.expenses e
         WHERE e.status = 'paid'
    $base$;

    -- Ingresos de vendors: solo si el marketplace está desplegado en este ambiente.
    IF to_regclass('public.marketplace_transactions') IS NOT NULL THEN
        v_sql := v_sql || $mkt$
        UNION ALL
        SELECT 'income'::text, mt.id,
               'vendor'::text, mt.vendor_profile_id,
               NULL::uuid, NULL::uuid,
               COALESCE(mt.description, 'Venta'), NULL::uuid,
               mt.gross_amount, mt.paid_at::date,
               'marketplace'::text, mt.status::text
          FROM public.marketplace_transactions mt
         WHERE mt.status = 'paid' AND mt.vendor_profile_id IS NOT NULL
        $mkt$;
    END IF;

    EXECUTE 'DROP VIEW IF EXISTS public.cash_ledger';
    EXECUTE 'CREATE VIEW public.cash_ledger WITH (security_invoker = true) AS ' || v_sql;
END $do$;

GRANT SELECT ON public.cash_ledger TO authenticated;
COMMENT ON VIEW public.cash_ledger IS
    'Libro de caja multi-owner: ingresos (payments escuela + marketplace vendor si existe) + egresos (expenses). Filtrar por owner_type/owner_id. security_invoker.';
