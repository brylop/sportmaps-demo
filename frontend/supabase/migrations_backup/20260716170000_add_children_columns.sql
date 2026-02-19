-- Add missing columns to children table for feature parity with legacy MongoDB schema
ALTER TABLE public.children 
ADD COLUMN IF NOT EXISTS grade TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
