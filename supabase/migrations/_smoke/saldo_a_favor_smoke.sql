-- =============================================================================
-- _smoke/saldo_a_favor_smoke.sql — prueba de 20261013165308_wa_saldo_a_favor_y_huellas
-- SOLO contra el gemelo local (scripts/qa-twin; fixtures del seed del gemelo).
-- Todo dentro de BEGIN … ROLLBACK: no deja nada. Requiere 20261013124655 y
-- 20261013165308 aplicadas en la sesión (o pegarlas antes, dentro del BEGIN).
--   docker exec -i supabase_db_sportmaps-qa-twin psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/migrations/_smoke/saldo_a_favor_smoke.sql
-- Escenarios: 1 excedente → saldo y consumo · 2 recargo del link · 3 un
-- comprobante para dos cobros · 4 saldo que cubre un cobro y parte de otro ·
-- 5 OCR absurdo no acredita · 6 atleta adulto identificado · 7 bandeja cierra
-- por referencia alternativa · 8 aprobación del staff con su rol.
-- =============================================================================
BEGIN;
\set ON_ERROR_STOP 1
DO $$
DECLARE
  sch uuid := '00000000-0000-4000-b000-000000000001';
  kid uuid := '00000000-0000-4000-c000-000000000001';
  par uuid := '00000000-0000-4000-a000-000000000004';
  a uuid; b uuid; c uuid; d uuid; e uuid; g uuid; h uuid; i uuid;
  r record; n int; j jsonb;
BEGIN
  -- limpiar pendientes previos del niño para el escenario
  UPDATE payments SET status='cancelled' WHERE child_id = kid AND status IN ('pending','overdue','awaiting_approval');

  -- 1. Excedente
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date, ocr_amount, receipt_url)
  VALUES (true, sch, kid, par, 150000, 'awaiting_approval', 'Mensualidad 09/2026', '2026-09-05', 180000, 'x/a.jpg') RETURNING id INTO a;
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date)
  VALUES (true, sch, kid, par, 150000, 'pending', 'Mensualidad 10/2026', '2026-10-05') RETURNING id INTO b;
  UPDATE payments SET status='paid', amount_paid=150000, approved_at=now() WHERE id=a;
  SELECT * INTO r FROM payments WHERE id=a;
  IF r.amount_paid <> 180000 THEN RAISE EXCEPTION 'FALLO 1a amount_paid=%', r.amount_paid; END IF;
  SELECT * INTO r FROM payments WHERE id=b;
  IF r.amount <> 120000 OR r.discount_amount <> 30000 OR r.list_amount <> 150000 THEN RAISE EXCEPTION 'FALLO 1b % % %', r.amount, r.discount_amount, r.list_amount; END IF;
  IF r.amount <> r.list_amount - r.discount_amount + r.late_fee_amount THEN RAISE EXCEPTION 'FALLO invariante'; END IF;
  SELECT count(*) INTO n FROM payment_adjustments WHERE payment_id IN (a,b) AND origin='saldo_a_favor';
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO 1c ajustes=%', n; END IF;
  -- idempotente
  j := registrar_saldo_a_favor(a, 180000);
  IF j->>'motivo' <> 'ya_registrado' THEN RAISE EXCEPTION 'FALLO 1d %', j; END IF;
  RAISE NOTICE 'OK 1 excedente → saldo y consumo en el siguiente';

  -- 2. Recargo del link
  UPDATE payments SET status='cancelled' WHERE id=b;
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date, ocr_amount, receipt_url)
  VALUES (true, sch, kid, par, 150000, 'awaiting_approval', 'Mensualidad 11/2026', '2026-11-05', 157500, 'x/c.jpg') RETURNING id INTO c;
  INSERT INTO payment_links (payment_id, school_id, token, gross_amount, base_amount, fee_pct, status, expires_at)
  VALUES (c, sch, 'tok-test-1', 157500, 150000, 5, 'expired', now() - interval '1 day');
  UPDATE payments SET status='paid', amount_paid=150000 WHERE id=c;
  SELECT * INTO r FROM payments WHERE id=c;
  IF r.gross_amount <> 157500 OR r.amount_paid <> 150000 THEN RAISE EXCEPTION 'FALLO 2 gross=% paid=%', r.gross_amount, r.amount_paid; END IF;
  IF EXISTS (SELECT 1 FROM payment_adjustments WHERE payment_id=c) THEN RAISE EXCEPTION 'FALLO 2 hay ajuste'; END IF;
  RAISE NOTICE 'OK 2 recargo del link = pago completo, gross_amount puesto';

  -- 3. Varios cobros con un comprobante
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date, ocr_amount, receipt_url, ocr_reference)
  VALUES (true, sch, kid, par, 150000, 'awaiting_approval', 'Mensualidad 12/2026', '2026-12-05', 300000, 'x/d.jpg', 'REFTEST123') RETURNING id INTO d;
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date)
  VALUES (true, sch, kid, par, 150000, 'pending', 'Mensualidad 01/2027', '2027-01-05') RETURNING id INTO e;
  n := wa_cubrir_cobros_con_comprobante(sch, d, ARRAY[e]);
  SELECT * INTO r FROM payments WHERE id=e;
  IF n <> 1 OR r.status <> 'awaiting_approval' OR r.receipt_url <> 'x/d.jpg' OR r.ocr_reference IS NOT NULL THEN RAISE EXCEPTION 'FALLO 3a'; END IF;
  UPDATE payments SET status='paid', amount_paid=150000 WHERE id=d;
  IF EXISTS (SELECT 1 FROM payment_adjustments WHERE payment_id=d) THEN RAISE EXCEPTION 'FALLO 3b saldo en varios'; END IF;
  RAISE NOTICE 'OK 3 un comprobante, dos cobros, sin saldo';
  UPDATE payments SET status='cancelled' WHERE id=e;

  -- 4. Saldo que cubre un cobro entero y parte del siguiente
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date, ocr_amount, receipt_url)
  VALUES (true, sch, kid, par, 100000, 'awaiting_approval', 'Clase', '2026-10-01', 250000, 'x/g.jpg') RETURNING id INTO g;
  UPDATE payments SET status='paid', amount_paid=100000 WHERE id=g;
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date)
  VALUES (true, sch, kid, par, 100000, 'pending', 'Mensualidad 02/2027', '2027-02-05') RETURNING id INTO h;
  SELECT * INTO r FROM payments WHERE id=h;
  IF r.status <> 'paid' OR r.amount <> 0 OR r.discount_amount <> 100000 THEN RAISE EXCEPTION 'FALLO 4a % % %', r.status, r.amount, r.discount_amount; END IF;
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date)
  VALUES (true, sch, kid, par, 100000, 'pending', 'Mensualidad 03/2027', '2027-03-05') RETURNING id INTO i;
  SELECT * INTO r FROM payments WHERE id=i;
  IF r.status <> 'pending' OR r.amount <> 50000 THEN RAISE EXCEPTION 'FALLO 4b % %', r.status, r.amount; END IF;
  IF _saldo_a_favor_disponible(sch, 'c:'||kid) <> 0 THEN RAISE EXCEPTION 'FALLO 4c saldo=%', _saldo_a_favor_disponible(sch, 'c:'||kid); END IF;
  RAISE NOTICE 'OK 4 saldo cubre uno entero y parte del siguiente; disponible 0';

  -- 5. OCR absurdo: no acredita
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date, ocr_amount, receipt_url)
  VALUES (true, sch, kid, par, 150000, 'awaiting_approval', 'Mensualidad 04/2027', '2027-04-05', 1500000, 'x/z.jpg') RETURNING id INTO a;
  UPDATE payments SET status='paid', amount_paid=150000 WHERE id=a;
  IF EXISTS (SELECT 1 FROM payment_adjustments WHERE payment_id=a) THEN RAISE EXCEPTION 'FALLO 5'; END IF;
  RAISE NOTICE 'OK 5 lectura x10 no acredita';
END $$;
DO $$
DECLARE
  sch uuid := '00000000-0000-4000-b000-000000000001';
  adulto uuid := '00000000-0000-4000-a000-000000000006';
  integ uuid; j jsonb; q uuid; p uuid; r record;
BEGIN
  INSERT INTO school_whatsapp_integrations (school_id, phone_number_id) VALUES (sch, 'pn-test-x') RETURNING id INTO integ;
  UPDATE profiles SET phone = '300 111 2299' WHERE id = adulto;
  j := wa_identify_by_phone(integ, '573001112299');
  IF j->>'estado' <> 'identificado' OR (j->>'parent_id')::uuid <> adulto THEN RAISE EXCEPTION 'FALLO 6 %', j; END IF;
  RAISE NOTICE 'OK 6 atleta adulto identificado por su número';
  -- acudiente con el mismo número manda
  UPDATE profiles SET phone = '3001112299' WHERE id = '00000000-0000-4000-a000-000000000004';
  j := wa_identify_by_phone(integ, '573001112299');
  IF (j->>'parent_id')::uuid <> '00000000-0000-4000-a000-000000000004' THEN RAISE EXCEPTION 'FALLO 6b %', j; END IF;
  RAISE NOTICE 'OK 6b el acudiente sigue mandando';

  -- 7. Bandeja: referencia alternativa
  INSERT INTO whatsapp_inbound_queue (school_id, wa_phone_number, wa_message_id, message_type, status, integration_id, error_message, pregunta_ocr, created_at)
  VALUES (sch, '573009990000', 'wamid-test-1', 'image', 'ignored', integ, 'recuperado: varios_cobros — x',
          jsonb_build_object('sha','abc','ocr',jsonb_build_object('reference','RECIBO111'),'referencias',jsonb_build_array('RECIBO111','APROB999')),
          now() - interval '1 hour') RETURNING id INTO q;
  INSERT INTO payments (period_uniqueness_exempt, school_id, child_id, amount, status, concept, due_date, ocr_reference)
  VALUES (true, sch, '00000000-0000-4000-c000-000000000001', 150000, 'awaiting_approval', 'Mensualidad', '2027-05-05', 'APROB999') RETURNING id INTO p;
  UPDATE payments SET status='paid', approved_at = now() WHERE id = p;
  SELECT * INTO r FROM whatsapp_inbound_queue WHERE id = q;
  IF r.error_message NOT LIKE 'cerrado_escuela: resuelto_auto%' THEN RAISE EXCEPTION 'FALLO 7 %', r.error_message; END IF;
  RAISE NOTICE 'OK 7 fila cerrada por referencia alternativa';
END $$;
-- 8. Aprobación del staff desde el navegador (approvePayment.ts): pasa la guardia y registra el saldo.
UPDATE payments SET status='cancelled' WHERE child_id='00000000-0000-4000-c000-000000000001' AND status IN ('pending','overdue','awaiting_approval');
INSERT INTO payments (id, period_uniqueness_exempt, school_id, child_id, parent_id, amount, status, concept, due_date, ocr_amount, receipt_url)
VALUES ('11111111-0000-4000-9000-000000000001', true, '00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000001','00000000-0000-4000-a000-000000000004',150000,'awaiting_approval','Mensualidad X','2026-09-05',180000,'x/staff.jpg'),
       ('11111111-0000-4000-9000-000000000002', true, '00000000-0000-4000-b000-000000000001','00000000-0000-4000-c000-000000000001','00000000-0000-4000-a000-000000000004',150000,'pending','Mensualidad Y','2026-10-05',NULL,NULL);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000002','role','authenticated')::text, true);
-- Lo mismo que hace frontend/src/lib/approvePayment.ts
UPDATE payments SET status='paid', payment_method='transfer', payment_channel='transfer', payment_date=current_date,
  approved_by='00000000-0000-4000-a000-000000000002', approved_at=now(), amount_paid=150000, requires_review=false,
  unblocked_at=now(), unblocked_by='00000000-0000-4000-a000-000000000002'
 WHERE id='11111111-0000-4000-9000-000000000001' AND status IN ('awaiting_approval','pending','overdue','partial');
RESET ROLE;
DO $$ DECLARE r record; BEGIN
  SELECT amount_paid INTO r FROM payments WHERE id='11111111-0000-4000-9000-000000000001';
  IF r.amount_paid <> 180000 THEN RAISE EXCEPTION 'FALLO staff amount_paid=%', r.amount_paid; END IF;
  SELECT amount, discount_amount INTO r FROM payments WHERE id='11111111-0000-4000-9000-000000000002';
  IF r.amount <> 120000 THEN RAISE EXCEPTION 'FALLO staff consumo amount=%', r.amount; END IF;
  RAISE NOTICE 'OK 8 aprobación del staff desde el navegador registra y consume el saldo';
END $$;
ROLLBACK;
