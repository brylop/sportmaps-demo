-- =============================================================================
-- 20260930230002_per6_athlete_monthly_load_system.sql
-- Autor: judegor99   Fecha: 2026-09-30   Versión anterior: 20260930230001
-- Objetivo: PER-6 mitad B (docs/specs/periodizacion-microciclos-y-carga.md
--   §4 F6, spec fútbol §4 P3) — la carga mensual del atleta junto a las
--   métricas en el Informe Mensual. La mitad A (tablero táctico con contexto
--   `training`) ya existía (`PER-0(c)`).
--
--   El job del informe (`bff/src/jobs/athlete-reports.job.ts`) corre con
--   `service_role`, sin `auth.uid()` — `athlete_weekly_load` (D13,
--   `20260925134939`) no sirve tal cual porque está gateada por
--   `user_staff_school_ids()`. Mismo patrón que
--   `generate_report_drafts_system`/`publish_team_reports_system`
--   (`20260814173709`): `SECURITY DEFINER`, sin chequeo de rol adentro —
--   la autorización es el GRANT (`service_role` únicamente), no la RLS.
--
--   Mismo cruce que D13 (asistencia real × `v_session_load`, sin pedir un
--   dato nuevo a nadie), pero por MES calendario y un solo atleta en vez de
--   por microciclo y todo el equipo. No recibe `team_id`: igual que
--   `loadAttendance()` en `report-snapshot.service.ts`, el cruce con
--   `training_sessions` es por `(team_id, attendance_date)` de
--   `attendance_records` — el atleta puede haber entrenado con más de un
--   equipo en el mes, se suma todo.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.athlete_monthly_load_system(
    p_school_id             uuid,
    p_child_id              uuid,
    p_user_id               uuid,
    p_unregistered_athlete_id uuid,
    p_year                  integer,
    p_month                 integer
)
RETURNS TABLE(sessions_count integer, total_ua numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    WITH cargas AS (
        SELECT vsl.load_ua
        FROM public.attendance_records ar
        JOIN public.training_sessions ts
          ON ts.team_id = ar.team_id AND ts.session_date = ar.attendance_date
        JOIN public.v_session_load vsl ON vsl.session_id = ts.id
        WHERE ar.school_id = p_school_id
          AND ar.status IN ('present', 'late')
          AND ar.attendance_date >= make_date(p_year, p_month, 1)
          AND ar.attendance_date < (make_date(p_year, p_month, 1) + INTERVAL '1 month')
          AND (
                (p_child_id IS NOT NULL AND ar.child_id = p_child_id)
             OR (p_user_id IS NOT NULL AND ar.user_id = p_user_id)
             OR (p_unregistered_athlete_id IS NOT NULL AND ar.unregistered_athlete_id = p_unregistered_athlete_id)
          )
    )
    SELECT COUNT(*)::integer, COALESCE(SUM(load_ua), 0) FROM cargas;
$$;

REVOKE ALL ON FUNCTION public.athlete_monthly_load_system(uuid, uuid, uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.athlete_monthly_load_system(uuid, uuid, uuid, uuid, integer, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
