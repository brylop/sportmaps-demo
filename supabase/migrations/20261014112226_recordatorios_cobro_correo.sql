-- =============================================================================
-- 20261014112226_recordatorios_cobro_correo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014105326
-- Objetivo: la cadencia de recordatorios de cobro (20261006101656) también por
--   CORREO, para las familias sin WhatsApp con opt-in. Pedido del usuario
--   2026-10-14 (Besser): hoy un acudiente que no paga recibe 2 correos al mes;
--   la Ley 2300 de 2023 permite hasta 1 contacto por día dentro del horario.
--   Escalera por correo: -3 · 0 · +3 · +10 · +20 días respecto al vencimiento
--   (sin «vence mañana»: un correo el día antes y otro el día de vencer es ruido).
--   La lógica vive en bff/src/services/recordatorios-cobro.service.ts; aquí
--   solo la activación por escuela. collection_notices.channel ya admite 'email'.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- Apagado por defecto: charge_notifications_enabled ya está prendido en varias
-- escuelas (Dynasty, Athletic Soacha…) y prenderles la cadencia sola sería un
-- cambio de comportamiento que nadie pidió.
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS email_collection_reminders_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.email_collection_reminders_enabled IS
    'Cadencia de recordatorios de cobro por CORREO (días -3/0/+3/+10/+20) para familias sin WhatsApp con opt-in. Requiere además charge_notifications_enabled. Apagado por defecto. Migración 20261014112226.';

-- Besser lo pidió (2026-10-14).
UPDATE public.school_settings
   SET email_collection_reminders_enabled = true
 WHERE school_id = '759eee9d-05cb-4958-b84a-2560f77e3683';

COMMIT;
