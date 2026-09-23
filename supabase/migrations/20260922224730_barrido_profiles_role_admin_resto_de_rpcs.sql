-- =============================================================================
-- 20260922224730_barrido_profiles_role_admin_resto_de_rpcs.sql
-- Autor: judegor99   Fecha: 2026-09-22   Versión anterior: 20260922224444
-- Objetivo: barrido sistemático del patrón profiles.role='admin' como atajo
-- de plataforma (el mismo que se cerró en unblock_payment/
-- admin_generate_pending_payouts, 20260922224444) sobre el resto de pg_proc.
--
-- Encontrados con:
--   select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and pg_get_functiondef(p.oid) ~*
--     '(profiles\.)?role\s*=\s*''admin''|role\s+IN\s*\(''admin'',\s*''super_admin''\)|role::text\s*=\s*''admin''';
--
-- Cuatro resultados, cuatro fixes:
--
-- 1) is_admin() — mismo patrón exacto que is_super_admin(): delega en
--    is_platform_admin(). Sin consumidores en la base (ni policies ni otras
--    funciones la llaman hoy — verificado), pero su ACL incluye anon Y
--    authenticated: quien la conecte mañana sin revisar el cuerpo hereda el
--    bug ya cerrado en otro lado. Se corrige igual, por las dudas.
--
-- 2) _glosa_actor_is_admin(p_actor, p_school_id) — gatea create_glosa,
--    resolve_glosa, conciliate_glosa, reopen_glosa, reconcile_statement
--    (dinero: glosas y conciliación de pagos). Tenía DOS ramas: la de
--    school_members SÍ acota por escuela (correcta, no se toca); la de
--    profiles.role IN ('admin','super_admin') NO — cualquier cuenta con
--    ese rol resolvía glosas de CUALQUIER escuela. IMPORTANTE: a diferencia
--    de unblock_payment, esta función recibe el actor como PARÁMETRO
--    (p_actor), no via auth.uid() — se llama con el cliente service_role y
--    el actor resuelto en el BFF (mismo patrón que reconcile_statement). Por
--    eso el fix NO puede ser is_platform_admin() (que mira auth.uid() de la
--    sesión, no p_actor) — se inlinea el chequeo contra platform_admins
--    parametrizado por p_actor.
--
-- 3) approve_refund(p_refund_id) — misma familia que unblock_payment (usa
--    auth.uid() directo, no p_actor), mismo fix: is_platform_admin(). Tenía
--    ADEMÁS un segundo bug del mismo tipo en la rama de pagos:
--    `v_actor_role IN ('school_admin','owner')` sin correlacionar con la
--    escuela `s` del pago — cualquier school_admin de CUALQUIER escuela
--    podía aprobar el reembolso de un pago de otra. Se reemplaza por
--    is_school_admin(s.id).
--    Nota aparte (no es un hallazgo de seguridad, es un bug funcional ya
--    documentado para hermanos suyos como vendor_payout_summary): el único
--    caller conocido, bff/src/routes/marketplace-checkout.routes.ts:654,
--    invoca con el cliente `supabase` que es SIEMPRE service_role (ver
--    bff/src/config/supabase.ts) — auth.uid() ahí es NULL, así que hoy este
--    RPC devuelve 'unauthenticated' en cada llamada real, esté como esté
--    el chequeo de rol. El fix no lo revive ni lo rompe más: lo deja
--    correcto para el día que se conecte con el JWT del usuario.
--
-- 4) tg_notify_super_admin_on_upgrade_request() — NO es un gate de
--    autorización (es un trigger que solo manda notificaciones), así que no
--    es un hallazgo de seguridad — pero notifica a quien tenga
--    profiles.role='admin' (rol de ESCUELA) en vez de a platform_admins.
--    Si algún día una escuela real tiene ese rol, sus dueños empezarían a
--    recibir notificaciones de solicitudes de upgrade de OTRAS escuelas.
--    Se corrige por consistencia con el resto del barrido.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
-- =============================================================================

BEGIN;

-- 1) is_admin() — delega en is_platform_admin(), mismo patrón que is_super_admin().
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT public.is_platform_admin();
$function$;

-- 2) _glosa_actor_is_admin(p_actor, p_school_id) — la rama de school_members
-- se preserva intacta; la rama global pasa de profiles.role a platform_admins,
-- parametrizada por p_actor (no auth.uid(), esta función no lo usa).
CREATE OR REPLACE FUNCTION public._glosa_actor_is_admin(p_actor uuid, p_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.school_members
        WHERE profile_id = p_actor
          AND school_id = p_school_id
          AND role IN ('owner', 'admin')
          AND status = 'active'
    ) OR EXISTS (
        SELECT 1 FROM public.platform_admins
        WHERE profile_id = p_actor AND is_active = true
    );
$function$;

-- 3) approve_refund(p_refund_id) — usa auth.uid() (no p_actor): is_platform_admin()
-- es el fix correcto acá. Además corrige la rama de pagos, que comparaba
-- v_actor_role contra 'school_admin'/'owner' sin acotar por la escuela del pago.
CREATE OR REPLACE FUNCTION public.approve_refund(p_refund_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor UUID := auth.uid();
    v_refund RECORD;
    v_authorized BOOLEAN := false;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;

    IF v_refund.status != 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
    END IF;

    IF public.is_platform_admin() THEN v_authorized := true; END IF;

    IF NOT v_authorized AND v_refund.order_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='orders' AND column_name='vendor_id'
        ) THEN
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = $1 AND o.vendor_id = $2)'
                INTO v_authorized USING v_refund.order_id, v_actor;
        END IF;
    END IF;

    IF NOT v_authorized AND v_refund.transaction_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions')
    THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.marketplace_transactions mt WHERE mt.id = $1 AND mt.vendor_id = $2)'
            INTO v_authorized USING v_refund.transaction_id, v_actor;
    END IF;

    IF NOT v_authorized AND v_refund.payment_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.payments p
            JOIN public.schools s ON s.id = p.school_id
            WHERE p.id = v_refund.payment_id AND (s.owner_id = v_actor OR public.is_school_admin(s.id))
        ) INTO v_authorized;
    END IF;

    IF NOT v_authorized THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;

    UPDATE public.refunds
    SET status = 'processing',
        processed_by = v_actor,
        updated_at = NOW()
    WHERE id = p_refund_id;

    RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id);
END;
$function$;

-- 4) tg_notify_super_admin_on_upgrade_request() — notifica a platform_admins,
-- no a profiles.role='admin'. No es un gate de autorización, es cosmético.
CREATE OR REPLACE FUNCTION public.tg_notify_super_admin_on_upgrade_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_school_name text;
    v_requester_email text;
    v_title text;
    v_body  text;
BEGIN
    SELECT name INTO v_school_name FROM public.schools WHERE id = NEW.school_id;
    SELECT email INTO v_requester_email FROM auth.users WHERE id = NEW.requested_by;

    v_title := CASE NEW.request_type
        WHEN 'plan_upgrade'      THEN 'Solicitud de upgrade de plan'
        WHEN 'plan_downgrade'    THEN 'Solicitud de cambio de plan'
        WHEN 'addon_activate'    THEN 'Solicitud de activacion de addon'
        WHEN 'addon_deactivate'  THEN 'Solicitud de baja de addon'
        WHEN 'payment_update'    THEN 'Solicitud de actualizacion de pago'
        WHEN 'contact_sales'     THEN 'Lead de ventas'
        ELSE 'Solicitud de plan'
    END;

    v_body := COALESCE(v_school_name, 'Escuela') || ' (' || COALESCE(v_requester_email, 'sin email') || ') pidio: '
            || COALESCE(NEW.requested_plan_code, NEW.requested_addon_key, NEW.request_type);

    INSERT INTO public.notifications (user_id, school_id, type, title, message, link)
    SELECT
        pa.profile_id,
        NEW.school_id,
        'upgrade_request',
        v_title,
        v_body,
        '/admin/upgrade-requests/' || NEW.id::text
    FROM public.platform_admins pa
    WHERE pa.is_active = true;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo notificar super_admin para request %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- Verificación dura: ninguna debe seguir leyendo profiles.role para decidir
-- admin de plataforma.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname IN ('is_admin', '_glosa_actor_is_admin', 'approve_refund', 'tg_notify_super_admin_on_upgrade_request')
          AND pronamespace = 'public'::regnamespace
          AND (pg_get_functiondef(oid) ILIKE '%profiles.role%' OR pg_get_functiondef(oid) ILIKE '%p.role = ''admin''%')
    ) THEN
        RAISE EXCEPTION 'Alguna de las 4 funciones sigue leyendo profiles.role.';
    END IF;
END $$;

COMMIT;
