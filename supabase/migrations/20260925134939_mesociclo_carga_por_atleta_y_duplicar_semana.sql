-- =============================================================================
-- 20260925134939_mesociclo_carga_por_atleta_y_duplicar_semana.sql
-- Autor: brylop   Fecha: 2026-09-25   Versión anterior: 20260924111620
-- Objetivo: cierra dos de los pendientes de
--   docs/specs/periodizacion-microciclos-y-carga.md tras la revisión del
--   18-sep (§8) — D13 (carga por atleta) y PER-4 (plantillas de microciclo).
--
--   1. D13 — `athlete_weekly_load(microcycle_id)`. El spec en §0.3 plantea
--      "¿cuánta carga acumuló ESTE jugador en el mes?", pero lo construido
--      (D4/§3.3) mide carga por EQUIPO. Esta RPC cruza el sRPE de sesión
--      (`training_sessions.evaluation->>'rpe'`) × minutos totales de
--      `session_blocks` × asistencia real (`attendance_records`, sin pedir
--      un dato nuevo) por atleta, agregado a nivel de semana (microciclo).
--      Mismo patrón de resolución de nombre que
--      `get_post_training_pending_roster()` ya usa (COALESCE contra
--      `children`/`profiles`/`unregistered_athletes`) — no se inventa un
--      esquema nuevo para lo mismo.
--
--      Simplificación explícita de v1: el cruce es por
--      `(team_id, attendance_date)`, no por `attendance_records.session_id`
--      — esa columna apunta a `attendance_sessions` (cupo/reserva), un eje
--      totalmente distinto de `training_sessions` (contenido). Titular vs.
--      suplente en día de partido (vía `match_lineups`) queda FUERA de v1,
--      igual que el spec ya deja fuera GPS/wearables — se puede sumar
--      después sin romper esta RPC, agregando otra CTE.
--
--   2. PER-4 — `duplicate_microcycle_days(source, target)`. "Copiar filas,
--      no catálogo cerrado" (spec §4 F4): copia `day_type`/`planned_rpe`/
--      `planned_minutes`/`focus` de una semana a otra, desplazando la fecha
--      por la diferencia de `starts_on` entre ambas. NO copia sesiones de
--      contenido (el coach las escribe de cero para la semana nueva, es
--      "punto de partida editable", no un clon). Filtra a propósito los
--      días que no caben en el rango de la semana destino (evita que el
--      trigger `check_training_day_within_microcycle` reviente la
--      transacción completa) y usa `ON CONFLICT DO NOTHING` para no pisar
--      un día que el coach ya haya cargado a mano en destino.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Creación multi-fila = RPC transaccional (aplica a duplicate_microcycle_days).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── D13: carga por atleta, por semana ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.athlete_weekly_load(p_microcycle_id uuid)
RETURNS TABLE(
    child_id                uuid,
    user_id                 uuid,
    unregistered_athlete_id uuid,
    full_name               text,
    avatar_url              text,
    sessions_count          integer,
    total_ua                numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id FROM public.training_microcycles WHERE id = p_microcycle_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Microciclo no encontrado' USING ERRCODE = 'P0002';
    END IF;
    IF NOT (v_school_id = ANY (public.user_staff_school_ids())) THEN
        RAISE EXCEPTION 'No autorizado para ver la carga de este microciclo' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH sesiones AS (
        SELECT
            ts.id,
            ts.team_id,
            ts.session_date,
            NULLIF(ts.evaluation ->> 'rpe', '')::numeric AS rpe,
            COALESCE((
                SELECT SUM(NULLIF(b ->> 'minutes', '')::numeric)
                FROM jsonb_array_elements(COALESCE(ts.session_blocks, '[]'::jsonb)) AS b
            ), 0) AS minutes
        FROM public.training_sessions ts
        JOIN public.training_microcycle_days d ON d.id = ts.microcycle_day_id
        WHERE d.microcycle_id = p_microcycle_id
    ),
    cargas AS (
        SELECT
            ar.child_id, ar.user_id, ar.unregistered_athlete_id,
            s.id AS session_id,
            CASE WHEN s.rpe IS NOT NULL THEN s.rpe * s.minutes ELSE NULL END AS ua
        FROM sesiones s
        JOIN public.attendance_records ar
          ON ar.team_id = s.team_id
         AND ar.attendance_date = s.session_date
         AND ar.status IN ('present', 'late')
    )
    SELECT
        c.child_id, c.user_id, c.unregistered_athlete_id,
        COALESCE(ch.full_name, p.full_name, u.full_name, 'Deportista') AS full_name,
        COALESCE(ch.avatar_url, p.avatar_url) AS avatar_url,
        count(*)::integer AS sessions_count,
        COALESCE(SUM(c.ua), 0) AS total_ua
    FROM cargas c
    LEFT JOIN public.children ch ON ch.id = c.child_id
    LEFT JOIN public.profiles p ON p.id = c.user_id
    LEFT JOIN public.unregistered_athletes u ON u.id = c.unregistered_athlete_id
    GROUP BY c.child_id, c.user_id, c.unregistered_athlete_id, ch.full_name, p.full_name, u.full_name, ch.avatar_url, p.avatar_url
    ORDER BY total_ua DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.athlete_weekly_load(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.athlete_weekly_load(uuid) TO authenticated;


-- ─── PER-4: duplicar una semana como plantilla editable ─────────────────────
CREATE OR REPLACE FUNCTION public.duplicate_microcycle_days(p_source_microcycle_id uuid, p_target_microcycle_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_source     public.training_microcycles;
    v_target     public.training_microcycles;
    v_delta      integer;
    v_count      integer;
BEGIN
    SELECT * INTO v_source FROM public.training_microcycles WHERE id = p_source_microcycle_id;
    SELECT * INTO v_target FROM public.training_microcycles WHERE id = p_target_microcycle_id;

    IF v_source.id IS NULL OR v_target.id IS NULL THEN
        RAISE EXCEPTION 'Semana origen o destino no encontrada' USING ERRCODE = 'P0002';
    END IF;
    IF NOT (v_source.school_id = ANY (public.user_staff_school_ids()))
       OR NOT (v_target.school_id = ANY (public.user_staff_school_ids())) THEN
        RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
    END IF;
    IF v_source.team_id <> v_target.team_id THEN
        RAISE EXCEPTION 'Las dos semanas deben ser del mismo equipo' USING ERRCODE = '22023';
    END IF;

    v_delta := v_target.starts_on - v_source.starts_on;

    INSERT INTO public.training_microcycle_days (school_id, microcycle_id, day_date, day_type, planned_rpe, planned_minutes, focus)
    SELECT v_target.school_id, v_target.id, d.day_date + v_delta, d.day_type, d.planned_rpe, d.planned_minutes, d.focus
    FROM public.training_microcycle_days d
    WHERE d.microcycle_id = p_source_microcycle_id
      AND (d.day_date + v_delta) BETWEEN v_target.starts_on AND v_target.ends_on
    ON CONFLICT (microcycle_id, day_date) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_microcycle_days(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_microcycle_days(uuid, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
