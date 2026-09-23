-- =============================================================================
-- 20260922224444_unblock_payment_y_payouts_usan_is_platform_admin.sql
-- Autor: judegor99   Fecha: 2026-09-22   Versión anterior: 20260922223853
-- Objetivo: unblock_payment() y admin_generate_pending_payouts() seguían
-- chequeando profiles.role = 'admin' como atajo de staff de plataforma, en
-- vez de is_platform_admin() — la migración 20260824165639 ya había migrado
-- 16 policies del mismo patrón, pero estas dos RPCs quedaron afuera.
--
-- HALLAZGO (auditoría 2026-09-22, ver docs/auditoria-seguridad-2026-08-14.md,
-- Adenda 2026-09-22): `profiles.role='admin'` es un rol de ESCUELA, no de
-- plataforma — es exactamente lo que causó el incidente documentado en
-- 20260824165639 (`spiritfontibon@gmail.com`, dueña de una escuela con
-- role='admin', podía leer/escribir tablas de plataforma). Hoy
-- `select count(*) from profiles where role='admin'` da 0, así que no es
-- explotable en este momento — pero es la misma clase de bug, a una
-- asignación de rol de distancia de repetirse, y ya mordió una vez.
--
-- FIX: ambas RPCs pasan a usar is_platform_admin() (consulta la tabla
-- platform_admins / app_metadata.platform_admin, no profiles.role — ver
-- is_super_admin(), que ya delega en la misma función desde antes de esta
-- migración aunque el repo nunca tuvo esa versión commiteada).
--
-- admin_generate_pending_payouts() de paso corrige su search_path
-- ('public' solo) al estándar del repo (pg_catalog, public, pg_temp) —
-- desviación señalada en la auditoría, no explotable por sí sola (pg_catalog
-- se busca implícito de todos modos) pero sin motivo para dejarla así.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_generate_pending_payouts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_vendor      RECORD;
    v_min_amount  numeric;
    v_created     integer := 0;
    v_total       numeric := 0;
BEGIN
    IF to_regclass('public.profiles')         IS NULL
    OR to_regclass('public.vendor_balances')  IS NULL
    OR to_regclass('public.vendor_profiles')  IS NULL
    OR to_regclass('public.vendor_payouts')   IS NULL THEN
        RETURN jsonb_build_object('error','missing_dependencies','message','Faltan tablas base.');
    END IF;

    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Solo admin de plataforma.' USING ERRCODE = '42501';
    END IF;

    IF to_regclass('public.platform_config') IS NOT NULL THEN
        SELECT (value->>'amount')::numeric INTO v_min_amount
          FROM public.platform_config WHERE key = 'min_payout_amount';
    END IF;
    v_min_amount := COALESCE(v_min_amount, 50000);

    FOR v_vendor IN
        EXECUTE $q$
            SELECT vb.vendor_profile_id, vp.user_id, vb.available_balance
              FROM public.vendor_balances vb
              JOIN public.vendor_profiles vp ON vp.id = vb.vendor_profile_id
             WHERE vb.available_balance >= $1
               AND ( $2::boolean = false
                  OR EXISTS (
                      SELECT 1 FROM public.vendor_bank_accounts
                       WHERE vendor_profile_id = vb.vendor_profile_id
                         AND is_default = true AND is_active = true
                  ) )
        $q$ USING v_min_amount, (to_regclass('public.vendor_bank_accounts') IS NOT NULL)
    LOOP
        EXECUTE $q$
            INSERT INTO public.vendor_payouts (
                vendor_id, gross_amount, sportmaps_fee, wompi_fee, net_amount, currency, status, notes
            ) VALUES ($1, $2, 0, 0, $2, 'COP', 'pending', 'Auto-generado por admin_generate_pending_payouts.')
        $q$ USING v_vendor.user_id, v_vendor.available_balance;

        UPDATE public.vendor_balances
           SET available_balance = 0,
               total_withdrawn   = total_withdrawn + v_vendor.available_balance,
               updated_at        = now()
         WHERE vendor_profile_id = v_vendor.vendor_profile_id;

        IF to_regclass('public.settlements') IS NOT NULL THEN
            UPDATE public.settlements
               SET status = 'paid', paid_at = now()
             WHERE vendor_profile_id = v_vendor.vendor_profile_id
               AND status = 'processing';
        END IF;

        v_created := v_created + 1;
        v_total   := v_total   + v_vendor.available_balance;
    END LOOP;

    RETURN jsonb_build_object('payouts_created', v_created, 'total_amount', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unblock_payment(p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor UUID;
    v_authorized BOOLEAN := false;
BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    IF public.is_platform_admin() THEN
        v_authorized := true;
    END IF;

    IF p_kind = 'payment' THEN
        IF NOT v_authorized THEN
            SELECT EXISTS (
                SELECT 1 FROM public.payments p
                JOIN public.schools s ON s.id = p.school_id
                WHERE p.id = p_id
                  AND (s.owner_id = v_actor OR public.is_school_admin(p.school_id))
            ) INTO v_authorized;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        UPDATE public.payments
        SET requires_review = false,
            unblocked_at = NOW(),
            unblocked_by = v_actor,
            updated_at = NOW()
        WHERE id = p_id;

    ELSIF p_kind = 'marketplace_transaction' THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
            RETURN jsonb_build_object('ok', false, 'error', 'marketplace_transactions_not_available');
        END IF;
        IF NOT v_authorized THEN
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.marketplace_transactions mt WHERE mt.id = $1 AND mt.vendor_id = $2)'
                INTO v_authorized USING p_id, v_actor;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        EXECUTE 'UPDATE public.marketplace_transactions SET requires_review = false, unblocked_at = NOW(), unblocked_by = $1, updated_at = NOW() WHERE id = $2'
            USING v_actor, p_id;

    ELSIF p_kind = 'order' THEN
        IF NOT v_authorized THEN
            SELECT EXISTS (
                SELECT 1 FROM public.orders o
                WHERE o.id = p_id
                  AND (o.vendor_id = v_actor
                       OR EXISTS (SELECT 1 FROM public.order_items oi
                                  WHERE oi.order_id = o.id AND oi.vendor_id = v_actor))
            ) INTO v_authorized;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        UPDATE public.orders
        SET requires_review = false,
            unblocked_at = NOW(),
            unblocked_by = v_actor,
            updated_at = NOW()
        WHERE id = p_id;

    ELSE
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_kind');
    END IF;

    RETURN jsonb_build_object('ok', true, 'kind', p_kind, 'id', p_id, 'unblocked_by', v_actor);
END;
$function$;

-- Verificación dura: ninguna de las dos debe seguir mencionando profiles.role
-- en su definición.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname IN ('admin_generate_pending_payouts', 'unblock_payment')
          AND pronamespace = 'public'::regnamespace
          AND pg_get_functiondef(oid) ILIKE '%profiles.role%'
    ) THEN
        RAISE EXCEPTION 'admin_generate_pending_payouts/unblock_payment siguen leyendo profiles.role.';
    END IF;
END $$;

COMMIT;
