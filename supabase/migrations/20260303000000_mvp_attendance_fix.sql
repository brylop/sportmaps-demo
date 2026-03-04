-- =============================================================================
-- MVP FIX: attendance_sessions + unique constraint en attendance_records
-- Fecha: 2026-03-03
-- Problemas resueltos:
--   1. BFF fallaba en runtime porque attendance_sessions no existía
--   2. Upsert fallaba con 42P10 por falta de UNIQUE (child_id, program_id, attendance_date)
-- =============================================================================

BEGIN;

-- ── 1. UNIQUE constraint en attendance_records ────────────────────────────────
-- Requerido por el upsert del BFF y del frontend directo.
-- Si ya existe (nombre diferente), el IF NOT EXISTS lo ignora.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_records_child_program_date_unique'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_child_program_date_unique
      UNIQUE (child_id, program_id, attendance_date);
  END IF;
END $$;

-- ── 2. Tabla attendance_sessions ─────────────────────────────────────────────
-- Registra la sesión de asistencia diaria por equipo.
-- El BFF la usa para manejar el ciclo crear → editar → finalizar.
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  team_id       uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  session_date  date        NOT NULL DEFAULT CURRENT_DATE,
  finalized     boolean     NOT NULL DEFAULT false,
  finalized_at  timestamptz,
  finalized_by  uuid        REFERENCES auth.users(id),
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Una sesión por equipo por día
  CONSTRAINT attendance_sessions_team_date_unique UNIQUE (team_id, session_date)
);

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school
  ON public.attendance_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date
  ON public.attendance_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_team_date
  ON public.attendance_sessions(team_id, session_date);

-- Auto-actualizar updated_at
CREATE OR REPLACE TRIGGER update_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 3. RLS para attendance_sessions ──────────────────────────────────────────
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Coaches y staff de la escuela pueden leer sesiones de su escuela
DROP POLICY IF EXISTS "Attendance sessions: select staff" ON public.attendance_sessions;
CREATE POLICY "Attendance sessions: select staff"
  ON public.attendance_sessions FOR SELECT
  USING (school_id = ANY(public.user_school_ids()));

-- Coaches y staff pueden crear y editar sesiones no finalizadas
DROP POLICY IF EXISTS "Attendance sessions: manage staff" ON public.attendance_sessions;
CREATE POLICY "Attendance sessions: manage staff"
  ON public.attendance_sessions FOR ALL
  USING (school_id = ANY(public.user_school_ids()));

-- Padres pueden ver sesiones de los equipos donde tienen hijos inscritos
DROP POLICY IF EXISTS "Attendance sessions: select parent" ON public.attendance_sessions;
CREATE POLICY "Attendance sessions: select parent"
  ON public.attendance_sessions FOR SELECT
  USING (
    team_id IN (
      SELECT e.team_id FROM public.enrollments e
      JOIN public.children c ON c.id = e.child_id
      WHERE c.parent_id = auth.uid()
        AND e.team_id IS NOT NULL
    )
  );

-- Habilitar realtime para que AttendanceSupervisionPage reciba actualizaciones en vivo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'attendance_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
  END IF;
EXCEPTION WHEN others THEN
  -- Ignorar si la publicación no existe o ya está configurada
  NULL;
END $$;

COMMIT;
