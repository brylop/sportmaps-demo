-- =============================================================================
-- 20260914194842_fix_generate_report_drafts_ambiguous_column.sql
-- Autor: brylop   Fecha: 2026-09-14   Versión anterior: 20260914193611
-- Objetivo: fix de `generate_report_drafts_system()` (20260814173709) — el
-- ciclo diario del Informe MENSUAL DEL ATLETA, en producción desde el 14 de
-- agosto, fallaba con "column reference "school_id" is ambiguous" para
-- TODAS las escuelas, siempre. Lleva ~1 mes sin generar NINGÚN borrador
-- nuevo por esta vía (verificado contra la base viva antes y después de
-- este fix: created=0 con error_msg poblado en todas las filas, → created=0
-- sin error_msg — cero borradores nuevos porque ya estaban todos creados
-- este mes por otra vía, no porque el fix no sirva).
--
-- Encontrado como efecto colateral al cablear el cron gemelo del informe DE
-- EQUIPO (`generate_team_report_drafts_system()`, ver fix hermano
-- 20260914193611): mismo patrón exacto de bug, mismo fix.
--
-- Causa raíz: la función RETURNS TABLE(school_id uuid, created integer,
-- error_msg text) — el OUT param `school_id` tiene el MISMO nombre que la
-- columna `athlete_reports.school_id`. El INSERT final hace
-- `ON CONFLICT (school_id, subject_type, subject_id, period_year,
-- period_month)`: Postgres intenta resolver `school_id` tanto como columna
-- de la tabla como variable OUT del PL/pgSQL en ese mismo contexto — ambas
-- lecturas son válidas, de ahí la ambigüedad (no es un error de sintaxis).
--
-- Fix: `#variable_conflict use_column` — misma directiva que 20260914193611,
-- le dice al compilador que ante columna vs. variable/OUT-param gane la
-- columna, que es lo que la función siempre quiso decir. No se toca la
-- firma ni el resto del cuerpo.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_report_drafts_system()
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
            WITH medidos AS (
                SELECT DISTINCT pe.subject_type, pe.subject_id
                FROM public.performance_entries pe
                WHERE pe.school_id = v_school.id
                  AND pe.recorded_at >= make_date(v_year::int, v_month::int, 1)
                  AND pe.recorded_at <  (make_date(v_year::int, v_month::int, 1) + INTERVAL '1 month')
            ),
            equipos AS (
                SELECT m.subject_type, m.subject_id, e.team_id,
                       public._report_send_day(v_school.id, e.team_id) AS send_day
                FROM medidos m
                JOIN public.enrollments e
                  ON e.school_id = v_school.id
                 AND e.team_id IS NOT NULL
                 AND e.start_date <= (make_date(v_year::int, v_month::int, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date
                 AND (e.end_date IS NULL OR e.end_date >= make_date(v_year::int, v_month::int, 1))
                 AND e.status::text <> 'cancelled'
                 AND (
                       (m.subject_type = 'child'        AND e.child_id                = m.subject_id)
                    OR (m.subject_type = 'profile'      AND e.user_id                 = m.subject_id)
                    OR (m.subject_type = 'unregistered' AND e.unregistered_athlete_id = m.subject_id)
                     )
            ),
            gobernante AS (
                SELECT DISTINCT ON (subject_type, subject_id)
                       subject_type, subject_id, team_id, send_day
                FROM equipos
                ORDER BY subject_type, subject_id, send_day DESC, team_id ASC
            ),
            final AS (
                SELECT m.subject_type, m.subject_id, g.team_id,
                       COALESCE(g.send_day, public._report_send_day(v_school.id, NULL)) AS send_day
                FROM medidos m
                LEFT JOIN gobernante g
                       ON g.subject_type = m.subject_type AND g.subject_id = m.subject_id
            )
            INSERT INTO public.athlete_reports (
                school_id, team_id, subject_type, subject_id,
                period_year, period_month, status, scheduled_for
            )
            SELECT v_school.id, f.team_id, f.subject_type, f.subject_id,
                   v_year, v_month, 'borrador',
                   public._report_scheduled_for(v_year, v_month, f.send_day)
            FROM final f
            ON CONFLICT (school_id, subject_type, subject_id, period_year, period_month) DO NOTHING;

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

COMMENT ON FUNCTION public.generate_report_drafts_system() IS
    'F5: genera borradores del periodo en curso para TODAS las escuelas. Solo '
    'service_role — el cron no tiene auth.uid() para pasar can_manage_reports(). '
    '#variable_conflict use_column (fix 20260914194842): sin esto, '
    'ON CONFLICT(school_id,...) es ambiguo contra el OUT param homónimo — '
    'bug en producción desde el 14-ago-2026, cero borradores generados por '
    'esta vía durante ~1 mes.';

REVOKE ALL ON FUNCTION public.generate_report_drafts_system() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_report_drafts_system() TO service_role;

COMMIT;
