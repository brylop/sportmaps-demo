-- ============================================================
-- SPORTMAPS — Contabilidad · ingreso = valor REALMENTE recibido
--
-- PROBLEMA:
--   cash_ledger sumaba p.amount de los pagos 'paid'. Con abonos parciales
--   (status 'partial', amount_paid < amount) eso sobre-contabilizaba: sumaba
--   el total esperado, no lo abonado. Y no incluía los 'partial'.
--
-- SOLUCIÓN (ingreso lado pagos):
--   - Incluir status IN ('paid','partial').
--   - Ingreso = LEAST(amount, COALESCE(amount_paid, amount)):
--       * pago completo (manual/cash) → amount_paid = amount → suma amount.
--       * abono parcial → suma amount_paid (lo realmente recibido).
--       * Wompi/MP → amount_paid = bruto (base + fee que paga el padre);
--         LEAST con amount deja la BASE (sin fee) como ingreso de la escuela.
--   - El recargo de mora ya viene folado dentro de amount, se contabiliza como
--     ingreso correctamente.
--
-- ADAPTABLE: funciona con el esquema Fase 0 (expenses sin owner_type) y con el
--   multi-owner (20260706000001, expenses con owner_type/owner_id). Detecta la
--   columna y emite siempre owner_type/owner_id en la vista (forward-compatible).
--
-- NOTA: el fee que asume la escuela (fee_payer school/split) será un egreso en
--   una fase posterior, cuando el checkout descuente realmente ese fee.
--
-- Reversible: solo redefine la vista, no toca datos.
-- ============================================================

DO $do$
DECLARE
    v_sql       text;
    v_has_owner boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'expenses'
           AND column_name = 'owner_type'
    ) INTO v_has_owner;

    -- Ingreso de pagos (owner escuela). Base sin fee + abonos por lo recibido.
    v_sql := $base$
        SELECT 'income'::text  AS direction, p.id AS id,
               'school'::text   AS owner_type, p.school_id AS owner_id,
               p.school_id      AS school_id, p.branch_id AS branch_id,
               p.concept        AS concept,   NULL::uuid  AS category_id,
               LEAST(p.amount, COALESCE(p.amount_paid, p.amount)) AS amount,
               p.payment_date   AS movement_date,
               'payment'::text  AS source,    p.status::text AS status
          FROM public.payments p
         WHERE p.status IN ('paid', 'partial')
    $base$;

    -- Egresos: usa owner_type/owner_id si existen; si no (Fase 0), deriva 'school'.
    IF v_has_owner THEN
        v_sql := v_sql || $exp$
            UNION ALL
            SELECT 'expense'::text, e.id, e.owner_type, e.owner_id,
                   e.school_id, e.branch_id, e.concept, e.category_id,
                   e.amount, e.paid_date, 'expense'::text, e.status::text
              FROM public.expenses e
             WHERE e.status = 'paid'
        $exp$;
    ELSE
        v_sql := v_sql || $exp$
            UNION ALL
            SELECT 'expense'::text, e.id, 'school'::text, e.school_id,
                   e.school_id, e.branch_id, e.concept, e.category_id,
                   e.amount, e.paid_date, 'expense'::text, e.status::text
              FROM public.expenses e
             WHERE e.status = 'paid'
        $exp$;
    END IF;

    -- Ingresos de vendors: solo si el marketplace está desplegado.
    IF to_regclass('public.marketplace_transactions') IS NOT NULL THEN
        v_sql := v_sql || $mkt$
            UNION ALL
            SELECT 'income'::text, mt.id, 'vendor'::text, mt.vendor_profile_id,
                   NULL::uuid, NULL::uuid, COALESCE(mt.description, 'Venta'), NULL::uuid,
                   mt.gross_amount, mt.paid_at::date, 'marketplace'::text, mt.status::text
              FROM public.marketplace_transactions mt
             WHERE mt.status = 'paid' AND mt.vendor_profile_id IS NOT NULL
        $mkt$;
    END IF;

    EXECUTE 'DROP VIEW IF EXISTS public.cash_ledger';
    EXECUTE 'CREATE VIEW public.cash_ledger WITH (security_invoker = true) AS ' || v_sql;
END $do$;

GRANT SELECT ON public.cash_ledger TO authenticated;
COMMENT ON VIEW public.cash_ledger IS
    'Libro de caja. Ingreso de pagos = LEAST(amount, COALESCE(amount_paid, amount)) para status paid/partial (base sin fee + abonos por lo recibido) + egresos (+ marketplace si existe). Adaptable a Fase 0 / multi-owner. security_invoker.';
