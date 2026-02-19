-- ============================================================================
-- MIGRACIÓN INTEGRAL: Rediseño de relaciones del schema SportMaps
-- Fecha: 2026-02-11
-- 
-- Objetivos:
--   1. Agregar tabla school_branches (N sedes por escuela)
--   2. Vincular facilities → school_branches
--   3. Vincular children → schools, teams, parents (con FKs reales)
--   4. Agregar child_id a payments
--   5. Corregir TODAS las FKs faltantes en el schema
--   6. Limpiar tabla redundante spm_users
-- ============================================================================

-- ============================================================================
-- 1. TABLA: school_branches (N sedes por escuela)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.school_branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,                    -- "Sede Norte", "Sede Fontibón", "Sede La Granja"
  address text,
  city text,
  phone text,
  lat numeric,
  lng numeric,
  is_main boolean DEFAULT false,         -- Sede principal
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance')),
  capacity integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_branches_pkey PRIMARY KEY (id),
  CONSTRAINT school_branches_school_id_fkey FOREIGN KEY (school_id)
    REFERENCES public.schools(id) ON DELETE CASCADE
);

-- Índice para búsquedas rápidas por escuela
CREATE INDEX IF NOT EXISTS idx_school_branches_school_id ON public.school_branches(school_id);

-- ============================================================================
-- 2. FACILITIES: vincular a branch (sede) en vez de solo school
-- ============================================================================
ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS branch_id uuid;

-- FK de facilities → school_branches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'facilities_branch_id_fkey'
  ) THEN
    ALTER TABLE public.facilities
      ADD CONSTRAINT facilities_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. FACILITY_RESERVATIONS: agregar FKs faltantes
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'facility_reservations_user_id_fkey'
  ) THEN
    ALTER TABLE public.facility_reservations
      ADD CONSTRAINT facility_reservations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Agregar columna team_id para saber qué equipo reservó
ALTER TABLE public.facility_reservations
  ADD COLUMN IF NOT EXISTS team_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'facility_reservations_team_id_fkey'
  ) THEN
    ALTER TABLE public.facility_reservations
      ADD CONSTRAINT facility_reservations_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar columna de número de participantes
ALTER TABLE public.facility_reservations
  ADD COLUMN IF NOT EXISTS participants integer DEFAULT 0;

-- ============================================================================
-- 4. CHILDREN: agregar FKs reales + columnas faltantes
-- ============================================================================

-- FK parent_id → auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'children_parent_id_fkey'
  ) THEN
    ALTER TABLE public.children
      ADD CONSTRAINT children_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK school_id → schools
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'children_school_id_fkey'
  ) THEN
    ALTER TABLE public.children
      ADD CONSTRAINT children_school_id_fkey
      FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar branch_id (a qué sede va el niño)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS branch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'children_branch_id_fkey'
  ) THEN
    ALTER TABLE public.children
      ADD CONSTRAINT children_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar team_id (a qué equipo pertenece)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS team_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'children_team_id_fkey'
  ) THEN
    ALTER TABLE public.children
      ADD CONSTRAINT children_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar program_id (a qué programa está inscrito)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS program_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'children_program_id_fkey'
  ) THEN
    ALTER TABLE public.children
      ADD CONSTRAINT children_program_id_fkey
      FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar monthly_fee (mensualidad individual del niño)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS monthly_fee numeric DEFAULT 0;

-- ============================================================================
-- 5. PAYMENTS: agregar child_id + FKs reales
-- ============================================================================

-- Agregar child_id
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS child_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_child_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_child_id_fkey
      FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK parent_id → auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_parent_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 6. ACADEMIC_PROGRESS: agregar FKs faltantes
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'academic_progress_child_id_fkey'
  ) THEN
    ALTER TABLE public.academic_progress
      ADD CONSTRAINT academic_progress_child_id_fkey
      FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'academic_progress_coach_id_fkey'
  ) THEN
    ALTER TABLE public.academic_progress
      ADD CONSTRAINT academic_progress_coach_id_fkey
      FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 7. ANNOUNCEMENTS: agregar FKs faltantes
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'announcements_coach_id_fkey'
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_coach_id_fkey
      FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'announcements_team_id_fkey'
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 8. ATHLETE_STATS: agregar FK faltante
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'athlete_stats_athlete_id_fkey'
  ) THEN
    ALTER TABLE public.athlete_stats
      ADD CONSTRAINT athlete_stats_athlete_id_fkey
      FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 9. HEALTH_RECORDS: agregar FKs faltantes
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'health_records_athlete_id_fkey'
  ) THEN
    ALTER TABLE public.health_records
      ADD CONSTRAINT health_records_athlete_id_fkey
      FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'health_records_professional_id_fkey'
  ) THEN
    ALTER TABLE public.health_records
      ADD CONSTRAINT health_records_professional_id_fkey
      FOREIGN KEY (professional_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 10. TRAINING_PLANS: agregar FK faltante
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'training_plans_team_id_fkey'
  ) THEN
    ALTER TABLE public.training_plans
      ADD CONSTRAINT training_plans_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 11. SESSION_ATTENDANCE: agregar FKs faltantes
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'session_attendance_session_id_fkey'
  ) THEN
    ALTER TABLE public.session_attendance
      ADD CONSTRAINT session_attendance_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'session_attendance_player_id_fkey'
  ) THEN
    ALTER TABLE public.session_attendance
      ADD CONSTRAINT session_attendance_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 12. TRAINING_SESSIONS: agregar FK faltante
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'training_sessions_team_id_fkey'
  ) THEN
    ALTER TABLE public.training_sessions
      ADD CONSTRAINT training_sessions_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 13. WELLNESS_APPOINTMENTS: agregar FKs faltantes
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'wellness_appointments_professional_id_fkey'
  ) THEN
    ALTER TABLE public.wellness_appointments
      ADD CONSTRAINT wellness_appointments_professional_id_fkey
      FOREIGN KEY (professional_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'wellness_appointments_athlete_id_fkey'
  ) THEN
    ALTER TABLE public.wellness_appointments
      ADD CONSTRAINT wellness_appointments_athlete_id_fkey
      FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 14. TRAINING_LOGS: agregar FK faltante
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'training_logs_athlete_id_fkey'
  ) THEN
    ALTER TABLE public.training_logs
      ADD CONSTRAINT training_logs_athlete_id_fkey
      FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 15. TEAMS: vincular con school
-- ============================================================================
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS school_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'teams_school_id_fkey'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_school_id_fkey
      FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS branch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'teams_branch_id_fkey'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 16. SCHOOL_STAFF: agregar branch_id
-- ============================================================================
ALTER TABLE public.school_staff
  ADD COLUMN IF NOT EXISTS branch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'school_staff_branch_id_fkey'
  ) THEN
    ALTER TABLE public.school_staff
      ADD CONSTRAINT school_staff_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 17. RLS POLICIES para school_branches
-- ============================================================================
ALTER TABLE public.school_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School owners can manage their branches" ON public.school_branches;
CREATE POLICY "School owners can manage their branches"
  ON public.school_branches
  FOR ALL
  USING (
    school_id IN (SELECT id FROM public.schools WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can view branches" ON public.school_branches;
CREATE POLICY "Public can view branches"
  ON public.school_branches
  FOR SELECT
  USING (true);

-- ============================================================================
-- 18. SEED: Crear sedes demo para Spirit All Stars
-- ============================================================================
DO $$
DECLARE
  v_school_id uuid;
BEGIN
  -- Buscar la escuela demo
  SELECT id INTO v_school_id FROM public.schools WHERE name = 'Spirit All Stars' LIMIT 1;

  IF v_school_id IS NULL THEN
    SELECT id INTO v_school_id FROM public.schools WHERE is_demo = true LIMIT 1;
  END IF;

  IF v_school_id IS NOT NULL THEN
    -- Insertar sedes si no existen
    INSERT INTO public.school_branches (school_id, name, address, city, is_main, capacity)
    VALUES
      (v_school_id, 'Sede Norte', 'Calle 170 #45-20, Usaquén', 'Bogotá', true, 50),
      (v_school_id, 'Sede Fontibón', 'Cra 100 #22-15, Fontibón', 'Bogotá', false, 30),
      (v_school_id, 'Sede La Granja', 'Calle 80 #12-40, Engativá', 'Bogotá', false, 25)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 19. ÍNDICES para performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_children_parent_id ON public.children(parent_id);
CREATE INDEX IF NOT EXISTS idx_children_school_id ON public.children(school_id);
CREATE INDEX IF NOT EXISTS idx_children_team_id ON public.children(team_id);
CREATE INDEX IF NOT EXISTS idx_children_branch_id ON public.children(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_child_id ON public.payments(child_id);
CREATE INDEX IF NOT EXISTS idx_payments_parent_id ON public.payments(parent_id);
CREATE INDEX IF NOT EXISTS idx_payments_school_id ON public.payments(school_id);
CREATE INDEX IF NOT EXISTS idx_facilities_branch_id ON public.facilities(branch_id);
CREATE INDEX IF NOT EXISTS idx_facility_reservations_team_id ON public.facility_reservations(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_school_id ON public.teams(school_id);
CREATE INDEX IF NOT EXISTS idx_teams_branch_id ON public.teams(branch_id);

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
