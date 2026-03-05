-- Fix: auto_add_parent_to_school() trigger was running as the invoking user
-- (SECURITY INVOKER), but when a parent updates their child, they don't have
-- RLS permission to INSERT into school_members. Making it SECURITY DEFINER
-- so the trigger can manage membership as a system operation.
CREATE OR REPLACE FUNCTION public.auto_add_parent_to_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.school_id IS NOT NULL AND NEW.parent_id IS NOT NULL THEN
    INSERT INTO public.school_members (profile_id, school_id, role, status)
    VALUES (NEW.parent_id, NEW.school_id, 'parent', 'active')
    ON CONFLICT (profile_id, school_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
