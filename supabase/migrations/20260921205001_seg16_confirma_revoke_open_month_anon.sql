-- =============================================================================
-- 20260921205001_seg16_confirma_revoke_open_month_anon.sql
-- Autor: brylop   Fecha: 2026-09-22   Versión anterior: 20260921131039
-- Objetivo: SEG-16 — dejar en el ledger, con rastro versionado, el REVOKE de
--   EXECUTE a `anon` sobre open_month/preview_open_month/school_payment_kpis
--   que hoy YA está aplicado en la base viva (verificado por catálogo, ver
--   más abajo) pero nunca quedó registrado en supabase/migrations_ledger.json
--   — se aplicó por el SQL editor durante el apagón de SEG-8b/SEG-16
--   (2026-08-16), el mismo patrón de "aplicado sin rastro" que ya documentó
--   la auditoría de seguridad (docs/auditoria-seguridad-2026-08-14.md).
--
--   Esta migración es intencionalmente un NO-OP contra el estado actual: no
--   cambia ningún permiso vivo, solo dEja el REVOKE explícito por escrito y
--   versionado para que quede a prueba de "alguien reaplica la migración
--   vieja 20260803114540 (que hace GRANT ... TO authenticated, service_role
--   y NO toca anon) o corre un `GRANT EXECUTE ... TO PUBLIC` accidental" sin
--   que el gap vuelva a colarse en silencio.
--
-- ── Verificación ANTES de escribir esto (no aplicado contra la base, solo
--    lectura vía mcp__supabase__execute_sql) ──────────────────────────────
--   select p.proname, p.proacl,
--          has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_puede,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_puede,
--          has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_puede
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('open_month', 'preview_open_month', 'school_payment_kpis');
--
--   Resultado real (2026-09-21): las tres YA tienen anon_puede = false,
--   auth_puede = true, service_puede = true. proacl:
--   {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--   — no hay entrada de `anon` en el ACL. El REVOKE de SEG-16
--   (20260816191133_cerrar_open_month_a_anonimos.sql) SÍ está vivo.
--
-- ── Quién invoca open_month hoy, y con qué rol ───────────────────────────
--   1. Frontend autenticado (botón "Generar" del panel de escuela):
--      frontend/src/pages/PaymentsAutomationPage.tsx:2802 —
--      `supabase.rpc('open_month', currentPeriod())`. El cliente manda el
--      JWT del usuario logueado en el header Authorization; PostgREST lo
--      resuelve al rol `authenticated`, nunca `anon`, aunque la apikey de
--      Supabase (pública) vaya siempre en la petición. Necesita
--      `authenticated` con EXECUTE — se preserva.
--   2. Cron `generate-monthly-charges-daily` (pg_cron, 30 6 * * *, ver
--      supabase/migrations/20260824140944_restaurar_cron_generacion_mensual.sql):
--      `SELECT public.generate_monthly_charges();`, que delega en
--      open_month() (mig. 20260724000003). pg_cron ejecuta el job con el rol
--      que lo agendó (el `cron.schedule` corrió como `postgres`, superusuario
--      de la base) — no pasa por PostgREST ni por el ACL de la función en
--      absoluto: el superusuario no necesita GRANT EXECUTE para llamar nada.
--      Este camino NUNCA dependió de que `anon` (ni siquiera `authenticated`)
--      tuviera el permiso.
--   3. BFF (bff/src/jobs/maintenance.job.ts): no llama a open_month
--      directamente — los jobs de ese archivo son correos reactivos
--      (sendChargeCreatedEmails, notificaciones de glosa) que hacen polling
--      DESPUÉS de que open_month ya corrió, no lo invocan.
--
--   Conclusión: ningún flujo legítimo depende de que `anon` tenga EXECUTE.
--   El REVOKE es seguro — ya está en producción y esta migración solo lo
--   deja trazable en el repo.
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

-- Acotado a `anon`. NO se toca `authenticated` (el panel de escuela la
-- necesita, con el guard interno is_school_admin()/is_super_admin()) ni
-- `service_role` (BFF/cron, que además bypassa por ser postgres/superuser
-- en el caso del cron real). Idempotente: si ya no hay grant, REVOKE no falla.
REVOKE EXECUTE ON FUNCTION public.open_month(uuid, int, int, uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_open_month(uuid, int, int, uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.school_payment_kpis(uuid, uuid)           FROM anon;

-- Cinturón: por si alguna reaplicación futura de una migración vieja hiciera
-- GRANT ... TO PUBLIC sin querer, PUBLIC tampoco debe alcanzar a anon.
REVOKE EXECUTE ON FUNCTION public.open_month(uuid, int, int, uuid)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.preview_open_month(uuid, int, int, uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.school_payment_kpis(uuid, uuid)           FROM PUBLIC;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ─────────────────────────────────────────
-- select p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_puede,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_puede,
--        has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_puede
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('open_month', 'preview_open_month', 'school_payment_kpis');
-- Esperado (sin cambios respecto de antes de aplicar): anon_puede = false en
-- las tres, auth_puede = true, service_puede = true.
