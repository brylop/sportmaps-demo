-- ============================================================
-- SPORTMAPS — HOTFIX urgente Fase 3a
--
-- BUG: en 20260513000003 revoque EXECUTE de las funciones helper
-- de RLS (is_school_admin, coach_team_ids, etc.) a TODOS los
-- roles. Aunque las funciones son SECURITY DEFINER (ejecutan el
-- body como owner), el caller TODAVIA necesita EXECUTE para
-- invocarlas. Las policies que las usan en USING/WITH CHECK son
-- evaluadas con el rol del caller (authenticated/anon), entonces
-- al consultar profiles/school_members/enrollments el caller
-- llama is_school_admin() y falla con 42501 → REST responde 403.
--
-- SINTOMA observado: cualquier SELECT contra tablas con RLS que
-- referencian estos helpers retornaba 403 desde dev.sportmaps.co.
--
-- FIX: re-grant EXECUTE TO anon, authenticated a las helpers que
-- son evaluadas dentro de policies. Las trigger functions y
-- utilities NO se reotorgan — el motor de triggers las invoca
-- internamente con el rol del owner del trigger, no del caller.
--
-- NOTA: el linter va a volver a marcar estas funciones como
-- "Public Can Execute SECURITY DEFINER Function". Es false
-- positive: el endpoint REST queda expuesto, pero la funcion
-- en si misma solo lee state propio (no toma p_school_id como
-- argumento controlado por el caller para hacer cosas peligrosas).
-- En una pasada futura podriamos moverlas a un schema interno y
-- referenciarlas desde public con SECURITY DEFINER wrappers.
-- ============================================================

DO $$
DECLARE
    r record;
    v_targets text[] := ARRAY[
        -- ============ Helpers de RLS / auth checks ============
        'is_school_admin',
        'is_school_coach',
        'is_school_owner',
        'is_school_member',
        'is_school_general_admin',
        'is_school_open_now',
        'is_branch_admin',
        'is_personal_trainer',
        'is_platform_admin',
        'is_admin',
        'is_super_admin',
        'is_parent_of_child',
        'is_parent_of',
        'is_demo_user',
        'check_is_branch_admin',
        'check_is_school_admin',
        'check_is_school_admin_safe',
        'check_is_school_member',
        'check_is_school_member_safe',
        'coach_school_ids',
        'coach_team_ids',
        'school_member_profile_ids',
        'get_user_admin_school_ids',
        'get_user_school_ids',
        'get_my_administered_school_ids',
        'fn_is_admin_of_school',
        'get_single_branch_id',
        'get_personal_trainer_school_id',
        'get_trainer_athlete_ids',
        'get_distance_km',
        'has_role',
        'has_school_role'
    ];
    v_count integer := 0;
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS fn_name,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = ANY (v_targets)
    LOOP
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon, authenticated',
            r.schema_name, r.fn_name, r.args
        );
        v_count := v_count + 1;
        RAISE NOTICE 'GRANT EXECUTE en %.%(%) a anon, authenticated',
            r.schema_name, r.fn_name, r.args;
    END LOOP;
    RAISE NOTICE 'Total GRANT aplicados: %', v_count;
END $$;


-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload config';
