-- Enable Coach financial visibility
-- Coaches need to see payment status of students in their schools/branches

DROP POLICY IF EXISTS "Coaches can view school payments" ON public.payments;

CREATE POLICY "Coaches can view school payments" ON public.payments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.profile_id = auth.uid()
      AND sm.school_id = payments.school_id
      AND sm.role IN ('coach', 'staff', 'admin', 'owner') -- Including admin/owner redundantly to be safe, though they have other policies
      AND sm.status = 'active'
    )
);
