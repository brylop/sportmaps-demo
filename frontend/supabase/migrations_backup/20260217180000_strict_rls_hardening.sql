-- Migration to enforce STRICT RLS policies for multi-tenant isolation
-- Fixes critical bug: is_branch_admin usage and cross-school data leakage

-- Helper function to check if user is a member of the school (ANY active role)
CREATE OR REPLACE FUNCTION public.check_is_school_member(check_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = check_school_id
    AND profile_id = auth.uid()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is a ADMIN of the school
CREATE OR REPLACE FUNCTION public.check_is_school_admin(check_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = check_school_id
    AND profile_id = auth.uid()
    AND role IN ('admin', 'owner', 'school_admin', 'super_admin')
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is ADMIN of a specific branch (or entire school)
CREATE OR REPLACE FUNCTION public.check_is_branch_admin(check_branch_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF check_branch_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.school_members
    WHERE profile_id = auth.uid()
    AND (
      -- Admin of specific branch
      branch_id = check_branch_id
      OR
      -- OR Admin of the whole school (branch_id is null for global admins)
      branch_id IS NULL
    )
    AND role IN ('admin', 'owner', 'school_admin', 'super_admin')
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- A. Apply to CHILDREN table
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School admins can CRUD students" ON public.children;
CREATE POLICY "School admins can CRUD students"
  ON public.children
  FOR ALL
  USING (check_is_school_admin(school_id))
  WITH CHECK (check_is_school_admin(school_id));

DROP POLICY IF EXISTS "Parents can view their own children" ON public.children;
CREATE POLICY "Parents can view their own children"
  ON public.children
  FOR SELECT
  USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "Coaches can view students in their school" ON public.children;
CREATE POLICY "Coaches can view students in their school"
  ON public.children
  FOR SELECT
  USING (check_is_school_member(school_id));


-- B. Apply to PAYMENTS table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments"
  ON public.payments
  FOR ALL
  USING (check_is_school_admin(school_id));

DROP POLICY IF EXISTS "Parents view own payments" ON public.payments;
CREATE POLICY "Parents view own payments"
  ON public.payments
  FOR SELECT
  USING (
    parent_id = auth.uid()
  );


-- C. Apply to ENROLLMENTS table
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage enrollments" ON public.enrollments;
CREATE POLICY "Admins manage enrollments"
  ON public.enrollments
  FOR ALL
  USING (check_is_school_admin(school_id));

DROP POLICY IF EXISTS "Parents view own enrollments" ON public.enrollments;
CREATE POLICY "Parents view own enrollments"
  ON public.enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = enrollments.child_id
      AND c.parent_id = auth.uid()
    )
  );

-- D. Apply to SCHOOL_MEMBERS table (Prevent leakage between schools)
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view members of their school" ON public.school_members;
CREATE POLICY "Admins view members of their school"
  ON public.school_members
  FOR SELECT
  USING (check_is_school_member(school_id));

DROP POLICY IF EXISTS "Admins manage members" ON public.school_members;
CREATE POLICY "Admins manage members"
  ON public.school_members
  FOR ALL
  USING (check_is_school_admin(school_id));

DROP POLICY IF EXISTS "Users can view own membership" ON public.school_members;
CREATE POLICY "Users can view own membership"
  ON public.school_members
  FOR SELECT
  USING (profile_id = auth.uid());
