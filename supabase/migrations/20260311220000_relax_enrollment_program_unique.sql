-- Relax enrollment_child_program_unique to allow multiple records but only one active
-- This prevents 409 Conflict errors when re-enrolling a child in a program after a previous enrollment was cancelled.

ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_child_program_unique;

CREATE UNIQUE INDEX IF NOT EXISTS enrollment_child_program_active_unique 
ON public.enrollments (child_id, program_id) 
WHERE (status = 'active' AND child_id IS NOT NULL);
