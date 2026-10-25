-- =============================================================================
-- 20261025020013_grant_get_personal_trainer_school_id.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261025013621
-- Objetivo: devolver EXECUTE a `authenticated` sobre el helper de RLS
--   public.get_personal_trainer_school_id(uuid).
--
-- Qué pasó: 20260921120707_fix_org_enumeration_functions lo revocó a anon y
--   authenticated diciendo que no aparecía en ninguna policy. Sí aparece: lo usan
--   19 policies de 6 tablas (academic_progress, athlete_goals, athlete_stats,
--   body_metrics, coach_availability, training_logs). Las policies son
--   permisivas pero PostgreSQL evalúa todas: si una llama a una función sin
--   EXECUTE, la consulta entera falla con 42501 → 403 para CUALQUIER usuario
--   autenticado, aunque otra policy (…_own) le diera acceso.
--   Visto en QA del Deportista V2: «Mis objetivos» → 403 y se ve vacío.
--   Verificado 10-25 con sesión simulada: SELECT count(*) FROM athlete_goals
--   → «permission denied for function get_personal_trainer_school_id».
--
-- Radio: solo GRANT, no cambia filas, policies ni cuerpos. Es la única función
--   usada en policies a la que le falta EXECUTE de authenticated (consulta
--   pg_proc × pg_policies del 10-25). anon sigue SIN EXECUTE.
-- Riesgo de la función expuesta: devuelve el school_id de un entrenador
--   personal dado su uuid (no datos personales); el mismo trade-off que el
--   resto de helpers de RLS (CLAUDE.md: nunca revocar helpers de policies).
--
-- Verificación (después de aplicar):
--   select proacl from pg_proc where proname = 'get_personal_trainer_school_id';
--     → incluye authenticated=X, no incluye anon
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub',
--     (select id from profiles where email='vcruz@demo.sportmaps.co'),
--     'role','authenticated')::text, true);
--   set local role authenticated;
--   select count(*) from public.athlete_goals;   -- sin error
--   select count(*) from public.training_logs;   -- sin error
--   rollback;
--
-- Reversa: REVOKE EXECUTE ON FUNCTION public.get_personal_trainer_school_id(uuid) FROM authenticated;
--   (vuelve a romper las 6 tablas: solo si antes se reescriben esas policies).
-- =============================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.get_personal_trainer_school_id(uuid) TO authenticated;

COMMIT;
