-- ============================================================
-- SPORTMAPS — Trigger de signup: school_subscriptions default
--
-- Bug observado en stg: las escuelas que se registran post-rollout
-- (despues de la migracion 20260513000007 que hizo backfill de las
-- existentes) NO reciben fila en school_subscriptions. Resultado:
-- v_school_entitlements retorna COALESCE('starter','free') pero el
-- frontend nunca aplica gating real porque la fila no existe — los
-- hooks que se apoyan en school_subscriptions ven "vacio" y degradan
-- a "acceso abierto".
--
-- Decision: toda escuela nueva arranca con
--   plan_code='starter', tier='free', status='trialing',
--   trial_ends_at = now() + 30 dias, billing_cycle='monthly'.
--
-- 30 dias sin tarjeta (acuerdo Pre-F0). Al expirar el trial el cron
-- de Fase 6 marcara status='trial_expired' y bajara funcionalidades.
-- Por ahora /mi-plan muestra countdown + flujo "Activar mi plan".
--
-- Migracion IDEMPOTENTE y NO degrada escuelas existentes:
--   - INSERT usa ON CONFLICT DO NOTHING.
--   - Backfill solo toca escuelas SIN fila previa (no pisa
--     grandfathered ni demos).
-- ============================================================

BEGIN;


-- ============================================================
-- 1. Funcion create_default_school_subscription()
--
-- SECURITY DEFINER porque school_subscriptions tiene RLS que solo
-- permite escritura al super_admin / service_role. El trigger corre
-- en contexto del owner de la funcion para sortear esa restriccion
-- y dejar la fila lista para la escuela.
-- search_path fijo: estandar nuevo desde ronda 4 del linter.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_default_school_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
    INSERT INTO public.school_subscriptions (
        school_id,
        plan_code,
        tier,
        status,
        billing_cycle,
        trial_ends_at,
        metadata
    ) VALUES (
        NEW.id,
        'starter',
        'free',
        'trialing',
        'monthly',
        now() + interval '30 days',
        jsonb_build_object(
            'created_via',   'signup_trigger',
            'trial_started', to_jsonb(now())
        )
    )
    ON CONFLICT (school_id) DO NOTHING;

    RETURN NEW;
END;
$body$;

COMMENT ON FUNCTION public.create_default_school_subscription() IS
    'Trigger AFTER INSERT ON schools: crea school_subscriptions con plan starter, '
    'tier free y trial de 30 dias sin tarjeta. Idempotente via ON CONFLICT. '
    'Antes de este trigger las escuelas nuevas no recibian fila y se les daba '
    'acceso abierto por bug.';


-- ============================================================
-- 2. Trigger en public.schools
--
-- AFTER INSERT (no BEFORE) porque necesitamos NEW.id final
-- post-default de gen_random_uuid().
-- ============================================================

DROP TRIGGER IF EXISTS schools_create_default_subscription ON public.schools;
CREATE TRIGGER schools_create_default_subscription
    AFTER INSERT ON public.schools
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_school_subscription();


-- ============================================================
-- 3. Backfill defensivo
--
-- Las escuelas creadas despues del rollout (2026-05-13) pero antes
-- de este trigger no recibieron fila — eran el agujero del bug.
-- Las llenamos como si hubieran pasado por el trigger.
-- La migracion 20260513000007 ya cubrio las pre-rollout
-- (grandfathered profesional/pro o enterprise para demos), asi que
-- el WHERE NOT EXISTS solo agarra el hueco temporal.
-- ============================================================

INSERT INTO public.school_subscriptions (
    school_id,
    plan_code,
    tier,
    status,
    billing_cycle,
    trial_ends_at,
    metadata
)
SELECT
    s.id,
    'starter',
    'free',
    'trialing',
    'monthly',
    now() + interval '30 days',
    jsonb_build_object(
        'created_via',     'backfill_signup_trigger',
        'trial_started',   to_jsonb(now()),
        'backfill_reason', 'post_rollout_signup_gap'
    )
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.school_subscriptions sub WHERE sub.school_id = s.id
);


-- ============================================================
-- 4. Refresh PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload config';

COMMIT;
