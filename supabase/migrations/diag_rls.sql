-- DIAGNOSTIC SQL
-- Run this in Supabase SQL Editor to see current RLS state and policies

SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename IN ('school_members', 'schools', 'profiles', 'invitations')
ORDER BY tablename, cmd;

-- Check if FORCE RLS is on
SELECT 
    relname as table_name, 
    relrowsecurity as rls_enabled, 
    relforcerowsecurity as force_rls_enabled 
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND c.relname IN ('school_members', 'schools', 'profiles', 'invitations');
