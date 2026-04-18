-- =========================================================================
-- FIX: Invitaciones guardan school_id incorrecto (la "primera" del usuario)
-- aunque se seleccione un team de otra escuela.
--
-- Causa: la RPC create_invitation() toma school_id de
--   SELECT school_id FROM school_members WHERE profile_id = auth.uid() LIMIT 1
-- lo que retorna la escuela mas antigua (MMA BLAIR TEAM) ignorando el team_id.
--
-- Solucion: trigger BEFORE INSERT que corrige school_id usando team_id.
-- =========================================================================

-- ========================================
-- 1. Corregir invitaciones existentes con school_id incorrecto
-- ========================================
UPDATE public.invitations i
   SET school_id = t.school_id
  FROM public.teams t
 WHERE i.team_id = t.id
   AND i.team_id IS NOT NULL
   AND i.school_id <> t.school_id;

-- ========================================
-- 2. Trigger que previene el bug en el futuro
-- ========================================
CREATE OR REPLACE FUNCTION public.fix_invitation_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si viene team_id, forzar school_id al de ese team (sobreescribir default)
  IF NEW.team_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id
    FROM public.teams
    WHERE id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fix_invitation_school_id ON public.invitations;
CREATE TRIGGER trg_fix_invitation_school_id
BEFORE INSERT OR UPDATE OF team_id ON public.invitations
FOR EACH ROW
WHEN (NEW.team_id IS NOT NULL)
EXECUTE FUNCTION public.fix_invitation_school_id();

-- ========================================
-- 3. VERIFICACION
-- ========================================
-- Ver invitaciones por escuela (deberian estar alineadas con sus team_id)
SELECT
    s.name AS escuela,
    t.name AS equipo,
    i.email,
    i.child_name,
    i.status,
    i.created_at
FROM public.invitations i
LEFT JOIN public.schools s ON s.id = i.school_id
LEFT JOIN public.teams   t ON t.id = i.team_id
WHERE i.team_id IS NOT NULL
ORDER BY i.created_at DESC
LIMIT 20;
