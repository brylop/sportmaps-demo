-- Add missing columns to profiles table to match frontend requirements
-- Date: 2026-02-16
-- Description: Adds date_of_birth, sportmaps_points, subscription_tier, and invitation_code to profiles table

DO $$ 
BEGIN
  -- Add date_of_birth
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'date_of_birth') THEN
    ALTER TABLE public.profiles ADD COLUMN date_of_birth DATE;
  END IF;

  -- Add sportmaps_points
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'sportmaps_points') THEN
    ALTER TABLE public.profiles ADD COLUMN sportmaps_points INTEGER DEFAULT 0;
  END IF;

  -- Add subscription_tier
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_tier') THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium'));
  END IF;

  -- Add invitation_code
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'invitation_code') THEN
    ALTER TABLE public.profiles ADD COLUMN invitation_code TEXT;
  END IF;
END $$;

-- Update the view to include new columns
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
