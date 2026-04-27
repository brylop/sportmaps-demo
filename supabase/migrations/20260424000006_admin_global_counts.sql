-- Migration: 20260424000006_admin_global_counts.sql
-- Description: RPCs SECURITY DEFINER para que el super-admin vea conteos
--   y listados globales en /admin sin pelearse con la RLS de profiles/schools.
--   Reusa el helper public.is_super_admin() del Sprint 1.

-- ============================================================================
-- 1. admin_global_counts() — totales para el dashboard del super-admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_global_counts()
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_global_counts() TO authenticated;


-- ============================================================================
-- 2. admin_list_users(p_search, p_role, p_limit, p_offset)
--    Reemplaza el SELECT directo a profiles que la RLS limita
-- ============================================================================
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
        SELECT
            p.id,
            p.full_name,
            p.role,
            u.email,
            u.last_sign_in_at,
            p.created_at
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

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, int, int) TO authenticated;


-- ============================================================================
-- 3. admin_list_schools_global(p_search, p_verified, p_limit, p_offset)
--    Reemplaza el SELECT directo a schools que la RLS limita
-- ============================================================================
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
        SELECT
            s.id,
            s.name,
            s.city,
            s.verified,
            s.created_at,
            s.owner_id,
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

GRANT EXECUTE ON FUNCTION public.admin_list_schools_global(text, boolean, int, int) TO authenticated;
