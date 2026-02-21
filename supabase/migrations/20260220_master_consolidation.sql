-- Migration: Master Consolidation (Branches, Invitations, Status)
-- Description: Automates branch creation, updates invitations, and refines onboarding status logic.

-- 1. Automate "Sede Principal" creation
-- We update the existing handle_new_school function to include branch creation
CREATE OR REPLACE FUNCTION public.handle_new_school()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_branch_id uuid;
BEGIN
  -- Insert settings
  INSERT INTO public.school_settings (school_id)
  VALUES (NEW.id)
  ON CONFLICT (school_id) DO NOTHING;

  -- Create Default Main Branch if it doesn't exist
  INSERT INTO public.school_branches (school_id, name, is_main, status)
  VALUES (NEW.id, 'Sede Principal', true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_branch_id;

  -- Add owner as member
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.school_members (school_id, profile_id, role, status, branch_id)
    VALUES (NEW.id, NEW.owner_id, 'owner', 'active', v_branch_id)
    ON CONFLICT (school_id, profile_id) 
    DO UPDATE SET branch_id = EXCLUDED.branch_id WHERE school_members.branch_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Update Invitations table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invitations' AND column_name = 'branch_id') THEN
        ALTER TABLE public.invitations ADD COLUMN branch_id uuid REFERENCES public.school_branches(id);
    END IF;
END $$;

-- 3. Update get_onboarding_status Function
-- This function provides the "Truth" for the Dashboard Checklist
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
    'profile_complete', (SELECT (full_name IS NOT NULL AND phone IS NOT NULL) FROM public.profiles WHERE id = v_user_id),
    
    -- School/Owner Validations
    'has_school', (SELECT EXISTS(SELECT 1 FROM public.schools WHERE owner_id = v_user_id)),
    'has_branches', (SELECT EXISTS(SELECT 1 FROM public.school_branches WHERE school_id = v_school_id)),
    'branches_count', (SELECT COUNT(*) FROM public.school_branches WHERE school_id = v_school_id),
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

-- 4. Branch Isolation & Security Definer Helpers
-- Helper to get branch associations without recursion
CREATE OR REPLACE FUNCTION auth.get_user_branch_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY_AGG(branch_id) FROM public.school_members WHERE profile_id = auth.uid() AND branch_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER;

-- Update RLS for branch isolation (Example for Programs)
DROP POLICY IF EXISTS "School admin branch isolation" ON public.programs;
CREATE POLICY "School admin branch isolation" ON public.programs
FOR ALL USING (
    (school_id = ANY(auth.user_school_ids()) AND branch_id IS NULL) -- Owner/Global Admin
    OR (branch_id = ANY(auth.get_user_branch_ids()))               -- Branch Admin
);

-- 5. Audit Log (Trigger/Function assumed to exist as per previous schema check)
-- Ensuring invitations create audit logs
CREATE OR REPLACE FUNCTION public.audit_invitations()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, metadata)
    VALUES (NEW.school_id, auth.uid(), 'invitations', NEW.id::text, TG_OP, jsonb_build_object('email', NEW.email, 'role', NEW.role_to_assign));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_invitations ON public.invitations;
CREATE TRIGGER trg_audit_invitations
AFTER INSERT OR UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.audit_invitations();
