-- Migration: 20260424000002_athlete_id_cards.sql
-- Description: Sprint 2 — Carnets digitales personalizados por escuela.
--   Crea tablas athlete_id_card_templates y athlete_id_cards, sus RLS,
--   y RPCs para emitir, verificar publicamente, listar y revocar carnets.
--   Reusa schools.branding_settings para colores/logo, children o profiles
--   como atleta, school_settings para datos bancarios, payments para
--   estado de cuota dinamico.

-- ============================================================================
-- 1. Tabla: athlete_id_card_templates
--    Una escuela puede tener varias plantillas (estudiantil, federada, etc).
--    show_fields controla que campos se imprimen en el carnet.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.athlete_id_card_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name            text NOT NULL,
    accent_color    text,                    -- override del branding.primary_color (NULL = usar branding)
    header_text     text,                    -- titulo opcional ("Carnet 2026", "Federacion XYZ")
    footer_text     text,                    -- nota legal opcional
    show_fields     jsonb NOT NULL DEFAULT jsonb_build_object(
        'photo',             true,
        'doc_number',        true,
        'team',              true,
        'branch',            true,
        'plan',              true,
        'valid_until',       true,
        'fee_status',        true,
        'blood_type',        false,
        'emergency_contact', false,
        'eps',               false,
        'tshirt_size',       false
    ),
    is_default      boolean NOT NULL DEFAULT false,
    active          boolean NOT NULL DEFAULT true,
    created_by      uuid REFERENCES public.profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_templates_school ON public.athlete_id_card_templates(school_id);

-- Solo una plantilla default por escuela
CREATE UNIQUE INDEX IF NOT EXISTS uniq_card_template_default_per_school
    ON public.athlete_id_card_templates(school_id)
    WHERE is_default = true;


-- ============================================================================
-- 2. Tabla: athlete_id_cards
--    Atleta puede ser child (menor) o profile (mayor de edad).
--    qr_token publico no enumerable. Solo una card active por atleta a la vez.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.athlete_id_cards (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    template_id     uuid REFERENCES public.athlete_id_card_templates(id) ON DELETE SET NULL,

    -- Atleta (uno y solo uno)
    child_id        uuid REFERENCES public.children(id) ON DELETE CASCADE,
    profile_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,

    qr_token        uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    photo_url       text,                                       -- override de avatar
    status          text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'revoked', 'expired')),
    issued_at       timestamptz NOT NULL DEFAULT now(),
    valid_until     date NOT NULL,
    revoked_at      timestamptz,
    revocation_reason text,
    last_printed_at timestamptz,
    print_count     int NOT NULL DEFAULT 0,
    version         int NOT NULL DEFAULT 1,
    issued_by       uuid REFERENCES public.profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT athlete_id_cards_one_athlete CHECK (
        (child_id IS NOT NULL AND profile_id IS NULL)
        OR
        (child_id IS NULL AND profile_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_athlete_id_cards_school     ON public.athlete_id_cards(school_id);
CREATE INDEX IF NOT EXISTS idx_athlete_id_cards_child      ON public.athlete_id_cards(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_athlete_id_cards_profile    ON public.athlete_id_cards(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_athlete_id_cards_status     ON public.athlete_id_cards(status);
CREATE INDEX IF NOT EXISTS idx_athlete_id_cards_valid_until ON public.athlete_id_cards(valid_until);

-- Solo una active por child y una active por profile
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_card_per_child
    ON public.athlete_id_cards(child_id)
    WHERE status = 'active' AND child_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_card_per_profile
    ON public.athlete_id_cards(profile_id)
    WHERE status = 'active' AND profile_id IS NOT NULL;


-- ============================================================================
-- 3. RLS
-- ============================================================================
ALTER TABLE public.athlete_id_card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_id_cards          ENABLE ROW LEVEL SECURITY;

-- Templates: solo school admin de la escuela maneja. Super-admin ve todo.
DROP POLICY IF EXISTS card_templates_select ON public.athlete_id_card_templates;
CREATE POLICY card_templates_select
    ON public.athlete_id_card_templates FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR public.is_school_admin(school_id)
    );

DROP POLICY IF EXISTS card_templates_modify ON public.athlete_id_card_templates;
CREATE POLICY card_templates_modify
    ON public.athlete_id_card_templates FOR ALL TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));

-- Cards SELECT:
--   - super-admin ve todo
--   - school admin/staff de la escuela
--   - atleta (profile_id = auth.uid())
--   - padre del child
DROP POLICY IF EXISTS athlete_id_cards_select ON public.athlete_id_cards;
CREATE POLICY athlete_id_cards_select
    ON public.athlete_id_cards FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR public.is_school_admin(school_id)
        OR profile_id = auth.uid()
        OR (
            child_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.children c
                WHERE c.id = athlete_id_cards.child_id
                  AND c.parent_id = auth.uid()
            )
        )
    );

-- Cards INSERT/UPDATE/DELETE: solo school admin de la escuela
DROP POLICY IF EXISTS athlete_id_cards_modify ON public.athlete_id_cards;
CREATE POLICY athlete_id_cards_modify
    ON public.athlete_id_cards FOR ALL TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));


-- ============================================================================
-- 4. Trigger: auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_athlete_id_cards_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_athlete_id_cards_touch ON public.athlete_id_cards;
CREATE TRIGGER trg_athlete_id_cards_touch
    BEFORE UPDATE ON public.athlete_id_cards
    FOR EACH ROW EXECUTE FUNCTION public.tg_athlete_id_cards_touch();

DROP TRIGGER IF EXISTS trg_athlete_id_card_templates_touch ON public.athlete_id_card_templates;
CREATE TRIGGER trg_athlete_id_card_templates_touch
    BEFORE UPDATE ON public.athlete_id_card_templates
    FOR EACH ROW EXECUTE FUNCTION public.tg_athlete_id_cards_touch();


-- ============================================================================
-- 5. RPC: issue_athlete_id_card
--    Emite un nuevo carnet para child o profile. Auto-revoca el anterior
--    si existe. Retorna { id, qr_token, valid_until }.
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
    v_card_id    uuid;
    v_qr_token   uuid;
    v_valid_until date;
    v_version    int := 1;
    v_old_id     uuid;
BEGIN
    -- Authz
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden: school admin only' USING ERRCODE = '42501';
    END IF;

    IF (p_child_id IS NULL AND p_profile_id IS NULL)
       OR (p_child_id IS NOT NULL AND p_profile_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Must specify exactly one of p_child_id or p_profile_id'
            USING ERRCODE = '22023';
    END IF;

    -- Default valid_until = 12 meses
    v_valid_until := COALESCE(p_valid_until, (CURRENT_DATE + interval '12 months')::date);

    -- Revocar anterior active si existe (incrementa version)
    IF p_child_id IS NOT NULL THEN
        SELECT id, version INTO v_old_id, v_version
        FROM public.athlete_id_cards
        WHERE child_id = p_child_id AND status = 'active';
    ELSE
        SELECT id, version INTO v_old_id, v_version
        FROM public.athlete_id_cards
        WHERE profile_id = p_profile_id AND status = 'active';
    END IF;

    IF v_old_id IS NOT NULL THEN
        UPDATE public.athlete_id_cards
        SET status = 'revoked',
            revoked_at = now(),
            revocation_reason = 'Replaced by new issuance'
        WHERE id = v_old_id;
        v_version := v_version + 1;
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
-- 6. RPC: revoke_athlete_id_card
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_athlete_id_card(
    p_card_id uuid,
    p_reason  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id
    FROM public.athlete_id_cards WHERE id = p_card_id;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Card not found' USING ERRCODE = '02000';
    END IF;

    IF NOT (public.is_super_admin() OR public.is_school_admin(v_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.athlete_id_cards
    SET status = 'revoked',
        revoked_at = now(),
        revocation_reason = p_reason
    WHERE id = p_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_athlete_id_card(uuid, text) TO authenticated;


-- ============================================================================
-- 7. RPC: verify_athlete_id_card_public
--    Lectura PUBLICA (anon) por qr_token. Retorna datos minimos para
--    visualizar el carnet con branding. Calcula fee_status dinamico
--    leyendo el ultimo billing_event/payment del atleta.
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
    v_athlete     jsonb;
    v_branch_name text;
    v_team_name   text;
    v_plan_name   text;
    v_monthly_fee numeric;
    v_fee_status  text := 'unknown';
    v_last_paid   date;
    v_next_due    date;
    v_today       date := CURRENT_DATE;
BEGIN
    SELECT * INTO v_card
    FROM public.athlete_id_cards
    WHERE qr_token = p_qr_token;

    IF v_card.id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    -- Estado vigencia
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

    -- School + branding
    SELECT id, name, logo_url, branding_settings, slug
    INTO v_school
    FROM public.schools
    WHERE id = v_card.school_id;

    -- Athlete data
    IF v_card.child_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'kind',              'child',
            'full_name',         c.full_name,
            'avatar_url',        COALESCE(v_card.photo_url, c.avatar_url),
            'doc_type',          c.doc_type,
            'doc_number',        c.doc_number,
            'date_of_birth',     c.date_of_birth,
            'blood_type',        c.blood_type,
            'eps_name',          c.eps_name,
            'tshirt_size',       c.tshirt_size,
            'emergency_contact', c.emergency_contact,
            'gender',            c.gender
        ),
        c.branch_id, c.team_id, c.monthly_fee
        INTO v_athlete, v_card.child_id, v_card.profile_id, v_monthly_fee
        FROM public.children c
        WHERE c.id = v_card.child_id;

        SELECT name INTO v_branch_name FROM public.school_branches WHERE id = (SELECT branch_id FROM public.children WHERE id = v_card.child_id);
        SELECT name INTO v_team_name   FROM public.teams           WHERE id = (SELECT team_id   FROM public.children WHERE id = v_card.child_id);
    ELSE
        SELECT jsonb_build_object(
            'kind',              'profile',
            'full_name',         p.full_name,
            'avatar_url',        COALESCE(v_card.photo_url, p.avatar_url),
            'role',              p.role
        )
        INTO v_athlete
        FROM public.profiles p
        WHERE p.id = v_card.profile_id;
    END IF;

    -- Estado de cuota: ultimo payment del atleta
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
        -- Asumimos cobro mensual: si el ultimo pago fue hace <30 dias = al dia,
        -- 30-45 dias = por vencer, >45 = vencido. Heuristica simple.
        IF v_today - v_last_paid <= 30 THEN
            v_fee_status := 'paid';
        ELSIF v_today - v_last_paid <= 45 THEN
            v_fee_status := 'due_soon';
        ELSE
            v_fee_status := 'overdue';
        END IF;
        v_next_due := v_last_paid + interval '30 days';
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
        'athlete',         v_athlete,
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
-- 8. RPC: list_athlete_id_cards (school admin / super-admin)
-- ============================================================================
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
SET search_path = public
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
            t.name AS team_name,
            sb.name AS branch_name
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


-- ============================================================================
-- 9. RPC: list_school_athletes_for_card_issue
--    Lista los atletas (children + profiles) elegibles para emitir carnet.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_school_athletes_for_card_issue(
    p_school_id uuid,
    p_search    text DEFAULT NULL,
    p_limit     int  DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.full_name), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            'child'::text       AS kind,
            c.id                AS athlete_id,
            c.full_name         AS full_name,
            c.avatar_url        AS avatar_url,
            c.doc_number        AS doc_number,
            t.name              AS team_name,
            sb.name             AS branch_name,
            EXISTS (
                SELECT 1 FROM public.athlete_id_cards aic
                WHERE aic.child_id = c.id AND aic.status = 'active'
            ) AS has_active_card
        FROM public.children c
        LEFT JOIN public.teams           t  ON t.id  = c.team_id
        LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
        WHERE c.school_id = p_school_id
          AND c.is_active = true
          AND (
            p_search IS NULL OR p_search = ''
            OR c.full_name ILIKE '%' || p_search || '%'
            OR COALESCE(c.doc_number, '') ILIKE '%' || p_search || '%'
          )
        LIMIT p_limit
    ) t;

    RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_school_athletes_for_card_issue(uuid, text, int) TO authenticated;
