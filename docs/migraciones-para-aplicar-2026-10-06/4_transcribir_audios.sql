-- Pegar COMPLETO en el SQL Editor. Notas de voz: interruptor por escuela (apagado por defecto).
-- =============================================================================
-- 20261006092320_whatsapp_transcribir_audios.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006090725
-- Objetivo: flag por escuela para que el bot de WhatsApp transcriba las notas
--           de voz de las FAMILIAS con consentimiento y las conteste como si
--           hubieran escrito (spec docs/specs/whatsapp-notas-de-voz.md, F1, D7).
-- =============================================================================
-- Apagado por defecto: nadie empieza a transcribir por aplicar esto. Se prende
-- por integración (primero Dynasty) con un UPDATE explícito.
--
-- No hace falta nada más en la base: la transcripción se guarda en columnas
-- que ya existen (whatsapp_messages.text_body y whatsapp_messages.payload
-- ->'transcripcion'). El audio NUNCA se guarda.
--
-- Sin esta columna el BFF se comporta como antes («No puedo escuchar notas de
-- voz»): la consulta del flag falla y se lee como apagado.
-- =============================================================================

BEGIN;

ALTER TABLE public.whatsapp_settings
    ADD COLUMN IF NOT EXISTS transcribir_audios boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_settings.transcribir_audios IS
    'Si true, el bot transcribe las notas de voz de familias con consentimiento '
    '(Groq whisper-large-v3, respaldo OpenAI) y las responde como texto. '
    'Nunca para desconocidos, personal ni staff. El audio no se guarda.';

COMMIT;

insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261006092320', '20261006092320_whatsapp_transcribir_audios', 'sql-editor 2026-10-06') on conflict (version) do nothing;
