-- ============================================================
-- SMOKE TEST — «Cobros y pagos» F1: descuentos, condonación, exoneración,
-- abonos y reversión (spec cobros-multiples §6.5, §7.5, §7.6, §15).
-- NO es una migración. Requiere aplicadas las 9 migraciones cobros_f1_*
-- (20261010144551 … 20261010144600) y F0 (20261010143132).
--
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/_smoke/payment_adjustments_smoke.sql
--
-- SOLO Club Campestre Demo. Arma sus propios atletas e inscripciones dentro de
-- Campestre y termina en ROLLBACK. open_month se llama sobre Campestre DENTRO
-- de la transacción (también se revierte).
-- Casos: descuento 10 % a línea nueva; abono 300.000 + descuento que lo dejaría
-- en 250.000 → DESCUENTO_EXCEDE; descuento que toca el recargo → DESCUENTO_EXCEDE;
-- condonar recargo (late_fee_applied_at se conserva: apply_late_fees no vuelve a
-- cobrar); exonerar mensualidad → paid $0 + vigencia + open_month no la reemite;
-- exonerar torneo → cancelled; revertir → monto original, segunda vez →
-- YA_REVERTIDO; awaiting_approval → EN_REVISION; enlace vigente →
-- PAGO_EN_CURSO; seen viejo → PREVIEW_STALE; cerrar con descuento → paid y
-- amount = amount_paid; abono → partial + payment_installments; descuento
-- general por valor con resto mayor; militar + hermanos (trigger M4) + modal
-- secuenciales (T29); invariante en todas las filas.
-- Al final, bloque opcional de MEDICIÓN de open_month con y sin trigger.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.espera_error(p_sql text, p_code text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF position(p_code IN SQLERRM) = 0 THEN
      RAISE EXCEPTION 'ASSERT: se esperaba % y llegó: %', p_code, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'ASSERT: se esperaba el error % y la llamada pasó', p_code;
END $$;

-- Vista previa + creación con el hash de la vista previa (modo un atleta).
CREATE FUNCTION pg_temp.op(p_actor uuid, p_athlete jsonb, p_lines jsonb, p_pending jsonb DEFAULT '[]',
                           p_global jsonb DEFAULT NULL, p_payment jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE v jsonb; s uuid := '25a123f0-6d57-48a4-9800-7b1531d61cd2';
BEGIN
  v := public.preview_charge_batch(s, p_actor, jsonb_build_array(p_athlete), p_lines, p_pending, p_global, p_payment);
  RETURN public.create_charge_batch(s, p_actor, gen_random_uuid(), 'single', '{}'::jsonb,
           jsonb_build_array(p_athlete), p_lines, '[]'::jsonb, false, v->>'preview_hash',
           p_pending, p_global, p_payment);
END $$;

CREATE FUNCTION pg_temp.pend(p_id uuid, p_extra jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql AS $$
  SELECT jsonb_build_object('payment_id', p.id,
           'seen', jsonb_build_object('amount', p.amount, 'amount_paid', COALESCE(p.amount_paid, 0))) || p_extra
    FROM public.payments p WHERE p.id = p_id
$$;

DO $$
DECLARE
  c_school constant uuid := '25a123f0-6d57-48a4-9800-7b1531d61cd2';
  v_owner uuid; v_plan uuid; v_price numeric; v_team uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_e1 uuid; v_e2 uuid; v_e3 uuid;
  v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_m1 date := (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date) + interval '1 month')::date;
  v_m2 date := (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date) + interval '2 months')::date;
  v_tag text := 'SMOKE ADJ ' || substr(md5(random()::text), 1, 6);
  v_a1 jsonb; v_a2 jsonb; v_a3 jsonb;
  v_cash jsonb;
  v_res jsonb; v_prev jsonb;
  v_p uuid; v_q uuid; v_r uuid; v_adj uuid;
  v_row record;
  v_exp date;
  v_n int;
  v_fee numeric; v_mil numeric; v_sib numeric; v_amt numeric;
BEGIN
  SELECT owner_id INTO v_owner FROM public.schools WHERE id = c_school AND name = 'Club Campestre Demo';
  IF v_owner IS NULL THEN RAISE EXCEPTION 'SETUP: Club Campestre Demo no existe'; END IF;
  SELECT op.id, op.price INTO v_plan, v_price FROM public.offering_plans op
   WHERE op.school_id = c_school AND op.price > 0 ORDER BY op.created_at LIMIT 1;
  SELECT t.id INTO v_team FROM public.teams t WHERE t.school_id = c_school ORDER BY t.created_at LIMIT 1;
  v_cash := jsonb_build_object('method', 'cash', 'payment_date', v_today, 'reference', 'REC-' || v_tag);

  INSERT INTO public.children (full_name, school_id, parent_id, is_active)
  VALUES (v_tag || ' Uno', c_school, v_owner, true) RETURNING id INTO v_c1;
  INSERT INTO public.enrollments (school_id, child_id, team_id, offering_plan_id, status, monthly_fee, start_date, expires_at)
  VALUES (c_school, v_c1, v_team, v_plan, 'active', v_price, v_today, v_today + 10) RETURNING id INTO v_e1;
  v_a1 := jsonb_build_object('type', 'child', 'id', v_c1);

  -- ── Descuento 10 % a una línea nueva ──────────────────────────────────────
  v_res := pg_temp.op(v_owner, v_a1, jsonb_build_array(jsonb_build_object(
             'idx', 0, 'category', 'torneo', 'amount', 80000, 'due_date', v_today + 5, 'concept', 'Copa ' || v_tag,
             'discount', jsonb_build_object('basis', 'porcentaje', 'value', 10, 'reason_code', 'convenio'))));
  v_p := (v_res->'payment_ids'->>0)::uuid;
  SELECT * INTO v_row FROM public.payments WHERE id = v_p;
  IF v_row.list_amount <> 80000 OR v_row.amount <> 72000 OR v_row.discount_amount <> 8000
     OR (SELECT count(*) FROM public.payment_adjustments WHERE payment_id = v_p) <> 1 THEN
    RAISE EXCEPTION 'ASSERT descuento 10 %%: % / % / %', v_row.list_amount, v_row.amount, v_row.discount_amount;
  END IF;

  -- ── Revertir → 80.000; dos veces → YA_REVERTIDO ───────────────────────────
  SELECT id INTO v_adj FROM public.payment_adjustments WHERE payment_id = v_p;
  v_res := public.revert_payment_adjustment(c_school, v_owner, v_adj, 'prueba de reversión');
  IF (SELECT amount FROM public.payments WHERE id = v_p) <> 80000
     OR (SELECT discount_amount FROM public.payments WHERE id = v_p) <> 0 THEN
    RAISE EXCEPTION 'ASSERT revertir: %', v_res;
  END IF;
  PERFORM pg_temp.espera_error(format('SELECT public.revert_payment_adjustment(%L, %L, %L, ''otra vez'')',
                                      c_school, v_owner, v_adj), 'YA_REVERTIDO');

  -- ── Exonerar el torneo pendiente → cancelled ─────────────────────────────
  v_res := pg_temp.op(v_owner, v_a1, '[]', jsonb_build_array(pg_temp.pend(v_p,
             jsonb_build_object('exonerate', jsonb_build_object('reason_text', 'cortesía del club')))));
  IF (SELECT status FROM public.payments WHERE id = v_p) <> 'cancelled'
     OR (SELECT rejection_reason FROM public.payments WHERE id = v_p) NOT LIKE 'Exonerado:%'
     OR NOT EXISTS (SELECT 1 FROM public.payment_adjustments WHERE payment_id = v_p AND kind = 'exoneracion') THEN
    RAISE EXCEPTION 'ASSERT exonerar torneo';
  END IF;

  -- ── Abono 300.000 de 350.000 → partial + installment; descuento a 250.000 → excede ──
  v_res := pg_temp.op(v_owner, v_a1, jsonb_build_array(jsonb_build_object(
             'idx', 0, 'category', 'viaje', 'amount', 350000, 'due_date', v_today + 5, 'concept', 'Viaje ' || v_tag)));
  v_q := (v_res->'payment_ids'->>0)::uuid;
  v_res := pg_temp.op(v_owner, v_a1, '[]', jsonb_build_array(pg_temp.pend(v_q,
             jsonb_build_object('pay_amount', 300000, 'close_mode', 'abono'))), NULL, v_cash);
  IF (SELECT status FROM public.payments WHERE id = v_q) <> 'partial'
     OR (SELECT amount_paid FROM public.payments WHERE id = v_q) <> 300000
     OR NOT EXISTS (SELECT 1 FROM public.payment_installments
                     WHERE payment_id = v_q AND status = 'approved' AND amount = 300000) THEN
    RAISE EXCEPTION 'ASSERT abono';
  END IF;
  PERFORM pg_temp.espera_error(format('SELECT pg_temp.op(%L, %L, ''[]'', %L)', v_owner, v_a1,
            jsonb_build_array(pg_temp.pend(v_q, jsonb_build_object('discount',
              jsonb_build_object('basis', 'valor', 'value', 100000, 'reason_code', 'beca'))))), 'DESCUENTO_EXCEDE');

  -- ── Cerrar con descuento: recibe 40.000 del saldo 50.000 → paid, amount = amount_paid ──
  v_res := pg_temp.op(v_owner, v_a1, '[]', jsonb_build_array(pg_temp.pend(v_q, jsonb_build_object(
             'pay_amount', 40000, 'close_mode', 'cerrar',
             'discount', jsonb_build_object('reason_code', 'pronto_pago')))), NULL, v_cash);
  SELECT * INTO v_row FROM public.payments WHERE id = v_q;
  IF v_row.status <> 'paid' OR v_row.amount <> v_row.amount_paid OR v_row.amount <> 340000 THEN
    RAISE EXCEPTION 'ASSERT cerrar con descuento: % % %', v_row.status, v_row.amount, v_row.amount_paid;
  END IF;

  -- ── Mensualidad vencida con recargo ───────────────────────────────────────
  v_res := pg_temp.op(v_owner, v_a1, jsonb_build_array(jsonb_build_object(
             'idx', 0, 'category', 'mensualidad', 'due_date', v_today, 'concept', 'Mensualidad',
             'period', jsonb_build_object('year', extract(year FROM v_m1), 'month', extract(month FROM v_m1)))));
  v_r := (v_res->'payment_ids'->>0)::uuid;
  -- Lo mismo que hace apply_late_fees (amount y late_fee_amount suben juntos).
  UPDATE public.payments SET late_fee_amount = late_fee_amount + 8000, amount = amount + 8000,
         late_fee_applied_at = now(), status = 'overdue' WHERE id = v_r;
  -- Un descuento no se come el recargo.
  PERFORM pg_temp.espera_error(format('SELECT pg_temp.op(%L, %L, ''[]'', %L)', v_owner, v_a1,
            jsonb_build_array(pg_temp.pend(v_r, jsonb_build_object('discount',
              jsonb_build_object('basis', 'valor', 'value', v_price + 1, 'reason_code', 'beca'))))), 'DESCUENTO_EXCEDE');
  -- Condonar todo el recargo.
  v_res := pg_temp.op(v_owner, v_a1, '[]', jsonb_build_array(pg_temp.pend(v_r, jsonb_build_object(
             'waive_late_fee', jsonb_build_object('reason_text', 'se le perdona la mora')))));
  SELECT * INTO v_row FROM public.payments WHERE id = v_r;
  IF v_row.late_fee_amount <> 0 OR v_row.late_fee_waived_amount <> 8000 OR v_row.amount <> v_price
     OR v_row.late_fee_applied_at IS NULL THEN
    RAISE EXCEPTION 'ASSERT condonar recargo: % % %', v_row.late_fee_amount, v_row.late_fee_waived_amount, v_row.amount;
  END IF;

  -- ── Vista previa vieja (seen) → PREVIEW_STALE ─────────────────────────────
  PERFORM pg_temp.espera_error(format('SELECT pg_temp.op(%L, %L, ''[]'', %L)', v_owner, v_a1,
            jsonb_build_array(jsonb_build_object('payment_id', v_r,
              'seen', jsonb_build_object('amount', v_price + 8000, 'amount_paid', 0),
              'discount', jsonb_build_object('basis', 'porcentaje', 'value', 5, 'reason_code', 'beca')))), 'PREVIEW_STALE');

  -- ── Enlace de pago vigente → PAGO_EN_CURSO ────────────────────────────────
  INSERT INTO public.payment_links (payment_id, school_id, token, gross_amount, base_amount, status, expires_at)
  VALUES (v_r, c_school, 'smoke-' || v_tag, v_price, v_price, 'pending', now() + interval '1 day');
  PERFORM pg_temp.espera_error(format('SELECT pg_temp.op(%L, %L, ''[]'', %L)', v_owner, v_a1,
            jsonb_build_array(pg_temp.pend(v_r, jsonb_build_object('discount',
              jsonb_build_object('basis', 'porcentaje', 'value', 5, 'reason_code', 'beca'))))), 'PAGO_EN_CURSO');
  UPDATE public.payment_links SET status = 'expired' WHERE payment_id = v_r;

  -- ── awaiting_approval → EN_REVISION ───────────────────────────────────────
  UPDATE public.payments SET status = 'awaiting_approval' WHERE id = v_r;
  PERFORM pg_temp.espera_error(format('SELECT pg_temp.op(%L, %L, ''[]'', %L)', v_owner, v_a1,
            jsonb_build_array(pg_temp.pend(v_r, jsonb_build_object('discount',
              jsonb_build_object('basis', 'porcentaje', 'value', 5, 'reason_code', 'beca'))))), 'EN_REVISION');
  UPDATE public.payments SET status = 'overdue' WHERE id = v_r;

  -- ── Exonerar mensualidad (beca) → paid $0, vigencia, open_month no la reemite ──
  SELECT expires_at INTO v_exp FROM public.enrollments WHERE id = v_e1;
  v_res := pg_temp.op(v_owner, v_a1, jsonb_build_array(jsonb_build_object(
             'idx', 0, 'category', 'mensualidad', 'due_date', v_today + 5, 'concept', 'Mensualidad',
             'period', jsonb_build_object('year', extract(year FROM v_m2), 'month', extract(month FROM v_m2)),
             'exonerate', jsonb_build_object('reason_text', 'beca deportiva del mes'))));
  v_p := (v_res->'payment_ids'->>0)::uuid;
  SELECT * INTO v_row FROM public.payments WHERE id = v_p;
  IF v_row.status <> 'paid' OR v_row.amount <> 0 OR v_row.discount_amount <> v_row.list_amount
     OR v_row.payment_channel <> 'exoneracion' THEN
    RAISE EXCEPTION 'ASSERT beca: % % %', v_row.status, v_row.amount, v_row.payment_channel;
  END IF;
  IF (SELECT expires_at FROM public.enrollments WHERE id = v_e1) IS NOT DISTINCT FROM v_exp THEN
    RAISE EXCEPTION 'ASSERT beca: la vigencia no se extendió';
  END IF;
  PERFORM public.open_month(c_school, extract(year FROM v_m2)::int, extract(month FROM v_m2)::int, NULL);
  SELECT count(*) INTO v_n FROM public.payments
   WHERE child_id = v_c1 AND period_year = extract(year FROM v_m2) AND period_month = extract(month FROM v_m2)
     AND status <> 'cancelled';
  IF v_n <> 1 THEN RAISE EXCEPTION 'ASSERT beca: open_month reemitió (% filas)', v_n; END IF;

  -- ── Descuento general por valor: resto mayor, suma exacta ────────────────
  v_res := pg_temp.op(v_owner, v_a1, jsonb_build_array(
             jsonb_build_object('idx', 0, 'category', 'otro', 'amount', 100000, 'due_date', v_today + 5, 'concept', 'A ' || v_tag),
             jsonb_build_object('idx', 1, 'category', 'otro', 'amount', 200000, 'due_date', v_today + 5, 'concept', 'B ' || v_tag),
             jsonb_build_object('idx', 2, 'category', 'otro', 'amount', 300000, 'due_date', v_today + 5, 'concept', 'C ' || v_tag)),
           '[]', jsonb_build_object('basis', 'valor', 'value', 10000, 'reason_code', 'varios_meses',
                                    'line_refs', jsonb_build_array('new:0', 'new:1', 'new:2')));
  SELECT count(*), sum(a.amount) INTO v_n, v_amt FROM public.payment_adjustments a
   WHERE a.charge_batch_id = (v_res->>'batch_id')::uuid AND a.scope = 'general';
  IF v_n <> 3 OR v_amt <> 10000 THEN RAISE EXCEPTION 'ASSERT descuento general: % partes por %', v_n, v_amt; END IF;

  -- ── T29: militar (1) + hermanos (2) desde open_month + modal (3), secuenciales ──
  UPDATE public.school_settings SET sibling_discount_enabled = true, sibling_discount_percentage = 10
   WHERE school_id = c_school;
  v_fee := round(v_price * 0.9);
  INSERT INTO public.children (full_name, school_id, parent_id, is_active)
  VALUES (v_tag || ' Mayor', c_school, v_owner, true) RETURNING id INTO v_c2;
  INSERT INTO public.enrollments (school_id, child_id, team_id, offering_plan_id, status, monthly_fee, start_date, created_at)
  VALUES (c_school, v_c2, v_team, v_plan, 'active', v_price, v_today, now() - interval '1 hour') RETURNING id INTO v_e2;
  INSERT INTO public.children (full_name, school_id, parent_id, is_active)
  VALUES (v_tag || ' Menor', c_school, v_owner, true) RETURNING id INTO v_c3;
  INSERT INTO public.enrollments (school_id, child_id, team_id, offering_plan_id, status, monthly_fee, start_date,
                                  fee_reason, fee_discount_origin, fee_discount_pct)
  VALUES (c_school, v_c3, v_team, v_plan, 'active', v_fee, v_today, 'Descuento Fuerza Militar 10%', 'militar', 10)
  RETURNING id INTO v_e3;
  PERFORM public.open_month(c_school, extract(year FROM v_m1)::int, extract(month FROM v_m1)::int, NULL);
  SELECT * INTO v_row FROM public.payments
   WHERE child_id = v_c3 AND period_year = extract(year FROM v_m1) AND period_month = extract(month FROM v_m1);
  v_sib := round(v_fee * 0.10);
  IF v_row.list_amount <> v_price OR v_row.discount_amount <> (v_price - v_fee) + v_sib
     OR (SELECT string_agg(origin, ',' ORDER BY sequence) FROM public.payment_adjustments WHERE payment_id = v_row.id)
        <> 'militar,hermanos' THEN
    RAISE EXCEPTION 'ASSERT T29 automáticos: list % disc % ajustes %', v_row.list_amount, v_row.discount_amount,
      (SELECT string_agg(origin, ',' ORDER BY sequence) FROM public.payment_adjustments WHERE payment_id = v_row.id);
  END IF;
  v_a3 := jsonb_build_object('type', 'child', 'id', v_c3);
  v_amt := v_row.amount;
  v_res := pg_temp.op(v_owner, v_a3, '[]', jsonb_build_array(pg_temp.pend(v_row.id, jsonb_build_object('discount',
             jsonb_build_object('basis', 'porcentaje', 'value', 10, 'reason_code', 'convenio')))));
  IF (SELECT amount FROM public.payments WHERE id = v_row.id) <> v_amt - round(v_amt * 0.10)
     OR (SELECT string_agg(origin, ',' ORDER BY sequence) FROM public.payment_adjustments WHERE payment_id = v_row.id)
        <> 'militar,hermanos,modal' THEN
    RAISE EXCEPTION 'ASSERT T29 modal secuencial';
  END IF;

  -- ── Invariante en TODAS las filas de Campestre ───────────────────────────
  SELECT count(*) INTO v_n FROM public.payments
   WHERE school_id = c_school AND list_amount IS NOT NULL
     AND amount <> list_amount - discount_amount + late_fee_amount;
  IF v_n > 0 THEN RAISE EXCEPTION 'ASSERT invariante: % filas lo violan', v_n; END IF;
  -- Caché = suma de ajustes vigentes (descuento/exoneración de monto, menos reversiones).
  SELECT count(*) INTO v_n FROM public.payments p
   WHERE p.school_id = c_school AND p.discount_amount <> COALESCE((
         SELECT sum(CASE WHEN a.kind = 'reversion' THEN -a.amount ELSE a.amount END)
           FROM public.payment_adjustments a
          WHERE a.payment_id = p.id AND a.applies_to = 'monto'
            AND (a.kind IN ('descuento', 'exoneracion')
                 OR (a.kind = 'reversion' AND (SELECT r.kind FROM public.payment_adjustments r WHERE r.id = a.reverts_id)
                                              IN ('descuento', 'exoneracion')))
            AND NOT (a.kind = 'exoneracion' AND p.status = 'cancelled')), 0);
  IF v_n > 0 THEN RAISE EXCEPTION 'ASSERT caché discount_amount: % filas no cuadran', v_n; END IF;

  RAISE NOTICE 'payment_adjustments_smoke: OK';
END $$;

-- ── MEDICIÓN (opcional): open_month de Campestre con y sin el trigger M4 ────
-- \timing on
-- SAVEPOINT m1; SELECT public.open_month('25a123f0-6d57-48a4-9800-7b1531d61cd2', 2026, 12, NULL); ROLLBACK TO m1;
-- ALTER TABLE public.payments DISABLE TRIGGER trg_zzz_payments_descuentos_automaticos;
-- ALTER TABLE public.payments DISABLE TRIGGER trg_payments_descuentos_automaticos;
-- SAVEPOINT m2; SELECT public.open_month('25a123f0-6d57-48a4-9800-7b1531d61cd2', 2026, 12, NULL); ROLLBACK TO m2;
-- (el ROLLBACK final deshace también el DISABLE TRIGGER). Objetivo: ≤ +10 %.

ROLLBACK;
