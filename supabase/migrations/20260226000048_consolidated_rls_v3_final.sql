-- ============================================================
-- MIGRACIÓN CONSOLIDADA: Políticas CRUD completas
-- Proyecto: SportMaps (luebjarufsiadojhvxgi)
-- Fecha: 2026-02-25
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- LIMPIEZA PREVIA (Idempotencia para re-ejecución segura)
-- ------------------------------------------------------------
DO $$ 
DECLARE
    t text;
    p text;
BEGIN
    FOR t, p IN 
        SELECT tablename, policyname FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'orders','order_items','carts','messages','training_logs',
            'reviews','announcements','notifications','products',
            'wellness_appointments','facilities','athlete_stats',
            'session_attendance','class_enrollments','analytics_events',
            'facility_reservations','team_coaches','team_branches'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 1. ORDERS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT WITH CHECK (user_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'CREATE POLICY "orders_update_own" ON public.orders FOR UPDATE USING (user_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'CREATE POLICY "orders_delete_own" ON public.orders FOR DELETE USING (user_id = auth.uid() AND status = ''pending'');'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 2. ORDER_ITEMS
-- ------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'CREATE POLICY "order_items_select_own" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'CREATE POLICY "order_items_insert_own" ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'CREATE POLICY "order_items_delete_own" ON public.order_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid() AND orders.status = ''pending''));'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 3. CARTS
-- ------------------------------------------------------------
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'CREATE POLICY "carts_select_own" ON public.carts FOR SELECT USING (user_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'CREATE POLICY "carts_insert_own" ON public.carts FOR INSERT WITH CHECK (user_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'CREATE POLICY "carts_update_own" ON public.carts FOR UPDATE USING (user_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'CREATE POLICY "carts_delete_own" ON public.carts FOR DELETE USING (user_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 4. MESSAGES
-- ------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update_recipient" ON public.messages FOR UPDATE USING (recipient_id = auth.uid());
CREATE POLICY "messages_delete_sender" ON public.messages FOR DELETE USING (sender_id = auth.uid());

-- ------------------------------------------------------------
-- 5. TRAINING_LOGS
-- ------------------------------------------------------------
ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'CREATE POLICY "training_logs_select_own" ON public.training_logs FOR SELECT USING (athlete_id = auth.uid() OR EXISTS (SELECT 1 FROM public.children c WHERE c.id = training_logs.athlete_id AND c.parent_id = auth.uid()));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'CREATE POLICY "training_logs_insert_own" ON public.training_logs FOR INSERT WITH CHECK (athlete_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'CREATE POLICY "training_logs_update_own" ON public.training_logs FOR UPDATE USING (athlete_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'CREATE POLICY "training_logs_delete_own" ON public.training_logs FOR DELETE USING (athlete_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 6. REVIEWS
-- ------------------------------------------------------------
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'CREATE POLICY "reviews_select_public" ON public.reviews FOR SELECT USING (true);'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'CREATE POLICY "reviews_insert_authenticated" ON public.reviews FOR INSERT WITH CHECK (user_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE USING (user_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE USING (user_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 7. ANNOUNCEMENTS
-- ------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_select_members" ON public.announcements FOR SELECT USING (EXISTS (SELECT 1 FROM public.teams t JOIN public.school_members sm ON sm.school_id = t.school_id WHERE t.id = announcements.team_id AND sm.profile_id = auth.uid() AND sm.status = 'active'));
CREATE POLICY "announcements_insert_coach_admin" ON public.announcements FOR INSERT WITH CHECK (coach_id = auth.uid() AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = announcements.team_id AND (public.fn_is_admin_of_school(t.school_id) OR EXISTS (SELECT 1 FROM school_members WHERE school_id = t.school_id AND profile_id = auth.uid() AND role IN ('owner', 'admin', 'coach') AND status = 'active'))));
CREATE POLICY "announcements_update_own" ON public.announcements FOR UPDATE USING (coach_id = auth.uid());
CREATE POLICY "announcements_delete_own" ON public.announcements FOR DELETE USING (coach_id = auth.uid() OR public.fn_is_admin_of_school((SELECT school_id FROM public.teams WHERE id = announcements.team_id)));

-- ------------------------------------------------------------
-- 8. NOTIFICATIONS
-- ------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 9. PRODUCTS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'CREATE POLICY "products_insert_admin" ON public.products FOR INSERT WITH CHECK (public.fn_is_admin_of_school(school_id) OR vendor_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'CREATE POLICY "products_update_admin" ON public.products FOR UPDATE USING (public.fn_is_admin_of_school(school_id) OR vendor_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'CREATE POLICY "products_delete_admin" ON public.products FOR DELETE USING (public.fn_is_admin_of_school(school_id) OR vendor_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 10. WELLNESS_APPOINTMENTS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.wellness_appointments ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'CREATE POLICY "wellness_appointments_insert_professional" ON public.wellness_appointments FOR INSERT WITH CHECK (professional_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'CREATE POLICY "wellness_appointments_update" ON public.wellness_appointments FOR UPDATE USING (professional_id = auth.uid() OR athlete_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'CREATE POLICY "wellness_appointments_delete_professional" ON public.wellness_appointments FOR DELETE USING (professional_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 11. FACILITIES
-- ------------------------------------------------------------
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facilities_insert_admin" ON public.facilities FOR INSERT WITH CHECK (public.fn_is_admin_of_school(school_id));
CREATE POLICY "facilities_update_admin" ON public.facilities FOR UPDATE USING (public.fn_is_admin_of_school(school_id));
CREATE POLICY "facilities_delete_admin" ON public.facilities FOR DELETE USING (public.fn_is_admin_of_school(school_id));

-- ------------------------------------------------------------
-- 12. ATHLETE_STATS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.athlete_stats ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'CREATE POLICY "athlete_stats_insert_own" ON public.athlete_stats FOR INSERT WITH CHECK (athlete_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'CREATE POLICY "athlete_stats_update_own" ON public.athlete_stats FOR UPDATE USING (athlete_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'CREATE POLICY "athlete_stats_delete_own" ON public.athlete_stats FOR DELETE USING (athlete_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'CREATE POLICY "athlete_stats_insert_admin" ON public.athlete_stats FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.children c WHERE c.id = athlete_stats.athlete_id AND public.fn_is_admin_of_school(c.school_id)));'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 13. SESSION_ATTENDANCE
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.session_attendance ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_select" ON public.session_attendance FOR SELECT USING (EXISTS (SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id WHERE ts.id = session_attendance.session_id AND (public.fn_is_admin_of_school(t.school_id) OR EXISTS (SELECT 1 FROM school_members WHERE school_id = t.school_id AND profile_id = auth.uid() AND role IN (''owner'', ''admin'', ''coach'') AND status = ''active''))));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_select_own" ON public.session_attendance FOR SELECT USING (player_id = auth.uid());'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_insert" ON public.session_attendance FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id WHERE ts.id = session_attendance.session_id AND (public.fn_is_admin_of_school(t.school_id) OR EXISTS (SELECT 1 FROM school_members WHERE school_id = t.school_id AND profile_id = auth.uid() AND role IN (''owner'', ''admin'', ''coach'') AND status = ''active''))));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_update" ON public.session_attendance FOR UPDATE USING (EXISTS (SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id WHERE ts.id = session_attendance.session_id AND (public.fn_is_admin_of_school(t.school_id) OR EXISTS (SELECT 1 FROM school_members WHERE school_id = t.school_id AND profile_id = auth.uid() AND role IN (''owner'', ''admin'', ''coach'') AND status = ''active''))));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='session_attendance') THEN EXECUTE 'CREATE POLICY "session_attendance_delete" ON public.session_attendance FOR DELETE USING (EXISTS (SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id WHERE ts.id = session_attendance.session_id AND public.fn_is_admin_of_school(t.school_id)));'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 14. CLASS_ENROLLMENTS
-- ------------------------------------------------------------
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'CREATE POLICY "class_enrollments_select_staff" ON public.class_enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND (public.fn_is_admin_of_school(c.school_id) OR EXISTS (SELECT 1 FROM school_members WHERE school_id = c.school_id AND profile_id = auth.uid() AND role IN (''owner'', ''admin'', ''coach'') AND status = ''active''))));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'CREATE POLICY "class_enrollments_select_own" ON public.class_enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = class_enrollments.enrollment_id AND (e.user_id = auth.uid() OR e.child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()))));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='class_enrollments') THEN EXECUTE 'CREATE POLICY "class_enrollments_manage_admin" ON public.class_enrollments FOR ALL USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND public.fn_is_admin_of_school(c.school_id)));'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 15. ANALYTICS_EVENTS
-- ------------------------------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_events_select_admin" ON public.analytics_events FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "analytics_events_select_own" ON public.analytics_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "analytics_events_insert" ON public.analytics_events FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ------------------------------------------------------------
-- 16. FACILITY_RESERVATIONS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.facility_reservations ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'CREATE POLICY "reservations_select" ON public.facility_reservations FOR SELECT USING (user_id = auth.uid() OR public.fn_is_admin_of_school((SELECT f.school_id FROM public.facilities f WHERE f.id = facility_reservations.facility_id)));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'CREATE POLICY "reservations_insert" ON public.facility_reservations FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.facilities f JOIN public.school_members sm ON sm.school_id = f.school_id WHERE f.id = facility_reservations.facility_id AND sm.profile_id = auth.uid() AND sm.status = ''active''));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'CREATE POLICY "reservations_update" ON public.facility_reservations FOR UPDATE USING ((user_id = auth.uid() AND status = ''pending'') OR public.fn_is_admin_of_school((SELECT f.school_id FROM public.facilities f WHERE f.id = facility_reservations.facility_id)));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='facility_reservations') THEN EXECUTE 'CREATE POLICY "reservations_delete" ON public.facility_reservations FOR DELETE USING (user_id = auth.uid() AND status = ''pending'');'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 17. TEAM_COACHES
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.team_coaches ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'CREATE POLICY "team_coaches_manage_admin" ON public.team_coaches FOR ALL USING (public.fn_is_admin_of_school(school_id)) WITH CHECK (public.fn_is_admin_of_school(school_id));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'CREATE POLICY "team_coaches_delete_via_team" ON public.team_coaches FOR DELETE USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_coaches.team_id AND public.fn_is_admin_of_school(t.school_id)));'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 18. TEAM_BRANCHES
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.team_branches ENABLE ROW LEVEL SECURITY;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_branches') THEN EXECUTE 'CREATE POLICY "team_branches_manage_admin" ON public.team_branches FOR ALL USING (public.fn_is_admin_of_school(school_id)) WITH CHECK (public.fn_is_admin_of_school(school_id));'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_branches') THEN EXECUTE 'CREATE POLICY "team_branches_delete_via_team" ON public.team_branches FOR DELETE USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_branches.team_id AND public.fn_is_admin_of_school(t.school_id)));'; END IF; END $wrap$;

COMMIT;
