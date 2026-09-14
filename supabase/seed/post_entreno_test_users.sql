-- ============================================================
-- SPORTMAPS — Seed para tests E2E de Evaluación Post-Entrenamiento
-- docs/specs/evaluacion-post-entrenamiento.md
--
-- Crea 2 usuarios de prueba + 1 hijo, en "Escuela Demo SportMaps"
-- (de300000-0000-4000-8000-000000000001, sport=Fútbol, is_demo=true),
-- equipo "Thunder" (de320000-0000-4000-8000-000000000001):
--   1. qa-post-entreno-parent@sportmaps.test — parent de "QA Post Entreno Hijo"
--   2. qa-post-entreno-coach@sportmaps.test  — coach agregado a Thunder (team_coaches)
--
-- Password para ambos: TestPass123! (mismo patrón que branding_test_users.sql)
--
-- Deliberadamente NO se toca ningún usuario/equipo real (Besser, Dynasty, etc.)
-- ni las cuentas demo.coach1/2@sportmaps.co ya existentes — ninguna de esas
-- cuentas tiene password conocida por fuera de quien la creó, y esta escuela
-- demo es zona segura para agregar UN roster más sin afectar lo que ya usan
-- otras demos (ver Demo branch strategy — seed idempotente is_demo=true).
--
-- IDEMPOTENTE. Ejecutar en el SQL Editor de Supabase (o vía MCP execute_sql).
-- ============================================================

CREATE OR REPLACE FUNCTION pg_temp.upsert_test_user(
    p_email text,
    p_password text DEFAULT 'TestPass123!'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_id uuid;
BEGIN
    SELECT id INTO v_id FROM auth.users WHERE email = p_email LIMIT 1;
    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    v_id := gen_random_uuid();
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        p_email, crypt(p_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', split_part(p_email, '@', 1)),
        now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_id,
        jsonb_build_object('sub', v_id::text, 'email', p_email),
        'email', p_email, now(), now(), now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;

    RETURN v_id;
END;
$$;

DO $$
DECLARE
    v_school_id  uuid := 'de300000-0000-4000-8000-000000000001'; -- Escuela Demo SportMaps
    v_team_id    uuid := 'de320000-0000-4000-8000-000000000001'; -- Thunder
    v_parent     uuid;
    v_coach_auth uuid;
    v_coach_staff_id uuid;
    v_child_id   uuid;
BEGIN
    v_parent     := pg_temp.upsert_test_user('qa-post-entreno-parent@sportmaps.test');
    v_coach_auth := pg_temp.upsert_test_user('qa-post-entreno-coach@sportmaps.test');

    -- onboarding_completed=true y needs_role_selection=false son obligatorios:
    -- sin esto ProtectedRoute manda a /onboarding/role en cada login
    -- (project_person_role_onboarding.md) — needs_role_selection es columna
    -- propia, no se deriva de `role` como parecía a primera vista.
    INSERT INTO public.profiles (id, full_name, role, email, onboarding_completed, onboarding_started, needs_role_selection)
    VALUES (v_parent, 'QA Post Entreno Parent', 'parent', 'qa-post-entreno-parent@sportmaps.test', true, true, false)
    ON CONFLICT (id) DO UPDATE SET role = 'parent', onboarding_completed = true, onboarding_started = true, needs_role_selection = false;

    INSERT INTO public.profiles (id, full_name, role, email, onboarding_completed, onboarding_started, needs_role_selection)
    VALUES (v_coach_auth, 'QA Post Entreno Coach', 'coach', 'qa-post-entreno-coach@sportmaps.test', true, true, false)
    ON CONFLICT (id) DO UPDATE SET role = 'coach', onboarding_completed = true, onboarding_started = true, needs_role_selection = false;

    INSERT INTO public.school_members (school_id, profile_id, role, status, joined_at)
    VALUES (v_school_id, v_parent, 'parent', 'active', now())
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = 'parent';

    INSERT INTO public.school_members (school_id, profile_id, role, status, joined_at)
    VALUES (v_school_id, v_coach_auth, 'coach', 'active', now())
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = 'coach';

    -- school_staff: identidad de coach real del sistema (school_staff.id, no auth.uid()).
    SELECT id INTO v_coach_staff_id FROM public.school_staff
     WHERE school_id = v_school_id AND coach_auth_id = v_coach_auth;

    IF v_coach_staff_id IS NULL THEN
        INSERT INTO public.school_staff (school_id, full_name, email, coach_auth_id, status, sports, taught_levels)
        VALUES (v_school_id, 'QA Post Entreno Coach', 'qa-post-entreno-coach@sportmaps.test', v_coach_auth, 'active', '{}', '{}')
        RETURNING id INTO v_coach_staff_id;
    END IF;

    INSERT INTO public.team_coaches (team_id, coach_id, school_id)
    VALUES (v_team_id, v_coach_staff_id, v_school_id)
    ON CONFLICT DO NOTHING;

    -- Hijo de prueba, ya inscrito y activo en Thunder.
    SELECT id INTO v_child_id FROM public.children
     WHERE parent_id = v_parent AND school_id = v_school_id AND full_name = 'QA Post Entreno Hijo';

    IF v_child_id IS NULL THEN
        INSERT INTO public.children (parent_id, school_id, full_name, date_of_birth, team_id, is_demo, is_active)
        VALUES (v_parent, v_school_id, 'QA Post Entreno Hijo', '2014-01-01', v_team_id, true, true)
        RETURNING id INTO v_child_id;
    END IF;

    INSERT INTO public.enrollments (school_id, child_id, team_id, status, start_date)
    SELECT v_school_id, v_child_id, v_team_id, 'active', CURRENT_DATE
    WHERE NOT EXISTS (
        SELECT 1 FROM public.enrollments
         WHERE child_id = v_child_id AND team_id = v_team_id AND status = 'active'
    );

    RAISE NOTICE '─────────────────────────────────────────';
    RAISE NOTICE 'QA post-entreno fixture listo (password: TestPass123!):';
    RAISE NOTICE '  parent : qa-post-entreno-parent@sportmaps.test (%)', v_parent;
    RAISE NOTICE '  coach  : qa-post-entreno-coach@sportmaps.test  (%)', v_coach_auth;
    RAISE NOTICE '  hijo   : % (%)', 'QA Post Entreno Hijo', v_child_id;
    RAISE NOTICE '  school : % / team Thunder: %', v_school_id, v_team_id;
    RAISE NOTICE '─────────────────────────────────────────';
END $$;
