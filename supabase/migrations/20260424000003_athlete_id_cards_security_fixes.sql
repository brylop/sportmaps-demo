-- Migration: 20260424000003_athlete_id_cards_security_fixes.sql
-- Description: Fixes de seguridad para Sprint 2 — carnets digitales.
--   1) issue_athlete_id_card: valida que child/profile pertenezcan a la escuela.
--   2) verify_athlete_id_card_public: filtra el JSON segun show_fields del
--      template (defaults conservadores) para no leakear datos sensibles
--      aunque la escuela los tenga deshabilitados en la UI.
--   3) Audit trigger atado a athlete_id_cards y athlete_id_card_templates
--      para que las emisiones/revocaciones aparezcan en /admin/activity-logs.

-- ============================================================================
-- 1) issue_athlete_id_card — bloqueo cross-tenant
-- ============================================================================
CREATE OR REPLACE FUNCTION public.issue_athlete_id_card(
    p_school_id   uuid,
    p_child_id    uuid DEFAULT NULL,
    p_profile_id  uuid DEFAULT NULL,
    p_template_id uuid DEFAULT NULL,
    p_valid_until date DEFAULT NULL,
    p_photo_url   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_card_id     uuid;
    v_qr_token    uuid;
    v_valid_until date;
    v_version     int;
    v_old_id      uuid;
    v_old_version int;
    v_owner_count int;
BEGIN
    -- Authz: super-admin o admin de la escuela destino
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden: school admin only' USING ERRCODE = '42501';
    END IF;

    -- Exactamente uno de los dos
    IF (p_child_id IS NULL AND p_profile_id IS NULL)
       OR (p_child_id IS NOT NULL AND p_profile_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Must specify exactly one of p_child_id or p_profile_id'
            USING ERRCODE = '22023';
    END IF;

    -- Cross-tenant: el atleta debe pertenecer a la escuela destino
    IF p_child_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.children
        WHERE id = p_child_id AND school_id = p_school_id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Athlete does not belong to this school'
                USING ERRCODE = '42501';
        END IF;

    ELSIF p_profile_id IS NOT NULL THEN
        -- Para profiles: debe ser miembro activo de la escuela
        SELECT COUNT(*) INTO v_owner_count
        FROM public.school_members
        WHERE profile_id = p_profile_id
          AND school_id  = p_school_id
          AND status     = 'active';

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Athlete profile is not an active member of this school'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Si se pasa template, debe ser de la misma escuela
    IF p_template_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.athlete_id_card_templates
        WHERE id = p_template_id AND school_id = p_school_id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Template does not belong to this school'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Default valid_until = 12 meses
    v_valid_until := COALESCE(p_valid_until, (CURRENT_DATE + interval '12 months')::date);

    -- Revocar anterior active si existe (incrementa version).
    -- IMPORTANTE: SELECT INTO sin filas resetea las variables a NULL,
    -- por eso almacenamos en v_old_version y derivamos v_version despues.
    IF p_child_id IS NOT NULL THEN
        SELECT id, version INTO v_old_id, v_old_version
        FROM public.athlete_id_cards
        WHERE child_id = p_child_id AND status = 'active';
    ELSE
        SELECT id, version INTO v_old_id, v_old_version
        FROM public.athlete_id_cards
        WHERE profile_id = p_profile_id AND status = 'active';
    END IF;

    IF v_old_id IS NOT NULL THEN
        UPDATE public.athlete_id_cards
        SET status = 'revoked',
            revoked_at = now(),
            revocation_reason = 'Replaced by new issuance'
        WHERE id = v_old_id;
        v_version := COALESCE(v_old_version, 1) + 1;
    ELSE
        v_version := 1;
    END IF;

    INSERT INTO public.athlete_id_cards (
        school_id, template_id, child_id, profile_id,
        valid_until, photo_url, version, issued_by
    ) VALUES (
        p_school_id, p_template_id, p_child_id, p_profile_id,
        v_valid_until, p_photo_url, v_version, auth.uid()
    )
    RETURNING id, qr_token INTO v_card_id, v_qr_token;

    RETURN jsonb_build_object(
        'id',          v_card_id,
        'qr_token',    v_qr_token,
        'valid_until', v_valid_until,
        'version',     v_version
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text) TO authenticated;


-- ============================================================================
-- 2) verify_athlete_id_card_public — filtra campos sensibles segun show_fields
--    Defaults conservadores: si NO hay template, NO devuelve doc_number,
--    blood_type, eps_name, emergency_contact, monthly_fee, last_paid_at,
--    next_due. La escuela debe optar in explicitamente.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_athlete_id_card_public(
    p_qr_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_card        record;
    v_template    record;
    v_school      record;
    v_show        jsonb;
    v_athlete_full jsonb;
    v_athlete_filtered jsonb := '{}'::jsonb;
    v_branch_name text;
    v_team_name   text;
    v_monthly_fee numeric;
    v_fee_status  text := 'unknown';
    v_last_paid   date;
    v_next_due    date;
    v_today       date := CURRENT_DATE;
    v_child_branch uuid;
    v_child_team   uuid;
BEGIN
    SELECT * INTO v_card
    FROM public.athlete_id_cards
    WHERE qr_token = p_qr_token;

    IF v_card.id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    -- Estado vigencia: revocado/vencido devuelven minimo
    IF v_card.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'found', true, 'status', 'revoked',
            'revoked_at', v_card.revoked_at, 'reason', v_card.revocation_reason
        );
    END IF;

    IF v_card.valid_until < v_today THEN
        RETURN jsonb_build_object(
            'found', true, 'status', 'expired',
            'valid_until', v_card.valid_until
        );
    END IF;

    -- Template
    SELECT * INTO v_template
    FROM public.athlete_id_card_templates
    WHERE id = v_card.template_id;

    -- show_fields efectivo: el del template, o defaults conservadores
    --   (sin template, NO se exponen datos sensibles)
    v_show := COALESCE(
        v_template.show_fields,
        jsonb_build_object(
            'photo',             true,
            'doc_number',        false,
            'team',              true,
            'branch',            true,
            'plan',              false,
            'valid_until',       true,
            'fee_status',        false,
            'blood_type',        false,
            'emergency_contact', false,
            'eps',               false,
            'tshirt_size',       false
        )
    );

    -- School + branding (siempre publicos)
    SELECT id, name, logo_url, branding_settings, slug
    INTO v_school
    FROM public.schools
    WHERE id = v_card.school_id;

    -- Athlete data — construir solo con campos permitidos
    IF v_card.child_id IS NOT NULL THEN
        v_athlete_filtered := jsonb_build_object('kind', 'child');

        -- Nombre y foto siempre (son lo basico del carnet)
        SELECT
            jsonb_set(
                jsonb_set(v_athlete_filtered,
                    '{full_name}', to_jsonb(c.full_name)),
                '{avatar_url}', to_jsonb(COALESCE(v_card.photo_url, c.avatar_url))
            ),
            c.branch_id, c.team_id, c.monthly_fee
        INTO v_athlete_filtered, v_child_branch, v_child_team, v_monthly_fee
        FROM public.children c
        WHERE c.id = v_card.child_id;

        -- Campos opt-in
        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT v_athlete_filtered
                || jsonb_build_object('doc_type', c.doc_type, 'doc_number', c.doc_number)
            INTO v_athlete_filtered
            FROM public.children c WHERE c.id = v_card.child_id;
        END IF;

        IF COALESCE((v_show->>'blood_type')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('blood_type', c.blood_type)
            INTO v_athlete_filtered
            FROM public.children c WHERE c.id = v_card.child_id;
        END IF;

        IF COALESCE((v_show->>'eps')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('eps_name', c.eps_name)
            INTO v_athlete_filtered
            FROM public.children c WHERE c.id = v_card.child_id;
        END IF;

        IF COALESCE((v_show->>'tshirt_size')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('tshirt_size', c.tshirt_size)
            INTO v_athlete_filtered
            FROM public.children c WHERE c.id = v_card.child_id;
        END IF;

        IF COALESCE((v_show->>'emergency_contact')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('emergency_contact', c.emergency_contact)
            INTO v_athlete_filtered
            FROM public.children c WHERE c.id = v_card.child_id;
        END IF;

        -- Branch / team (ya autorizados por defaults)
        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT name INTO v_branch_name FROM public.school_branches WHERE id = v_child_branch;
        END IF;
        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT name INTO v_team_name FROM public.teams WHERE id = v_child_team;
        END IF;
    ELSE
        -- Profile (atleta adulto): mucho menos sensible
        SELECT
            jsonb_build_object(
                'kind',       'profile',
                'full_name',  p.full_name,
                'avatar_url', COALESCE(v_card.photo_url, p.avatar_url)
            )
        INTO v_athlete_filtered
        FROM public.profiles p
        WHERE p.id = v_card.profile_id;
    END IF;

    -- Fee status: solo si la escuela opta in
    IF COALESCE((v_show->>'fee_status')::boolean, false) THEN
        SELECT MAX(p.created_at)::date
        INTO v_last_paid
        FROM public.payments p
        WHERE p.school_id = v_card.school_id
          AND p.status = 'paid'
          AND (
            (v_card.child_id IS NOT NULL AND p.child_id = v_card.child_id)
            OR (v_card.profile_id IS NOT NULL AND p.parent_id = v_card.profile_id)
          );

        IF v_last_paid IS NULL THEN
            v_fee_status := 'no_payments';
        ELSE
            IF v_today - v_last_paid <= 30 THEN
                v_fee_status := 'paid';
            ELSIF v_today - v_last_paid <= 45 THEN
                v_fee_status := 'due_soon';
            ELSE
                v_fee_status := 'overdue';
            END IF;
            v_next_due := v_last_paid + interval '30 days';
        END IF;
    ELSE
        -- Si no se opta in, no devolver fee_status ni info financiera
        v_fee_status := NULL;
        v_last_paid  := NULL;
        v_next_due   := NULL;
        v_monthly_fee := NULL;
    END IF;

    RETURN jsonb_build_object(
        'found',           true,
        'status',          'active',
        'card_id',         v_card.id,
        'qr_token',        v_card.qr_token,
        'issued_at',       v_card.issued_at,
        'valid_until',     v_card.valid_until,
        'version',         v_card.version,
        'school', jsonb_build_object(
            'id',                v_school.id,
            'name',              v_school.name,
            'slug',              v_school.slug,
            'logo_url',          v_school.logo_url,
            'branding_settings', v_school.branding_settings
        ),
        'template', CASE WHEN v_template.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id',           v_template.id,
            'name',         v_template.name,
            'accent_color', v_template.accent_color,
            'header_text',  v_template.header_text,
            'footer_text',  v_template.footer_text,
            'show_fields',  v_template.show_fields
        ) END,
        'athlete',         v_athlete_filtered,
        'branch_name',     v_branch_name,
        'team_name',       v_team_name,
        'monthly_fee',     v_monthly_fee,
        'fee_status',      v_fee_status,
        'last_paid_at',    v_last_paid,
        'next_due',        v_next_due
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_athlete_id_card_public(uuid) TO anon, authenticated;


-- ============================================================================
-- 3) Audit triggers para que /admin/activity-logs vea los cambios
-- ============================================================================
DROP TRIGGER IF EXISTS trg_audit_athlete_id_cards ON public.athlete_id_cards;
CREATE TRIGGER trg_audit_athlete_id_cards
    AFTER INSERT OR UPDATE OR DELETE ON public.athlete_id_cards
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_athlete_id_card_templates ON public.athlete_id_card_templates;
CREATE TRIGGER trg_audit_athlete_id_card_templates
    AFTER INSERT OR UPDATE OR DELETE ON public.athlete_id_card_templates
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
