-- =============================================================================
-- 20260801102331_move_session_credit_rpc.sql
-- Autor: brylop   Fecha: 2026-08-01   Versión anterior: 20260801093452
-- Objetivo: un único punto atómico para mover el saldo de sesiones de un plan.
-- =============================================================================
-- Hoy `enrollments.sessions_used` se mueve con read-modify-write desde el BFF en
-- ~6 sitios (reservar, cancelar, marcar asistencia, devolver crédito): se lee el
-- valor, se suma 1 en Node y se escribe. Y la validación de créditos que hace
-- `fn_process_session_booking` al reservar tampoco bloquea la fila — su
-- `FOR UPDATE` es sobre `attendance_sessions`, para el aforo, no sobre
-- `enrollments`. Resultado: dos reservas simultáneas del mismo atleta leen el
-- mismo `sessions_used`, las dos pasan la validación, y **consumen un solo
-- crédito**. La clase se regala.
--
-- Esta migración crea el movedor único, con `SELECT … FOR UPDATE` sobre la
-- inscripción, como manda CLAUDE.md para cualquier contador. A partir de aquí el
-- BFF no vuelve a escribir `sessions_used` directamente.
--
-- Devuelve el estado resultante para que el caller no tenga que releer:
--   sessions_used, secondary_sessions_used, max_sessions, max_secondary_sessions,
--   expires_at, plan_name.
--
-- Notas de diseño:
--   · `p_delta` se restringe a -1 / +1: mover de a uno es todo lo que el negocio
--     necesita y evita que un bug del caller vacíe un plan de un golpe.
--   · Nunca baja de 0 (GREATEST) ni sube por encima del tope del plan cuando el
--     plan tiene `max_sessions` — un descuento que excedería el tope no revienta,
--     se queda en el tope y lo reporta en `capped`. Registrar la asistencia nunca
--     puede fallar por falta de saldo (decisión de producto D-9 del plan).
--   · Inscripción sin `offering_plan_id`: no hay nada que mover, devuelve
--     `moved = false`. Cierra el contador huérfano que dejaba el walk-in.
--
-- Plan completo: docs/plan-asistencia-y-creditos-de-sesion.md (fase F-B).
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

CREATE OR REPLACE FUNCTION public.move_session_credit(
    p_enrollment_id uuid,
    p_delta         integer,
    p_is_secondary  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_enr    record;
    v_plan   record;
    v_used   integer;
    v_max    integer;
    v_next   integer;
    v_capped boolean := false;
BEGIN
    IF p_delta NOT IN (-1, 1) THEN
        RAISE EXCEPTION 'move_session_credit: p_delta debe ser -1 o 1, llegó %', p_delta;
    END IF;

    -- El FOR UPDATE es el punto de toda la función: serializa a los dos que
    -- llegan a la vez (reservar dos veces, reservar y pasar lista al tiempo).
    SELECT e.id, e.offering_plan_id, e.expires_at,
           COALESCE(e.sessions_used, 0)           AS sessions_used,
           COALESCE(e.secondary_sessions_used, 0) AS secondary_sessions_used
      INTO v_enr
      FROM public.enrollments e
     WHERE e.id = p_enrollment_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('moved', false, 'reason', 'enrollment_not_found');
    END IF;

    -- Sin plan no hay bolsa que mover. La asistencia igual queda registrada por
    -- el caller: esto solo dice que no hubo consumo.
    IF v_enr.offering_plan_id IS NULL THEN
        RETURN jsonb_build_object('moved', false, 'reason', 'no_plan');
    END IF;

    SELECT op.name, op.max_sessions, op.max_secondary_sessions
      INTO v_plan
      FROM public.offering_plans op
     WHERE op.id = v_enr.offering_plan_id;

    IF p_is_secondary THEN
        v_used := v_enr.secondary_sessions_used;
        v_max  := v_plan.max_secondary_sessions;
    ELSE
        v_used := v_enr.sessions_used;
        v_max  := v_plan.max_sessions;
    END IF;

    v_next := GREATEST(0, v_used + p_delta);

    -- max_sessions NULL = plan ilimitado, no hay techo que respetar.
    IF v_max IS NOT NULL AND v_next > v_max THEN
        v_next   := v_max;
        v_capped := true;
    END IF;

    IF p_is_secondary THEN
        UPDATE public.enrollments
           SET secondary_sessions_used = v_next
         WHERE id = p_enrollment_id;
    ELSE
        UPDATE public.enrollments
           SET sessions_used = v_next
         WHERE id = p_enrollment_id;
    END IF;

    RETURN jsonb_build_object(
        'moved',                   v_next <> v_used,
        'capped',                  v_capped,
        'enrollment_id',           p_enrollment_id,
        'plan_name',               v_plan.name,
        'expires_at',              v_enr.expires_at,
        'sessions_used',           CASE WHEN p_is_secondary THEN v_enr.sessions_used ELSE v_next END,
        'secondary_sessions_used', CASE WHEN p_is_secondary THEN v_next ELSE v_enr.secondary_sessions_used END,
        'max_sessions',            v_plan.max_sessions,
        'max_secondary_sessions',  v_plan.max_secondary_sessions
    );
END;
$$;

COMMENT ON FUNCTION public.move_session_credit(uuid, integer, boolean) IS
    'Único punto que mueve enrollments.sessions_used / secondary_sessions_used. '
    'Toma FOR UPDATE sobre la inscripción: sin esto dos reservas simultáneas '
    'consumen un solo crédito. Ver docs/plan-asistencia-y-creditos-de-sesion.md';

-- SECURITY DEFINER no exime al caller de tener EXECUTE.
GRANT EXECUTE ON FUNCTION public.move_session_credit(uuid, integer, boolean) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
