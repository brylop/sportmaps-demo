-- =============================================================================
-- 20260902170826_torneos_internos_fix_payments_parent_id.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902164427
-- Objetivo: bug de correctitud encontrado revisando la Fase 1 de
-- docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md.
--
-- `register_for_internal_tournament()` insertaba en `payments` sin llenar
-- `parent_id` cuando un padre paga por su hijo (solo llenaba `child_id`).
-- `payments` tiene 4 columnas de sujeto (user_id/child_id/parent_id/school_id)
-- y el resto de la plataforma llena `parent_id` para ese caso — ver
-- verify_athlete_id_card_public() (20260902113317), que filtra directo por
-- `p.parent_id = v_card.profile_id`.
--
-- NO era un hueco de RLS: la policy "Payments: select parent" también matchea
-- por `child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())`,
-- así que el padre sí veía su pago. El problema es más silencioso: cualquier
-- reporte/agregación que filtre `payments.parent_id = X` directo (en vez de
-- unir contra children) se comía estos cobros sin avisar — el mismo patrón de
-- "columna sin llenar rompe en silencio" de otros hallazgos de este repo.
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

CREATE OR REPLACE FUNCTION public.register_for_internal_tournament(
    p_event_id    uuid,
    p_category_id uuid,
    p_child_id    uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_event           record;
    v_category        record;
    v_caller_role     public.user_role;
    v_caller_email    text;
    v_caller_phone    text;
    v_caller_name     text;
    v_participant_name  text;
    v_registration_id   uuid;
    v_payment_id        uuid;
    v_amount             numeric;
BEGIN
    SELECT id, school_id, title, tournament_scope, status, registrations_open
      INTO v_event
      FROM public.events
     WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Torneo no encontrado.';
    END IF;

    IF v_event.tournament_scope <> 'internal' THEN
        RAISE EXCEPTION 'Esta inscripción es solo para torneos/ligas internas de una escuela.';
    END IF;

    IF v_event.status <> 'active' OR v_event.registrations_open IS FALSE THEN
        RAISE EXCEPTION 'Las inscripciones no están abiertas.';
    END IF;

    SELECT id, event_id INTO v_category
      FROM public.event_categories_config
     WHERE id = p_category_id AND event_id = p_event_id AND active = true;

    IF v_category.id IS NULL THEN
        RAISE EXCEPTION 'Categoría no válida para este torneo.';
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    SELECT LOWER(TRIM(email)) INTO v_caller_email FROM auth.users WHERE id = auth.uid();
    SELECT full_name, phone INTO v_caller_name, v_caller_phone FROM public.profiles WHERE id = auth.uid();

    IF p_child_id IS NOT NULL THEN
        -- Solo puede inscribir a SU PROPIO hijo, matriculado en la MISMA escuela
        -- del torneo (evita inscribir a un hijo de otra escuela por error de UI).
        SELECT full_name INTO v_participant_name
          FROM public.children
         WHERE id = p_child_id AND parent_id = auth.uid() AND school_id = v_event.school_id;

        IF v_participant_name IS NULL THEN
            RAISE EXCEPTION 'Ese atleta no es un hijo tuyo inscrito en esta escuela.';
        END IF;
    ELSE
        IF v_caller_role <> 'athlete' THEN
            RAISE EXCEPTION 'Solo un atleta adulto puede inscribirse a sí mismo (sin indicar un hijo).';
        END IF;
        -- El atleta debe pertenecer a la escuela dueña del torneo.
        IF NOT EXISTS (
            SELECT 1 FROM public.school_members
             WHERE profile_id = auth.uid() AND school_id = v_event.school_id
               AND role = 'athlete' AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'No perteneces a la escuela dueña de este torneo.';
        END IF;
        v_participant_name := v_caller_name;
    END IF;

    -- Idempotencia: si ya existe una inscripción no cancelada, devolverla en vez
    -- de duplicar (el índice único de abajo la respalda a nivel base de datos).
    SELECT id, payment_id INTO v_registration_id, v_payment_id
      FROM public.event_registrations
     WHERE event_id = p_event_id AND category_id = p_category_id
       AND COALESCE(child_id, user_id) = COALESCE(p_child_id, auth.uid())
       AND status <> 'cancelled';

    IF v_registration_id IS NOT NULL THEN
        RETURN v_registration_id;
    END IF;

    -- Monto: la fase (vigente por fecha) manda; si no hay ninguna, precio 0 no
    -- es aceptable — sin fase no se puede cobrar, se corta acá.
    SELECT price_solo INTO v_amount
      FROM public.event_price_phases
     WHERE event_id = p_event_id AND valid_until >= CURRENT_DATE
     ORDER BY valid_until ASC
     LIMIT 1;

    IF v_amount IS NULL THEN
        RAISE EXCEPTION 'No hay una tarifa vigente configurada para este torneo todavía.';
    END IF;

    -- due_date es NOT NULL sin default y fn_payments_fill_period() NO lo
    -- rellena (solo period_year/period_month) — hay que darlo explícito.
    -- FIX 2026-09-02: parent_id llenado cuando quien paga es el padre (antes
    -- solo quedaba child_id, y el resto de la plataforma usa parent_id para
    -- reportes/agregaciones directas sobre payments).
    INSERT INTO public.payments (
        school_id, user_id, child_id, parent_id, amount, status, payment_type, concept, due_date
    ) VALUES (
        v_event.school_id,
        CASE WHEN p_child_id IS NULL THEN auth.uid() ELSE NULL END,
        p_child_id,
        CASE WHEN p_child_id IS NOT NULL THEN auth.uid() ELSE NULL END,
        v_amount,
        'pending',
        'one_time',
        'Inscripción torneo — ' || v_event.title || ' — ' || (SELECT category FROM public.event_categories_config WHERE id = p_category_id),
        public.qr_first_charge_due_date(v_event.school_id, CURRENT_DATE)
    ) RETURNING id INTO v_payment_id;

    INSERT INTO public.event_registrations (
        event_id, user_id, child_id, category_id, participant_name,
        participant_email, participant_phone, participant_role,
        status, payment_status, school_id, payment_id
    ) VALUES (
        p_event_id, auth.uid(), p_child_id, p_category_id, v_participant_name,
        v_caller_email, COALESCE(v_caller_phone, ''),
        CASE WHEN p_child_id IS NULL THEN 'athlete' ELSE 'parent' END,
        'pending', 'pending', v_event.school_id, v_payment_id
    ) RETURNING id INTO v_registration_id;

    RETURN v_registration_id;
END;
$$;

-- CREATE OR REPLACE mantiene el mismo GRANT/REVOKE ya aplicado en
-- 20260901114532 (misma firma, no crea overload) — no hace falta repetirlos,
-- pero los dejamos explícitos por si algún día alguien DROPea y recrea.
REVOKE ALL ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) TO authenticated;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT prosrc ILIKE '%parent_id%' AS tiene_parent_id FROM pg_proc WHERE proname = 'register_for_internal_tournament';
