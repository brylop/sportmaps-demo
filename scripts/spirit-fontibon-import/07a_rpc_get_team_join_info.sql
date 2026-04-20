-- =========================================================================
-- RPC 1 de 3 — get_team_join_info (PUBLICA, solo SQL)
-- Devuelve info del equipo/escuela/sede para mostrar en la pagina publica.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_team_join_info(p_team_id uuid)
RETURNS TABLE (
    team_id        uuid,
    team_name      text,
    school_id      uuid,
    school_name    text,
    branch_id      uuid,
    branch_name    text,
    athletes_count integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn1$
    SELECT
        t.id,
        t.name,
        s.id,
        s.name,
        b.id,
        b.name,
        (SELECT COUNT(*)::integer FROM public.children c WHERE c.team_id = t.id)
    FROM public.teams t
    JOIN public.schools s ON s.id = t.school_id
    LEFT JOIN public.school_branches b ON b.id = t.branch_id
    WHERE t.id = p_team_id;
$fn1$;

GRANT EXECUTE ON FUNCTION public.get_team_join_info(uuid) TO anon, authenticated;
