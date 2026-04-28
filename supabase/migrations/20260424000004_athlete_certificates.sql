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

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
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
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
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
