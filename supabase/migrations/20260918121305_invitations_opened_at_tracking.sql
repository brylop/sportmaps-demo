-- =============================================================================
-- 20260918121305_invitations_opened_at_tracking.sql
-- Autor: brylop   Fecha: 2026-09-18   Versión anterior: 20260917162556
-- Objetivo: trackear cuándo se abre por primera vez el link de una invitación
--   (columna invitations.opened_at) para poder distinguir "nunca abrió" de
--   "abrió pero no completó el registro". get_invitation_details() la estampa
--   una sola vez (COALESCE) en cada llamada, que es lo que dispara la página
--   de registro al cargar los datos de la invitación.
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

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_invitation_details(p_invite_id uuid)
 RETURNS TABLE(school_name text, role_to_assign text, child_name text, status text, program_name text, monthly_fee numeric, branch_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    UPDATE public.invitations
    SET opened_at = now()
    WHERE id = p_invite_id
      AND opened_at IS NULL;

    RETURN QUERY
    SELECT
        s.name,
        i.role_to_assign,
        i.child_name,
        i.status,
        t.name,
        COALESCE(i.monthly_fee, t.price_monthly, 0),
        b.name
    FROM public.invitations i
    JOIN public.schools s ON i.school_id = s.id
    LEFT JOIN public.teams t ON t.id = i.team_id
    LEFT JOIN public.school_branches b ON b.id = i.branch_id
    WHERE i.id = p_invite_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_invitation_details(uuid) TO anon, authenticated;

COMMIT;
