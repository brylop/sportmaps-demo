-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 02 de 14 (orden obligatorio).

-- =============================================================================
-- 20261007183601_wa_atencion_presencial_y_cortesia_indicaciones.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261007182206
-- Objetivo: dos ajustes de texto libre POR ESCUELA para el bot de WhatsApp.
--
--   wa_atencion_presencial   Dónde y cuándo atiende la escuela en persona
--                            (pagos y trámites). Lo usa el bot al responder
--                            «horario de atención / dónde pagar / hasta qué
--                            hora». Ej. Dynasty: «Club de voleibol Coliseo
--                            Dynasty, Cl. 12 Bis #71g-09, Bogotá. Desde las
--                            4 p. m. hasta las 9 p. m.»
--   wa_cortesia_indicaciones Qué llevar y a quién buscar en la clase de
--                            cortesía. Reemplaza el texto genérico del código
--                            en la confirmación de la reserva y en el
--                            recordatorio.
--
-- Por qué texto libre y no `business_hours`: la dueña lo dijo en una frase,
-- sin días; partirlo en filas por día sería inventar los días.
--
-- Mientras esta migración no estaba aplicada, el BFF leía los mismos valores
-- de `schools.payment_settings` (claves `wa_atencion_presencial` y
-- `wa_cortesia_indicaciones`, jsonb legacy que ningún formulario escribe).
-- Aquí se copian a las columnas; las claves se dejan (el código prefiere la
-- columna y cae a la clave solo si la columna está vacía).
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS wa_atencion_presencial text,
    ADD COLUMN IF NOT EXISTS wa_cortesia_indicaciones text;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_wa_atencion_presencial_len') THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_wa_atencion_presencial_len
            CHECK (wa_atencion_presencial IS NULL OR char_length(wa_atencion_presencial) <= 400);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_wa_cortesia_indicaciones_len') THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_wa_cortesia_indicaciones_len
            CHECK (wa_cortesia_indicaciones IS NULL OR char_length(wa_cortesia_indicaciones) <= 400);
    END IF;
END $$;

COMMENT ON COLUMN public.school_settings.wa_atencion_presencial IS
    'Bot WhatsApp: dónde y cuándo atiende la escuela en persona (pagos y trámites). Texto libre; NULL = no se dice.';
COMMENT ON COLUMN public.school_settings.wa_cortesia_indicaciones IS
    'Bot WhatsApp: qué llevar y a quién buscar en la clase de cortesía. NULL = texto genérico.';

-- Copia de lo cargado como puente en schools.payment_settings.
UPDATE public.school_settings ss
   SET wa_atencion_presencial = COALESCE(ss.wa_atencion_presencial,
           NULLIF(btrim(s.payment_settings->>'wa_atencion_presencial'), '')),
       wa_cortesia_indicaciones = COALESCE(ss.wa_cortesia_indicaciones,
           NULLIF(btrim(s.payment_settings->>'wa_cortesia_indicaciones'), ''))
  FROM public.schools s
 WHERE s.id = ss.school_id
   AND (s.payment_settings ? 'wa_atencion_presencial' OR s.payment_settings ? 'wa_cortesia_indicaciones');

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261007183601', '20261007183601_wa_atencion_presencial_y_cortesia_indicaciones', 'sql-editor 2026-10-08') on conflict (version) do nothing;
