-- Migration for Onboarding State Machine (HU-0.2)
-- Description: Adds onboarding state tracking to schools table

-- 1. Add onboarding_status and onboarding_step to schools
ALTER TABLE public.schools 
ADD COLUMN onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed')),
ADD COLUMN onboarding_step INTEGER DEFAULT 1;

COMMENT ON COLUMN public.schools.onboarding_status IS 'Tracks the overall onboarding progress of the school (hard gate).';
COMMENT ON COLUMN public.schools.onboarding_step IS 'Specific step the user is on during the onboarding tour.';

-- 2. Update existing schools to 'completed' so they don't get blocked
UPDATE public.schools SET onboarding_status = 'completed';
