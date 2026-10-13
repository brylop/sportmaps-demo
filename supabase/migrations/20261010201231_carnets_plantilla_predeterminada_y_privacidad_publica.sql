-- =============================================================================
-- 20261010201231_carnets_plantilla_predeterminada_y_privacidad_publica.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-11   Versión anterior: 20261010180834
-- Objetivo: dos arreglos del módulo Carnets Digitales, ambos sobre el cuerpo
-- VIVO de las funciones (leído con pg_get_functiondef el 2026-10-11, no del repo).
--
-- 1) issue_athlete_id_card: elegir «Predeterminada de la escuela» manda
--    p_template_id = NULL y la RPC nunca buscaba la plantilla is_default → el
--    carnet quedaba SIN plantilla (Club Campestre Demo: 7 de 8 carnets sin
--    plantilla aunque la escuela tiene una predeterminada). Ahora, si llega
--    NULL, usa la plantilla activa is_default de la escuela (si existe).
--
-- 2) verify_athlete_id_card_public: es la página pública /c/:token (sin login,
--    GRANT a anon). Si la plantilla encendía esos campos, CUALQUIERA con el
--    QR veía el teléfono del contacto de emergencia, EPS, RH, documento y el
--    concepto/valor del último pago. Ahora esos datos solo salen para:
--      · staff activo de la escuela del carnet (user_staff_school_ids()),
--      · super admin,
--      · el acudiente vinculado (children.parent_id = auth.uid()),
--      · el propio atleta adulto (profile_id = auth.uid()).
--    El público ve: nombre, foto/iniciales, escuela, equipo/sede, vigencia y QR.
--    La respuesta suma 'viewer' ('public' | 'staff' | 'guardian') para que la
--    página sepa qué está mostrando.
--    Además: si el carnet no tiene plantilla, usa la predeterminada activa de la
--    escuela (mismo criterio que el punto 1, así los carnets ya emitidos con el
--    bug toman el diseño que la escuela eligió).
--    Null-safe: todo se arma con jsonb_build_object / ||, nunca jsonb_set
--    (ver mig 20260925135705: jsonb_set es STRICT y anulaba el atleta entero).
--
-- Firmas, SECURITY DEFINER, search_path y ACL se conservan (se re-declaran
-- explícitos al final).
-- =============================================================================

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1) issue_athlete_id_card
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.issue_athlete_id_card(
    p_school_id uuid,
    p_child_id uuid DEFAULT NULL::uuid,
    p_profile_id uuid DEFAULT NULL::uuid,
    p_template_id uuid DEFAULT NULL::uuid,
    p_valid_until date DEFAULT NULL::date,
    p_photo_url text DEFAULT NULL::text,
    p_unregistered_athlete_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_card_id     uuid;
    v_qr_token    uuid;
    v_valid_until date;
    v_version     int;
    v_old_id      uuid;
    v_old_version int;
    v_owner_count int;
    v_template_id uuid := p_template_id;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden: school admin only' USING ERRCODE = '42501';
    END IF;

    IF ((p_child_id IS NOT NULL)::int + (p_profile_id IS NOT NULL)::int + (p_unregistered_athlete_id IS NOT NULL)::int) <> 1 THEN
        RAISE EXCEPTION 'Must specify exactly one of p_child_id, p_profile_id or p_unregistered_athlete_id'
            USING ERRCODE = '22023';
    END IF;

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

    ELSE
        SELECT COUNT(*) INTO v_owner_count
        FROM public.unregistered_athletes
        WHERE id = p_unregistered_athlete_id AND school_id = p_school_id AND is_active = true;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Athlete does not belong to this school'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_template_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.athlete_id_card_templates
        WHERE id = v_template_id AND school_id = p_school_id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Template does not belong to this school'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        -- «Predeterminada de la escuela»: antes quedaba NULL y el carnet salía
        -- sin plantilla. Si la escuela no tiene predeterminada activa, sigue NULL
        -- (diseño por defecto), como antes.
        SELECT t.id INTO v_template_id
        FROM public.athlete_id_card_templates t
        WHERE t.school_id = p_school_id
          AND t.is_default = true
          AND t.active = true
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
        LIMIT 1;
    END IF;

    v_valid_until := COALESCE(p_valid_until, (CURRENT_DATE + interval '12 months')::date);

    IF p_child_id IS NOT NULL THEN
        SELECT id, version INTO v_old_id, v_old_version
        FROM public.athlete_id_cards
        WHERE child_id = p_child_id AND status = 'active';
    ELSIF p_profile_id IS NOT NULL THEN
        SELECT id, version INTO v_old_id, v_old_version
        FROM public.athlete_id_cards
        WHERE profile_id = p_profile_id AND status = 'active';
    ELSE
        SELECT id, version INTO v_old_id, v_old_version
        FROM public.athlete_id_cards
        WHERE unregistered_athlete_id = p_unregistered_athlete_id AND status = 'active';
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
        school_id, template_id, child_id, profile_id, unregistered_athlete_id,
        valid_until, photo_url, version, issued_by
    ) VALUES (
        p_school_id, v_template_id, p_child_id, p_profile_id, p_unregistered_athlete_id,
        v_valid_until, p_photo_url, v_version, auth.uid()
    )
    RETURNING id, qr_token INTO v_card_id, v_qr_token;

    RETURN jsonb_build_object(
        'id',          v_card_id,
        'qr_token',    v_qr_token,
        'valid_until', v_valid_until,
        'version',     v_version,
        'template_id', v_template_id
    );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) verify_athlete_id_card_public
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_athlete_id_card_public(p_qr_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_card        record;
    v_template    record;
    v_school      record;
    v_show        jsonb;
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
    v_child_parent uuid;
    v_last_payment jsonb;
    v_uid          uuid := auth.uid();
    v_is_staff     boolean := false;
    v_is_guardian  boolean := false;
    v_private      boolean := false;
    v_viewer       text := 'public';
    v_kind         text;
BEGIN
    SELECT * INTO v_card FROM public.athlete_id_cards WHERE qr_token = p_qr_token;

    IF v_card.id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    IF v_card.status = 'revoked' THEN
        RETURN jsonb_build_object('found', true, 'status', 'revoked', 'revoked_at', v_card.revoked_at, 'reason', v_card.revocation_reason);
    END IF;

    IF v_card.valid_until < v_today THEN
        RETURN jsonb_build_object('found', true, 'status', 'expired', 'valid_until', v_card.valid_until);
    END IF;

    -- ¿Quién mira? Sin sesión → público. Los datos médicos, de emergencia,
    -- documento y pagos solo salen para staff de ESTA escuela o el acudiente.
    IF v_uid IS NOT NULL THEN
        v_is_staff := public.is_super_admin()
                      OR v_card.school_id = ANY (public.user_staff_school_ids());
        v_is_guardian := (v_card.profile_id IS NOT NULL AND v_card.profile_id = v_uid)
                      OR (v_card.child_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM public.children cc
                             WHERE cc.id = v_card.child_id AND cc.parent_id = v_uid));
    END IF;
    v_private := COALESCE(v_is_staff, false) OR COALESCE(v_is_guardian, false);
    v_viewer  := CASE WHEN v_is_staff THEN 'staff' WHEN v_is_guardian THEN 'guardian' ELSE 'public' END;

    SELECT * INTO v_template FROM public.athlete_id_card_templates WHERE id = v_card.template_id;

    -- Carnet sin plantilla → la predeterminada activa de la escuela.
    IF v_template.id IS NULL THEN
        SELECT * INTO v_template
        FROM public.athlete_id_card_templates t
        WHERE t.school_id = v_card.school_id AND t.is_default = true AND t.active = true
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
        LIMIT 1;
    END IF;

    v_show := COALESCE(v_template.show_fields, jsonb_build_object(
        'photo', true, 'doc_number', false, 'team', true, 'branch', true, 'plan', false,
        'valid_until', true, 'fee_status', false, 'blood_type', false,
        'emergency_contact', false, 'eps', false, 'tshirt_size', false));

    -- Lo privado se apaga para el público aunque la plantilla lo encienda.
    IF NOT v_private THEN
        v_show := v_show || jsonb_build_object(
            'doc_number', false, 'fee_status', false, 'blood_type', false,
            'emergency_contact', false, 'eps', false, 'tshirt_size', false, 'plan', false);
    END IF;

    SELECT id, name, logo_url, branding_settings, slug INTO v_school FROM public.schools WHERE id = v_card.school_id;

    IF v_card.child_id IS NOT NULL THEN
        v_kind := 'child';

        SELECT jsonb_build_object('kind', 'child', 'full_name', c.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, c.avatar_url)),
               c.branch_id, c.team_id, c.monthly_fee, c.parent_id
        INTO v_athlete_filtered, v_child_branch, v_child_team, v_monthly_fee, v_child_parent
        FROM public.children c WHERE c.id = v_card.child_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('doc_type', c.doc_type, 'doc_number', c.doc_number)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'blood_type')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('blood_type', c.blood_type)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'eps')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('eps_name', c.eps_name)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'tshirt_size')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('tshirt_size', c.tshirt_size)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'emergency_contact')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('emergency_contact', c.emergency_contact)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT name INTO v_branch_name FROM public.school_branches WHERE id = v_child_branch;
        END IF;
        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT name INTO v_team_name FROM public.teams WHERE id = v_child_team;
        END IF;

    ELSIF v_card.profile_id IS NOT NULL THEN
        v_kind := 'profile';

        SELECT jsonb_build_object('kind', 'profile', 'full_name', p.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, p.avatar_url))
        INTO v_athlete_filtered FROM public.profiles p WHERE p.id = v_card.profile_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('doc_type', p.document_type, 'doc_number', p.document_number)
            INTO v_athlete_filtered FROM public.profiles p WHERE p.id = v_card.profile_id;
        END IF;

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT sb2.name INTO v_branch_name
            FROM (
                SELECT sb2.id FROM public.team_members tm
                  JOIN public.teams t ON t.id = tm.team_id
                  JOIN public.school_branches sb2 ON sb2.id = t.branch_id
                 WHERE tm.profile_id = v_card.profile_id AND t.school_id = v_card.school_id
                UNION ALL
                SELECT sb2.id FROM public.enrollments e
                  JOIN public.teams prog ON prog.id = e.team_id
                  JOIN public.school_branches sb2 ON sb2.id = prog.branch_id
                 WHERE e.user_id = v_card.profile_id AND e.school_id = v_card.school_id AND e.status = 'active'
                UNION ALL
                SELECT sb2.id FROM public.school_members sm
                  JOIN public.school_branches sb2 ON sb2.id = sm.branch_id
                 WHERE sm.profile_id = v_card.profile_id AND sm.school_id = v_card.school_id
            ) sub
            JOIN public.school_branches sb2 ON sb2.id = sub.id
            LIMIT 1;
        END IF;

        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT t.name INTO v_team_name
            FROM public.team_members tm
            JOIN public.teams t ON t.id = tm.team_id
            WHERE tm.profile_id = v_card.profile_id AND t.school_id = v_card.school_id
            LIMIT 1;

            IF v_team_name IS NULL THEN
                SELECT t.name INTO v_team_name
                FROM public.enrollments e
                JOIN public.teams t ON t.id = e.team_id
                WHERE e.user_id = v_card.profile_id AND e.school_id = v_card.school_id AND e.status = 'active'
                ORDER BY e.created_at LIMIT 1;
            END IF;
        END IF;

    ELSE
        v_kind := 'unregistered';

        SELECT jsonb_build_object('kind', 'unregistered', 'full_name', ua.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, ua.avatar_url)),
               ua.branch_id
        INTO v_athlete_filtered, v_child_branch
        FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('doc_type', ua.doc_type, 'doc_number', ua.doc_number)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        IF COALESCE((v_show->>'blood_type')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('blood_type', ua.blood_type)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        IF COALESCE((v_show->>'eps')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('eps_name', ua.eps_name)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        IF COALESCE((v_show->>'emergency_contact')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object(
                     'emergency_contact',
                     NULLIF(btrim(COALESCE(ua.guardian_full_name, '') || ' ' || COALESCE(ua.guardian_phone, '')), '')
                   )
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT name INTO v_branch_name FROM public.school_branches WHERE id = v_child_branch;
        END IF;
        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT t.name INTO v_team_name
            FROM public.enrollments e
            JOIN public.teams t ON t.id = e.team_id
            WHERE e.unregistered_athlete_id = v_card.unregistered_athlete_id
              AND e.school_id = v_card.school_id AND e.status = 'active'
            ORDER BY e.created_at LIMIT 1;
        END IF;
    END IF;

    -- Si la fila del atleta desapareció, el objeto nunca queda NULL.
    v_athlete_filtered := COALESCE(v_athlete_filtered, jsonb_build_object('kind', v_kind));

    IF COALESCE((v_show->>'fee_status')::boolean, false) AND v_card.unregistered_athlete_id IS NULL THEN
        SELECT jsonb_build_object('concept', p.concept, 'amount', p.amount, 'amount_paid', p.amount_paid,
                                  'payment_date', p.payment_date, 'created_at', p.created_at,
                                  'provider_reference', p.provider_reference, 'payment_method', p.payment_method),
               COALESCE(p.payment_date, p.created_at::date)
          INTO v_last_payment, v_last_paid
          FROM public.payments p
         WHERE p.school_id = v_card.school_id
           AND p.status = 'paid'
           AND ((v_card.child_id IS NOT NULL AND (p.child_id = v_card.child_id OR (p.child_id IS NULL AND v_child_parent IS NOT NULL AND p.parent_id = v_child_parent)))
                OR (v_card.profile_id IS NOT NULL AND p.parent_id = v_card.profile_id))
         ORDER BY COALESCE(p.payment_date, p.created_at::date) DESC, p.created_at DESC
         LIMIT 1;

        IF v_last_paid IS NULL THEN
            v_fee_status := 'no_payments';
            v_last_payment := NULL;
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
        v_fee_status := NULL;
        v_last_paid := NULL;
        v_next_due := NULL;
        v_monthly_fee := NULL;
        v_last_payment := NULL;
    END IF;

    RETURN jsonb_build_object(
        'found', true,
        'status', 'active',
        'viewer', v_viewer,
        'card_id', v_card.id,
        'qr_token', v_card.qr_token,
        'issued_at', v_card.issued_at,
        'valid_until', v_card.valid_until,
        'version', v_card.version,
        'school', jsonb_build_object('id', v_school.id, 'name', v_school.name, 'slug', v_school.slug,
                                     'logo_url', v_school.logo_url, 'branding_settings', v_school.branding_settings),
        'template', CASE WHEN v_template.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', v_template.id,
            'name', v_template.name,
            'accent_color', v_template.accent_color,
            'secondary_color', v_template.secondary_color,
            'layout', v_template.layout,
            'pattern', v_template.pattern,
            'photo_shape', v_template.photo_shape,
            'text_mode', v_template.text_mode,
            'background_url', v_template.background_url,
            'header_text', v_template.header_text,
            'footer_text', v_template.footer_text,
            -- show_fields EFECTIVOS (con lo privado apagado para el público):
            -- el frontend decide qué filas pinta con esto.
            'show_fields', v_show) END,
        'athlete', v_athlete_filtered,
        'branch_name', v_branch_name,
        'team_name', v_team_name,
        'monthly_fee', v_monthly_fee,
        'fee_status', v_fee_status,
        'last_paid_at', v_last_paid,
        'next_due', v_next_due,
        'last_payment', v_last_payment
    );
END;
$function$;

-- ACL: igual que la viva. issue → solo authenticated/service_role.
-- verify → también anon (la página /c/:token es pública a propósito).
REVOKE ALL ON FUNCTION public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text, uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.verify_athlete_id_card_public(uuid) TO anon, authenticated, service_role;

COMMIT;
