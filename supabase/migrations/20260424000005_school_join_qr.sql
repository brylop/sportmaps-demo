-- Migration: 20260424000005_school_join_qr.sql
-- Description: Sprint 4 — QR genérico de inscripción para escuelas.
--   Cada escuela puede generar varios QRs (flyers/posters) que apuntan a
--   /join/:slug. Persona escanea, ve la landing branded, se registra y paga
--   el primer mes. RPCs: public landing, signup transaccional, métricas.
--   Reusa schools.branding_settings, school_settings, payments.

-- ============================================================================
-- 1. Tabla: school_join_qr_codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.school_join_qr_codes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    branch_id       uuid REFERENCES public.school_branches(id) ON DELETE SET NULL,
    slug            text NOT NULL UNIQUE,
    name            text NOT NULL,                 -- nombre interno: "Flyer Plaza", "Booth Feria"
    target_type     text NOT NULL DEFAULT 'open'
                       CHECK (target_type IN ('open', 'team', 'program', 'branch')),
    target_id       uuid,                          -- nullable; depende de target_type
    intro_text      text,                          -- copy custom para la landing
    cta_text        text NOT NULL DEFAULT 'Inscribirme',
    accept_payments boolean NOT NULL DEFAULT true,
    require_first_payment boolean NOT NULL DEFAULT true,
    active          boolean NOT NULL DEFAULT true,
    expires_at      timestamptz,
    scan_count      int NOT NULL DEFAULT 0,
    signup_count    int NOT NULL DEFAULT 0,
    paid_count      int NOT NULL DEFAULT 0,
    created_by      uuid REFERENCES public.profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_qr_school  ON public.school_join_qr_codes(school_id);
CREATE INDEX IF NOT EXISTS idx_join_qr_active  ON public.school_join_qr_codes(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_join_qr_slug    ON public.school_join_qr_codes(slug);


-- ============================================================================
-- 2. RLS
-- ============================================================================
ALTER TABLE public.school_join_qr_codes ENABLE ROW LEVEL SECURITY;

-- SELECT: super-admin / school admin de la escuela. Anon NO ve la tabla
--   directamente — usa el RPC publico get_join_qr_public.
DROP POLICY IF EXISTS school_join_qr_select ON public.school_join_qr_codes;
CREATE POLICY school_join_qr_select
    ON public.school_join_qr_codes FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR public.is_school_admin(school_id)
    );

-- INSERT/UPDATE/DELETE: school admin
DROP POLICY IF EXISTS school_join_qr_modify ON public.school_join_qr_codes;
CREATE POLICY school_join_qr_modify
    ON public.school_join_qr_codes FOR ALL TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));


-- ============================================================================
-- 3. Triggers updated_at + audit
-- ============================================================================
DROP TRIGGER IF EXISTS trg_school_join_qr_touch ON public.school_join_qr_codes;
CREATE TRIGGER trg_school_join_qr_touch
    BEFORE UPDATE ON public.school_join_qr_codes
    FOR EACH ROW EXECUTE FUNCTION public.tg_athlete_id_cards_touch();

DROP TRIGGER IF EXISTS trg_audit_school_join_qr ON public.school_join_qr_codes;
CREATE TRIGGER trg_audit_school_join_qr
    AFTER INSERT OR UPDATE OR DELETE ON public.school_join_qr_codes
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


-- ============================================================================
-- 4. RPC: get_join_qr_public — anon. Datos para la landing branded.
--    NO incluye precios privados ni datos sensibles. Reusa get_school_payment_info.
-- ============================================================================
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

    -- Opciones segun target_type
    IF v_qr.target_type = 'team' AND v_qr.target_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind', 'team', 'id', t.id, 'name', t.name,
            'sport', t.sport, 'description', t.description,
            'monthly_fee', NULL
        ) INTO v_target
        FROM public.teams t WHERE t.id = v_qr.target_id AND t.school_id = v_qr.school_id;

    ELSIF v_qr.target_type = 'program' AND v_qr.target_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind', 'program', 'id', p.id, 'name', p.name, 'description', p.description
        ) INTO v_target
        FROM public.programs p WHERE p.id = v_qr.target_id AND p.school_id = v_qr.school_id;

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

    -- Datos de pago (reusa RPC existente; puede retornar NULL si no public_profile)
    BEGIN
        SELECT public.get_school_payment_info(v_qr.school_id) INTO v_payment_info;
    EXCEPTION WHEN OTHERS THEN
        v_payment_info := NULL;
    END;

    -- Increment scan_count (best-effort, no rollback)
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


-- ============================================================================
-- 5. RPC: submit_qr_signup
--    Usuario ya autenticado (auth.signUp via cliente). Crea child + enrollment
--    + payment pendiente del primer mes. Retorna ids para redirigir al checkout.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_qr_signup(
    p_slug          text,
    p_team_id       uuid DEFAULT NULL,
    p_branch_id     uuid DEFAULT NULL,
    p_child_full_name text DEFAULT NULL,
    p_child_dob     date DEFAULT NULL,
    p_child_doc_type text DEFAULT NULL,
    p_child_doc_number text DEFAULT NULL,
    p_child_gender  text DEFAULT NULL,
    p_phone         text DEFAULT NULL,
    p_monthly_fee   numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id    uuid := auth.uid();
    v_qr         record;
    v_school_id  uuid;
    v_branch_id  uuid;
    v_team_id    uuid;
    v_child_id   uuid;
    v_enrollment_id uuid;
    v_payment_id uuid;
    v_amount     numeric;
    v_due_date   date := CURRENT_DATE;
    v_concept    text;
    v_school_name text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN
        RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE = '02000';
    END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN
        RAISE EXCEPTION 'QR expired' USING ERRCODE = '22023';
    END IF;

    v_school_id := v_qr.school_id;
    v_branch_id := COALESCE(p_branch_id, v_qr.branch_id);
    v_team_id   := CASE WHEN v_qr.target_type = 'team' THEN v_qr.target_id ELSE p_team_id END;

    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    -- Promover profile.role a parent si aún no lo es y aún no tiene rol fijo
    UPDATE public.profiles
       SET role = 'parent', phone = COALESCE(phone, p_phone)
     WHERE id = v_user_id
       AND role NOT IN ('admin','school','school_admin','super_admin','organizer','coach','wellness_professional','store_owner');

    -- Crear child (1 por signup)
    INSERT INTO public.children (
        parent_id, school_id, branch_id, team_id,
        full_name, date_of_birth, doc_type, doc_number, gender,
        monthly_fee, is_active
    ) VALUES (
        v_user_id, v_school_id, v_branch_id, v_team_id,
        p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender,
        COALESCE(p_monthly_fee, 0), true
    ) RETURNING id INTO v_child_id;

    -- Crear enrollment pendiente (se activa al pagar)
    INSERT INTO public.enrollments (
        user_id, child_id, school_id, team_id, start_date, status
    ) VALUES (
        v_user_id, v_child_id, v_school_id, v_team_id, CURRENT_DATE,
        CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END
    ) RETURNING id INTO v_enrollment_id;

    -- Crear payment pendiente del primer mes (si aplica)
    IF v_qr.require_first_payment AND COALESCE(p_monthly_fee, 0) > 0 THEN
        v_amount  := p_monthly_fee;
        v_concept := 'Primer mes - ' || COALESCE(p_child_full_name, 'inscripción') || ' (' || v_school_name || ')';

        INSERT INTO public.payments (
            school_id, branch_id, parent_id, child_id, team_id,
            concept, amount, due_date, status, payment_type
        ) VALUES (
            v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id,
            v_concept, v_amount, v_due_date, 'pending', 'one_time'
        ) RETURNING id INTO v_payment_id;
    END IF;

    -- Increment signup_count
    UPDATE public.school_join_qr_codes SET signup_count = signup_count + 1 WHERE id = v_qr.id;

    -- Notificar admin escuela
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT sm.profile_id,
           'Nueva inscripción por QR',
           COALESCE(p_child_full_name, 'Atleta nuevo') || ' se inscribió via "' || v_qr.name || '"',
           'success',
           '/admin/cards'
    FROM public.school_members sm
    WHERE sm.school_id = v_school_id
      AND sm.role IN ('owner','admin')
      AND sm.status = 'active';

    RETURN jsonb_build_object(
        'ok',            true,
        'qr_id',         v_qr.id,
        'school_id',     v_school_id,
        'child_id',      v_child_id,
        'enrollment_id', v_enrollment_id,
        'payment_id',    v_payment_id,
        'requires_payment', v_qr.require_first_payment AND v_payment_id IS NOT NULL,
        'amount',        v_amount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric) TO authenticated;


-- ============================================================================
-- 6. RPC: register_qr_paid_conversion (llamado al confirmar pago)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.register_qr_paid_conversion(p_qr_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.school_join_qr_codes
       SET paid_count = paid_count + 1
     WHERE id = p_qr_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_qr_paid_conversion(uuid) TO authenticated;


-- ============================================================================
-- 7. RPC: list_school_join_qrs (admin)
-- ============================================================================
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

GRANT EXECUTE ON FUNCTION public.list_school_join_qrs(uuid, boolean, text) TO authenticated;


-- ============================================================================
-- 8. RPC: create_school_join_qr — admin escuela. Auto-genera slug si no se pasa.
-- ============================================================================
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
    p_slug      text DEFAULT NULL
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
        active, expires_at, created_by
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
        auth.uid()
    ) RETURNING id INTO v_qr_id;

    RETURN jsonb_build_object('id', v_qr_id, 'slug', v_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_school_join_qr(text, text, text, text, text, text, text, boolean, boolean, timestamptz, text) TO authenticated;
