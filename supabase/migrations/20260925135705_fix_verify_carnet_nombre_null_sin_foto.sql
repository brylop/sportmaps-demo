-- =============================================================================
-- 20260925135705_fix_verify_carnet_nombre_null_sin_foto.sql
-- Autor: brylop   Fecha: 2026-09-25   Versión anterior: 20260925135553
-- Objetivo: que la página pública del carnet (/c/:token) y "Carnets de mis
--   hijos" muestren el NOMBRE del menor aunque no tenga foto.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- EL BUG, MEDIDO CONTRA LA BASE VIVA (2026-09-25)
--
-- 439 de 485 carnets de menores vigentes devolvían `athlete: null` en
-- `verify_athlete_id_card_public`: la tarjeta pintaba "—" en vez del nombre,
-- sin iniciales, sin documento y sin datos de emergencia. Los 46 que sí se
-- veían eran exactamente los que tienen foto.
--
-- Causa: la rama de menores armaba el atleta con
--   jsonb_set(jsonb_set(obj, '{full_name}', to_jsonb(c.full_name)),
--             '{avatar_url}', to_jsonb(COALESCE(v_card.photo_url, c.avatar_url)))
-- y `jsonb_set` es STRICT: si el menor no tiene foto en el carnet ni avatar
-- en su ficha, `to_jsonb(NULL)` es NULL y el objeto ENTERO queda en NULL.
-- Las ramas de adulto (`profile`) y de atleta sin cuenta (`unregistered`)
-- usan `jsonb_build_object`, que sí tolera nulos, y por eso no fallaban.
--
-- El patrón entró en 20260424000003 (día 2 del módulo); el original
-- 20260424000002 usaba `jsonb_build_object`. Llevaba cinco meses vivo sin que
-- nadie lo viera porque hasta el 2026-09-02 (Dynasty emitió 494 en un lote)
-- casi no había carnets.
--
-- QUÉ CAMBIA
--
-- Solo la rama `child_id IS NOT NULL` pasa a `jsonb_build_object('kind',
-- 'child', 'full_name', …, 'avatar_url', …)`, misma forma que las otras dos
-- ramas. Todo lo demás (campos opcionales por plantilla, sede/equipo,
-- fee_status, forma de la respuesta) queda idéntico a la versión viva de la
-- base (verificado por hash del cuerpo antes de aplicar).
--
-- Verificación después de aplicar (como anon, igual que la página pública):
--   select count(*) filter (where jsonb_typeof(r->'athlete') <> 'object')
--   from (select public.verify_athlete_id_card_public(qr_token) r
--           from public.athlete_id_cards
--          where child_id is not null and status='active'
--            and valid_until >= current_date) x;   -- debe dar 0
-- =============================================================================

BEGIN;

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

        SELECT jsonb_build_object('kind', 'child', 'full_name', c.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, c.avatar_url)),
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

-- La página /c/:token se abre sin sesión: anon y PUBLIC ya tenían EXECUTE y
-- CREATE OR REPLACE conserva la ACL, pero se deja explícito por convención.
GRANT EXECUTE ON FUNCTION public.verify_athlete_id_card_public(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.verify_athlete_id_card_public(uuid) IS
  'Verificación pública del carnet por QR token (sin auth). Cubre child/profile/unregistered_athlete. 2026-09-25: la rama child usa jsonb_build_object — con jsonb_set (STRICT) un menor sin foto devolvía athlete NULL y el carnet salía sin nombre.';

COMMIT;
