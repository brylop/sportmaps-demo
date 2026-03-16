-- =============================================================================
-- ROLLBACK PREVENTIVO: Revertir Transición Segura de Programs a Teams
-- Enfoque: Deshacer Sincronización Bidireccional por Triggers
-- Fecha: 2026-02-26
-- =============================================================================

BEGIN;

--------------------------------------------------------------------------------
-- 1. RESTAURAR LA VISTA STUDENTS AL ESTADO PREVIO (A la migración corregida)
--------------------------------------------------------------------------------

DROP VIEW IF EXISTS public.students;

CREATE VIEW public.students AS
SELECT
  c.id,
  c.full_name,
  c.date_of_birth,
  c.avatar_url,
  c.school_id,
  c.branch_id,
  c.parent_id,
  c.program_id,
  c.team_id,
  c.grade,
  c.medical_info,
  c.emergency_contact,
  c.created_at,
  c.updated_at,
  p.full_name   AS parent_name,
  p.phone       AS parent_phone,
  p.avatar_url  AS parent_avatar,
  p.email       AS parent_email,
  e.id          AS enrollment_id,
  e.status      AS enrollment_status,
  e.start_date  AS enrollment_date,
  -- Antes de la migración nueva, esto apuntaba solo a program_id y child's team_id
  t.name          AS program_name,
  t.sport         AS program_sport,
  0.0             AS price_monthly,
  b.name          AS branch_name
FROM public.children c
LEFT JOIN public.profiles        p  ON p.id = c.parent_id
LEFT JOIN public.enrollments     e  ON e.child_id = c.id AND e.status = 'active'
-- En el estado anterior, la cadena de fallback era más simple (sin e.team_id)
LEFT JOIN public.teams           t  ON t.id = COALESCE(e.program_id, c.team_id)
LEFT JOIN public.school_branches b  ON b.id = c.branch_id;

ALTER VIEW public.students SET (security_invoker = true);

COMMENT ON VIEW public.students IS
  'Vista enriquecida de estudiantes. Revertida del cambio bidireccional.';


--------------------------------------------------------------------------------
-- 2. ELIMINAR TRIGGERS Y FUNCIONES
--------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_sync_enrollments_team ON public.enrollments;
DROP TRIGGER IF EXISTS trg_sync_attendance_team ON public.attendance_records;
DROP FUNCTION IF EXISTS public.sync_program_team_id();


--------------------------------------------------------------------------------
-- 3. ELIMINAR ÍNDICES Y COLUMNAS
--------------------------------------------------------------------------------

-- Enrollment
DROP INDEX IF EXISTS public.idx_enrollments_team_id;
ALTER TABLE public.enrollments DROP COLUMN IF EXISTS team_id;

-- Attendance Records
DROP INDEX IF EXISTS public.idx_attendance_records_team_id;
ALTER TABLE public.attendance_records DROP COLUMN IF EXISTS team_id;

COMMIT;

-- =============================================================================
-- VERIFICACIÓN FINAL (fuera de transacción — estado real post-commit)
-- =============================================================================

-- 1. Confirmar que la columna fue eliminada (no debe regresar el nombre team_id)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('enrollments', 'attendance_records') AND column_name = 'team_id';
