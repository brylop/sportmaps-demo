-- ============================================================
-- SPORTMAPS — Fix: el dueño/admin de escuela NO veía a sus miembros INACTIVOS
-- ------------------------------------------------------------
-- Síntoma: en /deportistas, un atleta ADULTO (school_members) inactivado
-- desaparecía por completo para la escuela — no salía en la pestaña "Inactivos".
-- Los menores (children) sí salían, por eso solo pasaba en escuelas con atletas
-- adultos (gimnasios, p.ej. VOLK FIT CLUB) y NO en Dynasty (hijos en children).
--
-- Causa (confirmada con prueba RLS simulando al dueño):
--   • school_members: el dueño SÍ ve las 7 membresías (activas e inactivas). OK.
--   • profiles: el dueño solo veía el perfil de co-miembros ACTIVOS; el perfil de
--     un miembro inactivo daba 0 filas.
--   La vista school_athletes es security_invoker y su rama de adultos hace
--   profiles JOIN school_members. Sin poder ver el PERFIL del inactivo, la fila
--   se cae del JOIN y el adulto inactivo no aparece.
--
-- Fix: policy SELECT ADITIVA (permissive) en profiles — el owner/admin de una
-- escuela puede leer el perfil de CUALQUIER miembro de esa escuela, sin importar
-- su estado. El chequeo va en una función SECURITY DEFINER (bypassa RLS → sin
-- recursión profiles→school_members→schools→profiles).
--
-- Alcance seguro: solo expone perfiles de miembros de escuelas que el caller
-- administra (owner/admin activo). No amplía la visibilidad a terceros.
-- ============================================================

-- 1. Helper SECURITY DEFINER (recursion-safe): ¿el caller es owner/admin activo
--    de alguna escuela donde p_profile_id es miembro (de cualquier estado)?
CREATE OR REPLACE FUNCTION public.can_admin_see_member_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.school_members target
        JOIN public.school_members me
          ON me.school_id  = target.school_id
         AND me.profile_id = auth.uid()
         AND me.role   IN ('owner', 'admin')
         AND me.status = 'active'
        WHERE target.profile_id = p_profile_id
    );
$$;

REVOKE ALL ON FUNCTION public.can_admin_see_member_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_admin_see_member_profile(uuid) TO authenticated;

-- 2. Policy aditiva en profiles: se une (OR) a las policies existentes, así el
--    admin/owner ve el perfil de sus miembros inactivos sin quitar nada.
DROP POLICY IF EXISTS "profiles_select_school_admin_members" ON public.profiles;
CREATE POLICY "profiles_select_school_admin_members"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.can_admin_see_member_profile(id));

NOTIFY pgrst, 'reload config';
