-- =============================================================================
-- 20260930230001_per2_training_load_summary.sql
-- Autor: judegor99   Fecha: 2026-09-30   Versión anterior: 20260930131401
-- Objetivo: PER-2 (docs/specs/periodizacion-microciclos-y-carga.md §3.3) —
--   indicadores de carga por microciclo, modo audit (se muestra, nunca
--   bloquea). D-CARGA ya no bloquea: se adoptó sRPE de Foster (D4).
--
--   No se crea ninguna tabla ni se persiste nada: `v_session_load`
--   (`20260831160936`) ya calcula UA por sesión (`evaluation->>'rpe' ×
--   Σ session_blocks[].minutes`) y esta RPC solo la agrega por semana
--   (`training_load_summary`). `SECURITY INVOKER` a propósito, no
--   `DEFINER`: las tablas que toca (`training_sessions`,
--   `training_microcycle_days`, `training_microcycles`) ya tienen RLS
--   acotada a `user_staff_school_ids()` — reusarla es más simple y más
--   seguro que reimplementar el mismo chequeo a mano (que sí hace falta
--   en `athlete_weekly_load` porque esa RPC lee `children`/`profiles`/
--   `unregistered_athletes` para resolver nombres, fuera del alcance de la
--   RLS de las tablas de entrenamiento).
--
--   Guardas explícitas para no mostrar un número engañoso con poco dato
--   (R1/R2 del spec, mismo criterio ya usado en `athlete_weekly_load` y en
--   el Informe Mensual con "última medición hace N días"):
--     · `monotony`/`strain`  → NULL si hay menos de 3 sesiones con RPE
--       cargado esta semana (umbral de frecuencia, revisión 18-sep §3.3) o
--       si el desvío estándar es 0 (semana sin variación real, dividir por
--       cero no es "sin riesgo", es indefinido).
--     · `acwr`               → NULL si el EQUIPO (no el microciclo) tiene
--       menos de 28 días de historia de `training_sessions` (R2).
--
--   `matches_in_72h` y `rest_streak_days` miran TODO el equipo, sin límite
--   al microciclo actual — mismo criterio que ya corrigió el índice MD
--   (`training_days_md_labels`, `20260921115743`): acotar al microciclo
--   cargado en memoria reproduce H1 (un lunes que sigue a un partido del
--   domingo, pero en la semana anterior, no mostraba nada).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.training_load_summary(p_microcycle_id uuid)
RETURNS TABLE(
    weekly_ua            numeric,
    sessions_with_rpe    integer,
    training_days_count  integer,
    adherence_pct        numeric,
    monotony             numeric,
    strain               numeric,
    acwr                 numeric,
    days_of_history      integer,
    matches_in_72h       integer,
    rest_streak_days     integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_team_id           uuid;
    v_starts_on         date;
    v_ends_on           date;
    v_weekly_ua         numeric := 0;
    v_sessions_with_rpe integer := 0;
    v_training_days     integer := 0;
    v_adherence         numeric;
    v_mean_ua           numeric;
    v_stddev_ua         numeric;
    v_monotony          numeric;
    v_strain            numeric;
    v_first_session     date;
    v_days_of_history   integer := 0;
    v_ua_7d             numeric;
    v_ua_28d            numeric;
    v_acwr              numeric;
    v_matches_72h       integer := 0;
    v_rest_streak       integer := 0;
BEGIN
    SELECT team_id, starts_on, ends_on INTO v_team_id, v_starts_on, v_ends_on
    FROM public.training_microcycles
    WHERE id = p_microcycle_id;

    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'Microciclo no encontrado' USING ERRCODE = 'P0002';
    END IF;

    -- ─── UA de la semana + adherencia (§3.3) ────────────────────────────────
    SELECT COALESCE(SUM(vsl.load_ua), 0), COUNT(*) FILTER (WHERE vsl.rpe IS NOT NULL)
      INTO v_weekly_ua, v_sessions_with_rpe
    FROM public.training_sessions ts
    JOIN public.training_microcycle_days d ON d.id = ts.microcycle_day_id
    JOIN public.v_session_load vsl ON vsl.session_id = ts.id
    WHERE d.microcycle_id = p_microcycle_id;

    SELECT COUNT(*) INTO v_training_days
    FROM public.training_microcycle_days
    WHERE microcycle_id = p_microcycle_id AND day_type IN ('entrenamiento', 'partido');

    v_adherence := CASE WHEN v_training_days = 0 THEN NULL
                        ELSE v_sessions_with_rpe::numeric / v_training_days END;

    -- ─── Monotonía/strain, con umbral de frecuencia ─────────────────────────
    IF v_sessions_with_rpe >= 3 THEN
        SELECT AVG(vsl.load_ua), STDDEV_POP(vsl.load_ua) INTO v_mean_ua, v_stddev_ua
        FROM public.training_sessions ts
        JOIN public.training_microcycle_days d ON d.id = ts.microcycle_day_id
        JOIN public.v_session_load vsl ON vsl.session_id = ts.id
        WHERE d.microcycle_id = p_microcycle_id AND vsl.rpe IS NOT NULL;

        IF v_stddev_ua IS NOT NULL AND v_stddev_ua > 0 THEN
            v_monotony := v_mean_ua / v_stddev_ua;
            v_strain := v_weekly_ua * v_monotony;
        END IF;
    END IF;

    -- ─── ACWR, con piso de 28 días de historia DEL EQUIPO ───────────────────
    SELECT MIN(session_date) INTO v_first_session
    FROM public.training_sessions WHERE team_id = v_team_id;

    IF v_first_session IS NOT NULL THEN
        v_days_of_history := v_ends_on - v_first_session;
    END IF;

    IF v_days_of_history >= 28 THEN
        SELECT COALESCE(SUM(vsl.load_ua), 0) INTO v_ua_7d
        FROM public.training_sessions ts
        JOIN public.v_session_load vsl ON vsl.session_id = ts.id
        WHERE ts.team_id = v_team_id AND ts.session_date BETWEEN (v_ends_on - 6) AND v_ends_on;

        SELECT COALESCE(SUM(vsl.load_ua), 0) INTO v_ua_28d
        FROM public.training_sessions ts
        JOIN public.v_session_load vsl ON vsl.session_id = ts.id
        WHERE ts.team_id = v_team_id AND ts.session_date BETWEEN (v_ends_on - 27) AND v_ends_on;

        IF v_ua_28d > 0 THEN
            v_acwr := (v_ua_7d / 7) / (v_ua_28d / 28);
        END IF;
    END IF;

    -- ─── Densidad competitiva: partidos del equipo a <72h, sin límite al
    -- microciclo actual (evita reproducir H1, mismo criterio que el índice MD) ─
    SELECT COUNT(*) INTO v_matches_72h
    FROM public.training_microcycle_days d1
    JOIN public.training_microcycles m1 ON m1.id = d1.microcycle_id AND m1.team_id = v_team_id
    JOIN public.training_microcycle_days d2
      ON d2.microcycle_id IN (SELECT id FROM public.training_microcycles WHERE team_id = v_team_id)
     AND d2.day_date > d1.day_date
     AND (d2.day_date - d1.day_date) < 3
    WHERE d1.day_type = 'partido' AND d2.day_type = 'partido'
      AND (d1.day_date BETWEEN v_starts_on AND v_ends_on OR d2.day_date BETWEEN v_starts_on AND v_ends_on);

    -- ─── Racha de días consecutivos sin descanso, TODO el equipo ────────────
    -- `generate_series` sobre los últimos 60 días (margen de sobra) evita el
    -- problema clásico de la técnica de islas-y-huecos: si un día no tiene
    -- fila en `training_microcycle_days`, NO es lo mismo que un hueco en la
    -- secuencia de fechas (rompería el cálculo) — acá cuenta como
    -- 'descanso' (sin registro = sin carga = corta la racha).
    -- El ROW_NUMBER() va DESPUÉS de filtrar los días sin descanso -- si se
    -- numeran todos los días del rango (incluidos los de descanso) antes de
    -- filtrar, `day_date - row_number()` queda constante para TODA la
    -- ventana (es una secuencia de calendario sin huecos), y "el grupo" deja
    -- de aislar rachas -- cuenta el total de días sin descanso del rango
    -- entero, no la racha final. Verificado en vivo antes de este fix.
    WITH dias_reales AS (
        SELECT gs::date AS day_date,
               COALESCE((
                   SELECT d.day_type
                   FROM public.training_microcycle_days d
                   JOIN public.training_microcycles m ON m.id = d.microcycle_id
                   WHERE m.team_id = v_team_id AND d.day_date = gs::date
                   LIMIT 1
               ), 'descanso') AS day_type
        FROM generate_series(v_ends_on - 60, v_ends_on, INTERVAL '1 day') gs
    ),
    sin_descanso AS (
        SELECT day_date,
               day_date - (ROW_NUMBER() OVER (ORDER BY day_date))::int AS grp
        FROM dias_reales
        WHERE day_type <> 'descanso'
    ),
    ultima_racha AS (
        SELECT grp FROM sin_descanso ORDER BY day_date DESC LIMIT 1
    )
    SELECT COUNT(*) INTO v_rest_streak
    FROM sin_descanso n JOIN ultima_racha u ON n.grp = u.grp;

    RETURN QUERY SELECT
        v_weekly_ua, v_sessions_with_rpe, v_training_days, v_adherence,
        v_monotony, v_strain, v_acwr, v_days_of_history, v_matches_72h, v_rest_streak;
END;
$$;

REVOKE ALL ON FUNCTION public.training_load_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.training_load_summary(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
