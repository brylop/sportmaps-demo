-- ============================================================
-- SPORTMAPS — Seed para tests E2E de branding white-label
--
-- Crea 4 usuarios de prueba para los tests Playwright de Fase 1.10:
--   1. qa-super-admin@sportmaps.test       — rol super_admin
--   2. qa-pro-admin@sportmaps.test         — admin de escuela tier Pro/Enterprise
--   3. qa-free-admin@sportmaps.test        — admin de escuela tier Free
--   4. qa-parent-multi@sportmaps.test      — parent con hijos en ambas escuelas
--
-- Password para todos: TestPass123!
-- (Override via env vars en CI: PLAYWRIGHT_*_PASSWORD)
--
-- IDEMPOTENTE: si los users ya existen, no falla. Usa ON CONFLICT.
--
-- USO:
--   1. Crear las escuelas de prueba (si aun no existen, ajustar variables abajo)
--   2. Pegar y ejecutar este SQL en el SQL Editor de Supabase staging
--   3. Anotar los UUIDs de las escuelas y exportarlos como env vars:
--      export PLAYWRIGHT_SCHOOL_PRO_ID=<uuid de la pro>
--      export PLAYWRIGHT_SCHOOL_FREE_ID=<uuid de la free>
--   4. Correr: cd frontend && npx playwright test branding-isolation
-- ============================================================

-- Helper temporal para crear o reusar un user en auth.users con password.
-- Hace el hash de la password como lo hace gotrue (bcrypt).
-- Si el user ya existe (por email), devuelve su id.

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
        RAISE NOTICE 'Test user % ya existe con id %', p_email, v_id;
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

    -- Identity row (requerida por gotrue moderna)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_id,
        jsonb_build_object('sub', v_id::text, 'email', p_email),
        'email', p_email, now(), now(), now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;

    RAISE NOTICE 'Test user % creado con id %', p_email, v_id;
    RETURN v_id;
END;
$$;


-- ─── 1. Configurar variables — AJUSTAR SI ES NECESARIO ─────────
-- Usamos escuelas existentes en staging. Si querés crear escuelas nuevas
-- de prueba, hacelo via UI / RPCs habituales y reemplaza los UUIDs aqui.

DO $$
DECLARE
    -- Escuelas existentes que vimos en queries previas (ajustar si cambian)
    v_school_pro_id   uuid := '0242cf27-b8ae-4921-8a3a-69d27178ca34'; -- SOLO MILLOS LOKA (enterprise)
    v_school_free_id  uuid;                                            -- buscar una de tier free
    v_user_super      uuid;
    v_user_pro_admin  uuid;
    v_user_free_admin uuid;
    v_user_parent     uuid;
BEGIN
    -- Buscar la primera escuela tier=free para usar como "Free school"
    SELECT s.id INTO v_school_free_id
      FROM public.schools s
      JOIN public.school_subscriptions ss ON ss.school_id = s.id
     WHERE ss.tier = 'free'
       AND ss.status IN ('active','trialing')
     LIMIT 1;

    IF v_school_free_id IS NULL THEN
        RAISE WARNING 'No se encontro escuela tier=free. Tests del free upsell se saltearan. Crea una para activar.';
    ELSE
        RAISE NOTICE 'Escuela free de prueba: %', v_school_free_id;
    END IF;

    -- ─── 2. Crear users ─────────────────────────────────────────
    v_user_super      := pg_temp.upsert_test_user('qa-super-admin@sportmaps.test');
    v_user_pro_admin  := pg_temp.upsert_test_user('qa-pro-admin@sportmaps.test');
    v_user_free_admin := pg_temp.upsert_test_user('qa-free-admin@sportmaps.test');
    v_user_parent     := pg_temp.upsert_test_user('qa-parent-multi@sportmaps.test');

    -- ─── 3. Profiles ────────────────────────────────────────────
    -- super_admin
    INSERT INTO public.profiles (id, full_name, role, email)
    VALUES (v_user_super, 'QA Super Admin', 'super_admin', 'qa-super-admin@sportmaps.test')
    ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

    -- pro_admin (rol school_admin)
    INSERT INTO public.profiles (id, full_name, role, email)
    VALUES (v_user_pro_admin, 'QA Pro Admin', 'school_admin', 'qa-pro-admin@sportmaps.test')
    ON CONFLICT (id) DO UPDATE SET role = 'school_admin';

    -- free_admin (rol school_admin)
    INSERT INTO public.profiles (id, full_name, role, email)
    VALUES (v_user_free_admin, 'QA Free Admin', 'school_admin', 'qa-free-admin@sportmaps.test')
    ON CONFLICT (id) DO UPDATE SET role = 'school_admin';

    -- parent
    INSERT INTO public.profiles (id, full_name, role, email)
    VALUES (v_user_parent, 'QA Parent Multi', 'parent', 'qa-parent-multi@sportmaps.test')
    ON CONFLICT (id) DO UPDATE SET role = 'parent';

    -- ─── 4. school_members ──────────────────────────────────────
    -- Pro admin
    INSERT INTO public.school_members (school_id, profile_id, role, status, joined_at)
    VALUES (v_school_pro_id, v_user_pro_admin, 'school_admin', 'active', now())
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = 'school_admin';

    -- Free admin (si tenemos la escuela free)
    IF v_school_free_id IS NOT NULL THEN
        INSERT INTO public.school_members (school_id, profile_id, role, status, joined_at)
        VALUES (v_school_free_id, v_user_free_admin, 'school_admin', 'active', now())
        ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = 'school_admin';

        -- Parent multi-school: en ambas escuelas
        INSERT INTO public.school_members (school_id, profile_id, role, status, joined_at)
        VALUES (v_school_free_id, v_user_parent, 'parent', 'active', now())
        ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = 'parent';
    END IF;

    INSERT INTO public.school_members (school_id, profile_id, role, status, joined_at)
    VALUES (v_school_pro_id, v_user_parent, 'parent', 'active', now())
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = 'parent';

    -- ─── 5. Output para exportar como env vars ──────────────────
    RAISE NOTICE '─────────────────────────────────────────';
    RAISE NOTICE 'Test users creados. Exporta estas env vars:';
    RAISE NOTICE 'export PLAYWRIGHT_SCHOOL_PRO_ID=%', v_school_pro_id;
    RAISE NOTICE 'export PLAYWRIGHT_SCHOOL_FREE_ID=%', COALESCE(v_school_free_id::text, '(no encontrada)');
    RAISE NOTICE '─────────────────────────────────────────';
    RAISE NOTICE 'Users (password: TestPass123!):';
    RAISE NOTICE '  super_admin  : qa-super-admin@sportmaps.test    (%)', v_user_super;
    RAISE NOTICE '  pro_admin    : qa-pro-admin@sportmaps.test      (%)', v_user_pro_admin;
    RAISE NOTICE '  free_admin   : qa-free-admin@sportmaps.test     (%)', v_user_free_admin;
    RAISE NOTICE '  parent_multi : qa-parent-multi@sportmaps.test   (%)', v_user_parent;
    RAISE NOTICE '─────────────────────────────────────────';
END $$;


-- ─── 6. Limpieza (opcional, para volver a empezar) ─────────────
-- Para borrar los users de prueba y empezar de cero, ejecutar:
--
--   DELETE FROM auth.users WHERE email LIKE 'qa-%@sportmaps.test';
--   (RLS / cascade limpia profile y school_members)
