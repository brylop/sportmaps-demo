-- ==============================================================================
-- MASTER DEPLOYMENT SCRIPT: PRODUCTION READINESS & SECURITY HARDENING (FIXED V3)
-- Fecha: 2026-02-17
-- Autor: Antigravity AI Agent
-- Descripción: Corrección V3.
--              1. Usa 'owner_id' en schools (Index).
--              2. Elimina 'payer_id' (Payments RLS).
--              3. Usa 'child_id' en vez de 'student_id' (Enrollments RLS).
--              4. Simplifica joins.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. INDICES DE RENDIMIENTO (Performance Indexes)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_school_members_composite_lookup ON public.school_members(school_id, profile_id, status);
CREATE INDEX IF NOT EXISTS idx_school_members_branch ON public.school_members(branch_id);
-- Fixed: admin_id -> owner_id
CREATE INDEX IF NOT EXISTS idx_schools_owner_id ON public.schools(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_date_range ON public.payments(school_id, created_at DESC);

-- Opcionales (Comentados por seguridad en script manual):
-- CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
-- CREATE INDEX IF NOT EXISTS idx_attendance_composite_report ON public.attendance_records(school_id, attendance_date);

-- ------------------------------------------------------------------------------
-- 2. ROLES DE USUARIO FALTANTES (Missing User Roles)
-- ------------------------------------------------------------------------------
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'wellness_professional';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'store_owner';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'organizer';

-- ------------------------------------------------------------------------------
-- 3. FEATURE FLAGS DE PAGOS (Payment Feature Flags)
-- ------------------------------------------------------------------------------
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{"allow_online": false, "allow_manual": true}';
COMMENT ON COLUMN public.schools.payment_settings IS 'Configuration for enabled payment methods.';
UPDATE public.schools SET payment_settings = '{"allow_online": false, "allow_manual": true}' WHERE payment_settings IS NULL;

-- ------------------------------------------------------------------------------
-- 4. SEGURIDAD REFORZADA (Strict RLS & Isolation)
-- ------------------------------------------------------------------------------

-- Helpers
CREATE OR REPLACE FUNCTION public.check_is_school_member(check_school_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.school_members WHERE school_id = check_school_id AND profile_id = auth.uid() AND status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_school_admin(check_school_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.school_members WHERE school_id = check_school_id AND profile_id = auth.uid() AND role IN ('admin', 'owner', 'school_admin', 'super_admin') AND status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_branch_admin(check_branch_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  IF check_branch_id IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.school_members WHERE profile_id = auth.uid() AND (branch_id = check_branch_id OR branch_id IS NULL) AND role IN ('admin', 'owner', 'school_admin', 'super_admin') AND status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-Apply Policies (Children)
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School admins can CRUD students" ON public.children;
CREATE POLICY "School admins can CRUD students" ON public.children FOR ALL USING (check_is_school_admin(school_id)) WITH CHECK (check_is_school_admin(school_id));
DROP POLICY IF EXISTS "Parents can view their own children" ON public.children;
CREATE POLICY "Parents can view their own children" ON public.children FOR SELECT USING (parent_id = auth.uid());
DROP POLICY IF EXISTS "Coaches can view students in their school" ON public.children;
CREATE POLICY "Coaches can view students in their school" ON public.children FOR SELECT USING (check_is_school_member(school_id));

-- Re-Apply Policies (Payments)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL USING (check_is_school_admin(school_id));
DROP POLICY IF EXISTS "Parents view own payments" ON public.payments;
-- Fixed: Removed payer_id reference (column does not exist)
CREATE POLICY "Parents view own payments" ON public.payments FOR SELECT USING (parent_id = auth.uid());

-- Re-Apply Policies (Enrollments)
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage enrollments" ON public.enrollments;
-- Optimized: Use enrollments.school_id directly instead of join
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL USING (check_is_school_admin(school_id));
DROP POLICY IF EXISTS "Parents view own enrollments" ON public.enrollments;
-- Fixed: student_id -> child_id
CREATE POLICY "Parents view own enrollments" ON public.enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM public.children c WHERE c.id = enrollments.child_id AND c.parent_id = auth.uid()));

-- Re-Apply Policies (School Members)
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;
-- Note: SECURITY DEFINER on check_is_school_member avoids recursion here if run by superuser.
DROP POLICY IF EXISTS "Admins view members of their school" ON public.school_members;
CREATE POLICY "Admins view members of their school" ON public.school_members FOR SELECT USING (check_is_school_member(school_id)); 
DROP POLICY IF EXISTS "Admins manage members" ON public.school_members;
CREATE POLICY "Admins manage members" ON public.school_members FOR ALL USING (check_is_school_admin(school_id));
DROP POLICY IF EXISTS "Users can view own membership" ON public.school_members;
CREATE POLICY "Users can view own membership" ON public.school_members FOR SELECT USING (profile_id = auth.uid());

COMMIT;
