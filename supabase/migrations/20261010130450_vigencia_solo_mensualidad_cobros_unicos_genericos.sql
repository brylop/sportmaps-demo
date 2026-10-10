-- =============================================================================
-- 20261010130450_vigencia_solo_mensualidad_cobros_unicos_genericos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior de la función: 20261005221944
-- Objetivo: que pagar un cobro ÚNICO nunca extienda la vigencia de la inscripción,
--   sea cual sea su categoría.
--
--   La versión viva (pg_get_functiondef, 2026-10-10) excluía una LISTA NEGRA:
--   payment_category NOT IN ('inscripcion','seguro','excedente'). Con el CHECK
--   de payments.payment_category hoy caben además 'articulos', 'torneo',
--   'clase_extra', 'vacacional', 'viaje' y 'otro', y la lista de cobros únicos
--   por plan que viene sumará más. Cualquiera de ellos con offering_plan_id
--   (los cobros del alta lo llevan: inscripción y seguro de Dreamers del
--   2026-10-10 nacen con offering_plan_id y period_year/period_month) le
--   regalaba a la familia un período entero de vigencia al pagarse.
--
--   Cambio: LISTA BLANCA. Solo extiende la mensualidad: payment_category NULL
--   (filas viejas y open_month, que no estampan categoría) o 'mensualidad'.
--   payment_type NO sirve para distinguir: 2.220 cobros 'one_time' con plan y
--   categoría NULL son mensualidades (medido el 2026-10-10), por eso no se usa.
--
--   Radio (2026-10-10): de los cobros con offering_plan_id, los únicos con
--   categoría distinta de mensualidad son 3 inscripciones + 3 seguros, todos
--   'pending'. Ninguna fila pagada cambia de comportamiento retroactivamente
--   (el trigger solo actúa en la transición a 'paid').
--
--   El resto del cuerpo es IDÉNTICO a la versión viva (modo de vigencia
--   rolling / calendar_month_end). CREATE OR REPLACE conserva el trigger
--   trg_extend_enrollment_on_payment_paid y los GRANT existentes.
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

CREATE OR REPLACE FUNCTION public.fn_extend_enrollment_on_payment_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_enrollment record;
    v_duration   integer;
    v_mode       text;
    v_period_end date;
BEGIN
    IF NEW.status = 'paid'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
       AND NEW.offering_plan_id IS NOT NULL
       -- 20261010130450: solo la mensualidad da vigencia. Cualquier otra
       -- categoría (inscripción, seguro, excedente, artículos, torneo, clase
       -- extra, vacacional, viaje, otro y las que vengan) es un cobro único.
       AND COALESCE(NEW.payment_category, 'mensualidad') = 'mensualidad' THEN

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

COMMIT;

-- Verificación (después de aplicar):
--   select prosrc ilike '%COALESCE(NEW.payment_category, ''mensualidad'') = ''mensualidad''%'
--     from pg_proc where proname = 'fn_extend_enrollment_on_payment_paid';   -- true
