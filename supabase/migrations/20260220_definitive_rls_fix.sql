-- Migration: Definitive RLS Fix
-- Description: Clears all stale policies and establishes a clean permission model for schools.

BEGIN;

-- 1. CLEANUP: Drop ALL potentially conflicting policies
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop policies for programs
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'programs' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.programs';
    END LOOP;
    
    -- Drop policies for invitations
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'invitations' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.invitations';
    END LOOP;

    -- Drop policies for branches
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'branches' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.branches';
    END LOOP;
END $$;

-- 2. HELPER FUNCTIONS (Solidified)
-- We drop first because Postgres doesn't allow changing parameter names with CREATE OR REPLACE
DROP FUNCTION IF EXISTS public.fn_is_admin_of_school(uuid);

CREATE OR REPLACE FUNCTION public.fn_is_admin_of_school(lookup_school_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members 
    WHERE school_id = lookup_school_id 
    AND profile_id = auth.uid() 
    AND role IN ('owner', 'admin', 'school_admin')
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. PROGRAMS POLICIES
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programs_select" ON public.programs FOR SELECT 
USING (true); -- Publicly viewable or filtered by app logic

CREATE POLICY "programs_manage" ON public.programs FOR ALL
USING (public.fn_is_admin_of_school(school_id))
WITH CHECK (public.fn_is_admin_of_school(school_id));

-- 4. INVITATIONS POLICIES
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select" ON public.invitations FOR SELECT
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) -- Invitees can see their own
    OR public.fn_is_admin_of_school(school_id)                  -- Admins can see their school's
);

CREATE POLICY "invitations_manage" ON public.invitations FOR ALL
USING (public.fn_is_admin_of_school(school_id))
WITH CHECK (public.fn_is_admin_of_school(school_id));

-- 5. BRANCHES POLICIES
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select" ON public.branches FOR SELECT 
USING (true);

CREATE POLICY "branches_manage" ON public.branches FOR ALL
USING (public.fn_is_admin_of_school(school_id))
WITH CHECK (public.fn_is_admin_of_school(school_id));

COMMIT;
