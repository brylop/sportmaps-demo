-- =============================================================================
-- 20261006233034_wa_queue_result_payment_link.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261006232151
-- Objetivo: que el aviso «la escuela confirmó tu pago» por WhatsApp salga
--   también cuando la familia paga con el LINK de pago con monto que le entregó
--   el bot (crearLinkWompiConMonto, eb1e833d). La aprobación llega por el
--   webhook de Wompi y marca el cobro `paid`, pero whatsapp-payment-outcome.job
--   solo miraba filas de la cola con result_type = 'payment_receipt'.
--
--   El bot deja una fila rastreable al entregar el link
--   (registrarAvisoDePagoPorLink): status 'done', message_type 'payment_link',
--   result_type 'payment_link', result_ref_id = el cobro. Este CHECK no admitía
--   ese result_type. Mientras no se aplique, el código guarda la fila con
--   result_type 'none' y la reconoce por message_type (tolera la ausencia).
--
--   Solo amplía la lista del CHECK y el índice parcial del job. No toca datos.
-- =============================================================================

BEGIN;

ALTER TABLE public.whatsapp_inbound_queue
    DROP CONSTRAINT IF EXISTS chk_wa_queue_result;

ALTER TABLE public.whatsapp_inbound_queue
    ADD CONSTRAINT chk_wa_queue_result CHECK (
        result_type IS NULL
        OR result_type = ANY (ARRAY['payment_receipt', 'glosa', 'escalated', 'none', 'payment_link']::text[])
    );

-- El job de desenlace busca lo que falta avisar por estas dos clases de fila.
DROP INDEX IF EXISTS public.idx_wa_queue_sin_avisar;
CREATE INDEX idx_wa_queue_sin_avisar
    ON public.whatsapp_inbound_queue (result_ref_id)
    WHERE result_type IN ('payment_receipt', 'payment_link') AND outcome_notified_at IS NULL;

COMMIT;
