-- Pegar COMPLETO en el SQL Editor. Tabla de recordatorios de la clase de cortesía (idempotencia entre los 3 BFF).
-- Sin esta tabla el job recordatorio-cortesia NO manda nada.
-- =============================================================================
-- 20261007095845_recordatorio_clase_cortesia.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261006233034
-- Objetivo: registro de los recordatorios de la clase de cortesía que manda el
--   BFF por WhatsApp (job `recordatorio-cortesia`, maintenance.job.ts): uno la
--   VÍSPERA a las 18:00 COT (plantilla UTILITY `recordatorio_clase_cortesia`)
--   y uno el MISMO DÍA ~3 h antes (texto, solo con la ventana de 24 h abierta).
-- =============================================================================
-- Por qué una tabla y no columnas en `school_signup_leads`:
--   · Los tres BFF (dev/stg/prod) comparten la base y los tres disparan el cron.
--     La idempotencia tiene que estar en la base: el BFF RESERVA el envío con un
--     INSERT y solo el que lo logra manda (23505 = otro ya lo tomó). Dos tipos
--     de aviso × una reserva = dos filas; con columnas haría falta un UPDATE
--     condicional por tipo y se pierde el motivo de cada no-envío.
--   · La llave lleva el CUPO (trial_slot_id): si el prospecto cancela y vuelve a
--     reservar otra franja, la nueva reserva tiene sus propios recordatorios.
--   · Queda el porqué de cada aviso no enviado (sin opt-in, plantilla sin
--     aprobar, ventana cerrada) para que la escuela/soporte lo pueda leer.
--
-- Acceso: SOLO service_role (el job). RLS activada y sin policies: anon y
-- authenticated no ven nada. REVOKE explícito porque los default privileges del
-- esquema otorgan a anon/authenticated sobre cada tabla nueva.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.school_trial_reminders (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    lead_id        uuid NOT NULL REFERENCES public.school_signup_leads(id) ON DELETE CASCADE,
    trial_slot_id  uuid NOT NULL REFERENCES public.school_trial_slots(id) ON DELETE CASCADE,
    tipo           text NOT NULL CHECK (tipo IN ('vispera', 'mismo_dia')),
    -- reservado = un BFF lo tomó y está enviando; si se cae a mitad queda así
    -- y NO se reintenta (mejor un recordatorio de menos que dos).
    estado         text NOT NULL DEFAULT 'reservado'
                   CHECK (estado IN ('reservado', 'enviado', 'no_enviado')),
    canal          text CHECK (canal IN ('plantilla', 'texto')),
    contact_wa_id  text,
    wa_message_id  text,
    motivo         text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_school_trial_reminders UNIQUE (lead_id, trial_slot_id, tipo)
);

COMMENT ON TABLE public.school_trial_reminders IS
    'Recordatorios de clase de cortesía enviados por WhatsApp (víspera por plantilla, mismo día por texto). Una fila por (lead, cupo, tipo): el INSERT es la reserva entre los 3 BFF. Solo service_role.';

CREATE INDEX IF NOT EXISTS idx_school_trial_reminders_school
    ON public.school_trial_reminders (school_id, created_at DESC);

ALTER TABLE public.school_trial_reminders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.school_trial_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.school_trial_reminders TO service_role;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación después de aplicar
-- ────────────────────────────────────────────────────────────────────────────
-- SELECT has_table_privilege('anon', 'public.school_trial_reminders', 'SELECT');           -- false
-- SELECT has_table_privilege('authenticated', 'public.school_trial_reminders', 'SELECT');  -- false
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.school_trial_reminders'::regclass; -- true

insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261007095845', '20261007095845_recordatorio_clase_cortesia', 'sql-editor 2026-10-07') on conflict (version) do nothing;
