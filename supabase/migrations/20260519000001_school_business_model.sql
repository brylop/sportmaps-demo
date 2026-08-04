-- ============================================================
-- SPORTMAPS — schools.business_model + onboarding RPC update
--
-- Permite que el onboarding de escuela soporte 3 modelos:
--   * teams: organizacion por equipos / grupos deportivos
--            (futbol sub-15, natacion intermedia, etc.). DEFAULT.
--   * plans: organizacion por planes de membresia o paquetes
--            (mensualidad gym, paquete 10 clases yoga, curso baile).
--   * both:  ambas estructuras conviven en la misma escuela.
--
-- El admin elige en el wizard. Afecta que pasos del wizard se muestran
-- y como el dashboard ordena su contenido (equipos vs planes).
-- ============================================================

BEGIN;


-- ============================================================
-- 1. Columna schools.business_model
-- ============================================================

ALTER TABLE public.schools
    ADD COLUMN IF NOT EXISTS business_model text NOT NULL DEFAULT 'teams';

ALTER TABLE public.schools
    DROP CONSTRAINT IF EXISTS schools_business_model_check;

ALTER TABLE public.schools
    ADD CONSTRAINT schools_business_model_check
    CHECK (business_model IN ('teams', 'plans', 'both'));

COMMENT ON COLUMN public.schools.business_model IS
    'Modelo organizativo: teams (equipos/grupos), plans (membresias/paquetes), both. '
    'Se elige en onboarding. Default teams (backwards compat para escuelas existentes).';


-- ============================================================
-- 2. RPC get_onboarding_status: agregar business_model + has_plans
--
-- has_plans: existe al menos un subscription_plan activo de tipo
-- school_monthly atado a algun vendor_profile cuyo user_id sea
-- miembro de la escuela. Es la mejor aproximacion mientras no
-- creemos una tabla school_plans dedicada.
-- ============================================================

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

    -- NUEVO: business_model de la escuela activa (para el wizard)
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
    -- NUEVO: existe al menos un plan de membresia activo asociado a la escuela
    'has_plans', (
        SELECT EXISTS(
            SELECT 1
              FROM public.subscription_plans sp
              JOIN public.vendor_profiles  vp ON vp.id = sp.vendor_profile_id
              JOIN public.school_members   sm ON sm.profile_id = vp.user_id
             WHERE sp.is_active = true
               AND sp.plan_type = 'school_monthly'
               AND (sm.school_id = v_school_id
                    OR (v_school_id IS NULL AND sm.school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id)))
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
    'el wizard adapte los pasos.';

GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO authenticated;


-- ============================================================
-- 3. Refresh PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload config';

COMMIT;
