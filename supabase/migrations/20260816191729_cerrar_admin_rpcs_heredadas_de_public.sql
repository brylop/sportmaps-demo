-- ============================================================================
-- SEG-16b — `anon` llega por DOS caminos, y solo se cerró uno
--            + `v_school_entitlements` perdió security_invoker
--
-- Fecha: 2026-08-16
-- Corrige el alcance de 20260816191133 y una regresión propia.
--
-- ── Lo que mostró la verificación ───────────────────────────────────────────
--   open_month             anon=false  ✅
--   preview_open_month     anon=false  ✅
--   school_payment_kpis    anon=false  ✅
--   admin_set_school_plan  anon=TRUE   🔴  ← el REVOKE ... FROM anon no hizo nada
--   admin_set_school_addon anon=TRUE   🔴
--
-- ── Por qué: hay DOS caminos, no uno ────────────────────────────────────────
--   1. Concesión DIRECTA a `anon` (la que hace Supabase).
--      Se cierra con  REVOKE ... FROM anon.
--   2. Herencia de `PUBLIC`. Postgres concede EXECUTE a PUBLIC **por defecto**
--      en todo CREATE FUNCTION, y `anon` es miembro de PUBLIC.
--      Se cierra con  REVOKE ... FROM PUBLIC.
--
-- `open_month` traía `REVOKE ALL ... FROM PUBLIC` en su migración (camino 2 ya
-- cerrado), así que bastó cerrar el 1. Las `admin_*` solo hacían
-- `GRANT ... TO authenticated` y nunca revocaron PUBLIC: revocarle a `anon` no
-- cambió nada porque seguían entrando por ahí.
--
-- ⚠️ Esto CORRIGE la nota de `SEG-3`/`SEG-8` del roadmap, que dice que Supabase
-- concede EXECUTE «directamente, NO vía PUBLIC». Es cierto para el camino 1 y
-- deja fuera el 2. La regla completa:
--
--     Toda función nueva necesita REVOKE FROM PUBLIC **y** su GRANT explícito.
--     Solo con el GRANT queda abierta a anónimos aunque nadie se lo conceda.
--
-- Las 8 RPC de super admin del bloque de periodo de prueba (20260812125503) y
-- `admin_set_billing_enabled` (20260815141039) se escribieron con ese defecto:
-- todas figuran en el linter como ejecutables por `anon`. No son explotables
-- —su `is_super_admin()` devuelve false sin sesión— pero se cierran igual.
--
-- ── Y una regresión: v_school_entitlements quedó SECURITY DEFINER ───────────
-- El linter la marca como ERROR. La vista nació con `security_invoker = true`;
-- se perdió en `20260814104612`, que la recreó sin la cláusula `WITH`, y
-- `20260815141039` (billing_enabled) arrastró el error al recrearla otra vez.
--
-- Con `security_definer`, la vista corre con permisos del dueño y **se salta el
-- RLS** de `schools`, `school_subscriptions`, `school_addons` y
-- `school_settings`: cualquier usuario autenticado puede leer plan, estado de
-- suscripción, trial y addons de las 365 escuelas, no solo de la suya.
--
-- Se arregla con ALTER VIEW y no recreándola: cambiar solo la reloption evita
-- volver a escribir las 32 columnas y el riesgo de 42P16 que ya nos mordió.
--
-- Las otras dos vistas que marca el linter —`v_school_staff_publico` y
-- `v_school_settings_publico`— **son definer a propósito**: se crearon en el
-- fix de `SEG-10` justamente para exponer un subconjunto curado a la web
-- pública. No se tocan.
-- ============================================================================

BEGIN;

-- ── 1. Las dos admin_* preexistentes que quedaron abiertas ──────────────────
-- El REVOKE a PUBLIC también le quita el privilegio heredado a authenticated y
-- service_role, así que hay que devolvérselos explícitamente.
REVOKE ALL ON FUNCTION public.admin_set_school_plan(uuid, text, text)                 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_plan(uuid, text, text)              TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_set_school_addon(uuid, text, boolean, integer)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_addon(uuid, text, boolean, integer) TO authenticated, service_role;

-- ── 2. Las RPC de super admin del periodo de prueba y de cobros ─────────────
-- Todas creadas con el mismo defecto (GRANT sin REVOKE FROM PUBLIC).
REVOKE ALL ON FUNCTION public.admin_set_trial(uuid, integer, timestamptz)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_trial(uuid, integer, timestamptz)          TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_extend_trial(uuid, integer)                       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer)                    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_expire_trial_now(uuid)                            FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_expire_trial_now(uuid)                         TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_set_blocking_exempt(uuid, boolean, text)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_blocking_exempt(uuid, boolean, text)       TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_set_account_type(uuid, text)                      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_type(uuid, text)                   TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_reactivate_school(uuid, text)                     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_school(uuid, text)                  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_list_trials(text, text, integer, integer)         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_trials(text, text, integer, integer)      TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_set_billing_enabled(uuid, boolean)                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_billing_enabled(uuid, boolean)             TO authenticated, service_role;

-- ── 3. La vista vuelve a respetar el RLS del que consulta ───────────────────
ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Las RPC: todas deben quedar anon=false y auth=true.
-- ────────────────────────────────────────────────────────────────────────────
SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_puede,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_puede,
       CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE')
            THEN '🔴 SIGUE ABIERTA' ELSE '✅ cerrada a anónimos' END AS estado
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('open_month','preview_open_month','school_payment_kpis',
                     'admin_set_school_plan','admin_set_school_addon','admin_set_trial',
                     'admin_extend_trial','admin_expire_trial_now','admin_set_blocking_exempt',
                     'admin_set_account_type','admin_reactivate_school','admin_list_trials',
                     'admin_set_billing_enabled')
 ORDER BY anon_puede DESC, p.proname;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. La vista: debe decir security_invoker=true.
-- ────────────────────────────────────────────────────────────────────────────
SELECT c.relname,
       COALESCE(
         (SELECT o FROM unnest(c.reloptions) o WHERE o LIKE 'security_invoker%'),
         '(sin opción → SECURITY DEFINER)'
       ) AS opcion
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'v'
   AND c.relname IN ('v_school_entitlements','v_school_staff_publico','v_school_settings_publico');


-- ────────────────────────────────────────────────────────────────────────────
-- 3. El problema sistémico: cuántas SECURITY DEFINER siguen abiertas a anon y
--    por qué camino entran. Alimenta el barrido pendiente de SEG-8.
-- ────────────────────────────────────────────────────────────────────────────
SELECT count(*)                                                             AS definer_abiertas_a_anon,
       count(*) FILTER (WHERE p.proacl IS NULL)                             AS sin_acl_explicita_hereda_public,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                                       WHERE a.grantee = 0
                                         AND a.privilege_type = 'EXECUTE')) AS con_grant_a_public
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prokind = 'f'
   AND p.prosecdef
   AND has_function_privilege('anon', p.oid, 'EXECUTE');
