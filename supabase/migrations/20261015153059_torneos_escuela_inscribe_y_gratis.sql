-- =============================================================================
-- 20261015153059_torneos_escuela_inscribe_y_gratis.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014215112
-- Objetivo: torneos internos — (1) torneo gratis (events.is_paid) y (2) la
--   escuela inscribe a un atleta directamente.
--   Spec: docs/specs/torneos-inscripcion-escuela-y-pago-2026-10-15.md
--
--   1. events.is_paid (default true: los torneos existentes siguen cobrando).
--   2. register_for_internal_tournament: si el torneo es gratis NO crea
--      `payments` (un cobro de $0 choca con payments_amount_positive) y la
--      inscripción queda aprobada con payment_status = 'not_required'.
--   3. school_register_athlete_for_tournament: la escuela (administración, sin
--      coaches: user_admin_school_ids) inscribe a un hijo de su escuela. Queda
--      APROBADA; si el torneo es pago, crea el cobro al acudiente (pagador).
--      Permite inscribir con el torneo cerrado (decisión D5).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

-- ── 1. Torneo pago o gratis ──────────────────────────────────────────────────
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.is_paid IS
    'false = torneo gratis: la inscripción no genera cobro y queda aprobada (payment_status not_required). true (default) = cobra la tarifa de la fase de precio vigente.';

-- ── 2. Inscripción del padre/atleta: respeta el torneo gratis ────────────────
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
    SELECT id, school_id, title, tournament_scope, status, registrations_open, is_paid
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
        IF NOT EXISTS (
            SELECT 1 FROM public.school_members
             WHERE profile_id = auth.uid() AND school_id = v_event.school_id
               AND role = 'athlete' AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'No perteneces a la escuela dueña de este torneo.';
        END IF;
        v_participant_name := v_caller_name;
    END IF;

    SELECT id, payment_id INTO v_registration_id, v_payment_id
      FROM public.event_registrations
     WHERE event_id = p_event_id AND category_id = p_category_id
       AND COALESCE(child_id, user_id) = COALESCE(p_child_id, auth.uid())
       AND status <> 'cancelled';

    IF v_registration_id IS NOT NULL THEN
        RETURN v_registration_id;
    END IF;

    -- Torneo GRATIS: sin cobro, inscripción aprobada de una vez.
    IF v_event.is_paid IS FALSE THEN
        INSERT INTO public.event_registrations (
            event_id, user_id, child_id, category_id, participant_name,
            participant_email, participant_phone, participant_role,
            status, payment_status, school_id, payment_id
        ) VALUES (
            p_event_id, auth.uid(), p_child_id, p_category_id, v_participant_name,
            v_caller_email, COALESCE(v_caller_phone, ''),
            CASE WHEN p_child_id IS NULL THEN 'athlete' ELSE 'parent' END,
            'approved', 'not_required', v_event.school_id, NULL
        ) RETURNING id INTO v_registration_id;

        RETURN v_registration_id;
    END IF;

    SELECT price_solo INTO v_amount
      FROM public.event_price_phases
     WHERE event_id = p_event_id AND valid_until >= CURRENT_DATE
     ORDER BY valid_until ASC
     LIMIT 1;

    IF v_amount IS NULL THEN
        RAISE EXCEPTION 'No hay una tarifa vigente configurada para este torneo todavía.';
    END IF;

    -- period_uniqueness_exempt=true: este cobro es un adicional de una sola vez,
    -- no compite con la mensualidad del mismo mes (fix 2026-09-03).
    INSERT INTO public.payments (
        school_id, user_id, child_id, parent_id, amount, status, payment_type, concept, due_date,
        period_uniqueness_exempt
    ) VALUES (
        v_event.school_id,
        CASE WHEN p_child_id IS NULL THEN auth.uid() ELSE NULL END,
        p_child_id,
        CASE WHEN p_child_id IS NOT NULL THEN auth.uid() ELSE NULL END,
        v_amount,
        'pending',
        'one_time',
        'Inscripción torneo — ' || v_event.title || ' — ' || (SELECT category FROM public.event_categories_config WHERE id = p_category_id),
        public.qr_first_charge_due_date(v_event.school_id, CURRENT_DATE),
        true
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

REVOKE ALL ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_for_internal_tournament(uuid, uuid, uuid) TO authenticated;

-- ── 3. La escuela inscribe a un atleta ───────────────────────────────────────
-- Devuelve jsonb: { registration_id, already_registered, parent_id, payment_id,
-- amount, is_paid }. El BFF usa parent_id para avisarle a la familia.
CREATE OR REPLACE FUNCTION public.school_register_athlete_for_tournament(
    p_event_id    uuid,
    p_category_id uuid,
    p_child_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_event          record;
    v_child          record;
    v_category_name  text;
    v_parent_email   text;
    v_parent_phone   text;
    v_existing       uuid;
    v_payment_id     uuid;
    v_registration_id uuid;
    v_amount         numeric;
BEGIN
    SELECT id, school_id, title, tournament_scope, status, is_paid
      INTO v_event
      FROM public.events
     WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Torneo no encontrado.';
    END IF;

    -- Administración de ESA escuela (owner/admin; sin coaches, padres ni atletas).
    IF v_event.school_id IS NULL OR NOT (v_event.school_id = ANY (public.user_admin_school_ids())) THEN
        RAISE EXCEPTION 'No autorizado: este torneo no es de tu escuela.' USING ERRCODE = '42501';
    END IF;

    IF v_event.tournament_scope <> 'internal' THEN
        RAISE EXCEPTION 'Esta inscripción es solo para torneos/ligas internas de una escuela.';
    END IF;

    -- D5: se puede inscribir con el plazo cerrado, pero el torneo debe estar publicado.
    IF v_event.status NOT IN ('active', 'closed') THEN
        RAISE EXCEPTION 'El torneo todavía no está publicado.';
    END IF;

    SELECT category INTO v_category_name
      FROM public.event_categories_config
     WHERE id = p_category_id AND event_id = p_event_id AND active = true;

    IF v_category_name IS NULL THEN
        RAISE EXCEPTION 'Categoría no válida para este torneo.';
    END IF;

    SELECT id, full_name, parent_id, school_id, is_active
      INTO v_child
      FROM public.children
     WHERE id = p_child_id;

    IF v_child.id IS NULL OR v_child.school_id IS DISTINCT FROM v_event.school_id THEN
        RAISE EXCEPTION 'Ese atleta no pertenece a esta escuela.';
    END IF;

    IF v_child.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'El atleta está inactivo.';
    END IF;

    -- Ya inscrito (misma regla del índice único uniq_event_registration_activa).
    SELECT id INTO v_existing
      FROM public.event_registrations
     WHERE event_id = p_event_id AND category_id = p_category_id
       AND COALESCE(child_id, user_id) = p_child_id
       AND status <> 'cancelled';

    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object(
            'registration_id', v_existing, 'already_registered', true,
            'parent_id', v_child.parent_id, 'is_paid', v_event.is_paid
        );
    END IF;

    IF v_child.parent_id IS NOT NULL THEN
        SELECT LOWER(TRIM(u.email)) INTO v_parent_email FROM auth.users u WHERE u.id = v_child.parent_id;
        SELECT phone INTO v_parent_phone FROM public.profiles WHERE id = v_child.parent_id;
    END IF;

    IF v_event.is_paid IS NOT FALSE THEN
        -- Torneo pago: el cobro va al pagador del atleta. Sin pagador no se
        -- inscribe (un cobro sin parent_id queda sin dueño y el padre no lo ve).
        IF v_child.parent_id IS NULL THEN
            RAISE EXCEPTION 'El atleta no tiene un acudiente (pagador) asignado: asígnalo antes de inscribirlo a un torneo con cobro.';
        END IF;

        SELECT price_solo INTO v_amount
          FROM public.event_price_phases
         WHERE event_id = p_event_id AND valid_until >= CURRENT_DATE
         ORDER BY valid_until ASC
         LIMIT 1;

        IF v_amount IS NULL THEN
            RAISE EXCEPTION 'No hay una tarifa vigente configurada para este torneo todavía.';
        END IF;
        IF v_amount <= 0 THEN
            RAISE EXCEPTION 'La tarifa vigente debe ser mayor que cero. Si el torneo es gratis, márcalo como gratis.';
        END IF;

        INSERT INTO public.payments (
            school_id, user_id, child_id, parent_id, amount, status, payment_type, concept, due_date,
            period_uniqueness_exempt
        ) VALUES (
            v_event.school_id, NULL, p_child_id, v_child.parent_id, v_amount,
            'pending', 'one_time',
            'Inscripción torneo — ' || v_event.title || ' — ' || v_category_name,
            public.qr_first_charge_due_date(v_event.school_id, CURRENT_DATE),
            true
        ) RETURNING id INTO v_payment_id;
    END IF;

    -- D1: la inscripción de la escuela queda APROBADA.
    INSERT INTO public.event_registrations (
        event_id, user_id, child_id, category_id, participant_name,
        participant_email, participant_phone, participant_role,
        status, payment_status, school_id, payment_id
    ) VALUES (
        p_event_id, v_child.parent_id, p_child_id, p_category_id, v_child.full_name,
        v_parent_email, COALESCE(v_parent_phone, ''),
        'parent',
        'approved',
        CASE WHEN v_event.is_paid IS FALSE THEN 'not_required' ELSE 'pending' END,
        v_event.school_id, v_payment_id
    ) RETURNING id INTO v_registration_id;

    RETURN jsonb_build_object(
        'registration_id', v_registration_id, 'already_registered', false,
        'parent_id', v_child.parent_id, 'payment_id', v_payment_id,
        'amount', v_amount, 'is_paid', v_event.is_paid
    );
END;
$$;

REVOKE ALL ON FUNCTION public.school_register_athlete_for_tournament(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.school_register_athlete_for_tournament(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.school_register_athlete_for_tournament(uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.school_register_athlete_for_tournament(uuid, uuid, uuid) IS
    'La administración de la escuela inscribe a un hijo en un torneo interno. Queda aprobada; si el torneo es pago crea el cobro al acudiente. Spec: docs/specs/torneos-inscripcion-escuela-y-pago-2026-10-15.md';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación (correr después de aplicar)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT column_name, column_default FROM information_schema.columns
--  WHERE table_name = 'events' AND column_name = 'is_paid';
-- SELECT proname, proacl FROM pg_proc WHERE proname IN
--  ('school_register_athlete_for_tournament', 'register_for_internal_tournament');
