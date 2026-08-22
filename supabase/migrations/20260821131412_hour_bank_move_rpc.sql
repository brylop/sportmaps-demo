-- =============================================================================
-- 20260821131412_hour_bank_move_rpc.sql
-- Autor: judegor99   Fecha: 2026-08-21   Versión anterior: 20260821125525 (F1,
-- registrada por apply_migration como 20260821130357 — ver docs/gotchas-tecnicos.md)
-- Objetivo: F2 de docs/specs/dreamers-banco-de-horas-torniquete.md — el único
-- punto que abre un hour_bank_periods y el único que mueve su saldo. Mismo
-- espíritu que move_session_credit (20260801102331): SELECT … FOR UPDATE sobre
-- el contador, para que dos requests simultáneos (reservar dos veces, reservar
-- + cerrar visita al tiempo) no lean el mismo saldo y pisen el descuento del
-- otro.
--
-- Dos funciones:
--   1. get_or_open_hour_bank_period(enrollment_id) — resuelve o abre el período
--      vigente hoy para esa inscripción, según school_settings.billing_cycle_type
--      (D-12): mes calendario para 'fixed_calendar'/'prorated', 30 días
--      encadenados desde start_date para 'rolling_30'. Devuelve NULL si la
--      inscripción no tiene un offering_plan con included_minutes_per_period
--      (no es un plan de horas) — no es un error, es el caso normal para el
--      resto de las escuelas.
--   2. move_hour_bank(period_id, reserved_delta, consumed_delta) — el mover
--      atómico. reserved_delta > 0 (agendar) SE BLOQUEA si no alcanza el saldo
--      (D-2: la reserva es un techo). consumed_delta y reserved_delta < 0
--      NUNCA se bloquean (D-3/D-10: el torniquete manda, el excedente real no
--      tiene freno automático, solo se notifica desde el caller).
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

-- =============================================================================
-- 1. get_or_open_hour_bank_period
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_or_open_hour_bank_period(p_enrollment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_enr           record;
    v_included      integer;
    v_cycle         text;
    v_today         date;
    v_period_start  date;
    v_period_end    date;
    v_period_id     uuid;
BEGIN
    SELECT e.id, e.school_id, e.start_date, e.offering_plan_id
      INTO v_enr
      FROM public.enrollments e
     WHERE e.id = p_enrollment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'get_or_open_hour_bank_period: enrollment % no existe', p_enrollment_id;
    END IF;

    IF v_enr.offering_plan_id IS NULL THEN
        RETURN NULL; -- sin plan, no hay banco de horas que abrir
    END IF;

    SELECT op.included_minutes_per_period
      INTO v_included
      FROM public.offering_plans op
     WHERE op.id = v_enr.offering_plan_id;

    -- Plan por sesiones (max_sessions), no por horas: caso normal fuera de
    -- Dreamers, no es un error.
    IF v_included IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(ss.billing_cycle_type, 'fixed_calendar')
      INTO v_cycle
      FROM public.school_settings ss
     WHERE ss.school_id = v_enr.school_id;

    v_today := (now() AT TIME ZONE 'America/Bogota')::date;

    IF v_cycle = 'rolling_30' THEN
        -- 30 días encadenados desde start_date (D-12): anchor + 30*N donde N es
        -- el número de ventanas completas transcurridas desde el alta.
        v_period_start := v_enr.start_date
            + (30 * FLOOR(GREATEST(0, v_today - v_enr.start_date) / 30.0))::int;
        v_period_end := v_period_start + 29;
    ELSE
        -- 'fixed_calendar' / 'prorated' (y cualquier valor futuro no
        -- contemplado, a modo de fallback seguro): mes calendario completo,
        -- igual que calcFirstPayment en prorationUtils.ts.
        v_period_start := date_trunc('month', v_today)::date;
        v_period_end   := (date_trunc('month', v_today) + interval '1 month' - interval '1 day')::date;
    END IF;

    -- Idempotente: si dos requests llegan a abrir el mismo período a la vez,
    -- el UNIQUE (enrollment_id, period_start) de F1 deja pasar solo el primer
    -- INSERT; el segundo cae en el ON CONFLICT y el SELECT de abajo recoge la
    -- fila que sí quedó.
    INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes)
    VALUES (p_enrollment_id, v_enr.school_id, v_period_start, v_period_end, v_included)
    ON CONFLICT (enrollment_id, period_start) DO NOTHING;

    SELECT id INTO v_period_id
      FROM public.hour_bank_periods
     WHERE enrollment_id = p_enrollment_id
       AND period_start = v_period_start;

    RETURN v_period_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_open_hour_bank_period(uuid) IS
    'Resuelve (o abre) el hour_bank_periods vigente hoy para una inscripción, '
    'según school_settings.billing_cycle_type (D-12). NULL si la inscripción no '
    'tiene un plan por horas (offering_plans.included_minutes_per_period NULL) '
    '— caso normal, no es un error. Ver docs/specs/dreamers-banco-de-horas-torniquete.md';

GRANT EXECUTE ON FUNCTION public.get_or_open_hour_bank_period(uuid) TO authenticated;

-- =============================================================================
-- 2. move_hour_bank — el único escritor de reserved_minutes/consumed_minutes
-- =============================================================================

CREATE OR REPLACE FUNCTION public.move_hour_bank(
    p_period_id       uuid,
    p_reserved_delta  integer DEFAULT 0,
    p_consumed_delta  integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_period     record;
    v_available  integer;
    v_new_res    integer;
    v_new_cons   integer;
BEGIN
    -- El FOR UPDATE es el punto de toda la función: serializa dos requests que
    -- tocan el mismo período a la vez (agendar dos veces, agendar y cerrar una
    -- visita al tiempo) — mismo espíritu que move_session_credit.
    SELECT hbp.id, hbp.included_minutes, hbp.reserved_minutes, hbp.consumed_minutes
      INTO v_period
      FROM public.hour_bank_periods hbp
     WHERE hbp.id = p_period_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('moved', false, 'reason', 'period_not_found');
    END IF;

    -- D-2: la reserva es un techo de validación — un reserved_delta positivo
    -- que no cabe en el saldo restante se RECHAZA por completo, no se recorta.
    -- D-3/D-10: consumir (consumed_delta) o liberar/cancelar una reserva
    -- (reserved_delta negativo) nunca se bloquea — el torniquete manda y el
    -- excedente real no tiene freno automático.
    IF p_reserved_delta > 0 THEN
        v_available := v_period.included_minutes - v_period.reserved_minutes - v_period.consumed_minutes;
        IF p_reserved_delta > v_available THEN
            RETURN jsonb_build_object(
                'moved', false,
                'reason', 'insufficient_balance',
                'available_minutes', GREATEST(0, v_available),
                'requested_minutes', p_reserved_delta
            );
        END IF;
    END IF;

    v_new_res  := GREATEST(0, v_period.reserved_minutes + p_reserved_delta);
    v_new_cons := GREATEST(0, v_period.consumed_minutes + p_consumed_delta);

    UPDATE public.hour_bank_periods
       SET reserved_minutes = v_new_res,
           consumed_minutes = v_new_cons,
           updated_at       = now()
     WHERE id = p_period_id;

    RETURN jsonb_build_object(
        'moved',             (p_reserved_delta <> 0 OR p_consumed_delta <> 0),
        'period_id',         p_period_id,
        'included_minutes',  v_period.included_minutes,
        'reserved_minutes',  v_new_res,
        'consumed_minutes',  v_new_cons,
        'available_minutes', v_period.included_minutes - v_new_res - v_new_cons
    );
END;
$$;

COMMENT ON FUNCTION public.move_hour_bank(uuid, integer, integer) IS
    'Único punto que mueve hour_bank_periods.reserved_minutes/consumed_minutes. '
    'FOR UPDATE evita que dos requests simultáneos pisen el saldo (mismo motivo '
    'que move_session_credit). reserved_delta > 0 se bloquea si no alcanza el '
    'saldo (D-2); consumed_delta y reserved_delta < 0 nunca se bloquean (D-3/D-10). '
    'Ver docs/specs/dreamers-banco-de-horas-torniquete.md';

GRANT EXECUTE ON FUNCTION public.move_hour_bank(uuid, integer, integer) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
