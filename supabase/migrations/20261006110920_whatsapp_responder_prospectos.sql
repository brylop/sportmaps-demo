-- =============================================================================
-- 20261006110920_whatsapp_responder_prospectos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006104254
-- Objetivo: ajuste por escuela para que el asistente de WhatsApp le conteste
--   al desconocido con intención CLARA de prospecto («estoy interesada en
--   inscribirme», «horarios para pasar a conocer», «clase de cortesía»…)
--   aunque `responder_desconocidos=false` (Coexistence: el número es también el
--   WhatsApp personal de quien dirige la escuela).
--
--   La regla vive en el BFF (whatsapp-atencion.service `puertaDeProspecto`).
--   Default TRUE: es lo que pidió la escuela piloto (Dynasty) y el BFF ya trata
--   la columna ausente como true. FALSE vuelve al comportamiento anterior
--   (solo `temaEscolar`, una vez cada 30 días).
-- =============================================================================

BEGIN;

ALTER TABLE public.whatsapp_settings
    ADD COLUMN IF NOT EXISTS responder_prospectos boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_settings.responder_prospectos IS
    'Con responder_desconocidos=false: igual contestar a desconocidos con intención clara de prospecto (regla sin LLM en el BFF). Default true.';

COMMIT;
