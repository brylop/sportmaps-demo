-- Fix the security definer view issue
-- Drop the problematic view
DROP VIEW IF EXISTS public_user_profiles;

-- The RLS policies are sufficient - applications should query spm_users directly
-- and only select the fields they need (full_name, avatar_url, role) when showing other users