-- =============================================================================
-- 20260814104612_addon_pwa_branding_en_entitlements.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260813180537
-- Objetivo: separar el "PWA con marca de la escuela" del addon `whitelabel`.
--
--   `whitelabel` = app NATIVA de marca blanca (producto mayor, se factura aparte).
--   `pwa_branding` = al instalar la PWA aparece el logo y el nombre de la escuela.
--
-- Se vendió lo segundo (CLUB DEPORTIVO BESSER, 2026-08-13) y no existía la pieza
-- para representarlo: el único gate disponible era `whitelabel`, que habría
-- otorgado de más. Esta migración crea el addon propio y lo expone en
-- v_school_entitlements para que el form de Marca y el manifest dinámico puedan
-- gatear por (whitelabel OR pwa_branding).
--
-- Efecto colateral buscado: la fila de school_addons ES la allowlist del rollout.
-- Sin fila no hay branding, así que encenderlo no toca a las escuelas que hoy
-- pasan el gate de tier por grandfathering.
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
-- 1. Ampliar el CHECK de addon_key con 'pwa_branding'
--
-- El catálogo de addons es text + CHECK (convención del repo, no CREATE TYPE),
-- así que agregar un valor implica reemplazar la constraint. Se listan todos los
-- valores vigentes + el nuevo; no se quita ninguno.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.school_addons
    DROP CONSTRAINT IF EXISTS school_addons_addon_key_check;

ALTER TABLE public.school_addons
    ADD CONSTRAINT school_addons_addon_key_check CHECK (
        addon_key = ANY (ARRAY[
            'tournaments'::text,
            'access_control'::text,
            'biomech'::text,
            'nutrition'::text,
            'whitelabel'::text,
            'pwa_branding'::text,
            'whatsapp'::text,
            'wompi'::text,
            'mp'::text,
            'store'::text,
            'accounting'::text,
            'invoicing'::text
        ])
    );

COMMENT ON CONSTRAINT school_addons_addon_key_check ON public.school_addons IS
    'Catálogo de addons facturables. pwa_branding (PWA con marca de la escuela) '
    'es DISTINTO de whitelabel (app nativa de marca blanca) — no confundirlos: '
    'whitelabel implica pwa_branding, pero no al revés.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Exponer has_pwa_branding en v_school_entitlements
--
-- CREATE OR REPLACE VIEW exige conservar nombre, tipo y ORDEN de las columnas
-- existentes; las nuevas solo pueden ir al final. Por eso has_pwa_branding queda
-- después de is_operational aunque su lugar "natural" fuera junto a
-- has_whitelabel. No reordenar: rompería la replace y obligaría a un DROP que se
-- llevaría por delante a los dependientes.
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
    -- Nuevo. La app nativa de marca blanca incluye el branding del PWA, así que
    -- `whitelabel` cuenta como pwa_branding sin necesitar dos filas de addon.
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id
            AND a.addon_key = ANY (ARRAY['pwa_branding'::text, 'whitelabel'::text])
            AND a.enabled)) AS has_pwa_branding
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id;

COMMENT ON VIEW public.v_school_entitlements IS
    'Entitlements efectivos por escuela (tier + addons). has_pwa_branding es true '
    'con el addon pwa_branding O con whitelabel (la app nativa lo incluye).';

COMMIT;
