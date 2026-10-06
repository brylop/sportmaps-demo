-- ============================================================
-- SMOKE TEST — F-E cargo por horas de más (migración 20261005214302).
-- NO es una migración. Requiere aplicadas, en orden:
--   1) la migración de F-A ('excedente' en payments_payment_category_check,
--      índices _per_adult/_per_unreg con NOT period_uniqueness_exempt,
--      fn_extend_enrollment_on_payment_paid ignorando 'excedente');
--   2) 20261005214302_hour_bank_overage_charges.sql.
--
--   psql "$DATABASE_URL" -f supabase/migrations/_smoke/hour_bank_overage_smoke.sql
--
-- Arma sus propios datos (dos escuelas reales cualesquiera con owner y una
-- oferta; planes, atletas, inscripciones, periodos y mensualidades de prueba)
-- y termina en ROLLBACK: no persiste nada. Cada assert hace RAISE EXCEPTION.
-- Ojo: la escuela A queda con el flag prendido SOLO dentro de la transacción.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _ctx (k text PRIMARY KEY, v uuid);

DO $$
DECLARE
  v_a uuid; v_owner_a uuid; v_off_a uuid;
  v_b uuid; v_owner_b uuid; v_off_b uuid;
  v_plan_a uuid; v_plan_b uuid;
  v_child uuid; v_ua uuid; v_ua_b uuid;
  v_e_child uuid; v_e_adult uuid; v_e_ua uuid; v_e_b uuid;
  v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_prev  date := (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date) - interval '1 month')::date;
  v_prev2 date := (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date) - interval '2 month')::date;
  v_p uuid;
  v_tag text := 'SMOKE FE ' || substr(md5(random()::text), 1, 8);
BEGIN
  SELECT s.id, s.owner_id, o.id INTO v_a, v_owner_a, v_off_a
    FROM public.schools s JOIN public.offerings o ON o.school_id = s.id
   WHERE s.owner_id IS NOT NULL
   ORDER BY s.created_at LIMIT 1;
  SELECT s.id, s.owner_id, o.id INTO v_b, v_owner_b, v_off_b
    FROM public.schools s JOIN public.offerings o ON o.school_id = s.id
   WHERE s.owner_id IS NOT NULL AND s.id <> v_a
   ORDER BY s.created_at LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL THEN RAISE EXCEPTION 'SETUP: faltan dos escuelas con owner y oferta'; END IF;

  -- Flags: A prendida (hour_up), B con banco de horas pero SIN cargos.
  UPDATE public.school_settings SET hours_plan_enabled = true, hour_bank_overage_charges_enabled = true,
         hours_billing_rounding = 'hour_up' WHERE school_id = v_a;
  IF NOT FOUND THEN
    INSERT INTO public.school_settings (school_id, hours_plan_enabled, hour_bank_overage_charges_enabled, hours_billing_rounding)
    VALUES (v_a, true, true, 'hour_up');
  END IF;
  UPDATE public.school_settings SET hours_plan_enabled = true, hour_bank_overage_charges_enabled = false
   WHERE school_id = v_b;
  IF NOT FOUND THEN
    INSERT INTO public.school_settings (school_id, hours_plan_enabled, hour_bank_overage_charges_enabled)
    VALUES (v_b, true, false);
  END IF;

  INSERT INTO public.offering_plans (offering_id, school_id, name, price, included_minutes_per_period)
  VALUES (v_off_a, v_a, v_tag || ' plan', 353000, 960) RETURNING id INTO v_plan_a;
  INSERT INTO public.offering_plans (offering_id, school_id, name, price, included_minutes_per_period)
  VALUES (v_off_b, v_b, v_tag || ' plan B', 353000, 960) RETURNING id INTO v_plan_b;

  INSERT INTO public.children (full_name, parent_id) VALUES (v_tag || ' menor', v_owner_a) RETURNING id INTO v_child;
  INSERT INTO public.unregistered_athletes (school_id, full_name) VALUES (v_a, v_tag || ' no registrado') RETURNING id INTO v_ua;
  INSERT INTO public.unregistered_athletes (school_id, full_name) VALUES (v_b, v_tag || ' no registrado B') RETURNING id INTO v_ua_b;

  INSERT INTO public.enrollments (school_id, child_id, offering_plan_id, status, expires_at)
  VALUES (v_a, v_child, v_plan_a, 'active', v_today + 10) RETURNING id INTO v_e_child;
  INSERT INTO public.enrollments (school_id, user_id, offering_plan_id, status, expires_at)
  VALUES (v_a, v_owner_a, v_plan_a, 'active', v_today + 10) RETURNING id INTO v_e_adult;
  INSERT INTO public.enrollments (school_id, unregistered_athlete_id, offering_plan_id, status, expires_at)
  VALUES (v_a, v_ua, v_plan_a, 'active', v_today + 10) RETURNING id INTO v_e_ua;
  INSERT INTO public.enrollments (school_id, unregistered_athlete_id, offering_plan_id, status, expires_at)
  VALUES (v_b, v_ua_b, v_plan_b, 'active', v_today + 10) RETURNING id INTO v_e_b;

  -- Mensualidad activa del mes anterior para cada atleta de A (el cobro de
  -- horas tiene que convivir con ella sin 23505).
  INSERT INTO public.payments (school_id, parent_id, child_id, offering_plan_id, concept, amount, due_date, status, payment_type, payment_category, period_year, period_month)
  VALUES (v_a, v_owner_a, v_child, v_plan_a, v_tag || ' mensualidad', 353000, v_prev, 'pending', 'subscription', 'mensualidad',
          extract(year FROM v_prev)::smallint, extract(month FROM v_prev)::smallint);
  INSERT INTO public.payments (school_id, user_id, offering_plan_id, concept, amount, due_date, status, payment_type, payment_category, period_year, period_month)
  VALUES (v_a, v_owner_a, v_plan_a, v_tag || ' mensualidad', 353000, v_prev, 'pending', 'subscription', 'mensualidad',
          extract(year FROM v_prev)::smallint, extract(month FROM v_prev)::smallint);
  INSERT INTO public.payments (school_id, unregistered_athlete_id, offering_plan_id, concept, amount, due_date, status, payment_type, payment_category, period_year, period_month)
  VALUES (v_a, v_ua, v_plan_a, v_tag || ' mensualidad', 353000, v_prev, 'pending', 'subscription', 'mensualidad',
          extract(year FROM v_prev)::smallint, extract(month FROM v_prev)::smallint);

  -- Periodos cerrados del mes anterior: 2071 consumidos de 960 (= Dreamers ago-2026).
  INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes, consumed_minutes)
  VALUES (v_e_child, v_a, v_prev, (v_prev + interval '1 month' - interval '1 day')::date, 960, 2071) RETURNING id INTO v_p;
  INSERT INTO _ctx VALUES ('p_child', v_p);
  INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes, consumed_minutes)
  VALUES (v_e_adult, v_a, v_prev, (v_prev + interval '1 month' - interval '1 day')::date, 960, 2071) RETURNING id INTO v_p;
  INSERT INTO _ctx VALUES ('p_adult', v_p);
  INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes, consumed_minutes)
  VALUES (v_e_ua, v_a, v_prev, (v_prev + interval '1 month' - interval '1 day')::date, 960, 2071) RETURNING id INTO v_p;
  INSERT INTO _ctx VALUES ('p_ua', v_p);
  -- Periodo de hace dos meses con una visita esperando revisión → se salta.
  INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes, consumed_minutes)
  VALUES (v_e_child, v_a, v_prev2, (v_prev2 + interval '1 month' - interval '1 day')::date, 960, 2071) RETURNING id INTO v_p;
  INSERT INTO _ctx VALUES ('p_review', v_p);
  INSERT INTO public.hour_bank_visits (school_id, enrollment_id, period_id, status, started_at)
  VALUES (v_a, v_e_child, v_p, 'pending_review', v_prev2 + interval '10 hours');
  -- Periodo de la escuela B (flag apagado) → nada.
  INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes, consumed_minutes)
  VALUES (v_e_b, v_b, v_prev, (v_prev + interval '1 month' - interval '1 day')::date, 960, 2071) RETURNING id INTO v_p;
  INSERT INTO _ctx VALUES ('p_b', v_p);

  INSERT INTO _ctx VALUES ('school_a', v_a), ('owner_a', v_owner_a), ('e_child', v_e_child);
END $$;

-- ── 1) Generar dos veces → una fila por periodo; review y escuela B saltados ─
DO $$
DECLARE v_n int; v_r1 jsonb; v_r2 jsonb; v_row record;
BEGIN
  v_r1 := public.generate_hour_bank_overage_suggestions();
  v_r2 := public.generate_hour_bank_overage_suggestions();

  SELECT count(*) INTO v_n FROM public.hour_bank_overage_charges
   WHERE period_id IN (SELECT v FROM _ctx WHERE k IN ('p_child','p_adult','p_ua'));
  IF v_n <> 3 THEN RAISE EXCEPTION 'FAIL generar: % filas (esperaba 3) r1=% r2=%', v_n, v_r1, v_r2; END IF;

  SELECT count(*) INTO v_n FROM public.hour_bank_overage_charges
   WHERE period_id = (SELECT v FROM _ctx WHERE k = 'p_review');
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL: periodo con visita pending_review generó sugerencia'; END IF;

  SELECT count(*) INTO v_n FROM public.hour_bank_overage_charges
   WHERE period_id = (SELECT v FROM _ctx WHERE k = 'p_b');
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL: escuela con flag apagado generó sugerencia'; END IF;

  SELECT * INTO v_row FROM public.hour_bank_overage_charges
   WHERE period_id = (SELECT v FROM _ctx WHERE k = 'p_child');
  IF v_row.overage_minutes <> 1111 OR v_row.billable_hours <> 19 OR v_row.hourly_rate <> 22062.5
     OR v_row.amount <> 419188 OR v_row.status <> 'suggested' THEN
    RAISE EXCEPTION 'FAIL monto: % min, % h × % = % (%)', v_row.overage_minutes, v_row.billable_hours,
      v_row.hourly_rate, v_row.amount, v_row.status;
  END IF;

  SELECT count(*) INTO v_n FROM public.notifications
   WHERE type = 'hour_bank_overage_charge'
     AND (data->>'period_id')::uuid IN (SELECT v FROM _ctx WHERE k IN ('p_child','p_adult','p_ua'));
  IF v_n <> 3 THEN RAISE EXCEPTION 'FAIL avisos: % (esperaba 3, uno por fila nueva)', v_n; END IF;
  RAISE NOTICE 'OK 1 generar idempotente (r1=%, r2=%)', v_r1, v_r2;
END $$;

-- ── 2) Recalcular una sugerida tras corrección ───────────────────────────────
DO $$
DECLARE v_p uuid := (SELECT v FROM _ctx WHERE k = 'p_child'); v_amount numeric; v_res jsonb;
BEGIN
  UPDATE public.hour_bank_periods SET consumed_minutes = 1000 WHERE id = v_p;   -- 40 min → 1 h
  v_res := public.recompute_hour_bank_overage(v_p);
  SELECT amount INTO v_amount FROM public.hour_bank_overage_charges WHERE period_id = v_p;
  IF v_amount <> 22063 THEN RAISE EXCEPTION 'FAIL recompute: % (esperaba 22063) %', v_amount, v_res; END IF;
  UPDATE public.hour_bank_periods SET consumed_minutes = 2071 WHERE id = v_p;
  PERFORM public.recompute_hour_bank_overage(v_p);
  RAISE NOTICE 'OK 2 recompute en sitio';
END $$;

-- ── 3) Confirmar dos veces → segunda not_suggested; cobro bien armado ────────
DO $$
DECLARE
  v_id uuid; v_r1 jsonb; v_r2 jsonb; v_pay record;
  v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_prev  date := (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date) - interval '1 month')::date;
BEGIN
  SELECT id INTO v_id FROM public.hour_bank_overage_charges WHERE period_id = (SELECT v FROM _ctx WHERE k = 'p_child');
  v_r1 := public.confirm_hour_bank_overage(v_id, (SELECT v FROM _ctx WHERE k = 'owner_a'));
  v_r2 := public.confirm_hour_bank_overage(v_id, (SELECT v FROM _ctx WHERE k = 'owner_a'));
  IF v_r1->>'payment_id' IS NULL THEN RAISE EXCEPTION 'FAIL confirm 1: %', v_r1; END IF;
  IF v_r2->>'error' IS DISTINCT FROM 'not_suggested' THEN RAISE EXCEPTION 'FAIL confirm 2: %', v_r2; END IF;

  SELECT * INTO v_pay FROM public.payments WHERE id = (v_r1->>'payment_id')::uuid;
  IF v_pay.amount <> 419188 OR v_pay.payment_category <> 'excedente' OR v_pay.offering_plan_id IS NOT NULL
     OR NOT v_pay.period_uniqueness_exempt OR v_pay.status <> 'pending' OR v_pay.payment_type <> 'one_time'
     OR v_pay.due_date <> v_today + 5
     OR v_pay.period_year <> extract(year FROM v_prev) OR v_pay.period_month <> extract(month FROM v_prev)
     OR v_pay.parent_id IS DISTINCT FROM (SELECT v FROM _ctx WHERE k = 'owner_a')
     OR v_pay.concept NOT LIKE 'Horas por encima del plan — % — 19 h × $22.062,5' THEN
    RAISE EXCEPTION 'FAIL cobro: %', row_to_json(v_pay);
  END IF;
  IF (SELECT status FROM public.hour_bank_overage_charges WHERE id = v_id) <> 'confirmed' THEN
    RAISE EXCEPTION 'FAIL: la sugerencia no quedó confirmed';
  END IF;

  -- Una confirmada no se recalcula.
  UPDATE public.hour_bank_periods SET consumed_minutes = 1000 WHERE id = (SELECT v FROM _ctx WHERE k = 'p_child');
  PERFORM public.recompute_hour_bank_overage((SELECT v FROM _ctx WHERE k = 'p_child'));
  IF (SELECT amount FROM public.hour_bank_overage_charges WHERE id = v_id) <> 419188 THEN
    RAISE EXCEPTION 'FAIL: recompute tocó una confirmada';
  END IF;

  INSERT INTO _ctx VALUES ('pay_child', (v_r1->>'payment_id')::uuid);
  RAISE NOTICE 'OK 3 confirmar (menor) + doble confirmación bloqueada';
END $$;

-- ── 4) Adulto y no registrado con mensualidad del mismo mes: sin 23505 ───────
DO $$
DECLARE v_r jsonb; v_k text;
BEGIN
  FOREACH v_k IN ARRAY ARRAY['p_adult', 'p_ua'] LOOP
    v_r := public.confirm_hour_bank_overage(
      (SELECT id FROM public.hour_bank_overage_charges WHERE period_id = (SELECT v FROM _ctx WHERE k = v_k)),
      (SELECT v FROM _ctx WHERE k = 'owner_a'));
    IF v_r->>'payment_id' IS NULL THEN RAISE EXCEPTION 'FAIL confirm %: %', v_k, v_r; END IF;
  END LOOP;
  RAISE NOTICE 'OK 4 adulto y no registrado conviven con la mensualidad';
END $$;

-- ── 5) Pagar el excedente NO extiende la vigencia ────────────────────────────
DO $$
DECLARE v_before date; v_after date;
BEGIN
  SELECT expires_at INTO v_before FROM public.enrollments WHERE id = (SELECT v FROM _ctx WHERE k = 'e_child');
  UPDATE public.payments SET status = 'paid', payment_date = current_date
   WHERE id = (SELECT v FROM _ctx WHERE k = 'pay_child');
  SELECT expires_at INTO v_after FROM public.enrollments WHERE id = (SELECT v FROM _ctx WHERE k = 'e_child');
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'FAIL: pagar el excedente movió expires_at % → %', v_before, v_after;
  END IF;
  RAISE NOTICE 'OK 5 excedente pagado no extiende expires_at';
END $$;

-- ── 6) B7: /facturar-fuera-de-plan idempotente por índice ────────────────────
DO $$
DECLARE v_child uuid; v_a uuid := (SELECT v FROM _ctx WHERE k = 'school_a'); v_dup boolean := false;
BEGIN
  SELECT child_id INTO v_child FROM public.enrollments WHERE id = (SELECT v FROM _ctx WHERE k = 'e_child');
  INSERT INTO public.payments (school_id, child_id, concept, amount, due_date, status, payment_type, payment_category, period_uniqueness_exempt, period_year, period_month)
  VALUES (v_a, v_child, 'Clases por encima del plan — Smoke — 2 clases × $10.000', 20000, current_date, 'pending', 'one_time', 'excedente', true, 2026, 1);
  BEGIN
    INSERT INTO public.payments (school_id, child_id, concept, amount, due_date, status, payment_type, payment_category, period_uniqueness_exempt, period_year, period_month)
    VALUES (v_a, v_child, 'Clases por encima del plan — Smoke — 2 clases × $10.000', 20000, current_date, 'pending', 'one_time', 'excedente', true, 2026, 1);
  EXCEPTION WHEN unique_violation THEN v_dup := true;
  END;
  IF NOT v_dup THEN RAISE EXCEPTION 'FAIL B7: el segundo cobro de clases fuera de plan entró'; END IF;
  -- El otro motivo del mismo mes sí convive.
  INSERT INTO public.payments (school_id, child_id, concept, amount, due_date, status, payment_type, payment_category, period_uniqueness_exempt, period_year, period_month)
  VALUES (v_a, v_child, 'Clases sin plan vigente — Smoke — 1 clase × $10.000', 10000, current_date, 'pending', 'one_time', 'excedente', true, 2026, 1);
  RAISE NOTICE 'OK 6 B7 cerrado por índice';
END $$;

ROLLBACK;
