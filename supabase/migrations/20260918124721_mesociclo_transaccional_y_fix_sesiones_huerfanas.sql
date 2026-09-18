-- =============================================================================
-- 20260918124721_mesociclo_transaccional_y_fix_sesiones_huerfanas.sql
-- Autor: brylop   Fecha: 2026-09-18   Versión anterior: 20260918123632
-- Objetivo: QA reportó "el mesociclo se crea pero las sesiones no se guardan"
--   (mesociclos/microciclos, PER-1/7/8, ver docs/specs/periodizacion-
--   microciclos-y-carga.md). Investigado contra la base viva: son DOS bugs
--   distintos, ninguno de RLS.
--
--   BUG A (el que reportan, confirmado con datos reales del team
--   1375b77e-15f9-4283-ade2-087a74e88afc): MesocycleSection.createMesocycle
--   hacía DOS inserts sueltos desde el cliente (training_mesocycles, después
--   el bulk de las 4 semanas en training_microcycles) sin transacción. Si el
--   equipo ya tenía semanas con esas mismas fechas de inicio -- típico al
--   volver a crear un mesociclo para reintentar, porque la UI no tiene forma
--   de borrar uno -- el segundo insert choca contra
--   training_microcycles_team_id_starts_on_key y explota, pero el mesociclo
--   YA quedó commiteado: sale un mesociclo fantasma, sin semanas, sin ningún
--   botón para agregar días. Reproducido en una transacción de prueba
--   (rollback, sin tocar datos):
--     ERROR: 23505 duplicate key value violates unique constraint
--     "training_microcycles_team_id_starts_on_key"
--   Esta migración lo resuelve con una RPC SECURITY DEFINER
--   (create_mesocycle_with_weeks) que hace los dos inserts en la MISMA
--   transacción de la función -- si el segundo falla, Postgres revierte
--   también el primero. El fix del lado del cliente (usar la RPC en vez de
--   los dos inserts) va en el mismo PR, en MesocycleSection.tsx.
--
--   BUG B (el que en realidad venía pasando, encontrado al auditar datos
--   reales): el botón "Crear Sesión" de arriba de TrainingPlansPage.tsx
--   sigue visible aunque haya un mesociclo activo, y nunca engancha la
--   sesión creada a ningún día (session_id). Con mesociclo activo, la lista
--   plana de sesiones se oculta (!currentMesocycle) y MesocycleSection solo
--   muestra sesiones enganchadas a un día -- la sesión se guarda perfecto en
--   training_sessions pero desaparece de toda la UI. Encontrado en vivo: el
--   team 1375b77e tiene 4 filas reales en training_sessions (2 el 16-sep, 2
--   el 19-sep) con session_date == day_date de sus días cargados, y NINGUNA
--   enganchada (session_id NULL). Esta parte NO es de esquema (es un guard
--   de UI en TrainingPlansPage.tsx, mismo PR) -- acá NO se rescatan esos
--   datos: las 4 filas son ambiguas por fecha (2 candidatas cada día, una de
--   ellas "Shhshs" -- claramente una prueba -- el 16, y DOS objetivos reales
--   distintos el 19 sin forma de saber cuál quería el coach). Cuál engancha
--   y cuál se borra lo decide el usuario, no una migración.
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

SET LOCAL lock_timeout = '5s';

-- ─── RPC transaccional: mesociclo + sus 4 semanas, todo o nada ──────────────
-- SECURITY DEFINER salta RLS, así que el chequeo de autorización va explícito
-- acá (mismo criterio que la policy de INSERT que reemplaza:
-- school_id = ANY(user_staff_school_ids())).
CREATE OR REPLACE FUNCTION public.create_mesocycle_with_weeks(
    p_school_id                uuid,
    p_team_id                  uuid,
    p_starts_on                date,
    p_ends_on                  date,
    p_general_objective        text    DEFAULT NULL,
    p_game_model               text    DEFAULT NULL,
    p_n_sessions_planned       integer DEFAULT NULL,
    p_session_duration_minutes integer DEFAULT NULL,
    p_evaluation_mode          text    DEFAULT 'team'
)
RETURNS public.training_mesocycles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_mesocycle   public.training_mesocycles;
    v_total_days  integer;
    v_base_len    integer;
    v_remainder   integer;
    v_cursor      date;
    v_week_len    integer;
    v_week_end    date;
    i             integer;
BEGIN
    IF NOT (p_school_id = ANY (public.user_staff_school_ids())) THEN
        RAISE EXCEPTION 'No autorizado para crear mesociclos en esta escuela' USING ERRCODE = '42501';
    END IF;

    IF p_ends_on < p_starts_on THEN
        RAISE EXCEPTION 'ends_on no puede ser anterior a starts_on' USING ERRCODE = '22007';
    END IF;

    INSERT INTO public.training_mesocycles (
        school_id, team_id, starts_on, ends_on, n_sessions_planned,
        session_duration_minutes, general_objective, game_model, evaluation_mode, created_by
    ) VALUES (
        p_school_id, p_team_id, p_starts_on, p_ends_on, p_n_sessions_planned,
        p_session_duration_minutes, p_general_objective, p_game_model,
        COALESCE(p_evaluation_mode, 'team'), auth.uid()
    ) RETURNING * INTO v_mesocycle;

    -- Mismo reparto que buildWeeklyMicrocycles() en MesocycleSection.tsx:
    -- EXACTAMENTE 4 semanas, el resto de días se reparte entre las primeras
    -- para no dejar una 5ª semana suelta de 1-3 días. Si algún día se toca
    -- ese cálculo en el frontend, hay que tocarlo acá también.
    v_total_days := (p_ends_on - p_starts_on) + 1;
    v_base_len   := v_total_days / 4;
    v_remainder  := v_total_days % 4;
    v_cursor     := p_starts_on;

    BEGIN
        FOR i IN 1..4 LOOP
            v_week_len := v_base_len + (CASE WHEN i <= v_remainder THEN 1 ELSE 0 END);
            EXIT WHEN v_week_len <= 0;
            v_week_end := v_cursor + (v_week_len - 1);

            INSERT INTO public.training_microcycles (
                school_id, team_id, mesocycle_id, number, starts_on, ends_on, created_by
            ) VALUES (
                p_school_id, p_team_id, v_mesocycle.id, i, v_cursor, v_week_end, auth.uid()
            );

            v_cursor := v_week_end + 1;
        END LOOP;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Ya existe un mesociclo con semanas que empiezan en estas mismas fechas para este equipo -- revisa si ya hay uno creado antes de crear otro.'
            USING ERRCODE = '23505';
    END;

    RETURN v_mesocycle;
END;
$$;

REVOKE ALL ON FUNCTION public.create_mesocycle_with_weeks(uuid, uuid, date, date, text, text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_mesocycle_with_weeks(uuid, uuid, date, date, text, text, integer, integer, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
