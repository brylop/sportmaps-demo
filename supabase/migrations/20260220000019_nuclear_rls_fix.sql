-- =============================================================================
-- ULTIMATE RLS RESET & RECURSION FIX
-- =============================================================================

BEGIN;

-- 1. Disable FORCE RLS on everything to ensure SECURITY DEFINER bypass works
ALTER TABLE IF EXISTS public.school_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schools NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invitations NO FORCE ROW LEVEL SECURITY;

-- 2. Drop EVERY policy on these tables to start from a clean slate
DO $$
DECLARE
    t text;
    p text;
BEGIN
    FOR t, p IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('school_members', 'schools', 'profiles', 'invitations')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;
END $$;

-- 3. DROP old functions to avoid naming conflicts
DROP FUNCTION IF EXISTS public.check_is_school_admin_safe(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_administered_school_ids() CASCADE;
DROP FUNCTION IF EXISTS public.is_school_owner(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.fn_is_admin_of_school(uuid) CASCADE;

-- 4. CREATE CLEAN HELPERS (SECURITY DEFINER)
-- Bypasses RLS because FORCE RLS is OFF and it runs as owner.
DROP FUNCTION IF EXISTS public.fn_is_admin_of_school(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.fn_is_admin_of_school(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM school_members
    WHERE school_id = p_school_id
    AND profile_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
END;
$$;

-- 5. RE-CREATE MINIMAL POLICIES

-- profiles
CREATE POLICY "profiles_select_v4" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_v4" ON profiles FOR UPDATE USING (id = auth.uid());

-- schools
CREATE POLICY "schools_select_v4" ON schools FOR SELECT USING (true);
CREATE POLICY "schools_all_v4" ON schools FOR ALL USING (owner_id = auth.uid());

-- school_members
CREATE POLICY "sm_select_v4" ON school_members FOR SELECT USING (
    profile_id = auth.uid() OR 
    (EXISTS (SELECT 1 FROM schools s WHERE s.id = school_members.school_id AND s.owner_id = auth.uid())) OR
    public.fn_is_admin_of_school(school_id)
);

CREATE POLICY "sm_write_v4" ON school_members FOR ALL USING (
    (EXISTS (SELECT 1 FROM schools s WHERE s.id = school_members.school_id AND s.owner_id = auth.uid())) OR
    public.fn_is_admin_of_school(school_id)
);

-- invitations
CREATE POLICY "inv_select_v4" ON invitations FOR SELECT USING (
    LOWER(email) = (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid()) OR
    public.fn_is_admin_of_school(school_id) OR
    (EXISTS (SELECT 1 FROM schools s WHERE s.id = invitations.school_id AND s.owner_id = auth.uid()))
);

CREATE POLICY "inv_write_v4" ON invitations FOR ALL USING (
    public.fn_is_admin_of_school(school_id) OR
    (EXISTS (SELECT 1 FROM schools s WHERE s.id = invitations.school_id AND s.owner_id = auth.uid()))
);

COMMIT;
