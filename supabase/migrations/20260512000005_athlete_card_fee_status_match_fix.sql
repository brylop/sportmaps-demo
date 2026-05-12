-- ============================================================================
-- Migration: 20260512000005_athlete_card_fee_status_match_fix.sql
--
-- Problema: el carnet mostraba "Sin pagos" aun cuando habia mensualidades
-- pagadas, porque el RPC verify_athlete_id_card_public buscaba SOLO
-- payments con child_id = card.child_id. Cuando el padre paga via MP/Wompi
-- sin pasar child_id (PaymentCheckoutModal sin prop, ParentCheckoutPage sin
-- ?child_id=, o subs recurrentes auto-suscritas), el pago queda con
-- child_id = NULL y parent_id seteado — y el carnet no lo encontraba.
--
-- Fix:
--   1) Matching mas tolerante para carnets de menores (child_id set):
--      tambien acepta payments con child_id IS NULL cuando parent_id =
--      el padre del nino.
--   2) Devuelve last_payment con concept/amount/payment_date/reference para
--      que el carnet pueda mostrar el detalle del ultimo pago, no solo
--      el badge "al dia / vencido".
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_athlete_id_card_public(
    p_qr_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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
BEGIN
    SELECT * INTO v_card
    FROM public.athlete_id_cards
    WHERE qr_token = p_qr_token;

    IF v_card.id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

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

    SELECT * INTO v_template
    FROM public.athlete_id_card_templates
    WHERE id = v_card.template_id;

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

    SELECT id, name, logo_url, branding_settings, slug
    INTO v_school
    FROM public.schools
    WHERE id = v_card.school_id;

    IF v_card.child_id IS NOT NULL THEN
        v_athlete_filtered := jsonb_build_object('kind', 'child');

        SELECT
            jsonb_set(
                jsonb_set(v_athlete_filtered,
                    '{full_name}', to_jsonb(c.full_name)),
                '{avatar_url}', to_jsonb(COALESCE(v_card.photo_url, c.avatar_url))
            ),
            c.branch_id, c.team_id, c.monthly_fee, c.parent_id
        INTO v_athlete_filtered, v_child_branch, v_child_team, v_monthly_fee, v_child_parent
        FROM public.children c
        WHERE c.id = v_card.child_id;

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

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT name INTO v_branch_name FROM public.school_branches WHERE id = v_child_branch;
        END IF;
        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT name INTO v_team_name FROM public.teams WHERE id = v_child_team;
        END IF;
    ELSE
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
        -- Buscar el ULTIMO pago aprobado que aplique a este carnet.
        -- Matching tolerante:
        --   A) Carnet de menor (child_id set):
        --        - pago con mismo child_id, o
        --        - pago sin child_id pero del padre del menor (parent_id = v_child_parent)
        --   B) Carnet de adulto (profile_id set):
        --        - pago del propio atleta (parent_id = profile_id)
        SELECT jsonb_build_object(
                  'concept',            p.concept,
                  'amount',             p.amount,
                  'amount_paid',        p.amount_paid,
                  'payment_date',       p.payment_date,
                  'created_at',         p.created_at,
                  'provider_reference', p.provider_reference,
                  'payment_method',     p.payment_method
              ),
              COALESCE(p.payment_date, p.created_at::date)
          INTO v_last_payment, v_last_paid
          FROM public.payments p
         WHERE p.school_id = v_card.school_id
           AND p.status    = 'paid'
           AND (
                (v_card.child_id IS NOT NULL AND (
                    p.child_id = v_card.child_id
                    OR (p.child_id IS NULL AND v_child_parent IS NOT NULL AND p.parent_id = v_child_parent)
                ))
                OR
                (v_card.profile_id IS NOT NULL AND p.parent_id = v_card.profile_id)
           )
         ORDER BY COALESCE(p.payment_date, p.created_at::date) DESC, p.created_at DESC
         LIMIT 1;

        IF v_last_paid IS NULL THEN
            v_fee_status   := 'no_payments';
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
        v_fee_status   := NULL;
        v_last_paid    := NULL;
        v_next_due     := NULL;
        v_monthly_fee  := NULL;
        v_last_payment := NULL;
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
        'next_due',        v_next_due,
        'last_payment',    v_last_payment
    );
END;
$$;

COMMENT ON FUNCTION public.verify_athlete_id_card_public(uuid) IS
    'Lectura publica del carnet por qr_token. Calcula fee_status y devuelve last_payment'
    ' tolerando pagos sin child_id (parent_id del menor) y por profile_id en adultos.';
