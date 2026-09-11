-- ============================================================================
-- whatsapp_inbound_queue.media_id — el identificador que manda Meta
--
-- La tabla tenía `media_url`, pero el webhook de Meta NO manda una URL: manda un
-- **media id** (p. ej. "1234567890123456") que hay que resolver contra Graph en
-- dos saltos para obtener la URL temporal y recién ahí el binario.
--
-- Guardar ese id en una columna llamada `_url` es exactamente la clase de cosa
-- que le cuesta horas al siguiente que lea el código. Se agrega la columna con
-- el nombre correcto y `media_url` queda para lo que su nombre dice: la URL
-- temporal, si alguna vez se decide conservarla (hoy no, porque expira).
-- ============================================================================

ALTER TABLE public.whatsapp_inbound_queue
    ADD COLUMN IF NOT EXISTS media_id text;

COMMENT ON COLUMN public.whatsapp_inbound_queue.media_id IS
    'Media id de Meta. Se resuelve contra Graph en dos saltos para bajar el archivo; '
    'el segundo salto EXIGE el header de autorización aunque la URL parezca pública.';
COMMENT ON COLUMN public.whatsapp_inbound_queue.media_url IS
    'URL temporal de Meta. Normalmente NULL: expira en minutos, por eso el archivo '
    'se guarda en el bucket (storage_path) apenas se baja.';

CREATE INDEX IF NOT EXISTS idx_wa_queue_media_id
    ON public.whatsapp_inbound_queue (media_id)
    WHERE media_id IS NOT NULL;
