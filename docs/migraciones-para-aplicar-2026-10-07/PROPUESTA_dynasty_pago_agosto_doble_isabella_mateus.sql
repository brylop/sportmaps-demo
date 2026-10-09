-- =============================================================================
-- PROPUESTA (NO APLICADA) · Dynasty · «pago de agosto registrado dos veces»
-- Fecha: 2026-10-07 · Decisión de Milena: «revisar si es pago de otro mes».
-- Correr a mano en el SQL editor DESPUÉS de confirmar con Milena el punto (*).
-- =============================================================================
--
-- La familia: Isabella Mateus León, MINIVOLLEY BENJAMINES. Tiene DOS fichas:
--   f9239d15-1e16-4dae-9206-cc18811361fb  «Isabella Mateus Leoon»  ← la buena
--       (acudiente 78b81f97…, inscripción ACTIVA, creada 01-ago al pagar)
--   f65518b9-4497-4b4d-b195-63dcc3767f65  «ISABELLA MATEUS LEON»   ← duplicada
--       (sin acudiente, importada 06-jul, inscripción CANCELADA)
--
-- Los cobros (medido 2026-10-07):
--   6233d90a…  ficha buena  AGOSTO  paid $150.000  transferencia 01-ago,
--              comprobante + OCR $150.000 ref 0000031600        ← agosto real
--   be7064b8…  ficha DUPL.  AGOSTO  paid $150.000  EFECTIVO 12-sep 08:53:38 ← el doble
--   d8344f6c…  ficha buena  SEPT.   paid $150.000  EFECTIVO 12-sep 08:54:01
--   64e9e5e5…  ficha buena  OCTUBRE pending $150.000
--
-- Lectura: el 12-sep Milena registró dos efectivos de $150.000 con 23 s de
-- diferencia, uno en cada ficha. Agosto ya estaba pagado por transferencia desde
-- el 01-ago, así que el efectivo marcado «agosto» en la ficha duplicada NO es
-- agosto. Si fueron $300.000 en efectivo ese día, el segundo corresponde a
-- OCTUBRE (el único mes pendiente de la familia). Las planillas de septiembre
-- (docs/dynasty-planillas-septiembre-2026, foto 27 fila 32) muestran UN solo
-- «Sep 12 Efectivo» para Mateus León Isabella.
--
-- (*) CONFIRMAR CON MILENA antes de correr: el 12-sep, ¿recibió $300.000
--     (septiembre + octubre adelantado) o $150.000?
--       · $300.000 → OPCIÓN A (reasignar a octubre).
--       · $150.000 → OPCIÓN B (fue el mismo dinero anotado dos veces: anular).
-- =============================================================================

-- ── Antes (correr y guardar la salida) ───────────────────────────────────────
SELECT id, child_id, period_year, period_month, status, amount, amount_paid,
       payment_date, payment_method, concept
  FROM public.payments
 WHERE id IN ('6233d90a-7009-4c71-8046-bc9565cbbf81', 'be7064b8-c19a-47c0-a80b-dd0aaa13fac4',
              'd8344f6c-27c9-4be1-849e-2808fa7e892c', '64e9e5e5-e0b1-4837-b492-0061c8952a4a')
 ORDER BY period_month, payment_date;

-- ── OPCIÓN A: el efectivo «agosto» de la ficha duplicada es OCTUBRE ──────────
-- Se mueve la fila pagada (conserva fecha, método, aprobación y auditoría) a la
-- ficha buena y a octubre, y se anula el cobro pendiente de octubre que la
-- reemplaza. El orden importa: primero anular el pendiente (índice único de
-- periodo activo), después mover.
BEGIN;

UPDATE public.payments
   SET status = 'cancelled',
       updated_at = now()
 WHERE id = '64e9e5e5-e0b1-4837-b492-0061c8952a4a'
   AND status = 'pending'
   AND child_id = 'f9239d15-1e16-4dae-9206-cc18811361fb'
   AND period_year = 2026 AND period_month = 10;
-- Debe decir UPDATE 1.

UPDATE public.payments
   SET child_id     = 'f9239d15-1e16-4dae-9206-cc18811361fb',
       parent_id    = '78b81f97-e09c-4bd8-bc15-810e993a188e',
       period_year  = 2026,
       period_month = 10,
       concept      = 'Mensualidad 10/2026 - Isabella Mateus Leoon (efectivo 12-sep, reasignado desde agosto de la ficha duplicada)',
       updated_at   = now()
 WHERE id = 'be7064b8-c19a-47c0-a80b-dd0aaa13fac4'
   AND status = 'paid'
   AND child_id = 'f65518b9-4497-4b4d-b195-63dcc3767f65'
   AND period_year = 2026 AND period_month = 8;
-- Debe decir UPDATE 1. Si alguno da 0, ROLLBACK y volver a medir.

COMMIT;

-- ── OPCIÓN B (alternativa, comentada): fue el mismo efectivo anotado dos veces ─
-- BEGIN;
-- UPDATE public.payments
--    SET status = 'cancelled',
--        rejection_reason = 'Duplicado: el efectivo del 12-sep ya está en septiembre de la ficha buena (d8344f6c). Confirmado con Milena 2026-10.',
--        updated_at = now()
--  WHERE id = 'be7064b8-c19a-47c0-a80b-dd0aaa13fac4'
--    AND status = 'paid'
--    AND child_id = 'f65518b9-4497-4b4d-b195-63dcc3767f65';
-- COMMIT;
-- (Ojo: con B el ingreso de la caja de ese día baja $150.000; revisar que la
--  planilla de efectivo del 12-sep cuadre con eso.)

-- ── Después ──────────────────────────────────────────────────────────────────
SELECT id, child_id, period_year, period_month, status, amount, amount_paid,
       payment_date, payment_method, concept
  FROM public.payments
 WHERE child_id IN ('f9239d15-1e16-4dae-9206-cc18811361fb', 'f65518b9-4497-4b4d-b195-63dcc3767f65')
 ORDER BY period_month, created_at;
-- Esperado con A: ficha buena con ago (transfer), sep (efectivo), oct (efectivo
-- 12-sep) pagados; octubre pendiente anulado; la ficha duplicada sin cobros vivos.
