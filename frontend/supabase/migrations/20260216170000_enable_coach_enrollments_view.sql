-- Enable Coaches to view school enrollments
-- This is necessary for coaches to access student details including payment status and program info.

-- Drop existing policy if it conflicts or just create new one
DROP POLICY IF EXISTS "Coaches can view school enrollments" ON public.enrollments;

CREATE POLICY "Coaches can view school enrollments"
ON public.enrollments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.profile_id = auth.uid()
      AND sm.school_id = enrollments.school_id
      AND sm.role IN ('coach', 'staff', 'admin', 'owner')
      AND sm.status = 'active'
    )
);

-- Additionally, ensure Coaches can view PROGRAMS of their school, even if inactive (e.g. past programs)
-- The existing policy "School admins can view all school programs" only covers admins.
-- We might want coaches to see them too.

DROP POLICY IF EXISTS "Coaches can view school programs" ON public.programs;

CREATE POLICY "Coaches can view school programs"
ON public.programs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.profile_id = auth.uid()
      AND sm.school_id = programs.school_id
      AND sm.role IN ('coach', 'staff', 'admin', 'owner')
      AND sm.status = 'active'
    )
);
