-- Migration for Multi-sede Roles (HU-0.12)
-- Description: Enhances school_members and staff linkage to support branch-level administration

-- 1. Add branch_id to school_members to support branch-level admins
ALTER TABLE public.school_members 
ADD COLUMN branch_id UUID REFERENCES public.school_branches(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.school_members.branch_id IS 'If set, the member''s scope is restricted to this specific branch (sede). If NULL, scope is school-wide.';

-- 2. Ensure RLS policies respect branch_id for branch admins
-- This is a placeholder since RLS depends on the specific table, 
-- but we should ensure profiles and staff are visible only to relevant admins.

-- 3. Update public_profiles view (if needed) - we already updated it with other fields.

-- 4. Create a function to check if a user is an admin for a specific branch
CREATE OR REPLACE FUNCTION public.is_branch_admin(user_id UUID, target_branch_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.school_members
    WHERE profile_id = user_id
    AND (branch_id = target_branch_id OR branch_id IS NULL)
    AND role IN ('admin', 'owner')
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
