-- ============================================================================
-- MIGRACIÓN FINAL: Correcciones críticas e importantes del schema
-- Fecha: 2026-02-11
--
-- CRÍTICOS:
--   1. attendance.child_id → children (no profiles)
--   2. order_items.product_id FK faltante
--   3. payments.amount CHECK > 0
--
-- IMPORTANTES:
--   4. Eliminar tabla redundante spm_users
--   5. CHECK constraints faltantes en programs, products, facility_reservations
--   6. Columnas approved_by/approved_at/rejection_reason
--   7. ~15 índices faltantes para queries frecuentes
--   8. Trigger para sincronizar teams.current_students
-- ============================================================================

-- ============================================================================
-- 1. CRÍTICO: attendance.child_id debe apuntar a children, no a profiles
-- ============================================================================
DO $$
BEGIN
  -- Eliminar FK incorrecta si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attendance_child_id_fkey'
      AND table_name = 'attendance'
  ) THEN
    ALTER TABLE public.attendance DROP CONSTRAINT attendance_child_id_fkey;
  END IF;

  -- Crear FK correcta → children
  ALTER TABLE public.attendance
    ADD CONSTRAINT attendance_child_id_fkey
    FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE CASCADE;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'attendance FK migration: %', SQLERRM;
END $$;

-- ============================================================================
-- 2. CRÍTICO: order_items.product_id FK faltante
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_items_product_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'order_items FK migration: %', SQLERRM;
END $$;

-- ============================================================================
-- 3. CRÍTICO: CHECK constraints para montos y precios
-- ============================================================================
DO $$
BEGIN
  -- payments.amount > 0
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_amount_positive' AND table_name = 'payments'
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'payments amount CHECK: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- programs.price_monthly >= 0
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'programs_price_non_negative' AND table_name = 'programs'
  ) THEN
    ALTER TABLE public.programs ADD CONSTRAINT programs_price_non_negative CHECK (price_monthly >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'programs price CHECK: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- products.price >= 0
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_price_non_negative' AND table_name = 'products'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT products_price_non_negative CHECK (price >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'products price CHECK: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- facility_reservations: end_time > start_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reservations_time_valid' AND table_name = 'facility_reservations'
  ) THEN
    ALTER TABLE public.facility_reservations
      ADD CONSTRAINT reservations_time_valid CHECK (end_time > start_time);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reservations time CHECK: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- children.date_of_birth rango razonable (después del 2000)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'children_dob_reasonable' AND table_name = 'children'
  ) THEN
    ALTER TABLE public.children
      ADD CONSTRAINT children_dob_reasonable CHECK (date_of_birth > '2000-01-01'::date);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'children dob CHECK: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. IMPORTANTE: Eliminar tabla spm_users (redundante con profiles)
-- ============================================================================
-- Primero mover cualquier dato único de spm_users a profiles
DO $$
BEGIN
  -- Actualizar profiles con datos de spm_users que puedan faltar
  UPDATE public.profiles p
  SET
    full_name = COALESCE(p.full_name, s.full_name),
    phone = COALESCE(p.phone, s.phone),
    avatar_url = COALESCE(p.avatar_url, s.avatar_url)
  FROM public.spm_users s
  WHERE p.id = s.id
    AND (p.full_name IS NULL OR p.phone IS NULL OR p.avatar_url IS NULL);

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'spm_users data merge: %', SQLERRM;
END $$;

-- Marcar spm_users como deprecada (no eliminar aún por seguridad)
COMMENT ON TABLE public.spm_users IS 'DEPRECATED: Use profiles table instead. Scheduled for removal.';

-- ============================================================================
-- 5. IMPORTANTE: Columnas de aprobación en payments
-- ============================================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approved_by uuid;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS rejection_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_approved_by_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'payments approved_by FK: %', SQLERRM;
END $$;

-- ============================================================================
-- 6. IMPORTANTE: Columnas de aprobación en facility_reservations
-- ============================================================================
ALTER TABLE public.facility_reservations
  ADD COLUMN IF NOT EXISTS approved_by uuid;

ALTER TABLE public.facility_reservations
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'facility_reservations_approved_by_fkey'
  ) THEN
    ALTER TABLE public.facility_reservations
      ADD CONSTRAINT facility_reservations_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'facility_reservations approved_by FK: %', SQLERRM;
END $$;

-- ============================================================================
-- 7. IMPORTANTE: Índices faltantes para queries frecuentes
-- ============================================================================

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);

-- Enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_program_id ON public.enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_child_id ON public.attendance(child_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.attendance(class_date);

-- Academic Progress
CREATE INDEX IF NOT EXISTS idx_academic_progress_child_id ON public.academic_progress(child_id);
CREATE INDEX IF NOT EXISTS idx_academic_progress_coach_id ON public.academic_progress(coach_id);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_creator_id ON public.events(creator_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON public.event_registrations(event_id);

-- Messages & Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);

-- Calendar
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON public.calendar_events(start_time);

-- Reviews & Products
CREATE INDEX IF NOT EXISTS idx_reviews_school_id ON public.reviews(school_id);
CREATE INDEX IF NOT EXISTS idx_products_school_id ON public.products(school_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- Teams & Training
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_profile_id ON public.team_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_team_id ON public.training_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_team_id ON public.training_plans(team_id);
CREATE INDEX IF NOT EXISTS idx_training_logs_athlete_id ON public.training_logs(athlete_id);
CREATE INDEX IF NOT EXISTS idx_match_results_team_id ON public.match_results(team_id);

-- Session Attendance
CREATE INDEX IF NOT EXISTS idx_session_attendance_session_id ON public.session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attendance_player_id ON public.session_attendance(player_id);

-- Wellness
CREATE INDEX IF NOT EXISTS idx_wellness_appointments_professional_id ON public.wellness_appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_wellness_appointments_athlete_id ON public.wellness_appointments(athlete_id);
CREATE INDEX IF NOT EXISTS idx_wellness_appointments_date ON public.wellness_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_health_records_athlete_id ON public.health_records(athlete_id);
CREATE INDEX IF NOT EXISTS idx_health_records_professional_id ON public.health_records(professional_id);

-- Facility Reservations
CREATE INDEX IF NOT EXISTS idx_facility_reservations_facility_id ON public.facility_reservations(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_reservations_reservation_date ON public.facility_reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_facility_reservations_status ON public.facility_reservations(status);

-- School Staff
CREATE INDEX IF NOT EXISTS idx_school_staff_school_id ON public.school_staff(school_id);

-- Announcements
CREATE INDEX IF NOT EXISTS idx_announcements_coach_id ON public.announcements(coach_id);
CREATE INDEX IF NOT EXISTS idx_announcements_team_id ON public.announcements(team_id);

-- Analytics & Contact
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);

-- ============================================================================
-- 8. TRIGGER: Sincronizar teams.current_students automáticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_team_student_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar conteo del equipo anterior (si cambió)
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
    IF OLD.team_id IS NOT NULL THEN
      UPDATE public.teams
      SET current_students = (SELECT count(*) FROM public.children WHERE team_id = OLD.team_id)
      WHERE id = OLD.team_id;
    END IF;
  END IF;

  -- Actualizar conteo del equipo nuevo
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
    IF NEW.team_id IS NOT NULL THEN
      UPDATE public.teams
      SET current_students = (SELECT count(*) FROM public.children WHERE team_id = NEW.team_id)
      WHERE id = NEW.team_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_team_students ON public.children;
CREATE TRIGGER trg_sync_team_students
  AFTER INSERT OR UPDATE OF team_id OR DELETE
  ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_team_student_count();

-- ============================================================================
-- 9. TRIGGER: Sincronizar programs.current_participants
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_program_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.program_id IS DISTINCT FROM NEW.program_id) THEN
    IF OLD.program_id IS NOT NULL THEN
      UPDATE public.programs
      SET current_participants = (SELECT count(*) FROM public.children WHERE program_id = OLD.program_id)
      WHERE id = OLD.program_id;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.program_id IS DISTINCT FROM NEW.program_id) THEN
    IF NEW.program_id IS NOT NULL THEN
      UPDATE public.programs
      SET current_participants = (SELECT count(*) FROM public.children WHERE program_id = NEW.program_id)
      WHERE id = NEW.program_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_program_participants ON public.children;
CREATE TRIGGER trg_sync_program_participants
  AFTER INSERT OR UPDATE OF program_id OR DELETE
  ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_program_participant_count();

-- ============================================================================
-- 10. RESUMEN DE CONTEO FINAL
-- ============================================================================
DO $$
DECLARE
  fk_count integer;
  idx_count integer;
  check_count integer;
  trigger_count integer;
BEGIN
  SELECT count(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

  SELECT count(*) INTO idx_count
  FROM pg_indexes WHERE schemaname = 'public';

  SELECT count(*) INTO check_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'CHECK' AND table_schema = 'public';

  SELECT count(*) INTO trigger_count
  FROM information_schema.triggers WHERE trigger_schema = 'public';

  RAISE NOTICE '=== SCHEMA AUDIT COMPLETE ===';
  RAISE NOTICE 'Foreign Keys: %', fk_count;
  RAISE NOTICE 'Indexes: %', idx_count;
  RAISE NOTICE 'CHECK constraints: %', check_count;
  RAISE NOTICE 'Triggers: %', trigger_count;
END $$;

-- ============================================================================
-- FIN DE MIGRACIÓN FINAL
-- ============================================================================
