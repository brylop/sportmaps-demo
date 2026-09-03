-- =============================================================================
-- 20260903170318_military_discount_besser_only.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260903151225
-- Objetivo: el descuento "Fuerza Militar 10%" en el modal de edición de
-- atleta (SchoolStudentsManagementPage) es un botón global sin ningún gate
-- por escuela — lo ve y lo puede aplicar cualquier escuela (Dynasty Volley
-- Club incluida). Nace como excepción de UNA escuela (Club Deportivo Besser,
-- descuento a familiares de militares) y quedó expuesto a todas por
-- descuido. Mismo patrón que 20260903144504 (coach_hide_financial_info):
-- un toggle nuevo en school_settings, default false = oculto para todas,
-- activado solo para Besser con el UPDATE de abajo.
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
    ADD COLUMN IF NOT EXISTS military_discount_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.military_discount_enabled IS
    'Si true, el modal de edición de atleta (SchoolStudentsManagementPage) '
    'muestra el botón "Descuento Fuerza Militar (10%)". Sin este flag el '
    'descuento era global (bug: cualquier escuela lo veía y lo podía aplicar). '
    'Default false = oculto para todas; activado solo para Club Deportivo '
    'Besser con el UPDATE de abajo.';

UPDATE public.school_settings
SET military_discount_enabled = true
WHERE school_id = '759eee9d-05cb-4958-b84a-2560f77e3683'; -- CLUB DEPORTIVO BESSER, mismo id que 20260903144504

-- Exponer el flag al frontend vía v_school_entitlements. CREATE OR REPLACE
-- VIEW no permite reordenar/renombrar columnas (42P16), así que se copia la
-- definición vigente (pg_get_viewdef, verificada igual al repo en
-- 20260903144504) y se agrega la columna nueva al final.
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
    COALESCE(sset.military_discount_enabled, false) AS military_discount_enabled
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;

-- =============================================================================
-- Verificación (correr después de aplicar):
--   select school_id, military_discount_enabled from v_school_entitlements
--   where military_discount_enabled = true;
--   -- debe devolver 1 fila (Besser, 759eee9d-05cb-4958-b84a-2560f77e3683).
-- =============================================================================
