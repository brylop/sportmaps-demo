-- =============================================================================
-- 20261006232151_whatsapp_transcribir_sin_consentimiento.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261006224322
-- Objetivo: quinto ajuste del asistente por escuela (mismo mecanismo que
-- 20261006120601 / wa_responder_precios: columna wa_* en school_settings, que
-- el admin de la escuela edita con la RLS existente «School settings: manage
-- admin»).
--
-- Con wa_transcribir_sin_consentimiento=true el bot transcribe las notas de
-- voz de familias y prospectos que le escriben a la escuela aunque no hayan
-- aceptado el opt-in de WhatsApp (hoy solo 5 familias de Dynasty lo tienen y
-- al resto se le contesta «No puedo escuchar notas de voz»). Nunca transcribe
-- a contactos personales ni al staff. La presentación del bot agrega una línea
-- de privacidad. Default false: nada cambia para nadie hasta que la escuela lo
-- prenda. El BFF tolera la columna ausente (lee false). Es independiente de
-- whatsapp_settings.transcribir_audios (que sigue exigiendo el opt-in).
-- Sin RLS ni funciones nuevas.
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS wa_transcribir_sin_consentimiento boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.wa_transcribir_sin_consentimiento IS
    'Asistente WhatsApp: transcribe notas de voz de familias y prospectos sin exigir el opt-in (nunca personales ni staff). Funciona aunque whatsapp_settings.transcribir_audios esté apagado.';

COMMIT;
