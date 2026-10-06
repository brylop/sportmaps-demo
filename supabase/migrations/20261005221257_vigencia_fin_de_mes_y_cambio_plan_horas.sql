-- =============================================================================
-- 20261005221257_vigencia_fin_de_mes_y_cambio_plan_horas.sql
-- Autor: judegor99   Fecha: 2026-10-06   Versión anterior: 20261005173002
-- Objetivo: dos piezas de docs/specs/dreamers-ciclo-cobro-1-al-5-y-bloqueo.md
--   (mensualidades de ESTUDIANTES; no toca la suscripción de la escuela).
--
--   1. Modo de vigencia por escuela (school_settings.enrollment_validity_mode):
--      'rolling' (default, comportamiento de siempre: cada pago suma
--      duration_days) o 'calendar_month_end' (el pago de un período deja la
--      inscripción vigente hasta el ÚLTIMO DÍA de ese mes — R1 de Dreamers).
--      fn_extend_enrollment_on_payment_paid solo cambia para las escuelas en
--      'calendar_month_end'; las demás siguen exactamente igual.
--
--   2. apply_hour_bank_plan_change(enrollment_id): al cambiar el plan de una
--      inscripción, el período vigente del banco de horas pasa a las horas del
--      plan nuevo conservando lo ya consumido (R6/R7). Hoy included_minutes se
--      copia una sola vez al abrir el período y nada lo actualiza.
--
-- Radio: 1 columna nueva con default que reproduce el comportamiento actual; el
-- trigger solo cambia de rama si la escuela fue puesta en 'calendar_month_end'
-- (fuera de esta migración: es config por escuela, sin school_id hardcodeado).
-- =============================================================================

BEGIN;

-- 1. Modo de vigencia ---------------------------------------------------------
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS enrollment_validity_mode text NOT NULL DEFAULT 'rolling';

ALTER TABLE public.school_settings
  DROP CONSTRAINT IF EXISTS school_settings_enrollment_validity_mode_check;
ALTER TABLE public.school_settings
  ADD CONSTRAINT school_settings_enrollment_validity_mode_check
  CHECK (enrollment_validity_mode IN ('rolling', 'calendar_month_end'));

COMMENT ON COLUMN public.school_settings.enrollment_validity_mode IS
  'rolling = cada pago de plan suma duration_days a enrollments.expires_at (default). calendar_month_end = el pago de un período deja la inscripción vigente hasta el último día de ese mes (Dreamers: todos pagan del 1 al 5 y el plan vence a fin de mes).';

-- 2. Trigger de vigencia por pago ---------------------------------------------
-- Misma firma, SECURITY DEFINER y search_path; CREATE OR REPLACE conserva el ACL.
CREATE OR REPLACE FUNCTION public.fn_extend_enrollment_on_payment_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_enrollment record;
    v_duration   integer;
    v_mode       text;
    v_period_end date;
BEGIN
    IF NEW.status = 'paid'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
       AND NEW.offering_plan_id IS NOT NULL THEN

        SELECT e.id, e.expires_at, e.status
        INTO v_enrollment
        FROM public.enrollments e
        WHERE e.school_id = NEW.school_id
          AND e.offering_plan_id = NEW.offering_plan_id
          AND e.status IN ('active', 'cancelled')
          AND (
                (NEW.child_id IS NOT NULL AND e.child_id = NEW.child_id)
                OR
                (NEW.unregistered_athlete_id IS NOT NULL
                 AND e.unregistered_athlete_id = NEW.unregistered_athlete_id)
                OR
                (NEW.child_id IS NULL AND NEW.unregistered_athlete_id IS NULL
                 AND e.child_id IS NULL AND e.unregistered_athlete_id IS NULL
                 AND e.user_id IN (NEW.user_id, NEW.parent_id))
              )
        ORDER BY (e.status = 'active') DESC, e.created_at DESC
        LIMIT 1;

        IF FOUND THEN
            SELECT COALESCE(ss.enrollment_validity_mode, 'rolling')
              INTO v_mode
              FROM public.school_settings ss
             WHERE ss.school_id = NEW.school_id;

            IF COALESCE(v_mode, 'rolling') = 'calendar_month_end' THEN
                -- Vigente hasta el último día del mes del PERÍODO pagado (si el
                -- cobro no trae período, el mes en curso en Colombia). Idempotente:
                -- volver a marcar el mismo pago no corre la fecha.
                v_period_end := CASE
                    WHEN NEW.period_year IS NOT NULL AND NEW.period_month IS NOT NULL
                        THEN (make_date(NEW.period_year::int, NEW.period_month::int, 1)
                              + interval '1 month - 1 day')::date
                    ELSE (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date)
                          + interval '1 month - 1 day')::date
                END;

                UPDATE public.enrollments
                SET status      = 'active',
                    expires_at  = GREATEST(COALESCE(v_enrollment.expires_at, v_period_end), v_period_end),
                    updated_at  = now()
                WHERE id = v_enrollment.id;
            ELSE
                SELECT duration_days INTO v_duration
                FROM public.offering_plans
                WHERE id = NEW.offering_plan_id;

                UPDATE public.enrollments
                SET status      = 'active',
                    expires_at  = GREATEST(COALESCE(v_enrollment.expires_at, CURRENT_DATE), CURRENT_DATE)
                                   + COALESCE(v_duration, 30),
                    updated_at  = now()
                WHERE id = v_enrollment.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- 3. Cambio de plan → banco de horas ------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_hour_bank_plan_change(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_plan_minutes integer;
    v_period_id    uuid;
    v_included     integer;
    v_consumed     integer;
    v_reserved     integer;
BEGIN
    SELECT op.included_minutes_per_period
      INTO v_plan_minutes
      FROM public.enrollments e
      JOIN public.offering_plans op ON op.id = e.offering_plan_id
     WHERE e.id = p_enrollment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'apply_hour_bank_plan_change: la inscripción % no existe o no tiene plan', p_enrollment_id;
    END IF;

    -- El plan nuevo no maneja horas: no hay nada que trasladar.
    IF v_plan_minutes IS NULL THEN
        RETURN jsonb_build_object('updated', false, 'reason', 'plan_sin_horas');
    END IF;

    -- Abre el período vigente si aún no existe (con las horas del plan nuevo) o
    -- devuelve el existente; NULL si la escuela no tiene el banco de horas activo.
    v_period_id := public.get_or_open_hour_bank_period(p_enrollment_id);
    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('updated', false, 'reason', 'banco_de_horas_inactivo');
    END IF;

    -- Se cambia SOLO lo incluido: consumed/reserved se conservan (las horas ya
    -- usadas se trasladan al plan nuevo). Con un plan menor el disponible puede
    -- quedar negativo; el consumo nunca se bloquea (D-10 del banco de horas).
    UPDATE public.hour_bank_periods
       SET included_minutes = v_plan_minutes,
           updated_at       = now()
     WHERE id = v_period_id
    RETURNING included_minutes, consumed_minutes, reserved_minutes
      INTO v_included, v_consumed, v_reserved;

    RETURN jsonb_build_object(
        'updated',           true,
        'period_id',         v_period_id,
        'included_minutes',  v_included,
        'consumed_minutes',  v_consumed,
        'reserved_minutes',  v_reserved,
        'available_minutes', v_included - v_consumed - v_reserved
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_hour_bank_plan_change(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_hour_bank_plan_change(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.apply_hour_bank_plan_change(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_hour_bank_plan_change(uuid) TO service_role;

COMMIT;
