-- Add school_id to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.profiles(id);

-- Add payment_method column if not exists (checked schema, seems missing or named payment_type?)
-- Schema said: payment_type text? No, schema in 20251030... has 'concept', 'amount', etc.
-- Let's check MyPaymentsPage: it uses 'payment_method' in some places and 'payment_type' in others.
-- The modal sets 'payment_method' in API call.
-- Let's assume we need 'payment_method' column too just in case.
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Update RLS to allow Schools to view payments directed to them
DO $$ BEGIN
  CREATE POLICY "Schools can view received payments" 
  ON public.payments FOR SELECT 
  USING (auth.uid() = school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update RLS to allow Schools to update payments (approve/reject)
DO $$ BEGIN
  CREATE POLICY "Schools can update received payments" 
  ON public.payments FOR UPDATE
  USING (auth.uid() = school_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
