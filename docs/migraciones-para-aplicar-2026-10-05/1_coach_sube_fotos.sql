-- Pegar COMPLETO en el SQL Editor. Va ANTES de aplicar_config_dynasty_2026-10-05.sql (bloque C).
-- =============================================================================
-- 20261005120806_coach_sube_fotos_matricula_y_asistencia.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005112635
-- Objetivo: que la escuela decida si sus entrenadores pueden SUBIR fotos de
--   hojas de matrícula y de planillas de asistencia (D2 de
--   docs/specs/fotos-de-planillas-y-autorregistro.md). Pedido de Dynasty,
--   2026-10-05 ("dejar la opción").
--
-- Mismo patrón que coach_can_create_athletes (20260828174117) y
--   coach_can_edit_categories (20260903144504): toggles en school_settings,
--   default false = comportamiento de HOY (solo admin sube matrículas).
--   El gate vive en el BFF (POST /api/v1/enrollment-intake/upload corre con
--   service role y salta RLS); esta migración NO toca policies ni funciones.
--   El coach SUBE; aprobar/vincular/rechazar la ficha sigue siendo solo de
--   admin (D2: "coach sube, admin aprueba").
--
-- coach_can_upload_attendance_sheets: la asistencia por foto (F1 del spec)
--   todavía NO existe como feature. Se deja solo el permiso para que el
--   endpoint de F1 lo lea desde el primer día, sin otra migración.
--
-- NO activa nada para ninguna escuela: el UPDATE de Dynasty va en
--   docs/dynasty-planillas-septiembre-2026/aplicar_config_dynasty_2026-10-05.sql.
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

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_can_upload_enrollment_forms boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS coach_can_upload_attendance_sheets boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.coach_can_upload_enrollment_forms IS
    'Si true, un entrenador (coach) de la escuela puede SUBIR la foto de una hoja '
    'de matrícula (POST /api/v1/enrollment-intake/upload). Revisar y aprobar la '
    'ficha sigue siendo solo de admin. Default false.';

COMMENT ON COLUMN public.school_settings.coach_can_upload_attendance_sheets IS
    'Si true, un entrenador (coach) podrá subir la foto de la planilla de '
    'asistencia de SUS equipos (F1 de docs/specs/fotos-de-planillas-y-autorregistro.md, '
    'aún sin construir). Default false.';

COMMIT;

insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261005120806', '20261005120806_coach_sube_fotos_matricula_y_asistencia', 'sql-editor 2026-10-05') on conflict (version) do nothing;
