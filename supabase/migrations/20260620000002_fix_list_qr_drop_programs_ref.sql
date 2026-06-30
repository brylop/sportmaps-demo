-- ============================================================
-- SPORTMAPS — QR: eliminar el legado `programs` (reemplazado por offerings)
-- Propósito:
--   `programs` es un concepto VIEJO del esquema original, reemplazado en
--   marzo 2026 por el modelo universal `offerings`. La tabla `programs` NO
--   existe en este entorno, pero los RPCs del QR aún la referenciaban:
--     • list_school_join_qrs: en un CASE dentro de un SELECT → al planear el
--       query, PostgreSQL valida la tabla inexistente → error 42P01
--       (undefined_table) → PostgREST devuelve 404. ESTO ROMPÍA EL QR.
--     • get_join_qr_public: en una rama ELSIF (plpgsql, plan diferido) → solo
--       rompería si un QR fuera de tipo 'program'; latente pero se limpia.
--   `target_type='program'` nunca se ofreció en la UI (solo open/team/branch).
--   Se elimina la referencia en ambos RPCs y se saca 'program' del CHECK.
-- Fecha: 2026-06-20
-- ============================================================

BEGIN;

-- ── 1. list_school_join_qrs (sin rama 'program') ────────────────────────────
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
        SELECT
            qr.id, qr.slug, qr.name, qr.target_type, qr.target_id,
            qr.intro_text, qr.cta_text, qr.accept_payments,
            qr.require_first_payment, qr.active, qr.expires_at,
            qr.scan_count, qr.signup_count, qr.paid_count,
            qr.created_at, qr.updated_at,
            qr.branch_id,
            sb.name AS branch_name,
            CASE qr.target_type
                WHEN 'team'   THEN (SELECT name FROM public.teams          WHERE id = qr.target_id)
                WHEN 'branch' THEN (SELECT name FROM public.school_branches WHERE id = qr.target_id)
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

GRANT EXECUTE ON FUNCTION public.list_school_join_qrs(uuid, boolean, text) TO authenticated;


-- ── 2. get_join_qr_public (sin rama 'program') ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_join_qr_public(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_qr     record;
    v_school record;
    v_target jsonb := NULL;
    v_options jsonb := '[]'::jsonb;
    v_payment_info jsonb;
BEGIN
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;

    IF v_qr.id IS NULL THEN
        RETURN jsonb_build_object('found', false, 'reason', 'not_found');
    END IF;

    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN
        RETURN jsonb_build_object('found', false, 'reason', 'expired');
    END IF;

    SELECT id, name, slug, logo_url, branding_settings
    INTO v_school
    FROM public.schools WHERE id = v_qr.school_id;

    -- Opciones segun target_type (sin 'program' — legacy)
    IF v_qr.target_type = 'team' AND v_qr.target_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind', 'team', 'id', t.id, 'name', t.name,
            'sport', t.sport, 'description', t.description,
            'monthly_fee', NULL
        ) INTO v_target
        FROM public.teams t WHERE t.id = v_qr.target_id AND t.school_id = v_qr.school_id;

    ELSIF v_qr.target_type = 'branch' AND v_qr.target_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind', 'branch', 'id', sb.id, 'name', sb.name, 'address', sb.address
        ) INTO v_target
        FROM public.school_branches sb WHERE sb.id = v_qr.target_id AND sb.school_id = v_qr.school_id;
    END IF;

    -- Si target es 'open' o 'branch', listar equipos elegibles
    IF v_qr.target_type IN ('open', 'branch') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', t.id, 'name', t.name, 'sport', t.sport,
            'branch_id', t.branch_id
        ) ORDER BY t.name), '[]'::jsonb)
        INTO v_options
        FROM public.teams t
        WHERE t.school_id = v_qr.school_id
          AND (v_qr.branch_id IS NULL OR t.branch_id = v_qr.branch_id)
        LIMIT 50;
    END IF;

    BEGIN
        SELECT public.get_school_payment_info(v_qr.school_id) INTO v_payment_info;
    EXCEPTION WHEN OTHERS THEN
        v_payment_info := NULL;
    END;

    UPDATE public.school_join_qr_codes
       SET scan_count = scan_count + 1
     WHERE id = v_qr.id;

    RETURN jsonb_build_object(
        'found',                 true,
        'qr_id',                 v_qr.id,
        'slug',                  v_qr.slug,
        'name',                  v_qr.name,
        'intro_text',            v_qr.intro_text,
        'cta_text',              v_qr.cta_text,
        'accept_payments',       v_qr.accept_payments,
        'require_first_payment', v_qr.require_first_payment,
        'target_type',           v_qr.target_type,
        'target',                v_target,
        'options',               v_options,
        'school', jsonb_build_object(
            'id',                v_school.id,
            'name',              v_school.name,
            'slug',              v_school.slug,
            'logo_url',          v_school.logo_url,
            'branding_settings', v_school.branding_settings
        ),
        'payment_info',          v_payment_info
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_join_qr_public(text) TO anon, authenticated;


-- ── 3. Sacar 'program' del CHECK de target_type ─────────────────────────────
-- Defensa: normalizar cualquier fila legacy antes de re-crear el constraint.
UPDATE public.school_join_qr_codes SET target_type = 'open' WHERE target_type = 'program';
ALTER TABLE public.school_join_qr_codes DROP CONSTRAINT IF EXISTS school_join_qr_codes_target_type_check;
ALTER TABLE public.school_join_qr_codes
    ADD CONSTRAINT school_join_qr_codes_target_type_check
    CHECK (target_type IN ('open', 'team', 'branch'));

COMMIT;

NOTIFY pgrst, 'reload schema';
