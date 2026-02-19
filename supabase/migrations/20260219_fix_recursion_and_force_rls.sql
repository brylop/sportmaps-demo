-- =============================================================================
-- FIX 7.0: DISABLE FORCE RLS & ENSURE RECURSION BREAK
-- =============================================================================

-- Problem Diagnosis:
-- Even with SECURITY DEFINER functions, if 'FORCE ROW LEVEL SECURITY' is enabled 
-- on a table, the Table Owner (and thus the Security Definer function) is STILL 
-- subject to RLS policies. This causes:
-- 1. Recursion loops in 'school_members' even when using helper functions.
-- 2. "Database error" on signup because the trigger can't bypass RLS on 'profiles'.

-- Solution:
-- Explicitly disable FORCE ROW LEVEL SECURITY (return to default behavior where Owner bypasses RLS).

BEGIN;

-- 1. Disable FORCE RLS on critical tables
-- This ensures that SECURITY DEFINER functions (run as Owner) actually bypass RLS.
ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.schools NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.school_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roles NO FORCE ROW LEVEL SECURITY;

-- 2. REDO: Helper Functions (Just to be sure they are clean)
CREATE OR REPLACE FUNCTION public.get_my_administered_school_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Because FORCE RLS is off, and this runs as Owner, this will NOT trigger recursion.
  SELECT school_id
  FROM school_members
  WHERE profile_id = auth.uid()
  AND role IN ('owner', 'admin')
  AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_school_owner(lookup_school_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM schools 
    WHERE id = lookup_school_id 
    AND owner_id = auth.uid()
  );
$$;

-- 3. REDO: Drop and Re-create Policies (Nuclear approach again)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'school_members' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.school_members';
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'schools' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.schools';
    END LOOP;
END $$;

-- 4. Re-Create Policies (Non-Recursive)

-- school_members
CREATE POLICY "sm_select_policy" ON school_members FOR SELECT
USING (
  profile_id = auth.uid() OR school_id IN (SELECT public.get_my_administered_school_ids())
);

CREATE POLICY "sm_insert_policy" ON school_members FOR INSERT
WITH CHECK (
  (profile_id = auth.uid() AND public.is_school_owner(school_id)) OR -- Owner adding themselves
  school_id IN (SELECT public.get_my_administered_school_ids())       -- Admin adding others
);

CREATE POLICY "sm_update_policy" ON school_members FOR UPDATE
USING (school_id IN (SELECT public.get_my_administered_school_ids()));

CREATE POLICY "sm_delete_policy" ON school_members FOR DELETE
USING (school_id IN (SELECT public.get_my_administered_school_ids()));

-- schools
CREATE POLICY "schools_select_policy" ON schools FOR SELECT USING (true);
CREATE POLICY "schools_insert_policy" ON schools FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "schools_update_policy" ON schools FOR UPDATE USING (owner_id = auth.uid() OR id IN (SELECT public.get_my_administered_school_ids()));
CREATE POLICY "schools_delete_policy" ON schools FOR DELETE USING (owner_id = auth.uid());

COMMIT;
