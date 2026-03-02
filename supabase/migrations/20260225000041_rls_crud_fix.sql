-- RLS CRUD FIXES - 2026-02-25
-- Purpose: Restore and enhance RLS policies for core modules where CRUD was failing.
-- NOTE: Wrapped in conditional checks for tables that may not exist in consolidated schema.

DO $$
BEGIN
  -- 2. ACADEMIC & CLASSES
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    EXECUTE 'ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "classes_admin_all" ON public.classes';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='classes') THEN EXECUTE 'CREATE POLICY "classes_admin_all" ON public.classes FOR ALL USING (public.fn_is_admin_of_school(school_id))'';'; END IF; END $wrap$;
    EXECUTE 'DROP POLICY IF EXISTS "classes_coach_read" ON public.classes';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='classes') THEN EXECUTE 'CREATE POLICY "classes_coach_read" ON public.classes FOR SELECT USING (EXISTS (SELECT 1 FROM school_members WHERE school_id = classes.school_id AND profile_id = auth.uid() AND role IN (''''owner'''', ''''admin'''', ''''coach'''') AND status = ''''active''''))'';'; END IF; END $wrap$;
  END IF;

  -- 3. ATTENDANCE (legacy table)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance') THEN
    EXECUTE 'ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "attendance_admin_all" ON public.attendance';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='attendance') THEN EXECUTE 'CREATE POLICY "attendance_admin_all" ON public.attendance FOR ALL USING (EXISTS (SELECT 1 FROM children WHERE children.id = attendance.child_id AND public.fn_is_admin_of_school(children.school_id)))'';'; END IF; END $wrap$;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_records') THEN
    EXECUTE 'ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "attendance_records_admin_all" ON public.attendance_records';
    EXECUTE 'CREATE POLICY "attendance_records_admin_all" ON public.attendance_records FOR ALL USING (public.fn_is_admin_of_school(school_id))';
  END IF;

  -- 4. PERFORMANCE & PROGRESS
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_progress') THEN
    EXECUTE 'ALTER TABLE public.academic_progress ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "academic_progress_admin_all" ON public.academic_progress';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='academic_progress') THEN EXECUTE 'CREATE POLICY "academic_progress_admin_all" ON public.academic_progress FOR ALL USING (EXISTS (SELECT 1 FROM children WHERE children.id = academic_progress.child_id AND public.fn_is_admin_of_school(children.school_id)))'';'; END IF; END $wrap$;
    EXECUTE 'DROP POLICY IF EXISTS "academic_progress_parent_read" ON public.academic_progress';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='academic_progress') THEN EXECUTE 'CREATE POLICY "academic_progress_parent_read" ON public.academic_progress FOR SELECT USING (EXISTS (SELECT 1 FROM children WHERE children.id = academic_progress.child_id AND children.parent_id = auth.uid()))'';'; END IF; END $wrap$;
  END IF;

  -- 5. TEAMS & SESSIONS
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'training_sessions') THEN
    EXECUTE 'ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "training_sessions_admin_all" ON public.training_sessions';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_sessions') THEN EXECUTE 'CREATE POLICY "training_sessions_admin_all" ON public.training_sessions FOR ALL USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = training_sessions.team_id AND public.fn_is_admin_of_school(teams.school_id)))'';'; END IF; END $wrap$;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'match_results') THEN
    EXECUTE 'ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "match_results_admin_all" ON public.match_results';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='match_results') THEN EXECUTE 'CREATE POLICY "match_results_admin_all" ON public.match_results FOR ALL USING (EXISTS (SELECT 1 FROM teams WHERE teams.id = match_results.team_id AND public.fn_is_admin_of_school(teams.school_id)))'';'; END IF; END $wrap$;
  END IF;

  -- 6. HEALTH & WELLNESS
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wellness_evaluations') THEN
    EXECUTE 'ALTER TABLE public.wellness_evaluations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "wellness_evaluations_access" ON public.wellness_evaluations';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_evaluations') THEN EXECUTE 'CREATE POLICY "wellness_evaluations_access" ON public.wellness_evaluations FOR ALL USING (auth.uid() = professional_id OR auth.uid() = athlete_id OR EXISTS (SELECT 1 FROM children WHERE children.id = wellness_evaluations.athlete_id AND (children.parent_id = auth.uid() OR public.fn_is_admin_of_school(children.school_id))))'';'; END IF; END $wrap$;
  END IF;

  -- 7. ACTIVITIES & EVENTS
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activities') THEN
    EXECUTE 'ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "activities_access" ON public.activities';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='activities') THEN EXECUTE 'CREATE POLICY "activities_access" ON public.activities FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM teams WHERE teams.id = activities.program_id AND public.fn_is_admin_of_school(teams.school_id)))'';'; END IF; END $wrap$;
  END IF;

  -- events: skipped because event_status enum may not include 'published'/'ongoing'

END $$;

-- 8. SCHOOL MEMBERS (Enable CRUD for Admins if missing)
DROP POLICY IF EXISTS "school_members_admin_crud" ON school_members;
CREATE POLICY "school_members_admin_crud" ON school_members
    FOR ALL USING (public.fn_is_admin_of_school(school_id));
