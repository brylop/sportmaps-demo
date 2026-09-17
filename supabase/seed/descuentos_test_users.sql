-- ============================================================
-- SPORTMAPS — Seed para tests E2E de Descuentos (hermanos/primos/referido)
-- docs/specs/descuentos-hermanos-primos-referidos.md
--
-- Crea, en "Escuela Demo SportMaps" (de300000-0000-4000-8000-000000000001,
-- is_demo=true), equipo "Thunder" (de320000-0000-4000-8000-000000000001):
--   1. qa-descuentos-admin@sportmaps.test  — school_admin de la escuela
--   2. qa-descuentos-parent@sportmaps.test — parent de 2 hijos:
--      - "QA Descuento Primos Hijo"  — enrollment activo, para el test que
--        edita el atleta y marca/desmarca primos-referido en el modal.
--      - "QA Descuento Hermano Uno"  — solo tiene un payment YA generado con
--        sibling_discount_applied poblado, para el test que confirma la
--        línea "Incluye descuento por hermanos" en Mis Pagos (F4). No
--        depende de correr open_month/preview_open_month de verdad.
--
-- Password para el admin y el parent: TestPass123!
--
-- Deliberadamente NO se toca ningún usuario/equipo real (Besser, Dynasty,
-- etc.) — mismo criterio que supabase/seed/post_entreno_test_users.sql.
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
    v_school_id     uuid := 'de300000-0000-4000-8000-000000000001'; -- Escuela Demo SportMaps
    v_team_id       uuid := 'de320000-0000-4000-8000-000000000001'; -- Thunder
    v_admin         uuid;
    v_parent        uuid;
    v_child_primos  uuid;
    v_child_hermano uuid;
BEGIN
    v_admin  := pg_temp.upsert_test_user('qa-descuentos-admin@sportmaps.test');
    v_parent := pg_temp.upsert_test_user('qa-descuentos-parent@sportmaps.test');

    INSERT INTO public.profiles (id, full_name, role, email, onboarding_completed, onboarding_started, needs_role_selection)
    VALUES (v_admin, 'QA Descuentos Admin', 'school_admin', 'qa-descuentos-admin@sportmaps.test', true, true, false)
    ON CONFLICT (id) DO UPDATE SET role = 'school_admin', onboarding_completed = true, onboarding_started = true, needs_role_selection = false;

    INSERT INTO public.profiles (id, full_name, role, email, onboarding_completed, onboarding_started, needs_role_selection)
    VALUES (v_parent, 'QA Descuentos Parent', 'parent', 'qa-descuentos-parent@sportmaps.test', true, true, false)
    ON CONFLICT (id) DO UPDATE SET role = 'parent', onboarding_completed = true, onboarding_started = true, needs_role_selection = false;

    INSERT INTO public.school_members (school_id, profile_id, role, status, joined_at)
    VALUES (v_school_id, v_admin, 'school_admin', 'active', now())
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = 'school_admin';

    INSERT INTO public.school_members (school_id, profile_id, role, status, joined_at)
    VALUES (v_school_id, v_parent, 'parent', 'active', now())
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = 'parent';

    -- ── Hijo 1: para el test de primos/referido en el modal de atleta ──────
    SELECT id INTO v_child_primos FROM public.children
     WHERE parent_id = v_parent AND school_id = v_school_id AND full_name = 'QA Descuento Primos Hijo';

    IF v_child_primos IS NULL THEN
        INSERT INTO public.children (parent_id, school_id, full_name, date_of_birth, team_id, is_demo, is_active)
        VALUES (v_parent, v_school_id, 'QA Descuento Primos Hijo', '2013-05-01', v_team_id, true, true)
        RETURNING id INTO v_child_primos;
    END IF;

    -- Enrollment activo con monto propio (no depende del precio de Thunder).
    -- Se deja SIN fee_is_manual/discount_type: el test los marca y desmarca,
    -- así que no importa en qué estado haya quedado la corrida anterior.
    INSERT INTO public.enrollments (school_id, child_id, team_id, status, start_date, monthly_fee)
    SELECT v_school_id, v_child_primos, v_team_id, 'active', CURRENT_DATE, 200000
    WHERE NOT EXISTS (
        SELECT 1 FROM public.enrollments
         WHERE child_id = v_child_primos AND team_id = v_team_id AND status = 'active'
    );

    -- ── Hijo 2: solo un payment ya generado con sibling_discount_applied ────
    -- para el test de "Incluye descuento por hermanos" en Mis Pagos (F4).
    SELECT id INTO v_child_hermano FROM public.children
     WHERE parent_id = v_parent AND school_id = v_school_id AND full_name = 'QA Descuento Hermano Uno';

    IF v_child_hermano IS NULL THEN
        INSERT INTO public.children (parent_id, school_id, full_name, date_of_birth, is_demo, is_active)
        VALUES (v_parent, v_school_id, 'QA Descuento Hermano Uno', '2015-08-01', true, true)
        RETURNING id INTO v_child_hermano;
    END IF;

    INSERT INTO public.payments (
        school_id, parent_id, child_id, concept, amount, due_date, status,
        payment_type, sibling_discount_applied
    )
    SELECT
        v_school_id, v_parent, v_child_hermano,
        'Mensualidad QA Descuento Hermano', 180000, CURRENT_DATE + INTERVAL '10 days', 'pending',
        'subscription', 20000
    WHERE NOT EXISTS (
        SELECT 1 FROM public.payments
         WHERE child_id = v_child_hermano AND concept = 'Mensualidad QA Descuento Hermano'
    );

    RAISE NOTICE '─────────────────────────────────────────';
    RAISE NOTICE 'QA descuentos fixture listo (password: TestPass123!):';
    RAISE NOTICE '  admin  : qa-descuentos-admin@sportmaps.test  (%)', v_admin;
    RAISE NOTICE '  parent : qa-descuentos-parent@sportmaps.test (%)', v_parent;
    RAISE NOTICE '  hijo primos   : % (%)', 'QA Descuento Primos Hijo', v_child_primos;
    RAISE NOTICE '  hijo hermano  : % (%)', 'QA Descuento Hermano Uno', v_child_hermano;
    RAISE NOTICE '  school : %', v_school_id;
    RAISE NOTICE '─────────────────────────────────────────';
END $$;

-- ─── Limpieza (opcional, para volver a empezar) ─────────────────
--   DELETE FROM auth.users WHERE email LIKE 'qa-descuentos-%@sportmaps.test';
--   DELETE FROM public.payments WHERE concept = 'Mensualidad QA Descuento Hermano';
--   DELETE FROM public.children WHERE full_name LIKE 'QA Descuento %';
