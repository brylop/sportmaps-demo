-- ============================================================
-- SPORTMAPS — Activación de add-ons por super-admin (flag directo)
-- ------------------------------------------------------------
-- Modelo A (asistido): el super-admin prende/apaga módulos por escuela con un
-- switch, sin flujo de solicitud ni pago automático. Cada módulo es una fila en
-- school_addons (enabled true/false); el gating de la app reacciona solo.
--
-- Incluye:
--   1) Nuevos add-ons: accounting (Contabilidad), invoicing (Facturación DIAN).
--   2) v_school_entitlements expone has_accounting / has_invoicing.
--   3) admin_set_school_addon(school, addon, enabled) — toggle directo super-admin.
--   4) admin_set_school_plan(school, plan_code, status) — set plan directo.
-- Fecha: 2026-07-13
-- ============================================================

BEGIN;

-- ── 1. Extender el CHECK de school_addons.addon_key ─────────────────────────
DO $$
DECLARE v_name text;
BEGIN
    SELECT conname INTO v_name
      FROM pg_constraint
     WHERE conrelid = 'public.school_addons'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%addon_key%';
    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.school_addons DROP CONSTRAINT %I', v_name);
    END IF;
END $$;

ALTER TABLE public.school_addons
    ADD CONSTRAINT school_addons_addon_key_check
    CHECK (addon_key IN (
        'tournaments','access_control','biomech','nutrition','whitelabel',
        'whatsapp','wompi','mp','store',
        'accounting',   -- NUEVO: módulo Contabilidad
        'invoicing'     -- NUEVO: Facturación electrónica DIAN
    ));

-- ── 1b. Mismo CHECK en plan_upgrade_requests.requested_addon_key ────────────
DO $$
DECLARE v_name text;
BEGIN
    SELECT conname INTO v_name
      FROM pg_constraint
     WHERE conrelid = 'public.plan_upgrade_requests'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%requested_addon_key%';
    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.plan_upgrade_requests DROP CONSTRAINT %I', v_name);
    END IF;
END $$;

ALTER TABLE public.plan_upgrade_requests
    ADD CONSTRAINT plan_upgrade_requests_requested_addon_key_check
    CHECK (requested_addon_key IS NULL OR requested_addon_key IN (
        'tournaments','access_control','biomech','nutrition','whitelabel',
        'whatsapp','wompi','mp','store','accounting','invoicing'
    ));

-- ── 2. Recrear la vista con has_accounting / has_invoicing ──────────────────
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
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'store'          AND a.enabled) AS has_store,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'accounting'     AND a.enabled) AS has_accounting,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'invoicing'      AND a.enabled) AS has_invoicing
FROM public.schools s
LEFT JOIN public.school_subscriptions sub ON sub.school_id = s.id;

-- ── 3. RPC: toggle directo de un add-on (super-admin) ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_school_addon(
    p_school_id   uuid,
    p_addon_key   text,
    p_enabled     boolean,
    p_monthly_price_cents integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede activar módulos' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.school_addons (school_id, addon_key, enabled, enabled_at, disabled_at, monthly_price_cents, metadata)
    VALUES (
        p_school_id, p_addon_key, p_enabled,
        CASE WHEN p_enabled THEN now() ELSE NULL END,
        CASE WHEN p_enabled THEN NULL ELSE now() END,
        COALESCE(p_monthly_price_cents, 0),
        jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_toggle')
    )
    ON CONFLICT (school_id, addon_key) DO UPDATE
    SET enabled     = EXCLUDED.enabled,
        enabled_at  = CASE WHEN EXCLUDED.enabled THEN now() ELSE public.school_addons.enabled_at END,
        disabled_at = CASE WHEN EXCLUDED.enabled THEN NULL ELSE now() END,
        monthly_price_cents = COALESCE(p_monthly_price_cents, public.school_addons.monthly_price_cents),
        metadata    = public.school_addons.metadata || jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_toggle'),
        updated_at  = now();

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'addon_key', p_addon_key, 'enabled', p_enabled);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_school_addon(uuid, text, boolean, integer) TO authenticated;

-- ── 4. RPC: set plan directo (super-admin) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_school_plan(
    p_school_id uuid,
    p_plan_code text,
    p_status    text DEFAULT 'active'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_actor uuid := auth.uid();
    v_tier  text := CASE
        WHEN p_plan_code = 'starter'    THEN 'free'
        WHEN p_plan_code = 'enterprise' THEN 'enterprise'
        ELSE 'pro'
    END;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede cambiar el plan' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.school_subscriptions (school_id, plan_code, tier, status, metadata)
    VALUES (p_school_id, p_plan_code, v_tier, p_status,
            jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_toggle'))
    ON CONFLICT (school_id) DO UPDATE
    SET plan_code = EXCLUDED.plan_code,
        tier      = EXCLUDED.tier,
        status    = EXCLUDED.status,
        metadata  = public.school_subscriptions.metadata || jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_toggle'),
        updated_at = now();

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'plan_code', p_plan_code, 'tier', v_tier, 'status', p_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_school_plan(uuid, text, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
