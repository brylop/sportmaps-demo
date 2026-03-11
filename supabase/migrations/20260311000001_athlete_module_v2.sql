-- ============================================================
-- MIGRACIÓN: Módulo Atleta v2.0
-- Fecha: 2026-03-11
-- Descripción: Extiende profiles, crea tablas de reservas,
--              disponibilidad y pagos del atleta.
-- ============================================================

-- ─── 1. EXTENDER PROFILES ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS document_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(1) CHECK (gender IN ('M', 'F', 'X'));

-- Columna computada: categoría de edad automática
-- NOTA: Supabase no soporta GENERATED ALWAYS AS en ALTER TABLE.
-- Usamos un trigger en su lugar.
CREATE OR REPLACE FUNCTION compute_age_category(dob DATE)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  age_years INT;
BEGIN
  IF dob IS NULL THEN RETURN 'Open'; END IF;
  age_years := EXTRACT(YEAR FROM AGE(dob));
  RETURN CASE
    WHEN age_years BETWEEN 5 AND 6  THEN 'Tiny'
    WHEN age_years BETWEEN 7 AND 8  THEN 'Mini'
    WHEN age_years BETWEEN 9 AND 12 THEN 'Youth'
    WHEN age_years BETWEEN 13 AND 15 THEN 'Junior'
    WHEN age_years BETWEEN 16 AND 17 THEN 'Senior'
    ELSE 'Open'
  END;
END;
$$;

-- ─── 2. DISPONIBILIDAD DE ESCUELAS ──────────────────────────
CREATE TABLE IF NOT EXISTS school_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INT NOT NULL DEFAULT 20,
  instructor_id UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  exceptions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

ALTER TABLE school_availability ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver la disponibilidad (es información pública de la escuela)
CREATE POLICY "anyone_can_view_availability" ON school_availability
  FOR SELECT USING (true);

-- Solo admins de la escuela pueden modificar
CREATE POLICY "school_admins_manage_availability" ON school_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = school_availability.school_id
        AND s.owner_id = auth.uid()
    )
  );

-- ─── 3. RESERVAS DEL ATLETA ─────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id),
  availability_slot_id UUID REFERENCES school_availability(id),
  booking_type VARCHAR(20) NOT NULL CHECK (booking_type IN ('trial', 'session', 'program')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'trial_confirmed', 'cancelled', 'completed', 'no_show')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- El atleta solo ve sus propias reservas
CREATE POLICY "athlete_own_bookings_select" ON bookings
  FOR SELECT USING (athlete_id = auth.uid());

CREATE POLICY "athlete_own_bookings_insert" ON bookings
  FOR INSERT WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "athlete_own_bookings_update" ON bookings
  FOR UPDATE USING (athlete_id = auth.uid());

-- Coaches y admins de escuela pueden ver reservas de sus programas
CREATE POLICY "staff_view_bookings" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM programs p
      JOIN schools s ON s.id = p.school_id
      WHERE p.id = bookings.program_id
        AND (s.owner_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM programs p
      JOIN teams t ON t.school_id = p.school_id
      WHERE p.id = bookings.program_id
        AND t.coach_id = auth.uid()
    )
  );

-- ─── 4. HOLD TEMPORAL DE SLOTS ──────────────────────────────
CREATE TABLE IF NOT EXISTS booking_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  availability_slot_id UUID NOT NULL REFERENCES school_availability(id),
  scheduled_date DATE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE booking_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_own_holds" ON booking_holds
  FOR ALL USING (athlete_id = auth.uid());

-- ─── 5. PAGOS DEL ATLETA ────────────────────────────────────
CREATE TABLE IF NOT EXISTS athlete_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id),
  enrollment_id UUID REFERENCES enrollments(id),
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'refunded')),
  payment_method VARCHAR(50),
  payment_provider VARCHAR(20),
  provider_transaction_id VARCHAR(100),
  receipt_url TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE athlete_payments ENABLE ROW LEVEL SECURITY;

-- El atleta solo ve sus propios pagos
CREATE POLICY "athlete_own_payments_select" ON athlete_payments
  FOR SELECT USING (athlete_id = auth.uid());

CREATE POLICY "athlete_own_payments_insert" ON athlete_payments
  FOR INSERT WITH CHECK (athlete_id = auth.uid());

-- Admins de escuela pueden ver pagos relacionados a sus programas
CREATE POLICY "school_view_athlete_payments" ON athlete_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN programs p ON p.id = b.program_id
      JOIN schools s ON s.id = p.school_id
      WHERE b.id = athlete_payments.booking_id
        AND s.owner_id = auth.uid()
    )
  );

-- ─── 6. ÍNDICES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_athlete_id ON bookings(athlete_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at ON bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_booking_holds_expires ON booking_holds(expires_at);
CREATE INDEX IF NOT EXISTS idx_athlete_payments_athlete ON athlete_payments(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_payments_status ON athlete_payments(status);
CREATE INDEX IF NOT EXISTS idx_school_availability_school ON school_availability(school_id);
CREATE INDEX IF NOT EXISTS idx_school_availability_program ON school_availability(program_id);

-- ─── 7. FUNCIÓN: Limpiar holds expirados ─────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_holds()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM booking_holds WHERE expires_at < NOW();
END;
$$;

-- ─── 8. RPC: Obtener stats del dashboard del atleta ──────────
CREATE OR REPLACE FUNCTION get_athlete_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  uid UUID := auth.uid();
BEGIN
  SELECT json_build_object(
    'trainings_this_month', (
      SELECT COUNT(*) FROM training_logs
      WHERE athlete_id = uid
        AND training_date >= date_trunc('month', CURRENT_DATE)
    ),
    'current_level', (
      SELECT skill_level FROM academic_progress
      WHERE child_id = uid
      ORDER BY evaluation_date DESC LIMIT 1
    ),
    'next_session_days', (
      SELECT EXTRACT(DAY FROM (MIN(scheduled_at) - NOW()))::INT
      FROM bookings
      WHERE athlete_id = uid
        AND status IN ('confirmed', 'trial_confirmed')
        AND scheduled_at > NOW()
    ),
    'pending_payments_total', (
      SELECT COALESCE(SUM(amount_cents), 0) FROM athlete_payments
      WHERE athlete_id = uid AND status = 'pending'
    ),
    'active_enrollments', (
      SELECT COUNT(*) FROM enrollments
      WHERE user_id = uid AND status = 'active'
    ),
    'active_teams', (
      SELECT COUNT(*) FROM team_members
      WHERE profile_id = uid
    ),
    'age_category', compute_age_category(
      (SELECT date_of_birth::DATE FROM profiles WHERE id = uid)
    )
  ) INTO result;

  RETURN result;
END;
$$;
