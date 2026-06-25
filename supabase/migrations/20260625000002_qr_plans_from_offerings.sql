-- ============================================================
-- SPORTMAPS — QR universal (corrección): los PLANES salen de offering_plans
-- Propósito:
--   La migración 20260625000001 apuntó los "planes" del QR a subscription_plans
--   (el catálogo del MARKETPLACE de vendors). El catálogo real que una ESCUELA
--   vende a sus familias vive en la arquitectura universal:
--     • offerings        → el "Plan" contenedor (membresía / pack de clases).
--                          offering_type, sport, school_id, is_active.
--     • offering_plans   → las "Tarifas" (BASICO/FULL/GOLD): price, max_sessions
--                          (NULL = ilimitado/∞), max_secondary_sessions (extras
--                          tipo "+4 COMBATE"), duration_days (30=mensual),
--                          school_id directo. ESTA es la fuente de precio del plan.
--
--   Cambios:
--     • El QR ofrece lo que la escuela REALMENTE tiene (equipos y/o planes),
--       sin gatear estrictamente por business_model (una escuela puede tener
--       ambos a la vez — caso real). business_model se sigue devolviendo informativo.
--     • target 'plan' y la lista de planes leen offering_plans (no subscription_plans).
--     • Prioridad de precio server-side: fixed_amount(promo) > offering_plan.price
--       > teams.price_monthly > p_monthly_fee.
--
--   Self-contained: re-aplica los ALTER de 20260625000001 (idempotentes) por si
--   no se aplicó. Conserva cover_image_url, hijo existente, XOR enrollment,
--   link /payments-automation, precio de equipo.
-- Fecha: 2026-06-25
-- ============================================================

BEGIN;

-- ── 1. Schema idempotente: target 'plan' + fixed_amount ─────────────────────
ALTER TABLE public.school_join_qr_codes DROP CONSTRAINT IF EXISTS school_join_qr_codes_target_type_check;
ALTER TABLE public.school_join_qr_codes
    ADD CONSTRAINT school_join_qr_codes_target_type_check
    CHECK (target_type IN ('open', 'team', 'branch', 'plan'));
ALTER TABLE public.school_join_qr_codes
    ADD COLUMN IF NOT EXISTS fixed_amount numeric;


-- ── 2. get_join_qr_public: planes desde offering_plans ──────────────────────
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
    v_business_model text;
    v_target  jsonb := NULL;
    v_options jsonb := '[]'::jsonb;
    v_plans   jsonb := '[]'::jsonb;
    v_payment_info jsonb;
BEGIN
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RETURN jsonb_build_object('found', false, 'reason', 'not_found'); END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN
        RETURN jsonb_build_object('found', false, 'reason', 'expired'); END IF;

    SELECT id, name, slug, logo_url, cover_image_url, branding_settings, business_model
    INTO v_school FROM public.schools WHERE id = v_qr.school_id;
    v_business_model := COALESCE(v_school.business_model, 'teams');

    -- Target específico ----------------------------------------------------
    IF v_qr.target_type = 'team' AND v_qr.target_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind', 'team', 'id', t.id, 'name', t.name,
            'sport', t.sport, 'description', t.description,
            'monthly_fee', t.price_monthly
        ) INTO v_target
        FROM public.teams t WHERE t.id = v_qr.target_id AND t.school_id = v_qr.school_id;

    ELSIF v_qr.target_type = 'plan' AND v_qr.target_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind', 'plan', 'id', op.id,
            'name', o.name || ' · ' || op.name,
            'description', op.description,
            'monthly_fee', op.price,
            'billing_period', CASE op.duration_days
                WHEN 7 THEN 'weekly' WHEN 14 THEN 'biweekly' WHEN 30 THEN 'monthly'
                WHEN 90 THEN 'quarterly' WHEN 180 THEN 'biannual' WHEN 365 THEN 'yearly'
                ELSE op.duration_days || ' días' END,
            'sessions_included', op.max_sessions,
            'plan_type', o.offering_type::text
        ) INTO v_target
        FROM public.offering_plans op
        JOIN public.offerings o ON o.id = op.offering_id
        WHERE op.id = v_qr.target_id AND op.school_id = v_qr.school_id;

    ELSIF v_qr.target_type = 'branch' AND v_qr.target_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind', 'branch', 'id', sb.id, 'name', sb.name, 'address', sb.address
        ) INTO v_target
        FROM public.school_branches sb WHERE sb.id = v_qr.target_id AND sb.school_id = v_qr.school_id;
    END IF;

    -- Equipos elegibles (los que tenga la escuela) -------------------------
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

    -- Planes elegibles (offering_plans activos de la escuela) --------------
    IF v_qr.target_type = 'open' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', op.id,
            'name', o.name || ' · ' || op.name,
            'description', op.description,
            'price_monthly', op.price,
            'billing_period', CASE op.duration_days
                WHEN 7 THEN 'weekly' WHEN 14 THEN 'biweekly' WHEN 30 THEN 'monthly'
                WHEN 90 THEN 'quarterly' WHEN 180 THEN 'biannual' WHEN 365 THEN 'yearly'
                ELSE op.duration_days || ' días' END,
            'sessions_included', op.max_sessions,
            'plan_type', o.offering_type::text
        ) ORDER BY op.price), '[]'::jsonb)
        INTO v_plans
        FROM public.offering_plans op
        JOIN public.offerings o ON o.id = op.offering_id
        WHERE op.school_id = v_qr.school_id
          AND op.is_active = true
          AND o.is_active = true
          AND o.offering_type IN ('membership', 'session_pack', 'single_session')
        LIMIT 50;
    END IF;

    BEGIN SELECT public.get_school_payment_info(v_qr.school_id) INTO v_payment_info;
    EXCEPTION WHEN OTHERS THEN v_payment_info := NULL; END;

    UPDATE public.school_join_qr_codes SET scan_count = scan_count + 1 WHERE id = v_qr.id;

    RETURN jsonb_build_object(
        'found', true, 'qr_id', v_qr.id, 'slug', v_qr.slug, 'name', v_qr.name,
        'intro_text', v_qr.intro_text, 'cta_text', v_qr.cta_text,
        'accept_payments', v_qr.accept_payments, 'require_first_payment', v_qr.require_first_payment,
        'target_type', v_qr.target_type, 'target', v_target,
        'options', v_options, 'plans', v_plans,
        'business_model', v_business_model,
        'fixed_amount', v_qr.fixed_amount,
        'school', jsonb_build_object(
            'id', v_school.id, 'name', v_school.name, 'slug', v_school.slug,
            'logo_url', v_school.logo_url, 'cover_image_url', v_school.cover_image_url,
            'branding_settings', v_school.branding_settings),
        'payment_info', v_payment_info
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_join_qr_public(text) TO anon, authenticated;


-- ── 3. create_school_join_qr (12-arg con p_fixed_amount) — self-contained ───
DROP FUNCTION IF EXISTS public.create_school_join_qr(text, text, text, text, text, text, text, boolean, boolean, timestamptz, text);
CREATE OR REPLACE FUNCTION public.create_school_join_qr(
    p_school_id text DEFAULT NULL,
    p_name      text DEFAULT NULL,
    p_target_type text DEFAULT 'open',
    p_target_id text DEFAULT NULL,
    p_branch_id text DEFAULT NULL,
    p_intro_text text DEFAULT NULL,
    p_cta_text  text DEFAULT 'Inscribirme',
    p_accept_payments boolean DEFAULT true,
    p_require_first_payment boolean DEFAULT true,
    p_expires_at timestamptz DEFAULT NULL,
    p_slug      text DEFAULT NULL,
    p_fixed_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_school_uuid uuid := p_school_id::uuid;
    v_qr_id  uuid;
    v_slug   text;
    v_school_slug text;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_school_uuid)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT slug INTO v_school_slug FROM public.schools WHERE id = v_school_uuid;

    v_slug := COALESCE(
        NULLIF(TRIM(p_slug), ''),
        (COALESCE(v_school_slug, 'esc') || '-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8))
    );

    INSERT INTO public.school_join_qr_codes (
        school_id, branch_id, slug, name, target_type, target_id,
        intro_text, cta_text, accept_payments, require_first_payment,
        active, expires_at, fixed_amount, created_by
    ) VALUES (
        v_school_uuid,
        NULLIF(p_branch_id, '')::uuid,
        v_slug,
        COALESCE(NULLIF(TRIM(p_name), ''), 'QR sin nombre'),
        p_target_type,
        NULLIF(p_target_id, '')::uuid,
        p_intro_text,
        p_cta_text,
        p_accept_payments,
        p_require_first_payment,
        true,
        p_expires_at,
        NULLIF(p_fixed_amount, 0),
        auth.uid()
    ) RETURNING id INTO v_qr_id;

    RETURN jsonb_build_object('id', v_qr_id, 'slug', v_slug);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_school_join_qr(text, text, text, text, text, text, text, boolean, boolean, timestamptz, text, numeric) TO authenticated;


-- ── 4. list_school_join_qrs: nombre del plan desde offering_plans ───────────
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
            qr.branch_id, qr.fixed_amount,
            sb.name AS branch_name,
            CASE qr.target_type
                WHEN 'team'   THEN (SELECT name FROM public.teams          WHERE id = qr.target_id)
                WHEN 'branch' THEN (SELECT name FROM public.school_branches WHERE id = qr.target_id)
                WHEN 'plan'   THEN (SELECT o.name || ' · ' || op.name
                                      FROM public.offering_plans op
                                      JOIN public.offerings o ON o.id = op.offering_id
                                     WHERE op.id = qr.target_id)
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


-- ── 5. submit_qr_signup: precio del plan desde offering_plans ───────────────
DROP FUNCTION IF EXISTS public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid);
CREATE OR REPLACE FUNCTION public.submit_qr_signup(
    p_slug text, p_team_id uuid DEFAULT NULL, p_branch_id uuid DEFAULT NULL,
    p_child_full_name text DEFAULT NULL, p_child_dob date DEFAULT NULL,
    p_child_doc_type text DEFAULT NULL, p_child_doc_number text DEFAULT NULL,
    p_child_gender text DEFAULT NULL, p_phone text DEFAULT NULL,
    p_monthly_fee numeric DEFAULT NULL, p_existing_child_id uuid DEFAULT NULL,
    p_plan_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid(); v_qr record;
    v_school_id uuid; v_branch_id uuid; v_team_id uuid; v_plan_id uuid; v_child_id uuid;
    v_enrollment_id uuid; v_payment_id uuid; v_amount numeric; v_plan_price numeric;
    v_due_date date := CURRENT_DATE; v_concept text; v_school_name text;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN RAISE EXCEPTION 'QR expired' USING ERRCODE='22023'; END IF;

    v_school_id := v_qr.school_id;
    v_branch_id := COALESCE(p_branch_id, v_qr.branch_id);
    v_team_id   := CASE WHEN v_qr.target_type = 'team' THEN v_qr.target_id ELSE p_team_id END;
    v_plan_id   := CASE WHEN v_qr.target_type = 'plan' THEN v_qr.target_id ELSE p_plan_id END;
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    -- Precio del plan (offering_plan validado contra la escuela) ------------
    IF v_plan_id IS NOT NULL THEN
        SELECT op.price INTO v_plan_price
        FROM public.offering_plans op
        WHERE op.id = v_plan_id AND op.school_id = v_school_id AND op.is_active = true;
        IF v_plan_price IS NULL THEN RAISE EXCEPTION 'Plan no válido para esta escuela' USING ERRCODE='22023'; END IF;
    END IF;

    -- Precio SERVER-SIDE: promo > plan > equipo > fallback cliente ----------
    v_amount := COALESCE(
        NULLIF(v_qr.fixed_amount, 0),
        NULLIF(v_plan_price, 0),
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
        v_concept := 'Primer pago - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'inscripción') || ' (' || v_school_name || ')';
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
GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) TO authenticated;


-- ── 6. list_school_plans: tarifas (offering_plans) del catálogo de la escuela ─
CREATE OR REPLACE FUNCTION public.list_school_plans(p_school_id uuid)
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

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', op.id,
        'name', o.name || ' · ' || op.name,
        'price', op.price,
        'billing_period', CASE op.duration_days
            WHEN 7 THEN 'weekly' WHEN 14 THEN 'biweekly' WHEN 30 THEN 'monthly'
            WHEN 90 THEN 'quarterly' WHEN 180 THEN 'biannual' WHEN 365 THEN 'yearly'
            ELSE op.duration_days || ' días' END,
        'sessions_included', op.max_sessions,
        'plan_type', o.offering_type::text
    ) ORDER BY o.sort_order, op.sort_order, op.price), '[]'::jsonb)
    INTO v_rows
    FROM public.offering_plans op
    JOIN public.offerings o ON o.id = op.offering_id
    WHERE op.school_id = p_school_id
      AND op.is_active = true
      AND o.is_active = true
      AND o.offering_type IN ('membership', 'session_pack', 'single_session');

    RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_school_plans(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
