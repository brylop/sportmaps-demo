-- ============================================================
-- SPORTMAPS — Config de Abonos (pagos parciales) persistente
-- ------------------------------------------------------------
-- PROBLEMA:
--   La tarjeta "Abonos (Pagos Parciales)" del panel de Automatización de
--   Pagos edita allow_installments / max_installments_per_payment /
--   min_installment_amount / installment_require_proof, pero:
--     1) esas columnas NO existían en school_settings, y
--     2) handleSaveBilling nunca las incluyó en el payload.
--   Resultado: el toggle se veía pero jamás se guardaba, y el flujo de
--   comprobante (OCR) aceptaba montos inferiores como "abono" aunque la
--   escuela tuviera abonos desactivados.
--
-- FIX (parte DB): agregar las columnas con defaults sensatos. El save del
-- frontend y el gate del OCR se cablean aparte.
-- Fecha: 2026-07-13
-- ============================================================

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS allow_installments           boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_installments_per_payment integer NOT NULL DEFAULT 3
        CHECK (max_installments_per_payment >= 1),
    ADD COLUMN IF NOT EXISTS min_installment_amount       numeric NOT NULL DEFAULT 0
        CHECK (min_installment_amount >= 0),
    ADD COLUMN IF NOT EXISTS installment_require_proof     boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.school_settings.allow_installments IS
    'Si la escuela permite pagos parciales (abonos). Si es false, el OCR bloquea comprobantes por menos del valor esperado.';
COMMENT ON COLUMN public.school_settings.max_installments_per_payment IS
    'Máximo de abonos permitidos por mensualidad.';
COMMENT ON COLUMN public.school_settings.min_installment_amount IS
    'Monto mínimo por abono (COP). 0 = sin mínimo.';
COMMENT ON COLUMN public.school_settings.installment_require_proof IS
    'Si se exige subir comprobante en cada abono.';

NOTIFY pgrst, 'reload schema';
