-- =============================================================================
-- FIX: FINAL RECURSION BREAK for school_members
-- =============================================================================

BEGIN;

-- 1. Ensure FORCE RLS is off to allow SECURITY DEFINER bypass
ALTER TABLE public.school_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.schools NO FORCE ROW LEVEL SECURITY;

-- 2. Clean up ALL previous policies to avoid conflicts
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'school_members' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.school_members';
    END LOOP;
END $$;

-- 3. CREATE SAFE HELPER (SECURITY DEFINER)
-- Drop first to avoid parameter name conflicts (ERROR 42P13)
DROP FUNCTION IF EXISTS public.check_is_school_admin_safe(uuid);

CREATE OR REPLACE FUNCTION public.check_is_school_admin_safe(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM school_members
    WHERE school_id = p_school_id
    AND profile_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
END;
$$;

-- 4. RE-CREATE POLICIES (Non-Recursive)

-- SELECT: Can see own membership OR if is owner of the school OR if is admin (via safe function)
CREATE POLICY "sm_select_policy_v3" ON public.school_members FOR SELECT
USING (
  profile_id = auth.uid() 
  OR 
  (EXISTS (SELECT 1 FROM public.schools s WHERE s.id = school_members.school_id AND s.owner_id = auth.uid()))
  OR
  public.check_is_school_admin_safe(school_id)
);

-- INSERT: Only school owners or existing admins can add members
CREATE POLICY "sm_insert_policy_v3" ON public.school_members FOR INSERT
WITH CHECK (
  (EXISTS (SELECT 1 FROM public.schools s WHERE s.id = school_members.school_id AND s.owner_id = auth.uid()))
  OR
  public.check_is_school_admin_safe(school_id)
);

-- UPDATE/DELETE: Only school owners or existing admins
CREATE POLICY "sm_update_policy_v3" ON public.school_members FOR UPDATE
USING (
  (EXISTS (SELECT 1 FROM public.schools s WHERE s.id = school_members.school_id AND s.owner_id = auth.uid()))
  OR
  public.check_is_school_admin_safe(school_id)
);

CREATE POLICY "sm_delete_policy_v3" ON public.school_members FOR DELETE
USING (
  (EXISTS (SELECT 1 FROM public.schools s WHERE s.id = school_members.school_id AND s.owner_id = auth.uid()))
  OR
  public.check_is_school_admin_safe(school_id)
);

COMMIT;
