-- =============================================================================
-- 20260827195933_fix_extend_enrollment_reactivar_canceladas.sql
-- Autor: judegor99   Fecha: 2026-08-27   Versión anterior: 20260826220634
-- Objetivo: cerrar la condición de carrera entre fn_expire_overdue_enrollments()
--   (cron diario 8am UTC, cancela enrollments con expires_at vencido) y
--   fn_extend_enrollment_on_payment_paid() (trigger AFTER UPDATE en payments,
--   creado el 2026-07-17 -- ver esa migración -- para GYM RM). El trigger
--   original solo extendía enrollments que siguieran `active`: si el cron
--   nocturno cancelaba la inscripción ANTES de que el pago del mes se
--   marcara 'paid' (lo normal: la aprobación suele llegar días después del
--   corte), el trigger nunca la volvía a levantar -- quedaba cancelada para
--   siempre aunque la persona siguiera pagando cada mes.
--
--   Detectado el 2026-08-26/27: 15 atletas de GYM RM en este estado exacto
--   (7-24 pagos históricos cada uno, inscripción cancelada por el cron con
--   la firma horaria de las 3am COT). Reactivados a mano en la sesión de
--   validación -- ver scripts/gymrm-door-bridge/VALIDACION-2026-08-25.md.
--   Este fix es para que no se repita el próximo ciclo.
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
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
    v_enrollment record;
    v_duration   integer;
BEGIN
    IF NEW.status = 'paid'
       AND (OLD.status IS DISTINCT FROM 'paid')
       AND NEW.offering_plan_id IS NOT NULL THEN

        -- CAMBIO: status IN ('active','cancelled') en vez de solo 'active'.
        -- Si fn_expire_overdue_enrollments() ya la canceló antes de que este
        -- pago se marcara 'paid', igual la encuentra y la reactiva -- antes
        -- se perdía para siempre. ORDER BY prioriza una 'active' existente
        -- (caso normal) sobre una 'cancelled' vieja si por algún motivo
        -- coexistieran las dos.
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
            SELECT duration_days INTO v_duration
            FROM public.offering_plans
            WHERE id = NEW.offering_plan_id;

            -- Si estaba 'cancelled', la reactiva. Si ya estaba 'active', el
            -- UPDATE de status es un no-op (mismo valor) -- comportamiento
            -- idéntico al de antes para el caso normal.
            UPDATE public.enrollments
            SET status      = 'active',
                expires_at  = GREATEST(COALESCE(v_enrollment.expires_at, CURRENT_DATE), CURRENT_DATE)
                               + COALESCE(v_duration, 30),
                updated_at  = now()
            WHERE id = v_enrollment.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
