-- =========================================================================
-- 20260511000004 — Dedup de comprobantes OCR por escuela.
--
-- Problema:
--   Hasta hoy, un usuario podia subir el mismo comprobante bancario (mismo
--   numero de operacion/aprobacion) para "pagar" varios pagos pendientes.
--   El admin tenia que detectarlo manualmente en PaymentsAutomationPage.
--
-- Solucion:
--   UNIQUE INDEX parcial sobre (school_id, ocr_reference) cuando ocr_reference
--   no es NULL. Asi el segundo intento de uso del mismo comprobante explota
--   con error 23505 al insertar en payments y el frontend muestra mensaje.
--
-- Notas:
--   - Indice parcial (WHERE ocr_reference IS NOT NULL) para no rechazar
--     pagos sin OCR (efectivo, transferencia sin comprobante, Wompi, etc.).
--   - school_id incluido en la clave porque cada escuela tiene su propio
--     pool de pagos: no es problema si dos escuelas distintas ven el mismo
--     numero de operacion.
--   - Si OCR alucinó el reference y dos comprobantes legítimos cayeron en
--     el mismo string, el admin puede limpiar payments.ocr_reference =
--     NULL en el row viejo para destrabar el nuevo.
-- =========================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_school_ocr_reference
    ON public.payments (school_id, ocr_reference)
    WHERE ocr_reference IS NOT NULL;

COMMENT ON INDEX public.uq_payments_school_ocr_reference IS
    'Evita reuso de comprobantes: una misma operacion bancaria solo puede vincularse a un pago por escuela.';
