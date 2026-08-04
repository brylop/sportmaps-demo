-- ============================================================
-- SPORTMAPS — Agregar payments.ocr_raw_response (faltante en este entorno)
-- Propósito:
--   El frontend (ParentCheckoutPage, PaymentCheckoutModal) escribe
--   ocr_raw_response al registrar un pago manual con comprobante, pero la
--   columna no existe en esta BD → PostgREST devuelve 400 ("Could not find
--   the 'ocr_raw_response' column") → el comprobante del QR nunca se guardaba.
--   Es la respuesta cruda del OCR (LLM) para auditoría; jsonb acepta objeto o
--   string.
-- Fecha: 2026-06-24
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS ocr_raw_response jsonb;

NOTIFY pgrst, 'reload schema';
