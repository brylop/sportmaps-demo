-- =============================================================================
-- 20261006120601_whatsapp_ajustes_por_escuela.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006111003
-- Objetivo: ajustes del asistente de WhatsApp POR ESCUELA, apagados por
-- defecto, para personalizar sin tocar al resto (pedido de Besser):
--   · wa_modo_cortesia     'clase' (lo de hoy: agenda una clase suelta) |
--                          'semana_app' (manda el paso a paso del enlace de
--                          cortesía para entrar a la app y entrenar N días).
--   · wa_cortesia_qr_id    el QR/enlace de cortesía (school_join_qr_codes).
--   · wa_cortesia_dias     cuántos días dura la cortesía (texto al prospecto).
--   · wa_ayuda_app         responde «no puedo entrar», «olvidé la clave»,
--                          «cómo pago en la app» con el paso a paso.
--   · wa_reclamos_de_valor «el valor no coincide» va al buzón como reclamo,
--                          con los cobros abiertos de la familia.
-- Spec: docs/specs/whatsapp-ajustes-por-escuela.md
--
-- Por qué en school_settings y no en whatsapp_settings: whatsapp_settings es
-- por INTEGRACIÓN y no existe hasta que la escuela conecta su número. Estos
-- ajustes se dejan listos ANTES de conectar.
--
-- Sin cambios de RLS ni funciones: columnas nuevas de una tabla que ya tiene
-- sus policies. Los defaults reproducen el comportamiento actual, así que
-- aplicar esto no cambia nada para ninguna escuela.
-- El QR de otra escuela no se puede «colar»: el BFF exige que el QR sea de la
-- misma escuela, esté activo, sin vencer y sin cobro inicial; si no, ignora el
-- ajuste y responde como antes.
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS wa_modo_cortesia     text     NOT NULL DEFAULT 'clase',
    ADD COLUMN IF NOT EXISTS wa_cortesia_qr_id    uuid     NULL,
    ADD COLUMN IF NOT EXISTS wa_cortesia_dias     smallint NOT NULL DEFAULT 7,
    ADD COLUMN IF NOT EXISTS wa_ayuda_app         boolean  NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS wa_reclamos_de_valor boolean  NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_wa_modo_cortesia_chk') THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_wa_modo_cortesia_chk
            CHECK (wa_modo_cortesia IN ('clase', 'semana_app'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_wa_cortesia_dias_chk') THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_wa_cortesia_dias_chk
            CHECK (wa_cortesia_dias BETWEEN 1 AND 60);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_wa_cortesia_qr_fk') THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_wa_cortesia_qr_fk
            FOREIGN KEY (wa_cortesia_qr_id) REFERENCES public.school_join_qr_codes(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN public.school_settings.wa_modo_cortesia IS
    'Asistente WhatsApp: clase = agenda una clase de cortesía suelta (default); semana_app = manda el paso a paso del enlace wa_cortesia_qr_id.';
COMMENT ON COLUMN public.school_settings.wa_cortesia_qr_id IS
    'QR/enlace de cortesía (sin cobro inicial) que el asistente manda en modo semana_app. Debe ser de la misma escuela.';
COMMENT ON COLUMN public.school_settings.wa_cortesia_dias IS
    'Días de cortesía que el asistente le anuncia al prospecto en modo semana_app.';
COMMENT ON COLUMN public.school_settings.wa_ayuda_app IS
    'Asistente WhatsApp: responde preguntas de ingreso a la app (entrar, contraseña, pagar en la app).';
COMMENT ON COLUMN public.school_settings.wa_reclamos_de_valor IS
    'Asistente WhatsApp: «el valor no coincide» abre la conversación en el buzón como reclamo, con los cobros abiertos.';

COMMIT;
