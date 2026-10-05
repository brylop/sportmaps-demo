-- =============================================================================
-- Dynasty Volley Club — DELTA del 2026-10-05 (segunda respuesta de Milena)
-- Se corre DESPUÉS de los dos scripts que ya están aplicados:
--   aplicar_pagos_y_planes_2026-10-05.sql      (versión original, sin D1/D2)
--   aplicar_matriculas_por_revisar_2026-10-05.sql  (10 fichas, incluida "Daniel Niño")
-- Esos dos archivos NO se tocan: quedan como registro de lo aplicado.
--
-- Milena confirmó:
--   * Mora Duarte Andrés pasa a PRO ($150.000).
--   * Nieto Mia empezó en septiembre -> anular su cobro de sep duplicado.
--   * "Niño Daniel" ES Julián David Niño Ramírez -> los $300.000 van a sus cobros.
-- Detalle y deuda resultante: aplicar_pagos_y_planes_2026-10-05_informe.md, sección "Delta".
--
-- Para el SQL Editor (sin TEMP TABLE ni RAISE). Ids literales, y cada WHERE
-- exige el estado ACTUAL (verificado con SELECT el 2026-10-05): una segunda
-- corrida no cambia nada. No hay DELETE.
-- Milena (owner) = 73adf4ca-51f5-4f4a-a6ca-1973c84e8151
-- Planes: PRO c9348cd7… $150.000 · ELITE 622df953… $180.000
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. MORA DUARTE ANDRES ESTEBAN -> PRO $150.000 (sus 2 hermanos ya están en PRO)
--    Septiembre ya está 'paid' (amount_paid 150.000): no se toca.
--    Agosto ($180.000, vencido, nunca pagado): NO se toca; lo decide Milena (ver informe).
-- -----------------------------------------------------------------------------
UPDATE public.enrollments
   SET offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428',
       monthly_fee      = 150000,
       fee_is_manual    = false,
       fee_reason       = 'Cambio de plan confirmado por Milena 2026-10-05 (planilla sep: $150.000)',
       fee_set_by       = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       fee_set_at       = now()
 WHERE id = '14664f58-36aa-4980-96ba-28eed5de0837'
   AND status = 'active'
   AND offering_plan_id = '622df953-1e5b-477d-92b9-a944227f5f11'
   AND monthly_fee = 180000;

UPDATE public.payments                                       -- octubre 2026
   SET amount = 150000,
       offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428'
 WHERE id = '67685773-eeb1-404f-832a-b4e7d8e3fa32'
   AND status IN ('pending','overdue')
   AND amount = 180000;

-- -----------------------------------------------------------------------------
-- 2. NIETO ROJAS MIA GABRIELA: el pago del 30-ago ($150.000, con comprobante; cobro
--    "agosto" creado el día de la inscripción) es SEPTIEMBRE según la planilla y
--    según Milena. El cobro de septiembre está duplicado: se ANULA.
--    Es el mismo mecanismo con que la app anula cobros (set_school_athlete_status y
--    cancelPendingPlanPayments del BFF): status = 'cancelled'. No se borra.
-- -----------------------------------------------------------------------------
UPDATE public.payments                                       -- septiembre 2026
   SET status = 'cancelled'
 WHERE id = '57420b6d-c8f1-4878-a6d6-da0118e36ed4'
   AND status IN ('pending','overdue')
   AND amount_paid IS NULL;

-- -----------------------------------------------------------------------------
-- 3. NIÑO DANIEL = JULIAN DAVID NIÑO RAMIREZ
--    Planilla (foto 23, fila 25): "Niño Daniel - 2 MESES | 300.000 | Sep 21 | BC".
--    La hoja dice DOS MESES, o sea $150.000 por mes. Van a los dos cobros vencidos
--    (agosto y septiembre, $180.000 cada uno): los dos quedan 'paid' con
--    amount_paid 150.000, igual que las tandas anteriores cuando el papel no
--    coincide con el cobro. Octubre ($180.000) y el plan ELITE NO se tocan.
-- -----------------------------------------------------------------------------
UPDATE public.payments                                       -- agosto 2026
   SET status          = 'paid',
       amount_paid     = 150000,
       payment_date    = '2026-09-21',
       payment_method  = 'transfer',
       payment_channel = 'transfer',
       approved_by     = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       approved_at     = now(),
       reference       = 'PLANILLA-SEP26-41fa045d'
 WHERE id = '41fa045d-db80-4d20-8746-c5e6a58e0d60'
   AND status IN ('pending','overdue')
   AND amount = 180000
   AND amount_paid IS NULL;

UPDATE public.payments                                       -- septiembre 2026
   SET status          = 'paid',
       amount_paid     = 150000,
       payment_date    = '2026-09-21',
       payment_method  = 'transfer',
       payment_channel = 'transfer',
       approved_by     = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       approved_at     = now(),
       reference       = 'PLANILLA-SEP26-91752550'
 WHERE id = '91752550-b81e-451f-8f6e-4017c50059c1'
   AND status IN ('pending','overdue')
   AND amount = 180000
   AND amount_paid IS NULL;

-- 3b. DESCARTAR la ficha "Daniel Niño" de Matrículas por revisar (no se crea otro
--     atleta: es Julián David). Hace lo mismo que el botón "Descartar"
--     (POST /api/v1/enrollment-intake/:id/reject en enrollment-intake.routes.ts):
--     status 'rejected' + rejection_reason + reviewed_by + reviewed_at.
UPDATE public.enrollment_form_intake
   SET status           = 'rejected',
       rejection_reason = 'Es JULIAN DAVID NIÑO RAMIREZ (confirmado por Milena 2026-10-05). Los $300.000 de la planilla se aplicaron a sus cobros de agosto y septiembre.',
       reviewed_by      = '73adf4ca-51f5-4f4a-a6ca-1973c84e8151',
       reviewed_at      = now()
 WHERE id = '2ab9948e-2bbf-477e-82e4-9aa7726504cb'
   AND school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
   AND status = 'waiting_review'
   AND duplicate_of_child_id = '640d1ee2-aac2-41fc-8cae-f029b142e6fb';

-- -----------------------------------------------------------------------------
-- Verificación (revisar ANTES del COMMIT)
-- -----------------------------------------------------------------------------
SELECT c.full_name, p.id, p.period_month AS mes, p.amount, p.amount_paid, p.status,
       p.payment_date, p.reference, op.name AS plan
  FROM public.payments p
  JOIN public.children c ON c.id = p.child_id
  LEFT JOIN public.offering_plans op ON op.id = p.offering_plan_id
 WHERE p.child_id IN ('5e16307b-9c1d-4d18-a17d-6655122b292a',   -- Mora Duarte Andrés
                      'f5e0489b-7711-493b-99dc-ae8ecc95e44a',   -- Nieto Mia
                      '640d1ee2-aac2-41fc-8cae-f029b142e6fb')   -- Niño Julián David
   AND p.period_year = 2026 AND p.period_month BETWEEN 8 AND 10
 ORDER BY 1, 3, p.created_at;
-- Esperado:
--   Mora Duarte: ago overdue 180.000 | sep paid 150.000 | oct pending 150.000 (PRO)
--   Nieto:       ago paid 150.000    | sep cancelled    | oct pending 150.000
--   Niño:        ago paid 150.000    | sep paid 150.000 | oct pending 180.000

SELECT e.id, c.full_name, op.name AS plan, e.monthly_fee, e.fee_reason
  FROM public.enrollments e
  JOIN public.children c ON c.id = e.child_id
  LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
 WHERE e.id = '14664f58-36aa-4980-96ba-28eed5de0837';           -- esperado: PLAN PRO, 150000

SELECT id, extracted->>'athleteFullName' AS atleta, status, rejection_reason, reviewed_at
  FROM public.enrollment_form_intake
 WHERE id = '2ab9948e-2bbf-477e-82e4-9aa7726504cb';             -- esperado: rejected

COMMIT;
