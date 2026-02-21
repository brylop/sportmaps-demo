-- Migration: Fix Invitations RLS & Branch Visibility
-- Description: Uses auth.jwt() for email checks and ensures branch policy is robust.

BEGIN;

-- 1. Fix Invitations Policy (using JWT email instead of restricted subquery)
DROP POLICY IF EXISTS "invitations_select" ON public.invitations;
CREATE POLICY "invitations_select" ON public.invitations FOR SELECT
USING (
    email = (auth.jwt() ->> 'email')::text -- Invitees can see their own
    OR public.fn_is_admin_of_school(school_id) -- Admins can see their school's
);

-- 2. Ensure Branches Policy is also clean
DROP POLICY IF EXISTS "branches_select" ON public.branches;
CREATE POLICY "branches_select" ON public.branches FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "branches_manage" ON public.branches;
CREATE POLICY "branches_manage" ON public.branches FOR ALL
USING (public.fn_is_admin_of_school(school_id))
WITH CHECK (public.fn_is_admin_of_school(school_id));

-- 3. Update get_onboarding_status to be even more precise for branches
-- If there is ONLY 1 branch and it's name is 'Sede Principal' and it's the ONLY thing, 
-- maybe we want to keep it as "incomplete" if we want to force the user to look at it?
-- Actually, let's keep it simple: has_branches = true if count > 0.
-- But we can improve the check for programs to prioritize active ones.

COMMIT;
