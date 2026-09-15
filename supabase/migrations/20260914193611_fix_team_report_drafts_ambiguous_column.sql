-- =============================================================================
-- 20260914193611_fix_team_report_drafts_ambiguous_column.sql
-- Autor: brylop   Fecha: 2026-09-15   Versión anterior: 20260914184316
-- Objetivo: fix de `generate_team_report_drafts_system()` (20260914151925) —
-- fallaba con "column reference "school_id" is ambiguous" para TODAS las
-- escuelas, siempre, desde que se creó. Detectado al cablear el cron
-- (bff/src/jobs/team-reports.job.ts) y probarlo contra la base viva.
-- =============================================================================
-- Causa raíz: la función RETURNS TABLE(school_id uuid, created integer,
-- error_msg text) — el OUT param `school_id` tiene el MISMO nombre que la
-- columna `team_reports.school_id`. El INSERT de adentro hace
-- `ON CONFLICT (school_id, team_id, period_year, period_month)`: Postgres
-- resuelve el target de conflicto contra las columnas de la tabla, pero
-- PL/pgSQL también intenta resolver `school_id` como su variable OUT en ese
-- mismo contexto — ambas lecturas son válidas y por eso es "ambiguo", no un
-- error de sintaxis. Confirmado en la base viva: TODAS las escuelas devuelven
-- error_msg = esa frase, created = 0 (probado 2026-09-14 vía
-- generate_team_report_drafts_system() y también generate_report_drafts_system(),
-- que tiene el MISMO patrón — ver nota al final, fuera del alcance de esta
-- migración).
--
-- Fix estándar de PL/pgSQL para esto: la directiva `#variable_conflict
-- use_column`, que le dice al compilador que ante una ambigüedad columna vs.
-- variable/OUT-param, gane la columna — que es lo que la función siempre
-- quiso decir (nunca se pretendió leer el OUT param todavía sin asignar
-- dentro de la CTE). No se toca la firma de la función (mismos nombres de
-- columna en el resultado), así que `team-reports.job.ts` no necesita cambios.
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

CREATE OR REPLACE FUNCTION public.generate_team_report_drafts_system()
RETURNS TABLE(school_id uuid, created integer, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v_school  record;
    v_year    smallint := EXTRACT(YEAR  FROM (now() AT TIME ZONE 'America/Bogota'))::smallint;
    v_month   smallint := EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Bogota'))::smallint;
    v_creados integer;
BEGIN
    FOR v_school IN SELECT id FROM public.schools LOOP
        BEGIN
            WITH equipos_con_sesiones AS (
                SELECT DISTINCT s.team_id
                  FROM public.attendance_sessions s
                  JOIN public.performance_entries pe
                    ON pe.context_type = 'session' AND pe.context_id = s.id
                 WHERE s.school_id = v_school.id
                   AND s.session_date >= make_date(v_year::int, v_month::int, 1)
                   AND s.session_date <  (make_date(v_year::int, v_month::int, 1) + INTERVAL '1 month')::date
            )
            INSERT INTO public.team_reports (school_id, team_id, period_year, period_month, status)
            SELECT v_school.id, e.team_id, v_year, v_month, 'borrador'
              FROM equipos_con_sesiones e
            ON CONFLICT (school_id, team_id, period_year, period_month) DO NOTHING;

            GET DIAGNOSTICS v_creados = ROW_COUNT;
            school_id := v_school.id; created := v_creados; error_msg := NULL;
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            school_id := v_school.id; created := 0; error_msg := SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_team_report_drafts_system() IS
    'F4: genera borradores de informe DE EQUIPO del periodo en curso, para todas '
    'las escuelas. Solo service_role. #variable_conflict use_column (fix '
    '20260914193611): sin esto, ON CONFLICT(school_id,...) es ambiguo contra el '
    'OUT param homónimo.';

-- GRANT/REVOKE ya quedaron correctos en 20260914151925; CREATE OR REPLACE no
-- los toca, pero se repiten explícitos por si alguna vez cambia el default.
REVOKE ALL ON FUNCTION public.generate_team_report_drafts_system() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_team_report_drafts_system() TO service_role;

COMMIT;

-- =============================================================================
-- NOTA — mismo bug, fuera del alcance de esta migración:
-- `generate_report_drafts_system()` (20260814173709, el ciclo del informe
-- INDIVIDUAL del atleta, YA EN PRODUCCIÓN desde el 14 de agosto) tiene el
-- MISMO patrón: OUT param `school_id` + `ON CONFLICT (school_id, ...)` sobre
-- `athlete_reports`. Probado en la base viva (2026-09-14): TODAS las escuelas
-- devuelven el mismo "column reference "school_id" is ambiguous", created=0,
-- siempre — el ciclo diario de informes individuales corre desde hace un mes
-- sin crear NINGÚN borrador nuevo por esta vía. Esto es de otro módulo
-- ("Informe Mensual del Atleta") y no se toca acá a propósito (alcance de
-- este ticket = solo el informe de equipo); repórtese aparte para que se
-- decida el fix (mismo `#variable_conflict use_column` en esa función).
-- =============================================================================
