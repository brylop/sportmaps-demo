-- ==========================================
-- FIX COACH RLS POLICIES (Profiles & Certifications)
-- ==========================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coach_profiles') THEN
    EXECUTE 'ALTER TABLE IF EXISTS public.coach_profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Coaches can view their own profile" ON public.coach_profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Coaches can insert their own profile" ON public.coach_profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Coaches can update their own profile" ON public.coach_profiles';
    
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='coach_profiles') THEN EXECUTE 'CREATE POLICY "Coaches can view their own profile" ON public.coach_profiles FOR SELECT TO authenticated USING (auth.uid() = id)'';'; END IF; END $wrap$;
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='coach_profiles') THEN EXECUTE 'CREATE POLICY "Coaches can insert their own profile" ON public.coach_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id)'';'; END IF; END $wrap$;
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='coach_profiles') THEN EXECUTE 'CREATE POLICY "Coaches can update their own profile" ON public.coach_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)'';'; END IF; END $wrap$;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coach_certifications') THEN
    EXECUTE 'ALTER TABLE IF EXISTS public.coach_certifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Coaches can view their own certifications" ON public.coach_certifications';
    EXECUTE 'DROP POLICY IF EXISTS "Coaches can insert their own certifications" ON public.coach_certifications';
    EXECUTE 'DROP POLICY IF EXISTS "Coaches can update their own certifications" ON public.coach_certifications';
    EXECUTE 'DROP POLICY IF EXISTS "Coaches can delete their own certifications" ON public.coach_certifications';

    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='coach_certifications') THEN EXECUTE 'CREATE POLICY "Coaches can view their own certifications" ON public.coach_certifications FOR SELECT TO authenticated USING (auth.uid() = coach_id)'';'; END IF; END $wrap$;
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='coach_certifications') THEN EXECUTE 'CREATE POLICY "Coaches can insert their own certifications" ON public.coach_certifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = coach_id)'';'; END IF; END $wrap$;
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='coach_certifications') THEN EXECUTE 'CREATE POLICY "Coaches can update their own certifications" ON public.coach_certifications FOR UPDATE TO authenticated USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id)'';'; END IF; END $wrap$;
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='coach_certifications') THEN EXECUTE 'CREATE POLICY "Coaches can delete their own certifications" ON public.coach_certifications FOR DELETE TO authenticated USING (auth.uid() = coach_id)'';'; END IF; END $wrap$;
  END IF;
END $$;
