-- Phase 2: SQL Reconciliation
-- Description: Corrects syntax in existing triggers and enhances onboarding validation.

-- 1. Correct Audit Trigger (Fixing the invalid IF call)
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger AS $$
DECLARE
  v_school_id uuid;
BEGIN
  BEGIN
    IF (TG_OP = 'DELETE') THEN v_school_id := OLD.school_id;
    ELSE v_school_id := NEW.school_id;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    v_school_id := NULL;
  END;

  INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, new_data)
  VALUES (v_school_id, auth.uid(), TG_TABLE_NAME, 
         (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::text, 
         TG_OP, to_jsonb(NEW));

  -- Standard PL/pgSQL return logic
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enhanced Onboarding Status (Supporting more fields for the checklist)
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
  
  -- Identify the school context
  SELECT school_id INTO v_school_id 
  FROM public.school_members 
  WHERE profile_id = v_user_id 
  ORDER BY status = 'active' DESC, joined_at DESC 
  LIMIT 1;

  SELECT jsonb_build_object(
    'has_school', (SELECT EXISTS(SELECT 1 FROM public.schools WHERE owner_id = v_user_id)),
    'has_branches', (SELECT EXISTS(SELECT 1 FROM public.branches b JOIN public.schools s ON b.school_id = s.id WHERE s.owner_id = v_user_id OR s.id = v_school_id)),
    'has_programs', (SELECT EXISTS(SELECT 1 FROM public.programs WHERE school_id = v_school_id)),
    'has_staff', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE school_id = v_school_id AND role IN ('coach', 'staff', 'admin'))),
    'has_children', (SELECT EXISTS(SELECT 1 FROM public.children WHERE parent_id = v_user_id)),
    'has_accepted_invite', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'active')),
    'has_medical_records', (SELECT EXISTS(SELECT 1 FROM public.children c WHERE c.parent_id = v_user_id AND c.medical_info IS NOT NULL)),
    'profile_complete', (SELECT (full_name IS NOT NULL AND phone IS NOT NULL) FROM public.profiles WHERE id = v_user_id),
    'role', v_role,
    'school_id', v_school_id
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Unify table naming (Optional: Alias school_branches to branches for compatibility if both exist)
-- DO $$ BEGIN
--   IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'school_branches') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'branches') THEN
--     ALTER TABLE school_branches RENAME TO branches;
--   END IF;
-- END $$;
