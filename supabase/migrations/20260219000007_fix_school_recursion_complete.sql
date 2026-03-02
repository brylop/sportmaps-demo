-- =============================================================================
-- FIX 6.0: COMPLETE RESET of School & Member Policies
-- =============================================================================
-- This script dynamically drops ALL policies on 'schools' and 'school_members'
-- to eliminate any hidden/legacy policies causing recursion.

BEGIN;

-- 1. Helper: Break Recursion with Security Definer
CREATE OR REPLACE FUNCTION public.get_my_administered_school_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- 2. DYNAMICALLY DROP ALL POLICIES on 'school_members'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'school_members' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.school_members';
    END LOOP;
END $$;

-- 3. DYNAMICALLY DROP ALL POLICIES on 'schools' (To be safe)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'schools' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.schools';
    END LOOP;
END $$;

-- 4. Re-Create Policies for 'school_members' (Non-Recursive)

CREATE POLICY "sm_select_policy" ON school_members FOR SELECT
USING (
  profile_id = auth.uid() OR school_id IN (SELECT public.get_my_administered_school_ids())
);

CREATE POLICY "sm_insert_policy" ON school_members FOR INSERT
WITH CHECK (
  (profile_id = auth.uid() AND public.is_school_owner(school_id)) OR
  school_id IN (SELECT public.get_my_administered_school_ids())
);

CREATE POLICY "sm_update_policy" ON school_members FOR UPDATE
USING (school_id IN (SELECT public.get_my_administered_school_ids()));

CREATE POLICY "sm_delete_policy" ON school_members FOR DELETE
USING (school_id IN (SELECT public.get_my_administered_school_ids()));

-- 5. Re-Create Policies for 'schools' (Standard)

-- Everyone can view schools (for public profiles or selection)
CREATE POLICY "schools_select_policy" ON schools FOR SELECT
USING (true);

-- Only Authenticated users can create schools
CREATE POLICY "schools_insert_policy" ON schools FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Owners/Admins can update
CREATE POLICY "schools_update_policy" ON schools FOR UPDATE
USING (
  owner_id = auth.uid() OR 
  id IN (SELECT public.get_my_administered_school_ids())
);

-- Owners can delete
CREATE POLICY "schools_delete_policy" ON schools FOR DELETE
USING (owner_id = auth.uid());

COMMIT;
