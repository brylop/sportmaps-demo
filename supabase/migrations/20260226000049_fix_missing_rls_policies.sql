-- Migration: Fix Missing RLS Policies for Staff and Teams
-- Date: 2026-02-26

BEGIN;

-- 1. school_staff policies
-- Ensure RLS is enabled
ALTER TABLE public.school_staff ENABLE ROW LEVEL SECURITY;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='school_staff') THEN EXECUTE 'DROP POLICY IF EXISTS "Staff: select school" ON public.school_staff;'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='school_staff') THEN EXECUTE 'CREATE POLICY "Staff: select school" ON public.school_staff 
FOR SELECT USING (school_id = ANY(public.user_school_ids()));'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='school_staff') THEN EXECUTE 'DROP POLICY IF EXISTS "Staff: manage admin" ON public.school_staff;'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='school_staff') THEN EXECUTE 'CREATE POLICY "Staff: manage admin" ON public.school_staff 
FOR ALL USING (public.is_school_admin(school_id));'; END IF; END $wrap$;


-- 2. team_coaches policies
-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.team_coaches ENABLE ROW LEVEL SECURITY;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'DROP POLICY IF EXISTS "Team Coaches: select school" ON public.team_coaches;'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'CREATE POLICY "Team Coaches: select school" ON public.team_coaches 
FOR SELECT USING (school_id = ANY(public.user_school_ids()));'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'DROP POLICY IF EXISTS "Team Coaches: manage admin" ON public.team_coaches;'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'CREATE POLICY "Team Coaches: manage admin" ON public.team_coaches 
FOR ALL USING (public.is_school_admin(school_id));'; END IF; END $wrap$;


-- 3. team_branches policies
-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.team_branches ENABLE ROW LEVEL SECURITY;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_branches') THEN EXECUTE 'DROP POLICY IF EXISTS "Team Branches: select school" ON public.team_branches;'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_branches') THEN EXECUTE 'CREATE POLICY "Team Branches: select school" ON public.team_branches 
FOR SELECT USING (school_id = ANY(public.user_school_ids()));'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_branches') THEN EXECUTE 'DROP POLICY IF EXISTS "Team Branches: manage admin" ON public.team_branches;'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_branches') THEN EXECUTE 'CREATE POLICY "Team Branches: manage admin" ON public.team_branches 
FOR ALL USING (public.is_school_admin(school_id));'; END IF; END $wrap$;


-- 4. teams policies
-- Ensure RLS is enabled
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams: select viewable" ON public.teams;
CREATE POLICY "Teams: select viewable" ON public.teams 
FOR SELECT USING (
  school_id = ANY(public.user_school_ids()) OR
  coach_id = auth.uid() OR
  id IN (SELECT team_id FROM public.team_coaches WHERE coach_id = auth.uid())
);

DROP POLICY IF EXISTS "Teams: manage admin" ON public.teams;
CREATE POLICY "Teams: manage admin" ON public.teams 
FOR ALL USING (public.is_school_admin(school_id));

COMMIT;
