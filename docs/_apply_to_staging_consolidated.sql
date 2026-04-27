-- Migration: 20260424000001_admin_activity_logs_rpcs.sql
-- Description: Sprint 1 — Logs globales para super-admin (solo lectura).
--   Crea helper is_super_admin() y un set de RPCs SECURITY DEFINER que
--   exponen audit_logs / payments / billing_events / analytics_events /
--   event_telemetry de toda la plataforma a usuarios con role IN
--   ('admin','super_admin'). No modifica RLS ni inserta datos.

-- ============================================================================
-- 1. Helper: is_super_admin()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

COMMENT ON FUNCTION public.is_super_admin() IS
    'Returns true iff caller has profile.role in (admin, super_admin). Used by admin_* RPCs.';


-- ============================================================================
-- 2. Resumen agregado para el dashboard del super-admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_activity_summary(
    p_from timestamptz DEFAULT (now() - interval '7 days'),
    p_to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'window', jsonb_build_object('from', p_from, 'to', p_to),
        'audit_logs_count', (
            SELECT COUNT(*) FROM public.audit_logs
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'payments_paid_count', (
            SELECT COUNT(*) FROM public.payments
            WHERE status = 'paid' AND COALESCE(approved_at, created_at) BETWEEN p_from AND p_to
        ),
        'payments_pending_count', (
            SELECT COUNT(*) FROM public.payments
            WHERE status IN ('awaiting_approval','pending') AND created_at BETWEEN p_from AND p_to
        ),
        'payments_paid_amount', (
            SELECT COALESCE(SUM(amount), 0) FROM public.payments
            WHERE status = 'paid' AND COALESCE(approved_at, created_at) BETWEEN p_from AND p_to
        ),
        'billing_events_count', (
            SELECT COUNT(*) FROM public.billing_events
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'analytics_events_count', (
            SELECT COUNT(*) FROM public.analytics_events
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'event_telemetry_count', (
            SELECT COUNT(*) FROM public.event_telemetry
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'active_schools', (
            SELECT COUNT(DISTINCT school_id) FROM public.audit_logs
            WHERE created_at BETWEEN p_from AND p_to AND school_id IS NOT NULL
        ),
        'new_users', (
            SELECT COUNT(*) FROM public.profiles
            WHERE created_at BETWEEN p_from AND p_to
        ),
        'new_enrollments', (
            SELECT COUNT(*) FROM public.enrollments
            WHERE created_at BETWEEN p_from AND p_to
        )
    ) INTO v;

    RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_activity_summary(timestamptz, timestamptz) TO authenticated;


-- ============================================================================
-- 3. Listados paginados — auditoría DB
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(
    p_school_id uuid     DEFAULT NULL,
    p_table     text     DEFAULT NULL,
    p_action    text     DEFAULT NULL,
    p_from      timestamptz DEFAULT (now() - interval '7 days'),
    p_to        timestamptz DEFAULT now(),
    p_limit     int      DEFAULT 50,
    p_offset    int      DEFAULT 0
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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.audit_logs al
    WHERE al.created_at BETWEEN p_from AND p_to
      AND (p_school_id IS NULL OR al.school_id = p_school_id)
      AND (p_table     IS NULL OR al.table_name = p_table)
      AND (p_action    IS NULL OR al.action     = p_action);

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            al.id,
            al.created_at,
            al.school_id,
            s.name        AS school_name,
            al.profile_id,
            p.full_name   AS actor_name,
            p.role        AS actor_role,
            al.table_name,
            al.record_id,
            al.action,
            al.old_data,
            al.new_data
        FROM public.audit_logs al
        LEFT JOIN public.schools  s ON s.id = al.school_id
        LEFT JOIN public.profiles p ON p.id = al.profile_id
        WHERE al.created_at BETWEEN p_from AND p_to
          AND (p_school_id IS NULL OR al.school_id = p_school_id)
          AND (p_table     IS NULL OR al.table_name = p_table)
          AND (p_action    IS NULL OR al.action     = p_action)
        ORDER BY al.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 4. Listado paginado — payments globales
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_payments(
    p_school_id uuid     DEFAULT NULL,
    p_status    text     DEFAULT NULL,
    p_method    text     DEFAULT NULL,
    p_from      timestamptz DEFAULT (now() - interval '30 days'),
    p_to        timestamptz DEFAULT now(),
    p_limit     int      DEFAULT 50,
    p_offset    int      DEFAULT 0
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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.payments p
    WHERE p.created_at BETWEEN p_from AND p_to
      AND (p_school_id IS NULL OR p.school_id      = p_school_id)
      AND (p_status    IS NULL OR p.status         = p_status)
      AND (p_method    IS NULL OR p.payment_method = p_method);

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            p.id,
            p.created_at,
            p.school_id,
            s.name           AS school_name,
            p.amount,
            p.status,
            p.payment_method,
            p.payment_channel,
            p.receipt_url,
            p.approved_at,
            p.approved_by,
            ap.full_name     AS approved_by_name,
            p.parent_id,
            par.full_name    AS parent_name,
            p.child_id,
            c.full_name      AS child_name
        FROM public.payments p
        LEFT JOIN public.schools  s   ON s.id  = p.school_id
        LEFT JOIN public.profiles ap  ON ap.id = p.approved_by
        LEFT JOIN public.profiles par ON par.id = p.parent_id
        LEFT JOIN public.children c   ON c.id  = p.child_id
        WHERE p.created_at BETWEEN p_from AND p_to
          AND (p_school_id IS NULL OR p.school_id      = p_school_id)
          AND (p_status    IS NULL OR p.status         = p_status)
          AND (p_method    IS NULL OR p.payment_method = p_method)
        ORDER BY p.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_payments(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 5. Listado paginado — billing events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_billing_events(
    p_school_id uuid     DEFAULT NULL,
    p_status    text     DEFAULT NULL,
    p_from      timestamptz DEFAULT (now() - interval '30 days'),
    p_to        timestamptz DEFAULT now(),
    p_limit     int      DEFAULT 50,
    p_offset    int      DEFAULT 0
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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.billing_events be
    WHERE be.created_at BETWEEN p_from AND p_to
      AND (p_school_id IS NULL OR be.school_id   = p_school_id)
      AND (p_status    IS NULL OR be.status::text = p_status);

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            be.id,
            be.created_at,
            be.school_id,
            s.name              AS school_name,
            be.enrollment_id,
            be.event_type,
            be.amount_due,
            be.amount_paid,
            be.late_fee_amount,
            be.currency,
            be.due_date,
            be.paid_date,
            be.status,
            be.gateway,
            be.gateway_reference,
            be.installment_number,
            be.notes
        FROM public.billing_events be
        LEFT JOIN public.schools s ON s.id = be.school_id
        WHERE be.created_at BETWEEN p_from AND p_to
          AND (p_school_id IS NULL OR be.school_id    = p_school_id)
          AND (p_status    IS NULL OR be.status::text = p_status)
        ORDER BY be.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_billing_events(uuid, text, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 6. Listado paginado — analytics_events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_analytics_events(
    p_event_type text DEFAULT NULL,
    p_user_id    uuid DEFAULT NULL,
    p_from       timestamptz DEFAULT (now() - interval '7 days'),
    p_to         timestamptz DEFAULT now(),
    p_limit      int  DEFAULT 50,
    p_offset     int  DEFAULT 0
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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.analytics_events ae
    WHERE ae.created_at BETWEEN p_from AND p_to
      AND (p_event_type IS NULL OR ae.event_type = p_event_type)
      AND (p_user_id    IS NULL OR ae.user_id    = p_user_id);

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            ae.id,
            ae.created_at,
            ae.user_id,
            p.full_name AS user_name,
            p.role      AS user_role,
            ae.event_type,
            ae.event_data,
            ae.page_url
        FROM public.analytics_events ae
        LEFT JOIN public.profiles p ON p.id = ae.user_id
        WHERE ae.created_at BETWEEN p_from AND p_to
          AND (p_event_type IS NULL OR ae.event_type = p_event_type)
          AND (p_user_id    IS NULL OR ae.user_id    = p_user_id)
        ORDER BY ae.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_analytics_events(text, uuid, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 7. Listado paginado — event_telemetry (eventos deportivos)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_event_telemetry(
    p_event_type text DEFAULT NULL,
    p_event_id   uuid DEFAULT NULL,
    p_from       timestamptz DEFAULT (now() - interval '7 days'),
    p_to         timestamptz DEFAULT now(),
    p_limit      int  DEFAULT 50,
    p_offset     int  DEFAULT 0
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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.event_telemetry et
    WHERE et.created_at BETWEEN p_from AND p_to
      AND (p_event_type IS NULL OR et.event_type = p_event_type)
      AND (p_event_id   IS NULL OR et.event_id   = p_event_id);

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            et.id,
            et.created_at,
            et.event_id,
            e.title    AS event_title,
            et.user_id,
            p.full_name AS user_name,
            et.event_type,
            et.metadata
        FROM public.event_telemetry et
        LEFT JOIN public.events    e ON e.id = et.event_id
        LEFT JOIN public.profiles  p ON p.id = et.user_id
        WHERE et.created_at BETWEEN p_from AND p_to
          AND (p_event_type IS NULL OR et.event_type = p_event_type)
          AND (p_event_id   IS NULL OR et.event_id   = p_event_id)
        ORDER BY et.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_event_telemetry(text, uuid, timestamptz, timestamptz, int, int) TO authenticated;


-- ============================================================================
-- 8. Listado de escuelas distintas (para filtros)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_schools_for_filter()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name), '[]'::jsonb)
    INTO v_rows
    FROM public.schools;

    RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_schools_for_filter() TO authenticated;
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

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.issued_at DESC), '[]'::jsonb)
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

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.full_name), '[]'::jsonb)
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
    v_version     int := 1;
    v_old_id      uuid;
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
-- Migration: 20260424000004_athlete_certificates.sql
-- Description: Sprint 3 — Constancias para deportistas, configurables por escuela.
--   Crea school_certificate_templates y athlete_certificates con RLS,
--   RPCs (request, issue, verify_public, list, revoke) y audit triggers.
--   PDF generation se hace en BFF /api/v1/certificates/:id/generate-pdf.

-- ============================================================================
-- 1. Tabla: school_certificate_templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.school_certificate_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name            text NOT NULL,
    kind            text NOT NULL DEFAULT 'study'
                       CHECK (kind IN ('study','conduct','medical','payment','federation','custom')),
    title           text NOT NULL,                    -- header del documento
    body_template   text NOT NULL,                    -- texto con variables {{atleta.nombre}} etc
    signature_name  text,
    signature_title text,
    signature_image_url text,
    footer_text     text,
    requires_payment boolean NOT NULL DEFAULT false,
    price           numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
    currency        text NOT NULL DEFAULT 'COP',
    is_default      boolean NOT NULL DEFAULT false,
    active          boolean NOT NULL DEFAULT true,
    created_by      uuid REFERENCES public.profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_templates_school ON public.school_certificate_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_cert_templates_active ON public.school_certificate_templates(school_id, active) WHERE active = true;

-- Solo una default por escuela y por kind
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cert_template_default_per_school_kind
    ON public.school_certificate_templates(school_id, kind)
    WHERE is_default = true;


-- ============================================================================
-- 2. Tabla: athlete_certificates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.athlete_certificates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    template_id     uuid NOT NULL REFERENCES public.school_certificate_templates(id) ON DELETE RESTRICT,

    -- Atleta (uno y solo uno)
    child_id        uuid REFERENCES public.children(id) ON DELETE CASCADE,
    profile_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,

    folio           text NOT NULL UNIQUE,                         -- e.g. "ESC-2026-00042"
    kind            text NOT NULL,                                -- denormalizado del template
    title           text NOT NULL,                                -- denormalizado del template
    content_snapshot jsonb NOT NULL,                              -- datos congelados al emitir
    qr_verify_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    pdf_url         text,                                         -- path en Storage (se setea cuando BFF lo genera)
    status          text NOT NULL DEFAULT 'pending_payment'
                       CHECK (status IN ('pending_payment','pending_review','issued','revoked')),
    payment_id      uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    requested_by    uuid REFERENCES public.profiles(id),
    issued_by       uuid REFERENCES public.profiles(id),
    issued_at       timestamptz,
    revoked_at      timestamptz,
    revocation_reason text,
    download_count  int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT athlete_certificates_one_athlete CHECK (
        (child_id IS NOT NULL AND profile_id IS NULL)
        OR
        (child_id IS NULL AND profile_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_certs_school   ON public.athlete_certificates(school_id);
CREATE INDEX IF NOT EXISTS idx_certs_status   ON public.athlete_certificates(status);
CREATE INDEX IF NOT EXISTS idx_certs_child    ON public.athlete_certificates(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_certs_profile  ON public.athlete_certificates(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_certs_folio    ON public.athlete_certificates(folio);


-- ============================================================================
-- 3. RLS
-- ============================================================================
ALTER TABLE public.school_certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_certificates         ENABLE ROW LEVEL SECURITY;

-- Templates SELECT: super-admin / school admin / cualquier authenticated dentro
--   de la escuela (para que padres puedan ver opciones disponibles)
DROP POLICY IF EXISTS cert_templates_select ON public.school_certificate_templates;
CREATE POLICY cert_templates_select
    ON public.school_certificate_templates FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR public.is_school_admin(school_id)
        OR EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = school_certificate_templates.school_id
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.school_id = school_certificate_templates.school_id
              AND c.parent_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS cert_templates_modify ON public.school_certificate_templates;
CREATE POLICY cert_templates_modify
    ON public.school_certificate_templates FOR ALL TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));

-- Certificates SELECT: super-admin / school admin / atleta / padre
DROP POLICY IF EXISTS athlete_certificates_select ON public.athlete_certificates;
CREATE POLICY athlete_certificates_select
    ON public.athlete_certificates FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR public.is_school_admin(school_id)
        OR profile_id = auth.uid()
        OR (
            child_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.children c
                WHERE c.id = athlete_certificates.child_id
                  AND c.parent_id = auth.uid()
            )
        )
    );

-- Certificates INSERT/UPDATE/DELETE: solo school admin (las solicitudes de
--   padres se hacen via RPC con SECURITY DEFINER)
DROP POLICY IF EXISTS athlete_certificates_modify ON public.athlete_certificates;
CREATE POLICY athlete_certificates_modify
    ON public.athlete_certificates FOR ALL TO authenticated
    USING (public.is_school_admin(school_id))
    WITH CHECK (public.is_school_admin(school_id));


-- ============================================================================
-- 4. Triggers updated_at + audit
-- ============================================================================
DROP TRIGGER IF EXISTS trg_cert_templates_touch ON public.school_certificate_templates;
CREATE TRIGGER trg_cert_templates_touch
    BEFORE UPDATE ON public.school_certificate_templates
    FOR EACH ROW EXECUTE FUNCTION public.tg_athlete_id_cards_touch();

DROP TRIGGER IF EXISTS trg_athlete_certificates_touch ON public.athlete_certificates;
CREATE TRIGGER trg_athlete_certificates_touch
    BEFORE UPDATE ON public.athlete_certificates
    FOR EACH ROW EXECUTE FUNCTION public.tg_athlete_id_cards_touch();

DROP TRIGGER IF EXISTS trg_audit_athlete_certificates ON public.athlete_certificates;
CREATE TRIGGER trg_audit_athlete_certificates
    AFTER INSERT OR UPDATE OR DELETE ON public.athlete_certificates
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_cert_templates ON public.school_certificate_templates;
CREATE TRIGGER trg_audit_cert_templates
    AFTER INSERT OR UPDATE OR DELETE ON public.school_certificate_templates
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


-- ============================================================================
-- 5. Helper: _next_certificate_folio
--    Genera folio "{SLUG}-{YYYY}-{NNNNN}" por escuela y año
-- ============================================================================
CREATE OR REPLACE FUNCTION public._next_certificate_folio(p_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year     int := EXTRACT(year FROM CURRENT_DATE);
    v_count    int;
    v_slug     text;
BEGIN
    SELECT COALESCE(slug, REPLACE(LOWER(name), ' ', '-')) INTO v_slug
    FROM public.schools WHERE id = p_school_id;

    SELECT COUNT(*) + 1 INTO v_count
    FROM public.athlete_certificates
    WHERE school_id = p_school_id
      AND EXTRACT(year FROM created_at) = v_year;

    RETURN UPPER(SUBSTRING(COALESCE(v_slug, 'esc') FROM 1 FOR 8))
        || '-' || v_year::text
        || '-' || LPAD(v_count::text, 5, '0');
END;
$$;


-- ============================================================================
-- 6. RPC: build_certificate_snapshot — congela los datos del atleta+escuela
-- ============================================================================
CREATE OR REPLACE FUNCTION public._build_certificate_snapshot(
    p_school_id   uuid,
    p_template_id uuid,
    p_child_id    uuid,
    p_profile_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_school_name text;
    v_school_logo text;
    v_branding    jsonb;
    v_athlete     jsonb;
    v_team_name   text;
    v_branch_name text;
    v_enrollment  jsonb;
BEGIN
    SELECT name, logo_url, branding_settings
    INTO v_school_name, v_school_logo, v_branding
    FROM public.schools WHERE id = p_school_id;

    IF p_child_id IS NOT NULL THEN
        SELECT
            jsonb_build_object(
                'kind',          'child',
                'full_name',     c.full_name,
                'doc_type',      c.doc_type,
                'doc_number',    c.doc_number,
                'date_of_birth', c.date_of_birth,
                'gender',        c.gender,
                'avatar_url',    c.avatar_url
            ),
            t.name, sb.name
        INTO v_athlete, v_team_name, v_branch_name
        FROM public.children c
        LEFT JOIN public.teams           t  ON t.id  = c.team_id
        LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
        WHERE c.id = p_child_id;

        SELECT jsonb_build_object(
            'start_date', e.start_date,
            'status',     e.status,
            'expires_at', e.expires_at
        ) INTO v_enrollment
        FROM public.enrollments e
        WHERE e.child_id = p_child_id AND e.school_id = p_school_id
        ORDER BY e.created_at DESC LIMIT 1;
    ELSE
        SELECT jsonb_build_object(
            'kind',       'profile',
            'full_name',  p.full_name,
            'avatar_url', p.avatar_url
        )
        INTO v_athlete
        FROM public.profiles p WHERE p.id = p_profile_id;

        SELECT jsonb_build_object(
            'start_date', e.start_date,
            'status',     e.status,
            'expires_at', e.expires_at
        ) INTO v_enrollment
        FROM public.enrollments e
        WHERE e.user_id = p_profile_id AND e.school_id = p_school_id
        ORDER BY e.created_at DESC LIMIT 1;
    END IF;

    RETURN jsonb_build_object(
        'snapshot_at', now(),
        'school', jsonb_build_object(
            'name',      v_school_name,
            'logo_url',  v_school_logo,
            'branding',  v_branding
        ),
        'athlete',     v_athlete,
        'team_name',   v_team_name,
        'branch_name', v_branch_name,
        'enrollment',  v_enrollment
    );
END;
$$;


-- ============================================================================
-- 7. RPC: request_athlete_certificate
--    Padre o atleta solicita la constancia. Si requiere pago: status =
--    'pending_payment' y se debe crear payment posteriormente. Si no:
--    'pending_review' (admin escuela debe aprobar).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_athlete_certificate(
    p_school_id   uuid,
    p_template_id uuid,
    p_child_id    uuid DEFAULT NULL,
    p_profile_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_template   record;
    v_cert_id    uuid;
    v_folio      text;
    v_snapshot   jsonb;
    v_status     text;
    v_can_request boolean := false;
BEGIN
    -- Validaciones basicas
    IF (p_child_id IS NULL AND p_profile_id IS NULL)
       OR (p_child_id IS NOT NULL AND p_profile_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Must specify exactly one of p_child_id or p_profile_id'
            USING ERRCODE = '22023';
    END IF;

    -- Authz: solicitante debe ser super-admin, school-admin de la escuela,
    --   atleta dueño (profile_id), o padre del child
    IF public.is_super_admin() OR public.is_school_admin(p_school_id) THEN
        v_can_request := true;
    ELSIF p_profile_id IS NOT NULL AND p_profile_id = auth.uid() THEN
        v_can_request := true;
    ELSIF p_child_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = p_child_id AND c.parent_id = auth.uid()
    ) THEN
        v_can_request := true;
    END IF;

    IF NOT v_can_request THEN
        RAISE EXCEPTION 'Forbidden: only owner/parent or school admin can request'
            USING ERRCODE = '42501';
    END IF;

    -- Validar atleta pertenece a la escuela (cross-tenant)
    IF p_child_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.children
            WHERE id = p_child_id AND school_id = p_school_id
        ) THEN
            RAISE EXCEPTION 'Athlete does not belong to this school' USING ERRCODE = '42501';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM public.school_members
            WHERE profile_id = p_profile_id AND school_id = p_school_id AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Athlete profile is not an active member of this school' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Template valida y de la misma escuela
    SELECT * INTO v_template
    FROM public.school_certificate_templates
    WHERE id = p_template_id AND school_id = p_school_id AND active = true;
    IF v_template.id IS NULL THEN
        RAISE EXCEPTION 'Template not found or inactive' USING ERRCODE = '02000';
    END IF;

    v_folio    := public._next_certificate_folio(p_school_id);
    v_snapshot := public._build_certificate_snapshot(p_school_id, p_template_id, p_child_id, p_profile_id);
    v_status   := CASE WHEN v_template.requires_payment THEN 'pending_payment' ELSE 'pending_review' END;

    INSERT INTO public.athlete_certificates (
        school_id, template_id, child_id, profile_id,
        folio, kind, title, content_snapshot,
        status, requested_by
    ) VALUES (
        p_school_id, p_template_id, p_child_id, p_profile_id,
        v_folio, v_template.kind, v_template.title, v_snapshot,
        v_status, auth.uid()
    )
    RETURNING id INTO v_cert_id;

    -- Notificar al admin escuela
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT sm.profile_id,
           'Nueva solicitud de constancia',
           'Folio ' || v_folio || ' (' || v_template.name || ')',
           'info',
           '/admin/certificates'
    FROM public.school_members sm
    WHERE sm.school_id = p_school_id
      AND sm.role IN ('owner','admin')
      AND sm.status = 'active';

    RETURN jsonb_build_object(
        'id',           v_cert_id,
        'folio',        v_folio,
        'status',       v_status,
        'requires_payment', v_template.requires_payment,
        'price',        v_template.price,
        'currency',     v_template.currency
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_athlete_certificate(uuid, uuid, uuid, uuid) TO authenticated;


-- ============================================================================
-- 8. RPC: issue_athlete_certificate (school admin aprueba/emite)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.issue_athlete_certificate(
    p_certificate_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cert record;
    v_recipient uuid;
BEGIN
    SELECT * INTO v_cert
    FROM public.athlete_certificates WHERE id = p_certificate_id;

    IF v_cert.id IS NULL THEN
        RAISE EXCEPTION 'Certificate not found' USING ERRCODE = '02000';
    END IF;

    IF NOT (public.is_super_admin() OR public.is_school_admin(v_cert.school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_cert.status NOT IN ('pending_review','pending_payment') THEN
        RAISE EXCEPTION 'Certificate is not in a state that can be issued (current: %)', v_cert.status
            USING ERRCODE = '22023';
    END IF;

    -- Si esta pending_payment, exigir payment_id paid asociado
    IF v_cert.status = 'pending_payment' THEN
        IF v_cert.payment_id IS NULL THEN
            RAISE EXCEPTION 'Cannot issue: payment is required and missing' USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.payments
            WHERE id = v_cert.payment_id AND status = 'paid'
        ) THEN
            RAISE EXCEPTION 'Cannot issue: linked payment is not paid' USING ERRCODE = '42501';
        END IF;
    END IF;

    UPDATE public.athlete_certificates
    SET status = 'issued',
        issued_at = now(),
        issued_by = auth.uid()
    WHERE id = p_certificate_id;

    -- Notificar al solicitante (padre o atleta)
    v_recipient := COALESCE(
        v_cert.requested_by,
        v_cert.profile_id,
        (SELECT parent_id FROM public.children WHERE id = v_cert.child_id)
    );

    IF v_recipient IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            v_recipient,
            'Constancia emitida',
            'Tu constancia ' || v_cert.folio || ' está lista para descargar',
            'success',
            '/my-certificates'
        );
    END IF;

    RETURN jsonb_build_object(
        'id',     v_cert.id,
        'folio',  v_cert.folio,
        'status', 'issued'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_athlete_certificate(uuid) TO authenticated;


-- ============================================================================
-- 9. RPC: revoke_athlete_certificate
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_athlete_certificate(
    p_certificate_id uuid,
    p_reason text DEFAULT NULL
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
    FROM public.athlete_certificates WHERE id = p_certificate_id;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Certificate not found' USING ERRCODE = '02000';
    END IF;

    IF NOT (public.is_super_admin() OR public.is_school_admin(v_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.athlete_certificates
    SET status = 'revoked',
        revoked_at = now(),
        revocation_reason = p_reason
    WHERE id = p_certificate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_athlete_certificate(uuid, text) TO authenticated;


-- ============================================================================
-- 10. RPC: verify_athlete_certificate_public (anon por folio o token)
--     Devuelve solo datos minimos: folio, escuela, atleta nombre, fecha,
--     estado (issued/revoked). NO revela contenido completo (eso requiere
--     descargar el PDF que tiene su propia ACL).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_athlete_certificate_public(
    p_folio text DEFAULT NULL,
    p_qr_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cert record;
    v_school_name text;
    v_athlete_name text;
BEGIN
    IF p_folio IS NULL AND p_qr_token IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    SELECT * INTO v_cert
    FROM public.athlete_certificates
    WHERE (p_folio IS NOT NULL AND folio = p_folio)
       OR (p_qr_token IS NOT NULL AND qr_verify_token = p_qr_token);

    IF v_cert.id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    SELECT name INTO v_school_name FROM public.schools WHERE id = v_cert.school_id;

    -- Solo el nombre, no doc ni datos sensibles
    v_athlete_name := COALESCE(
        (SELECT full_name FROM public.children WHERE id = v_cert.child_id),
        (SELECT full_name FROM public.profiles  WHERE id = v_cert.profile_id)
    );

    RETURN jsonb_build_object(
        'found',         true,
        'folio',         v_cert.folio,
        'kind',          v_cert.kind,
        'title',         v_cert.title,
        'status',        v_cert.status,
        'school_name',   v_school_name,
        'athlete_name',  v_athlete_name,
        'issued_at',     v_cert.issued_at,
        'revoked_at',    v_cert.revoked_at,
        'revocation_reason', CASE WHEN v_cert.status = 'revoked' THEN v_cert.revocation_reason ELSE NULL END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_athlete_certificate_public(text, uuid) TO anon, authenticated;


-- ============================================================================
-- 11. RPC: list_athlete_certificates (school admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_athlete_certificates(
    p_school_id uuid,
    p_status    text  DEFAULT NULL,
    p_kind      text  DEFAULT NULL,
    p_search    text  DEFAULT NULL,
    p_limit     int   DEFAULT 50,
    p_offset    int   DEFAULT 0
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
    FROM public.athlete_certificates ac
    LEFT JOIN public.children c ON c.id = ac.child_id
    LEFT JOIN public.profiles p ON p.id = ac.profile_id
    WHERE ac.school_id = p_school_id
      AND (p_status IS NULL OR ac.status = p_status)
      AND (p_kind   IS NULL OR ac.kind   = p_kind)
      AND (
        p_search IS NULL OR p_search = ''
        OR ac.folio ILIKE '%' || p_search || '%'
        OR c.full_name ILIKE '%' || p_search || '%'
        OR p.full_name ILIKE '%' || p_search || '%'
      );

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            ac.id,
            ac.folio,
            ac.kind,
            ac.title,
            ac.status,
            ac.created_at,
            ac.issued_at,
            ac.pdf_url,
            ac.qr_verify_token,
            ac.template_id,
            ac.child_id,
            ac.profile_id,
            COALESCE(c.full_name, p.full_name) AS athlete_name,
            tpl.name AS template_name,
            tpl.requires_payment,
            tpl.price
        FROM public.athlete_certificates ac
        LEFT JOIN public.children c   ON c.id  = ac.child_id
        LEFT JOIN public.profiles p   ON p.id  = ac.profile_id
        LEFT JOIN public.school_certificate_templates tpl ON tpl.id = ac.template_id
        WHERE ac.school_id = p_school_id
          AND (p_status IS NULL OR ac.status = p_status)
          AND (p_kind   IS NULL OR ac.kind   = p_kind)
          AND (
            p_search IS NULL OR p_search = ''
            OR ac.folio ILIKE '%' || p_search || '%'
            OR c.full_name ILIKE '%' || p_search || '%'
            OR p.full_name ILIKE '%' || p_search || '%'
          )
        ORDER BY ac.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_athlete_certificates(uuid, text, text, text, int, int) TO authenticated;


-- ============================================================================
-- 12. RPC: my_athlete_certificates — atleta o padre listan las suyas
-- ============================================================================
CREATE OR REPLACE FUNCTION public.my_athlete_certificates()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            ac.id,
            ac.folio,
            ac.kind,
            ac.title,
            ac.status,
            ac.created_at,
            ac.issued_at,
            ac.pdf_url,
            ac.qr_verify_token,
            ac.school_id,
            s.name AS school_name,
            COALESCE(c.full_name, p.full_name) AS athlete_name
        FROM public.athlete_certificates ac
        LEFT JOIN public.children c ON c.id = ac.child_id
        LEFT JOIN public.profiles p ON p.id = ac.profile_id
        LEFT JOIN public.schools  s ON s.id = ac.school_id
        WHERE
            ac.profile_id = auth.uid()
            OR (
                ac.child_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM public.children cc
                    WHERE cc.id = ac.child_id AND cc.parent_id = auth.uid()
                )
            )
        ORDER BY ac.created_at DESC
        LIMIT 100
    ) t;

    RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_athlete_certificates() TO authenticated;


-- ============================================================================
-- 13. RPC: set_certificate_pdf_url — usado por BFF tras subir el PDF
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_certificate_pdf_url(
    p_certificate_id uuid,
    p_pdf_url text
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
    FROM public.athlete_certificates WHERE id = p_certificate_id;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Certificate not found' USING ERRCODE = '02000';
    END IF;

    IF NOT (public.is_super_admin() OR public.is_school_admin(v_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.athlete_certificates
    SET pdf_url = p_pdf_url
    WHERE id = p_certificate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_certificate_pdf_url(uuid, text) TO authenticated;


-- ============================================================================
-- 14. Storage bucket para PDFs (idempotente)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificates', 'certificates', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: lectura solo para owners (atleta/padre/escuela admin/super-admin)
DROP POLICY IF EXISTS "certificates_storage_read" ON storage.objects;
CREATE POLICY "certificates_storage_read"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'certificates'
        AND EXISTS (
            SELECT 1 FROM public.athlete_certificates ac
            WHERE ac.pdf_url = storage.objects.name
              AND (
                public.is_super_admin()
                OR public.is_school_admin(ac.school_id)
                OR ac.profile_id = auth.uid()
                OR (
                    ac.child_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM public.children c
                        WHERE c.id = ac.child_id AND c.parent_id = auth.uid()
                    )
                )
              )
        )
    );

-- Insert via service role (BFF) bypassea RLS de objects, pero defendamos:
DROP POLICY IF EXISTS "certificates_storage_write_admin" ON storage.objects;
CREATE POLICY "certificates_storage_write_admin"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'certificates'
        AND EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.profile_id = auth.uid()
              AND sm.status = 'active'
              AND sm.role IN ('owner','admin')
        )
    );
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

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
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
-- Migration: 20260424000006_admin_global_counts.sql
-- Description: RPCs SECURITY DEFINER para que el super-admin vea conteos
--   y listados globales en /admin sin pelearse con la RLS de profiles/schools.
--   Reusa el helper public.is_super_admin() del Sprint 1.

-- ============================================================================
-- 1. admin_global_counts() — totales para el dashboard del super-admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_global_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'total_users',          (SELECT COUNT(*) FROM public.profiles),
        'total_schools',        (SELECT COUNT(*) FROM public.schools),
        'verified_schools',     (SELECT COUNT(*) FROM public.schools WHERE verified = true),
        'total_children',       (SELECT COUNT(*) FROM public.children WHERE COALESCE(is_active, true) = true),
        'total_coaches',        (SELECT COUNT(*) FROM public.profiles WHERE role = 'coach'),
        'total_parents',        (SELECT COUNT(*) FROM public.profiles WHERE role = 'parent'),
        'total_athletes',       (SELECT COUNT(*) FROM public.profiles WHERE role = 'athlete'),
        'total_branches',       (SELECT COUNT(*) FROM public.school_branches),
        'total_enrollments',    (SELECT COUNT(*) FROM public.enrollments WHERE status = 'active'),
        'total_active_cards',   (SELECT COUNT(*) FROM public.athlete_id_cards WHERE status = 'active'),
        'total_certificates',   (SELECT COUNT(*) FROM public.athlete_certificates WHERE status = 'issued'),
        'total_join_qrs',       (SELECT COUNT(*) FROM public.school_join_qr_codes WHERE active = true),
        'payments_paid_30d',    (SELECT COUNT(*) FROM public.payments WHERE status = 'paid' AND created_at >= now() - interval '30 days'),
        'payments_pending',     (SELECT COUNT(*) FROM public.payments WHERE status IN ('pending','awaiting_approval')),
        'revenue_30d',          (SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE status = 'paid' AND created_at >= now() - interval '30 days')
    ) INTO v;

    RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_global_counts() TO authenticated;


-- ============================================================================
-- 2. admin_list_users(p_search, p_role, p_limit, p_offset)
--    Reemplaza el SELECT directo a profiles que la RLS limita
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_users(
    p_search text DEFAULT NULL,
    p_role   text DEFAULT NULL,
    p_limit  int  DEFAULT 50,
    p_offset int  DEFAULT 0
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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE (p_role IS NULL OR p.role::text = p_role)
      AND (
        p_search IS NULL OR p_search = ''
        OR p.full_name ILIKE '%' || p_search || '%'
        OR u.email     ILIKE '%' || p_search || '%'
      );

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            p.id,
            p.full_name,
            p.role,
            u.email,
            u.last_sign_in_at,
            p.created_at
        FROM public.profiles p
        LEFT JOIN auth.users u ON u.id = p.id
        WHERE (p_role IS NULL OR p.role::text = p_role)
          AND (
            p_search IS NULL OR p_search = ''
            OR p.full_name ILIKE '%' || p_search || '%'
            OR u.email     ILIKE '%' || p_search || '%'
          )
        ORDER BY p.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, int, int) TO authenticated;


-- ============================================================================
-- 3. admin_list_schools_global(p_search, p_verified, p_limit, p_offset)
--    Reemplaza el SELECT directo a schools que la RLS limita
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_schools_global(
    p_search   text    DEFAULT NULL,
    p_verified boolean DEFAULT NULL,
    p_limit    int     DEFAULT 50,
    p_offset   int     DEFAULT 0
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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.schools s
    WHERE (p_verified IS NULL OR s.verified = p_verified)
      AND (
        p_search IS NULL OR p_search = ''
        OR s.name ILIKE '%' || p_search || '%'
        OR s.city ILIKE '%' || p_search || '%'
      );

    SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            s.id,
            s.name,
            s.city,
            s.verified,
            s.created_at,
            s.owner_id,
            (SELECT u.email FROM auth.users u WHERE u.id = s.owner_id) AS owner_email,
            (SELECT COUNT(*) FROM public.children c WHERE c.school_id = s.id AND COALESCE(c.is_active, true)) AS children_count,
            (SELECT COUNT(*) FROM public.school_branches b WHERE b.school_id = s.id) AS branches_count
        FROM public.schools s
        WHERE (p_verified IS NULL OR s.verified = p_verified)
          AND (
            p_search IS NULL OR p_search = ''
            OR s.name ILIKE '%' || p_search || '%'
            OR s.city ILIKE '%' || p_search || '%'
          )
        ORDER BY s.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_schools_global(text, boolean, int, int) TO authenticated;
