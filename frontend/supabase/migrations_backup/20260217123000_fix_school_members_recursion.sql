-- FIX: Infinite Recursion (Error 500) on school_members RLS Policies
-- This script fixes the circular dependency causing the dashboard to crash.

-- 1. Create a SECURITY DEFINER function to check admin status safely.
-- 'SECURITY DEFINER' runs the function with the privileges of the creator (postgres/superuser),
-- bypassing RLS on the tables queried inside, thus breaking the recursion loop.
CREATE OR REPLACE FUNCTION public.check_is_school_member_safe(lookup_school_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM school_members 
    WHERE school_id = lookup_school_id 
      AND profile_id = auth.uid()
      AND status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_school_admin_safe(lookup_school_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM school_members 
    WHERE school_id = lookup_school_id 
      AND profile_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
END;
$$;

-- 2. Reset Policies on school_members
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;

-- Drop all potentially conflicting selecting policies
DROP POLICY IF EXISTS "Users can view own memberships" ON public.school_members;
DROP POLICY IF EXISTS "Admins can view all memberships" ON public.school_members;
DROP POLICY IF EXISTS "School members can view other members" ON public.school_members;
DROP POLICY IF EXISTS "View own membership" ON public.school_members;
DROP POLICY IF EXISTS "Admins view school members" ON public.school_members;

-- 3. Re-create Safe Policies

-- A. Users can ALWAYS see their own membership profile (No recursion risk here)
CREATE POLICY "Users can view own memberships"
ON public.school_members
FOR SELECT
USING (
  auth.uid() = profile_id
);

-- B. Admins can see ALL members in their school
-- Use the SECURITY DEFINER function to avoid infinite loop
CREATE POLICY "Admins can view school members"
ON public.school_members
FOR SELECT
USING (
  check_is_school_admin_safe(school_id)
);

-- Optional: If regular members need to see others (e.g. coaches), use check_is_school_member_safe
-- But for Dashboard admin panel, the above is sufficient and safer.
