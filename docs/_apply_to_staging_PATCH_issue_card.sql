-- =============================================================================
-- PATCH: issue_athlete_id_card — fix NULL version
-- =============================================================================
-- Bug: cuando un atleta NO tiene carnet previo, SELECT INTO sin filas resetea
--   v_version a NULL (PostgreSQL behavior). El INSERT fallaba con
--   "null value in column version violates not-null constraint".
--
-- Fix: usar variable separada v_old_version para el SELECT, y v_version se
--   computa al final con COALESCE/default.
-- =============================================================================

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
    -- Authz
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden: school admin only' USING ERRCODE = '42501';
    END IF;

    -- Exactamente uno
    IF (p_child_id IS NULL AND p_profile_id IS NULL)
       OR (p_child_id IS NOT NULL AND p_profile_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Must specify exactly one of p_child_id or p_profile_id'
            USING ERRCODE = '22023';
    END IF;

    -- Cross-tenant guard
    IF p_child_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.children
        WHERE id = p_child_id AND school_id = p_school_id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Athlete does not belong to this school'
                USING ERRCODE = '42501';
        END IF;

    ELSIF p_profile_id IS NOT NULL THEN
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

    -- Template debe ser de la misma escuela
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

    -- Buscar carnet activo previo. SELECT INTO resetea variables a NULL si no
    -- hay filas, por eso usamos v_old_version separado.
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
