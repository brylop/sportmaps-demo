-- Add latitude and longitude columns to schools table for map functionality
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Update existing demo schools with Bogotá coordinates
UPDATE public.schools 
SET latitude = 4.6097 + (random() * 0.1 - 0.05),
    longitude = -74.0817 + (random() * 0.1 - 0.05)
WHERE latitude IS NULL;