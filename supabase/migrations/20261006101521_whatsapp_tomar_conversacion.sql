-- =============================================================================
-- 20261006101521_whatsapp_tomar_conversacion.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006094149
-- Objetivo: «Tomar la conversación» en el buzón de WhatsApp (mejora 9).
--
-- Una persona de la escuela toma una conversación y, mientras `tomada_hasta`
-- esté en el futuro, el asistente no le escribe NADA automático a esa familia
-- (ni modelo, ni acuses, ni cortesía, ni ausencias, ni avisos de comprobante).
-- Se libera con «Soltar» (las dos columnas a NULL) o sola al vencer.
--
-- Acceso: solo por el BFF (service role). La tabla tiene SELECT para admins y
-- ninguna policy de escritura para `authenticated`, así que no hace falta RLS
-- nueva: nadie puede tomar/soltar desde el cliente.
--
-- La FK va a profiles(id) (convención). ON DELETE SET NULL: si se borra la
-- persona, la conversación queda libre (el trigger de abajo limpia también
-- `tomada_hasta`, y el BFF trata «sin tomada_por» como libre).
-- =============================================================================

BEGIN;

ALTER TABLE public.whatsapp_conversations
    ADD COLUMN IF NOT EXISTS tomada_por   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tomada_hasta timestamptz;

COMMENT ON COLUMN public.whatsapp_conversations.tomada_por IS
    'Persona de la escuela que tomó la conversación desde el buzón. Con tomada_hasta > now() el asistente no escribe nada automático.';
COMMENT ON COLUMN public.whatsapp_conversations.tomada_hasta IS
    'Hasta cuándo está tomada. Vencida = libre (no hace falta limpiarla). «Soltar» la deja en NULL.';

-- Un borrado de la persona deja tomada_por NULL por la FK; sin esto quedaría
-- tomada_hasta vigente y sin dueño. La conversación sin dueño se considera libre.
CREATE OR REPLACE FUNCTION public.wa_conv_tomada_sin_dueno()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.tomada_por IS NULL THEN
        NEW.tomada_hasta := NULL;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.wa_conv_tomada_sin_dueno() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_wa_conv_tomada_sin_dueno ON public.whatsapp_conversations;
CREATE TRIGGER trg_wa_conv_tomada_sin_dueno
    BEFORE UPDATE OF tomada_por ON public.whatsapp_conversations
    FOR EACH ROW EXECUTE FUNCTION public.wa_conv_tomada_sin_dueno();

-- El bot consulta por id (PK); el índice parcial es para el buzón/métricas.
CREATE INDEX IF NOT EXISTS idx_wa_conv_tomada
    ON public.whatsapp_conversations (school_id, tomada_hasta)
    WHERE tomada_por IS NOT NULL;

COMMIT;
