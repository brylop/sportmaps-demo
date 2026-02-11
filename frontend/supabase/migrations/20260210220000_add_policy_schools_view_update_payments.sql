-- Enable Schools to view their own received payments
CREATE POLICY "Schools can view received payments"
ON public.payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.schools
    WHERE schools.id = payments.school_id
    AND schools.owner_id = auth.uid()
  )
);

-- Enable Schools to update/approve payments
CREATE POLICY "Schools can update received payments"
ON public.payments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.schools
    WHERE schools.id = payments.school_id
    AND schools.owner_id = auth.uid()
  )
);

-- Reload schema cache automatically
NOTIFY pgrst, 'reload config';
