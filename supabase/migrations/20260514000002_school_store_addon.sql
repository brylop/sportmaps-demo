-- ============================================================
-- SPORTMAPS — Tienda para escuelas pasa a ser addon pago
--
-- Decision (2026-05-14): el rol `school` NO debe tener vendor_profile
-- auto-creado con tienda activa. La tienda para escuelas es un upgrade
-- pago al plan de gestion. Se activa desde /mi-plan o configuraciones,
-- pasa por plan_upgrade_requests, super_admin procesa el cobro y
-- recien ahi school_addons.store queda enabled.
--
-- Esta migracion:
--   1. Saca `school` del trigger auto_create_vendor_profile.
--      Los otros 3 roles vendedores (external_vendor, wellness_professional,
--      personal_trainer) SI siguen auto-creando vendor_profile porque
--      vender es el punto de esos roles.
--   2. Agrega 'store' al CHECK constraint de school_addons.addon_key
--      y de plan_upgrade_requests.requested_addon_key.
--   3. Agrega has_store a v_school_entitlements.
--   4. Backfill: las escuelas demo (que recibieron vendor_profile auto)
--      reciben tambien addon store enabled a $0 para grandfathering.
--
-- NO toca vendor_profiles existentes de escuelas reales — esos se
-- revisan manualmente segun decision del usuario.
-- ============================================================

BEGIN;


-- ============================================================
-- 1. Sacar `school` del trigger auto_create_vendor_profile
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_vendor_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
    -- Solo los roles "vendedores explicitos" reciben vendor_profile auto.
    -- `school` queda EXCLUIDO: la tienda escolar es addon pago via /mi-plan.
    IF NEW.role::text IN ('external_vendor', 'wellness_professional', 'personal_trainer') THEN
        INSERT INTO public.vendor_profiles (
            user_id,
            vendor_type,
            display_name,
            capabilities
        ) VALUES (
            NEW.id,
            CASE NEW.role::text
                WHEN 'external_vendor'        THEN 'store'::public.vendor_type
                WHEN 'wellness_professional'  THEN 'wellness'::public.vendor_type
                WHEN 'personal_trainer'       THEN 'personal_trainer'::public.vendor_type
            END,
            COALESCE(NEW.full_name, NEW.email, 'Vendedor'),
            CASE NEW.role::text
                WHEN 'external_vendor'        THEN '{"can_sell_products": true,  "can_sell_services": false}'::jsonb
                WHEN 'wellness_professional'  THEN '{"can_sell_products": false, "can_sell_services": true}'::jsonb
                WHEN 'personal_trainer'       THEN '{"can_sell_products": false, "can_sell_services": true}'::jsonb
            END
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$body$;

COMMENT ON FUNCTION public.auto_create_vendor_profile() IS
    'Auto-crea vendor_profile activo SOLO para roles explicitamente vendedores '
    '(external_vendor, wellness_professional, personal_trainer). El rol `school` '
    'queda fuera: requiere activacion via addon `store` en /mi-plan.';


-- ============================================================
-- 2. Agregar 'store' al CHECK constraint de school_addons.addon_key
-- ============================================================

DO $$
DECLARE
    v_constraint_name text;
BEGIN
    SELECT conname INTO v_constraint_name
      FROM pg_constraint
     WHERE conrelid = 'public.school_addons'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) LIKE '%addon_key%';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.school_addons DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END $$;

ALTER TABLE public.school_addons
    ADD CONSTRAINT school_addons_addon_key_check
    CHECK (addon_key IN (
        'tournaments',
        'access_control',
        'biomech',
        'nutrition',
        'whitelabel',
        'whatsapp',
        'wompi',
        'mp',
        'store'  -- NUEVO: tienda como addon pago para escuelas
    ));


-- ============================================================
-- 3. Agregar 'store' al CHECK de plan_upgrade_requests.requested_addon_key
-- ============================================================

DO $$
DECLARE
    v_constraint_name text;
BEGIN
    SELECT conname INTO v_constraint_name
      FROM pg_constraint
     WHERE conrelid = 'public.plan_upgrade_requests'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) LIKE '%requested_addon_key%';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.plan_upgrade_requests DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END $$;

ALTER TABLE public.plan_upgrade_requests
    ADD CONSTRAINT plan_upgrade_requests_requested_addon_key_check
    CHECK (requested_addon_key IS NULL OR requested_addon_key IN (
        'tournaments',
        'access_control',
        'biomech',
        'nutrition',
        'whitelabel',
        'whatsapp',
        'wompi',
        'mp',
        'store'
    ));


-- ============================================================
-- 4. Recrear v_school_entitlements con has_store
-- ============================================================

CREATE OR REPLACE VIEW public.v_school_entitlements
WITH (security_invoker = true) AS
SELECT
    s.id                                                                AS school_id,
    s.school_type,
    COALESCE(sub.plan_code, 'starter')                                  AS plan_code,
    COALESCE(sub.tier, 'free')                                          AS tier,
    COALESCE(sub.status, 'active')                                      AS subscription_status,
    sub.trial_ends_at,
    sub.current_period_start,
    sub.current_period_end,
    sub.billing_cycle,
    (s.school_type IN ('academy','hybrid') OR s.school_type IS NULL)    AS has_academy,
    (s.school_type IN ('venue','hybrid'))                               AS has_reservations,
    (s.school_type IN ('venue','hybrid'))                               AS has_wallet,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'tournaments'    AND a.enabled) AS has_tournaments,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'access_control' AND a.enabled) AS has_access_control,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'biomech'        AND a.enabled) AS has_biomech,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'nutrition'      AND a.enabled) AS has_nutrition,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'whitelabel'     AND a.enabled) AS has_whitelabel,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'whatsapp'       AND a.enabled) AS has_whatsapp,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'wompi'          AND a.enabled) AS has_wompi,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'mp'             AND a.enabled) AS has_mp,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'store'          AND a.enabled) AS has_store
FROM public.schools s
LEFT JOIN public.school_subscriptions sub ON sub.school_id = s.id;

COMMENT ON VIEW public.v_school_entitlements IS
    'Vista unificada de modulos + addons activos por escuela. '
    'has_store: tienda dentro de la escuela (addon pago, opt-in via /mi-plan).';


-- ============================================================
-- 5. Grandfathering: escuelas demo que ya tenian vendor_profile
--    auto-creado reciben addon store a $0 para que nada se rompa
--    en sus dashboards de prueba.
-- ============================================================

INSERT INTO public.school_addons (
    school_id,
    addon_key,
    enabled,
    monthly_price_cents,
    metadata
)
SELECT DISTINCT
    sm.school_id,
    'store',
    true,
    0,
    jsonb_build_object(
        'grandfathered_at',     to_jsonb(now()),
        'grandfathered_reason', 'school_store_addon_rollout_2026_05_14_demo'
    )
  FROM public.schools           s
  JOIN public.school_members    sm ON sm.school_id = s.id
  JOIN public.vendor_profiles   vp ON vp.user_id   = sm.profile_id
 WHERE COALESCE(s.is_demo, false) = true
   AND vp.is_active = true
   AND vp.vendor_type = 'school'
ON CONFLICT (school_id, addon_key) DO NOTHING;


-- ============================================================
-- 6. Refresh PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload config';

COMMIT;
