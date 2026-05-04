-- =========================================================================
-- 20260503000002 — Campos OCR en payments para validar comprobantes manuales.
-- Persiste el resultado del LLM Vision al subir el comprobante para que
-- el admin pueda comparar visualmente OCR vs esperado en la pagina de
-- aprobacion (PaymentsAutomationPage). No bloquea: solo persiste evidencia.
--
-- Uso:
--   - El frontend, al subir el comprobante, llama POST /payments/extract-receipt
--     y guarda el resultado en estos campos al insertar el row.
--   - PaymentsAutomationPage muestra ocr_amount vs amount con badge match/no-match.
-- =========================================================================

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS ocr_amount       numeric,
    ADD COLUMN IF NOT EXISTS ocr_currency     text,
    ADD COLUMN IF NOT EXISTS ocr_date         date,
    ADD COLUMN IF NOT EXISTS ocr_bank         text,
    ADD COLUMN IF NOT EXISTS ocr_reference    text,
    ADD COLUMN IF NOT EXISTS ocr_provider     text;

-- Indice util para listar discrepancias en admin UI ("comprobantes con monto distinto al esperado")
CREATE INDEX IF NOT EXISTS idx_payments_ocr_mismatch
    ON public.payments (school_id, status)
    WHERE ocr_amount IS NOT NULL AND ocr_amount <> amount;

COMMENT ON COLUMN public.payments.ocr_amount    IS 'Monto extraido por LLM Vision del comprobante. NULL si no se pudo leer.';
COMMENT ON COLUMN public.payments.ocr_currency  IS 'Moneda detectada por OCR (COP, USD).';
COMMENT ON COLUMN public.payments.ocr_date      IS 'Fecha extraida por OCR del comprobante (no del registro).';
COMMENT ON COLUMN public.payments.ocr_bank      IS 'Banco emisor detectado (DaviPlata, Nequi, Bancolombia, etc.).';
COMMENT ON COLUMN public.payments.ocr_reference IS 'Numero de operacion/aprobacion extraido del comprobante.';
COMMENT ON COLUMN public.payments.ocr_provider  IS 'Provider de LLM usado (groq, openai, gemini).';
