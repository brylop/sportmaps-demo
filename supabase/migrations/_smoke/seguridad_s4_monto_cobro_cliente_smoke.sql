-- ============================================================
-- SMOKE TEST — Seguridad S4: el acudiente no fija el monto del cobro que crea
-- (20261010145241_seguridad_s4_monto_cobro_cliente).
-- NO es una migración. Correr con psql DESPUÉS de aplicar la migración:
--   psql "$DATABASE_URL" \
--     -v school_id="'<uuid escuela de PRUEBA, operativa>'" \
--     -v child_id="'<children.id con inscripción ACTIVA con tarifa en esa escuela>'" \
--     -v parent_id="'<children.parent_id de ese child; NO staff de la escuela>'" \
--     -f supabase/migrations/_smoke/seguridad_s4_monto_cobro_cliente_smoke.sql
--
-- Todo va en BEGIN … ROLLBACK: no persiste nada (cobros de prueba,
-- notificaciones, auditoría). Los períodos de prueba son de 2099 para no
-- chocar con uniq_payment_active_period_per_child.
-- Usar una escuela de prueba (Escuela Demo SportMaps / Club Campestre Demo).
-- Cualquier FAIL aborta (ON_ERROR_STOP) y la transacción se deshace igual.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _p (school_id uuid, child_id uuid, parent_id uuid,
                      tarifa numeric, plan_id uuid, child_ajeno uuid,
                      pay_existente uuid);
INSERT INTO _p (school_id, child_id, parent_id) VALUES (:school_id, :child_id, :parent_id);
GRANT SELECT ON _p TO authenticated, anon;

-- ── 0. Catálogo + precondiciones ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.payments'::regclass
                    AND tgname = 'trg_zzy_monto_cobro_cliente' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'FAIL 0a: falta trg_zzy_monto_cobro_cliente (¿migración aplicada?)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc
                  WHERE oid = 'public._payments_cobro_cliente_normalizar(public.payments)'::regprocedure
                    AND prosecdef
                    AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']) THEN
    RAISE EXCEPTION 'FAIL 0b: normalizadora sin SECURITY DEFINER o sin search_path (I4)';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public._payments_cobro_cliente_normalizar(public.payments)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL 0c: authenticated sin EXECUTE sobre la normalizadora (el trigger corre como invocador)';
  END IF;
  IF has_function_privilege('anon', 'public._payments_cobro_cliente_normalizar(public.payments)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL 0d: anon con EXECUTE sobre la normalizadora';
  END IF;
  IF has_table_privilege('anon', 'public.payments', 'INSERT')
     OR has_table_privilege('anon', 'public.payments', 'UPDATE')
     OR has_table_privilege('anon', 'public.payments', 'DELETE')
     OR has_column_privilege('anon', 'public.payments', 'amount', 'INSERT')
     OR has_column_privilege('anon', 'public.payments', 'amount', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL 0e: anon conserva escritura sobre payments';
  END IF;
  IF EXISTS (SELECT 1 FROM public.school_members sm, _p
              WHERE sm.profile_id = _p.parent_id AND sm.school_id = _p.school_id
                AND sm.status = 'active' AND sm.role NOT IN ('parent','athlete','accountant'))
     OR EXISTS (SELECT 1 FROM public.schools s, _p WHERE s.id = _p.school_id AND s.owner_id = _p.parent_id) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: parent_id es personal de la escuela; elegir un acudiente puro';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.children c, _p
                  WHERE c.id = _p.child_id AND c.parent_id = _p.parent_id AND c.school_id = _p.school_id) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: child_id no es hijo de parent_id en esa escuela';
  END IF;
  IF NOT public.school_is_operational((SELECT school_id FROM _p)) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: la escuela no está operativa (trial_block_insert)';
  END IF;
END $$;

-- Tarifa esperada (misma regla que la normalizadora) y un hijo AJENO.
UPDATE _p SET (tarifa, plan_id) = (
  SELECT COALESCE(NULLIF(e.monthly_fee,0), NULLIF(t.price_monthly,0), NULLIF(op.price,0)), e.offering_plan_id
    FROM public.enrollments e
    LEFT JOIN public.teams t ON t.id = e.team_id
    LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
   WHERE e.school_id = _p.school_id AND e.child_id = _p.child_id AND e.status = 'active'
     AND COALESCE(NULLIF(e.monthly_fee,0), NULLIF(t.price_monthly,0), NULLIF(op.price,0)) IS NOT NULL
   ORDER BY e.created_at DESC LIMIT 1);
UPDATE _p SET child_ajeno = (
  SELECT c.id FROM public.children c
   WHERE c.school_id = _p.school_id AND c.parent_id IS DISTINCT FROM _p.parent_id LIMIT 1);

DO $$
BEGIN
  IF (SELECT tarifa FROM _p) IS NULL OR (SELECT tarifa FROM _p) <= 1 THEN
    RAISE EXCEPTION 'PRECONDICIÓN: el atleta no tiene inscripción activa con tarifa > 1';
  END IF;
  IF (SELECT count(*) FROM public.enrollments e, _p
       WHERE e.school_id = _p.school_id AND e.child_id = _p.child_id AND e.status = 'active') > 1 THEN
    RAISE NOTICE 'Aviso: el atleta tiene varias inscripciones activas; el caso 1 compara contra la más reciente con tarifa.';
  END IF;
END $$;

-- Cobro EXISTENTE creado por el servidor (sin JWT) para el caso 6.
WITH ins AS (
  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, payment_category, period_year, period_month)
  SELECT school_id, parent_id, child_id, 'SMOKE S4 existente', tarifa, current_date,
         'pending', 'one_time', 'mensualidad', 2099, 6 FROM _p
  RETURNING id)
UPDATE _p SET pay_existente = (SELECT id FROM ins);

-- 7. Servidor (sin JWT) no se toca: monto libre.
DO $$
DECLARE v numeric; p _p%ROWTYPE;
BEGIN
  SELECT * INTO p FROM _p;
  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, payment_category, period_year, period_month)
  VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S4 servidor', 777, current_date,
          'pending', 'one_time', 'mensualidad', 2099, 7)
  RETURNING amount INTO v;
  IF v IS DISTINCT FROM 777 THEN RAISE EXCEPTION 'FAIL 7: el servidor fue re-tarifado (%)', v; END IF;
END $$;

-- ── Sesión de ACUDIENTE (JWT simulado, como PostgREST) ──────────────────────
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', parent_id, 'role', 'authenticated')::text, true)
  FROM _p;
SET LOCAL ROLE authenticated;

DO $$
DECLARE v_amt numeric; v_plan uuid; v_ex boolean; p _p%ROWTYPE;
BEGIN
  SELECT * INTO p FROM _p;

  -- 1. Mensualidad de $1 → queda en la tarifa de la inscripción.
  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, payment_category, period_year, period_month,
                               payment_method, receipt_url, period_uniqueness_exempt)
  VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S4 forjado', 1, current_date,
          'awaiting_approval', 'one_time', 'mensualidad', 2099, 1,
          'transfer', 'smoke/s4-1.jpg', true)
  RETURNING amount, period_uniqueness_exempt INTO v_amt, v_ex;
  IF v_amt IS DISTINCT FROM p.tarifa THEN
    RAISE EXCEPTION 'FAIL 1: monto forjado aceptado: quedó % (tarifa %)', v_amt, p.tarifa;
  END IF;
  IF v_ex THEN RAISE EXCEPTION 'FAIL 1b: mensualidad del cliente quedó exenta del cupo del mes'; END IF;

  -- 2. Categoría NULL (= mensualidad) con plan AJENO → tarifa + plan de SU inscripción.
  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, period_year, period_month, offering_plan_id)
  VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S4 plan ajeno', 1, current_date,
          'pending', 'one_time', 2099, 2,
          (SELECT op.id FROM public.offering_plans op
            WHERE op.school_id = p.school_id AND op.id IS DISTINCT FROM p.plan_id LIMIT 1))
  RETURNING amount, offering_plan_id INTO v_amt, v_plan;
  IF v_amt IS DISTINCT FROM p.tarifa THEN RAISE EXCEPTION 'FAIL 2a: quedó %', v_amt; END IF;
  IF v_plan IS NOT NULL AND v_plan IS DISTINCT FROM p.plan_id THEN
    RAISE EXCEPTION 'FAIL 2b: quedó con un plan que no es el de su inscripción';
  END IF;

  -- 3. Hijo AJENO → 42501.
  IF p.child_ajeno IS NOT NULL THEN
    BEGIN
      INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                                   status, payment_type, payment_category, period_year, period_month)
      VALUES (p.school_id, p.parent_id, p.child_ajeno, 'SMOKE S4 hijo ajeno', 50000, current_date,
              'pending', 'one_time', 'mensualidad', 2099, 3);
      RAISE EXCEPTION 'FAIL 3: el acudiente creó un cobro para un hijo ajeno';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  ELSE
    RAISE NOTICE 'Caso 3 omitido: la escuela no tiene otro hijo';
  END IF;

  -- 4. unregistered_athlete_id / qr_id → 42501.
  BEGIN
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                                 status, payment_type, payment_category, period_year, period_month,
                                 unregistered_athlete_id)
    VALUES (p.school_id, p.parent_id, NULL, 'SMOKE S4 no registrado', 50000, current_date,
            'pending', 'one_time', 'mensualidad', 2099, 4, gen_random_uuid());
    RAISE EXCEPTION 'FAIL 4a: aceptó unregistered_athlete_id del cliente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                                 status, payment_type, payment_category, period_year, period_month,
                                 qr_id)
    VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S4 qr', 50000, current_date,
            'pending', 'one_time', 'mensualidad', 2099, 4, gen_random_uuid());
    RAISE EXCEPTION 'FAIL 4b: aceptó qr_id del cliente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 5. Abono libre ('otro'): el monto se respeta, pero sin plan y exento del cupo.
  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, payment_category, period_year, period_month,
                               offering_plan_id, period_uniqueness_exempt, receipt_url)
  VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S4 abono', 12345, current_date,
          'awaiting_approval', 'one_time', 'otro', 2099, 5, p.plan_id, false, 'smoke/s4-5.jpg')
  RETURNING amount, offering_plan_id, period_uniqueness_exempt INTO v_amt, v_plan, v_ex;
  IF v_amt IS DISTINCT FROM 12345 THEN RAISE EXCEPTION 'FAIL 5a: abono re-tarifado a %', v_amt; END IF;
  IF v_plan IS NOT NULL THEN RAISE EXCEPTION 'FAIL 5b: abono con offering_plan_id (daría vigencia)'; END IF;
  IF NOT v_ex THEN RAISE EXCEPTION 'FAIL 5c: abono ocupa el cupo del mes'; END IF;

  -- 6. Flujo legítimo: pagar un cobro EXISTENTE (UPDATE a awaiting_approval).
  UPDATE public.payments
     SET status = 'awaiting_approval', payment_method = 'transfer',
         payment_date = current_date, receipt_url = 'smoke/s4-6.jpg'
   WHERE id = p.pay_existente;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL 6a: el acudiente no pudo pagar su cobro existente'; END IF;
  SELECT amount INTO v_amt FROM public.payments WHERE id = p.pay_existente;
  IF v_amt IS DISTINCT FROM p.tarifa THEN RAISE EXCEPTION 'FAIL 6b: el monto del existente cambió a %', v_amt; END IF;
  BEGIN
    UPDATE public.payments SET amount = 1 WHERE id = p.pay_existente;
    RAISE EXCEPTION 'FAIL 6c: el acudiente bajó el monto de un cobro existente';
  EXCEPTION WHEN insufficient_privilege THEN NULL; -- la guardia: PAYMENT_FIELD_LOCKED: amount
  END;
END $$;

-- ── 8. anon no escribe payments ──────────────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
SET LOCAL ROLE anon;
DO $$
DECLARE p _p%ROWTYPE;
BEGIN
  SELECT * INTO p FROM _p;
  BEGIN
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                                 status, payment_type, payment_category)
    VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S4 anon', 1, current_date,
            'pending', 'one_time', 'mensualidad');
    RAISE EXCEPTION 'FAIL 8a: anon insertó en payments';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.payments SET amount = 1 WHERE id = p.pay_existente;
    RAISE EXCEPTION 'FAIL 8b: anon tiene UPDATE sobre payments';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

SELECT 'OK — seguridad S4: casos 0-8 pasaron' AS resultado;

ROLLBACK;
