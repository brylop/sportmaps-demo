-- ============================================================
-- SPORTMAPS — Pre-F0 SaaS: school_subscriptions + school_addons
--                          + v_school_entitlements + has_entitlement
--
-- Implementa la base del roadmap Pre-F0 para activar:
--   1. Tracking del plan SaaS por escuela (Starter / Crecimiento /
--      Profesional / Elite / Enterprise).
--   2. Addons ortogonales activables por escuela (tournaments,
--      access_control, biomech, wompi, mp, whitelabel, whatsapp).
--   3. Vista v_school_entitlements que deriva los modulos
--      disponibles a partir de schools.school_type + addons.
--   4. Helper has_entitlement(school_id, key) para gating en RPCs
--      y middleware BFF (modo audit por defecto).
--
-- Decision firme "nadie pierde acceso": en el backfill todas las
-- escuelas existentes se marcan tier='pro', plan_code='profesional',
-- status='grandfathered'. Eso garantiza paridad con el estado actual
-- (acceso completo). No corta nada.
--
-- school_type ya existe en schools y por defecto vale 'academy' —
-- no creamos columna `kind` separada. Cuando arranque Reservas
-- normalizamos los valores a {academy, venue, hybrid}.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tabla school_subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.school_subscriptions (
    id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id                       uuid        NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
    plan_code                       text        NOT NULL DEFAULT 'starter'
                                                CHECK (plan_code IN ('starter','crecimiento','profesional','elite','enterprise')),
    tier                            text        NOT NULL DEFAULT 'free'
                                                CHECK (tier IN ('free','pro','enterprise')),
    status                          text        NOT NULL DEFAULT 'active'
                                                CHECK (status IN ('active','trialing','trial_expired','past_due','cancelled','grandfathered')),
    billing_cycle                   text        NOT NULL DEFAULT 'monthly'
                                                CHECK (billing_cycle IN ('monthly','annual')),
    trial_ends_at                   timestamptz,
    current_period_start            timestamptz,
    current_period_end              timestamptz,
    payment_provider                text                  CHECK (payment_provider IN ('wompi','mp','manual')),
    payment_provider_subscription_id text,
    cancelled_at                    timestamptz,
    cancellation_reason             text,
    metadata                        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at                      timestamptz NOT NULL DEFAULT now(),
    updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_subscriptions_status ON public.school_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_trial_ends ON public.school_subscriptions(trial_ends_at)
    WHERE status = 'trialing';

COMMENT ON TABLE public.school_subscriptions IS
    'Suscripcion SaaS por escuela. Una sola fila por school_id. '
    'status=grandfathered → cuenta existente antes del rollout de planes, no se le cobra. '
    'status=trialing + trial_ends_at → arrancando 30 dias sin tarjeta (decision Pre-F0).';

-- ============================================================
-- 2. Tabla school_addons
-- ============================================================

CREATE TABLE IF NOT EXISTS public.school_addons (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    addon_key           text        NOT NULL
                                    CHECK (addon_key IN ('tournaments','access_control','biomech','nutrition','whitelabel','whatsapp','wompi','mp')),
    enabled             boolean     NOT NULL DEFAULT true,
    enabled_at          timestamptz NOT NULL DEFAULT now(),
    disabled_at         timestamptz,
    monthly_price_cents integer     NOT NULL DEFAULT 0,
    metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, addon_key)
);

CREATE INDEX IF NOT EXISTS idx_school_addons_school ON public.school_addons(school_id) WHERE enabled = true;

COMMENT ON TABLE public.school_addons IS
    'Addons ortogonales activables por escuela. monthly_price_cents=0 → grandfathering o addon incluido en plan superior.';

-- ============================================================
-- 3. Funcion has_entitlement
--
-- SECURITY DEFINER porque la usan RPCs y triggers que pueden
-- correr con roles distintos. STABLE porque no escribe.
-- search_path fijo para evitar el warning del linter.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_entitlement(p_school_id uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    -- Modulos base derivados del tipo de escuela.
    -- has_academy: academias y hibridas. Default 'academy' en schools.school_type
    -- cubre 100% del estado actual.
    -- has_reservations / has_wallet: solo cuando se active Reservas (F1+).
    SELECT CASE p_key
        WHEN 'academy'      THEN COALESCE(s.school_type IN ('academy','hybrid') OR s.school_type IS NULL, true)
        WHEN 'reservations' THEN s.school_type IN ('venue','hybrid')
        WHEN 'wallet'       THEN s.school_type IN ('venue','hybrid')
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

COMMENT ON FUNCTION public.has_entitlement(uuid, text) IS
    'Retorna TRUE si la escuela tiene activo el modulo/addon dado. '
    'Modulos derivados: academy, reservations, wallet (de schools.school_type). '
    'Addons: tournaments, access_control, biomech, whitelabel, whatsapp, wompi, mp (de school_addons). '
    'Uso: middleware BFF requireEntitlement, gating en RPCs.';

GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid, text) TO authenticated;

-- ============================================================
-- 4. Vista v_school_entitlements
--
-- SECURITY INVOKER → RLS de schools/school_subscriptions/
-- school_addons aplica al caller. Estandar nuevo del proyecto
-- desde ronda 4 del linter.
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
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'mp'             AND a.enabled) AS has_mp
FROM public.schools s
LEFT JOIN public.school_subscriptions sub ON sub.school_id = s.id;

COMMENT ON VIEW public.v_school_entitlements IS
    'Vista unificada de modulos + addons activos por escuela. '
    'has_academy / has_reservations / has_wallet derivan de schools.school_type. '
    'El resto sale de school_addons. Lectura via hook useEntitlements y endpoint /api/v1/me/entitlements.';

-- ============================================================
-- 5. RLS school_subscriptions
--
-- Lectura: admins de la escuela + super_admin.
-- Escritura: solo super_admin / service_role. La escuela no
-- modifica directo su plan — pasa por BFF que valida pago y
-- ejecuta como service_role.
-- ============================================================

ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_subscriptions_select_admin ON public.school_subscriptions;
CREATE POLICY school_subscriptions_select_admin
    ON public.school_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        public.is_school_admin(school_id)
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS school_subscriptions_super_admin_all ON public.school_subscriptions;
CREATE POLICY school_subscriptions_super_admin_all
    ON public.school_subscriptions
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ============================================================
-- 6. RLS school_addons (mismo modelo)
-- ============================================================

ALTER TABLE public.school_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_addons FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_addons_select_admin ON public.school_addons;
CREATE POLICY school_addons_select_admin
    ON public.school_addons
    FOR SELECT
    TO authenticated
    USING (
        public.is_school_admin(school_id)
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS school_addons_super_admin_all ON public.school_addons;
CREATE POLICY school_addons_super_admin_all
    ON public.school_addons
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ============================================================
-- 7. Trigger updated_at en ambas tablas
--
-- Reusamos public.set_updated_at() que ya existe en el schema base
-- (definida en 20260217000001_schema_refactored.sql) en vez de
-- crear un duplicado. Si el linter marca search_path faltante en
-- esa funcion, se atiende en la pasada de hardening — no es
-- responsabilidad de esta migracion.
-- ============================================================

DROP TRIGGER IF EXISTS school_subscriptions_set_updated_at ON public.school_subscriptions;
CREATE TRIGGER school_subscriptions_set_updated_at
    BEFORE UPDATE ON public.school_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS school_addons_set_updated_at ON public.school_addons;
CREATE TRIGGER school_addons_set_updated_at
    BEFORE UPDATE ON public.school_addons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8. Grandfathering — Plan A + C (decision 2026-05-13)
--
-- Dos rutas segun is_demo:
--
--   8a. schools.is_demo = TRUE
--       → plan_code='enterprise', tier='enterprise'
--       → ADEMAS se insertan todos los addons en school_addons a $0
--       Razon: clubes de prueba/demo necesitan acceso total para QA,
--       demos a clientes, y screenshots de marketing. La migracion
--       no debe degradar lo que ya estaban probando.
--
--   8b. schools.is_demo = FALSE (o NULL)
--       → plan_code='profesional', tier='pro'
--       → NO se insertan addons (auditoria manual si la escuela ya
--         estaba usando algun addon antes del rollout)
--       Razon: cumple "nadie pierde acceso" para el catalogo base
--       sin abrir features Elite/addons que nunca pagaron.
--
-- Decision firme "nadie pierde acceso": ninguna escuela existente
-- ve menos funciones cuando los gates entren en prod. Las que
-- queden cortas (Profesional grandfathered intentando usar feature
-- Elite o addon) reciben el modal Tipo 1/3 con CTA a /admin/mi-plan.
-- ============================================================

-- 8a. Demo schools → enterprise + todos los addons a $0
INSERT INTO public.school_subscriptions (
    school_id,
    plan_code,
    tier,
    status,
    billing_cycle,
    metadata
)
SELECT
    s.id,
    'enterprise',
    'enterprise',
    'grandfathered',
    'monthly',
    jsonb_build_object(
        'grandfathered_at',     to_jsonb(now()),
        'grandfathered_reason', 'pre_f0_rollout_2026_05_13_demo',
        'is_demo',              true
    )
FROM public.schools s
WHERE COALESCE(s.is_demo, false) = true
  AND NOT EXISTS (
      SELECT 1 FROM public.school_subscriptions sub WHERE sub.school_id = s.id
  );

INSERT INTO public.school_addons (
    school_id,
    addon_key,
    enabled,
    monthly_price_cents,
    metadata
)
SELECT
    s.id,
    addon,
    true,
    0,  -- $0: grandfathering, no se cobra
    jsonb_build_object(
        'grandfathered_at',     to_jsonb(now()),
        'grandfathered_reason', 'pre_f0_rollout_2026_05_13_demo'
    )
FROM public.schools s
CROSS JOIN unnest(ARRAY[
    'tournaments',
    'access_control',
    'biomech',
    'nutrition',
    'whitelabel',
    'whatsapp',
    'wompi',
    'mp'
]) AS addon
WHERE COALESCE(s.is_demo, false) = true
ON CONFLICT (school_id, addon_key) DO NOTHING;

-- 8b. Real schools → profesional grandfathered (sin addons automaticos)
INSERT INTO public.school_subscriptions (
    school_id,
    plan_code,
    tier,
    status,
    billing_cycle,
    metadata
)
SELECT
    s.id,
    'profesional',
    'pro',
    'grandfathered',
    'monthly',
    jsonb_build_object(
        'grandfathered_at',     to_jsonb(now()),
        'grandfathered_reason', 'pre_f0_rollout_2026_05_13',
        'is_demo',              false
    )
FROM public.schools s
WHERE COALESCE(s.is_demo, false) = false
  AND NOT EXISTS (
      SELECT 1 FROM public.school_subscriptions sub WHERE sub.school_id = s.id
  );

-- ============================================================
-- 9. Refresh PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload config';

COMMIT;
