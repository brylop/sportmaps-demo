-- =============================================================================
-- 20260819113555_carnets_listado_adultos_y_diseno.sql
-- Autor: brylop   Fecha: 2026-08-19   Versión anterior: 20260819091500
-- Objetivo: el listado de "Emitir carnet" solo mostraba 100 menores (LIMIT fijo
--   y sin totales), dejaba fuera a los atletas adultos y a los no registrados, y
--   marcaba como "con carnet activo" a carnets ya vencidos. Además la plantilla
--   solo permitía elegir un color de acento, así que todos los carnets se veían
--   iguales.
--
--   1. list_school_athletes_for_card_issue_v2: menores + adultos + no
--      registrados, filtros y paginación en servidor, totales reales y
--      catálogo de equipos/sedes. (La v1 se deja intacta: el frontend en
--      producción todavía la llama y devuelve un array, no un objeto.)
--   2. athlete_id_card_templates: columnas de diseño (segundo color, layout,
--      patrón, forma de la foto, modo de texto, imagen de fondo). Los DEFAULT
--      reproducen exactamente el aspecto actual → ninguna plantilla existente
--      cambia de look.
--   3. verify_athlete_id_card_public: devuelve las columnas de diseño nuevas y,
--      para atletas adultos, el documento y el equipo por inscripción (antes el
--      carnet de un adulto salía sin documento y muchas veces sin equipo).
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

-- ============================================================================
-- 1. Diseño de la plantilla
--    Todo nullable o con DEFAULT igual al comportamiento actual del componente
--    <AthleteIdCard/>: gradiente accent → secundario de la marca, franjas
--    diagonales, foto con esquinas redondeadas y color de texto automático.
-- ============================================================================
ALTER TABLE public.athlete_id_card_templates
    ADD COLUMN IF NOT EXISTS secondary_color text,
    ADD COLUMN IF NOT EXISTS layout          text NOT NULL DEFAULT 'classic',
    ADD COLUMN IF NOT EXISTS pattern         text NOT NULL DEFAULT 'diagonal',
    ADD COLUMN IF NOT EXISTS photo_shape     text NOT NULL DEFAULT 'rounded',
    ADD COLUMN IF NOT EXISTS text_mode       text NOT NULL DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS background_url  text;

COMMENT ON COLUMN public.athlete_id_card_templates.secondary_color IS
    'Segundo color del gradiente. NULL → cae al secundario de la marca de la escuela.';
COMMENT ON COLUMN public.athlete_id_card_templates.layout IS
    'Disposición del frente: classic | modern | minimal | photo | stripe.';
COMMENT ON COLUMN public.athlete_id_card_templates.pattern IS
    'Textura de fondo: none | diagonal | dots | grid | waves.';
COMMENT ON COLUMN public.athlete_id_card_templates.photo_shape IS
    'Forma del retrato: rounded | circle | square.';
COMMENT ON COLUMN public.athlete_id_card_templates.text_mode IS
    'auto = contraste calculado sobre el gradiente; light/dark = forzado.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.athlete_id_card_templates'::regclass
          AND conname  = 'athlete_id_card_templates_layout_check'
    ) THEN
        ALTER TABLE public.athlete_id_card_templates
            ADD CONSTRAINT athlete_id_card_templates_layout_check
            CHECK (layout IN ('classic', 'modern', 'minimal', 'photo', 'stripe'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.athlete_id_card_templates'::regclass
          AND conname  = 'athlete_id_card_templates_pattern_check'
    ) THEN
        ALTER TABLE public.athlete_id_card_templates
            ADD CONSTRAINT athlete_id_card_templates_pattern_check
            CHECK (pattern IN ('none', 'diagonal', 'dots', 'grid', 'waves'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.athlete_id_card_templates'::regclass
          AND conname  = 'athlete_id_card_templates_photo_shape_check'
    ) THEN
        ALTER TABLE public.athlete_id_card_templates
            ADD CONSTRAINT athlete_id_card_templates_photo_shape_check
            CHECK (photo_shape IN ('rounded', 'circle', 'square'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.athlete_id_card_templates'::regclass
          AND conname  = 'athlete_id_card_templates_text_mode_check'
    ) THEN
        ALTER TABLE public.athlete_id_card_templates
            ADD CONSTRAINT athlete_id_card_templates_text_mode_check
            CHECK (text_mode IN ('auto', 'light', 'dark'));
    END IF;
END $$;

-- ============================================================================
-- 2. Listado de atletas elegibles — v2
--    La v1 solo leía public.children con LIMIT p_limit y devolvía un array
--    pelado: la pantalla contaba el largo de ese array, así que una escuela de
--    463 atletas mostraba "0/100". Esta versión devuelve totales aparte de la
--    página y suma las otras dos poblaciones de la escuela.
--
--    kind:
--      child        → public.children              (emitible)
--      profile      → adulto con cuenta, miembro activo con rol athlete
--                     (emitible: es justo lo que issue_athlete_id_card valida)
--      unregistered → ficha sin cuenta ni menor asociado. NO es emitible: el
--                     carnet exige child_id o profile_id. Se lista igual para
--                     que la escuela vea por qué no le cuadra el total, en vez
--                     de que el atleta desaparezca sin explicación.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_school_athletes_for_card_issue_v2(
    p_school_id   uuid,
    p_search      text DEFAULT NULL,
    p_team_id     uuid DEFAULT NULL,
    p_branch_id   uuid DEFAULT NULL,
    p_card_filter text DEFAULT 'all',    -- all | with | without
    p_limit       int  DEFAULT 50,
    p_offset      int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_limit    int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
    v_offset   int := GREATEST(COALESCE(p_offset, 0), 0);
    v_filter   text := COALESCE(NULLIF(p_card_filter, ''), 'all');
    v_search   text := NULLIF(btrim(COALESCE(p_search, '')), '');
    v_result   jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_filter NOT IN ('all', 'with', 'without') THEN
        RAISE EXCEPTION 'p_card_filter debe ser all | with | without'
            USING ERRCODE = '22023';
    END IF;

    WITH base AS (
        -- Menores
        SELECT 'child'::text                                          AS kind,
               c.id                                                   AS athlete_id,
               c.full_name,
               c.avatar_url,
               c.doc_type,
               c.doc_number,
               c.team_id,
               t.name                                                 AS team_name,
               COALESCE(c.branch_id, public.get_single_branch_id(c.school_id)) AS branch_id,
               sb.name                                                AS branch_name,
               true                                                   AS issuable,
               card.status                                            AS card_status,
               card.valid_until                                       AS card_valid_until
          FROM public.children c
          LEFT JOIN public.teams t ON t.id = c.team_id
          LEFT JOIN public.school_branches sb
                 ON sb.id = COALESCE(c.branch_id, public.get_single_branch_id(c.school_id))
          LEFT JOIN LATERAL (
                SELECT CASE WHEN aic.valid_until >= CURRENT_DATE THEN 'active' ELSE 'expired' END AS status,
                       aic.valid_until
                  FROM public.athlete_id_cards aic
                 WHERE aic.child_id = c.id AND aic.status = 'active'
                 ORDER BY aic.issued_at DESC
                 LIMIT 1
          ) card ON true
         WHERE c.school_id = p_school_id
           AND c.is_active = true

        UNION ALL

        -- Adultos con cuenta (miembros activos con rol atleta)
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
                 WHERE tmm.profile_id = sm.profile_id
                   AND t.school_id = p_school_id
                 LIMIT 1
          ) tm ON true
          LEFT JOIN public.school_branches sb
                 ON sb.id = COALESCE(tm.branch_id, sm.branch_id, public.get_single_branch_id(p_school_id))
          LEFT JOIN LATERAL (
                SELECT CASE WHEN aic.valid_until >= CURRENT_DATE THEN 'active' ELSE 'expired' END AS status,
                       aic.valid_until
                  FROM public.athlete_id_cards aic
                 WHERE aic.profile_id = sm.profile_id AND aic.status = 'active'
                 ORDER BY aic.issued_at DESC
                 LIMIT 1
          ) card ON true
         WHERE sm.school_id = p_school_id
           AND sm.status    = 'active'
           AND sm.role      = 'athlete'

        UNION ALL

        -- Fichas sin cuenta (no emitibles, se listan para que cuadre el total)
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
               false,
               NULL::text,
               NULL::date
          FROM public.unregistered_athletes ua
          LEFT JOIN public.school_branches sb
                 ON sb.id = COALESCE(ua.branch_id, public.get_single_branch_id(ua.school_id))
         WHERE ua.school_id = p_school_id
           AND ua.is_active = true
           AND ua.linked_profile_id IS NULL
    ),
    -- Alcance: search + equipo + sede. El filtro de carnet NO entra aquí porque
    -- las tres tarjetas de arriba (Todos / Con carnet / Sin carnet) se cuentan
    -- sobre este mismo conjunto.
    scoped AS (
        -- COALESCE obligatorio: sin carnet card_status es NULL y la comparación
        -- daría NULL, no false — el atleta no caería ni en "con" ni en "sin".
        SELECT b.*, COALESCE(b.card_status = 'active', false) AS has_active_card
          FROM base b
         WHERE (p_team_id   IS NULL OR b.team_id   = p_team_id)
           AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
           AND (
                v_search IS NULL
                OR b.full_name ILIKE '%' || v_search || '%'
                OR COALESCE(b.doc_number, '') ILIKE '%' || v_search || '%'
           )
    ),
    filtered AS (
        SELECT * FROM scoped
         WHERE v_filter = 'all'
            OR (v_filter = 'with'    AND has_active_card)
            OR (v_filter = 'without' AND NOT has_active_card)
    ),
    page AS (
        SELECT * FROM filtered
         ORDER BY full_name
         LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'rows', COALESCE((
            SELECT jsonb_agg(to_jsonb(pg) ORDER BY pg.full_name) FROM page pg
        ), '[]'::jsonb),
        'total',           (SELECT count(*) FROM filtered),
        'total_scope',     (SELECT count(*) FROM scoped),
        'with_card',       (SELECT count(*) FROM scoped WHERE has_active_card),
        'without_card',    (SELECT count(*) FROM scoped WHERE NOT has_active_card),
        'not_issuable',    (SELECT count(*) FROM scoped WHERE NOT issuable),
        'limit',           v_limit,
        'offset',          v_offset,
        'teams', COALESCE((
            SELECT jsonb_agg(x ORDER BY x->>'name')
              FROM (
                SELECT DISTINCT jsonb_build_object('id', team_id, 'name', team_name) AS x
                  FROM base WHERE team_id IS NOT NULL
              ) s
        ), '[]'::jsonb),
        'branches', COALESCE((
            SELECT jsonb_agg(x ORDER BY x->>'name')
              FROM (
                SELECT DISTINCT jsonb_build_object('id', branch_id, 'name', branch_name) AS x
                  FROM base WHERE branch_id IS NOT NULL AND branch_name IS NOT NULL
              ) s
        ), '[]'::jsonb)
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_school_athletes_for_card_issue_v2(uuid, text, uuid, uuid, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_school_athletes_for_card_issue_v2(uuid, text, uuid, uuid, text, int, int) TO authenticated;

-- ============================================================================
-- 3. verify_athlete_id_card_public
--    Mismo contrato de siempre (el público lo consume desde /c/:token), con dos
--    agregados: las columnas de diseño de la plantilla y, para atletas adultos,
--    documento + equipo por inscripción. Se mantiene el filtrado por
--    show_fields: lo que la plantilla apaga no viaja al cliente.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_athlete_id_card_public(p_qr_token uuid)
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

        -- El atleta adulto también lleva documento cuando la plantilla lo pide.
        -- Antes solo lo llevaban los menores y el carnet del adulto salía sin
        -- número, que es justo lo que se controla en la portería.
        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT v_athlete_filtered
                || jsonb_build_object('doc_type', p.document_type, 'doc_number', p.document_number)
            INTO v_athlete_filtered
            FROM public.profiles p WHERE p.id = v_card.profile_id;
        END IF;

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
                JOIN public.teams prog ON prog.id = e.team_id
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
            -- team_members primero; si el adulto no está en la plantilla del
            -- equipo pero sí inscrito, vale la inscripción activa.
            SELECT t.name INTO v_team_name
            FROM public.team_members tm
            JOIN public.teams t ON t.id = tm.team_id
            WHERE tm.profile_id = v_card.profile_id AND t.school_id = v_card.school_id
            LIMIT 1;

            IF v_team_name IS NULL THEN
                SELECT t.name INTO v_team_name
                FROM public.enrollments e
                JOIN public.teams t ON t.id = e.team_id
                WHERE e.user_id = v_card.profile_id
                  AND e.school_id = v_card.school_id
                  AND e.status = 'active'
                ORDER BY e.created_at
                LIMIT 1;
            END IF;
        END IF;
    END IF;

    IF COALESCE((v_show->>'fee_status')::boolean, false) THEN
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
            'id',              v_template.id,
            'name',            v_template.name,
            'accent_color',    v_template.accent_color,
            'secondary_color', v_template.secondary_color,
            'layout',          v_template.layout,
            'pattern',         v_template.pattern,
            'photo_shape',     v_template.photo_shape,
            'text_mode',       v_template.text_mode,
            'background_url',  v_template.background_url,
            'header_text',     v_template.header_text,
            'footer_text',     v_template.footer_text,
            'show_fields',     v_template.show_fields
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

-- El QR se valida sin sesión: el carnet es público por diseño.
GRANT EXECUTE ON FUNCTION public.verify_athlete_id_card_public(uuid) TO anon, authenticated;

-- ============================================================================
-- 4. list_athlete_id_cards
--    Misma firma (el frontend desplegado la sigue llamando igual), tres
--    arreglos: el documento del atleta adulto salía vacío porque solo se leía
--    children.doc_number; el estado mostraba "activo" en carnets ya vencidos
--    (la fecha manda, no la columna); y ahora devuelve los conteos por estado
--    para que las tarjetas de filtro no tengan que inventarlos con la página.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_athlete_id_cards(
    p_school_id uuid,
    p_status    text DEFAULT NULL,
    p_search    text DEFAULT NULL,
    p_limit     int  DEFAULT 50,
    p_offset    int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
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
                   WHEN aic.status = 'revoked'            THEN 'revoked'
                   WHEN aic.valid_until < CURRENT_DATE    THEN 'expired'
                   ELSE 'active'
               END AS effective_status,
               COALESCE(c.full_name, p.full_name)              AS athlete_name,
               COALESCE(c.avatar_url, p.avatar_url)            AS athlete_photo,
               COALESCE(c.doc_number, p.document_number)       AS doc_number,
               COALESCE(t.name, (
                   SELECT t3.name FROM public.team_members tm
                     JOIN public.teams t3 ON t3.id = tm.team_id
                    WHERE tm.profile_id = aic.profile_id AND t3.school_id = aic.school_id
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
               )) AS branch_name
          FROM public.athlete_id_cards aic
          LEFT JOIN public.children        c  ON c.id  = aic.child_id
          LEFT JOIN public.profiles        p  ON p.id  = aic.profile_id
          LEFT JOIN public.teams           t  ON t.id  = c.team_id
          LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
         WHERE aic.school_id = p_school_id
           AND (
                p_search IS NULL OR p_search = ''
                OR c.full_name       ILIKE '%' || p_search || '%'
                OR p.full_name       ILIKE '%' || p_search || '%'
                OR c.doc_number      ILIKE '%' || p_search || '%'
                OR p.document_number ILIKE '%' || p_search || '%'
           )
    ),
    matching AS (
        SELECT * FROM scoped
         WHERE p_status IS NULL OR effective_status = p_status
    )
    SELECT (SELECT count(*) FROM matching),
           COALESCE((
             SELECT jsonb_agg(to_jsonb(x) ORDER BY x.issued_at DESC)
               FROM (
                 SELECT id, qr_token, effective_status AS status, issued_at, valid_until, version,
                        template_id, child_id, profile_id, athlete_name, athlete_photo,
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
$fn$;

GRANT EXECUTE ON FUNCTION public.list_athlete_id_cards(uuid, text, text, int, int) TO authenticated;

COMMIT;
