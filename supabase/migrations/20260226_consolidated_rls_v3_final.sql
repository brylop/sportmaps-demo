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
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "orders_update_own" ON public.orders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "orders_delete_own" ON public.orders FOR DELETE USING (user_id = auth.uid() AND status = 'pending');

-- ------------------------------------------------------------
-- 2. ORDER_ITEMS
-- ------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select_own" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "order_items_insert_own" ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "order_items_delete_own" ON public.order_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid() AND orders.status = 'pending'));

-- ------------------------------------------------------------
-- 3. CARTS
-- ------------------------------------------------------------
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts_select_own" ON public.carts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "carts_insert_own" ON public.carts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "carts_update_own" ON public.carts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "carts_delete_own" ON public.carts FOR DELETE USING (user_id = auth.uid());

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
CREATE POLICY "training_logs_select_own" ON public.training_logs FOR SELECT USING (athlete_id = auth.uid() OR EXISTS (SELECT 1 FROM public.children c WHERE c.id = training_logs.athlete_id AND c.parent_id = auth.uid()));
CREATE POLICY "training_logs_insert_own" ON public.training_logs FOR INSERT WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "training_logs_update_own" ON public.training_logs FOR UPDATE USING (athlete_id = auth.uid());
CREATE POLICY "training_logs_delete_own" ON public.training_logs FOR DELETE USING (athlete_id = auth.uid());

-- ------------------------------------------------------------
-- 6. REVIEWS
-- ------------------------------------------------------------
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select_public" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_authenticated" ON public.reviews FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 7. ANNOUNCEMENTS
-- ------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_select_members" ON public.announcements FOR SELECT USING (EXISTS (SELECT 1 FROM public.teams t JOIN public.school_members sm ON sm.school_id = t.school_id WHERE t.id = announcements.team_id AND sm.profile_id = auth.uid() AND sm.status = 'active'));
CREATE POLICY "announcements_insert_coach_admin" ON public.announcements FOR INSERT WITH CHECK (coach_id = auth.uid() AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = announcements.team_id AND (is_school_admin(t.school_id) OR is_school_coach(t.school_id))));
CREATE POLICY "announcements_update_own" ON public.announcements FOR UPDATE USING (coach_id = auth.uid());
CREATE POLICY "announcements_delete_own" ON public.announcements FOR DELETE USING (coach_id = auth.uid() OR is_school_admin((SELECT school_id FROM public.teams WHERE id = announcements.team_id)));

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
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_insert_admin" ON public.products FOR INSERT WITH CHECK (is_school_admin(school_id) OR vendor_id = auth.uid());
CREATE POLICY "products_update_admin" ON public.products FOR UPDATE USING (is_school_admin(school_id) OR vendor_id = auth.uid());
CREATE POLICY "products_delete_admin" ON public.products FOR DELETE USING (is_school_admin(school_id) OR vendor_id = auth.uid());

-- ------------------------------------------------------------
-- 10. WELLNESS_APPOINTMENTS
-- ------------------------------------------------------------
ALTER TABLE public.wellness_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_appointments_insert_professional" ON public.wellness_appointments FOR INSERT WITH CHECK (professional_id = auth.uid());
CREATE POLICY "wellness_appointments_update" ON public.wellness_appointments FOR UPDATE USING (professional_id = auth.uid() OR athlete_id = auth.uid());
CREATE POLICY "wellness_appointments_delete_professional" ON public.wellness_appointments FOR DELETE USING (professional_id = auth.uid());

-- ------------------------------------------------------------
-- 11. FACILITIES
-- ------------------------------------------------------------
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facilities_insert_admin" ON public.facilities FOR INSERT WITH CHECK (is_school_admin(school_id));
CREATE POLICY "facilities_update_admin" ON public.facilities FOR UPDATE USING (is_school_admin(school_id));
CREATE POLICY "facilities_delete_admin" ON public.facilities FOR DELETE USING (is_school_admin(school_id));

-- ------------------------------------------------------------
-- 12. ATHLETE_STATS
-- ------------------------------------------------------------
ALTER TABLE public.athlete_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete_stats_insert_own" ON public.athlete_stats FOR INSERT WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "athlete_stats_update_own" ON public.athlete_stats FOR UPDATE USING (athlete_id = auth.uid());
CREATE POLICY "athlete_stats_delete_own" ON public.athlete_stats FOR DELETE USING (athlete_id = auth.uid());
CREATE POLICY "athlete_stats_insert_admin" ON public.athlete_stats FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.children c WHERE c.id = athlete_stats.athlete_id AND is_school_admin(c.school_id)));

-- ------------------------------------------------------------
-- 13. SESSION_ATTENDANCE
-- ------------------------------------------------------------
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_attendance_select" ON public.session_attendance FOR SELECT USING (EXISTS (SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id WHERE ts.id = session_attendance.session_id AND (is_school_admin(t.school_id) OR is_school_coach(t.school_id))));
CREATE POLICY "session_attendance_select_own" ON public.session_attendance FOR SELECT USING (player_id = auth.uid());
CREATE POLICY "session_attendance_insert" ON public.session_attendance FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id WHERE ts.id = session_attendance.session_id AND (is_school_admin(t.school_id) OR is_school_coach(t.school_id))));
CREATE POLICY "session_attendance_update" ON public.session_attendance FOR UPDATE USING (EXISTS (SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id WHERE ts.id = session_attendance.session_id AND (is_school_admin(t.school_id) OR is_school_coach(t.school_id))));
CREATE POLICY "session_attendance_delete" ON public.session_attendance FOR DELETE USING (EXISTS (SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id WHERE ts.id = session_attendance.session_id AND is_school_admin(t.school_id)));

-- ------------------------------------------------------------
-- 14. CLASS_ENROLLMENTS
-- ------------------------------------------------------------
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_enrollments_select_staff" ON public.class_enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND (is_school_admin(c.school_id) OR is_school_coach(c.school_id))));
CREATE POLICY "class_enrollments_select_own" ON public.class_enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = class_enrollments.enrollment_id AND (e.user_id = auth.uid() OR e.child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()))));
CREATE POLICY "class_enrollments_manage_admin" ON public.class_enrollments FOR ALL USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND is_school_admin(c.school_id)));

-- ------------------------------------------------------------
-- 15. ANALYTICS_EVENTS
-- ------------------------------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_events_select_admin" ON public.analytics_events FOR SELECT USING (is_platform_admin());
CREATE POLICY "analytics_events_select_own" ON public.analytics_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "analytics_events_insert" ON public.analytics_events FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ------------------------------------------------------------
-- 16. FACILITY_RESERVATIONS
-- ------------------------------------------------------------
ALTER TABLE public.facility_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_select" ON public.facility_reservations FOR SELECT USING (user_id = auth.uid() OR is_school_admin((SELECT f.school_id FROM public.facilities f WHERE f.id = facility_reservations.facility_id)));
CREATE POLICY "reservations_insert" ON public.facility_reservations FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.facilities f JOIN public.school_members sm ON sm.school_id = f.school_id WHERE f.id = facility_reservations.facility_id AND sm.profile_id = auth.uid() AND sm.status = 'active'));
CREATE POLICY "reservations_update" ON public.facility_reservations FOR UPDATE USING ((user_id = auth.uid() AND status = 'pending') OR is_school_admin((SELECT f.school_id FROM public.facilities f WHERE f.id = facility_reservations.facility_id)));
CREATE POLICY "reservations_delete" ON public.facility_reservations FOR DELETE USING (user_id = auth.uid() AND status = 'pending');

-- ------------------------------------------------------------
-- 17. TEAM_COACHES
-- ------------------------------------------------------------
ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_coaches_manage_admin" ON public.team_coaches FOR ALL USING (is_school_admin(school_id)) WITH CHECK (is_school_admin(school_id));
CREATE POLICY "team_coaches_delete_via_team" ON public.team_coaches FOR DELETE USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_coaches.team_id AND is_school_admin(t.school_id)));

-- ------------------------------------------------------------
-- 18. TEAM_BRANCHES
-- ------------------------------------------------------------
ALTER TABLE public.team_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_branches_manage_admin" ON public.team_branches FOR ALL USING (is_school_admin(school_id)) WITH CHECK (is_school_admin(school_id));
CREATE POLICY "team_branches_delete_via_team" ON public.team_branches FOR DELETE USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_branches.team_id AND is_school_admin(t.school_id)));

COMMIT;
