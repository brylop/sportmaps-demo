-- Migration: Add is_active to children and update students view

ALTER TABLE public.children ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

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
  c.is_active,
  CASE WHEN c.is_active THEN 'active' ELSE 'inactive' END AS status,
  -- Datos del padre
  p.full_name   AS parent_name,
  p.phone       AS parent_phone,
  p.avatar_url  AS parent_avatar,
  p.email       AS parent_email,
  -- Datos de inscripción activa
  e.id          AS enrollment_id,
  e.status      AS enrollment_status,
  e.start_date  AS enrollment_date,
  -- Datos del equipo
  t.name          AS program_name,
  t.sport         AS program_sport,
  0.0             AS price_monthly,
  b.name          AS branch_name
FROM public.children c
LEFT JOIN public.profiles        p  ON p.id = c.parent_id
LEFT JOIN public.enrollments     e  ON e.child_id = c.id AND e.status = 'active'
LEFT JOIN public.teams           t  ON t.id = COALESCE(e.team_id, e.program_id, c.team_id)
LEFT JOIN public.school_branches b  ON b.id = c.branch_id;

ALTER VIEW public.students SET (security_invoker = true);

COMMENT ON VIEW public.students IS
  'Vista enriquecida de estudiantes incluyendo el calculo de status basado en is_active.';
