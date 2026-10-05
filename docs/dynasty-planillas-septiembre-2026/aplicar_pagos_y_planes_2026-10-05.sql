-- =============================================================================
-- Dynasty Volley Club — planillas de papel sep-2026, cuarta tanda (2026-10-05)
-- Respuestas de Milena: P7 "analiza bien", P8 "cambio de plan".
-- Decisión atleta por atleta y su evidencia: aplicar_pagos_y_planes_2026-10-05_informe.md
--
-- Para correr en el SQL Editor de Supabase. Todo va con ids literales y con un
-- WHERE que verifica el estado esperado: si se corre dos veces, la segunda no
-- toca nada (0 filas). Aquí no se borra nada.
--
-- Milena (owner Dynasty) = 73adf4ca-51f5-4f4a-a6ca-1973c84e8151
-- Planes Dynasty: START 091f39c4… $90.000 · PRO c9348cd7… $150.000 ·
--                 ELITE 622df953… $180.000 · DYNASTY 02876fa4… $210.000
--
-- Triggers que se disparan (revisados):
--  * fn_guard_payments_client: no aplica en el SQL editor (current_user = postgres).
--  * fn_extend_enrollment_on_payment_paid: al pasar a 'paid' extiende expires_at
--    del plan, igual que en las tandas anteriores. Con 'partial' no hace nada.
--  * fn_school_fee_to_expense: solo cuando pasa a 'paid' (igual que antes).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A. CAMBIOS DE PLAN (P8: "el valor del papel es el plan real")
--    Patrón = el que usa el editor (PUT /students/:id, rama "mismo plan" / cambio):
--    enrollments.offering_plan_id + monthly_fee; el cobro de OCTUBRE pendiente
--    se lleva al nuevo plan y monto. Septiembre ya está 'paid' con amount_paid =
--    papel (tercera tanda): no se toca. Agosto: no se toca.
-- -----------------------------------------------------------------------------

-- A1. AGUDELO MARIA PAULA: PRO $150.000 -> ELITE $180.000
UPDATE public.enrollments
   SET offering_plan_id = '622df953-1e5b-477d-92b9-a944227f5f11',
       monthly_fee      = 180000,
       fee_is_manual    = false,
       fee_reason       = 'Cambio de plan confirmado por Milena 2026-10-05 (planilla sep: $180.000)',
       fee_set_by       = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       fee_set_at       = now()
 WHERE id = 'be6c0a97-dca1-485f-90d6-b1ad4e684293'
   AND status = 'active'
   AND offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428'
   AND monthly_fee = 150000;

UPDATE public.payments
   SET amount = 180000,
       offering_plan_id = '622df953-1e5b-477d-92b9-a944227f5f11'
 WHERE id = '4f0874fb-7e0d-49ad-90f4-3437feddad37'          -- oct-2026
   AND status IN ('pending','overdue')
   AND amount = 150000;

-- A2. AYCARDY OSPINO LUIS FELIPE: PRO $150.000 -> DYNASTY $210.000
UPDATE public.enrollments
   SET offering_plan_id = '02876fa4-6c2c-47d0-81b7-b806560be59d',
       monthly_fee      = 210000,
       fee_is_manual    = false,
       fee_reason       = 'Cambio de plan confirmado por Milena 2026-10-05 (planilla sep y pago ago: $210.000)',
       fee_set_by       = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       fee_set_at       = now()
 WHERE id = '68227e9b-4dde-4595-b851-e5f5ef595041'
   AND status = 'active'
   AND offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428'
   AND monthly_fee = 150000;

UPDATE public.payments
   SET amount = 210000,
       offering_plan_id = '02876fa4-6c2c-47d0-81b7-b806560be59d'
 WHERE id = 'b9f99923-8613-46c5-88ec-2f3a65e87ee4'          -- oct-2026
   AND status IN ('pending','overdue')
   AND amount = 150000;

-- A3. MARTINEZ JIMENEZ ANA MARIA: DYNASTY con cuota $250.000 -> ELITE $180.000
UPDATE public.enrollments
   SET offering_plan_id = '622df953-1e5b-477d-92b9-a944227f5f11',
       monthly_fee      = 180000,
       fee_is_manual    = false,
       fee_reason       = 'Cambio de plan confirmado por Milena 2026-10-05 (planilla sep: $180.000; hermano Oliver retirado)',
       fee_set_by       = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       fee_set_at       = now()
 WHERE id = '131a73f7-b67c-46bc-849e-16c1d1dae6fa'
   AND status = 'active'
   AND offering_plan_id = '02876fa4-6c2c-47d0-81b7-b806560be59d'
   AND monthly_fee = 250000;

UPDATE public.payments
   SET amount = 180000,
       offering_plan_id = '622df953-1e5b-477d-92b9-a944227f5f11'
 WHERE id = 'fe08ee23-3a42-4e1b-abdf-cfa2e1b00dbd'          -- oct-2026
   AND status IN ('pending','overdue')
   AND amount = 250000;

-- A4. LUNA PAULA (PAULA JIMENA LUNA CARDENAS): ELITE $180.000 -> PRO $150.000
UPDATE public.enrollments
   SET offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428',
       monthly_fee      = 150000,
       fee_is_manual    = false,
       fee_reason       = 'Cambio de plan confirmado por Milena 2026-10-05 (planilla sep y comprobante ago: $150.000)',
       fee_set_by       = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       fee_set_at       = now()
 WHERE id = 'a3a6e553-62ca-4398-b881-3c97ac84cb56'
   AND status = 'active'
   AND offering_plan_id = '622df953-1e5b-477d-92b9-a944227f5f11'
   AND monthly_fee = 180000;

UPDATE public.payments
   SET amount = 150000,
       offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428'
 WHERE id = '395aeaf9-06bd-49ac-938a-5c9a763028f6'          -- oct-2026
   AND status IN ('pending','overdue')
   AND amount = 180000;

-- A5. ELIZALDE (LAYLA SOFHIA ELIZALDE GALINDO): PRO $150.000 -> START $90.000
UPDATE public.enrollments
   SET offering_plan_id = '091f39c4-62c3-45c8-97b3-b6e32acc3b86',
       monthly_fee      = 90000,
       fee_is_manual    = false,
       fee_reason       = 'Cambio de plan confirmado por Milena 2026-10-05 (planilla sep: $90.000)',
       fee_set_by       = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       fee_set_at       = now()
 WHERE id = '83e72664-65b0-4308-b07f-c13ebee6eba1'
   AND status = 'active'
   AND offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428'
   AND monthly_fee = 150000;

UPDATE public.payments
   SET amount = 90000,
       offering_plan_id = '091f39c4-62c3-45c8-97b3-b6e32acc3b86'
 WHERE id = '5c6e209e-6bde-42d1-955e-a3429956978b'          -- oct-2026
   AND status IN ('pending','overdue')
   AND amount = 150000;

-- -----------------------------------------------------------------------------
-- B. SEPTIEMBRE PAGADO (mismo patrón que la tanda 'PLANILLA-SEP26-%')
-- -----------------------------------------------------------------------------

-- B1. VASQUEZ KATHALINA: papel $90.000 Ag-26 BC. El pago de agosto en la app es
--     OTRO (comprobante del 04-ago, aprobado ese día). Son dos transferencias.
UPDATE public.payments
   SET status          = 'paid',
       amount_paid     = 90000,
       payment_date    = '2026-08-26',
       payment_method  = 'transfer',
       payment_channel = 'transfer',
       approved_by     = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       approved_at     = now(),
       reference       = 'PLANILLA-SEP26-c222e645'
 WHERE id = 'c222e645-aa16-4f3d-9544-5c454c592d50'          -- sep-2026
   AND status IN ('pending','overdue')
   AND amount = 90000;

-- -----------------------------------------------------------------------------
-- C. ABONOS PARCIALES de septiembre (status 'partial' + amount_paid = papel).
--    Mismo mecanismo que usa la app para un abono (ApprovePaymentMethodSheet).
--    El saldo queda pendiente en el mismo cobro de septiembre. El plan no cambia.
-- -----------------------------------------------------------------------------

-- C1. ESCALLON CRISTIE: "Abona" $100.000, 2-sep, efectivo -> saldo $50.000
UPDATE public.payments
   SET status          = 'partial',
       amount_paid     = 100000,
       payment_date    = '2026-09-02',
       payment_method  = 'cash',
       payment_channel = 'cash',
       approved_by     = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       approved_at     = now(),
       reference       = 'PLANILLA-SEP26-8d6f28f2'
 WHERE id = '8d6f28f2-0370-4fd4-949b-9c10b3ac44b8'
   AND status IN ('pending','overdue')
   AND amount = 150000
   AND amount_paid IS NULL;

-- C2. JOVEN ALEJANDRA: $60.000, 23-sep, BC -> saldo $90.000 (no hay plan de $60.000)
UPDATE public.payments
   SET status          = 'partial',
       amount_paid     = 60000,
       payment_date    = '2026-09-23',
       payment_method  = 'transfer',
       payment_channel = 'transfer',
       approved_by     = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       approved_at     = now(),
       reference       = 'PLANILLA-SEP26-2f6edcff'
 WHERE id = '2f6edcff-cde2-43e1-825c-ee8ca6e06599'
   AND status IN ('pending','overdue')
   AND amount = 150000
   AND amount_paid IS NULL;

-- C3. SUAREZ MARTINEZ DANIEL: $65.000 (= mitad de SENIORS 8 clases), 21-sep, BC -> saldo $65.000
UPDATE public.payments
   SET status          = 'partial',
       amount_paid     = 65000,
       payment_date    = '2026-09-21',
       payment_method  = 'transfer',
       payment_channel = 'transfer',
       approved_by     = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       approved_at     = now(),
       reference       = 'PLANILLA-SEP26-4f8ed97a'
 WHERE id = '4f8ed97a-6c12-4853-812d-ad29f26356a5'
   AND status IN ('pending','overdue')
   AND amount = 130000
   AND amount_paid IS NULL;

-- -----------------------------------------------------------------------------
-- D. OPCIONALES — COMENTADOS. Solo quitar el comentario si Milena confirma.
-- -----------------------------------------------------------------------------

-- D1. MORA DUARTE ANDRES ESTEBAN -> PRO $150.000 (como sus 2 hermanos).
--     Solo si Milena confirma que su mensualidad es $150.000 y no un abono.
-- UPDATE public.enrollments
--    SET offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428', monthly_fee = 150000,
--        fee_is_manual = false, fee_set_by = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151', fee_set_at = now(),
--        fee_reason = 'Cambio de plan confirmado por Milena (planilla sep: $150.000)'
--  WHERE id = '14664f58-36aa-4980-96ba-28eed5de0837' AND status = 'active'
--    AND offering_plan_id = '622df953-1e5b-477d-92b9-a944227f5f11' AND monthly_fee = 180000;
-- UPDATE public.payments
--    SET amount = 150000, offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428'
--  WHERE id = '67685773-eeb1-404f-832a-b4e7d8e3fa32' AND status IN ('pending','overdue') AND amount = 180000;

-- D2. NIETO ROJAS MIA GABRIELA: el pago del 30-ago ($150.000, un solo comprobante) es el
--     que Milena anotó como SEPTIEMBRE; el cobro "agosto" nació el día de la inscripción
--     (30-ago). Si Milena confirma que empezó en septiembre, el cobro de sep queda
--     duplicado y se anula (no se borra).
-- UPDATE public.payments
--    SET status = 'cancelled',
--        rejection_reason = 'Duplicado: el pago del 30-ago (inscripción) cubre septiembre según planilla; confirmado por Milena'
--  WHERE id = '57420b6d-c8f1-4878-a6d6-da0118e36ed4' AND status IN ('pending','overdue') AND amount_paid IS NULL;

-- -----------------------------------------------------------------------------
-- Verificación (debe mostrar el estado nuevo; revisar ANTES del COMMIT)
-- -----------------------------------------------------------------------------
SELECT e.id, c.full_name, op.name AS plan, e.monthly_fee, e.fee_reason
  FROM public.enrollments e
  JOIN public.children c ON c.id = e.child_id
  LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
 WHERE e.id IN ('be6c0a97-dca1-485f-90d6-b1ad4e684293','68227e9b-4dde-4595-b851-e5f5ef595041',
                '131a73f7-b67c-46bc-849e-16c1d1dae6fa','a3a6e553-62ca-4398-b881-3c97ac84cb56',
                '83e72664-65b0-4308-b07f-c13ebee6eba1')
 ORDER BY 2;

SELECT p.id, c.full_name, p.period_month AS mes, p.amount, p.amount_paid, p.status,
       p.payment_date, p.reference, op.name AS plan
  FROM public.payments p
  JOIN public.children c ON c.id = p.child_id
  LEFT JOIN public.offering_plans op ON op.id = p.offering_plan_id
 WHERE p.id IN ('4f0874fb-7e0d-49ad-90f4-3437feddad37','b9f99923-8613-46c5-88ec-2f3a65e87ee4',
                'fe08ee23-3a42-4e1b-abdf-cfa2e1b00dbd','395aeaf9-06bd-49ac-938a-5c9a763028f6',
                '5c6e209e-6bde-42d1-955e-a3429956978b','c222e645-aa16-4f3d-9544-5c454c592d50',
                '8d6f28f2-0370-4fd4-949b-9c10b3ac44b8','2f6edcff-cde2-43e1-825c-ee8ca6e06599',
                '4f8ed97a-6c12-4853-812d-ad29f26356a5')
 ORDER BY 2, 3;
-- Esperado: 5 inscripciones con plan nuevo; 5 cobros oct con monto nuevo (180/210/180/150/90 mil);
-- Vásquez sep 'paid' 90.000; Escallón/Joven/Suárez sep 'partial' 100/60/65 mil.

COMMIT;
