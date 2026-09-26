-- =============================================================================
-- 20260926124337_coach_attendance_retro_days_carmel.sql
-- Autor: brylop   Fecha: 2026-09-26   Versión anterior: 20260925140545
-- Objetivo: que la ventana de carga retroactiva de asistencia del ENTRENADOR
-- (hoy 7 días fijos en el BFF, constante RETRO_DIAS_COACH) sea configurable
-- por escuela, y abrirla a 90 días para Club Carmel para que sus entrenadores
-- completen las listas de agosto de 2026.
--
-- Caso que lo dispara: Carmel (2026-09-26) quiere cargar la asistencia de
-- agosto. En la base no hay ninguna attendance_session de Carmel anterior al
-- 2026-09-05, y las 12 de septiembre las crearon entrenadores (created_by con
-- role = 'coach'). La regla vigente (decisión de producto del 2026-08-16,
-- docs/plan-asistencia-errores-2026-08-16.md §2.b) deja al coach 7 días atrás
-- y a la administración sin tope; pero el dueño de Carmel no tiene en su menú
-- la pantalla de pasar lista (/coach-attendance solo está en el menú del
-- coach), así que en la práctica quien toma lista en Carmel es el entrenador y
-- agosto le queda fuera de la ventana.
--
-- Qué NO cambia: la administración sigue sin tope; las fechas futuras siguen
-- rechazadas; los créditos se siguen descontando con el saldo de ESE día; la
-- trazabilidad sigue en security_audit_log; reabrir una sesión finalizada usa
-- la misma ventana. Solo cambia el largo de la ventana del coach, y solo para
-- las escuelas que lo pidan.
--
-- Gate: en el BFF (resolverFechaDeTrabajo lee el flag únicamente cuando un
-- coach pide una fecha distinta de hoy) y en el frontend (min del selector
-- "Día de la lista"). No hay RLS involucrada: la escritura de asistencia ya
-- pasa por el BFF con service role.
--
-- Radio: default 7 = comportamiento idéntico al de hoy para toda escuela.
-- Solo Carmel queda en 90 (agosto 1 → hoy son 56 días; 90 le da hasta fin de
-- octubre). Para volverla a 7 basta un UPDATE sobre school_settings.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · No se crea ninguna función acá.
--   · CREATE OR REPLACE VIEW no permite reordenar ni renombrar columnas
--     (42P16): se copia la definición vigente completa (pg_get_viewdef contra
--     la base el 2026-09-26, idéntica a la de 20260924101138) y se agrega la
--     columna nueva AL FINAL — mismo patrón que 20260924101138.
-- =============================================================================

BEGIN;

-- ── 1. Ventana configurable en school_settings ──────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_attendance_retro_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.school_settings
    DROP CONSTRAINT IF EXISTS school_settings_coach_attendance_retro_days_check;
ALTER TABLE public.school_settings
    ADD CONSTRAINT school_settings_coach_attendance_retro_days_check
    CHECK (coach_attendance_retro_days BETWEEN 0 AND 366);

COMMENT ON COLUMN public.school_settings.coach_attendance_retro_days IS
    'Cuántos días hacia atrás puede un ENTRENADOR pasar lista o reabrir una '
    'sesión de asistencia (BFF: resolverFechaDeTrabajo). 0 = solo el día en '
    'curso. La administración (owner/admin/school_admin/super_admin) no tiene '
    'tope y no lee esta columna. Default 7 = la regla de producto del '
    '2026-08-16. Caso Carmel Club (2026-09-26): 90 para completar agosto.';

UPDATE public.school_settings
SET coach_attendance_retro_days = 90
WHERE school_id = '374a6716-af42-4745-afe1-8d089153e01b'; -- Carmel Club (verificado contra la base: fila existe)

-- ── 2. Exponer el valor a v_school_entitlements ─────────────────────────────
CREATE OR REPLACE VIEW public.v_school_entitlements AS
 SELECT s.id AS school_id,
    s.school_type,
    COALESCE(sub.plan_code, 'starter'::text) AS plan_code,
    COALESCE(sub.tier, 'free'::text) AS tier,
    COALESCE(sub.status, 'trialing'::text) AS subscription_status,
    COALESCE(sub.trial_ends_at, s.created_at + '1 mon'::interval) AS trial_ends_at,
    sub.current_period_start,
    sub.current_period_end,
    sub.billing_cycle,
    s.school_type IS NULL OR (s.school_type = ANY (ARRAY['academy'::text, 'hybrid'::text, 'club'::text, 'escuela'::text, 'gimnasio'::text, 'personal_trainer'::text])) AS has_academy,
    s.school_type = ANY (ARRAY['venue'::text, 'hybrid'::text, 'gimnasio'::text]) AS has_reservations,
    s.school_type = ANY (ARRAY['venue'::text, 'hybrid'::text, 'gimnasio'::text]) AS has_wallet,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'tournaments'::text AND a.enabled)) AS has_tournaments,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'access_control'::text AND a.enabled)) AS has_access_control,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'biomech'::text AND a.enabled)) AS has_biomech,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'nutrition'::text AND a.enabled)) AS has_nutrition,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'whitelabel'::text AND a.enabled)) AS has_whitelabel,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'whatsapp'::text AND a.enabled)) AS has_whatsapp,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'wompi'::text AND a.enabled)) AS has_wompi,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'mp'::text AND a.enabled)) AS has_mp,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'store'::text AND a.enabled)) AS has_store,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'accounting'::text AND a.enabled)) AS has_accounting,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'invoicing'::text AND a.enabled)) AS has_invoicing,
    s.created_at AS school_created_at,
    s.account_type,
    sub.school_id IS NOT NULL AS has_subscription_row,
    sub.trial_months,
    COALESCE(sub.blocking_exempt, false) AS blocking_exempt,
    sub.blocking_exempt_reason,
    school_is_operational(s.id) AS is_operational,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND (a.addon_key = ANY (ARRAY['pwa_branding'::text, 'whitelabel'::text])) AND a.enabled)) AS has_pwa_branding,
    COALESCE(sset.billing_enabled, true) AS has_billing,
    ( SELECT jsonb_object_agg(m.module_key, m.enabled) AS jsonb_object_agg
           FROM school_module_overrides m
          WHERE m.school_id = s.id) AS module_overrides,
    COALESCE(sset.coach_can_create_athletes, false) AS coach_can_create_athletes,
    COALESCE(sset.coach_can_create_teams, false) AS coach_can_create_teams,
    COALESCE(sset.parent_email_optional, false) AS parent_email_optional,
    COALESCE(sset.coach_hide_financial_info, false) AS coach_hide_financial_info,
    COALESCE(sset.coach_can_edit_categories, false) AS coach_can_edit_categories,
    COALESCE(sset.military_discount_enabled, false) AS military_discount_enabled,
    COALESCE(sset.allow_secondary_team_enrollment, false) AS allow_secondary_team_enrollment,
    COALESCE(sset.coach_attendance_retro_days, 7) AS coach_attendance_retro_days
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verificación (correr después) ────────────────────────────────────────────
-- 1. Solo Carmel distinta del default:
--    select school_id, coach_attendance_retro_days from v_school_entitlements
--    where coach_attendance_retro_days <> 7; -- 1 fila (374a6716-…, 90)
--
-- 2. Cualquier otra escuela sigue en 7 (default de la columna):
--    select count(*) from school_settings where coach_attendance_retro_days <> 7; -- 1
--
-- 3. La vista conserva sus columnas en el mismo orden y la nueva va al final:
--    select column_name, ordinal_position from information_schema.columns
--    where table_name = 'v_school_entitlements' order by ordinal_position desc limit 2;
