-- =============================================================================
-- 20260915101557_gate_hour_bank_period_a_flag_por_escuela.sql
-- Autor: brylop   Fecha: 2026-09-15   Versión anterior: 20260915100420
-- Objetivo: get_or_open_hour_bank_period() es el único choke-point real de
-- "¿esta inscripción tiene banco de horas?" — lo consultan access-api.ts
-- (saldo, hour-bank-balances, student-report) y reserve_hour_bank (reservas
-- de session-bookings.ts). Hasta ahora el único gate era si el plan tenía
-- offering_plans.included_minutes_per_period seteado — CUALQUIER escuela
-- podía crear un plan con ese campo (offerings.ts lo acepta sin chequear
-- nada) y el banco de horas se activaba solo, sin pasar por
-- school_settings.hours_plan_enabled. Ya pasó: ACADEMIA SUPERIOR BOGOTA
-- (escuela demo) quedó con hours_plan_enabled=true y 3 planes de horas sin
-- que nadie lo decidiera para ella — ver fix de datos en esta misma
-- migración. auto_close_stale_hour_bank_visits() y el caché de
-- access-adms.ts YA filtran por hours_plan_enabled; esta función era la
-- única salida sin ese chequeo. Ahora hours_plan_enabled=false apaga el
-- banco de horas de punta a punta para esa escuela aunque el plan siga
-- teniendo included_minutes_per_period — activar una escuela nueva es un
-- solo UPDATE de ese flag, no depende de qué planes tenga configurados.
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
-- 1. get_or_open_hour_bank_period — agrega el chequeo de hours_plan_enabled
--    que faltaba. Firma y tipo de retorno sin cambios, CREATE OR REPLACE basta.
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
    v_enabled       boolean;
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

    -- Gate real por escuela (antes faltaba): un plan con included_minutes_per_period
    -- NO alcanza para activar el banco de horas si la escuela no lo tiene
    -- prendido explícitamente. hours_plan_enabled default false para todas —
    -- solo Dreamers hoy, cualquier otra se activa a mano cambiando este flag.
    SELECT COALESCE(ss.hours_plan_enabled, false)
      INTO v_enabled
      FROM public.school_settings ss
     WHERE ss.school_id = v_enr.school_id;

    IF NOT v_enabled THEN
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

-- =============================================================================
-- 2. Fix de datos: ACADEMIA SUPERIOR BOGOTA (escuela demo) quedó con
--    hours_plan_enabled=true sin que fuera una decisión — nadie más que
--    Dreamers debe tenerlo prendido hoy.
-- =============================================================================

UPDATE public.school_settings ss
   SET hours_plan_enabled = false
  FROM public.schools s
 WHERE ss.school_id = s.id
   AND s.name = 'ACADEMIA SUPERIOR BOGOTA'
   AND ss.hours_plan_enabled = true;

COMMIT;
