-- =============================================================================
-- 20261005221944_fn_extend_vigencia_viva_mas_cobros_unicos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261005221734
-- Objetivo: re-unir fn_extend_enrollment_on_payment_paid.
--   · La versión VIVA (verificada con pg_get_functiondef el 2026-10-05) tiene
--     el modo de vigencia por escuela (school_settings.enrollment_validity_mode:
--     'rolling' | 'calendar_month_end') — entró por fuera del repo (deriva), no
--     está en ninguna migración versionada.
--   · 20261005214245 (F-A Dreamers) reescribió la función sobre una versión
--     VIEJA del repo (sin v_mode/v_period_end) para agregar que pagar un cobro
--     único (inscripción / seguro / excedente) no extiende la vigencia. Al
--     aplicarse en orden borra el modo calendar_month_end.
--   Esta migración la sigue y deja: cuerpo vivo + la exclusión de F-A. Además
--   versiona por primera vez la lógica de enrollment_validity_mode.
--   CREATE OR REPLACE conserva el trigger y los GRANT existentes.
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
       -- 20261005214245 / 20261005221944: un cobro único (inscripción, seguro,
       -- excedente) no es un período de servicio; pagarlo no da vigencia.
       AND COALESCE(NEW.payment_category, '') NOT IN ('inscripcion', 'seguro', 'excedente') THEN

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
