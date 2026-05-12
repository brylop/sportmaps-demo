-- =========================================================================
-- 20260511000005 — Persistir respuesta cruda del LLM Vision para auditoria.
--
-- Hoy guardamos los campos extraidos (ocr_amount, ocr_date, ocr_reference, ...)
-- pero descartamos el JSON crudo del modelo. Cuando un admin sospecha que el
-- OCR alucino o que un comprobante fue manipulado, no tiene forma de ver
-- exactamente que respondio el LLM.
--
-- Agregamos ocr_raw_response (jsonb, nullable) que persiste el response del
-- provider tal cual. El frontend lo envia desde useReceiptValidator y el
-- admin lo puede inspeccionar en PaymentsAutomationPage cuando haya disputa.
-- =========================================================================

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS ocr_raw_response jsonb;

COMMENT ON COLUMN public.payments.ocr_raw_response IS
    'Respuesta cruda del LLM Vision (Groq/OpenAI/Gemini) al procesar el comprobante. Auditoria/forensia cuando hay disputa sobre lo que extrajo el OCR.';
