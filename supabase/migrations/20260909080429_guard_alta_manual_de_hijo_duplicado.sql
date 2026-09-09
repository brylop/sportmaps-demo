-- =============================================================================
-- 20260909080429_guard_alta_manual_de_hijo_duplicado.sql
-- Autor: brylop   Fecha: 2026-09-09   Versión anterior: 20260909072259
-- Objetivo: que el acudiente no pueda crear a mano un hijo que YA tiene en la
--           cuenta o que YA viene en una invitación sin aceptar. Puede agregar
--           otro hijo distinto; lo que se bloquea es el duplicado.
-- =============================================================================
-- Por qué en la base y no solo en la UI: `parentsAPI.addChild` inserta directo
-- en `children` vía PostgREST, así que la validación del diálogo es un aviso,
-- no un blindaje — quien llame la API se la salta. Y el costo de que se salte
-- es alto: dos personas facturables para el mismo atleta, con la cuota
-- duplicándose en la siguiente apertura de mes.
--
-- Medido el 2026-09-09: en Besser hay 5 acudientes que ya crearon a mano al
-- hijo que la academia les había cargado (todavía sin materializar el duplicado
-- porque las aceptaciones venían fallando), y en Dynasty 6 filas duplicadas ya
-- consumadas — el patrón de [[project_duplicate_athlete_identities]]: la fila
-- vieja tiene el dinero, la nueva nace del alta manual.
--
-- ── A qué inserts aplica y por qué ──────────────────────────────────────────
-- SOLO a los que tienen la forma del alta manual: `parent_id` puesto y
-- `school_id` NULL. Ese es exactamente lo que manda AddChildDialog (no envía
-- school_id), y deja EXENTO por construcción el INSERT de
-- `accept_invitation_pro`, que siempre trae `v_invite.school_id`.
--
-- Se eligió ese discriminador en vez de una bandera de sesión para no tener que
-- volver a reescribir accept_invitation_pro entera por tercera vez hoy. Ojo con
-- la consecuencia: un cliente que mande un school_id se salta el guard. No es
-- gratis, pero un insert con school_id ya queda sujeto a las policies de esa
-- escuela, que es otra puerta.
--
-- SECURITY DEFINER porque necesita leer `invitations` completo: como
-- `authenticated`, la RLS puede esconderle justo la invitación con la que hay
-- que comparar, y un guard que a veces no ve nada no es un guard.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_guard_alta_manual_hijo_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_nombre        text;
    v_email         text;
    v_ya_en_cuenta  text;
    v_en_invitacion text;
BEGIN
    -- Solo la forma del alta manual del acudiente. Todo lo demás pasa derecho:
    -- el INSERT de accept_invitation_pro (trae school_id), las cargas del BFF
    -- con service_role y las fichas que crea la escuela (parent_id NULL).
    IF NEW.parent_id IS NULL OR NEW.school_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    v_nombre := public.normalize_athlete_name(NEW.full_name);
    IF v_nombre IS NULL THEN
        RETURN NEW;
    END IF;

    -- (a) ¿Ya lo tiene en la cuenta?
    SELECT c.full_name INTO v_ya_en_cuenta
    FROM public.children c
    WHERE c.parent_id = NEW.parent_id
      AND c.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND public.normalize_athlete_name(c.full_name) = v_nombre
    LIMIT 1;

    IF v_ya_en_cuenta IS NOT NULL THEN
        RAISE EXCEPTION
            'Ya tienes a % en tu cuenta. Si querías agregar a otro hijo, escribe su nombre completo.',
            v_ya_en_cuenta;
    END IF;

    -- (b) ¿Viene en una invitación que todavía no aceptó?
    SELECT LOWER(TRIM(u.email)) INTO v_email FROM auth.users u WHERE u.id = NEW.parent_id;

    IF v_email IS NOT NULL THEN
        SELECT s.name INTO v_en_invitacion
        FROM public.invitations i
        JOIN public.schools s ON s.id = i.school_id
        WHERE i.status = 'pending'
          AND i.role_to_assign = 'parent'
          AND LOWER(TRIM(i.email)) = v_email
          AND i.child_name IS NOT NULL
          AND public.normalize_athlete_name(i.child_name) = v_nombre
        LIMIT 1;

        IF v_en_invitacion IS NOT NULL THEN
            RAISE EXCEPTION
                'Ese atleta ya viene cargado en la invitación de %, con su plan y su equipo. Acepta la invitación desde tu inicio en vez de registrarlo a mano: si lo creas, queda duplicado.',
                v_en_invitacion;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guard_alta_manual_hijo_duplicado() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_guard_alta_manual_hijo_duplicado() FROM anon;

DROP TRIGGER IF EXISTS trg_guard_alta_manual_hijo_duplicado ON public.children;
CREATE TRIGGER trg_guard_alta_manual_hijo_duplicado
    BEFORE INSERT ON public.children
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_guard_alta_manual_hijo_duplicado();

COMMIT;
