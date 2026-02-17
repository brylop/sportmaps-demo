-- NUCLEAR FIX: Clean Slate for RLS Policies on 'profiles' and 'school_members'
-- This script dynamically drops ALL existing RLS policies on these tables
-- and re-creates only the minimal, recursion-safe policies.

-- 1. Helper function to check admin status safely (SECURITY DEFINER breaks recursion)
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
  );
END;
$$;

-- 2. Drop existing policies dynamically
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    -- Delete all policies on 'profiles'
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles'; 
    END LOOP;
    
    -- Delete all policies on 'school_members'
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'school_members' AND schemaname = 'public') LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.school_members'; 
    END LOOP;
END $$;

-- 3. Reset RLS (Toggle to ensure clean state)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_members DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;

-- 4. Re-create Minimal SAFE Policies (Profiles)

-- Allow any authenticated user to view profiles (needed for UI relationships)
CREATE POLICY "Public Read Profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Allow users to update only their own profile
CREATE POLICY "Users Update Own Profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users Insert Own Profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);


-- 5. Re-create Minimal SAFE Policies (School Members)

-- Users can always see their own membership
CREATE POLICY "View Own Membership"
ON public.school_members FOR SELECT
USING (auth.uid() = profile_id);

-- Admins can see all members in their school (Using SAFE function)
CREATE POLICY "Admins View All Members"
ON public.school_members FOR SELECT
USING (check_is_school_admin_safe(school_id));
