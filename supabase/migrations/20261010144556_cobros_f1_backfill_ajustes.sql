-- =============================================================================
-- 20261010144556_cobros_f1_backfill_ajustes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144555
-- Objetivo: F1 de «Cobros y pagos» (spec cobros-multiples §6.5 «Backfill», §12 M5).
--   DATOS, idempotente. Los cobros que YA tienen un descuento automático reciben:
--     · list_amount / discount_amount coherentes con el invariante de M6
--       (amount = list_amount − discount_amount + late_fee_amount), y
--     · sus filas en payment_adjustments (context = 'backfill', created_by NULL),
--   con la MISMA regla que el trigger de M4 (public._descuentos_automaticos_calc).
--   No cambia amount, amount_paid, estado, período ni vigencia de ningún cobro.
--
-- Radio (base viva, 2026-10-10 14:4x, solo lectura) — 5 filas, 5 escuelas:
--   id                                    escuela                               estado   amount   list     pct  hermanos  → list / discount / ajuste
--   58dfe915-5cfd-4b52-9521-43294b80d658  de300000-0000-4000-8000-000000000001  overdue  180.000  —        —    20.000    → 200.000 / 20.000 / hermanos
--   72932d4d-3451-4228-9aee-0482c91675b3  a1765dc1-3407-444b-bfbd-52cf297a9db1  overdue  175.000  250.000  30   —         → 250.000 / 75.000 / alta_solo_este_mes
--   f19d7b56-11af-4b96-acbf-10a84703ae28  40bd2bb7-1458-4b2c-aa69-eb176abe503b  pending   30.800   35.000  12   —         → 35.000 / 4.200 / alta_solo_este_mes
--   48093924-2b54-4758-a201-541a143c5a67  57ba9352-… (Dreamers)                 pending  232.750  245.000   5   —         → 245.000 / 12.250 / alta_solo_este_mes
--   be39c02a-aa6b-4f9a-9101-b06ed6c53fef  773a4c06-2e33-4ecc-8b20-68c0a428a8f2  pending  126.000  140.000  10   —         → 140.000 / 14.000 / alta_solo_este_mes
--   (El spec decía 3 filas con discount_pct; hoy son 4.) Ninguna tiene recargo,
--   abono ni pronto pago. Pronto pago: 0 filas con early_payment_discount_applied.
--   Militar: 0 inscripciones marcadas.
--   Efectos colaterales del UPDATE: updated_at de esas 5 filas y una fila de
--   audit_logs por cada una (trg_audit_payments). Ningún otro trigger actúa
--   (no cambia status ni early_payment_discount_applied).
--
-- ── DRY-RUN (correr a mano en el SQL Editor ANTES de aplicar; no escribe) ────
-- SELECT p.id, p.school_id, p.status, p.amount, p.late_fee_amount, p.list_amount,
--        p.discount_pct, p.sibling_discount_applied, p.discount_amount,
--        public._descuentos_automaticos_calc(p) AS calculo
--   FROM public.payments p
--  WHERE (p.discount_pct IS NOT NULL AND p.list_amount IS NOT NULL)
--     OR COALESCE(p.sibling_discount_applied, 0) > 0
--  ORDER BY p.created_at;
-- -- Esperado: 5 filas; calculo.list_amount − calculo.discount_amount + late = amount.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    r        public.payments;
    v        jsonb;
    v_it     jsonb;
    v_seq    integer;
    v_before numeric;
    v_after  numeric;
    v_n      integer := 0;
BEGIN
    FOR r IN
        SELECT p.*
          FROM public.payments p
         WHERE ((p.discount_pct IS NOT NULL AND p.list_amount IS NOT NULL)
                OR COALESCE(p.sibling_discount_applied, 0) > 0)
           AND p.discount_amount = 0
           AND NOT EXISTS (SELECT 1 FROM public.payment_adjustments a
                            WHERE a.payment_id = p.id AND a.context = 'backfill')
         ORDER BY p.created_at
         FOR UPDATE
    LOOP
        v := public._descuentos_automaticos_calc(r);
        CONTINUE WHEN v IS NULL;

        -- Coherencia antes de escribir: si el cálculo no cuadra, se aborta todo.
        IF (v->>'list_amount')::numeric - (v->>'discount_amount')::numeric
           + COALESCE(r.late_fee_amount, 0) <> r.amount THEN
            RAISE EXCEPTION 'BACKFILL_INCOHERENTE: cobro % (amount %, cálculo %)', r.id, r.amount, v;
        END IF;

        UPDATE public.payments
           SET list_amount     = (v->>'list_amount')::numeric,
               discount_amount = (v->>'discount_amount')::numeric
         WHERE id = r.id;

        v_seq    := 0;
        v_before := (v->>'list_amount')::numeric + COALESCE(r.late_fee_amount, 0);
        FOR v_it IN SELECT value FROM jsonb_array_elements(v->'items') LOOP
            v_seq   := v_seq + 1;
            v_after := v_before - (v_it->>'amount')::numeric;
            INSERT INTO public.payment_adjustments (
                school_id, payment_id, charge_batch_id, kind, origin, applies_to,
                sequence, basis, pct, amount, scope, context, reason_code, reason_text,
                amount_before, amount_after, amount_paid_at, created_by)
            VALUES (
                r.school_id, r.id, NULL, 'descuento', v_it->>'origin', 'monto',
                v_seq, v_it->>'basis', (v_it->>'pct')::numeric, (v_it->>'amount')::numeric,
                'linea', 'backfill', v_it->>'reason_code', v_it->>'reason_text',
                v_before, v_after, COALESCE(r.amount_paid, 0), NULL);
            v_before := v_after;
        END LOOP;

        v_n := v_n + 1;
    END LOOP;

    RAISE NOTICE 'cobros_f1_backfill_ajustes: % cobros con ajustes de backfill', v_n;
END $$;

COMMIT;
