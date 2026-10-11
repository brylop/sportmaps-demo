-- ============================================================
-- SMOKE TEST — lista blanca de rol en el signup + gates por rol.
-- NO es una migración. Correr con psql tras aplicar 20261010202857:
--   psql "$DATABASE_URL" -f supabase/migrations/_smoke/signup_rol_whitelist_smoke.sql
--
-- Todo corre en una transacción con ROLLBACK final: no persiste nada.
-- No toca auth.users: handle_new_user no se puede invocar fuera de un
-- trigger, así que se prueba (1) la función pura que decide el rol, (2) que
-- el trigger la use, y (3) los efectos de las policies/funciones con sesiones
-- simuladas (request.jwt.claims + SET LOCAL ROLE authenticated).
-- Cada assert usa RAISE EXCEPTION → si algo falla, la corrida aborta.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

-- ── 1. normalize_signup_role: lista blanca ──────────────────────────────────
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('athlete', 'athlete'), ('parent', 'parent'), ('Padre', 'parent'),
            ('coach', 'coach'), (' School ', 'school'),
            ('wellness_professional', 'wellness_professional'),
            ('wellness', 'wellness_professional'),
            ('store_owner', 'store_owner'), ('personal_trainer', 'personal_trainer'),
            -- NUNCA autoasignables
            ('super_admin', NULL), ('SUPER_ADMIN', NULL), ('admin', NULL),
            ('school_admin', NULL), ('reporter', NULL), ('accountant', NULL),
            ('organizer', NULL), ('external_vendor', NULL), ('owner', NULL),
            ('', NULL), ('x''; drop table profiles; --', NULL)
        ) AS t(entrada, esperado)
    LOOP
        IF public.normalize_signup_role(r.entrada) IS DISTINCT FROM r.esperado THEN
            RAISE EXCEPTION 'FAIL normalize_signup_role(%) = %, esperado %',
                r.entrada, public.normalize_signup_role(r.entrada), r.esperado;
        END IF;
    END LOOP;

    IF public.normalize_signup_role(NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL normalize_signup_role(NULL) debe ser NULL';
    END IF;

    -- Todo lo que devuelve debe castear a user_role (si no, el signup cae al fallback).
    PERFORM public.normalize_signup_role(x)::public.user_role
       FROM unnest(ARRAY['athlete','parent','coach','school','wellness','store_owner','personal_trainer']) x;

    RAISE NOTICE 'OK 1 — lista blanca';
END $$;

-- ── 2. Catálogo: grants, search_path, y que el trigger use la lista ─────────
DO $$
DECLARE
    v_src text;
BEGIN
    IF has_function_privilege('anon', 'public.normalize_signup_role(text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.normalize_signup_role(text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL normalize_signup_role no debe ser ejecutable por anon/authenticated';
    END IF;

    SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure;
    IF v_src NOT LIKE '%normalize_signup_role%' THEN
        RAISE EXCEPTION 'FAIL handle_new_user no usa normalize_signup_role';
    END IF;
    IF v_src ~* '''super_admin''' THEN
        RAISE EXCEPTION 'FAIL handle_new_user todavía mapea super_admin explícitamente';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
         WHERE oid IN ('public.handle_new_user()'::regprocedure,
                       'public.normalize_signup_role(text)'::regprocedure,
                       'public.complete_role_selection(text)'::regprocedure,
                       'public.is_support_agent()'::regprocedure)
         GROUP BY true
        HAVING bool_and(array_to_string(proconfig, ',') LIKE '%search_path=pg_catalog, public, pg_temp%')
    ) THEN
        RAISE EXCEPTION 'FAIL alguna función nueva/reescrita sin search_path fijo';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policies
         WHERE tablename = 'school_payment_providers'
           AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~* 'profiles'
    ) THEN
        RAISE EXCEPTION 'FAIL school_payment_providers todavía tiene una policy que lee profiles';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE is_active) THEN
        RAISE EXCEPTION 'FAIL platform_admins vacía: nadie es staff de plataforma';
    END IF;

    RAISE NOTICE 'OK 2 — catálogo';
END $$;

-- ── 3. Fixtures de sesión ───────────────────────────────────────────────────
-- Un perfil cualquiera que NO es plataforma ni dueño de escuela, al que se le
-- pone role='admin' (como habría quedado tras un signup con role=super_admin
-- antes de esta migración). El UPDATE corre como postgres SIN claims: el
-- guard de UPDATE no aplica a esa sesión. ROLLBACK al final lo deshace.
SELECT set_config('smoke.atacante', (
    SELECT p.id::text FROM public.profiles p
     WHERE NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.profile_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.owner_id = p.id)
       AND p.role::text IN ('parent', 'athlete')
     ORDER BY p.created_at
     LIMIT 1), true);
SELECT set_config('smoke.plataforma', (
    SELECT profile_id::text FROM public.platform_admins WHERE is_active LIMIT 1), true);

UPDATE public.profiles
   SET role = 'admin', needs_role_selection = false
 WHERE id = current_setting('smoke.atacante')::uuid;

-- ── 4. Como el "atacante" (role='admin' en profiles, sin plataforma) ────────
SELECT set_config('request.jwt.claims',
    json_build_object('sub', current_setting('smoke.atacante'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    n int;
BEGIN
    -- authenticated NO tiene SELECT sobre la tabla, pero sí INSERT/UPDATE/DELETE:
    -- un UPDATE sin WHERE no necesita SELECT y alcanza toda fila que el USING
    -- deje ver. Antes, con profiles.role='admin', eran TODAS las escuelas.
    -- (Dentro de la transacción del smoke; el ROLLBACK lo deshace igual.)
    UPDATE public.school_payment_providers SET updated_at = now();  -- sin leer columnas
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN
        RAISE EXCEPTION 'FAIL profiles.role=admin todavía alcanza % filas de school_payment_providers', n;
    END IF;

    IF public.is_support_agent() THEN
        RAISE EXCEPTION 'FAIL is_support_agent() true para profiles.role=admin sin platform_admins';
    END IF;

    -- complete_role_selection: con needs_role_selection = false se rechaza.
    BEGIN
        PERFORM public.complete_role_selection('school');
        RAISE EXCEPTION 'FAIL complete_role_selection aceptó cambiar un rol ya asignado';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;  -- esperado (42501)
    END;

    -- Y no deja autoasignar plataforma aunque estuviera en onboarding.
    BEGIN
        PERFORM public.complete_role_selection('super_admin');
        RAISE EXCEPTION 'FAIL complete_role_selection aceptó super_admin';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;  -- 'Rol no permitido'
    END;

    RAISE NOTICE 'OK 4 — atacante sin alcance';
END $$;

RESET ROLE;

-- ── 5. Onboarding sigue funcionando (needs_role_selection = true) ───────────
UPDATE public.profiles
   SET role = 'athlete', needs_role_selection = true
 WHERE id = current_setting('smoke.atacante')::uuid;

SELECT set_config('request.jwt.claims',
    json_build_object('sub', current_setting('smoke.atacante'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v jsonb;
BEGIN
    v := public.complete_role_selection('organizer');
    IF v->>'role' <> 'organizer' OR (v->>'needs_role_selection')::boolean THEN
        RAISE EXCEPTION 'FAIL onboarding: complete_role_selection devolvió %', v;
    END IF;
    RAISE NOTICE 'OK 5 — onboarding por RPC';
END $$;

RESET ROLE;

-- ── 6. El super admin real conserva soporte y pasarelas ─────────────────────
SELECT set_config('request.jwt.claims',
    json_build_object('sub', current_setting('smoke.plataforma'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
    IF NOT public.is_support_agent() THEN
        RAISE EXCEPTION 'FAIL el admin de plataforma perdió is_support_agent()';
    END IF;
    RAISE NOTICE 'OK 6 — plataforma intacta';
END $$;

RESET ROLE;

ROLLBACK;
