-- ============================================================
-- MIGRACIÓN: Políticas CRUD — Bloque 3 "GREP VERIFICADO"
-- Proyecto: SportMaps (luebjarufsiadojhvxgi)
-- Fecha: 2026-02-25
-- Riesgo: BAJO — Verificado contra uso real en frontend
-- ============================================================

-- ------------------------------------------------------------
-- 1. SESSION_ATTENDANCE
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.session_attendance ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'DROP POLICY IF EXISTS "session_attendance_select" ON public.session_attendance;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'DROP POLICY IF EXISTS "session_attendance_select_own" ON public.session_attendance;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'DROP POLICY IF EXISTS "session_attendance_insert" ON public.session_attendance;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'DROP POLICY IF EXISTS "session_attendance_update" ON public.session_attendance;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'DROP POLICY IF EXISTS "session_attendance_delete" ON public.session_attendance;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_select" ON public.session_attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = session_attendance.session_id
      AND (
        public.fn_is_admin_of_school(t.school_id)
        OR EXISTS (SELECT 1 FROM school_members WHERE school_id = t.school_id AND profile_id = auth.uid() AND role IN (''owner'', ''admin'', ''coach'') AND status = ''active'')
      )
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_select_own" ON public.session_attendance
  FOR SELECT
  USING (player_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_insert" ON public.session_attendance
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = session_attendance.session_id
      AND (
        public.fn_is_admin_of_school(t.school_id)
        OR EXISTS (SELECT 1 FROM school_members WHERE school_id = t.school_id AND profile_id = auth.uid() AND role IN (''owner'', ''admin'', ''coach'') AND status = ''active'')
      )
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_update" ON public.session_attendance
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = session_attendance.session_id
      AND (
        public.fn_is_admin_of_school(t.school_id)
        OR EXISTS (SELECT 1 FROM school_members WHERE school_id = t.school_id AND profile_id = auth.uid() AND role IN (''owner'', ''admin'', ''coach'') AND status = ''active'')
      )
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_delete" ON public.session_attendance
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = session_attendance.session_id
      AND public.fn_is_admin_of_school(t.school_id)
    )
  );'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 2. CLASS_ENROLLMENTS
-- ------------------------------------------------------------
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'DROP POLICY IF EXISTS "class_enrollments_select_staff" ON public.class_enrollments;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'DROP POLICY IF EXISTS "class_enrollments_select_own" ON public.class_enrollments;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'DROP POLICY IF EXISTS "class_enrollments_manage_admin" ON public.class_enrollments;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'CREATE POLICY "class_enrollments_select_staff" ON public.class_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_enrollments.class_id
      AND (
        public.fn_is_admin_of_school(c.school_id)
        OR EXISTS (SELECT 1 FROM school_members WHERE school_id = c.school_id AND profile_id = auth.uid() AND role IN (''owner'', ''admin'', ''coach'') AND status = ''active'')
      )
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'CREATE POLICY "class_enrollments_select_own" ON public.class_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.id = class_enrollments.enrollment_id
      AND (
        e.user_id = auth.uid()
        OR e.child_id IN (
          SELECT id FROM public.children WHERE parent_id = auth.uid()
        )
      )
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'CREATE POLICY "class_enrollments_manage_admin" ON public.class_enrollments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_enrollments.class_id
      AND public.fn_is_admin_of_school(c.school_id)
    )
  );'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 3. ANALYTICS_EVENTS
-- ------------------------------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "analytics_events_select_admin" ON public.analytics_events;
    DROP POLICY IF EXISTS "analytics_events_select_own" ON public.analytics_events;
    DROP POLICY IF EXISTS "analytics_events_insert" ON public.analytics_events;
END $$;

CREATE POLICY "analytics_events_select_admin" ON public.analytics_events
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "analytics_events_select_own" ON public.analytics_events
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "analytics_events_insert" ON public.analytics_events
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL 
  );

-- ------------------------------------------------------------
-- 4. FACILITY_RESERVATIONS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.facility_reservations ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'DROP POLICY IF EXISTS "reservations_select" ON public.facility_reservations;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'DROP POLICY IF EXISTS "reservations_insert" ON public.facility_reservations;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'DROP POLICY IF EXISTS "reservations_update" ON public.facility_reservations;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'DROP POLICY IF EXISTS "reservations_delete" ON public.facility_reservations;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'CREATE POLICY "reservations_select" ON public.facility_reservations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.fn_is_admin_of_school((
      SELECT f.school_id FROM public.facilities f
      WHERE f.id = facility_reservations.facility_id
    ))
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'CREATE POLICY "reservations_insert" ON public.facility_reservations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.facilities f
      JOIN public.school_members sm ON sm.school_id = f.school_id
      WHERE f.id = facility_reservations.facility_id
      AND sm.profile_id = auth.uid()
      AND sm.status = ''active''
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'CREATE POLICY "reservations_update" ON public.facility_reservations
  FOR UPDATE
  USING (
    (user_id = auth.uid() AND status = ''pending'')
    OR public.fn_is_admin_of_school((
      SELECT f.school_id FROM public.facilities f
      WHERE f.id = facility_reservations.facility_id
    ))
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'CREATE POLICY "reservations_delete" ON public.facility_reservations
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND status = ''pending''
  );'; END IF; END $wrap$;
