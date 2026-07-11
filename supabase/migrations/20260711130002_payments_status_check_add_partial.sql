-- ============================================================
-- SPORTMAPS — payments.status: permitir 'partial' en el CHECK (abonos)
-- ------------------------------------------------------------
-- En la DB real payments.status es TEXT con el constraint payments_status_check
-- (NO el enum pay_status). La migración 20260706000002 agregó 'partial' al ENUM,
-- pero el CHECK del TEXT nunca lo incluyó → registrar un abono fallaba con
-- "new row for relation payments violates check constraint payments_status_check".
--
-- Se recrea el CHECK incluyendo 'partial' (y todos los valores vigentes).
-- Fecha: 2026-07-11
-- ============================================================

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status = ANY (ARRAY[
    'pending',
    'paid',
    'overdue',
    'failed',
    'cancelled',
    'awaiting_approval',
    'rejected',
    'partial'
  ]::text[]));

NOTIFY pgrst, 'reload schema';
