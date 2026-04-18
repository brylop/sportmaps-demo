-- =========================================================================
-- FASE 2: RPCs para flujo de auto-registro de padres via link publico por equipo
-- Correr en Supabase SQL Editor. Cada bloque por separado si falla junto.
-- =========================================================================


-- =========================================================================
-- RPC 1: get_team_join_info (PUBLICA)
-- Devuelve info del equipo/escuela/sede para mostrar en la pagina
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_team_join_info(p_team_id uuid)
RETURNS TABLE (
    team_id     uuid,
    team_name   text,
    school_id   uuid,
    school_name text,
    branch_id   uuid,
    branch_name text,
    athletes_count integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
    SELECT
        t.id                      AS team_id,
        t.name                    AS team_name,
        s.id                      AS school_id,
        s.name                    AS school_name,
        b.id                      AS branch_id,
        b.name                    AS branch_name,
        (SELECT COUNT(*)::integer FROM public.children c WHERE c.team_id = t.id) AS athletes_count
    FROM public.teams t
    JOIN public.schools s ON s.id = t.school_id
    LEFT JOIN public.school_branches b ON b.id = t.branch_id
    WHERE t.id = p_team_id;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_team_join_info(uuid) TO anon, authenticated;


-- =========================================================================
-- RPC 2: validate_child_for_team_join (PUBLICA)
-- Valida que el doc del hijo exista en el equipo. Retorna child_id si matchea.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.validate_child_for_team_join(
    p_team_id    uuid,
    p_doc_number text
)
RETURNS TABLE (
    child_id       uuid,
    full_name      text,
    already_linked boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
    SELECT
        c.id        AS child_id,
        c.full_name AS full_name,
        c.parent_id IS NOT NULL AS already_linked
    FROM public.children c
    WHERE c.team_id = p_team_id
      AND regexp_replace(COALESCE(c.doc_number, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g')
      AND p_doc_number IS NOT NULL
      AND p_doc_number <> ''
    LIMIT 1;
$fn$;

GRANT EXECUTE ON FUNCTION public.validate_child_for_team_join(uuid, text) TO anon, authenticated;


-- =========================================================================
-- RPC 3: claim_child_for_parent (AUTENTICADA)
-- El padre (ya registrado via supabase.auth.signUp) reclama al hijo.
-- Vincula children.parent_id, inserta school_members, crea enrollment.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.claim_child_for_parent(
    p_child_id  uuid,
    p_full_name text DEFAULT NULL,
    p_phone     text DEFAULT NULL
)
RETURNS TABLE (
    child_id   uuid,
    school_id  uuid,
    branch_id  uuid,
    team_id    uuid,
    school_name text,
    team_name  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_user_id uuid := auth.uid();
    v_child   record;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No hay usuario autenticado';
    END IF;

    -- Traer datos del child
    SELECT c.id, c.school_id, c.branch_id, c.team_id, c.parent_id,
           s.name AS school_name, t.name AS team_name
      INTO v_child
      FROM public.children c
      JOIN public.schools s ON s.id = c.school_id
 LEFT JOIN public.teams   t ON t.id = c.team_id
     WHERE c.id = p_child_id;

    IF v_child.id IS NULL THEN
        RAISE EXCEPTION 'Atleta no encontrado';
    END IF;

    -- Si ya esta vinculado a otro padre, rechazar
    IF v_child.parent_id IS NOT NULL AND v_child.parent_id <> v_user_id THEN
        RAISE EXCEPTION 'Este atleta ya esta vinculado a otro acudiente. Contacta a la escuela.';
    END IF;

    -- Vincular child a este padre
    UPDATE public.children
       SET parent_id = v_user_id,
           updated_at = now()
     WHERE id = p_child_id;

    -- Actualizar profile del padre
    UPDATE public.profiles
       SET full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
           phone     = COALESCE(NULLIF(p_phone, ''), phone),
           role      = COALESCE(role, 'parent'),
           updated_at = now()
     WHERE id = v_user_id;

    -- Agregar como school_member (rol parent)
    INSERT INTO public.school_members (school_id, profile_id, branch_id, role, status)
    VALUES (v_child.school_id, v_user_id, v_child.branch_id, 'parent', 'active')
    ON CONFLICT (school_id, profile_id)
    DO UPDATE SET
        branch_id = COALESCE(EXCLUDED.branch_id, public.school_members.branch_id),
        status    = 'active';

    -- Asegurar enrollment activo si hay team
    IF v_child.team_id IS NOT NULL THEN
        INSERT INTO public.enrollments (school_id, child_id, team_id, status, start_date)
        SELECT v_child.school_id, v_child.id, v_child.team_id, 'active', CURRENT_DATE
         WHERE NOT EXISTS (
            SELECT 1 FROM public.enrollments e
             WHERE e.child_id = v_child.id
               AND e.team_id  = v_child.team_id
               AND e.status   = 'active'
         );
    END IF;

    RETURN QUERY
    SELECT v_child.id, v_child.school_id, v_child.branch_id, v_child.team_id,
           v_child.school_name, v_child.team_name;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.claim_child_for_parent(uuid, text, text) TO authenticated;


-- =========================================================================
-- VERIFICACION — probar con un team real
-- =========================================================================
-- Reemplaza con un team_id real (ej. SPRINKLES)
-- SELECT * FROM public.get_team_join_info('11111111-1111-1111-1111-000000000001');
-- SELECT * FROM public.validate_child_for_team_join('11111111-1111-1111-1111-000000000001', '1019919060');
