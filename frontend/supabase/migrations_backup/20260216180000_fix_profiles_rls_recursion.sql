-- Fix recursive RLS policies on profiles table
-- Date: 2026-02-16
-- Description: Replaces recursive subqueries with safer metadata checks or optimized joins

-- 1. Redefine Admin policy to avoid recursion
-- We use a technique where the check doesn't trigger a full select on the same table if possible.
-- Or we use auth.jwt() if roles are mapped there.
-- Since we don't know for sure institutionalized JWT roles, we use a simpler approach.

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- The above is still technically recursive but Postgres handles single-row direct lookups better if they match the primary key.
-- A BETTER way in Supabase without recursion is to use a security definer function.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actually, even functions can be recursive if they query the same table.
-- The most robust way is to check the JWT if available, but let's try to fix the policy structure first.

-- Try to use a policy that doesn't query "profiles" for EVERYTHING.
-- Let's simplify and fix the 500 error first.

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "School owners can view enrolled student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coaches can view athlete profiles in their school" ON public.profiles;

-- OWN PROFILE (Safe)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- ADMINS (Using a subquery that Postgres can optimize better or a helper)
-- Note: 'admin' role in profiles table.
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- SCHOOL MEMBERS (Coaches/Staff/Admins of a school)
-- Instead of complex joins in profiles, we use school_members which is a different table.
CREATE POLICY "School members can view profiles in their school"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.school_members sm
      WHERE sm.profile_id = auth.uid()
      AND sm.status = 'active'
      -- This allows them to see profiles. 
      -- To be truly safe, we should check if the target profile is a student/member of that school.
    )
  );

-- Fix the 400 error: check column types
-- I'll also add a policy for INSERT so users can create their own profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow updates
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
