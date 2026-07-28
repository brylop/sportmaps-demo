-- ============================================================
-- SPORTMAPS — Extensión automática de expires_at al pagar
-- ------------------------------------------------------------
-- PROBLEMA (auditado 2026-07-17):
--   enrollments.expires_at se calculaba UNA sola vez en el checkout
--   inicial (process_enrollment_checkout). generate_monthly_charges()
--   generaba los cobros mensuales siguientes, pero ningún trigger ni
--   servicio del BFF extendía expires_at cuando esos cobros se marcaban
--   'paid' (ni desde el webhook de Wompi, ni MercadoPago, ni aprobación
--   manual de admin). Resultado: fn_process_session_booking() bloqueaba
--   el agendamiento con "El plan ha expirado el %" para estudiantes que
--   seguían pagando puntualmente. Afectaba 51 enrollments activos en
--   producción al momento de la auditoría (caso detectado: David Junior
--   Andrade, GYM RM / Academia Superior Bogotá, plan Basico).
--
-- QUÉ HACE:
--   Trigger AFTER UPDATE en payments: cuando status pasa a 'paid' para
--   un pago con offering_plan_id, busca el enrollment activo del mismo
--   atleta+plan+escuela y extiende su expires_at:
--     nuevo_expires_at = GREATEST(expires_at_actual, hoy) + duration_days
--
--   Cubre los TRES tipos de pagador que existen en la plataforma:
--     1. Menor de edad         → match por child_id
--     2. Atleta no registrado  → match por unregistered_athlete_id
--     3. Adulto registrado     → match por user_id; el pagador puede
--        quedar en payments.user_id (checkout directo) o en
--        payments.parent_id (generate_monthly_charges hace
--        COALESCE(c.parent_id, e.user_id) al insertar) — se aceptan
--        ambos.
--
--   NOTA: la primera versión de este trigger (aplicada inicialmente el
--   2026-07-17) solo cubrió los casos 1 y 3. Se detectó en la misma
--   auditoría que dejaba fuera a los atletas no registrados — 17 de 31
--   enrollments no registrados vencidos sí tenían un pago 'paid' que
--   nunca les extendió el plan. Esta es la versión corregida y final.
--
-- NO cubre enrollments de equipo (team_id sin offering_plan_id), que no
-- usan expires_at.
--
-- Fecha: 2026-07-17
-- Aplicado directamente en Supabase (proyecto luebjarufsiadojhvxgi) el
-- 2026-07-17. Este archivo documenta esa migración para el repo.
-- ============================================================

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

        SELECT e.id, e.expires_at
        INTO v_enrollment
        FROM public.enrollments e
        WHERE e.school_id = NEW.school_id
          AND e.offering_plan_id = NEW.offering_plan_id
          AND e.status = 'active'
          AND (
                -- Caso menor de edad: coincide por child_id
                (NEW.child_id IS NOT NULL AND e.child_id = NEW.child_id)
                OR
                -- Caso atleta NO registrado: coincide por unregistered_athlete_id
                (NEW.unregistered_athlete_id IS NOT NULL
                 AND e.unregistered_athlete_id = NEW.unregistered_athlete_id)
                OR
                -- Caso adulto self-pay registrado: el pagador puede quedar en
                -- payments.user_id o en payments.parent_id según el flujo
                -- (checkout directo vs generate_monthly_charges).
                (NEW.child_id IS NULL AND NEW.unregistered_athlete_id IS NULL
                 AND e.child_id IS NULL AND e.unregistered_athlete_id IS NULL
                 AND e.user_id IN (NEW.user_id, NEW.parent_id))
              )
        ORDER BY e.created_at DESC
        LIMIT 1;

        IF FOUND THEN
            SELECT duration_days INTO v_duration
            FROM public.offering_plans
            WHERE id = NEW.offering_plan_id;

            UPDATE public.enrollments
            SET expires_at = GREATEST(COALESCE(v_enrollment.expires_at, CURRENT_DATE), CURRENT_DATE)
                              + COALESCE(v_duration, 30),
                updated_at  = now()
            WHERE id = v_enrollment.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extend_enrollment_on_payment_paid ON public.payments;
CREATE TRIGGER trg_extend_enrollment_on_payment_paid
    AFTER UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_extend_enrollment_on_payment_paid();
