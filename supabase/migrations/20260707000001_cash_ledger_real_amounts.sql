-- ============================================================
-- SPORTMAPS — Contabilidad · ingreso = valor REALMENTE recibido
--
-- PROBLEMA:
--   cash_ledger sumaba p.amount de los pagos 'paid'. Con abonos parciales
--   (status 'partial', amount_paid < amount) eso sobre-contabilizaba: sumaba
--   el total esperado, no lo abonado. Y no incluía los 'partial' en absoluto.
--
-- SOLUCIÓN (ingreso lado pagos):
--   - Incluir status IN ('paid','partial').
--   - Ingreso = LEAST(amount, COALESCE(amount_paid, amount)):
--       * pago completo (manual/cash) → amount_paid = amount → suma amount.
--       * abono parcial → suma amount_paid (lo realmente recibido).
--       * Wompi/MP → amount_paid = bruto (base + fee que paga el padre);
--         LEAST con amount deja la BASE (sin fee) como ingreso de la escuela.
--   - El recargo de mora ya viene folado dentro de amount (motor de mora),
--     así que se contabiliza como ingreso correctamente.
--
-- NOTA: el fee que asume la escuela (fee_payer school/split) será un egreso
--   en una fase posterior, una vez el checkout descuente realmente ese fee
--   (hoy el checkout siempre lo cobra al padre). No se contabiliza aquí para
--   no registrar un egreso que no ocurre.
--
-- Reversible: solo redefine la vista, no toca datos.
-- ============================================================

DO $do$
DECLARE
    v_sql text;
BEGIN
    v_sql := $base$
        SELECT 'income'::text        AS direction, p.id AS id,
               'school'::text         AS owner_type, p.school_id AS owner_id,
               p.school_id            AS school_id, p.branch_id AS branch_id,
               p.concept              AS concept,   NULL::uuid  AS category_id,
               LEAST(p.amount, COALESCE(p.amount_paid, p.amount)) AS amount,
               p.payment_date         AS movement_date,
               'payment'::text        AS source,    p.status::text AS status
          FROM public.payments p
         WHERE p.status IN ('paid', 'partial')
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
    'Libro de caja multi-owner. Ingreso de pagos = LEAST(amount, COALESCE(amount_paid, amount)) para status paid/partial (base sin fee y abonos por lo realmente recibido) + marketplace vendor + egresos. security_invoker.';
