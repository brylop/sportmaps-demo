-- =============================================================================
-- 20261022110155_pizarra_admin_edita_tablero.sql
-- Pedido de CLUB DEPORTIVO BESSER (2026-10-22): la administración quiere los
-- mismos permisos que el entrenador sobre la pizarra táctica (alineaciones,
-- plantillas, biblioteca, paquetes, notas, videos y equipos rivales).
--
-- user_tactical_edit_school_ids() gobierna las policies de escritura de todo
-- eso (ver 20260925170001 y 20261015171124..31). Se agregan 'admin' y
-- 'school_admin' a la rama de school_members. NO se agrega nada de más:
-- 'staff', 'parent' y 'athlete' siguen sin editar, 'super_admin' no cambia.
--
-- Mismo cuerpo que la versión viva; solo cambia la lista de roles.
-- Rollback: volver a crear la función con IN ('owner','coach','super_admin').
-- =============================================================================

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.user_tactical_edit_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT COALESCE(ARRAY(
    SELECT sm.school_id
      FROM public.school_members sm
     WHERE sm.profile_id = auth.uid()
       AND sm.status = 'active'
       AND sm.role IN ('owner', 'admin', 'school_admin', 'coach', 'super_admin')
    UNION
    SELECT ss.school_id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.status = 'active'
    UNION
    SELECT ss.school_id
      FROM public.school_staff ss
      JOIN auth.users au ON LOWER(au.email) = LOWER(ss.email)
     WHERE au.id = auth.uid()
       AND ss.coach_auth_id IS NULL
       AND ss.status = 'active'
    UNION
    SELECT s.id
      FROM public.schools s
     WHERE s.owner_id = auth.uid()
  ), '{}'::uuid[]);
$function$;

GRANT EXECUTE ON FUNCTION public.user_tactical_edit_school_ids() TO authenticated;
