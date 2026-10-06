-- Pegar COMPLETO en el SQL Editor.
-- 20261006104254: reemplaza a 20261006101628, que NUNCA se aplicó: falló en el SQL Editor con
-- 42883 «operator does not exist: uuid = uuid[]». `x = ANY ((SELECT fn()))` se lee
-- como subconsulta (filas de uuid[]); con `::uuid[]` es un arreglo y conserva el initplan.
-- Mismo contenido que 20261006101628 salvo ese cast (1 sitio/s). 20261006101628 NO se aplica.
-- =============================================================================
-- 20261006104254_aviso_ausencia_familia.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006101521
-- Objetivo: guardar el AVISO de ausencia que da la familia («mi hija no puede
--   ir hoy», «Juan no va mañana, está enfermo») por WhatsApp, para que el
--   entrenador lo vea en la lista y la marque «excusado» al tomar asistencia.
-- =============================================================================
-- Por qué una tabla y no `attendance_records(status='excused')` directo:
--   · El aviso llega ANTES de que exista la sesión del día (la crea el coach al
--     guardar la lista). Un registro con `session_id NULL` quedaría duplicado
--     cuando el coach guarde (el dedup real es (session_id, persona)).
--   · Si el aviso entra como registro, `GET /attendance/session/:teamId`
--     devuelve records ≠ [] y la pantalla deja de precargar «todos presentes»:
--     un solo aviso desarmaba la lista de todo el equipo.
--   El aviso se cruza en el roster del BFF y la pantalla precarga «excusado»;
--   el registro real lo sigue escribiendo el coach. 'excused' NO descuenta
--   créditos de sesión (solo 'present' descuenta), así que no hay que tocar
--   `enrollments`.
-- Escritura: solo el BFF (service role). No hay policies de escritura.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.athlete_absence_notices (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    child_id        uuid REFERENCES public.children(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    absence_date    date NOT NULL,
    reason          text,
    note            text,
    source          text NOT NULL DEFAULT 'whatsapp',
    status          text NOT NULL DEFAULT 'active',
    reported_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT athlete_absence_notices_one_athlete
        CHECK ((child_id IS NOT NULL)::int + (user_id IS NOT NULL)::int = 1),
    CONSTRAINT athlete_absence_notices_reason_check
        CHECK (reason IS NULL OR reason IN
            ('enfermedad', 'cita_medica', 'viaje', 'lesion', 'colegio', 'familiar', 'otro')),
    CONSTRAINT athlete_absence_notices_source_check
        CHECK (source IN ('whatsapp', 'app', 'staff')),
    CONSTRAINT athlete_absence_notices_status_check
        CHECK (status IN ('active', 'cancelled')),
    CONSTRAINT athlete_absence_notices_note_len
        CHECK (note IS NULL OR char_length(note) <= 500)
);

COMMENT ON TABLE public.athlete_absence_notices IS
    'Aviso de ausencia dado por la familia (WhatsApp). El roster de asistencia lo cruza y precarga «excusado». No descuenta créditos.';

-- Un aviso activo por atleta y día: el segundo «no va hoy» es el mismo aviso.
CREATE UNIQUE INDEX IF NOT EXISTS uq_athlete_absence_notice_day
    ON public.athlete_absence_notices (school_id, COALESCE(child_id, user_id), absence_date)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_athlete_absence_notices_school_date
    ON public.athlete_absence_notices (school_id, absence_date);

ALTER TABLE public.athlete_absence_notices ENABLE ROW LEVEL SECURITY;

-- Lectura: quien TRABAJA en la escuela (staff, sin padres/atletas ajenos), el
-- acudiente de su hijo y el atleta adulto de su propio aviso.
DROP POLICY IF EXISTS athlete_absence_notices_select ON public.athlete_absence_notices;
CREATE POLICY athlete_absence_notices_select ON public.athlete_absence_notices
    FOR SELECT TO authenticated
    USING (
        school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
        OR user_id = (SELECT auth.uid())
        OR child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = (SELECT auth.uid()))
    );

REVOKE ALL ON public.athlete_absence_notices FROM anon;
REVOKE ALL ON public.athlete_absence_notices FROM authenticated;
GRANT SELECT ON public.athlete_absence_notices TO authenticated;
GRANT ALL ON public.athlete_absence_notices TO service_role;

COMMIT;

-- Registro (SQL Editor no deja rastro):
-- insert into supabase_migrations.schema_migrations(version,name) values ('20261006104254','aviso_ausencia_familia_v2') on conflict do nothing;
