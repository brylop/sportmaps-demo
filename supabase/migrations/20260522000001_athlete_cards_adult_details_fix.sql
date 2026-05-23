-- Migration: 20260522000001_athlete_cards_adult_details_fix.sql
-- Description: Fix missing team and branch name details for adult athlete cards (profiles with child_id IS NULL).
--   Fallback to team_members, active enrollments, and school_members to locate correct values.

-- 1. Redefine my_athlete_id_cards
CREATE OR REPLACE FUNCTION public.my_athlete_id_cards()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rows jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.school_name, t.athlete_name), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            aic.id                            AS card_id,
            aic.qr_token,
            aic.status,
            aic.issued_at,
            aic.valid_until,
            aic.version,
            aic.school_id,
            s.name                            AS school_name,
            s.slug                            AS school_slug,
            s.logo_url                        AS school_logo,
            s.branding_settings               AS school_branding,
            -- Atleta
            CASE WHEN aic.child_id IS NOT NULL THEN 'child'::text ELSE 'profile'::text END AS athlete_kind,
            COALESCE(aic.child_id, aic.profile_id) AS athlete_id,
            COALESCE(c.full_name, p.full_name)     AS athlete_name,
            COALESCE(aic.photo_url, c.avatar_url, p.avatar_url) AS athlete_photo,
            COALESCE(
                t2.name,
                (
                    SELECT t.name
                    FROM public.team_members tm
                    JOIN public.teams t ON t.id = tm.team_id
                    WHERE tm.profile_id = aic.profile_id AND t.school_id = aic.school_id
                    LIMIT 1
                )
            ) AS team_name,
            COALESCE(
                sb.name,
                (
                    SELECT sb2.name
                    FROM public.team_members tm
                    JOIN public.teams t ON t.id = tm.team_id
                    JOIN public.school_branches sb2 ON sb2.id = t.branch_id
                    WHERE tm.profile_id = aic.profile_id AND t.school_id = aic.school_id
                    LIMIT 1
                ),
                (
                    SELECT sb2.name
                    FROM public.enrollments e
                    JOIN public.programs prog ON prog.id = e.program_id
                    JOIN public.school_branches sb2 ON sb2.id = prog.branch_id
                    WHERE e.user_id = aic.profile_id AND e.school_id = aic.school_id AND e.status = 'active'
                    LIMIT 1
                ),
                (
                    SELECT sb2.name
                    FROM public.school_members sm
                    JOIN public.school_branches sb2 ON sb2.id = sm.branch_id
                    WHERE sm.profile_id = aic.profile_id AND sm.school_id = aic.school_id
                    LIMIT 1
                )
            ) AS branch_name,
            -- Vigencia
            (aic.valid_until < CURRENT_DATE) AS is_expired,
            -- Quien soy yo respecto a este carnet (para tooltip)
            CASE
                WHEN aic.profile_id = auth.uid() THEN 'self'
                WHEN aic.child_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.children cc
                    WHERE cc.id = aic.child_id AND cc.parent_id = auth.uid()
                ) THEN 'parent'
                ELSE 'unknown'
            END AS relation
        FROM public.athlete_id_cards aic
        LEFT JOIN public.children       c   ON c.id  = aic.child_id
        LEFT JOIN public.profiles       p   ON p.id  = aic.profile_id
        LEFT JOIN public.schools        s   ON s.id  = aic.school_id
        LEFT JOIN public.teams          t2  ON t2.id = c.team_id
        LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
        WHERE
            -- Mi propio carnet (atleta adulto con profile_id)
            aic.profile_id = auth.uid()
            -- O carnet de un hijo mio
            OR (
                aic.child_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM public.children cc
                    WHERE cc.id = aic.child_id AND cc.parent_id = auth.uid()
                )
            )
        ORDER BY s.name, COALESCE(c.full_name, p.full_name)
    ) t;

    RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_athlete_id_cards() TO authenticated;


-- 2. Redefine verify_athlete_id_card_public
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

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT sb2.name INTO v_branch_name
            FROM (
                SELECT sb2.id
                FROM public.team_members tm
                JOIN public.teams t ON t.id = tm.team_id
                JOIN public.school_branches sb2 ON sb2.id = t.branch_id
                WHERE tm.profile_id = v_card.profile_id AND t.school_id = v_card.school_id
                UNION ALL
                SELECT sb2.id
                FROM public.enrollments e
                JOIN public.programs prog ON prog.id = e.program_id
                JOIN public.school_branches sb2 ON sb2.id = prog.branch_id
                WHERE e.user_id = v_card.profile_id AND e.school_id = v_card.school_id AND e.status = 'active'
                UNION ALL
                SELECT sb2.id
                FROM public.school_members sm
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
        END IF;
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
    'Lectura publica del carnet por qr_token. Calcula fee_status y devuelve last_payment tolerando pagos sin child_id (parent_id del menor) y por profile_id en adultos.';


-- 3. Redefine list_athlete_id_cards
CREATE OR REPLACE FUNCTION public.list_athlete_id_cards(
    p_school_id uuid,
    p_status    text    DEFAULT NULL,
    p_search    text    DEFAULT NULL,
    p_limit     int     DEFAULT 50,
    p_offset    int     DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rows jsonb;
    v_total bigint;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.athlete_id_cards aic
    LEFT JOIN public.children c ON c.id = aic.child_id
    LEFT JOIN public.profiles p ON p.id = aic.profile_id
    WHERE aic.school_id = p_school_id
      AND (p_status IS NULL OR aic.status = p_status)
      AND (
        p_search IS NULL
        OR p_search = ''
        OR c.full_name ILIKE '%' || p_search || '%'
        OR p.full_name ILIKE '%' || p_search || '%'
        OR c.doc_number ILIKE '%' || p_search || '%'
      );

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.issued_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            aic.id,
            aic.qr_token,
            aic.status,
            aic.issued_at,
            aic.valid_until,
            aic.version,
            aic.template_id,
            aic.child_id,
            aic.profile_id,
            COALESCE(c.full_name, p.full_name) AS athlete_name,
            COALESCE(c.avatar_url, p.avatar_url) AS athlete_photo,
            c.doc_number,
            COALESCE(
                t.name,
                (
                    SELECT t3.name
                    FROM public.team_members tm
                    JOIN public.teams t3 ON t3.id = tm.team_id
                    WHERE tm.profile_id = aic.profile_id AND t3.school_id = aic.school_id
                    LIMIT 1
                )
            ) AS team_name,
            COALESCE(
                sb.name,
                (
                    SELECT sb2.name
                    FROM public.team_members tm
                    JOIN public.teams t3 ON t3.id = tm.team_id
                    JOIN public.school_branches sb2 ON sb2.id = t3.branch_id
                    WHERE tm.profile_id = aic.profile_id AND t3.school_id = aic.school_id
                    LIMIT 1
                ),
                (
                    SELECT sb2.name
                    FROM public.enrollments e
                    JOIN public.programs prog ON prog.id = e.program_id
                    JOIN public.school_branches sb2 ON sb2.id = prog.branch_id
                    WHERE e.user_id = aic.profile_id AND e.school_id = aic.school_id AND e.status = 'active'
                    LIMIT 1
                ),
                (
                    SELECT sb2.name
                    FROM public.school_members sm
                    JOIN public.school_branches sb2 ON sb2.id = sm.branch_id
                    WHERE sm.profile_id = aic.profile_id AND sm.school_id = aic.school_id
                    LIMIT 1
                )
            ) AS branch_name
        FROM public.athlete_id_cards aic
        LEFT JOIN public.children       c ON c.id = aic.child_id
        LEFT JOIN public.profiles       p ON p.id = aic.profile_id
        LEFT JOIN public.teams          t  ON t.id = c.team_id
        LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
        WHERE aic.school_id = p_school_id
          AND (p_status IS NULL OR aic.status = p_status)
          AND (
            p_search IS NULL
            OR p_search = ''
            OR c.full_name ILIKE '%' || p_search || '%'
            OR p.full_name ILIKE '%' || p_search || '%'
            OR c.doc_number ILIKE '%' || p_search || '%'
          )
        ORDER BY aic.issued_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_athlete_id_cards(uuid, text, text, int, int) TO authenticated;
