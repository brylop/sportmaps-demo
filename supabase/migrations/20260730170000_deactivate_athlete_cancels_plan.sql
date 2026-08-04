-- ============================================================
-- SPORTMAPS — Inactivar un atleta corta su plan y su cartera pendiente
-- ------------------------------------------------------------
-- Caso VOLK FIT CLUB (2026-07-30): tres atletas adultos se inactivaron desde la
-- pestaña Inactivos y siguieron con inscripción `active` y cobros vivos. A
-- `omar pedraza` (inactivado 02:54) se le generó la cuota de julio a las 03:07,
-- DESPUÉS de la baja: `open_month()` filtra únicamente `enrollments.status`, no
-- el estado del atleta, así que un inactivo con plan activo sigue facturando.
--
-- Origen: la baja se hacía client-side (`studentsAPI.updateStudent`) tocando
-- SOLO la tabla base — `school_members.status` / `children.is_active` /
-- `unregistered_athletes.is_active` — sin tocar `enrollments` ni `payments`.
--
-- Decisión de producto: al inactivar se cancela el plan y se ANULAN los cobros
-- pendientes (pending / awaiting_approval / overdue). Los pagos ya conciliados
-- (paid / partial) no se tocan nunca. Al reactivar hay que reasignar el plan a
-- mano: no se resucita nada, para no revivir cobros por error.
--
-- Se resuelve con un RPC SECURITY DEFINER porque las tres escrituras tienen que
-- ir juntas y el cliente no puede (ni debe) escribir `payments` de otros.
--
-- Migración nueva (timestamp posterior). Fecha: 2026-07-30
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.set_school_athlete_status(
    p_school_id    uuid,
    p_athlete_type text,
    p_athlete_id   uuid,
    p_active       boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_enrollments int := 0;
    v_payments    int := 0;
    v_touched     boolean := false;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado.';
    END IF;

    IF p_athlete_type NOT IN ('child', 'adult', 'unregistered') THEN
        RAISE EXCEPTION 'athlete_type inválido: %', p_athlete_type;
    END IF;

    -- ── 1. Estado en la tabla base, con candado de escuela ───────────────────
    IF p_athlete_type = 'child' THEN
        -- El menor puede estar inscrito en esta escuela con `children.school_id`
        -- apuntando a otra (soporte multi-escuela de la vista school_athletes),
        -- así que se acepta por pertenencia O por inscripción.
        UPDATE public.children
           SET is_active  = p_active,
               updated_at = now()
         WHERE id = p_athlete_id
           AND (school_id = p_school_id
                OR EXISTS (SELECT 1 FROM public.enrollments e
                            WHERE e.child_id = p_athlete_id
                              AND e.school_id = p_school_id));

    ELSIF p_athlete_type = 'adult' THEN
        UPDATE public.school_members
           SET status     = CASE WHEN p_active THEN 'active' ELSE 'inactive' END,
               updated_at = now()
         WHERE profile_id = p_athlete_id
           AND school_id  = p_school_id
           AND role       = 'athlete';

    ELSE
        UPDATE public.unregistered_athletes
           SET is_active  = p_active,
               updated_at = now()
         WHERE id        = p_athlete_id
           AND school_id = p_school_id;
    END IF;

    v_touched := FOUND;
    IF NOT v_touched THEN
        RAISE EXCEPTION 'Atleta no encontrado en esta escuela.';
    END IF;

    -- ── 2. Al inactivar: cortar plan/equipo y anular la cartera pendiente ────
    IF NOT p_active THEN
        UPDATE public.enrollments
           SET status     = 'cancelled',
               end_date   = COALESCE(end_date, CURRENT_DATE),
               updated_at = now()
         WHERE school_id = p_school_id
           AND status    = 'active'
           AND (   (p_athlete_type = 'child'        AND child_id                = p_athlete_id)
                OR (p_athlete_type = 'adult'        AND user_id                 = p_athlete_id)
                OR (p_athlete_type = 'unregistered' AND unregistered_athlete_id = p_athlete_id));
        GET DIAGNOSTICS v_enrollments = ROW_COUNT;

        -- `paid` y `partial` quedan intactos: son dinero ya recibido.
        UPDATE public.payments
           SET status     = 'cancelled',
               updated_at = now()
         WHERE school_id = p_school_id
           AND status IN ('pending', 'awaiting_approval', 'overdue')
           AND (   (p_athlete_type = 'child'        AND child_id                = p_athlete_id)
                OR (p_athlete_type = 'adult'        AND (user_id = p_athlete_id
                                                         OR (parent_id = p_athlete_id AND child_id IS NULL)))
                OR (p_athlete_type = 'unregistered' AND unregistered_athlete_id = p_athlete_id));
        GET DIAGNOSTICS v_payments = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'athlete_id',            p_athlete_id,
        'athlete_type',          p_athlete_type,
        'active',                p_active,
        'enrollments_cancelled', v_enrollments,
        'payments_cancelled',    v_payments
    );
END;
$$;

COMMENT ON FUNCTION public.set_school_athlete_status(uuid, text, uuid, boolean) IS
  'Activa/inactiva un atleta de la escuela. Al inactivar cancela sus inscripciones activas y anula sus cobros pendientes (pending/awaiting_approval/overdue); paid/partial no se tocan. Reactivar NO restaura el plan.';

GRANT EXECUTE ON FUNCTION public.set_school_athlete_status(uuid, text, uuid, boolean) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
