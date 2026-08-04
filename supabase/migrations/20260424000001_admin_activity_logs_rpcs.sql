-- Migration: 20260424000001_admin_activity_logs_rpcs.sql
-- Description: Sprint 1 — Logs globales para super-admin (solo lectura).
--   Crea helper is_super_admin() y un set de RPCs SECURITY DEFINER que
--   exponen audit_logs / payments / billing_events / analytics_events /
--   event_telemetry de toda la plataforma a usuarios con role IN
--   ('admin','super_admin'). No modifica RLS ni inserta datos.

-- ============================================================================
-- 1. Helper: is_super_admin()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

COMMENT ON FUNCTION public.is_super_admin() IS
    'Returns true iff caller has profile.role in (admin, super_admin). Used by admin_* RPCs.';


-- ============================================================================
-- 2. Resumen agregado para el dashboard del super-admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_activity_summary(
    p_from timestamptz DEFAULT (now() - interval '7 days'),
    p_to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
BEGIN
    IF NOT public.is_super_admin() THEN
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_activity_summary(timestamptz, timestamptz) TO authenticated;


-- ============================================================================
-- 3. Listados paginados — auditoría DB
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(
    p_school_id uuid     DEFAULT NULL,
    p_table     text     DEFAULT NULL,
    p_action    text     DEFAULT NULL,
    p_from      timestamptz DEFAULT (now() - interval '7 days'),
    p_to        timestamptz DEFAULT now(),
    p_limit     int      DEFAULT 50,
    p_offset    int      DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF NOT public.is_super_admin() THEN
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
        SELECT
            al.id,
            al.created_at,
            al.school_id,
            s.name        AS school_name,
            al.profile_id,
            p.full_name   AS actor_name,
            p.role        AS actor_role,
            al.table_name,
            al.record_id,
            al.action,
            al.old_data,
            al.new_data
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 4. Listado paginado — payments globales
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_payments(
    p_school_id uuid     DEFAULT NULL,
    p_status    text     DEFAULT NULL,
    p_method    text     DEFAULT NULL,
    p_from      timestamptz DEFAULT (now() - interval '30 days'),
    p_to        timestamptz DEFAULT now(),
    p_limit     int      DEFAULT 50,
    p_offset    int      DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF NOT public.is_super_admin() THEN
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
        SELECT
            p.id,
            p.created_at,
            p.school_id,
            s.name           AS school_name,
            p.amount,
            p.status,
            p.payment_method,
            p.payment_channel,
            p.receipt_url,
            p.approved_at,
            p.approved_by,
            ap.full_name     AS approved_by_name,
            p.parent_id,
            par.full_name    AS parent_name,
            p.child_id,
            c.full_name      AS child_name
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_payments(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 5. Listado paginado — billing events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_billing_events(
    p_school_id uuid     DEFAULT NULL,
    p_status    text     DEFAULT NULL,
    p_from      timestamptz DEFAULT (now() - interval '30 days'),
    p_to        timestamptz DEFAULT now(),
    p_limit     int      DEFAULT 50,
    p_offset    int      DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.billing_events be
    WHERE be.created_at BETWEEN p_from AND p_to
      AND (p_school_id IS NULL OR be.school_id   = p_school_id)
      AND (p_status    IS NULL OR be.status::text = p_status);

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            be.id,
            be.created_at,
            be.school_id,
            s.name              AS school_name,
            be.enrollment_id,
            be.event_type,
            be.amount_due,
            be.amount_paid,
            be.late_fee_amount,
            be.currency,
            be.due_date,
            be.paid_date,
            be.status,
            be.gateway,
            be.gateway_reference,
            be.installment_number,
            be.notes
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_billing_events(uuid, text, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 6. Listado paginado — analytics_events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_analytics_events(
    p_event_type text DEFAULT NULL,
    p_user_id    uuid DEFAULT NULL,
    p_from       timestamptz DEFAULT (now() - interval '7 days'),
    p_to         timestamptz DEFAULT now(),
    p_limit      int  DEFAULT 50,
    p_offset     int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF NOT public.is_super_admin() THEN
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
        SELECT
            ae.id,
            ae.created_at,
            ae.user_id,
            p.full_name AS user_name,
            p.role      AS user_role,
            ae.event_type,
            ae.event_data,
            ae.page_url
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_analytics_events(text, uuid, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 7. Listado paginado — event_telemetry (eventos deportivos)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_event_telemetry(
    p_event_type text DEFAULT NULL,
    p_event_id   uuid DEFAULT NULL,
    p_from       timestamptz DEFAULT (now() - interval '7 days'),
    p_to         timestamptz DEFAULT now(),
    p_limit      int  DEFAULT 50,
    p_offset     int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF NOT public.is_super_admin() THEN
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
        SELECT
            et.id,
            et.created_at,
            et.event_id,
            e.title    AS event_title,
            et.user_id,
            p.full_name AS user_name,
            et.event_type,
            et.metadata
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_event_telemetry(text, uuid, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 8. Listado de escuelas distintas (para filtros)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_schools_for_filter()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name), '[]'::jsonb)
    INTO v_rows
    FROM public.schools;

    RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_schools_for_filter() TO authenticated;
