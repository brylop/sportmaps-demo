-- =============================================================================
-- 20261006101735_desactivar_atleta_cancela_invitacion.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006101656
-- Objetivo: al inactivar un atleta, cancelar también la invitación de acudiente
-- que sigue pendiente, para que la familia deje de recibir correos de
-- invitación y el bot de WhatsApp deje de ofrecerle el enlace de registro.
--
-- Caso real (Dynasty, 2026-10-06): Isabella Mancera Sarmiento inactivada a las
-- 09:48; enrollment y cobros quedaron cancelados, pero la invitación a la mamá
-- (28c7071d-…) siguió 'pending'. 55 invitaciones vivas estaban en el mismo
-- estado (54 Dynasty, 1 Dreamers).
--
-- Parte de la definición VIVA (pg_get_functiondef), no del archivo de
-- 20260730170000. Lo único nuevo es el paso 3 y `invitations_cancelled`.
--
-- Vínculo atleta → invitación:
--   · unregistered: unregistered_athletes.invitation_id (FK directa).
--   · child: no hay FK; se cruza por escuela + nombre normalizado, y SOLO si no
--     queda otro atleta ACTIVO de la escuela con ese mismo nombre (homónimos).
--   · adult: no tiene invitación de acudiente.
-- Reactivar NO revive la invitación: la escuela invita de nuevo.
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
AS $function$
DECLARE
    v_enrollments int := 0;
    v_payments    int := 0;
    v_invitations int := 0;
    v_touched     boolean := false;
    v_nombre      text;
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

        -- ── 3. Cancelar la invitación de acudiente que sigue pendiente ───────
        IF p_athlete_type = 'unregistered' THEN
            UPDATE public.invitations i
               SET status = 'cancelled'
              FROM public.unregistered_athletes u
             WHERE u.id            = p_athlete_id
               AND i.id            = u.invitation_id
               AND i.school_id     = p_school_id
               AND i.status        = 'pending';
            GET DIAGNOSTICS v_invitations = ROW_COUNT;

        ELSIF p_athlete_type = 'child' THEN
            SELECT lower(btrim(c.full_name)) INTO v_nombre
              FROM public.children c
             WHERE c.id = p_athlete_id;

            IF v_nombre IS NOT NULL AND v_nombre <> ''
               -- Homónimo activo en la escuela: la invitación puede ser suya.
               AND NOT EXISTS (
                   SELECT 1 FROM public.children c
                    WHERE c.id <> p_athlete_id
                      AND c.is_active
                      AND lower(btrim(c.full_name)) = v_nombre
                      AND (c.school_id = p_school_id
                           OR EXISTS (SELECT 1 FROM public.enrollments e
                                       WHERE e.child_id = c.id
                                         AND e.school_id = p_school_id)))
               AND NOT EXISTS (
                   SELECT 1 FROM public.unregistered_athletes u
                    WHERE u.school_id = p_school_id
                      AND u.is_active
                      AND lower(btrim(u.full_name)) = v_nombre)
            THEN
                UPDATE public.invitations
                   SET status = 'cancelled'
                 WHERE school_id      = p_school_id
                   AND status         = 'pending'
                   AND role_to_assign = 'parent'
                   AND lower(btrim(child_name)) = v_nombre;
                GET DIAGNOSTICS v_invitations = ROW_COUNT;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'athlete_id',            p_athlete_id,
        'athlete_type',          p_athlete_type,
        'active',                p_active,
        'enrollments_cancelled', v_enrollments,
        'payments_cancelled',    v_payments,
        'invitations_cancelled', v_invitations
    );
END;
$function$;

-- La función exige is_school_admin/is_super_admin adentro; anon nunca pasa.
REVOKE ALL ON FUNCTION public.set_school_athlete_status(uuid, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_school_athlete_status(uuid, text, uuid, boolean) TO authenticated, service_role;

COMMIT;
