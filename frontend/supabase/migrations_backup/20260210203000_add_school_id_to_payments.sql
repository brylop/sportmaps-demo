-- Add school_id column to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_payments_school_id ON public.payments(school_id);

-- Reload schema cache automatically
NOTIFY pgrst, 'reload config';
