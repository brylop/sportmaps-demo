-- =============================================================================
-- 20260910073724_profiles_bloquear_autoasignacion_de_rol.sql
-- Autor: brylop   Fecha: 2026-09-10   Versión anterior: 20260909222343
-- Objetivo: impedir que un usuario se escriba su propio profiles.role.
--
-- La única policy de escritura de profiles es «Profiles: update own»
-- USING (auth.uid() = id). Eso decide QUÉ FILA se puede tocar, no QUÉ COLUMNA:
-- RLS filtra filas, no columnas, y encima `authenticated` tiene UPDATE a nivel
-- de tabla. Resultado: cualquiera de los 1.117 usuarios podía hacer
-- `update profiles set role='school_admin' where id = <su propio id>` y quedar
-- habilitado en todo lo que pregunta por el rol sin correlacionarlo con una
-- escuela — el facturador electrónico entre otros (ver
-- bff/src/routes/invoicing.routes.ts), y el escape hatch de plataforma de
-- requireAuth, que con role='admin' o 'super_admin' salta school_members
-- entero.
--
-- (Nota para el que venga: acá el problema NO es el WITH CHECK ausente. En una
-- policy FOR UPDATE, Postgres reusa el USING como WITH CHECK, así que la fila
-- ya está atada a auth.uid(). Lo que falta es granularidad de columna, y en
-- RLS eso no existe.)
--
-- Se resuelve con un trigger y no con una policy porque una policy no puede
-- comparar contra el valor ANTERIOR: WITH CHECK solo ve la fila nueva. El
-- trigger además corre pase lo que pase — las policies son PERMISIVAS y se
-- suman con OR, así que una sexta policy sobre profiles no abre este agujero
-- de nuevo.
--
-- Radio medido antes de escribir esto:
--   · El camino legítimo del producto es la RPC complete_role_selection
--     (20260617000001, SECURITY DEFINER, owner postgres): entra con
--     current_user = 'postgres', no cae en la regla 1 y sigue funcionando.
--     Onboarding intacto.
--   · Otras 6 funciones SECURITY DEFINER escriben profiles.role y también
--     siguen funcionando: accept_invitation_pro, claim_child_for_parent,
--     claim_children_by_document, claim_member_for_plan,
--     provision_personal_trainer_workspace, submit_qr_signup__interno.
--   · El BFF (service_role) y el SQL editor (postgres/supabase_admin) tampoco
--     caen en la regla 1.
--   · Ningún camino del cliente escribe role directo: el frontend solo llama a
--     complete_role_selection. El único UPDATE con role del BFF va por RPC.
--
-- NO se usan privilegios por columna (REVOKE UPDATE + GRANT UPDATE(col…)) a
-- propósito: dejarían fail-closed toda columna futura de profiles, y en este
-- repo el esquema se mueve por fuera de las migraciones — el día que alguien
-- agregue una columna desde el SQL editor, el editor de perfil del cliente se
-- rompería con un 403 sin pista de por qué.
--
-- NO APLICADA. Queda como archivo para revisión antes de tocar la base.
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

-- SECURITY INVOKER (el default) es OBLIGATORIO acá y no un descuido: la
-- función necesita ver el current_user del que dispara el UPDATE. Marcarla
-- SECURITY DEFINER la haría verse siempre como su propio owner y la regla 1
-- nunca dispararía — el guard quedaría de adorno.
CREATE OR REPLACE FUNCTION public.profiles_guard_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Salida temprana: el 99,9% de los UPDATE de profiles son nombre, teléfono
    -- o datos fiscales y no tienen que pagar ningún chequeo.
    IF NEW.role IS NOT DISTINCT FROM OLD.role
       AND NEW.role_id IS NOT DISTINCT FROM OLD.role_id THEN
        RETURN NEW;
    END IF;

    -- Regla 1 — el cliente NUNCA escribe su rol.
    -- PostgREST corre con current_user = 'authenticated' (o 'anon'); dentro de
    -- una función SECURITY DEFINER owner postgres, current_user es 'postgres'.
    -- Por eso esta condición separa exactamente «UPDATE directo desde el
    -- navegador» de «RPC auditada del producto», sin tener que enumerar las
    -- columnas escribibles ni las RPCs permitidas.
    IF current_user IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION
            'El rol no se escribe directo sobre profiles. Usa la RPC complete_role_selection o una invitación.'
            USING ERRCODE = '42501';
    END IF;

    -- Regla 2 — segundo cinturón, para el día que una RPC nueva reenvíe un rol
    -- que le pasó el usuario. Los roles de PLATAFORMA no los reparte nadie con
    -- sesión de usuario: 'admin' y 'super_admin' abren el escape hatch de
    -- requireAuth para TODAS las escuelas, y hoy no hay ningún camino
    -- legítimo que los asigne (el único admin real vive en platform_admins,
    -- que es lo que mira is_platform_admin(); ninguna invitación pide esos
    -- roles).
    --
    -- 'school_admin' queda FUERA de esta lista a propósito:
    -- accept_invitation_pro lo asigna cuando alguien acepta una invitación de
    -- administrador — hay una pendiente en la base — y bloquearlo rompería el
    -- alta de admins de escuela. A ese rol lo cubre la regla 1, que es donde
    -- estaba el agujero.
    --
    -- auth.uid() IS NULL = no hay sesión de usuario detrás (BFF con
    -- service_role, cron, migración, SQL editor). Ahí el gate real es el de
    -- esa capa, no este trigger.
    IF NEW.role::text IN ('admin', 'super_admin')
       AND NEW.role IS DISTINCT FROM OLD.role
       AND auth.uid() IS NOT NULL
       AND NOT public.is_platform_admin() THEN
        RAISE EXCEPTION
            'Solo un admin de plataforma puede asignar el rol %.', NEW.role
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_guard_role_escalation() IS
    'Trigger de profiles: bloquea que el cliente (authenticated/anon) cambie '
    'role/role_id por UPDATE directo, y que cualquier camino con sesión de '
    'usuario promueva a los roles de plataforma admin/super_admin. El camino '
    'legítimo es la RPC complete_role_selection o accept_invitation_pro.';

-- Una función trigger no se puede invocar como RPC normal ("trigger functions
-- can only be called as triggers"), así que el GRANT es inofensivo; va
-- explícito igual, por la regla de CLAUDE.md y para que ningún GRANT default
-- futuro sea lo que decida si el guard corre.
REVOKE ALL ON FUNCTION public.profiles_guard_role_escalation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_guard_role_escalation()
    TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_profiles_guard_role ON public.profiles;

-- BEFORE UPDATE OF role, role_id: el trigger ni se evalúa cuando el UPDATE no
-- menciona esas columnas. Igual se revalida adentro con IS NOT DISTINCT FROM,
-- porque "OF columna" dispara al mencionarla aunque el valor no cambie.
CREATE TRIGGER trg_profiles_guard_role
    BEFORE UPDATE OF role, role_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_guard_role_escalation();

COMMIT;

NOTIFY pgrst, 'reload schema';
