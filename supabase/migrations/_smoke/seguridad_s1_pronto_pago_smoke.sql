-- ============================================================
-- SMOKE TEST — Seguridad S1 / H5: el acudiente no fija su pronto pago
-- (20261010143743_seguridad_s1_descuento_pronto_pago).
-- NO es una migración. Correr con psql DESPUÉS de aplicar la migración:
--   psql "$DATABASE_URL" \
--     -v school_id="'<uuid escuela de PRUEBA, operativa>'" \
--     -v child_id="'<children.id de esa escuela>'" \
--     -v parent_id="'<children.parent_id de ese child; NO staff de la escuela>'" \
--     -f supabase/migrations/_smoke/seguridad_s1_pronto_pago_smoke.sql
--
-- Todo va en BEGIN … ROLLBACK: no persiste nada (ni el ajuste de
-- school_settings, ni los cobros de prueba, ni sus notificaciones).
-- Usar una escuela de prueba (Escuela Demo SportMaps / Club Campestre Demo).
-- Cualquier FAIL aborta (ON_ERROR_STOP) y la transacción se deshace igual.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _p (school_id uuid, child_id uuid, parent_id uuid,
                      pay_nuevo uuid, pay_viejo uuid);
INSERT INTO _p (school_id, child_id, parent_id) VALUES (:school_id, :child_id, :parent_id);
GRANT SELECT ON _p TO authenticated;

-- ── 0. Catálogo: trigger + función endurecida + CHECK ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.payments'::regclass
                    AND tgname = 'trg_zzz_pronto_pago_servidor' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'FAIL: falta trg_zzz_pronto_pago_servidor (¿migración aplicada?)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc
                  WHERE oid = 'public.fn_payments_pronto_pago_servidor()'::regprocedure
                    AND prosecdef
                    AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']) THEN
    RAISE EXCEPTION 'FAIL: fn_payments_pronto_pago_servidor sin SECURITY DEFINER o sin search_path (I4)';
  END IF;
  IF has_function_privilege('authenticated', 'public.fn_payments_pronto_pago_servidor()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_payments_pronto_pago_servidor()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL grants: anon/authenticated con EXECUTE sobre la función del trigger';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.payments'::regclass
                    AND conname = 'payments_pronto_pago_rango' AND convalidated) THEN
    RAISE EXCEPTION 'FAIL: falta CHECK payments_pronto_pago_rango validado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.school_members sm, _p
              WHERE sm.profile_id = _p.parent_id AND sm.school_id = _p.school_id
                AND sm.status = 'active' AND sm.role NOT IN ('parent','athlete','accountant'))
     OR EXISTS (SELECT 1 FROM public.schools s, _p WHERE s.id = _p.school_id AND s.owner_id = _p.parent_id) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: parent_id es personal de la escuela; elegir un acudiente puro';
  END IF;
END $$;

-- ── Fixture (como postgres): pronto pago 10 % / 5 días + dos cobros ─────────
INSERT INTO public.school_settings (school_id) SELECT school_id FROM _p
ON CONFLICT (school_id) DO NOTHING;
UPDATE public.school_settings ss
   SET early_payment_discount_enabled = true,
       early_payment_discount_days = 5,
       early_payment_discount_percentage = 10
  FROM _p WHERE ss.school_id = _p.school_id;

-- Cobro nuevo (hoy, dentro de la ventana) — 100.000 → tope servidor 10.000.
WITH ins AS (
  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, payment_category, period_uniqueness_exempt)
  SELECT school_id, parent_id, child_id, 'SMOKE S1 nuevo', 100000, current_date,
         'pending', 'one_time', 'mensualidad', true FROM _p
  RETURNING id)
UPDATE _p SET pay_nuevo = (SELECT id FROM ins);

-- Cobro viejo (hace 40 días, ventana cerrada).
WITH ins AS (
  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, payment_category, period_uniqueness_exempt,
                               created_at)
  SELECT school_id, parent_id, child_id, 'SMOKE S1 viejo', 100000, current_date - 40,
         'pending', 'one_time', 'mensualidad', true, now() - interval '40 days' FROM _p
  RETURNING id)
UPDATE _p SET pay_viejo = (SELECT id FROM ins);

DO $$
BEGIN
  -- Un impago real anterior del atleta bloquearía el pronto pago del caso 2.
  IF EXISTS (SELECT 1 FROM public.payments p, _p
              WHERE p.school_id = _p.school_id AND p.child_id = _p.child_id
                AND p.status IN ('pending','overdue','partial')
                AND p.id NOT IN (_p.pay_nuevo, _p.pay_viejo)) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: el atleta tiene cobros pending/overdue/partial; elegir uno al día';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.children c, _p
                  WHERE c.id = _p.child_id AND c.parent_id = _p.parent_id AND c.school_id = _p.school_id) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: child_id no es hijo de parent_id en esa escuela';
  END IF;
END $$;

-- ── Sesión de ACUDIENTE (JWT simulado, como PostgREST) ──────────────────────
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', parent_id, 'role', 'authenticated')::text, true)
  FROM _p;
SET LOCAL ROLE authenticated;

-- 1. El cobro viejo es un impago ANTERIOR del mismo atleta → el nuevo no tiene
--    pronto pago. Por eso primero se mide el viejo: pide 100.000 → NULL.
UPDATE public.payments SET status = 'awaiting_approval', early_payment_discount_applied = 100000
 WHERE id = (SELECT pay_viejo FROM _p);
DO $$
DECLARE v numeric;
BEGIN
  SELECT early_payment_discount_applied INTO v FROM public.payments WHERE id = (SELECT pay_viejo FROM _p);
  IF v IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL 1: cobro con ventana cerrada quedó con pronto pago %', v;
  END IF;
END $$;
-- (el viejo ya no está pending/overdue/partial → deja de bloquear al nuevo)

-- 2. Acudiente se pone descuento = monto completo → queda en el tope (10.000).
UPDATE public.payments SET status = 'awaiting_approval', early_payment_discount_applied = 100000
 WHERE id = (SELECT pay_nuevo FROM _p);
DO $$
DECLARE v numeric;
BEGIN
  SELECT early_payment_discount_applied INTO v FROM public.payments WHERE id = (SELECT pay_nuevo FROM _p);
  IF v IS DISTINCT FROM 10000 THEN
    RAISE EXCEPTION 'FAIL 2: esperaba 10000 (tope servidor), quedó %', v;
  END IF;
END $$;

-- 3. Un valor MENOR al tope se respeta (el front calculó menos).
UPDATE public.payments SET early_payment_discount_applied = 4000
 WHERE id = (SELECT pay_nuevo FROM _p);
DO $$
DECLARE v numeric;
BEGIN
  SELECT early_payment_discount_applied INTO v FROM public.payments WHERE id = (SELECT pay_nuevo FROM _p);
  IF v IS DISTINCT FROM 4000 THEN RAISE EXCEPTION 'FAIL 3: esperaba 4000, quedó %', v; END IF;
END $$;

-- 4. Negativo → NULL (nunca suma).
UPDATE public.payments SET early_payment_discount_applied = -5000
 WHERE id = (SELECT pay_nuevo FROM _p);
DO $$
DECLARE v numeric;
BEGIN
  SELECT early_payment_discount_applied INTO v FROM public.payments WHERE id = (SELECT pay_nuevo FROM _p);
  IF v IS NOT NULL THEN RAISE EXCEPTION 'FAIL 4: negativo quedó %', v; END IF;
END $$;

-- 5. created_at no se mueve desde el cliente (reabriría la ventana del viejo).
UPDATE public.payments SET created_at = now(), early_payment_discount_applied = 10000
 WHERE id = (SELECT pay_viejo FROM _p);
DO $$
DECLARE v numeric; c timestamptz;
BEGIN
  SELECT early_payment_discount_applied, created_at INTO v, c FROM public.payments WHERE id = (SELECT pay_viejo FROM _p);
  IF c > now() - interval '39 days' THEN RAISE EXCEPTION 'FAIL 5a: el acudiente movió created_at a %', c; END IF;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'FAIL 5b: ventana reabierta, pronto pago %', v; END IF;
END $$;

-- 6. INSERT del acudiente: pide pronto pago sobre un cobro único → NULL;
--    sobre mensualidad nueva → tope; sibling_discount_applied → 42501.
DO $$
DECLARE v numeric; v_amt numeric; p _p%ROWTYPE;
BEGIN
  SELECT * INTO p FROM _p;

  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, payment_category, period_uniqueness_exempt,
                               receipt_url, early_payment_discount_applied)
  VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S1 inscripcion', 50000, current_date,
          'awaiting_approval', 'one_time', 'inscripcion', true, 'smoke/s1.jpg', 50000)
  RETURNING early_payment_discount_applied INTO v;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'FAIL 6a: cobro único con pronto pago %', v; END IF;

  INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                               status, payment_type, payment_category, period_uniqueness_exempt,
                               receipt_url, early_payment_discount_applied, created_at)
  VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S1 mensualidad', 80000, current_date,
          'awaiting_approval', 'one_time', 'mensualidad', true, 'smoke/s1b.jpg', 80000,
          now() + interval '365 days')
  RETURNING early_payment_discount_applied, amount INTO v, v_amt;
  -- pay_nuevo (anterior) ya está en awaiting_approval → no bloquea.
  -- Con S4 (20261010145241) el monto que pide el acudiente (80.000) se reemplaza
  -- por la tarifa REAL de la inscripción del atleta: el tope es el 10 % de esa
  -- tarifa, no de 80.000. Se lee el monto que quedó en la fila.
  IF v_amt IS NULL OR v_amt <= 0 THEN RAISE EXCEPTION 'FAIL 6b: monto inesperado %', v_amt; END IF;
  IF v IS DISTINCT FROM round(v_amt * 10 / 100) THEN
    RAISE EXCEPTION 'FAIL 6b: esperaba % (10 %% de la tarifa %), quedó %', round(v_amt * 10 / 100), v_amt, v;
  END IF;

  BEGIN
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date,
                                 status, payment_type, payment_category, period_uniqueness_exempt,
                                 sibling_discount_applied)
    VALUES (p.school_id, p.parent_id, p.child_id, 'SMOKE S1 hermanos', 50000, current_date,
            'pending', 'one_time', 'otro', true, 9999);
    RAISE EXCEPTION 'FAIL 6c: el acudiente insertó sibling_discount_applied';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- esperado: PAYMENT_FIELD_LOCKED (42501)
  END;
END $$;

-- 6d. created_at futuro en INSERT quedó en now().
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payments
              WHERE concept = 'SMOKE S1 mensualidad' AND created_at > now() + interval '1 minute') THEN
    RAISE EXCEPTION 'FAIL 6d: created_at futuro aceptado en INSERT';
  END IF;
END $$;

-- ── Servidor (sin JWT): no se acota; el CHECK sí rige ───────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

UPDATE public.payments SET early_payment_discount_applied = 20000
 WHERE id = (SELECT pay_nuevo FROM _p);
DO $$
DECLARE v numeric;
BEGIN
  SELECT early_payment_discount_applied INTO v FROM public.payments WHERE id = (SELECT pay_nuevo FROM _p);
  IF v IS DISTINCT FROM 20000 THEN RAISE EXCEPTION 'FAIL 7: el servidor fue acotado (%)', v; END IF;

  BEGIN
    UPDATE public.payments SET early_payment_discount_applied = 100001 WHERE id = (SELECT pay_nuevo FROM _p);
    RAISE EXCEPTION 'FAIL 8: CHECK no frenó descuento > amount';
  EXCEPTION WHEN check_violation THEN
    NULL; -- esperado
  END;
END $$;

SELECT 'OK — seguridad S1: 8 casos pasaron' AS resultado;

ROLLBACK;
