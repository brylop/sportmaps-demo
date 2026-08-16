-- ============================================================================
-- SPORTMAPS — Interruptor maestro de cobros a familias, por escuela
--
-- Fecha: 2026-08-15
-- Motivo: Club Carmel arranca prueba el 19/08. Sus membresías se pagan EN EL
-- CLUB, no por SportMaps, y la escuela formativa tampoco factura por nosotros.
-- Todo lo de mensualidades y cartera no debe aparecerles. Y esto se repite con
-- los próximos clientes de este tipo, así que va como capacidad, no como parche.
--
-- ── Por qué un booleano y no un addon ───────────────────────────────────────
-- Los addons de `school_addons` son OPT-IN. Crear uno de 'billing' obligaría a
-- prendérselo a las 364 escuelas existentes para que el default no les apague la
-- cartera a todas — un accidente esperando. Un booleano con DEFAULT true no
-- cambia nada para nadie, salvo a quien se lo apaguen.
--
-- Tampoco sirve `school_settings.active_modules`: es aditivo (prende
-- capacidades extra, no apaga el núcleo), está poblado en 1 de 365 escuelas, y
-- hoy lo puede modificar el propio dueño vía PATCH /school/context/modules.
-- Este flag es del super admin.
--
-- ── Por qué los crons NO se tocan ───────────────────────────────────────────
-- Los tres motores ya consultan su toggle por escuela:
--   generate_monthly_charges → school_settings.auto_generate_payments
--   apply_late_fees          → school_settings.late_fee_enabled
--   send_payment_reminders   → school_settings.reminder_enabled
-- En vez de reescribir tres funciones grandes (con el riesgo que eso implica),
-- un trigger fuerza esos tres toggles a false mientras billing_enabled sea
-- false. Los crons quedan igual y la garantía es más fuerte: aunque alguien
-- vuelva a prender un sub-toggle desde la UI, el trigger lo apaga otra vez.
-- ============================================================================

BEGIN;

-- ── 1. El interruptor ───────────────────────────────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS billing_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.school_settings.billing_enabled IS
    'false = la escuela NO cobra mensualidades por SportMaps: se le ocultan Pagos, '
    'Finanzas y Recordatorios, y ningún cron le genera cartera ni mora. '
    'Los datos existentes no se borran: al reactivar vuelven a verse. '
    'Lo controla el super admin (admin_set_billing_enabled), no la escuela.';


-- ── 2. El trigger que hace real el apagado ──────────────────────────────────
-- Fuerza los tres sub-toggles a false mientras el maestro esté apagado. Así los
-- crons existentes saltan la escuela sin que haya que modificarlos.
CREATE OR REPLACE FUNCTION public.enforce_billing_disabled()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.billing_enabled IS FALSE THEN
        NEW.auto_generate_payments := false;
        NEW.late_fee_enabled       := false;
        NEW.reminder_enabled       := false;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_billing_disabled() IS
    'Mientras school_settings.billing_enabled sea false, apaga auto_generate_payments, '
    'late_fee_enabled y reminder_enabled. Es lo que hace que los crons de cobro, mora y '
    'recordatorios salten la escuela SIN tener que reescribirlos: ya filtran por esos toggles.';

DROP TRIGGER IF EXISTS trg_enforce_billing_disabled ON public.school_settings;
CREATE TRIGGER trg_enforce_billing_disabled
    BEFORE INSERT OR UPDATE ON public.school_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_billing_disabled();


-- ── 3. Exponerlo en la vista de entitlements ────────────────────────────────
-- ⚠ CREATE OR REPLACE VIEW no deja reordenar ni renombrar columnas (42P16).
--   Las 31 existentes van EXACTAMENTE igual y `has_billing` entra como la 32.
--   Se suma un LEFT JOIN a school_settings (1:1 por school_id).
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
          WHERE a.school_id = s.id
            AND a.addon_key = ANY (ARRAY['pwa_branding'::text, 'whitelabel'::text])
            AND a.enabled)) AS has_pwa_branding,
    -- Nuevo (32). Sin fila de settings se asume que SÍ cobra: es el
    -- comportamiento histórico y el de las 364 escuelas actuales.
    COALESCE(sset.billing_enabled, true) AS has_billing
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

COMMENT ON VIEW public.v_school_entitlements IS
    'Entitlements por escuela: plan, addons, estado del periodo de prueba y capacidades '
    'derivadas del school_type. has_billing=false → la escuela no cobra mensualidades por '
    'SportMaps y se le ocultan Pagos, Finanzas y Recordatorios.';


-- ── 4. El switch del super admin ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_billing_enabled(
    p_school_id uuid,
    p_enabled   boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede activar o desactivar los cobros' USING ERRCODE = '42501';
    END IF;

    -- UPDATE directo y no upsert: las 365 escuelas ya tienen fila de settings
    -- (verificado), y un ON CONFLICT (school_id) dependería de que exista una
    -- constraint única que no está confirmada — fallaría en runtime si no está.
    UPDATE public.school_settings
       SET billing_enabled = p_enabled,
           updated_at      = now()
     WHERE school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la escuela % no tiene fila en school_settings', p_school_id
            USING ERRCODE = '23503';
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'ok', true,
            'school_id', p_school_id,
            'billing_enabled', ss.billing_enabled,
            -- Se devuelven los tres sub-toggles para que el panel muestre el
            -- efecto real y no lo que asumió: el trigger ya los forzó.
            'auto_generate_payments', ss.auto_generate_payments,
            'late_fee_enabled', ss.late_fee_enabled,
            'reminder_enabled', ss.reminder_enabled,
            'set_by', v_actor)
          FROM public.school_settings ss WHERE ss.school_id = p_school_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_billing_enabled(uuid, boolean) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación: nadie debería quedar apagado por esta migración.
-- ────────────────────────────────────────────────────────────────────────────
SELECT count(*) FILTER (WHERE has_billing)       AS cobran,
       count(*) FILTER (WHERE NOT has_billing)   AS no_cobran
  FROM public.v_school_entitlements;
