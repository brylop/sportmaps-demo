-- =============================================================================
-- FIX 5.0 (FINAL): Break Infinite Recursion with SECURITY DEFINER Functions
-- =============================================================================

-- Problem: 
-- 'school_members' policies query 'school_members'.
-- 'schools' policies query 'school_members'.
-- This creates a loop: users -> schools -> school_members -> schools... -> Stack Overflow (500).

-- Solution:
-- Use SECURITY DEFINER functions. These run as the DB owner (bypassing RLS),
-- allowing us to checks permissions cleanly without triggering recursive policy checks.

BEGIN;

-- 1. Helper: Get IDs of schools where I am Owner or Admin
CREATE OR REPLACE FUNCTION public.get_my_administered_school_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER -- Critical: Bypasses RLS to avoid recursion
SET search_path = public
AS $$
  SELECT school_id
  FROM school_members
  WHERE profile_id = auth.uid()
  AND role IN ('owner', 'admin')
  AND status = 'active';
$$;

-- 2. Helper: Check if I own a specific school (for creation flow)
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

-- 3. Drop ALL existing policies on school_members to start fresh
DROP POLICY IF EXISTS "sm_select_own_schools" ON school_members;
DROP POLICY IF EXISTS "sm_insert_owner_only" ON school_members;
DROP POLICY IF EXISTS "sm_update_owner_only" ON school_members;
DROP POLICY IF EXISTS "sm_insert_policy" ON school_members;
DROP POLICY IF EXISTS "sm_update_policy" ON school_members;
DROP POLICY IF EXISTS "sm_select_policy" ON school_members;
DROP POLICY IF EXISTS "sm_delete_policy" ON school_members;

-- 4. Create Non-Recursive Policies

-- SELECT: See my own row OR rows in schools I manage
CREATE POLICY "sm_select_policy"
ON school_members FOR SELECT
USING (
  profile_id = auth.uid() 
  OR 
  school_id IN (SELECT public.get_my_administered_school_ids())
);

-- INSERT: 
-- Case A: Joining a school I own (e.g. creating it)
-- Case B: Admin adding someone else
CREATE POLICY "sm_insert_policy"
ON school_members FOR INSERT
WITH CHECK (
  (profile_id = auth.uid() AND public.is_school_owner(school_id))
  OR
  school_id IN (SELECT public.get_my_administered_school_ids())
);

-- UPDATE: Only Admins/Owners can update members
CREATE POLICY "sm_update_policy"
ON school_members FOR UPDATE
USING (
  school_id IN (SELECT public.get_my_administered_school_ids())
);

-- DELETE: Only Admins/Owners can remove members
CREATE POLICY "sm_delete_policy"
ON school_members FOR DELETE
USING (
  school_id IN (SELECT public.get_my_administered_school_ids())
);

COMMIT;
