-- =========================================================================
-- FIX: Invitaciones guardan school_id incorrecto (la "primera" del usuario)
-- aunque se seleccione un team de otra escuela.
--
-- Ejecutar en 2 pasos — pegar cada bloque por separado en Supabase SQL Editor
-- si da error al correr todo junto.
-- =========================================================================


-- =========================================================================
-- PASO 1: Corregir invitaciones existentes con school_id incorrecto
-- (Correr este bloque solo primero)
-- =========================================================================
UPDATE public.invitations i
   SET school_id = t.school_id
  FROM public.teams t
 WHERE i.team_id = t.id
   AND i.team_id IS NOT NULL
   AND i.school_id <> t.school_id;


-- =========================================================================
-- PASO 2: Crear funcion + trigger que previene el bug en el futuro
-- (Correr este bloque despues — usa dollar-quote con nombre unico)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fix_invitation_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    NEW.school_id := (SELECT school_id FROM public.teams WHERE id = NEW.team_id);
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_fix_invitation_school_id ON public.invitations;

CREATE TRIGGER trg_fix_invitation_school_id
BEFORE INSERT OR UPDATE OF team_id ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.fix_invitation_school_id();


-- =========================================================================
-- PASO 3: Verificacion
-- =========================================================================
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
