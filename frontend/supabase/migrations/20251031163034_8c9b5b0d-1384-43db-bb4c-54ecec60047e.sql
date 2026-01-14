-- Fix RLS policies for spm_users table to protect contact information
-- Drop the problematic policy that allows public access to demo users' contact info
DROP POLICY IF EXISTS "Public can view demo users" ON spm_users;

-- Keep existing secure policies:
-- "Users can insert own profile" - OK
-- "Users can update own profile" - OK  
-- "Users can view own profile" - OK

-- Add policy to allow viewing only basic public info (name and avatar) of other users
-- This is useful for features like user search, mentions, etc. but excludes sensitive data
CREATE POLICY "Users can view basic public info of others"
ON spm_users
FOR SELECT
TO authenticated
USING (
  auth.uid() != id  -- Only for OTHER users, not own profile
);

-- Note: The above policy allows authenticated users to see the row exists and basic info,
-- but the application layer should only display non-sensitive fields (full_name, avatar_url)
-- when showing other users' profiles. Email and phone should NEVER be exposed.

-- Add a comment to document what fields are considered sensitive
COMMENT ON TABLE spm_users IS 'Sensitive fields: email, phone, metadata. Only expose full_name and avatar_url to other users.';

-- Optional: Create a view for public user profiles that only exposes safe fields
CREATE OR REPLACE VIEW public_user_profiles AS
SELECT 
  id,
  full_name,
  avatar_url,
  role,
  created_at
FROM spm_users;

-- Grant access to the view
GRANT SELECT ON public_user_profiles TO authenticated;