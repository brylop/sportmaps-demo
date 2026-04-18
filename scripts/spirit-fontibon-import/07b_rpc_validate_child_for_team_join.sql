-- =========================================================================
-- RPC 2 de 3 — validate_child_for_team_join (PUBLICA, solo SQL)
-- Valida que el doc del hijo exista en el equipo. Retorna child_id + nombre.
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
AS $fn2$
    SELECT
        c.id,
        c.full_name,
        c.parent_id IS NOT NULL
    FROM public.children c
    WHERE c.team_id = p_team_id
      AND regexp_replace(COALESCE(c.doc_number, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g')
      AND p_doc_number IS NOT NULL
      AND p_doc_number <> ''
    LIMIT 1;
$fn2$;

GRANT EXECUTE ON FUNCTION public.validate_child_for_team_join(uuid, text) TO anon, authenticated;
