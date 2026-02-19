-- Add invitation_code column to profiles table
-- Date: 2026-02-16
-- Description: Adds invitation_code to profiles table and updates public_profiles view

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'invitation_code') THEN
    ALTER TABLE public.profiles ADD COLUMN invitation_code TEXT;
  END IF;
END $$;

-- Update the view to include new column
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT
  id,
  full_name,
  avatar_url,
  role,
  bio,
  date_of_birth,
  sportmaps_points,
  subscription_tier,
  invitation_code
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
