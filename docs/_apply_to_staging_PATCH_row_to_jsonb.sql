-- =============================================================================
-- PATCH: row_to_jsonb(t) -> to_jsonb(t)
-- =============================================================================
-- PostgreSQL no resuelve row_to_jsonb(t) cuando 't' es alias de subquery
-- ("function row_to_jsonb(record) does not exist"). to_jsonb es mas permisivo
-- y acepta cualquier tipo, incluido un record/composite.
--
-- Este script reemplaza SOLO las funciones afectadas. Como son CREATE OR
-- REPLACE no rompe nada existente. Ejecutalo una vez en el SQL Editor de
-- staging (luebjarufsiadojhvxgi).
-- =============================================================================

-- =============================================================================
-- Sprint 1 — admin_activity_logs_rpcs (5 funciones)
-- =============================================================================

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
$$;


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
$$;


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
$$;


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
$$;


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
$$;


-- =============================================================================
-- Sprint 2 — athlete_id_cards (2 funciones)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_athlete_id_cards(
    p_school_id uuid,
    p_status    text DEFAULT NULL,
    p_search    text DEFAULT NULL,
    p_limit     int  DEFAULT 50,
    p_offset    int  DEFAULT 0
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
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.athlete_id_cards aic
    LEFT JOIN public.children c ON c.id = aic.child_id
    LEFT JOIN public.profiles p ON p.id = aic.profile_id
    WHERE aic.school_id = p_school_id
      AND (p_status IS NULL OR aic.status = p_status)
      AND (
        p_search IS NULL OR p_search = ''
        OR c.full_name ILIKE '%' || p_search || '%'
        OR p.full_name ILIKE '%' || p_search || '%'
        OR c.doc_number ILIKE '%' || p_search || '%'
      );

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.issued_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT aic.id, aic.qr_token, aic.status, aic.issued_at, aic.valid_until,
               aic.version, aic.template_id, aic.child_id, aic.profile_id,
               COALESCE(c.full_name, p.full_name) AS athlete_name,
               COALESCE(c.avatar_url, p.avatar_url) AS athlete_photo,
               c.doc_number, t.name AS team_name, sb.name AS branch_name
        FROM public.athlete_id_cards aic
        LEFT JOIN public.children       c  ON c.id  = aic.child_id
        LEFT JOIN public.profiles       p  ON p.id  = aic.profile_id
        LEFT JOIN public.teams          t  ON t.id  = c.team_id
        LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
        WHERE aic.school_id = p_school_id
          AND (p_status IS NULL OR aic.status = p_status)
          AND (
            p_search IS NULL OR p_search = ''
            OR c.full_name ILIKE '%' || p_search || '%'
            OR p.full_name ILIKE '%' || p_search || '%'
            OR c.doc_number ILIKE '%' || p_search || '%'
          )
        ORDER BY aic.issued_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;


CREATE OR REPLACE FUNCTION public.list_school_athletes_for_card_issue(
    p_school_id uuid,
    p_search    text DEFAULT NULL,
    p_limit     int  DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.full_name), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT 'child'::text AS kind,
               c.id          AS athlete_id,
               c.full_name,
               c.avatar_url,
               c.doc_number,
               t.name        AS team_name,
               sb.name       AS branch_name,
               EXISTS (
                 SELECT 1 FROM public.athlete_id_cards aic
                 WHERE aic.child_id = c.id AND aic.status = 'active'
               ) AS has_active_card
        FROM public.children c
        LEFT JOIN public.teams           t  ON t.id  = c.team_id
        LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
        WHERE c.school_id = p_school_id
          AND c.is_active = true
          AND (
            p_search IS NULL OR p_search = ''
            OR c.full_name ILIKE '%' || p_search || '%'
            OR COALESCE(c.doc_number, '') ILIKE '%' || p_search || '%'
          )
        LIMIT p_limit
    ) t;

    RETURN v_rows;
END;
$$;


-- =============================================================================
-- Sprint 3 — athlete_certificates (2 funciones)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_athlete_certificates(
    p_school_id uuid,
    p_status    text  DEFAULT NULL,
    p_kind      text  DEFAULT NULL,
    p_search    text  DEFAULT NULL,
    p_limit     int   DEFAULT 50,
    p_offset    int   DEFAULT 0
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
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.athlete_certificates ac
    LEFT JOIN public.children c ON c.id = ac.child_id
    LEFT JOIN public.profiles p ON p.id = ac.profile_id
    WHERE ac.school_id = p_school_id
      AND (p_status IS NULL OR ac.status = p_status)
      AND (p_kind   IS NULL OR ac.kind   = p_kind)
      AND (
        p_search IS NULL OR p_search = ''
        OR ac.folio ILIKE '%' || p_search || '%'
        OR c.full_name ILIKE '%' || p_search || '%'
        OR p.full_name ILIKE '%' || p_search || '%'
      );

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT ac.id, ac.folio, ac.kind, ac.title, ac.status, ac.created_at,
               ac.issued_at, ac.pdf_url, ac.qr_verify_token, ac.template_id,
               ac.child_id, ac.profile_id,
               COALESCE(c.full_name, p.full_name) AS athlete_name,
               tpl.name AS template_name,
               tpl.requires_payment, tpl.price
        FROM public.athlete_certificates ac
        LEFT JOIN public.children c   ON c.id  = ac.child_id
        LEFT JOIN public.profiles p   ON p.id  = ac.profile_id
        LEFT JOIN public.school_certificate_templates tpl ON tpl.id = ac.template_id
        WHERE ac.school_id = p_school_id
          AND (p_status IS NULL OR ac.status = p_status)
          AND (p_kind   IS NULL OR ac.kind   = p_kind)
          AND (
            p_search IS NULL OR p_search = ''
            OR ac.folio ILIKE '%' || p_search || '%'
            OR c.full_name ILIKE '%' || p_search || '%'
            OR p.full_name ILIKE '%' || p_search || '%'
          )
        ORDER BY ac.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;


CREATE OR REPLACE FUNCTION public.my_athlete_certificates()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT ac.id, ac.folio, ac.kind, ac.title, ac.status, ac.created_at,
               ac.issued_at, ac.pdf_url, ac.qr_verify_token, ac.school_id,
               s.name AS school_name,
               COALESCE(c.full_name, p.full_name) AS athlete_name
        FROM public.athlete_certificates ac
        LEFT JOIN public.children c ON c.id = ac.child_id
        LEFT JOIN public.profiles p ON p.id = ac.profile_id
        LEFT JOIN public.schools  s ON s.id = ac.school_id
        WHERE
            ac.profile_id = auth.uid()
            OR (
                ac.child_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM public.children cc
                    WHERE cc.id = ac.child_id AND cc.parent_id = auth.uid()
                )
            )
        ORDER BY ac.created_at DESC
        LIMIT 100
    ) t;

    RETURN v_rows;
END;
$$;


-- =============================================================================
-- Sprint 4 — school_join_qr (1 función)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_school_join_qrs(
    p_school_id uuid,
    p_active    boolean DEFAULT NULL,
    p_search    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT qr.id, qr.slug, qr.name, qr.target_type, qr.target_id,
               qr.intro_text, qr.cta_text, qr.accept_payments,
               qr.require_first_payment, qr.active, qr.expires_at,
               qr.scan_count, qr.signup_count, qr.paid_count,
               qr.created_at, qr.updated_at,
               qr.branch_id,
               sb.name AS branch_name,
               CASE qr.target_type
                   WHEN 'team'    THEN (SELECT name FROM public.teams    WHERE id = qr.target_id)
                   WHEN 'program' THEN (SELECT name FROM public.programs WHERE id = qr.target_id)
                   WHEN 'branch'  THEN (SELECT name FROM public.school_branches WHERE id = qr.target_id)
                   ELSE NULL
               END AS target_name
        FROM public.school_join_qr_codes qr
        LEFT JOIN public.school_branches sb ON sb.id = qr.branch_id
        WHERE qr.school_id = p_school_id
          AND (p_active IS NULL OR qr.active = p_active)
          AND (
            p_search IS NULL OR p_search = ''
            OR qr.name ILIKE '%' || p_search || '%'
            OR qr.slug ILIKE '%' || p_search || '%'
          )
        ORDER BY qr.created_at DESC
    ) t;

    RETURN v_rows;
END;
$$;


-- =============================================================================
-- Sprint 6 — admin_global_counts (2 funciones)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_users(
    p_search text DEFAULT NULL,
    p_role   text DEFAULT NULL,
    p_limit  int  DEFAULT 50,
    p_offset int  DEFAULT 0
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
$$;


CREATE OR REPLACE FUNCTION public.admin_list_schools_global(
    p_search   text    DEFAULT NULL,
    p_verified boolean DEFAULT NULL,
    p_limit    int     DEFAULT 50,
    p_offset   int     DEFAULT 0
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
$$;
