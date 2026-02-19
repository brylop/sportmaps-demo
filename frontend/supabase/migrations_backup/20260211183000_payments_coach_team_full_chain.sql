-- ============================================================================
-- MIGRACIÓN COMPLEMENTARIA: Completar flujo Padre→Hijo→Equipo→Coach→Escuela
-- Fecha: 2026-02-11
--
-- Agrega a payments: coach_id, team_id, program_id, branch_id
-- para que cada pago refleje toda la cadena:
--   Parent → Child → Team (Coach) → Program → Branch → School → Facility
-- ============================================================================

-- ============================================================================
-- 1. PAYMENTS: agregar coach_id (entrenador del grupo)
-- ============================================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS coach_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_coach_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_coach_id_fkey
      FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 2. PAYMENTS: agregar team_id (equipo al que pertenece el hijo)
-- ============================================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS team_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_team_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. PAYMENTS: agregar program_id (programa al que está inscrito)
-- ============================================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS program_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_program_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_program_id_fkey
      FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. PAYMENTS: agregar branch_id (sede donde entrena el hijo)
-- ============================================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS branch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_branch_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.school_branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 5. TEAMS: asegurar que coach_id tenga FK real
-- ============================================================================
-- teams.coach_id ya existe pero verificar FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'teams_coach_id_fkey'
      AND table_name = 'teams'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_coach_id_fkey
      FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. TEAMS: agregar program_id para vincular equipo → programa
-- ============================================================================
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS program_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'teams_program_id_fkey'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_program_id_fkey
      FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 7. TEAMS: agregar max_students y current_students
-- ============================================================================
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS max_students integer DEFAULT 20;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS current_students integer DEFAULT 0;

-- ============================================================================
-- 8. INDEXES para las nuevas columnas de payments
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payments_coach_id ON public.payments(coach_id);
CREATE INDEX IF NOT EXISTS idx_payments_team_id ON public.payments(team_id);
CREATE INDEX IF NOT EXISTS idx_payments_program_id ON public.payments(program_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON public.payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_teams_program_id ON public.teams(program_id);

-- ============================================================================
-- 9. VISTA: resumen completo de pago con toda la cadena
--    Padre → Hijo → Equipo → Coach → Programa → Sede → Escuela
-- ============================================================================
CREATE OR REPLACE VIEW public.payments_full_view AS
SELECT
  pay.id              AS payment_id,
  pay.amount,
  pay.concept,
  pay.status          AS payment_status,
  pay.payment_method,
  pay.due_date,
  pay.payment_date,
  pay.receipt_url,
  pay.created_at      AS payment_created_at,
  -- Padre
  pay.parent_id,
  parent_profile.full_name  AS parent_name,
  parent_profile.phone      AS parent_phone,
  -- Hijo
  pay.child_id,
  ch.full_name        AS child_name,
  ch.date_of_birth    AS child_dob,
  ch.monthly_fee      AS child_monthly_fee,
  -- Equipo
  pay.team_id,
  t.name              AS team_name,
  t.sport             AS team_sport,
  t.age_group         AS team_age_group,
  -- Coach
  pay.coach_id,
  coach_profile.full_name   AS coach_name,
  -- Programa
  pay.program_id,
  prog.name           AS program_name,
  prog.price_monthly  AS program_price,
  prog.level          AS program_level,
  -- Sede
  pay.branch_id,
  br.name             AS branch_name,
  br.address          AS branch_address,
  -- Escuela
  pay.school_id,
  sch.name            AS school_name
FROM public.payments pay
LEFT JOIN public.profiles parent_profile ON parent_profile.id = pay.parent_id
LEFT JOIN public.children ch ON ch.id = pay.child_id
LEFT JOIN public.teams t ON t.id = pay.team_id
LEFT JOIN public.profiles coach_profile ON coach_profile.id = pay.coach_id
LEFT JOIN public.programs prog ON prog.id = pay.program_id
LEFT JOIN public.school_branches br ON br.id = pay.branch_id
LEFT JOIN public.schools sch ON sch.id = pay.school_id;

-- ============================================================================
-- 10. VISTA: resumen de equipo con coach y estudiantes
-- ============================================================================
CREATE OR REPLACE VIEW public.teams_full_view AS
SELECT
  t.id              AS team_id,
  t.name            AS team_name,
  t.sport,
  t.age_group,
  t.max_students,
  t.current_students,
  -- Coach
  t.coach_id,
  cp.full_name      AS coach_name,
  -- Programa
  t.program_id,
  prog.name         AS program_name,
  prog.price_monthly,
  -- Sede
  t.branch_id,
  br.name           AS branch_name,
  -- Escuela
  t.school_id,
  sch.name          AS school_name,
  -- Conteo real de hijos en el equipo
  (SELECT count(*) FROM public.children c WHERE c.team_id = t.id) AS actual_students
FROM public.teams t
LEFT JOIN public.profiles cp ON cp.id = t.coach_id
LEFT JOIN public.programs prog ON prog.id = t.program_id
LEFT JOIN public.school_branches br ON br.id = t.branch_id
LEFT JOIN public.schools sch ON sch.id = t.school_id;

-- ============================================================================
-- FIN
-- ============================================================================
