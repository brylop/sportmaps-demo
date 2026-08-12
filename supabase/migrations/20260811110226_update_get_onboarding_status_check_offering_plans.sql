-- =============================================================================
-- 20260811110226_update_get_onboarding_status_check_offering_plans.sql
-- Autor: judegor99   Fecha: 2026-08-11   Versión anterior: 20260809101617
-- Objetivo: Corregir get_onboarding_status para evaluar has_plans usando
--           offering_plans en lugar de la tabla obsoleta subscription_plans.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_school_id uuid;
  v_email_verified boolean;
  v_result jsonb;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;

  v_email_verified := (auth.jwt() ->> 'email_confirmed_at') IS NOT NULL;

  SELECT school_id INTO v_school_id
    FROM public.school_members
   WHERE profile_id = v_user_id
     AND status = 'active'
    ORDER BY joined_at DESC
    LIMIT 1;

  SELECT jsonb_build_object(
    'role', v_role,
    'school_id', v_school_id,
    'email_verified', v_email_verified,

    'onboarding_status', (
        SELECT onboarding_status FROM public.schools
         WHERE id = v_school_id OR owner_id = v_user_id
         ORDER BY created_at DESC LIMIT 1
    ),

    'business_model', (
        SELECT business_model FROM public.schools
         WHERE id = v_school_id OR owner_id = v_user_id
         ORDER BY created_at DESC LIMIT 1
    ),

    'profile_complete', (
        SELECT (
            full_name IS NOT NULL AND full_name != 'Usuario' AND
            phone IS NOT NULL AND
            date_of_birth IS NOT NULL AND
            (role != 'athlete' OR (bio IS NOT NULL OR (sports_interests IS NOT NULL AND array_length(sports_interests, 1) > 0)))
        )
        FROM public.profiles
        WHERE id = v_user_id
    ),
    'has_avatar', (SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user_id AND avatar_url IS NOT NULL)),

    'has_pending_invitation', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'pending')),
    'has_accepted_invite',    (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'active')),

    'has_children',          (SELECT EXISTS(SELECT 1 FROM public.children WHERE parent_id = v_user_id)),
    'has_medical_records',   (SELECT EXISTS(SELECT 1 FROM public.children c WHERE c.parent_id = v_user_id AND c.medical_info IS NOT NULL)),
    'has_enrollment', (
        SELECT EXISTS(
            SELECT 1 FROM public.enrollments e
            WHERE e.child_id IN (SELECT id FROM public.children WHERE parent_id = v_user_id)
              AND e.status = 'active'
        ) OR EXISTS(
            SELECT 1 FROM public.enrollments e
            WHERE e.user_id = v_user_id AND e.status = 'active'
        )
    ),

    'has_school',                (SELECT EXISTS(SELECT 1 FROM public.schools WHERE owner_id = v_user_id)),
    'has_branches', (
        SELECT EXISTS(
            SELECT 1 FROM public.school_branches b JOIN public.schools s ON b.school_id = s.id
             WHERE s.owner_id = v_user_id OR s.id = v_school_id
        )
    ),
    'has_teams', (
        SELECT EXISTS(
            SELECT 1 FROM public.teams
             WHERE school_id = v_school_id
                OR (v_school_id IS NULL AND school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id))
        )
    ),
    -- Corregido: se verifica offering_plans en lugar de la tabla obsoleta subscription_plans
    'has_plans', (
        SELECT EXISTS(
            SELECT 1
              FROM public.offering_plans op
             WHERE op.is_active = true
               AND (op.school_id = v_school_id
                    OR (v_school_id IS NULL AND op.school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id)))
        )
    ),
    'has_staff', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE school_id = v_school_id AND role IN ('coach', 'admin'))),
    'has_professional_profile', (SELECT EXISTS(SELECT 1 FROM public.coach_profiles WHERE id = v_user_id AND profile_completed = true)),

    'has_students', (
        SELECT EXISTS(
            SELECT 1 FROM public.children
            WHERE school_id = v_school_id
            OR (v_school_id IS NULL AND school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id))
        )
    ),
    'payment_setup_completed', (
        SELECT EXISTS(
            SELECT 1 FROM public.school_settings
            WHERE school_id = v_school_id
            AND bank_name IS NOT NULL
            AND bank_account_number IS NOT NULL
        )
    ),

    'has_sports_interest', (
        SELECT (
            (bio IS NOT NULL AND length(bio) > 10) OR
            (sports_interests IS NOT NULL AND array_length(sports_interests, 1) > 0)
        )
        FROM public.profiles
        WHERE id = v_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_onboarding_status() IS
    'Status maestro del onboarding del usuario. Para escuelas devuelve '
    'business_model (teams|plans|both) + has_teams + has_plans para que '
    'el wizard adapte los pasos (se lee de offering_plans).';

-- Re-grant explícito
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO anon;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO service_role;

COMMIT;

-- Forzar reload de schema en PostgREST
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
