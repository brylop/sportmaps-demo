-- ============================================================
-- MIGRACIÓN: Políticas CRUD — Bloque "VERIFICACIÓN RÁPIDA"
-- Proyecto: SportMaps (luebjarufsiadojhvxgi)
-- Fecha: 2026-02-25
-- Riesgo: MUY BAJO — Inferido del schema y funciones existentes
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOTIFICATIONS
-- ------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
    DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
    DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
END $$;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 2. PRODUCTS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'DROP POLICY IF EXISTS "products_insert_admin" ON public.products;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'DROP POLICY IF EXISTS "products_update_admin" ON public.products;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'DROP POLICY IF EXISTS "products_delete_admin" ON public.products;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'CREATE POLICY "products_insert_admin" ON public.products
  FOR INSERT
  WITH CHECK (
    public.fn_is_admin_of_school(school_id)
    OR vendor_id = auth.uid()
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'CREATE POLICY "products_update_admin" ON public.products
  FOR UPDATE
  USING (
    public.fn_is_admin_of_school(school_id)
    OR vendor_id = auth.uid()
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='products') THEN EXECUTE 'CREATE POLICY "products_delete_admin" ON public.products
  FOR DELETE
  USING (
    public.fn_is_admin_of_school(school_id)
    OR vendor_id = auth.uid()
  );'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 3. WELLNESS_APPOINTMENTS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.wellness_appointments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'DROP POLICY IF EXISTS "wellness_appointments_insert_professional" ON public.wellness_appointments;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'DROP POLICY IF EXISTS "wellness_appointments_update" ON public.wellness_appointments;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'DROP POLICY IF EXISTS "wellness_appointments_delete_professional" ON public.wellness_appointments;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'CREATE POLICY "wellness_appointments_insert_professional" ON public.wellness_appointments
  FOR INSERT
  WITH CHECK (professional_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'CREATE POLICY "wellness_appointments_update" ON public.wellness_appointments
  FOR UPDATE
  USING (
    professional_id = auth.uid()
    OR athlete_id = auth.uid()
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments') THEN EXECUTE 'CREATE POLICY "wellness_appointments_delete_professional" ON public.wellness_appointments
  FOR DELETE
  USING (professional_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 4. FACILITIES
-- ------------------------------------------------------------
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "facilities_insert_admin" ON public.facilities;
    DROP POLICY IF EXISTS "facilities_update_admin" ON public.facilities;
    DROP POLICY IF EXISTS "facilities_delete_admin" ON public.facilities;
END $$;

CREATE POLICY "facilities_insert_admin" ON public.facilities
  FOR INSERT
  WITH CHECK (public.fn_is_admin_of_school(school_id));

CREATE POLICY "facilities_update_admin" ON public.facilities
  FOR UPDATE
  USING (public.fn_is_admin_of_school(school_id));

CREATE POLICY "facilities_delete_admin" ON public.facilities
  FOR DELETE
  USING (public.fn_is_admin_of_school(school_id));

-- ------------------------------------------------------------
-- 5. ATHLETE_STATS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.athlete_stats ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'DROP POLICY IF EXISTS "athlete_stats_insert_own" ON public.athlete_stats;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'DROP POLICY IF EXISTS "athlete_stats_update_own" ON public.athlete_stats;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'DROP POLICY IF EXISTS "athlete_stats_delete_own" ON public.athlete_stats;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'DROP POLICY IF EXISTS "athlete_stats_insert_admin" ON public.athlete_stats;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'CREATE POLICY "athlete_stats_insert_own" ON public.athlete_stats
  FOR INSERT
  WITH CHECK (athlete_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'CREATE POLICY "athlete_stats_update_own" ON public.athlete_stats
  FOR UPDATE
  USING (athlete_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'CREATE POLICY "athlete_stats_delete_own" ON public.athlete_stats
  FOR DELETE
  USING (athlete_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='athlete_stats') THEN EXECUTE 'CREATE POLICY "athlete_stats_insert_admin" ON public.athlete_stats
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = athlete_stats.athlete_id
      AND public.fn_is_admin_of_school(c.school_id)
    )
  );'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 6. ORDERS
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'DROP POLICY IF EXISTS "orders_update_own" ON public.orders;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'DROP POLICY IF EXISTS "orders_delete_own" ON public.orders;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT
  WITH CHECK (user_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'CREATE POLICY "orders_update_own" ON public.orders
  FOR UPDATE
  USING (user_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='orders') THEN EXECUTE 'CREATE POLICY "orders_delete_own" ON public.orders
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND status = ''pending''
  );'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 7. ORDER_ITEMS
-- ------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'DROP POLICY IF EXISTS "order_items_delete_own" ON public.order_items;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'CREATE POLICY "order_items_select_own" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'CREATE POLICY "order_items_insert_own" ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='order_items') THEN EXECUTE 'CREATE POLICY "order_items_delete_own" ON public.order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      AND orders.status = ''pending''
    )
  );'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 8. CARTS
-- ------------------------------------------------------------
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'DROP POLICY IF EXISTS "carts_select_own" ON public.carts;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'DROP POLICY IF EXISTS "carts_insert_own" ON public.carts;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'DROP POLICY IF EXISTS "carts_update_own" ON public.carts;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'DROP POLICY IF EXISTS "carts_delete_own" ON public.carts;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'CREATE POLICY "carts_select_own" ON public.carts
  FOR SELECT
  USING (user_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'CREATE POLICY "carts_insert_own" ON public.carts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'CREATE POLICY "carts_update_own" ON public.carts
  FOR UPDATE
  USING (user_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='carts') THEN EXECUTE 'CREATE POLICY "carts_delete_own" ON public.carts
  FOR DELETE
  USING (user_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 9. MESSAGES
-- ------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
    DROP POLICY IF EXISTS "messages_update_recipient" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
END $$;

CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
  );

CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_update_recipient" ON public.messages
  FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "messages_delete_sender" ON public.messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- ------------------------------------------------------------
-- 10. TRAINING_LOGS
-- ------------------------------------------------------------
ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'DROP POLICY IF EXISTS "training_logs_select_own" ON public.training_logs;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'DROP POLICY IF EXISTS "training_logs_insert_own" ON public.training_logs;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'DROP POLICY IF EXISTS "training_logs_update_own" ON public.training_logs;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'DROP POLICY IF EXISTS "training_logs_delete_own" ON public.training_logs;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'CREATE POLICY "training_logs_select_own" ON public.training_logs
  FOR SELECT
  USING (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = training_logs.athlete_id
      AND c.parent_id = auth.uid()
    )
  );'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'CREATE POLICY "training_logs_insert_own" ON public.training_logs
  FOR INSERT
  WITH CHECK (athlete_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'CREATE POLICY "training_logs_update_own" ON public.training_logs
  FOR UPDATE
  USING (athlete_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='training_logs') THEN EXECUTE 'CREATE POLICY "training_logs_delete_own" ON public.training_logs
  FOR DELETE
  USING (athlete_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 11. REVIEWS
-- ------------------------------------------------------------
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'DROP POLICY IF EXISTS "reviews_insert_authenticated" ON public.reviews;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;'; END IF; END $wrap$;
    DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;'; END IF; END $wrap$;
END $$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT
  USING (true);'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'CREATE POLICY "reviews_insert_authenticated" ON public.reviews
  FOR INSERT
  WITH CHECK (user_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE
  USING (user_id = auth.uid());'; END IF; END $wrap$;

DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='reviews') THEN EXECUTE 'CREATE POLICY "reviews_delete_own" ON public.reviews
  FOR DELETE
  USING (user_id = auth.uid());'; END IF; END $wrap$;

-- ------------------------------------------------------------
-- 12. ANNOUNCEMENTS
-- ------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "announcements_select_members" ON public.announcements;
    DROP POLICY IF EXISTS "announcements_insert_coach_admin" ON public.announcements;
    DROP POLICY IF EXISTS "announcements_update_own" ON public.announcements;
    DROP POLICY IF EXISTS "announcements_delete_own" ON public.announcements;
END $$;

CREATE POLICY "announcements_select_members" ON public.announcements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.school_members sm ON sm.school_id = t.school_id
      WHERE t.id = announcements.team_id
      AND sm.profile_id = auth.uid()
      AND sm.status = 'active'
    )
  );

CREATE POLICY "announcements_insert_coach_admin" ON public.announcements
  FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = announcements.team_id
      AND (
        public.fn_is_admin_of_school(t.school_id)
        OR EXISTS (SELECT 1 FROM school_members WHERE school_id = t.school_id AND profile_id = auth.uid() AND role IN ('owner', 'admin', 'coach') AND status = 'active')
      )
    )
  );

CREATE POLICY "announcements_update_own" ON public.announcements
  FOR UPDATE
  USING (coach_id = auth.uid());

CREATE POLICY "announcements_delete_own" ON public.announcements
  FOR DELETE
  USING (
    coach_id = auth.uid()
    OR public.fn_is_admin_of_school((
      SELECT school_id FROM public.teams WHERE id = announcements.team_id
    ))
  );
