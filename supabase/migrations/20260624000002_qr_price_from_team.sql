-- ============================================================
-- SPORTMAPS — QR Fase 1: el precio viene del EQUIPO (no lo teclea el padre)
-- Propósito:
--   El QR de inscripción dejaba que el padre escribiera "Cuota mensual"
--   (riesgo: pagó $200.001). Ahora:
--     • get_join_qr_public expone price_monthly del equipo (target + options)
--       para mostrarlo en solo-lectura en la landing.
--     • submit_qr_signup calcula la cuota SERVER-SIDE desde teams.price_monthly
--       (ignora p_monthly_fee si el equipo tiene precio) → el cliente no puede
--       fijar un monto arbitrario.
--   Conserva: cover_image_url (20260624000001), hijo existente, link de
--   notificación /payments-automation, XOR del enrollment.
-- Fecha: 2026-06-24
-- ============================================================

BEGIN;

-- ── get_join_qr_public: incluir price_monthly del equipo ────────────────────
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
    IF v_qr.id IS NULL THEN RETURN jsonb_build_object('found', false, 'reason', 'not_found'); END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN
        RETURN jsonb_build_object('found', false, 'reason', 'expired'); END IF;

    SELECT id, name, slug, logo_url, cover_image_url, branding_settings
    INTO v_school FROM public.schools WHERE id = v_qr.school_id;

    IF v_qr.target_type = 'team' AND v_qr.target_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind', 'team', 'id', t.id, 'name', t.name,
            'sport', t.sport, 'description', t.description,
            'monthly_fee', t.price_monthly
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
            'branch_id', t.branch_id, 'price_monthly', t.price_monthly
        ) ORDER BY t.name), '[]'::jsonb)
        INTO v_options
        FROM public.teams t
        WHERE t.school_id = v_qr.school_id
          AND (v_qr.branch_id IS NULL OR t.branch_id = v_qr.branch_id)
        LIMIT 50;
    END IF;

    BEGIN
        SELECT public.get_school_payment_info(v_qr.school_id) INTO v_payment_info;
    EXCEPTION WHEN OTHERS THEN v_payment_info := NULL; END;

    UPDATE public.school_join_qr_codes SET scan_count = scan_count + 1 WHERE id = v_qr.id;

    RETURN jsonb_build_object(
        'found', true, 'qr_id', v_qr.id, 'slug', v_qr.slug, 'name', v_qr.name,
        'intro_text', v_qr.intro_text, 'cta_text', v_qr.cta_text,
        'accept_payments', v_qr.accept_payments, 'require_first_payment', v_qr.require_first_payment,
        'target_type', v_qr.target_type, 'target', v_target, 'options', v_options,
        'school', jsonb_build_object(
            'id', v_school.id, 'name', v_school.name, 'slug', v_school.slug,
            'logo_url', v_school.logo_url, 'cover_image_url', v_school.cover_image_url,
            'branding_settings', v_school.branding_settings),
        'payment_info', v_payment_info
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_join_qr_public(text) TO anon, authenticated;


-- ── submit_qr_signup: cuota SERVER-SIDE desde el precio del equipo ──────────
CREATE OR REPLACE FUNCTION public.submit_qr_signup(
    p_slug text, p_team_id uuid DEFAULT NULL, p_branch_id uuid DEFAULT NULL,
    p_child_full_name text DEFAULT NULL, p_child_dob date DEFAULT NULL,
    p_child_doc_type text DEFAULT NULL, p_child_doc_number text DEFAULT NULL,
    p_child_gender text DEFAULT NULL, p_phone text DEFAULT NULL,
    p_monthly_fee numeric DEFAULT NULL, p_existing_child_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid(); v_qr record;
    v_school_id uuid; v_branch_id uuid; v_team_id uuid; v_child_id uuid;
    v_enrollment_id uuid; v_payment_id uuid; v_amount numeric;
    v_due_date date := CURRENT_DATE; v_concept text; v_school_name text;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN RAISE EXCEPTION 'QR expired' USING ERRCODE='22023'; END IF;

    v_school_id := v_qr.school_id;
    v_branch_id := COALESCE(p_branch_id, v_qr.branch_id);
    v_team_id   := CASE WHEN v_qr.target_type = 'team' THEN v_qr.target_id ELSE p_team_id END;
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    -- Cuota SERVER-SIDE: precio del equipo. Fallback a p_monthly_fee SOLO si el
    -- equipo no tiene precio configurado. Así el cliente no fija montos arbitrarios.
    v_amount := COALESCE(
        (SELECT NULLIF(price_monthly, 0) FROM public.teams WHERE id = v_team_id AND school_id = v_school_id),
        NULLIF(p_monthly_fee, 0),
        0
    );

    UPDATE public.profiles SET role='parent', phone=COALESCE(phone,p_phone)
     WHERE id = v_user_id AND role NOT IN ('admin','school','school_admin','super_admin','organizer','coach','wellness_professional','store_owner');

    IF p_existing_child_id IS NOT NULL THEN
        SELECT id INTO v_child_id FROM public.children WHERE id = p_existing_child_id AND parent_id = v_user_id;
        IF v_child_id IS NULL THEN RAISE EXCEPTION 'Hijo no válido para este usuario' USING ERRCODE='42501'; END IF;
        UPDATE public.children
           SET school_id = COALESCE(school_id, v_school_id),
               branch_id = COALESCE(branch_id, v_branch_id),
               team_id   = COALESCE(team_id, v_team_id)
         WHERE id = v_child_id;
    ELSE
        INSERT INTO public.children (parent_id, school_id, branch_id, team_id, full_name, date_of_birth, doc_type, doc_number, gender, monthly_fee, is_active)
        VALUES (v_user_id, v_school_id, v_branch_id, v_team_id, p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender, v_amount, true)
        RETURNING id INTO v_child_id;
    END IF;

    INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, start_date, status)
    VALUES (NULL, v_child_id, v_school_id, v_team_id, CURRENT_DATE,
            CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END)
    RETURNING id INTO v_enrollment_id;

    IF v_qr.require_first_payment AND v_amount > 0 THEN
        v_concept := 'Primer mes - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'inscripción') || ' (' || v_school_name || ')';
        INSERT INTO public.payments (school_id, branch_id, parent_id, child_id, team_id, concept, amount, due_date, status, payment_type)
        VALUES (v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id, v_concept, v_amount, v_due_date, 'pending', 'one_time')
        RETURNING id INTO v_payment_id;
    END IF;

    UPDATE public.school_join_qr_codes SET signup_count = signup_count + 1 WHERE id = v_qr.id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT sm.profile_id, 'Nueva inscripción por QR',
           COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'Atleta') || ' se inscribió via "' || v_qr.name || '"',
           'success', '/payments-automation'
    FROM public.school_members sm
    WHERE sm.school_id = v_school_id AND sm.role IN ('owner','admin') AND sm.status='active';

    RETURN jsonb_build_object('ok',true,'qr_id',v_qr.id,'school_id',v_school_id,'child_id',v_child_id,
        'enrollment_id',v_enrollment_id,'payment_id',v_payment_id,
        'requires_payment', v_qr.require_first_payment AND v_payment_id IS NOT NULL, 'amount', v_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
