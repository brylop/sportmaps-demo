-- ============================================================
-- SMOKE TEST — «Cobros y pagos» F1: personas (spec cobros-multiples §16, T32–T34).
-- NO es una migración. Requiere aplicadas las 9 migraciones cobros_f1_*.
--
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/_smoke/cobros_personas_smoke.sql
--
-- SOLO Club Campestre Demo; termina en ROLLBACK.
-- Casos: «+ Atleta nuevo» menor (nombre + teléfono) con clase suelta pagada en
-- una operación (T32); adulto nuevo → unregistered_athletes con origen; mismo
-- nombre → vista previa con coincidencia y ATLETA_DUPLICADO; allow_duplicate →
-- crea y audita athlete_duplicate_forced (T33); mismo teléfono con otro nombre
-- = informativo, no bloquea; si el cobro falla, la ficha NO queda (todo o
-- nada); mensualidad para ficha nueva → omitida; cobro sin atleta (T34).
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

-- Vista previa + creación con atleta nuevo.
CREATE FUNCTION pg_temp.op_nuevo(p_actor uuid, p_new jsonb, p_lines jsonb, p_payment jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE v jsonb; s uuid := '25a123f0-6d57-48a4-9800-7b1531d61cd2';
BEGIN
  v := public.preview_charge_batch(s, p_actor, '[]'::jsonb, p_lines, '[]'::jsonb, NULL, p_payment, p_new);
  RETURN public.create_charge_batch(s, p_actor, gen_random_uuid(), 'single', '{}'::jsonb, '[]'::jsonb,
           p_lines, '[]'::jsonb, false, v->>'preview_hash', '[]'::jsonb, NULL, p_payment, p_new);
END $$;

DO $$
DECLARE
  c_school constant uuid := '25a123f0-6d57-48a4-9800-7b1531d61cd2';
  v_owner uuid;
  v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_tag   text := 'Smoke Persona ' || substr(md5(random()::text), 1, 6);
  v_phone text := '300' || lpad((floor(random() * 10000000))::int::text, 7, '0');
  v_line  jsonb;
  v_cash  jsonb;
  v_res   jsonb;
  v_prev  jsonb;
  v_child uuid;
  v_n     int;
BEGIN
  SELECT owner_id INTO v_owner FROM public.schools WHERE id = c_school AND name = 'Club Campestre Demo';
  IF v_owner IS NULL THEN RAISE EXCEPTION 'SETUP: Club Campestre Demo no existe'; END IF;
  v_line := jsonb_build_array(jsonb_build_object('idx', 0, 'category', 'clase_extra', 'amount', 30000,
                                                 'due_date', v_today, 'concept', 'Clase suelta'));
  v_cash := jsonb_build_object('method', 'cash', 'payment_date', v_today);

  -- T32: menor nuevo (solo nombre + teléfono del acudiente) + clase suelta pagada.
  v_res := pg_temp.op_nuevo(v_owner,
             jsonb_build_object('kind', 'menor', 'full_name', v_tag, 'guardian_phone', v_phone),
             v_line, v_cash);
  v_child := (v_res#>>'{new_athlete,id}')::uuid;
  IF v_res#>>'{new_athlete,table}' <> 'children'
     OR NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = v_child AND c.school_id = c_school
                      AND c.parent_id IS NULL AND c.parent_phone_temp = v_phone)
     OR NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.child_id = v_child AND p.status = 'paid'
                      AND p.payment_category = 'clase_extra' AND p.amount_paid = 30000 AND p.parent_id IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE record_id = v_child::text AND action = 'athlete_created_from_cobros') THEN
    RAISE EXCEPTION 'ASSERT T32: %', v_res;
  END IF;

  -- T33: mismo nombre → la vista previa muestra la coincidencia; create → ATLETA_DUPLICADO.
  v_prev := public.preview_charge_batch(c_school, v_owner, '[]', v_line, '[]', NULL, NULL,
              jsonb_build_object('kind', 'menor', 'full_name', v_tag, 'guardian_phone', '3109999999'));
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_prev->'duplicates') d
                  WHERE (d->>'id')::uuid = v_child AND d->'matched_by' ? 'nombre') THEN
    RAISE EXCEPTION 'ASSERT T33 vista previa sin coincidencia: %', v_prev->'duplicates';
  END IF;
  PERFORM pg_temp.espera_error(format('SELECT pg_temp.op_nuevo(%L, %L, %L)', v_owner,
            jsonb_build_object('kind', 'menor', 'full_name', v_tag, 'guardian_phone', '3109999999'), v_line),
            'ATLETA_DUPLICADO');
  -- «Es otra persona: crear igual» → crea y audita.
  v_res := pg_temp.op_nuevo(v_owner,
             jsonb_build_object('kind', 'menor', 'full_name', v_tag, 'guardian_phone', '3109999999',
                                'allow_duplicate', true), v_line);
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs
                  WHERE record_id = v_res#>>'{new_athlete,id}' AND action = 'athlete_duplicate_forced') THEN
    RAISE EXCEPTION 'ASSERT T33 allow_duplicate sin auditoría';
  END IF;

  -- Mismo teléfono, otro nombre (hermano): informativo, no bloquea.
  v_res := pg_temp.op_nuevo(v_owner,
             jsonb_build_object('kind', 'menor', 'full_name', 'Otro Nombre ' || v_tag, 'guardian_phone', v_phone),
             v_line);
  IF v_res->>'batch_id' IS NULL THEN RAISE EXCEPTION 'ASSERT teléfono informativo: %', v_res; END IF;

  -- Adulto nuevo → unregistered_athletes con origen.
  v_res := pg_temp.op_nuevo(v_owner,
             jsonb_build_object('kind', 'adulto', 'full_name', 'Adulto ' || v_tag, 'guardian_phone', '3207777777'),
             v_line);
  IF v_res#>>'{new_athlete,table}' <> 'unregistered_athletes'
     OR NOT EXISTS (SELECT 1 FROM public.unregistered_athletes
                     WHERE id = (v_res#>>'{new_athlete,id}')::uuid AND intake_form_data->>'origen' = 'cobros_y_pagos') THEN
    RAISE EXCEPTION 'ASSERT adulto nuevo: %', v_res;
  END IF;

  -- Todo o nada: el pago excede el saldo → SOBREPAGO y la ficha NO queda.
  PERFORM pg_temp.espera_error(format('SELECT pg_temp.op_nuevo(%L, %L, %L, %L)', v_owner,
            jsonb_build_object('kind', 'menor', 'full_name', 'Rollback ' || v_tag, 'guardian_phone', '3155555555'),
            jsonb_build_array((v_line->0) || jsonb_build_object('pay_amount', 99999)), v_cash), 'SOBREPAGO');
  SELECT count(*) INTO v_n FROM public.children WHERE full_name = 'Rollback ' || v_tag;
  IF v_n <> 0 THEN RAISE EXCEPTION 'ASSERT todo o nada: quedó la ficha'; END IF;

  -- Mensualidad para una ficha nueva → omitida (para eso está el alta completa).
  v_prev := public.preview_charge_batch(c_school, v_owner, '[]',
              jsonb_build_array(jsonb_build_object('idx', 0, 'category', 'mensualidad', 'amount', 100000,
                'due_date', v_today, 'concept', 'Mensualidad',
                'period', jsonb_build_object('year', extract(year FROM v_today), 'month', extract(month FROM v_today)))),
              '[]', NULL, NULL,
              jsonb_build_object('kind', 'menor', 'full_name', 'Sin Plan ' || v_tag, 'guardian_phone', '3001112233'));
  IF v_prev#>>'{skipped,0,reason}' <> 'sin_inscripcion_para_mensualidad' THEN
    RAISE EXCEPTION 'ASSERT mensualidad sin inscripción: %', v_prev->'skipped';
  END IF;

  -- T34: nunca un cobro sin atleta.
  PERFORM pg_temp.espera_error(format('SELECT public.preview_charge_batch(%L, %L, ''[]'', %L)',
            c_school, v_owner, v_line), 'DATOS_INVALIDOS');

  RAISE NOTICE 'cobros_personas_smoke: OK';
END $$;

ROLLBACK;
