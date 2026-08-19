-- =============================================================================
-- 20260814105131_pwa_branding_sin_herencia_de_whitelabel.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814104612
-- Objetivo: corregir has_pwa_branding para que dependa SOLO del addon
--           `pwa_branding`, sin heredarlo de `whitelabel`.
--
-- Qué salió mal en 20260814104612: se modeló "la app nativa de marca blanca
-- incluye el branding del PWA" como un OR dentro de la vista. La regla es cierta
-- comercialmente, pero 28 escuelas —casi todas de prueba— ya tenían el addon
-- `whitelabel` encendido por grandfathering, así que el OR les activó el PWA con
-- marca de golpe: 29 escuelas con has_pwa_branding en vez de la única que lo
-- compró. Se perdió la propiedad que justificaba el diseño (la fila del addon es
-- la allowlist del rollout).
--
-- Decisión: la equivalencia es una regla de OTORGAMIENTO, no de lectura. Cuando
-- una escuela contrata `whitelabel` se le insertan AMBAS filas; la vista se
-- limita a leer lo que hay. Filas explícitas > OR implícito: así el inventario
-- de quién tiene qué se responde con un SELECT a school_addons y no hay que
-- recordar reglas escondidas en una vista.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- has_pwa_branding pasa a leer únicamente el addon 'pwa_branding'.
--
-- Se reescribe la vista completa porque CREATE OR REPLACE VIEW exige repetir
-- todas las columnas en el mismo orden. Lo único que cambia es la última.
-- ─────────────────────────────────────────────────────────────────────────────
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
    -- SOLO el addon propio. Contratar `whitelabel` debe insertar tambien la fila
    -- 'pwa_branding' en el momento del alta; la vista no lo infiere.
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'pwa_branding'::text AND a.enabled)) AS has_pwa_branding
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id;

COMMENT ON VIEW public.v_school_entitlements IS
    'Entitlements efectivos por escuela (tier + addons). has_pwa_branding lee '
    'SOLO el addon pwa_branding: al contratar whitelabel hay que insertar ambas '
    'filas, la vista no hereda una de la otra (ver 20260814105131).';

COMMIT;
