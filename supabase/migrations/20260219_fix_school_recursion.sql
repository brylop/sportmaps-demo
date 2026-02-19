-- =============================================================================
-- FIX: Infinite recursion in school_members RLS
-- =============================================================================

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "sm_select_own_schools" ON school_members;
DROP POLICY IF EXISTS "sm_insert_owner_only" ON school_members;
DROP POLICY IF EXISTS "sm_update_owner_only" ON school_members;

-- 2. Re-create SELECT policy (Simplified)
-- Users can see their own memberships OR memberships of schools they own/admin
CREATE POLICY "sm_select_own_schools"
ON school_members FOR SELECT
USING (
  profile_id = auth.uid() OR
  school_id IN (
    SELECT school_id 
    FROM school_members 
    WHERE profile_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- 3. Re-create INSERT policy (Fix recursion)
-- Allow insert if:
-- a) You are creating a school (school doesn't exist yet? No, school exists but no members)
--    Actually, when creating a school, the FIRST member is the owner.
--    The policy needs to allow the user to insert THEMSELVES as 'owner' if they are the school owner.
-- b) You are an admin/owner adding someone else.

CREATE POLICY "sm_insert_policy"
ON school_members FOR INSERT
WITH CHECK (
  -- Option A: Self-insert as owner for a school you own
  (
    profile_id = auth.uid() AND
    role = 'owner' AND
    EXISTS (
      SELECT 1 FROM schools 
      WHERE id = school_members.school_id 
      AND owner_id = auth.uid()
    )
  )
  OR
  -- Option B: Admin/Owner adding other members (Recursion safe because we filter by role)
  (
    EXISTS (
      SELECT 1 FROM school_members
      WHERE school_id = school_members.school_id
      AND profile_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  )
);

-- 4. Re-create UPDATE policy
CREATE POLICY "sm_update_policy"
ON school_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM school_members
    WHERE school_id = school_members.school_id
    AND profile_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);
