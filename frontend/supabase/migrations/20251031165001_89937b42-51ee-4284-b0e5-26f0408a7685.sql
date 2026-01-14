-- Remove the policy that exposes other users' data
-- Users should ONLY be able to view their own profile data
DROP POLICY IF EXISTS "Users can view basic public info of others" ON spm_users;

-- Now the only SELECT policy is "Users can view own profile"
-- This ensures that email, phone, and other sensitive data is only accessible to the owner

-- If the application needs to show user names/avatars in team lists, messages, etc.,
-- those features should use a server-side function or separate public_profiles approach