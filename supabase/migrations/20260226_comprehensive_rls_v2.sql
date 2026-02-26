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
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
    DROP POLICY IF EXISTS "products_update_admin" ON public.products;
    DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
END $$;

CREATE POLICY "products_insert_admin" ON public.products
  FOR INSERT
  WITH CHECK (
    is_school_admin(school_id)
    OR vendor_id = auth.uid()
  );

CREATE POLICY "products_update_admin" ON public.products
  FOR UPDATE
  USING (
    is_school_admin(school_id)
    OR vendor_id = auth.uid()
  );

CREATE POLICY "products_delete_admin" ON public.products
  FOR DELETE
  USING (
    is_school_admin(school_id)
    OR vendor_id = auth.uid()
  );

-- ------------------------------------------------------------
-- 3. WELLNESS_APPOINTMENTS
-- ------------------------------------------------------------
ALTER TABLE public.wellness_appointments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "wellness_appointments_insert_professional" ON public.wellness_appointments;
    DROP POLICY IF EXISTS "wellness_appointments_update" ON public.wellness_appointments;
    DROP POLICY IF EXISTS "wellness_appointments_delete_professional" ON public.wellness_appointments;
END $$;

CREATE POLICY "wellness_appointments_insert_professional" ON public.wellness_appointments
  FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "wellness_appointments_update" ON public.wellness_appointments
  FOR UPDATE
  USING (
    professional_id = auth.uid()
    OR athlete_id = auth.uid()
  );

CREATE POLICY "wellness_appointments_delete_professional" ON public.wellness_appointments
  FOR DELETE
  USING (professional_id = auth.uid());

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
  WITH CHECK (is_school_admin(school_id));

CREATE POLICY "facilities_update_admin" ON public.facilities
  FOR UPDATE
  USING (is_school_admin(school_id));

CREATE POLICY "facilities_delete_admin" ON public.facilities
  FOR DELETE
  USING (is_school_admin(school_id));

-- ------------------------------------------------------------
-- 5. ATHLETE_STATS
-- ------------------------------------------------------------
ALTER TABLE public.athlete_stats ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "athlete_stats_insert_own" ON public.athlete_stats;
    DROP POLICY IF EXISTS "athlete_stats_update_own" ON public.athlete_stats;
    DROP POLICY IF EXISTS "athlete_stats_delete_own" ON public.athlete_stats;
    DROP POLICY IF EXISTS "athlete_stats_insert_admin" ON public.athlete_stats;
END $$;

CREATE POLICY "athlete_stats_insert_own" ON public.athlete_stats
  FOR INSERT
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "athlete_stats_update_own" ON public.athlete_stats
  FOR UPDATE
  USING (athlete_id = auth.uid());

CREATE POLICY "athlete_stats_delete_own" ON public.athlete_stats
  FOR DELETE
  USING (athlete_id = auth.uid());

CREATE POLICY "athlete_stats_insert_admin" ON public.athlete_stats
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = athlete_stats.athlete_id
      AND is_school_admin(c.school_id)
    )
  );

-- ------------------------------------------------------------
-- 6. ORDERS
-- ------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
    DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
    DROP POLICY IF EXISTS "orders_delete_own" ON public.orders;
END $$;

CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_update_own" ON public.orders
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "orders_delete_own" ON public.orders
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- ------------------------------------------------------------
-- 7. ORDER_ITEMS
-- ------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
    DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;
    DROP POLICY IF EXISTS "order_items_delete_own" ON public.order_items;
END $$;

CREATE POLICY "order_items_select_own" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "order_items_insert_own" ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "order_items_delete_own" ON public.order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      AND orders.status = 'pending'
    )
  );

-- ------------------------------------------------------------
-- 8. CARTS
-- ------------------------------------------------------------
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "carts_select_own" ON public.carts;
    DROP POLICY IF EXISTS "carts_insert_own" ON public.carts;
    DROP POLICY IF EXISTS "carts_update_own" ON public.carts;
    DROP POLICY IF EXISTS "carts_delete_own" ON public.carts;
END $$;

CREATE POLICY "carts_select_own" ON public.carts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "carts_insert_own" ON public.carts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "carts_update_own" ON public.carts
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "carts_delete_own" ON public.carts
  FOR DELETE
  USING (user_id = auth.uid());

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
    DROP POLICY IF EXISTS "training_logs_select_own" ON public.training_logs;
    DROP POLICY IF EXISTS "training_logs_insert_own" ON public.training_logs;
    DROP POLICY IF EXISTS "training_logs_update_own" ON public.training_logs;
    DROP POLICY IF EXISTS "training_logs_delete_own" ON public.training_logs;
END $$;

CREATE POLICY "training_logs_select_own" ON public.training_logs
  FOR SELECT
  USING (
    athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = training_logs.athlete_id
      AND c.parent_id = auth.uid()
    )
  );

CREATE POLICY "training_logs_insert_own" ON public.training_logs
  FOR INSERT
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "training_logs_update_own" ON public.training_logs
  FOR UPDATE
  USING (athlete_id = auth.uid());

CREATE POLICY "training_logs_delete_own" ON public.training_logs
  FOR DELETE
  USING (athlete_id = auth.uid());

-- ------------------------------------------------------------
-- 11. REVIEWS
-- ------------------------------------------------------------
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
    DROP POLICY IF EXISTS "reviews_insert_authenticated" ON public.reviews;
    DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
    DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
END $$;

CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT
  USING (true);

CREATE POLICY "reviews_insert_authenticated" ON public.reviews
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "reviews_delete_own" ON public.reviews
  FOR DELETE
  USING (user_id = auth.uid());

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
        is_school_admin(t.school_id)
        OR is_school_coach(t.school_id)
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
    OR is_school_admin((
      SELECT school_id FROM public.teams WHERE id = announcements.team_id
    ))
  );
