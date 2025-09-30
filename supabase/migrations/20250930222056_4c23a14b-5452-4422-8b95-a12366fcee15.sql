-- Fix critical security issue: Restrict profiles table access
-- Users should only be able to view their own profile, not all profiles

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a restrictive policy: users can only view their own profile
CREATE POLICY "Users can view own profile only" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Note: This change ensures that personal information (full_name, phone, date_of_birth)
-- is only accessible to the profile owner, preventing unauthorized access to PII.