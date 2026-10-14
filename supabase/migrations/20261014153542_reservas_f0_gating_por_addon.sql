-- =============================================================================
-- 20261014153542_reservas_f0_gating_por_addon.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014153538
-- Objetivo: habilitar "reservas" como CAPACIDAD (addon), no como tipo de escuela
--   (M3 del plan docs/specs/reservas-canchas-f0-plan-migraciones.md).
--
--   Verificado en vivo el 2026-10-14: school_type tiene 9 valores (club 83,
--   federation 79, institute 62, …) y ningún 'venue'. Normalizarlo movería 290+
--   escuelas y su ruteo de dashboard. En cambio:
--     · has_reservations / has_wallet = school_type 'venue' OR addon 'reservations'.
--     · has_entitlement() y v_school_entitlements pasan a decir lo MISMO (antes la
--       vista incluía 'gimnasio' y la función no).
--     · CHECK en school_type con los valores vivos + 'venue': deja de entrar basura
--       sin mover a nadie.
--   Radio: hoy ven reservas Dreamers Gymnastics y Carmel Club (hybrid) y VOLK FIT
--   CLUB (gimnasio), las tres con 0 reservas. Reciben el addon aquí mismo para no
--   perder nada.
-- =============================================================================

BEGIN;

-- addon nuevo
ALTER TABLE public.school_addons DROP CONSTRAINT IF EXISTS school_addons_addon_key_check;
ALTER TABLE public.school_addons
  ADD CONSTRAINT school_addons_addon_key_check
  CHECK (addon_key IN ('tournaments','access_control','biomech','nutrition','whitelabel',
                       'pwa_branding','whatsapp','wompi','mp','store','accounting','invoicing',
                       'reservations'));

-- Quienes hoy ven reservas no las pierden.
INSERT INTO public.school_addons (school_id, addon_key, enabled)
SELECT s.id, 'reservations', true
  FROM public.schools s
 WHERE s.school_type IN ('hybrid','gimnasio')
   AND NOT EXISTS (SELECT 1 FROM public.school_addons a
                    WHERE a.school_id = s.id AND a.addon_key = 'reservations');

-- school_type: valores vivos + venue. NOT VALID no hace falta: todos cumplen hoy.
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_school_type_check;
ALTER TABLE public.schools
  ADD CONSTRAINT schools_school_type_check
  CHECK (school_type IS NULL OR school_type IN
    ('academy','club','federation','institute','personal_trainer','association',
     'hybrid','gimnasio','escuela','venue'));

-- has_entitlement: misma regla que la vista.
CREATE OR REPLACE FUNCTION public.has_entitlement(p_school_id uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    -- Modulos base derivados del tipo de escuela.
    -- reservations / wallet: club que solo alquila (venue) o cualquier escuela
    -- con el addon 'reservations' (SportMaps Canchas, 2026-10-14).
    SELECT CASE p_key
        WHEN 'academy'      THEN COALESCE(s.school_type IN ('academy','hybrid') OR s.school_type IS NULL, true)
        WHEN 'reservations' THEN s.school_type = 'venue' OR EXISTS (
                                   SELECT 1 FROM public.school_addons a
                                    WHERE a.school_id = p_school_id
                                      AND a.addon_key = 'reservations' AND a.enabled = true)
        WHEN 'wallet'       THEN s.school_type = 'venue' OR EXISTS (
                                   SELECT 1 FROM public.school_addons a
                                    WHERE a.school_id = p_school_id
                                      AND a.addon_key = 'reservations' AND a.enabled = true)
        ELSE EXISTS (
            SELECT 1
              FROM public.school_addons a
             WHERE a.school_id = p_school_id
               AND a.addon_key = p_key
               AND a.enabled = true
        )
    END
    FROM public.schools s
    WHERE s.id = p_school_id;
$$;

-- La vista: idéntica a la viva salvo has_reservations / has_wallet.
CREATE OR REPLACE VIEW public.v_school_entitlements
WITH (security_invoker = true) AS
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
    (s.school_type = 'venue'::text OR (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'reservations'::text AND a.enabled))) AS has_reservations,
    (s.school_type = 'venue'::text OR (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'reservations'::text AND a.enabled))) AS has_wallet,
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

COMMIT;
