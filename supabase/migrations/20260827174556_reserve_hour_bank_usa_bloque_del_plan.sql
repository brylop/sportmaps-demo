-- =============================================================================
-- 20260827174556_reserve_hour_bank_usa_bloque_del_plan.sql
-- Autor: brylop   Fecha: 2026-08-27   Versión anterior: 20260827174032
-- Objetivo: cablear D1 del spec docs/specs/dreamers-niveles-por-horas-y-progresion.md
-- dentro del banco de horas ya construido (b882f5d). D1 creó
-- offering_plans.session_block_minutes precisamente para que Dreamers pueda
-- tener niveles de 2h/3h/4h simultáneos, con fallback a
-- school_settings.hours_session_block_minutes cuando el plan no define el
-- suyo — pero reserve_hour_bank() (F4 del banco de horas) seguía leyendo
-- ÚNICAMENTE el valor de escuela, ignorando el del plan. Con eso, un nivel de
-- 3h reservaba solo el bloque de 2h de la escuela (o el que fuera el default),
-- subestimando lo reservado contra lo que ese plan realmente vale.
--
-- Fix: resolver el bloque en cascada — offering_plans.session_block_minutes
-- (si la inscripción tiene plan y lo define) → school_settings.
-- hours_session_block_minutes → 120 como último fallback (igual que antes).
-- Solo puede cambiar el resultado en escuelas donde YA HOY un plan tenga
-- session_block_minutes distinto del valor de la escuela — hoy eso es
-- ninguna (la columna se creó recién en 20260827172229, todavía sin llenar
-- en ningún plan real), así que este fix es un no-evento hasta que Dreamers
-- configure sus niveles.
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

CREATE OR REPLACE FUNCTION public.reserve_hour_bank(
    p_enrollment_id     uuid,
    p_reservation_date  date,
    p_created_by        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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
$$;

COMMENT ON FUNCTION public.reserve_hour_bank(uuid, date, uuid) IS
    'F4: abre/resuelve el período, valida saldo y reserva vía move_hour_bank, e '
    'inserta la fila en hour_bank_reservations — todo en una transacción. Bloque '
    'de sesión en cascada: offering_plans.session_block_minutes (D1, niveles) → '
    'school_settings.hours_session_block_minutes → 120. reserved=false + '
    'reason=insufficient_balance (con available_minutes) si no alcanza el saldo '
    '(D-2). Ver docs/specs/dreamers-banco-de-horas-torniquete.md y '
    'docs/specs/dreamers-niveles-por-horas-y-progresion.md D1.';

-- Sigue restringida a service_role (fix de autorización de 20260827174032) —
-- no se reabre a authenticated acá.
GRANT EXECUTE ON FUNCTION public.reserve_hour_bank(uuid, date, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
