-- =============================================================================
-- 20261004074523_matricula_por_foto_desde_app.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003230016
-- Objetivo: F2 de docs/specs/fotos-de-planillas-y-autorregistro.md — subir la
--   foto de la hoja de matrícula DESDE LA APP, no solo por WhatsApp.
--
--   enrollment_form_intake nació para WhatsApp: integration_id, wa_message_id,
--   wa_phone_number y media_id eran NOT NULL. La dueña de Dynasty no puede
--   mandarse la foto a sí misma (el número de la escuela es el suyo), así que
--   la fila también puede venir de la app, sin nada de WhatsApp.
--
--   1. Esas 4 columnas pasan a admitir NULL.
--   2. source text + CHECK ('whatsapp' | 'app'), default 'whatsapp' (las filas
--      existentes y el worker de WhatsApp no cambian).
--   3. uploaded_by → profiles(id): quién subió la foto desde la app.
--   4. CHECK de coherencia: una fila de WhatsApp sigue exigiendo sus 4 datos;
--      una de la app exige uploaded_by.
--
--   No toca RLS: la tabla solo la escribe el BFF (service_role).
--   La FK compuesta (integration_id, school_id) es MATCH SIMPLE: con
--   integration_id NULL no se evalúa, que es lo que se quiere.
-- Radio: 4 filas existentes, todas source='whatsapp' con sus 4 datos.
-- Rollback: migración nueva que borre las filas source='app' y revierta.
-- =============================================================================

BEGIN;

ALTER TABLE public.enrollment_form_intake
    ALTER COLUMN integration_id  DROP NOT NULL,
    ALTER COLUMN wa_message_id   DROP NOT NULL,
    ALTER COLUMN wa_phone_number DROP NOT NULL,
    ALTER COLUMN media_id        DROP NOT NULL;

ALTER TABLE public.enrollment_form_intake
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'whatsapp',
    ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.enrollment_form_intake
    DROP CONSTRAINT IF EXISTS chk_enrollment_intake_source;
ALTER TABLE public.enrollment_form_intake
    ADD CONSTRAINT chk_enrollment_intake_source CHECK (source IN ('whatsapp', 'app'));

ALTER TABLE public.enrollment_form_intake
    DROP CONSTRAINT IF EXISTS chk_enrollment_intake_origen_coherente;
ALTER TABLE public.enrollment_form_intake
    ADD CONSTRAINT chk_enrollment_intake_origen_coherente CHECK (
        (source = 'whatsapp'
            AND integration_id  IS NOT NULL
            AND wa_message_id   IS NOT NULL
            AND wa_phone_number IS NOT NULL
            AND media_id        IS NOT NULL)
        OR
        (source = 'app' AND uploaded_by IS NOT NULL)
    );

COMMENT ON COLUMN public.enrollment_form_intake.source IS
  'Por dónde llegó la foto: whatsapp (worker de la cola) o app (subida en /school/enrollment-intake).';
COMMENT ON COLUMN public.enrollment_form_intake.uploaded_by IS
  'Quién subió la foto desde la app. NULL para las que llegan por WhatsApp.';

COMMIT;
