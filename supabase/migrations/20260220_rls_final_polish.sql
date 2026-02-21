-- Migration: RLS Final Polish & Fixes
-- Description: Ensures Owners and Branch Admins can insert programs and invitations without RLS violations.

-- 1. Programs INSERT Policy
DROP POLICY IF EXISTS "School admin branch isolation insert" ON public.programs;
CREATE POLICY "School admin branch isolation insert" ON public.programs
FOR INSERT WITH CHECK (
    school_id IN (SELECT public.get_my_administered_school_ids())
);

-- 2. Invitations RLS Fixes
DROP POLICY IF EXISTS "Invitations manage policy" ON public.invitations;
CREATE POLICY "Invitations manage policy" ON public.invitations
FOR ALL USING (
    school_id IN (SELECT public.get_my_administered_school_ids())
);

-- 3. Ensure get_onboarding_status handles date_of_birth check correctly
-- (This is already mostly correct, but ensuring it's comprehensive)
CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_school_id uuid;
  v_result jsonb;
BEGIN
  -- Get user profile info
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  
  -- Get the school_id if they are a member (priority to active school)
  SELECT school_id INTO v_school_id 
  FROM public.school_members 
  WHERE profile_id = v_user_id 
  ORDER BY status = 'active' DESC, created_at DESC 
  LIMIT 1;

  SELECT jsonb_build_object(
    -- Global Profile Validation
    'profile_complete', (SELECT (full_name IS NOT NULL AND phone IS NOT NULL AND date_of_birth IS NOT NULL) FROM public.profiles WHERE id = v_user_id),
    'has_dob', (SELECT (date_of_birth IS NOT NULL) FROM public.profiles WHERE id = v_user_id),
    
    -- School/Owner Validations
    'has_school', (SELECT EXISTS(SELECT 1 FROM public.schools WHERE owner_id = v_user_id)),
    'has_branches', (SELECT EXISTS(SELECT 1 FROM public.branches WHERE school_id = v_school_id)),
    'branches_count', (SELECT count(*) FROM public.branches WHERE school_id = v_school_id),
    'has_programs', (SELECT EXISTS(SELECT 1 FROM public.programs WHERE school_id = v_school_id)),
    'has_staff', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE school_id = v_school_id AND role IN ('coach', 'staff', 'admin'))),
    
    -- Parent/Athlete Validations
    'has_children', (SELECT EXISTS(SELECT 1 FROM public.children WHERE parent_id = v_user_id)),
    'has_accepted_invite', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'active')),
    'has_medical_records', (SELECT EXISTS(SELECT 1 FROM public.children c WHERE c.parent_id = v_user_id AND c.medical_info IS NOT NULL)),
    
    -- Context Info
    'role', v_role,
    'school_id', v_school_id
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
