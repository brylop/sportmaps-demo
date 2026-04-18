-- =========================================================================
-- RPC 3 de 3 — claim_child_for_parent (AUTENTICADA, PL/pgSQL)
-- El padre (registrado via supabase.auth.signUp) reclama al hijo usando el child_id.
-- Vincula children.parent_id, inserta school_members (rol parent), asegura enrollment.
--
-- IMPORTANTE: Pega este archivo COMPLETO en el SQL Editor. No lo partas.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.claim_child_for_parent(
    p_child_id  uuid,
    p_full_name text DEFAULT NULL,
    p_phone     text DEFAULT NULL
)
RETURNS TABLE (
    child_id    uuid,
    school_id   uuid,
    branch_id   uuid,
    team_id     uuid,
    school_name text,
    team_name   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $claim$
DECLARE
    v_user_id      uuid := auth.uid();
    v_child_id     uuid;
    v_school_id    uuid;
    v_branch_id    uuid;
    v_team_id      uuid;
    v_parent_id    uuid;
    v_school_name  text;
    v_team_name    text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No hay usuario autenticado';
    END IF;

    SELECT c.id, c.school_id, c.branch_id, c.team_id, c.parent_id, s.name, t.name
      INTO v_child_id, v_school_id, v_branch_id, v_team_id, v_parent_id, v_school_name, v_team_name
      FROM public.children c
      JOIN public.schools s ON s.id = c.school_id
 LEFT JOIN public.teams   t ON t.id = c.team_id
     WHERE c.id = p_child_id;

    IF v_child_id IS NULL THEN
        RAISE EXCEPTION 'Atleta no encontrado';
    END IF;

    IF v_parent_id IS NOT NULL AND v_parent_id <> v_user_id THEN
        RAISE EXCEPTION 'Este atleta ya esta vinculado a otro acudiente';
    END IF;

    UPDATE public.children
       SET parent_id = v_user_id, updated_at = now()
     WHERE id = p_child_id;

    UPDATE public.profiles
       SET full_name  = COALESCE(NULLIF(p_full_name, ''), full_name),
           phone      = COALESCE(NULLIF(p_phone, ''), phone),
           role       = COALESCE(role, 'parent'),
           updated_at = now()
     WHERE id = v_user_id;

    INSERT INTO public.school_members (school_id, profile_id, branch_id, role, status)
    VALUES (v_school_id, v_user_id, v_branch_id, 'parent', 'active')
    ON CONFLICT (school_id, profile_id)
    DO UPDATE SET
        branch_id = COALESCE(EXCLUDED.branch_id, public.school_members.branch_id),
        status    = 'active';

    IF v_team_id IS NOT NULL THEN
        INSERT INTO public.enrollments (school_id, child_id, team_id, status, start_date)
        SELECT v_school_id, v_child_id, v_team_id, 'active', CURRENT_DATE
         WHERE NOT EXISTS (
            SELECT 1 FROM public.enrollments e
             WHERE e.child_id = v_child_id
               AND e.team_id  = v_team_id
               AND e.status   = 'active'
         );
    END IF;

    RETURN QUERY SELECT v_child_id, v_school_id, v_branch_id, v_team_id, v_school_name, v_team_name;
END;
$claim$;

GRANT EXECUTE ON FUNCTION public.claim_child_for_parent(uuid, text, text) TO authenticated;
