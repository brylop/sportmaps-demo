-- =============================================================================
-- 20261023093127_get_school_athletes_gate_staff.sql
-- ROADMAP v2.38 #22 (antes ítem 4 de v2.36): get_school_athletes(uuid, uuid) es
-- SECURITY DEFINER y su gate era user_school_ids(), que incluye a padres y
-- atletas. Cualquier acudiente de una escuela podía listar nombre y correo de
-- TODOS los acudientes de esa escuela. Se cambia el gate a user_staff_school_ids()
-- (quien TRABAJA en la escuela) o plataforma.
--
-- Qué NO cambia, a propósito:
--  * get_school_athletes(uuid) (1 argumento): EXECUTE solo para service_role
--    (authenticated y anon no pueden llamarla). Ponerle un gate de identidad la
--    rompería para el BFF, que corre sin JWT (auth.uid() NULL).
--  * Firma, columnas y defaults de la de 2 argumentos: CREATE OR REPLACE exacto.
--
-- Llamadores verificados: ninguno en frontend/ ni bff/ (solo el tipo generado en
-- types.ts). Nadie legítimo pierde acceso.
--
-- Rollback: volver a crear la función con user_school_ids() en el gate.
-- =============================================================================

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.get_school_athletes(p_school_id uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, school_id uuid, athlete_type text, user_id uuid, parent_id uuid, enrollment_id uuid, enrollment_status text, enrolled_team_id uuid, offering_plan_id uuid, sessions_used integer, secondary_sessions_used integer, expires_at date, team_name text, team_sport text, parent_name text, parent_email text, is_active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (p_school_id = ANY(public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Acceso denegado a esta escuela' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT sa.id, sa.full_name, sa.avatar_url, sa.school_id,
    sa.athlete_type, sa.user_id, sa.parent_id,
    sa.enrollment_id, sa.enrollment_status, sa.enrolled_team_id,
    sa.offering_plan_id, sa.sessions_used, sa.secondary_sessions_used,
    sa.expires_at, sa.team_name, sa.team_sport,
    sa.parent_name, sa.parent_email, sa.is_active
  FROM public.school_athletes sa
  WHERE sa.school_id = p_school_id
  AND (p_team_id IS NULL OR sa.enrolled_team_id = p_team_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_school_athletes(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_school_athletes(uuid, uuid) TO authenticated;
