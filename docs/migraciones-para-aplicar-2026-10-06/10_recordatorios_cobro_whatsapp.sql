-- ============================================================================
-- Recordatorios de cobro por WhatsApp (cadencia) — 2026-10-06
--
-- Escalera (bff/src/services/recordatorios-cobro.service.ts):
--   día -3 recordatorio_previo · -1 vence_manana · 0 vence_hoy ·
--   +3 pendiente_suave · +10 pendiente_directo · +20 aviso_final
-- Solo por plantilla APROBADA (UTILITY) de la WABA de la escuela y solo a
-- familias con opt-in (wa_can_send_template).
--
-- Dos cosas en la base, porque los tres BFF (dev/stg/prod) comparten esta
-- Supabase y corren el mismo cron a la misma hora:
--
--   1. collection_notices — una fila por (cobro, escalón). UNIQUE(payment_id,
--      notice_type): el mismo escalón de un cobro no sale dos veces nunca.
--      Nombre y forma tomados del spec docs/specs/cobranza-vencidos-estados-
--      y-alertas.md §4.3, con los escalones reales de las plantillas.
--   2. Candado familia-día — índice único parcial (school_id, family_key,
--      contact_day) WHERE is_lead: cada contacto tiene UNA fila "líder"; el
--      segundo proceso que intente contactar a la misma familia el mismo día
--      choca (23505) y no manda nada. Ley 2300 de 2023: máx. 1 contacto de
--      cobranza por día.
--
--   3. school_settings.whatsapp_collection_reminders_enabled (default false):
--      activación explícita por escuela. charge_notifications_enabled ya está
--      prendido en escuelas como Dynasty; sin este flag aplicar la migración
--      prendería la cadencia sola.
--
-- Estados/canales: text + CHECK (convención del repo, no CREATE TYPE).
-- Solo el BFF (service_role) lee y escribe: RLS activado y sin policies para
-- anon/authenticated; la escuela la verá por una RPC/vista cuando haya
-- pantalla (no hace falta para operar).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.collection_notices (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    payment_id     uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    notice_type    text NOT NULL CHECK (notice_type IN (
                       'recordatorio_previo', 'vence_manana', 'vence_hoy',
                       'pendiente_suave', 'pendiente_directo', 'aviso_final')),
    channel        text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'push', 'in_app')),
    -- 'wa:<wa_id>' (o el correo): quién recibió el contacto.
    family_key     text NOT NULL,
    -- Día del contacto en hora de Bogotá (no el UTC del servidor).
    contact_day    date NOT NULL,
    -- La fila que representa el contacto del día (una por mensaje).
    is_lead        boolean NOT NULL DEFAULT false,
    status         text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent', 'failed')),
    wa_message_id  text,
    detail         text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    sent_at        timestamptz,
    CONSTRAINT collection_notices_payment_notice_uq UNIQUE (payment_id, notice_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS collection_notices_family_day_uq
    ON public.collection_notices (school_id, family_key, contact_day)
    WHERE is_lead;

CREATE INDEX IF NOT EXISTS collection_notices_school_day_idx
    ON public.collection_notices (school_id, contact_day);

ALTER TABLE public.collection_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collection_notices FROM anon, authenticated;

COMMENT ON TABLE public.collection_notices IS
    'Recordatorios de cobro enviados por escalón (uno por cobro y escalón) y candado de 1 contacto por familia y día (is_lead). Lo escribe solo el BFF: recordatorios-cobro.service.';

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS whatsapp_collection_reminders_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.whatsapp_collection_reminders_enabled IS
    'Cadencia de recordatorios de cobro por WhatsApp (días -3/-1/0/+3/+10/+20). Requiere además charge_notifications_enabled. Apagado por defecto.';
