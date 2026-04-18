-- =========================================================================
-- RPC 3 de 3 — claim_child_for_parent (PURE SQL con CTEs)
-- Version sin PL/pgSQL para evitar el bug del SQL Editor de Supabase que
-- parsea mal el body plpgsql con muchos semicolons.
--
-- Logica:
--   1. Lookup del child
--   2. Update children.parent_id solo si no tiene o es el mismo auth.uid()
--   3. Update profile del padre
--   4. Upsert school_members (rol parent)
--   5. Asegurar enrollment activo si hay team
--   6. Devolver status_code: 'ok' | 'already_linked' | 'not_found' | 'no_auth'
-- =========================================================================

CREATE OR REPLACE FUNCTION public.claim_child_for_parent(
    p_child_id  uuid,
    p_full_name text DEFAULT NULL,
    p_phone     text DEFAULT NULL
)
RETURNS TABLE (
    status_code text,
    child_id    uuid,
    school_id   uuid,
    branch_id   uuid,
    team_id     uuid,
    school_name text,
    team_name   text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $claim$
    WITH child_info AS (
        SELECT c.id, c.school_id, c.branch_id, c.team_id, c.parent_id,
               s.name AS school_name, t.name AS team_name
        FROM public.children c
        JOIN public.schools s ON s.id = c.school_id
        LEFT JOIN public.teams t ON t.id = c.team_id
        WHERE c.id = p_child_id
    ),
    updated_child AS (
        UPDATE public.children
        SET parent_id = auth.uid(), updated_at = now()
        WHERE id = p_child_id
          AND auth.uid() IS NOT NULL
          AND (parent_id IS NULL OR parent_id = auth.uid())
        RETURNING id
    ),
    updated_profile AS (
        UPDATE public.profiles
        SET full_name  = COALESCE(NULLIF(p_full_name, ''), full_name),
            phone      = COALESCE(NULLIF(p_phone, ''), phone),
            role       = COALESCE(role, 'parent'),
            updated_at = now()
        WHERE id = auth.uid()
          AND EXISTS (SELECT 1 FROM updated_child)
        RETURNING id
    ),
    inserted_member AS (
        INSERT INTO public.school_members (school_id, profile_id, branch_id, role, status)
        SELECT ci.school_id, auth.uid(), ci.branch_id, 'parent', 'active'
        FROM child_info ci
        WHERE EXISTS (SELECT 1 FROM updated_child)
        ON CONFLICT (school_id, profile_id)
        DO UPDATE SET
            branch_id = COALESCE(EXCLUDED.branch_id, public.school_members.branch_id),
            status    = 'active'
        RETURNING school_id
    ),
    inserted_enrollment AS (
        INSERT INTO public.enrollments (school_id, child_id, team_id, status, start_date)
        SELECT ci.school_id, ci.id, ci.team_id, 'active', CURRENT_DATE
        FROM child_info ci
        WHERE ci.team_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM updated_child)
          AND NOT EXISTS (
              SELECT 1 FROM public.enrollments e
              WHERE e.child_id = ci.id AND e.team_id = ci.team_id AND e.status = 'active'
          )
        RETURNING id
    )
    SELECT
        CASE
            WHEN auth.uid() IS NULL               THEN 'no_auth'
            WHEN ci.id IS NULL                    THEN 'not_found'
            WHEN EXISTS (SELECT 1 FROM updated_child) THEN 'ok'
            ELSE 'already_linked'
        END                   AS status_code,
        ci.id                 AS child_id,
        ci.school_id,
        ci.branch_id,
        ci.team_id,
        ci.school_name,
        ci.team_name
    FROM (SELECT * FROM child_info
          UNION ALL
          SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::text, NULL::text
          WHERE NOT EXISTS (SELECT 1 FROM child_info)) ci
    LIMIT 1;
$claim$;

GRANT EXECUTE ON FUNCTION public.claim_child_for_parent(uuid, text, text) TO authenticated;
