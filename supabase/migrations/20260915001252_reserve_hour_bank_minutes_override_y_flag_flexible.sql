-- =============================================================================
-- 20260915001252_reserve_hour_bank_minutes_override_y_flag_flexible.sql
-- Autor: judegor99   Fecha: 2026-09-15   Versión anterior: 20260914221557
-- Objetivo: piloto "agendamiento flexible de banco de horas" (Dreamers +
-- Academia Superior Bogotá). Hoy reserve_hour_bank() SIEMPRE recalcula un
-- bloque fijo (session_block_minutes del plan → hours_session_block_minutes
-- de la escuela → 120), sin importar cuántas horas reales agendó el atleta.
-- Con esto, cuando agenda más de una hora seguida (varios bloques atómicos
-- de coach_availability combinados), el descuento del banco de horas
-- corresponde a lo realmente agendado, no al fijo.
--
-- p_minutes_override es NUEVO y OPCIONAL (default NULL) — con NULL el
-- comportamiento es IDÉNTICO al de hoy (mismo cascada de fallback). Postgres
-- no deja agregar un parámetro a una función existente con CREATE OR REPLACE
-- sin volverla ambigua (dos funciones candidatas para una llamada de 3
-- argumentos), así que hay que DROP + CREATE.
--
-- cancel_hour_bank_reservation() no se toca: ya lee `minutes` de la fila
-- guardada en vez de recalcular, así que revierte correctamente cualquier
-- monto, fijo o variable, sin cambios.
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

DROP FUNCTION IF EXISTS public.reserve_hour_bank(uuid, date, uuid);

CREATE FUNCTION public.reserve_hour_bank(
    p_enrollment_id     uuid,
    p_reservation_date  date,
    p_created_by        uuid DEFAULT NULL::uuid,
    p_minutes_override  integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_school_id        uuid;
    v_offering_plan_id uuid;
    v_plan_block       integer;
    v_block_minutes    integer;
    v_period_id        uuid;
    v_move             jsonb;
    v_reservation_id   uuid;
BEGIN
    SELECT school_id, offering_plan_id
      INTO v_school_id, v_offering_plan_id
      FROM public.enrollments
     WHERE id = p_enrollment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('reserved', false, 'reason', 'enrollment_not_found');
    END IF;

    IF p_minutes_override IS NOT NULL THEN
        -- Piloto "agendamiento flexible": el llamador (BFF) ya validó que
        -- esos minutos corresponden a bloques de coach_availability
        -- realmente consecutivos y libres — acá solo se guarda el monto.
        IF p_minutes_override <= 0 THEN
            RETURN jsonb_build_object('reserved', false, 'reason', 'invalid_minutes_override');
        END IF;
        v_block_minutes := p_minutes_override;
    ELSE
        -- D1 (niveles por horas): bloque del PLAN primero — así 2h/3h/4h
        -- simultáneos en la misma escuela reservan lo que su propio nivel vale,
        -- no el default de la escuela. NULL en cualquier eslabón cae al
        -- siguiente, igual que documenta D1.
        IF v_offering_plan_id IS NOT NULL THEN
            SELECT session_block_minutes INTO v_plan_block
              FROM public.offering_plans
             WHERE id = v_offering_plan_id;
        END IF;

        SELECT COALESCE(v_plan_block, ss.hours_session_block_minutes, 120)
          INTO v_block_minutes
          FROM public.school_settings ss
         WHERE ss.school_id = v_school_id;

        v_block_minutes := COALESCE(v_block_minutes, v_plan_block, 120);
    END IF;

    v_period_id := public.get_or_open_hour_bank_period(p_enrollment_id);
    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('reserved', false, 'reason', 'not_hours_plan');
    END IF;

    -- El gate de saldo (D-2) vive en move_hour_bank — reserved_delta > 0 se
    -- rechaza solo si no alcanza. No se duplica esa lógica acá.
    v_move := public.move_hour_bank(v_period_id, v_block_minutes, 0);

    IF NOT (v_move->>'moved')::boolean THEN
        RETURN v_move || jsonb_build_object('reserved', false);
    END IF;

    INSERT INTO public.hour_bank_reservations
        (school_id, enrollment_id, period_id, reservation_date, minutes, status, created_by)
    VALUES
        (v_school_id, p_enrollment_id, v_period_id, p_reservation_date, v_block_minutes, 'confirmed', p_created_by)
    RETURNING id INTO v_reservation_id;

    RETURN v_move || jsonb_build_object(
        'reserved',        true,
        'reservation_id',  v_reservation_id,
        'minutes',         v_block_minutes
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_hour_bank(uuid, date, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_hour_bank(uuid, date, uuid, integer) TO service_role;

-- ── Flag piloto por escuela ───────────────────────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN hour_bank_flexible_booking_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.hour_bank_flexible_booking_enabled IS
    'Piloto (Dreamers, Academia Superior Bogotá): agrupa bloques de coach_availability consecutivos hasta el mínimo del plan (session_block_minutes) en /athlete/available, y permite agendar más bloques de los que trae por defecto (sesión personalizada), descontando del banco de horas los minutos reales agendados en vez del bloque fijo.';

COMMIT;
