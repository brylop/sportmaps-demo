-- =============================================================================
-- 20260915121329_corrige_hours_plan_enabled_academia_superior.sql
-- Autor: judegor99   Fecha: 2026-09-15   Versión anterior: 20260915001252
-- Objetivo: reserve_hour_bank() rechazaba TODA reserva de banco de horas del
-- enrollment de PACK 6 CLASES en Academia Superior Bogotá con
-- {reason:'not_hours_plan'}, a pesar de que sí es un plan de horas
-- (offering_plans.included_minutes_per_period=720) y de que el piloto de
-- agendamiento flexible ya estaba prendido ahí (school_settings.
-- hour_bank_flexible_booking_enabled=true, migración 20260915001252).
--
-- Causa raíz encontrada comparando la función LIVE (pg_get_functiondef)
-- contra la migración que la originó (20260821131412_hour_bank_move_rpc.sql):
-- en algún punto después de esa migración, get_or_open_hour_bank_period()
-- recibió en vivo (sin migración que quedara commiteada — el drift que
-- advierte el CLAUDE.md del repo) un gate adicional sobre
-- school_settings.hours_plan_enabled, el flag MAESTRO del módulo completo
-- de banco de horas (agregado en 20260821125525_dreamers_hour_bank_schema.sql,
-- default false, y ya usado por las RPCs de autocierre). Es un gate
-- correcto y deliberado — el bug real es de DATOS: Academia Superior Bogotá
-- nunca tuvo ese flag maestro en true, aunque sí tenía prendido el sub-flag
-- específico del piloto flexible. Dreamers sí lo tenía en true (por eso
-- ahí el agendamiento de banco de horas nunca falló).
--
-- Esta migración hace dos cosas:
--   1. Deja la función get_or_open_hour_bank_period() tal como corre HOY en
--      vivo (CREATE OR REPLACE con el mismo cuerpo, verificado con
--      pg_get_functiondef) — no cambia comportamiento, cierra el hueco de
--      que el repo no tenía rastro de ese gate.
--   2. Prende el flag maestro para Academia Superior Bogotá — el fix real.
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

CREATE OR REPLACE FUNCTION public.get_or_open_hour_bank_period(p_enrollment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
        RETURN NULL;
    END IF;

    SELECT op.included_minutes_per_period
      INTO v_included
      FROM public.offering_plans op
     WHERE op.id = v_enr.offering_plan_id;

    IF v_included IS NULL THEN
        RETURN NULL;
    END IF;

    -- Flag MAESTRO del módulo (20260821125525_dreamers_hour_bank_schema.sql) —
    -- sin esto una escuela con un plan de horas pero el módulo apagado igual
    -- podría reservar. Ver nota de esta migración: este gate ya corría en
    -- vivo, solo faltaba dejarlo commiteado.
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
        v_period_start := v_enr.start_date
            + (30 * FLOOR(GREATEST(0, v_today - v_enr.start_date) / 30.0))::int;
        v_period_end := v_period_start + 29;
    ELSE
        v_period_start := date_trunc('month', v_today)::date;
        v_period_end   := (date_trunc('month', v_today) + interval '1 month' - interval '1 day')::date;
    END IF;

    INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes)
    VALUES (p_enrollment_id, v_enr.school_id, v_period_start, v_period_end, v_included)
    ON CONFLICT (enrollment_id, period_start) DO NOTHING;

    SELECT id INTO v_period_id
      FROM public.hour_bank_periods
     WHERE enrollment_id = p_enrollment_id
       AND period_start = v_period_start;

    RETURN v_period_id;
END;
$function$;

COMMENT ON FUNCTION public.get_or_open_hour_bank_period(uuid) IS
    'Resuelve (o abre) el hour_bank_periods vigente hoy para una inscripción, '
    'según school_settings.billing_cycle_type (D-12). NULL si la inscripción no '
    'tiene un plan por horas, o si school_settings.hours_plan_enabled es false '
    '(flag maestro del módulo). Ver docs/specs/dreamers-banco-de-horas-torniquete.md';

GRANT EXECUTE ON FUNCTION public.get_or_open_hour_bank_period(uuid) TO authenticated;

-- ── El fix real: Academia Superior Bogotá nunca prendió el flag maestro ──
UPDATE public.school_settings
   SET hours_plan_enabled = true
 WHERE school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
   AND hours_plan_enabled = false;

COMMIT;
