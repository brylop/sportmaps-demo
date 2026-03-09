-- ============================================================================
-- SECURITY HARDENING — FASE 1: Base de Datos (Crítica + Alta)
-- ============================================================================
-- Fecha: 2026-03-05
-- Resuelve: Hallazgos 1, 2, y 3 del reporte de seguridad.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- HALLAZGO 1 (CRÍTICA): payment_audit_logs sin RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_audit_logs_select_admin"
ON public.payment_audit_logs
FOR SELECT TO authenticated
USING (is_school_admin(school_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- HALLAZGO 2 (ALTA): 7 vistas SECURITY DEFINER → SECURITY INVOKER
-- ─────────────────────────────────────────────────────────────────────────────
ALTER VIEW public.students SET (security_invoker = on);
ALTER VIEW public.pending_payments SET (security_invoker = on);
ALTER VIEW public.teams_full_view SET (security_invoker = on);
ALTER VIEW public.public_staff SET (security_invoker = on);
ALTER VIEW public.school_ratings SET (security_invoker = on);
ALTER VIEW public.team_capacity SET (security_invoker = on);
ALTER VIEW public.class_capacity SET (security_invoker = on);

-- ─────────────────────────────────────────────────────────────────────────────
-- HALLAZGO 3 (ALTA): 33 funciones SECURITY DEFINER sin search_path
-- ─────────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.accept_invitation(p_invite_id uuid) SET search_path = public;
ALTER FUNCTION public.accept_invitation_pro(p_invite_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_create_staff_direct(p_email text, p_role text, p_branch_id uuid) SET search_path = public;
ALTER FUNCTION public.audit_school_settings_changes() SET search_path = public;
ALTER FUNCTION public.audit_trigger_func() SET search_path = public;
ALTER FUNCTION public.check_is_branch_admin(check_branch_id uuid) SET search_path = public;
ALTER FUNCTION public.check_is_school_admin(check_school_id uuid) SET search_path = public;
ALTER FUNCTION public.check_is_school_member(check_school_id uuid) SET search_path = public;
ALTER FUNCTION public.create_invitation(p_email text, p_role text, p_child_name text, p_program_id uuid, p_monthly_fee numeric, p_parent_phone text, p_branch_id uuid) SET search_path = public;
ALTER FUNCTION public.enroll_student(p_student_id uuid, p_class_id uuid, p_school_id uuid, p_program_id uuid) SET search_path = public;
ALTER FUNCTION public.fn_auto_create_main_branch() SET search_path = public;
ALTER FUNCTION public.fn_is_admin_of_school(lookup_school_id uuid) SET search_path = public;
ALTER FUNCTION public.fn_log_payment_status_change() SET search_path = public;
ALTER FUNCTION public.get_invitation_details(p_invite_id uuid) SET search_path = public;
ALTER FUNCTION public.get_my_invitations() SET search_path = public;
ALTER FUNCTION public.get_onboarding_status(v_user_id uuid) SET search_path = public;
ALTER FUNCTION public.get_onboarding_status() SET search_path = public;
ALTER FUNCTION public.get_user_admin_school_ids(_user_id uuid) SET search_path = public;
ALTER FUNCTION public.get_user_school_ids(_user_id uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_school() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.has_role(req_role text) SET search_path = public;
ALTER FUNCTION public.has_role(user_id uuid, required_role text) SET search_path = public;
ALTER FUNCTION public.has_school_role(_user_id uuid, _school_id uuid, _role text) SET search_path = public;
ALTER FUNCTION public.invite_parent_to_school(p_parent_email text, p_child_name text, p_program_id uuid, p_monthly_fee numeric, p_parent_phone text, p_branch_id uuid) SET search_path = public;
ALTER FUNCTION public.invite_parent_to_school(p_parent_email text) SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_branch_admin(user_id uuid, target_branch_id uuid) SET search_path = public;
ALTER FUNCTION public.is_platform_admin() SET search_path = public;
ALTER FUNCTION public.sync_coach_to_staff() SET search_path = public;
ALTER FUNCTION public.sync_enrollment_participant_count() SET search_path = public;
ALTER FUNCTION public.sync_program_participant_count() SET search_path = public;
ALTER FUNCTION public.user_school_role(p_school_id uuid) SET search_path = public;
