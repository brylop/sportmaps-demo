-- Add payment_method column to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('pse', 'card', 'transfer', 'cash', 'other'));

-- Update existing records to have a default value if needed
UPDATE public.payments SET payment_method = 'other' WHERE payment_method IS NULL;

-- Not Null constraint (optional, but good for data integrity)
-- ALTER TABLE public.payments ALTER COLUMN payment_method SET NOT NULL;
