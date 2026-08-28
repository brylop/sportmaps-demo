-- =============================================================================
-- 20260828174117_coach_can_create_athletes.sql
-- Autor: brylop   Fecha: 2026-08-28   Versión anterior: 20260828173903
-- Objetivo: que la ESCUELA decida si un entrenador puede dar de alta y editar
--           atletas, en vez de que lo decida el código para todas por igual.
--
-- Contexto: docs/coach-athlete-scoping.md fija como decisión de negocio firme
--   que el coach NO da de alta atletas (solo admin/owner). Carmel Club pidió
--   la excepción: sus entrenadores sí necesitan crear y editar a sus atletas.
--   Mismo patrón que 20260731152955_coach_enroll_paid_teams_toggle.sql: un
--   toggle en school_settings, evaluado en el BFF (que corre con service role
--   y por diseño salta la RLS), no en RLS.
--
-- Default `false` = comportamiento de HOY para todas las escuelas. Solo se
--   activa explícitamente para Carmel Club (374a6716-af42-4745-afe1-8d089153e01b,
--   verificado contra la base — nombre único, sin ambigüedad) en un UPDATE
--   aparte tras aplicar esta migración.
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

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_can_create_athletes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.coach_can_create_athletes IS
    'Si true, un entrenador (coach) de la escuela puede dar de alta y editar '
    'atletas — excepción a la decisión de negocio de docs/coach-athlete-scoping.md '
    '(alta exclusiva de admin/owner). Gate en el BFF '
    '(students-create-one.route.ts POST /create-one, students.ts PUT /:id), NO '
    'en RLS: el BFF corre con service role. Nunca cubre POST /students/bulk '
    '(carga masiva), que sigue siendo admin-only sin excepción. Default false '
    '= comportamiento previo a 2026-08-28 en todas las escuelas.';

-- -----------------------------------------------------------------------------
-- Exponer el flag al frontend vía v_school_entitlements, para que el botón
-- "Agregar Atleta" se muestre al coach sin depender solo del 403 del BFF.
-- CREATE OR REPLACE VIEW no permite reordenar/renombrar columnas (42P16), así
-- que se copia la definición vigente completa (confirmada contra la base con
-- pg_get_viewdef, no solo contra el repo — coincidía) y se agrega la columna
-- nueva al final, mismo patrón que 20260825232553_school_module_overrides.sql.
-- -----------------------------------------------------------------------------
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
    COALESCE(sset.coach_can_create_athletes, false) AS coach_can_create_athletes
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- Dónde se aplica el gate: en el BFF (POST /api/v1/students/create-one, PUT
-- /api/v1/students/:id), NO en RLS — mismo razonamiento que el toggle de
-- coach_can_enroll_paid_teams. La RLS de `children` (20260802224625) ya quedó
-- permisiva para cualquier staff (incluye coach) desde agosto, así que a nivel
-- de RLS pura esto no cierra ni abre nada nuevo; el control real es la ruta.
-- =============================================================================
