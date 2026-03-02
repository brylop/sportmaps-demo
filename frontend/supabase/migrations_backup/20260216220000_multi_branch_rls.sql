-- Migration for Multi-branch RLS and Permissions (HU-0.12)
-- Description: Enforces branch-level data isolation for Branch Admins and read-only access for General Admins

-- Function to check if user is a General Admin of a school (Reports Only)
CREATE OR REPLACE FUNCTION public.is_school_general_admin(check_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = check_school_id
      AND profile_id = auth.uid()
      AND role = 'owner' -- In our context, 'owner' or a specific 'general_admin' role
      AND (branch_id IS NULL) -- General admin covers all branches
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS for public.children (Students)
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branch admins can CRUD students in their branch" ON public.children;
CREATE POLICY "Branch admins can CRUD students in their branch"
  ON public.children
  FOR ALL
  USING (
    is_branch_admin(school_id, branch_id)
  )
  WITH CHECK (
    is_branch_admin(school_id, branch_id)
  );

DROP POLICY IF EXISTS "General admins can view all students (read-only)" ON public.children;
CREATE POLICY "General admins can view all students (read-only)"
  ON public.children
  FOR SELECT
  USING (
    is_school_general_admin(school_id)
  );

-- Update RLS for public.programs (Teams/Groups)
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branch admins can CRUD programs in their branch" ON public.programs;
CREATE POLICY "Branch admins can CRUD programs in their branch"
  ON public.programs
  FOR ALL
  USING (
    is_branch_admin(school_id, branch_id)
  )
  WITH CHECK (
    is_branch_admin(school_id, branch_id)
  );

DROP POLICY IF EXISTS "General admins can view all programs (read-only)" ON public.programs;
CREATE POLICY "General admins can view all programs (read-only)"
  ON public.programs
  FOR SELECT
  USING (
    is_school_general_admin(school_id)
  );

-- Update RLS for public.school_staff (Coaches directory)
-- Rule: Staff Directory is School-level, not Branch-level.
ALTER TABLE public.school_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone in school can view staff directory" ON public.school_staff;
CREATE POLICY "Anyone in school can view staff directory"
  ON public.school_staff
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.school_members WHERE school_id = public.school_staff.school_id AND profile_id = auth.uid())
  );

-- Update RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branch admins can view payments in their branch" ON public.payments;
CREATE POLICY "Branch admins can view payments in their branch"
  ON public.payments
  FOR SELECT
  USING (
    is_branch_admin(school_id, branch_id)
  );

DROP POLICY IF EXISTS "General admins can view all payments for reports" ON public.payments;
CREATE POLICY "General admins can view all payments for reports"
  ON public.payments
  FOR SELECT
  USING (
    is_school_general_admin(school_id)
  );

-- Note: We need a branch_id in payments too if we want strict filtering. 
-- Since payments are linked to students (children), we can derive branch_id from the student.
-- Let's ensure branch_id is added to payments if it doesn't exist.
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'branch_id') THEN
    ALTER TABLE public.payments ADD COLUMN branch_id UUID REFERENCES public.school_branches(id) ON DELETE SET NULL;
  END IF;
END $$;
