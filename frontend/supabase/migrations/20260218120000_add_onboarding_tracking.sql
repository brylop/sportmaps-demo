-- Add onboarding_completed column to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE public.profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Update RLS policies to ensure users can update their own onboarding status
-- (Existing policies for UPDATE usually allow users to update their own profile, but checking is good practice)
-- CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Function to complete onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET onboarding_completed = TRUE
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
