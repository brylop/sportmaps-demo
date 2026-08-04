-- ============================================================
-- SPORTMAPS — QR landing: exponer cover_image_url (banner)
--
-- La landing pública del QR de inscripción (JoinSchoolPublicPage)
-- ya pinta el logo de la escuela, pero el "banner" era solo un
-- gradiente de colores: get_join_qr_public NO devolvía
-- cover_image_url, así que la portada subida en el perfil de la
-- escuela nunca se reflejaba en el QR.
--
-- FIX: redefinir get_join_qr_public para incluir cover_image_url en
-- el objeto school. El resto de la lógica (VOLATILE por el UPDATE de
-- scan_count, SECURITY DEFINER, grants) se conserva idéntico a la
-- 20260620000003.
--
-- Migraciones inmutables: fix en archivo nuevo con timestamp posterior.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_join_qr_public(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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

    SELECT id, name, slug, logo_url, cover_image_url, branding_settings
    INTO v_school
    FROM public.schools WHERE id = v_qr.school_id;

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

    -- Side-effect: requiere VOLATILE
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
            'cover_image_url',   v_school.cover_image_url,
            'branding_settings', v_school.branding_settings
        ),
        'payment_info',          v_payment_info
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_join_qr_public(text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
