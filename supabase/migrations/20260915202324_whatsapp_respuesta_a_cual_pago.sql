-- ============================================================================
-- Que la pregunta «¿a cuál de tus cobros lo aplico?» tenga respuesta
--
-- Hoy el worker deja la fila en 'waiting_user' y NADIE la vuelve a leer: el
-- acudiente contesta «al de Sharik» o «1» y ese mensaje se va al LLM, que no
-- sabe que hubo una pregunta ni qué opciones se ofrecieron. El comprobante
-- queda colgado y el padre cree que lo aplicamos.
--
-- Para poder aplicarlo al contestar hacen falta dos cosas que hoy se pierden:
--
--  1. LAS OPCIONES TAL COMO SE OFRECIERON. Sin congelarlas, el «1» se
--     reinterpreta contra los pendientes del momento de la respuesta, que
--     pueden haber cambiado —la escuela aprobó un pago, entró la mensualidad
--     del mes— y el «1» termina señalando otro cobro. Es plata de un tercero:
--     se congela.
--
--  2. EL RESULTADO DEL OCR. Volver a leer la imagen cuesta dinero en cada
--     respuesta y la URL de media de Meta ya expiró.
--
-- Solo columnas nuevas, nullable. Ninguna fila existente cambia.
-- ============================================================================

ALTER TABLE public.whatsapp_inbound_queue
    -- [{payment_id, amount, concept, due_date, child_id, atleta}] en el MISMO
    -- orden en que se numeraron en el mensaje.
    ADD COLUMN IF NOT EXISTS pregunta_opciones jsonb,
    -- La salida del OCR, para estampar el pago sin volver a pagar la lectura.
    ADD COLUMN IF NOT EXISTS pregunta_ocr      jsonb,
    -- Cuándo se preguntó. Una respuesta de tres días después no se aplica:
    -- ya no se sabe a qué se refiere y la ventana de 24h de Meta ni siquiera
    -- deja contestarle.
    ADD COLUMN IF NOT EXISTS pregunta_at       timestamptz;

COMMENT ON COLUMN public.whatsapp_inbound_queue.pregunta_opciones IS
    'Opciones ofrecidas al acudiente, congeladas en el orden numerado del mensaje.';
COMMENT ON COLUMN public.whatsapp_inbound_queue.pregunta_ocr IS
    'Salida del OCR guardada al preguntar, para no releer la imagen al responder.';

-- Buscar «¿este número tiene una pregunta abierta?» en cada mensaje entrante.
-- Parcial: las filas en 'waiting_user' son un puñado; el índice se mantiene
-- diminuto y no pesa sobre los INSERT del camino caliente.
CREATE INDEX IF NOT EXISTS idx_wa_queue_pregunta_abierta
    ON public.whatsapp_inbound_queue (integration_id, wa_phone_number, pregunta_at DESC)
    WHERE status = 'waiting_user';
