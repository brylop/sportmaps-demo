-- =============================================================================
-- 20260814184457_piso_rls_padres_no_gestionan_staff_ni_invitaciones.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814125518
-- Objetivo: cerrar una ESCALADA DE PRIVILEGIOS activa.
--
-- ── El problema ─────────────────────────────────────────────────────────────
-- `user_school_ids()` devuelve toda escuela donde el usuario esté en
-- school_members con status='active', SIN mirar el rol. Y ahí hay 727 padres y
-- 37 atletas activos.
--
-- Las policies de `invitations` y `school_staff` daban permiso ALL/INSERT/
-- UPDATE/DELETE apoyándose únicamente en esa función. En la práctica:
--
--   · un padre podía insertar una invitación de SU escuela con
--     role_to_assign='admin', aceptarla y quedar como administrador;
--   · o insertarse directamente en school_staff.
--
-- Desde la consola del navegador, con su sesión normal. No es teórico: eran 727
-- cuentas con esa capacidad.
--
-- ── Por qué estas dos tablas y no las otras 39 ──────────────────────────────
-- Son las que permiten OTORGAR permisos. Invitar con rol admin es volverse
-- admin: es el único grupo donde el daño no es leer o romper datos, sino
-- convertirse en otra persona. El resto (alineaciones, resultados, métricas) se
-- revisa aparte, una por una.
--
-- Este es el PISO y no es configurable. La idea de que cada escuela decida qué
-- puede cada rol es correcta, pero va ENCIMA de esto: si "invitar" fuera
-- delegable a un padre, la escalada volvería por la puerta de adelante.
-- Regla: si un permiso permite otorgar permisos, no se delega.
--
-- ── Impacto medido ANTES de aplicar ─────────────────────────────────────────
--   · Pierden escritura: 727 padres, 37 atletas, 24 coaches, 2 reporters.
--   · Conservan todo: 61 owners + 5 admins en school_members, más el dueño por
--     schools.owner_id (hay 1 escuela cuyo dueño está solo por esa vía).
--   · 303 escuelas no tienen admin en school_members, pero 302 no tienen NINGÚN
--     miembro activo: son altas que nunca se usaron y hoy tampoco tienen a nadie
--     con acceso. No se rompe nada ahí.
--   · El BFF usa service_role y SALTA RLS, así que ningún flujo de la API se ve
--     afectado. Del frontend solo AdminUsersPage inserta invitaciones, y esa
--     pantalla es de admins.
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
-- Helper: escuelas donde el usuario SÍ es administración.
--
-- Dos vías, porque la propiedad está representada de dos formas en los datos:
--   1. school_members con rol de administración.
--   2. schools.owner_id — hay 1 escuela cuyo dueño solo figura así; sin esta
--      vía lo dejaríamos afuera de su propia escuela.
--
-- NO incluye la vía school_staff.coach_auth_id que sí usa user_school_ids():
-- un coach no gestiona staff ni invitaciones. Si alguna escuela necesita
-- delegarle eso, es exactamente el caso que resuelve el módulo de permisos
-- configurables, no un agujero en el piso.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_admin_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(ARRAY(
    SELECT sm.school_id
      FROM public.school_members sm
     WHERE sm.profile_id = auth.uid()
       AND sm.status = 'active'
       AND sm.role IN ('owner','admin','school_admin','super_admin')

    UNION

    SELECT s.id
      FROM public.schools s
     WHERE s.owner_id = auth.uid()
  ), '{}'::uuid[]);
$$;

COMMENT ON FUNCTION public.user_admin_school_ids() IS
    'Escuelas donde el usuario es administración (rol en school_members o '
    'schools.owner_id). A diferencia de user_school_ids(), NO devuelve escuelas '
    'donde el usuario es solo padre, atleta o coach. Usar en toda policy que '
    'permita otorgar permisos.';

REVOKE ALL ON FUNCTION public.user_admin_school_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_admin_school_ids() TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- invitations: solo administración
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Invitations: manage staff" ON public.invitations;

CREATE POLICY "Invitations: manage staff"
    ON public.invitations
    FOR ALL
    USING      (school_id = ANY (public.user_admin_school_ids()))
    WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- school_staff: las CUATRO de escritura.
--
-- Arreglar solo la de ALL no cerraba nada: las de INSERT/UPDATE/DELETE son
-- policies independientes y permisivas, así que se suman (OR). Alcanzaba con
-- cualquiera de ellas para insertarse como staff.
--
-- Las de SELECT se dejan como están a propósito: que un padre vea la lista de
-- entrenadores es un problema distinto y mucho menor, y tocarlas acá ampliaría
-- el radio de este cambio sin necesidad. Van en la segunda tanda.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff: manage own school"     ON public.school_staff;
DROP POLICY IF EXISTS "school_members_insert_staff"  ON public.school_staff;
DROP POLICY IF EXISTS "school_members_update_staff"  ON public.school_staff;
DROP POLICY IF EXISTS "school_members_delete_staff"  ON public.school_staff;

CREATE POLICY "Staff: manage own school"
    ON public.school_staff
    FOR ALL
    USING      (school_id = ANY (public.user_admin_school_ids()))
    WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

CREATE POLICY "school_members_insert_staff"
    ON public.school_staff
    FOR INSERT
    TO authenticated
    WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

CREATE POLICY "school_members_update_staff"
    ON public.school_staff
    FOR UPDATE
    TO authenticated
    USING      (school_id = ANY (public.user_admin_school_ids()))
    WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

CREATE POLICY "school_members_delete_staff"
    ON public.school_staff
    FOR DELETE
    TO authenticated
    USING (school_id = ANY (public.user_admin_school_ids()));

COMMIT;
