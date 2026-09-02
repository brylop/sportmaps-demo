-- =============================================================================
-- 20260902113317_athlete_id_cards_unregistered_support.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902112920
-- Objetivo: D1 del spec de asistencia (docs/specs/asistencia-rapida-checkin.md
-- §8, decisión D1) — los 437 atletas sin cuenta (unregistered_athletes) no
-- podían tener carnet: `athlete_id_cards` solo admitía child_id XOR
-- profile_id, y `list_school_athletes_for_card_issue_v2` los listaba con
-- `issuable=false` a propósito. Se decidió emitir primero y convertir
-- después (el carnet puede ser el incentivo de registro).
--
-- Toca 4 objetos, en orden de dependencia:
--   1. Esquema: unregistered_athlete_id + XOR de tres + índice de carnet
--      activo único.
--   2. issue_athlete_id_card(): acepta el tercer tipo.
--   3. list_school_athletes_for_card_issue_v2(): issuable=true para ese branch.
--   4. verify_athlete_id_card_public(): tercera rama al escanear el QR — sin
--      esto, un carnet de atleta sin cuenta ya emitido mostraría la página
--      pública en blanco. Sin fee_status (payments no tiene
--      unregistered_athlete_id) — mismo comportamiento que un template con
--      ese campo apagado.
--   5. list_athlete_id_cards(): que el panel de administración de carnets
--      muestre nombre/equipo de estos, no filas en blanco.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ── 1. Esquema ──────────────────────────────────────────────────────────────
ALTER TABLE public.athlete_id_cards
    ADD COLUMN IF NOT EXISTS unregistered_athlete_id uuid REFERENCES public.unregistered_athletes(id) ON DELETE CASCADE;

ALTER TABLE public.athlete_id_cards
    DROP CONSTRAINT IF EXISTS athlete_id_cards_one_athlete;

ALTER TABLE public.athlete_id_cards
    ADD CONSTRAINT athlete_id_cards_one_athlete CHECK (
        (((child_id IS NOT NULL))::int
       + ((profile_id IS NOT NULL))::int
       + ((unregistered_athlete_id IS NOT NULL))::int) = 1
    );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_card_per_unregistered
    ON public.athlete_id_cards(unregistered_athlete_id)
    WHERE status = 'active' AND unregistered_athlete_id IS NOT NULL;

COMMENT ON COLUMN public.athlete_id_cards.unregistered_athlete_id IS
    'Atleta sin cuenta (school-managed). XOR con child_id/profile_id. Agregado 2026-09-02 — antes solo se podía emitir carnet a menores/adultos con cuenta.';

-- ── 2. issue_athlete_id_card(): tercer tipo de atleta ───────────────────────
CREATE OR REPLACE FUNCTION public.issue_athlete_id_card(
    p_school_id   uuid,
    p_child_id    uuid DEFAULT NULL,
    p_profile_id  uuid DEFAULT NULL,
    p_template_id uuid DEFAULT NULL,
    p_valid_until date DEFAULT NULL,
    p_photo_url   text DEFAULT NULL,
    p_unregistered_athlete_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

    -- Exactamente uno de los tres
    IF ((p_child_id IS NOT NULL)::int + (p_profile_id IS NOT NULL)::int + (p_unregistered_athlete_id IS NOT NULL)::int) <> 1 THEN
        RAISE EXCEPTION 'Must specify exactly one of p_child_id, p_profile_id or p_unregistered_athlete_id'
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

    ELSE
        SELECT COUNT(*) INTO v_owner_count
        FROM public.unregistered_athletes
        WHERE id = p_unregistered_athlete_id AND school_id = p_school_id AND is_active = true;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Athlete does not belong to this school'
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
        p_school_id, p_template_id, p_child_id, p_profile_id, p_unregistered_athlete_id,
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

COMMENT ON FUNCTION public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text, uuid) IS
  'Emite un nuevo carnet para child, profile o unregistered_athlete (XOR de los tres). Auto-revoca el anterior si existe. Extendida 2026-09-02 con el tercer tipo (D1 del spec de asistencia).';

REVOKE ALL ON FUNCTION public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text, uuid) TO authenticated, service_role;

-- CREATE OR REPLACE con una firma distinta crea un OVERLOAD nuevo, no
-- reemplaza — lección de la migración 20260902104747/104919 con
-- upsert_attendance_record: si no se borra la de 6 parámetros, el frontend
-- (que sigue llamando con 6 named params) puede resolver contra CUALQUIERA
-- de las dos según cómo arme la llamada, y la vieja nunca recibiría
-- p_unregistered_athlete_id. Se borra explícito.
DROP FUNCTION IF EXISTS public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text);

-- ── 3. list_school_athletes_for_card_issue_v2(): issuable = true ───────────
-- Misma firma que antes — no hay overload que limpiar acá.
CREATE OR REPLACE FUNCTION public.list_school_athletes_for_card_issue_v2(p_school_id uuid, p_search text DEFAULT NULL::text, p_team_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_card_filter text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_limit  int  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
    v_offset int  := GREATEST(COALESCE(p_offset, 0), 0);
    v_filter text := COALESCE(NULLIF(p_card_filter, ''), 'all');
    v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
    v_result jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_filter NOT IN ('all', 'with', 'without') THEN
        RAISE EXCEPTION 'p_card_filter debe ser all | with | without' USING ERRCODE = '22023';
    END IF;

    WITH base AS (
        SELECT 'child'::text AS kind,
               c.id          AS athlete_id,
               c.full_name,
               c.avatar_url,
               c.doc_type,
               c.doc_number,
               c.team_id,
               t.name        AS team_name,
               COALESCE(c.branch_id, public.get_single_branch_id(c.school_id)) AS branch_id,
               sb.name       AS branch_name,
               true          AS issuable,
               card.status   AS card_status,
               card.valid_until AS card_valid_until
          FROM public.children c
          LEFT JOIN public.teams t ON t.id = c.team_id
          LEFT JOIN public.school_branches sb ON sb.id = COALESCE(c.branch_id, public.get_single_branch_id(c.school_id))
          LEFT JOIN LATERAL (
                SELECT CASE WHEN aic.valid_until >= CURRENT_DATE THEN 'active' ELSE 'expired' END AS status, aic.valid_until
                  FROM public.athlete_id_cards aic
                 WHERE aic.child_id = c.id AND aic.status = 'active'
                 ORDER BY aic.issued_at DESC LIMIT 1
          ) card ON true
         WHERE c.school_id = p_school_id AND c.is_active = true

        UNION ALL

        SELECT 'profile'::text,
               p.id,
               p.full_name,
               p.avatar_url,
               p.document_type,
               p.document_number,
               tm.team_id,
               tm.team_name,
               COALESCE(tm.branch_id, sm.branch_id, public.get_single_branch_id(p_school_id)),
               sb.name,
               true,
               card.status,
               card.valid_until
          FROM public.school_members sm
          JOIN public.profiles p ON p.id = sm.profile_id
          LEFT JOIN LATERAL (
                SELECT t.id AS team_id, t.name AS team_name, t.branch_id
                  FROM public.team_members tmm
                  JOIN public.teams t ON t.id = tmm.team_id
                 WHERE tmm.profile_id = sm.profile_id AND t.school_id = p_school_id
                 LIMIT 1
          ) tm ON true
          LEFT JOIN public.school_branches sb ON sb.id = COALESCE(tm.branch_id, sm.branch_id, public.get_single_branch_id(p_school_id))
          LEFT JOIN LATERAL (
                SELECT CASE WHEN aic.valid_until >= CURRENT_DATE THEN 'active' ELSE 'expired' END AS status, aic.valid_until
                  FROM public.athlete_id_cards aic
                 WHERE aic.profile_id = sm.profile_id AND aic.status = 'active'
                 ORDER BY aic.issued_at DESC LIMIT 1
          ) card ON true
         WHERE sm.school_id = p_school_id AND sm.status = 'active' AND sm.role = 'athlete'

        UNION ALL

        -- Antes: issuable=false a propósito (no había columna para colgar el
        -- carnet). Ahora que existe unregistered_athlete_id, mismo tratamiento
        -- que child/profile: issuable=true y su propio lookup de carnet activo.
        SELECT 'unregistered'::text,
               ua.id,
               ua.full_name,
               NULL::text,
               ua.doc_type,
               ua.doc_number,
               NULL::uuid,
               NULL::text,
               COALESCE(ua.branch_id, public.get_single_branch_id(ua.school_id)),
               sb.name,
               true,
               card.status,
               card.valid_until
          FROM public.unregistered_athletes ua
          LEFT JOIN public.school_branches sb ON sb.id = COALESCE(ua.branch_id, public.get_single_branch_id(ua.school_id))
          LEFT JOIN LATERAL (
                SELECT CASE WHEN aic.valid_until >= CURRENT_DATE THEN 'active' ELSE 'expired' END AS status, aic.valid_until
                  FROM public.athlete_id_cards aic
                 WHERE aic.unregistered_athlete_id = ua.id AND aic.status = 'active'
                 ORDER BY aic.issued_at DESC LIMIT 1
          ) card ON true
         WHERE ua.school_id = p_school_id AND ua.is_active = true AND ua.linked_profile_id IS NULL
    ),
    scoped AS (
        SELECT b.*, COALESCE(b.card_status = 'active', false) AS has_active_card
          FROM base b
         WHERE (p_team_id IS NULL OR b.team_id = p_team_id)
           AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
           AND (v_search IS NULL
                OR b.full_name ILIKE '%' || v_search || '%'
                OR COALESCE(b.doc_number, '') ILIKE '%' || v_search || '%')
    ),
    filtered AS (
        SELECT * FROM scoped
         WHERE v_filter = 'all'
            OR (v_filter = 'with' AND has_active_card)
            OR (v_filter = 'without' AND NOT has_active_card)
    ),
    page AS (
        SELECT * FROM filtered ORDER BY full_name LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'rows', COALESCE((SELECT jsonb_agg(to_jsonb(pg) ORDER BY pg.full_name) FROM page pg), '[]'::jsonb),
        'total',        (SELECT count(*) FROM filtered),
        'total_scope',  (SELECT count(*) FROM scoped),
        'with_card',    (SELECT count(*) FROM scoped WHERE has_active_card),
        'without_card', (SELECT count(*) FROM scoped WHERE NOT has_active_card),
        'not_issuable', (SELECT count(*) FROM scoped WHERE NOT issuable),
        'limit',  v_limit,
        'offset', v_offset,
        'teams', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'name') FROM (SELECT DISTINCT jsonb_build_object('id', team_id, 'name', team_name) AS x FROM base WHERE team_id IS NOT NULL) s), '[]'::jsonb),
        'branches', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'name') FROM (SELECT DISTINCT jsonb_build_object('id', branch_id, 'name', branch_name) AS x FROM base WHERE branch_id IS NOT NULL AND branch_name IS NOT NULL) s), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.list_school_athletes_for_card_issue_v2(uuid, text, uuid, uuid, text, integer, integer) IS
  'Lista atletas de la escuela elegibles para emitir carnet (children + profiles + unregistered_athletes). Los tres son issuable=true desde 2026-09-02 (D1 del spec de asistencia) — antes unregistered quedaba false a propósito.';

-- ── 4. verify_athlete_id_card_public(): tercera rama al escanear el QR ─────
-- Sin esto, un carnet de atleta sin cuenta ya emitido resolvía al ELSE
-- (rama 'profile') con profile_id NULL — página pública en blanco. Sin
-- fee_status para esta rama: `payments` no tiene unregistered_athlete_id
-- (mismo comportamiento que un template con ese campo apagado).
CREATE OR REPLACE FUNCTION public.verify_athlete_id_card_public(p_qr_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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

    SELECT * INTO v_template FROM public.athlete_id_card_templates WHERE id = v_card.template_id;

    v_show := COALESCE(v_template.show_fields, jsonb_build_object(
        'photo', true, 'doc_number', false, 'team', true, 'branch', true, 'plan', false,
        'valid_until', true, 'fee_status', false, 'blood_type', false,
        'emergency_contact', false, 'eps', false, 'tshirt_size', false));

    SELECT id, name, logo_url, branding_settings, slug INTO v_school FROM public.schools WHERE id = v_card.school_id;

    IF v_card.child_id IS NOT NULL THEN
        v_athlete_filtered := jsonb_build_object('kind', 'child');

        SELECT jsonb_set(jsonb_set(v_athlete_filtered, '{full_name}', to_jsonb(c.full_name)),
                         '{avatar_url}', to_jsonb(COALESCE(v_card.photo_url, c.avatar_url))),
               c.branch_id, c.team_id, c.monthly_fee, c.parent_id
        INTO v_athlete_filtered, v_child_branch, v_child_team, v_monthly_fee, v_child_parent
        FROM public.children c WHERE c.id = v_card.child_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('doc_type', c.doc_type, 'doc_number', c.doc_number)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'blood_type')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('blood_type', c.blood_type)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'eps')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('eps_name', c.eps_name)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'tshirt_size')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('tshirt_size', c.tshirt_size)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'emergency_contact')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('emergency_contact', c.emergency_contact)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT name INTO v_branch_name FROM public.school_branches WHERE id = v_child_branch;
        END IF;
        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT name INTO v_team_name FROM public.teams WHERE id = v_child_team;
        END IF;

    ELSIF v_card.profile_id IS NOT NULL THEN
        SELECT jsonb_build_object('kind', 'profile', 'full_name', p.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, p.avatar_url))
        INTO v_athlete_filtered FROM public.profiles p WHERE p.id = v_card.profile_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('doc_type', p.document_type, 'doc_number', p.document_number)
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
        -- Atleta sin cuenta (unregistered_athletes) — agregado 2026-09-02.
        SELECT jsonb_build_object('kind', 'unregistered', 'full_name', ua.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, ua.avatar_url)),
               ua.branch_id
        INTO v_athlete_filtered, v_child_branch
        FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('doc_type', ua.doc_type, 'doc_number', ua.doc_number)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        IF COALESCE((v_show->>'blood_type')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('blood_type', ua.blood_type)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        IF COALESCE((v_show->>'eps')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object('eps_name', ua.eps_name)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        -- Sin tshirt_size en unregistered_athletes — se omite (mismo efecto
        -- que un template sin ese campo). emergency_contact sale de los
        -- campos guardian_* que sí existe acá, en vez de una columna propia.
        IF COALESCE((v_show->>'emergency_contact')::boolean, false) THEN
            SELECT v_athlete_filtered || jsonb_build_object(
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

    -- fee_status: solo aplica a child/profile — payments no tiene
    -- unregistered_athlete_id. Para esa rama queda 'unknown'/NULL, como si
    -- el template tuviera el campo apagado.
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
            'show_fields', v_template.show_fields) END,
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

COMMENT ON FUNCTION public.verify_athlete_id_card_public(uuid) IS
  'Verificación pública del carnet por QR token (sin auth). Cubre child/profile/unregistered_athlete (tercera rama agregada 2026-09-02, D1 del spec de asistencia) — sin fee_status para unregistered, payments no tiene esa columna.';

-- ── 5. list_athlete_id_cards(): que el panel de admin no muestre filas en
-- blanco para carnets de atletas sin cuenta. Mismo LEFT JOIN que ya usa para
-- children/profiles, sumando unregistered_athletes.
CREATE OR REPLACE FUNCTION public.list_athlete_id_cards(p_school_id uuid, p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_rows   jsonb;
    v_total  bigint;
    v_counts jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    WITH scoped AS (
        SELECT aic.*,
               CASE
                   WHEN aic.status = 'revoked'         THEN 'revoked'
                   WHEN aic.valid_until < CURRENT_DATE THEN 'expired'
                   ELSE 'active'
               END AS effective_status,
               COALESCE(c.full_name, p.full_name, ua.full_name)        AS athlete_name,
               COALESCE(c.avatar_url, p.avatar_url, ua.avatar_url)     AS athlete_photo,
               COALESCE(c.doc_number, p.document_number, ua.doc_number) AS doc_number,
               COALESCE(t.name, (
                   SELECT t3.name FROM public.team_members tm
                     JOIN public.teams t3 ON t3.id = tm.team_id
                    WHERE tm.profile_id = aic.profile_id AND t3.school_id = aic.school_id
                    LIMIT 1
               ), (
                   SELECT t3.name FROM public.enrollments e
                     JOIN public.teams t3 ON t3.id = e.team_id
                    WHERE e.unregistered_athlete_id = aic.unregistered_athlete_id AND e.school_id = aic.school_id AND e.status = 'active'
                    LIMIT 1
               )) AS team_name,
               COALESCE(sb.name, (
                   SELECT sb2.name FROM public.team_members tm
                     JOIN public.teams t3 ON t3.id = tm.team_id
                     JOIN public.school_branches sb2 ON sb2.id = t3.branch_id
                    WHERE tm.profile_id = aic.profile_id AND t3.school_id = aic.school_id
                    LIMIT 1
               ), (
                   SELECT sb2.name FROM public.enrollments e
                     JOIN public.teams prog ON prog.id = e.team_id
                     JOIN public.school_branches sb2 ON sb2.id = prog.branch_id
                    WHERE e.user_id = aic.profile_id AND e.school_id = aic.school_id AND e.status = 'active'
                    LIMIT 1
               ), (
                   SELECT sb2.name FROM public.school_members sm
                     JOIN public.school_branches sb2 ON sb2.id = sm.branch_id
                    WHERE sm.profile_id = aic.profile_id AND sm.school_id = aic.school_id
                    LIMIT 1
               ), (
                   SELECT sb2.name FROM public.unregistered_athletes ua2
                     JOIN public.school_branches sb2 ON sb2.id = ua2.branch_id
                    WHERE ua2.id = aic.unregistered_athlete_id
               )) AS branch_name
          FROM public.athlete_id_cards aic
          LEFT JOIN public.children              c  ON c.id  = aic.child_id
          LEFT JOIN public.profiles              p  ON p.id  = aic.profile_id
          LEFT JOIN public.unregistered_athletes ua ON ua.id = aic.unregistered_athlete_id
          LEFT JOIN public.teams           t  ON t.id  = c.team_id
          LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
         WHERE aic.school_id = p_school_id
           AND (
                p_search IS NULL OR p_search = ''
                OR c.full_name       ILIKE '%' || p_search || '%'
                OR p.full_name       ILIKE '%' || p_search || '%'
                OR ua.full_name      ILIKE '%' || p_search || '%'
                OR c.doc_number      ILIKE '%' || p_search || '%'
                OR p.document_number ILIKE '%' || p_search || '%'
                OR ua.doc_number     ILIKE '%' || p_search || '%'
           )
    ),
    matching AS (
        SELECT * FROM scoped WHERE p_status IS NULL OR effective_status = p_status
    )
    SELECT (SELECT count(*) FROM matching),
           COALESCE((
             SELECT jsonb_agg(to_jsonb(x) ORDER BY x.issued_at DESC)
               FROM (
                 SELECT id, qr_token, effective_status AS status, issued_at, valid_until, version,
                        template_id, child_id, profile_id, unregistered_athlete_id, athlete_name, athlete_photo,
                        doc_number, team_name, branch_name
                   FROM matching
                  ORDER BY issued_at DESC
                  LIMIT p_limit OFFSET p_offset
               ) x
           ), '[]'::jsonb),
           jsonb_build_object(
             'active',  (SELECT count(*) FROM scoped WHERE effective_status = 'active'),
             'revoked', (SELECT count(*) FROM scoped WHERE effective_status = 'revoked'),
             'expired', (SELECT count(*) FROM scoped WHERE effective_status = 'expired'),
             'all',     (SELECT count(*) FROM scoped)
           )
      INTO v_total, v_rows, v_counts;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows, 'counts', v_counts);
END;
$function$;

COMMENT ON FUNCTION public.list_athlete_id_cards(uuid, text, text, integer, integer) IS
  'Panel admin de carnets emitidos. Cubre child/profile/unregistered_athlete (agregado 2026-09-02, D1 del spec de asistencia) — antes un carnet de atleta sin cuenta salía con nombre/foto/equipo en blanco.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'athlete_id_cards_one_athlete';
SELECT indexname FROM pg_indexes WHERE tablename = 'athlete_id_cards' AND indexname = 'uniq_active_card_per_unregistered';
SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'issue_athlete_id_card' AND pronamespace = 'public'::regnamespace;
