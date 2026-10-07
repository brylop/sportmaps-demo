-- =============================================================================
-- PROPUESTA — NO CORRER SIN DECISIÓN DEL USUARIO. NO es una migración.
--
-- Purga del CONTENIDO ya guardado de las conversaciones marcadas
-- contact_kind = 'personal' (auditoría bot WhatsApp Dynasty 2026-10-06, P0-3).
-- Desde el commit del 2026-10-07 el BFF ya no guarda texto ni media de esos
-- contactos (solo dirección, tipo y hora). Lo de antes sigue en la base.
--
-- Medido el 2026-10-06 ~23:40 (solo SELECT): 7 conversaciones personales,
-- 855 mensajes, 719 con text_body.
--
-- Qué hace: deja cada mensaje como metadato (text_body NULL, payload reducido
-- a id/type/timestamp/from/to), y en la cola de adjuntos borra caption, texto
-- y referencias al archivo. NO borra filas (los conteos y las horas siguen).
-- Los ARCHIVOS en Storage (storage_path) hay que borrarlos aparte, desde el
-- panel o con la API de Storage: SQL no los toca. El primer SELECT lista cuáles.
-- =============================================================================

-- 0. Revisar antes (solo lectura).
select c.id, right(c.contact_wa_id, 4) as tel, count(m.id) as mensajes,
       count(m.id) filter (where m.text_body is not null) as con_texto
from public.whatsapp_conversations c
join public.whatsapp_messages m on m.conversation_id = c.id
where c.contact_kind = 'personal'
group by 1, 2;

select q.id, q.storage_path
from public.whatsapp_inbound_queue q
join public.whatsapp_conversations c
  on c.integration_id = q.integration_id and c.contact_wa_id = q.wa_phone_number
where c.contact_kind = 'personal' and q.storage_path is not null;

-- 1. La purga.
BEGIN;

UPDATE public.whatsapp_messages m
SET text_body = NULL,
    payload = jsonb_strip_nulls(jsonb_build_object(
        'privacidad', 'personal_sin_contenido',
        'purgado_at', now(),
        'id', m.payload->'id',
        'type', m.payload->'type',
        'timestamp', m.payload->'timestamp',
        'from', m.payload->'from',
        'to', m.payload->'to',
        'automatico', m.payload->'automatico'
    ))
FROM public.whatsapp_conversations c
WHERE c.id = m.conversation_id
  AND c.contact_kind = 'personal'
  AND (m.text_body IS NOT NULL OR m.payload ? 'text' OR m.payload ? 'image'
       OR m.payload ? 'audio' OR m.payload ? 'document' OR m.payload ? 'video'
       OR m.payload ? 'transcripcion');

UPDATE public.whatsapp_inbound_queue q
SET text_body = NULL,
    media_caption = NULL,
    media_url = NULL,
    pregunta_ocr = NULL
FROM public.whatsapp_conversations c
WHERE c.integration_id = q.integration_id
  AND c.contact_wa_id = q.wa_phone_number
  AND c.contact_kind = 'personal';

-- Verificar: debe dar 0.
select count(*) from public.whatsapp_messages m
join public.whatsapp_conversations c on c.id = m.conversation_id
where c.contact_kind = 'personal' and m.text_body is not null;

COMMIT;
