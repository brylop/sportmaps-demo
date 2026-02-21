-- Add onboarding_started column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_started boolean DEFAULT false;
