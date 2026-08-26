-- =============================================================================
-- 20260826110449_fix_null_guard_bypass_admin_rpcs.sql
-- Autor: brylop   Fecha: 2026-08-26   Versión anterior: 20260826110135
-- Objetivo: defensa en profundidad para las 24 RPCs admin_*/merge_split_
--   enrollments/rpc_process_upgrade_request que tenían "IF NOT
--   public.is_super_admin() THEN RAISE" — vulnerable al bypass documentado en
--   20260826112433 (is_platform_admin() podía devolver NULL). La causa raíz
--   ya se corrigió ahí (is_platform_admin() nunca vuelve a dar NULL), así que
--   esto no es lo que cierra el hueco — es blindar cada guard individualmente
--   para que no vuelva a depender de que el helper de abajo se comporte bien.
--   Cambio mecánico: "IF NOT public.is_super_admin() THEN" -> "IF
--   public.is_super_admin() IS NOT TRUE THEN" en cada una, generado por
--   sustitución de texto exacta sobre el pg_get_functiondef() vigente de cada
--   función (verificado 1 sola ocurrencia por función, sin tocar nada más del
--   cuerpo). No se reemiten GRANT/REVOKE: CREATE OR REPLACE FUNCTION no
--   resetea privilegios ya otorgados.
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

-- admin_activity_summary(timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.admin_activity_summary(p_from timestamp with time zone DEFAULT (now() - '7 days'::interval), p_to timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v jsonb;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'window', jsonb_build_object('from', p_from, 'to', p_to),
        'audit_logs_count', (
            SELECT COUNT(*) FROM public.audit_logs
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'payments_paid_count', (
            SELECT COUNT(*) FROM public.payments
            WHERE status = 'paid' AND COALESCE(approved_at, created_at) BETWEEN p_from AND p_to
        ),
        'payments_pending_count', (
            SELECT COUNT(*) FROM public.payments
            WHERE status IN ('awaiting_approval','pending') AND created_at BETWEEN p_from AND p_to
        ),
        'payments_paid_amount', (
            SELECT COALESCE(SUM(amount), 0) FROM public.payments
            WHERE status = 'paid' AND COALESCE(approved_at, created_at) BETWEEN p_from AND p_to
        ),
        'billing_events_count', (
            SELECT COUNT(*) FROM public.billing_events
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'analytics_events_count', (
            SELECT COUNT(*) FROM public.analytics_events
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'event_telemetry_count', (
            SELECT COUNT(*) FROM public.event_telemetry
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'active_schools', (
            SELECT COUNT(DISTINCT school_id) FROM public.audit_logs
            WHERE created_at BETWEEN p_from AND p_to AND school_id IS NOT NULL
        ),
        'new_users', (
            SELECT COUNT(*) FROM public.profiles
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'new_enrollments', (
            SELECT COUNT(*) FROM public.enrollments
            WHERE created_at BETWEEN p_from AND p_to
        )
    ) INTO v;

    RETURN v;
END;
$function$;

-- admin_expire_trial_now(uuid)
CREATE OR REPLACE FUNCTION public.admin_expire_trial_now(p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede expirar la prueba' USING ERRCODE = '42501';
    END IF;
    RETURN public.admin_set_trial(p_school_id, NULL, now() - interval '1 second');
END;
$function$;

-- admin_extend_trial(uuid,integer)
CREATE OR REPLACE FUNCTION public.admin_extend_trial(p_school_id uuid, p_months integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_base timestamptz;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede extender la prueba' USING ERRCODE = '42501';
    END IF;

    SELECT GREATEST(COALESCE(ss.trial_ends_at, now()), now())
      INTO v_base
      FROM public.school_subscriptions ss WHERE ss.school_id = p_school_id;

    RETURN public.admin_set_trial(
        p_school_id, NULL,
        COALESCE(v_base, now()) + (p_months || ' months')::interval
    );
END;
$function$;

-- admin_global_counts()
CREATE OR REPLACE FUNCTION public.admin_global_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v jsonb;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'total_users',          (SELECT COUNT(*) FROM public.profiles),
        'total_schools',        (SELECT COUNT(*) FROM public.schools),
        'verified_schools',     (SELECT COUNT(*) FROM public.schools WHERE verified = true),
        'total_children',       (SELECT COUNT(*) FROM public.children WHERE COALESCE(is_active, true) = true),
        'total_coaches',        (SELECT COUNT(*) FROM public.profiles WHERE role = 'coach'),
        'total_parents',        (SELECT COUNT(*) FROM public.profiles WHERE role = 'parent'),
        'total_athletes',       (SELECT COUNT(*) FROM public.profiles WHERE role = 'athlete'),
        'total_branches',       (SELECT COUNT(*) FROM public.school_branches),
        'total_enrollments',    (SELECT COUNT(*) FROM public.enrollments WHERE status = 'active'),
        'total_active_cards',   (SELECT COUNT(*) FROM public.athlete_id_cards WHERE status = 'active'),
        'total_certificates',   (SELECT COUNT(*) FROM public.athlete_certificates WHERE status = 'issued'),
        'total_join_qrs',       (SELECT COUNT(*) FROM public.school_join_qr_codes WHERE active = true),
        'payments_paid_30d',    (SELECT COUNT(*) FROM public.payments WHERE status = 'paid' AND created_at >= now() - interval '30 days'),
        'payments_pending',     (SELECT COUNT(*) FROM public.payments WHERE status IN ('pending','awaiting_approval')),
        'revenue_30d',          (SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE status = 'paid' AND created_at >= now() - interval '30 days')
    ) INTO v;

    RETURN v;
END;
$function$;

-- admin_list_analytics_events(text,uuid,timestamp with time zone,timestamp with time zone,integer,integer)
CREATE OR REPLACE FUNCTION public.admin_list_analytics_events(p_event_type text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid, p_from timestamp with time zone DEFAULT (now() - '7 days'::interval), p_to timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.analytics_events ae
    WHERE ae.created_at BETWEEN p_from AND p_to
      AND (p_event_type IS NULL OR ae.event_type = p_event_type)
      AND (p_user_id    IS NULL OR ae.user_id    = p_user_id);

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT ae.id, ae.created_at, ae.user_id, p.full_name AS user_name,
               p.role AS user_role, ae.event_type, ae.event_data, ae.page_url
        FROM public.analytics_events ae
        LEFT JOIN public.profiles p ON p.id = ae.user_id
        WHERE ae.created_at BETWEEN p_from AND p_to
          AND (p_event_type IS NULL OR ae.event_type = p_event_type)
          AND (p_user_id    IS NULL OR ae.user_id    = p_user_id)
        ORDER BY ae.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

-- admin_list_audit_logs(uuid,text,text,timestamp with time zone,timestamp with time zone,integer,integer)
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(p_school_id uuid DEFAULT NULL::uuid, p_table text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT (now() - '7 days'::interval), p_to timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.audit_logs al
    WHERE al.created_at BETWEEN p_from AND p_to
      AND (p_school_id IS NULL OR al.school_id = p_school_id)
      AND (p_table     IS NULL OR al.table_name = p_table)
      AND (p_action    IS NULL OR al.action     = p_action);

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT al.id, al.created_at, al.school_id, s.name AS school_name,
               al.profile_id, p.full_name AS actor_name, p.role AS actor_role,
               al.table_name, al.record_id, al.action, al.old_data, al.new_data
        FROM public.audit_logs al
        LEFT JOIN public.schools  s ON s.id = al.school_id
        LEFT JOIN public.profiles p ON p.id = al.profile_id
        WHERE al.created_at BETWEEN p_from AND p_to
          AND (p_school_id IS NULL OR al.school_id = p_school_id)
          AND (p_table     IS NULL OR al.table_name = p_table)
          AND (p_action    IS NULL OR al.action     = p_action)
        ORDER BY al.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

-- admin_list_billing_events(uuid,text,timestamp with time zone,timestamp with time zone,integer,integer)
CREATE OR REPLACE FUNCTION public.admin_list_billing_events(p_school_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT (now() - '30 days'::interval), p_to timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.billing_events be
    WHERE be.created_at BETWEEN p_from AND p_to
      AND (p_school_id IS NULL OR be.school_id    = p_school_id)
      AND (p_status    IS NULL OR be.status::text = p_status);

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT be.id, be.created_at, be.school_id, s.name AS school_name,
               be.enrollment_id, be.event_type, be.amount_due, be.amount_paid,
               be.late_fee_amount, be.currency, be.due_date, be.paid_date,
               be.status, be.gateway, be.gateway_reference,
               be.installment_number, be.notes
        FROM public.billing_events be
        LEFT JOIN public.schools s ON s.id = be.school_id
        WHERE be.created_at BETWEEN p_from AND p_to
          AND (p_school_id IS NULL OR be.school_id    = p_school_id)
          AND (p_status    IS NULL OR be.status::text = p_status)
        ORDER BY be.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

-- admin_list_event_telemetry(text,uuid,timestamp with time zone,timestamp with time zone,integer,integer)
CREATE OR REPLACE FUNCTION public.admin_list_event_telemetry(p_event_type text DEFAULT NULL::text, p_event_id uuid DEFAULT NULL::uuid, p_from timestamp with time zone DEFAULT (now() - '7 days'::interval), p_to timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.event_telemetry et
    WHERE et.created_at BETWEEN p_from AND p_to
      AND (p_event_type IS NULL OR et.event_type = p_event_type)
      AND (p_event_id   IS NULL OR et.event_id   = p_event_id);

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT et.id, et.created_at, et.event_id, e.title AS event_title,
               et.user_id, p.full_name AS user_name, et.event_type, et.metadata
        FROM public.event_telemetry et
        LEFT JOIN public.events    e ON e.id = et.event_id
        LEFT JOIN public.profiles  p ON p.id = et.user_id
        WHERE et.created_at BETWEEN p_from AND p_to
          AND (p_event_type IS NULL OR et.event_type = p_event_type)
          AND (p_event_id   IS NULL OR et.event_id   = p_event_id)
        ORDER BY et.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

-- admin_list_payments(uuid,text,text,timestamp with time zone,timestamp with time zone,integer,integer)
CREATE OR REPLACE FUNCTION public.admin_list_payments(p_school_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_method text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT (now() - '30 days'::interval), p_to timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.payments p
    WHERE p.created_at BETWEEN p_from AND p_to
      AND (p_school_id IS NULL OR p.school_id      = p_school_id)
      AND (p_status    IS NULL OR p.status         = p_status)
      AND (p_method    IS NULL OR p.payment_method = p_method);

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT p.id, p.created_at, p.school_id, s.name AS school_name,
               p.amount, p.status, p.payment_method, p.payment_channel,
               p.receipt_url, p.approved_at, p.approved_by,
               ap.full_name  AS approved_by_name,
               p.parent_id,  par.full_name AS parent_name,
               p.child_id,   c.full_name   AS child_name
        FROM public.payments p
        LEFT JOIN public.schools  s   ON s.id  = p.school_id
        LEFT JOIN public.profiles ap  ON ap.id = p.approved_by
        LEFT JOIN public.profiles par ON par.id = p.parent_id
        LEFT JOIN public.children c   ON c.id  = p.child_id
        WHERE p.created_at BETWEEN p_from AND p_to
          AND (p_school_id IS NULL OR p.school_id      = p_school_id)
          AND (p_status    IS NULL OR p.status         = p_status)
          AND (p_method    IS NULL OR p.payment_method = p_method)
        ORDER BY p.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

-- admin_list_schools_for_filter()
CREATE OR REPLACE FUNCTION public.admin_list_schools_for_filter()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name), '[]'::jsonb)
    INTO v_rows
    FROM public.schools;

    RETURN v_rows;
END;
$function$;

-- admin_list_schools_global(text,boolean,integer,integer)
CREATE OR REPLACE FUNCTION public.admin_list_schools_global(p_search text DEFAULT NULL::text, p_verified boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.schools s
    WHERE (p_verified IS NULL OR s.verified = p_verified)
      AND (
        p_search IS NULL OR p_search = ''
        OR s.name ILIKE '%' || p_search || '%'
        OR s.city ILIKE '%' || p_search || '%'
      );

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT s.id, s.name, s.city, s.verified, s.created_at, s.owner_id,
               (SELECT u.email FROM auth.users u WHERE u.id = s.owner_id) AS owner_email,
               (SELECT COUNT(*) FROM public.children c WHERE c.school_id = s.id AND COALESCE(c.is_active, true)) AS children_count,
               (SELECT COUNT(*) FROM public.school_branches b WHERE b.school_id = s.id) AS branches_count
        FROM public.schools s
        WHERE (p_verified IS NULL OR s.verified = p_verified)
          AND (
            p_search IS NULL OR p_search = ''
            OR s.name ILIKE '%' || p_search || '%'
            OR s.city ILIKE '%' || p_search || '%'
          )
        ORDER BY s.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

-- admin_list_trials(text,text,integer,integer)
CREATE OR REPLACE FUNCTION public.admin_list_trials(p_filtro text DEFAULT 'todas'::text, p_account_type text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(school_id uuid, school_name text, owner_email text, account_type text, plan_code text, status text, created_at timestamp with time zone, trial_ends_at timestamp with time zone, trial_months integer, dias_restantes integer, blocking_exempt boolean, blocking_exempt_reason text, is_operational boolean, atletas_activos integer, total_rows bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT
            s.id, s.name, s.account_type, s.created_at,
            p.email AS owner_email,
            COALESCE(ss.plan_code, 'starter')                             AS plan_code,
            COALESCE(ss.status, 'trialing')                               AS status,
            COALESCE(ss.trial_ends_at, s.created_at + interval '1 month') AS trial_ends_at,
            ss.trial_months,
            COALESCE(ss.blocking_exempt, false)                           AS blocking_exempt,
            ss.blocking_exempt_reason,
            public.school_is_operational(s.id)                            AS is_operational,
            (SELECT count(*) FROM public.enrollments e
              WHERE e.school_id = s.id AND e.status IN ('active','paid'))::int AS atletas_activos
          FROM public.schools s
          LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
          LEFT JOIN public.profiles p              ON p.id = s.owner_id
         WHERE NOT public.is_informational_entity(s.school_type)
    ), filtrado AS (
        SELECT * FROM base b
         WHERE (p_account_type IS NULL OR b.account_type = p_account_type)
           AND CASE p_filtro
                 WHEN 'por_vencer'  THEN b.trial_ends_at > now() AND b.trial_ends_at <= now() + interval '15 days'
                 WHEN 'vencidas'    THEN b.trial_ends_at <= now()
                 WHEN 'bloqueadas'  THEN b.is_operational = false
                 WHEN 'exentas'     THEN b.blocking_exempt = true
                 ELSE true
               END
    )
    SELECT f.id, f.name, f.owner_email, f.account_type, f.plan_code, f.status,
           f.created_at, f.trial_ends_at, f.trial_months,
           GREATEST(0, ceil(EXTRACT(epoch FROM (f.trial_ends_at - now())) / 86400))::int,
           f.blocking_exempt, f.blocking_exempt_reason, f.is_operational, f.atletas_activos,
           (SELECT count(*) FROM filtrado)
      FROM filtrado f
     ORDER BY f.trial_ends_at ASC
     LIMIT COALESCE(p_limit, 50) OFFSET COALESCE(p_offset, 0);
END;
$function$;

-- admin_list_users(text,text,integer,integer)
CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL::text, p_role text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE (p_role IS NULL OR p.role::text = p_role)
      AND (
        p_search IS NULL OR p_search = ''
        OR p.full_name ILIKE '%' || p_search || '%'
        OR u.email     ILIKE '%' || p_search || '%'
      );

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT p.id, p.full_name, p.role, u.email, u.last_sign_in_at, p.created_at
        FROM public.profiles p
        LEFT JOIN auth.users u ON u.id = p.id
        WHERE (p_role IS NULL OR p.role::text = p_role)
          AND (
            p_search IS NULL OR p_search = ''
            OR p.full_name ILIKE '%' || p_search || '%'
            OR u.email     ILIKE '%' || p_search || '%'
          )
        ORDER BY p.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

-- admin_reactivate_school(uuid,text)
CREATE OR REPLACE FUNCTION public.admin_reactivate_school(p_school_id uuid, p_plan_code text DEFAULT 'crecimiento'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede reactivar' USING ERRCODE = '42501';
    END IF;

    PERFORM public.admin_set_school_plan(p_school_id, p_plan_code, 'active');

    UPDATE public.school_subscriptions
       SET blocking_exempt        = false,
           blocking_exempt_reason = NULL,
           current_period_start   = now(),
           current_period_end     = now() + interval '1 month',
           metadata               = metadata || jsonb_build_object(
                                        'reactivated_by', v_actor::text,
                                        'reactivated_at', to_jsonb(now()), 'via', 'admin_reactivate_school'),
           updated_at             = now()
     WHERE school_id = p_school_id;

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'plan_code', p_plan_code,
                             'status', 'active', 'is_operational', public.school_is_operational(p_school_id));
END;
$function$;

-- admin_set_account_type(uuid,text)
CREATE OR REPLACE FUNCTION public.admin_set_account_type(p_school_id uuid, p_account_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede marcar el tipo de cuenta' USING ERRCODE = '42501';
    END IF;
    IF p_account_type NOT IN ('real','test','demo') THEN
        RAISE EXCEPTION 'account_type inválido: %', p_account_type USING ERRCODE = '23514';
    END IF;

    UPDATE public.schools SET account_type = p_account_type, updated_at = now() WHERE id = p_school_id;

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'account_type', p_account_type,
                             'is_operational', public.school_is_operational(p_school_id));
END;
$function$;

-- admin_set_billing_enabled(uuid,boolean)
CREATE OR REPLACE FUNCTION public.admin_set_billing_enabled(p_school_id uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
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
$function$;

-- admin_set_blocking_exempt(uuid,boolean,text)
CREATE OR REPLACE FUNCTION public.admin_set_blocking_exempt(p_school_id uuid, p_exempt boolean, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede exentar del bloqueo' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.school_subscriptions (school_id, plan_code, tier, status, blocking_exempt, blocking_exempt_reason, metadata)
    VALUES (p_school_id, 'starter', 'free', 'trialing', p_exempt, p_reason,
            jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_set_blocking_exempt'))
    ON CONFLICT (school_id) DO UPDATE
    SET blocking_exempt        = EXCLUDED.blocking_exempt,
        blocking_exempt_reason = CASE WHEN EXCLUDED.blocking_exempt THEN EXCLUDED.blocking_exempt_reason ELSE NULL END,
        metadata   = public.school_subscriptions.metadata
                     || jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_set_blocking_exempt'),
        updated_at = now();

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'blocking_exempt', p_exempt,
                             'reason', p_reason, 'is_operational', public.school_is_operational(p_school_id));
END;
$function$;

-- admin_set_saas_billing_enabled(uuid,boolean)
CREATE OR REPLACE FUNCTION public.admin_set_saas_billing_enabled(p_school_id uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_was_enabled      boolean;
    v_first_invoice_id uuid;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede activar la facturación SaaS' USING ERRCODE = '42501';
    END IF;

    SELECT saas_billing_enabled INTO v_was_enabled
      FROM public.school_subscriptions
     WHERE school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
            USING ERRCODE = '23503';
    END IF;

    UPDATE public.school_subscriptions
       SET saas_billing_enabled    = p_enabled,
           saas_billing_enabled_at = CASE WHEN p_enabled THEN now() ELSE saas_billing_enabled_at END,
           updated_at              = now()
     WHERE school_id = p_school_id;

    IF p_enabled AND NOT COALESCE(v_was_enabled, false) THEN
        v_first_invoice_id := public.generate_school_subscription_invoice(p_school_id);
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'school_id', p_school_id,
        'saas_billing_enabled', p_enabled,
        'first_invoice_id', v_first_invoice_id
    );
END;
$function$;

-- admin_set_school_addon(uuid,text,boolean,integer)
CREATE OR REPLACE FUNCTION public.admin_set_school_addon(p_school_id uuid, p_addon_key text, p_enabled boolean, p_monthly_price_cents integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
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
$function$;

-- admin_set_school_plan(uuid,text,text)
CREATE OR REPLACE FUNCTION public.admin_set_school_plan(p_school_id uuid, p_plan_code text, p_status text DEFAULT 'active'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor uuid := auth.uid();
    v_tier  text := CASE
        WHEN p_plan_code = 'starter'    THEN 'free'
        WHEN p_plan_code = 'enterprise' THEN 'enterprise'
        ELSE 'pro'
    END;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
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
$function$;

-- admin_set_school_type(uuid,text)
CREATE OR REPLACE FUNCTION public.admin_set_school_type(p_school_id uuid, p_school_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor   uuid := auth.uid();
    v_antes   text;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede cambiar el tipo de escuela' USING ERRCODE = '42501';
    END IF;

    -- Lista canónica: exactamente los valores que v_school_entitlements sabe
    -- mapear a módulos. Cualquier otro deja a la escuela sin nada.
    IF p_school_type NOT IN ('academy', 'hybrid', 'venue', 'club', 'escuela',
                             'gimnasio', 'personal_trainer') THEN
        RAISE EXCEPTION 'school_type inválido: %. Válidos: academy, hybrid, venue, club, escuela, gimnasio, personal_trainer',
            p_school_type USING ERRCODE = '23514';
    END IF;

    SELECT school_type INTO v_antes FROM public.schools WHERE id = p_school_id;
    IF v_antes IS NULL AND NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
        RAISE EXCEPTION 'la escuela % no existe', p_school_id USING ERRCODE = '23503';
    END IF;

    UPDATE public.schools
       SET school_type = p_school_type,
           updated_at  = now()
     WHERE id = p_school_id;

    -- Se devuelve el efecto REAL sobre los módulos, no lo que se pidió: cambiar
    -- el tipo prende y apaga módulos completos, y el panel tiene que mostrar la
    -- consecuencia y no solo confirmar el cambio.
    RETURN (
        SELECT jsonb_build_object(
            'ok', true,
            'school_id', p_school_id,
            'antes', v_antes,
            'ahora', p_school_type,
            'has_academy', e.has_academy,
            'has_reservations', e.has_reservations,
            'has_wallet', e.has_wallet,
            'set_by', v_actor)
          FROM public.v_school_entitlements e
         WHERE e.school_id = p_school_id
    );
END;
$function$;

-- admin_set_trial(uuid,integer,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.admin_set_trial(p_school_id uuid, p_months integer DEFAULT NULL::integer, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor    uuid := auth.uid();
    v_creada   timestamptz;
    v_ends     timestamptz;
BEGIN
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede fijar el periodo de prueba' USING ERRCODE = '42501';
    END IF;
    IF p_months IS NULL AND p_ends_at IS NULL THEN
        RAISE EXCEPTION 'indica p_months o p_ends_at' USING ERRCODE = '22023';
    END IF;

    SELECT created_at INTO v_creada FROM public.schools WHERE id = p_school_id;
    IF v_creada IS NULL THEN
        RAISE EXCEPTION 'escuela % no existe', p_school_id USING ERRCODE = '23503';
    END IF;

    v_ends := COALESCE(p_ends_at, v_creada + (p_months || ' months')::interval);

    INSERT INTO public.school_subscriptions (
        school_id, plan_code, tier, status, billing_cycle,
        trial_ends_at, trial_months, metadata
    ) VALUES (
        p_school_id, 'starter', 'free',
        CASE WHEN v_ends > now() THEN 'trialing' ELSE 'trial_expired' END,
        'monthly', v_ends, p_months,
        jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_set_trial')
    )
    ON CONFLICT (school_id) DO UPDATE
    SET trial_ends_at = EXCLUDED.trial_ends_at,
        trial_months  = COALESCE(EXCLUDED.trial_months, public.school_subscriptions.trial_months),
        -- No se pisan estados comerciales ya cerrados (active/grandfathered/past_due).
        status = CASE
            WHEN public.school_subscriptions.status IN ('trialing','trial_expired')
                THEN (CASE WHEN EXCLUDED.trial_ends_at > now() THEN 'trialing' ELSE 'trial_expired' END)
            ELSE public.school_subscriptions.status
        END,
        metadata   = public.school_subscriptions.metadata
                     || jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_set_trial'),
        updated_at = now();

    RETURN (
        SELECT jsonb_build_object(
            'ok', true, 'school_id', p_school_id,
            'trial_ends_at', ss.trial_ends_at, 'trial_months', ss.trial_months,
            'status', ss.status,
            'dias_restantes', GREATEST(0, ceil(EXTRACT(epoch FROM (ss.trial_ends_at - now())) / 86400))::int,
            'is_operational', public.school_is_operational(p_school_id))
          FROM public.school_subscriptions ss WHERE ss.school_id = p_school_id
    );
END;
$function$;

-- merge_split_enrollments(uuid,boolean)
CREATE OR REPLACE FUNCTION public.merge_split_enrollments(p_school_id uuid DEFAULT NULL::uuid, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_caller     uuid := auth.uid();
    v_grp        record;
    v_survivor   uuid;
    v_team       uuid;
    v_plan       uuid;
    v_sessions   int;
    v_sessions2  int;
    v_descartes  uuid[];
    v_planes     uuid[];
    v_equipos    uuid[];
    v_acciones   jsonb := '[]'::jsonb;
    v_revision   jsonb := '[]'::jsonb;
    v_fusionados int := 0;
    v_canceladas int := 0;
BEGIN
    -- Autorización: super admin siempre; admin de escuela solo sobre la suya. Sin
    -- p_school_id hace falta ser super admin: fusionar a ciegas toda la base no es
    -- algo que deba poder disparar el admin de un club.
    IF v_caller IS NOT NULL THEN
        IF p_school_id IS NULL THEN
            IF public.is_super_admin() IS NOT TRUE THEN
                RAISE EXCEPTION 'Sin p_school_id hace falta ser super admin.';
            END IF;
        ELSIF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
            RAISE EXCEPTION 'No autorizado para esta escuela.';
        END IF;
    END IF;

    FOR v_grp IN
        SELECT e.school_id,
               COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) AS subject,
               count(*) AS activas
        FROM public.enrollments e
        WHERE e.status = 'active'
          AND (p_school_id IS NULL OR e.school_id = p_school_id)
          AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
        GROUP BY 1, 2
        HAVING count(*) > 1
        ORDER BY 1, 2
    LOOP
        -- Planes y equipos DISTINTOS que tiene el atleta ahora mismo.
        SELECT array_agg(DISTINCT e.offering_plan_id) FILTER (WHERE e.offering_plan_id IS NOT NULL),
               array_agg(DISTINCT e.team_id)          FILTER (WHERE e.team_id IS NOT NULL)
          INTO v_planes, v_equipos
          FROM public.enrollments e
         WHERE e.status = 'active'
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject;

        -- Ambiguo: dos planes o dos equipos. No se decide por script.
        IF COALESCE(array_length(v_planes, 1), 0) > 1
           OR COALESCE(array_length(v_equipos, 1), 0) > 1 THEN
            v_revision := v_revision || jsonb_build_object(
                'school_id', v_grp.school_id,
                'atleta',    v_grp.subject,
                'activas',   v_grp.activas,
                'planes',    COALESCE(array_length(v_planes, 1), 0),
                'equipos',   COALESCE(array_length(v_equipos, 1), 0),
                'motivo',    CASE
                               WHEN COALESCE(array_length(v_planes, 1), 0) > 1
                                 THEN 'dos planes distintos: no se puede saber cuál paga'
                               ELSE 'dos equipos distintos: multi-categoría, cerrado hasta MOD-3'
                             END
            );
            CONTINUE;
        END IF;

        -- Superviviente: la que tiene plan; si ninguna lo tiene, la más antigua que
        -- al menos tenga equipo; si todas son huérfanas, la más antigua a secas.
        SELECT e.id INTO v_survivor
          FROM public.enrollments e
         WHERE e.status = 'active'
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject
         ORDER BY (e.offering_plan_id IS NOT NULL) DESC,   -- el plan gobierna el cobro
                  (e.team_id IS NOT NULL)          DESC,   -- antes que una huérfana
                  e.created_at ASC                         -- la más antigua: carga el historial
         LIMIT 1;

        -- Lo que la superviviente debe absorber, y los créditos ya consumidos: se
        -- toma el GREATEST, si no el atleta recupera sesiones que ya usó.
        SELECT v_planes[1],
               v_equipos[1],
               max(COALESCE(e.sessions_used, 0)),
               max(COALESCE(e.secondary_sessions_used, 0)),
               array_agg(e.id) FILTER (WHERE e.id <> v_survivor)
          INTO v_plan, v_team, v_sessions, v_sessions2, v_descartes
          FROM public.enrollments e
         WHERE e.status = 'active'
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject;

        v_acciones := v_acciones || jsonb_build_object(
            'school_id',  v_grp.school_id,
            'atleta',     v_grp.subject,
            'activas',    v_grp.activas,
            'sobrevive',  v_survivor,
            'se_cancelan', to_jsonb(v_descartes),
            'queda_con',  jsonb_build_object('team_id', v_team, 'offering_plan_id', v_plan)
        );

        IF NOT p_dry_run THEN
            -- 1) Cancelar PRIMERO. Los índices únicos son parciales (status='active'):
            --    al revés, mover el plan revienta con 23505.
            UPDATE public.enrollments
               SET status = 'cancelled',
                   end_date = CURRENT_DATE,
                   updated_at = now()
             WHERE id = ANY (v_descartes);
            v_canceladas := v_canceladas + COALESCE(array_length(v_descartes, 1), 0);

            -- 2) Y recién ahora consolidar en la que queda. `monthly_fee` no se toca
            --    (ver el encabezado).
            UPDATE public.enrollments
               SET team_id                 = COALESCE(team_id, v_team),
                   offering_plan_id        = COALESCE(offering_plan_id, v_plan),
                   sessions_used           = GREATEST(COALESCE(sessions_used, 0), COALESCE(v_sessions, 0)),
                   secondary_sessions_used = GREATEST(COALESCE(secondary_sessions_used, 0), COALESCE(v_sessions2, 0)),
                   updated_at              = now()
             WHERE id = v_survivor;
            v_fusionados := v_fusionados + 1;
        ELSE
            v_fusionados := v_fusionados + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'dry_run',          p_dry_run,
        'school_id',        p_school_id,
        'atletas_fusionados', v_fusionados,
        'filas_canceladas', CASE WHEN p_dry_run THEN NULL ELSE v_canceladas END,
        'a_revision',       jsonb_array_length(v_revision),
        'acciones',         v_acciones,
        'revision',         v_revision
    );
END;
$function$;

-- rpc_process_upgrade_request(uuid,text,integer,text)
CREATE OR REPLACE FUNCTION public.rpc_process_upgrade_request(p_request_id uuid, p_notes text DEFAULT NULL::text, p_amount_cents integer DEFAULT NULL::integer, p_contact_method text DEFAULT 'whatsapp'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_req       public.plan_upgrade_requests%ROWTYPE;
    v_processor uuid := auth.uid();
    v_result    jsonb;
BEGIN
    -- Solo super_admin puede procesar
    IF public.is_super_admin() IS NOT TRUE THEN
        RAISE EXCEPTION 'solo super_admin puede procesar upgrade requests'
            USING ERRCODE = '42501';
    END IF;

    -- Lock del request para evitar doble procesamiento
    SELECT * INTO v_req
    FROM public.plan_upgrade_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'upgrade request % no existe', p_request_id
            USING ERRCODE = '02000';
    END IF;

    IF v_req.status = 'processed' THEN
        RAISE EXCEPTION 'request % ya fue procesado', p_request_id
            USING ERRCODE = '23000';
    END IF;

    -- Aplica el cambio segun el tipo
    IF v_req.request_type = 'plan_upgrade' OR v_req.request_type = 'plan_downgrade' THEN
        UPDATE public.school_subscriptions
        SET plan_code = COALESCE(v_req.requested_plan_code, plan_code),
            tier = CASE
                WHEN v_req.requested_plan_code = 'starter'      THEN 'free'
                WHEN v_req.requested_plan_code = 'enterprise'   THEN 'enterprise'
                WHEN v_req.requested_plan_code IS NOT NULL      THEN 'pro'
                ELSE tier
            END,
            status = 'active',
            billing_cycle = COALESCE(v_req.requested_billing_cycle, billing_cycle),
            metadata = metadata || jsonb_build_object(
                'last_upgrade_request_id', p_request_id::text,
                'last_processed_by',       v_processor::text,
                'last_processed_at',       to_jsonb(now())
            )
        WHERE school_id = v_req.school_id;
    ELSIF v_req.request_type = 'addon_activate' AND v_req.requested_addon_key IS NOT NULL THEN
        INSERT INTO public.school_addons (school_id, addon_key, enabled, monthly_price_cents, metadata)
        VALUES (
            v_req.school_id,
            v_req.requested_addon_key,
            true,
            COALESCE(p_amount_cents, 0),
            jsonb_build_object('activated_via_request', p_request_id::text)
        )
        ON CONFLICT (school_id, addon_key) DO UPDATE
        SET enabled = true,
            enabled_at = now(),
            disabled_at = NULL,
            monthly_price_cents = COALESCE(p_amount_cents, public.school_addons.monthly_price_cents);
    ELSIF v_req.request_type = 'addon_deactivate' AND v_req.requested_addon_key IS NOT NULL THEN
        UPDATE public.school_addons
        SET enabled = false,
            disabled_at = now()
        WHERE school_id = v_req.school_id
          AND addon_key = v_req.requested_addon_key;
    END IF;

    -- Marca el request como procesado
    UPDATE public.plan_upgrade_requests
    SET status           = 'processed',
        processed_by     = v_processor,
        processed_at     = now(),
        processed_notes  = p_notes,
        processed_amount_cents = p_amount_cents,
        contact_method   = p_contact_method
    WHERE id = p_request_id;

    v_result := jsonb_build_object(
        'request_id', p_request_id,
        'status', 'processed',
        'school_id', v_req.school_id,
        'request_type', v_req.request_type,
        'processed_at', now()
    );

    RETURN v_result;
END;
$function$;

-- NOTA: el 2do guard de merge_split_enrollments (ELSIF NOT (is_super_admin()
-- OR is_school_admin(...))) y las ~30 funciones con el patrón "IF NOT
-- (is_super_admin() OR is_school_admin(...))" (equipment_*, carnets/
-- certificados, school leads, join QRs, trial slots, memberships,
-- open_month/preview_open_month, payment aging/kpis) NO se tocan acá — quedan
-- cubiertas por el fix de raíz en is_platform_admin() (20260826112433):
-- is_super_admin() ya nunca vuelve NULL, así que esos OR ya no pueden dar
-- NULL tampoco. Verificado empíricamente contra la base tras aplicar ambas
-- migraciones (ver reporte al usuario).

NOTIFY pgrst, 'reload schema';

COMMIT;
