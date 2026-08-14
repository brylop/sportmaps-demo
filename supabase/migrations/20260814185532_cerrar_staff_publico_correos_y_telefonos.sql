-- =============================================================================
-- 20260814185532_cerrar_staff_publico_correos_y_telefonos.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814185120
-- Objetivo: dejar de exponer los correos y teléfonos del staff a internet.
--
-- ── El hallazgo ─────────────────────────────────────────────────────────────
-- La policy "Public select staff" sobre school_staff era:
--
--     FOR SELECT  TO public  USING (true)
--
-- y `anon` tiene el privilegio SELECT sobre la tabla. Como la llave anónima
-- viaja en el bundle del frontend, cualquiera podía leer las 70 fichas de staff
-- de TODAS las escuelas: full_name, email, phone, certifications y
-- coach_auth_id. Sin autenticarse.
--
-- Es divulgación de datos personales de terceros (los entrenadores no son
-- usuarios de la plataforma en muchos casos, son personas cargadas por la
-- escuela), así que no es solo un problema técnico.
--
-- ── Por qué no alcanza con borrar la policy ─────────────────────────────────
-- El perfil público de la escuela SÍ muestra legítimamente a sus entrenadores
-- (lib/api/schools.ts). Borrar la policy a secas dejaría esa sección vacía.
--
-- Y RLS no sirve para resolverlo: filtra FILAS, no COLUMNAS. El problema no es
-- qué entrenadores se ven, es qué campos de cada uno.
--
-- ── La solución ─────────────────────────────────────────────────────────────
-- Una vista con solo los campos publicables. El frontend público pasa a leer de
-- ahí, y la tabla base queda cerrada a quien no tenga sesión en esa escuela.
--
-- La vista NO lleva security_invoker: se apoya a propósito en los permisos de su
-- dueño para saltar la RLS de la tabla base. Es deliberado y es seguro porque lo
-- que expone ya está recortado a nivel de columnas — es exactamente el mecanismo
-- que RLS no ofrece. Si llevara security_invoker, al quitar la policy pública
-- devolvería cero filas y no serviría para nada.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Vista pública: solo lo que puede ver cualquiera
--
-- Fuera quedan email, phone y coach_auth_id. `certifications` y `specialty` se
-- mantienen porque son justamente lo que la escuela quiere mostrar de su cuerpo
-- técnico.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_school_staff_publico AS
    SELECT
        ss.id,
        ss.school_id,
        ss.branch_id,
        ss.full_name,
        ss.specialty,
        ss.certifications
    FROM public.school_staff ss
    WHERE ss.status = 'active';

COMMENT ON VIEW public.v_school_staff_publico IS
    'Cuerpo tecnico visible en el perfil publico de la escuela. Excluye email, '
    'phone y coach_auth_id a proposito: la tabla base los tenia expuestos a anon '
    'por la policy "Public select staff" (ver 20260814185532). Sin '
    'security_invoker de forma deliberada — el recorte de seguridad aca es por '
    'COLUMNAS, que es lo que RLS no puede hacer.';

GRANT SELECT ON public.v_school_staff_publico TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Cerrar la tabla base
--
-- Se quitan las policies abiertas a `public`. Quedan vigentes las que atienden
-- a quien SÍ pertenece a la escuela:
--   · school_members_read_staff  (miembros de la escuela)
--   · staff_select_policy        (el propio staff por email, y administración)
--   · coach_read_own_record      (el coach su propia ficha)
--   · Staff: manage admin / manage own school (administración)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public select staff" ON public.school_staff;

-- Estas dos son duplicados exactos entre sí y de school_members_read_staff
-- (misma expresión: school_id = ANY (user_school_ids())). Se dejan las tres
-- porque quitarlas no cambia el resultado y borrarlas sin necesidad amplía el
-- radio de esta migración.

COMMIT;
