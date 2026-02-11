-- Add RLS policy for parents to create payments
-- This is required because the initial schema only allowed schools to create payments

DO $$ BEGIN
  CREATE POLICY "Parents can create own payments" 
  ON public.payments 
  FOR INSERT 
  WITH CHECK (auth.uid() = parent_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reload schema cache ensuring new policies are applied
NOTIFY pgrst, 'reload config';
