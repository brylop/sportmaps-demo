-- ============================================================
-- SMOKE TEST — «Cobros y pagos» F1: lotes (spec cobros-multiples §7.6, §12 F1).
-- NO es una migración. Requiere aplicadas, en orden, las 9 migraciones
-- 20261010144551 … 20261010144600 (cobros_f1_*), y F0 (20261010143132).
--
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/_smoke/charge_batches_smoke.sql
--
-- SOLO Club Campestre Demo (25a123f0-6d57-48a4-9800-7b1531d61cd2). Arma sus
-- propios atletas, inscripciones y excedente DENTRO de Campestre y termina en
-- ROLLBACK: no persiste nada. Cada assert hace RAISE EXCEPTION.
-- Casos: lote 2 atletas × 3 líneas (T1); mismo client_request_id → duplicated
-- (T4); mensualidad / seguro / misma línea → omitidos (T2, T3); 1 aviso in-app
-- sin push por familia (T5); excedente suggested → confirmed y anular → vuelve
-- a suggested (T10); pagar un torneo → expires_at igual; PREVIEW_STALE;
-- MULTI_NO_PAGA; coach → FORBIDDEN (T11); cobro sin atleta (T34).
-- Al final, bloque opcional de MEDICIÓN de un lote de 600 filas (comentado).
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

-- Asserts de error: ejecuta el SQL y exige que falle con ese código.
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

CREATE TEMP TABLE _ctx (k text PRIMARY KEY, v text);

DO $$
DECLARE
  c_school constant uuid := '25a123f0-6d57-48a4-9800-7b1531d61cd2';
  v_owner   uuid;
  v_plan    uuid;
  v_team    uuid;
  v_c1 uuid; v_c2 uuid; v_e1 uuid; v_e2 uuid;
  v_today   date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_mes     date := (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date) + interval '2 months')::date;
  v_tag     text := 'SMOKE CB ' || substr(md5(random()::text), 1, 6);
  v_ath     jsonb;
  v_lines   jsonb;
  v_prev    jsonb;
  v_res     jsonb;
  v_res2    jsonb;
  v_batch   uuid;
  v_n       int;
  v_notif0  int;
  v_per     uuid;
  v_ov      uuid;
  v_exp     date;
  v_pid     uuid;
  v_coach   uuid;
BEGIN
  -- Guardia: solo Campestre.
  SELECT owner_id INTO v_owner FROM public.schools
   WHERE id = c_school AND name = 'Club Campestre Demo';
  IF v_owner IS NULL THEN RAISE EXCEPTION 'SETUP: Club Campestre Demo no existe o no tiene owner'; END IF;

  SELECT op.id INTO v_plan FROM public.offering_plans op
   WHERE op.school_id = c_school AND op.price > 0 ORDER BY op.created_at LIMIT 1;
  SELECT t.id INTO v_team FROM public.teams t WHERE t.school_id = c_school ORDER BY t.created_at LIMIT 1;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'SETUP: Campestre sin plan con precio'; END IF;

  -- Dos atletas propios (acudiente = el owner, para que haya a quién avisar).
  INSERT INTO public.children (full_name, school_id, parent_id, is_active)
  VALUES (v_tag || ' Uno', c_school, v_owner, true) RETURNING id INTO v_c1;
  INSERT INTO public.children (full_name, school_id, parent_id, is_active)
  VALUES (v_tag || ' Dos', c_school, v_owner, true) RETURNING id INTO v_c2;
  INSERT INTO public.enrollments (school_id, child_id, team_id, offering_plan_id, status, monthly_fee, start_date, expires_at)
  VALUES (c_school, v_c1, v_team, v_plan, 'active', 160000, v_today, v_today + 10) RETURNING id INTO v_e1;
  INSERT INTO public.enrollments (school_id, child_id, team_id, offering_plan_id, status, monthly_fee, start_date, expires_at)
  VALUES (c_school, v_c2, v_team, v_plan, 'active', 160000, v_today, v_today + 10) RETURNING id INTO v_e2;

  v_ath := jsonb_build_array(jsonb_build_object('type', 'child', 'id', v_c1),
                             jsonb_build_object('type', 'child', 'id', v_c2));
  v_lines := jsonb_build_array(
    jsonb_build_object('idx', 0, 'category', 'mensualidad', 'due_date', v_today + 5, 'concept', 'Mensualidad',
                       'period', jsonb_build_object('year', extract(year FROM v_mes), 'month', extract(month FROM v_mes))),
    jsonb_build_object('idx', 1, 'category', 'seguro', 'amount', 50000, 'due_date', v_today + 5, 'concept', 'Seguro ' || v_tag),
    jsonb_build_object('idx', 2, 'category', 'torneo', 'amount', 80000, 'due_date', v_today + 5, 'concept', 'Torneo ' || v_tag,
                       'notes', 'nota interna'));

  SELECT count(*) INTO v_notif0 FROM public.notifications WHERE user_id = v_owner;

  -- T1: vista previa y creación.
  v_prev := public.preview_charge_batch(c_school, v_owner, v_ath, v_lines, '[]', NULL, NULL, NULL, '[]', 'multi');
  IF (v_prev->>'rows_to_create')::int <> 6 OR jsonb_array_length(v_prev->'errors') <> 0 THEN
    RAISE EXCEPTION 'ASSERT T1 preview: %', v_prev;
  END IF;
  v_res := public.create_charge_batch(c_school, v_owner, gen_random_uuid(), 'multi',
             jsonb_build_object('kind', 'list', 'ids', '[]'::jsonb), v_ath, v_lines, '[]', false,
             v_prev->>'preview_hash');
  v_batch := (v_res->>'batch_id')::uuid;
  IF (v_res->>'rows_created')::int <> 6 OR (v_res->>'duplicated')::boolean THEN
    RAISE EXCEPTION 'ASSERT T1 create: %', v_res;
  END IF;
  SELECT count(*) INTO v_n FROM public.payments p
   WHERE p.charge_batch_id = v_batch AND p.created_by = v_owner AND p.payment_category IS NOT NULL
     AND p.status = 'pending'
     AND ((p.payment_category = 'mensualidad' AND p.offering_plan_id = v_plan AND NOT p.period_uniqueness_exempt
           AND p.payment_type = 'subscription' AND p.period_month = extract(month FROM v_mes)
           AND p.amount = 160000)
       OR (p.payment_category <> 'mensualidad' AND p.offering_plan_id IS NULL AND p.period_uniqueness_exempt
           AND p.payment_type = 'one_time'));
  IF v_n <> 6 THEN RAISE EXCEPTION 'ASSERT T1 filas: % de 6 con la forma de §6.4', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE charge_batch_id = v_batch AND notes = 'nota interna') THEN
    RAISE EXCEPTION 'ASSERT T1 nota';
  END IF;

  -- T5: un solo aviso in-app SIN push por familia; ningún «Nuevo cobro pendiente» por fila.
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE user_id = v_owner AND data->>'charge_batch_id' = v_batch::text AND push = false;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ASSERT T5 aviso agrupado: %', v_n; END IF;
  SELECT count(*) - v_notif0 INTO v_n FROM public.notifications WHERE user_id = v_owner;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ASSERT T5 notificaciones nuevas: % (esperado 1)', v_n; END IF;
  IF EXISTS (SELECT 1 FROM public.notification_deliveries d
               JOIN public.notifications n ON n.id = d.notification_id
              WHERE n.data->>'charge_batch_id' = v_batch::text) THEN
    RAISE EXCEPTION 'ASSERT T5: el aviso sin push se encoló para entrega externa';
  END IF;

  -- T4: mismo client_request_id → duplicated.
  v_res2 := public.create_charge_batch(c_school, v_owner, (SELECT client_request_id FROM public.charge_batches WHERE id = v_batch),
             'multi', '{}'::jsonb, v_ath, v_lines, '[]', false, 'cualquier-hash');
  IF NOT (v_res2->>'duplicated')::boolean OR (v_res2->>'batch_id')::uuid <> v_batch THEN
    RAISE EXCEPTION 'ASSERT T4: %', v_res2;
  END IF;

  -- T2/T3: segunda vista previa → todo omitido con su motivo.
  v_prev := public.preview_charge_batch(c_school, v_owner, v_ath, v_lines, '[]', NULL, NULL, NULL, '[]', 'multi');
  IF (v_prev->>'rows_to_create')::int <> 0
     OR (SELECT count(*) FROM jsonb_array_elements(v_prev->'skipped') s WHERE s->>'reason' = 'mensualidad_ya_existe') <> 2
     OR (SELECT count(*) FROM jsonb_array_elements(v_prev->'skipped') s WHERE s->>'reason' = 'seguro_en_12_meses') <> 2
     OR (SELECT count(*) FROM jsonb_array_elements(v_prev->'skipped') s WHERE s->>'reason' = 'misma_linea_hoy') <> 2 THEN
    RAISE EXCEPTION 'ASSERT T2/T3 omitidos: %', v_prev->'skipped';
  END IF;
  -- «Cobrar igual» el seguro del atleta 1 (omitible) → 1 fila; la mensualidad nunca se fuerza.
  v_prev := public.preview_charge_batch(c_school, v_owner, v_ath, v_lines, '[]', NULL, NULL, NULL,
              jsonb_build_array(jsonb_build_object('athlete', v_c1, 'line_idx', 1, 'action', 'force'),
                                jsonb_build_object('athlete', v_c1, 'line_idx', 0, 'action', 'force')), 'multi');
  IF (v_prev->>'rows_to_create')::int <> 1 THEN
    RAISE EXCEPTION 'ASSERT T3 forzar seguro: %', v_prev->'to_create';
  END IF;

  -- PREVIEW_STALE: hash viejo.
  PERFORM pg_temp.espera_error(format(
    'SELECT public.create_charge_batch(%L, %L, gen_random_uuid(), ''multi'', ''{}'', %L, %L, ''[]'', false, ''hash-viejo'')',
    c_school, v_owner, v_ath, jsonb_build_array(v_lines->2 || jsonb_build_object('amount', 81000))), 'PREVIEW_STALE');

  -- MULTI_NO_PAGA.
  PERFORM pg_temp.espera_error(format(
    'SELECT public.preview_charge_batch(%L, %L, %L, %L, ''[]'', NULL, %L)',
    c_school, v_owner, v_ath, jsonb_build_array(v_lines->2),
    jsonb_build_object('method', 'cash', 'payment_date', v_today)), 'MULTI_NO_PAGA');

  -- T34: sin atleta.
  PERFORM pg_temp.espera_error(format(
    'SELECT public.preview_charge_batch(%L, %L, ''[]'', %L)', c_school, v_owner, jsonb_build_array(v_lines->2)),
    'DATOS_INVALIDOS');

  -- T11: coach → FORBIDDEN (un coach activo de Campestre; si no hay, uno de prueba en la transacción).
  SELECT sm.profile_id INTO v_coach FROM public.school_members sm
   WHERE sm.school_id = c_school AND sm.role = 'coach' AND sm.status = 'active'
     AND public._actor_rol_finanzas(c_school, sm.profile_id) IS NULL
   LIMIT 1;
  IF v_coach IS NULL THEN
    INSERT INTO public.school_members (profile_id, school_id, role, status)
    SELECT p.id, c_school, 'coach', 'active' FROM public.profiles p
     WHERE public._actor_rol_finanzas(c_school, p.id) IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.school_members sm WHERE sm.profile_id = p.id AND sm.school_id = c_school)
     ORDER BY p.created_at LIMIT 1
    RETURNING profile_id INTO v_coach;
  END IF;
  PERFORM pg_temp.espera_error(format(
    'SELECT public.preview_charge_batch(%L, %L, %L, %L)', c_school, v_coach, v_ath, jsonb_build_array(v_lines->2)),
    'FORBIDDEN');

  -- Excedente: periodo + cargo sugerido del atleta 1 → confirmed con payment_id.
  INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes)
  VALUES (v_e1, c_school, date_trunc('month', v_today)::date, (date_trunc('month', v_today) + interval '1 month - 1 day')::date, 600)
  RETURNING id INTO v_per;
  INSERT INTO public.hour_bank_overage_charges (school_id, period_id, enrollment_id, billable_hours, hourly_rate, amount, status)
  VALUES (c_school, v_per, v_e1, 2, 25000, 50000, 'suggested') RETURNING id INTO v_ov;
  v_lines := jsonb_build_array(jsonb_build_object('idx', 0, 'category', 'excedente', 'overage_charge_id', v_ov,
                                                  'due_date', v_today + 5, 'concept', 'Horas'));
  v_prev := public.preview_charge_batch(c_school, v_owner, jsonb_build_array(v_ath->0), v_lines);
  v_res2 := public.create_charge_batch(c_school, v_owner, gen_random_uuid(), 'single', '{}', jsonb_build_array(v_ath->0),
              v_lines, '[]', false, v_prev->>'preview_hash');
  IF NOT EXISTS (SELECT 1 FROM public.hour_bank_overage_charges o
                  WHERE o.id = v_ov AND o.status = 'confirmed' AND o.payment_id = (v_res2->'payment_ids'->>0)::uuid) THEN
    RAISE EXCEPTION 'ASSERT excedente confirmado: %', v_res2;
  END IF;
  -- Segundo lote con el mismo excedente → omitido (ya facturado).
  v_prev := public.preview_charge_batch(c_school, v_owner, jsonb_build_array(v_ath->0), v_lines);
  IF v_prev#>>'{skipped,0,reason}' <> 'excedente_ya_facturado' THEN
    RAISE EXCEPTION 'ASSERT excedente ya facturado: %', v_prev->'skipped';
  END IF;
  -- Anular el lote del excedente → cancelled + excedente vuelve a suggested.
  v_res := public.annul_charge_batch(c_school, v_owner, (v_res2->>'batch_id')::uuid, 'prueba smoke', 1);
  IF (v_res->>'annulled')::int <> 1
     OR NOT EXISTS (SELECT 1 FROM public.hour_bank_overage_charges WHERE id = v_ov AND status = 'suggested' AND payment_id IS NULL) THEN
    RAISE EXCEPTION 'ASSERT anular excedente: %', v_res;
  END IF;

  -- T10: pagar una fila del primer lote y anular el resto → partially_annulled.
  SELECT id INTO v_pid FROM public.payments
   WHERE charge_batch_id = v_batch AND payment_category = 'torneo' AND child_id = v_c1;
  SELECT expires_at INTO v_exp FROM public.enrollments WHERE id = v_e1;
  v_prev := public.preview_charge_batch(c_school, v_owner, jsonb_build_array(v_ath->0), '[]'::jsonb,
              jsonb_build_array(jsonb_build_object('payment_id', v_pid, 'seen', jsonb_build_object('amount', 80000, 'amount_paid', 0),
                                                   'pay_amount', 80000)),
              NULL, jsonb_build_object('method', 'cash', 'payment_date', v_today));
  v_res2 := public.create_charge_batch(c_school, v_owner, gen_random_uuid(), 'single', '{}', jsonb_build_array(v_ath->0),
              '[]', '[]', false, v_prev->>'preview_hash',
              jsonb_build_array(jsonb_build_object('payment_id', v_pid, 'seen', jsonb_build_object('amount', 80000, 'amount_paid', 0),
                                                   'pay_amount', 80000)),
              NULL, jsonb_build_object('method', 'cash', 'payment_date', v_today));
  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id = v_pid AND status = 'paid' AND amount_paid = 80000 AND amount = 80000) THEN
    RAISE EXCEPTION 'ASSERT pago torneo: %', v_res2;
  END IF;
  IF (SELECT expires_at FROM public.enrollments WHERE id = v_e1) IS DISTINCT FROM v_exp THEN
    RAISE EXCEPTION 'ASSERT: pagar un torneo movió la vigencia';
  END IF;
  -- ANNUL_STALE con un conteo viejo; luego el correcto (5).
  PERFORM pg_temp.espera_error(format('SELECT public.annul_charge_batch(%L, %L, %L, ''prueba'', 6)', c_school, v_owner, v_batch),
                               'ANNUL_STALE');
  v_res := public.annul_charge_batch(c_school, v_owner, v_batch, 'prueba smoke', 5);
  IF (v_res->>'annulled')::int <> 5 OR jsonb_array_length(v_res->'kept') <> 1
     OR (SELECT status FROM public.charge_batches WHERE id = v_batch) <> 'partially_annulled' THEN
    RAISE EXCEPTION 'ASSERT T10 anular: %', v_res;
  END IF;

  RAISE NOTICE 'charge_batches_smoke: OK';
END $$;

-- ── MEDICIÓN (opcional; descomentar): lote de 600 filas en Campestre (< 3 s) ──
-- \timing on
-- DO $$ … armar 200 atletas × 3 líneas con los atletas activos de Campestre y
--        llamar preview + create; RAISE NOTICE con clock_timestamp() … $$;

ROLLBACK;
