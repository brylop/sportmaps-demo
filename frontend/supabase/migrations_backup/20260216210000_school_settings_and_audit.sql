-- Migration for Multi-branch Operations (HU-0.12, HU-0.4, HU-5.4)
-- Description: Sets up school_settings and refines relationships for branch-level control

-- 1. Create school_settings table for school-wide but configurable rules
CREATE TABLE IF NOT EXISTS public.school_settings (
    school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    responsible_payment_policy TEXT DEFAULT 'primary_acudiente' CHECK (responsible_payment_policy IN ('primary_acudiente', 'any_acudiente', 'student')),
    payment_grace_days INTEGER DEFAULT 5,
    payment_cutoff_day INTEGER DEFAULT 10,
    allow_multiple_enrollments BOOLEAN DEFAULT FALSE,
    coach_can_send_reminders BOOLEAN DEFAULT FALSE,
    coach_can_request_reminders BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add branch_id to programs (E-2 Operación: Staff y grupos)
-- This allows teams/groups to be associated with a specific sede
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'programs' AND column_name = 'branch_id') THEN
    ALTER TABLE public.programs ADD COLUMN branch_id UUID REFERENCES public.school_branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Update public_profiles view to include role information for easier RLS/filtering
-- (Actually public_profiles is already updated, but let's ensure it has all we need)

-- 4. Audit Log for sensitive changes (HU-0.6)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id),
    table_name TEXT,
    record_id TEXT,
    action TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Trigger for school_settings update audit
CREATE OR REPLACE FUNCTION public.audit_school_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
  VALUES (OLD.school_id, auth.uid(), 'school_settings', OLD.school_id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_school_settings ON public.school_settings;
CREATE TRIGGER tr_audit_school_settings
AFTER UPDATE ON public.school_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_school_settings_changes();

-- 6. Ensure every school has a default settings object
INSERT INTO public.school_settings (school_id)
SELECT id FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

-- 7. Add Unique constraint for students (HU-3.1)
-- Requires doc_type and doc_number columns which might be missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'doc_type') THEN
    ALTER TABLE public.children ADD COLUMN doc_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'doc_number') THEN
    ALTER TABLE public.children ADD COLUMN doc_number TEXT;
  END IF;
END $$;

-- Add checking constraint for uniqueness within same school
-- DROP INDEX IF EXISTS idx_student_unique_identity;
-- CREATE UNIQUE INDEX idx_student_unique_identity ON public.children (school_id, doc_type, doc_number);
-- Note: We only add this if we are sure there are no duplicates already
-- For now, let's just make sure columns exist.
