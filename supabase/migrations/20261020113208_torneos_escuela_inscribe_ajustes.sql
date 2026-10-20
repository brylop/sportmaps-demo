-- =============================================================================
-- 20261020113208_torneos_escuela_inscribe_ajustes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-20   Versión anterior: 20261020111530
-- Objetivo: ajustes a «Inscribir atleta» (torneos internos) tras la prueba del 10-20.
--   1. La ESCUELA puede inscribir aunque la tarifa ya haya vencido (usa la última
--      fase de precio): antes fallaba con «No hay una tarifa vigente» justo cuando
--      la decisión de producto es poder inscribir con el plazo cerrado.
--   2. Cupo del torneo (events.capacity): la RPC de la escuela y la de la familia lo
--      respetan. Repetir una inscripción ya hecha no cuenta contra el cupo.
--   3. El cobro de la inscripción nace con payment_category = 'torneo' (antes NULL,
--      y quedaba fuera de los cálculos de ingreso por categoría).
--   4. La escuela puede inscribir también atletas ADULTOS (school_members), no solo
--      hijos: nuevo parámetro p_athlete_user_id. El adulto es su propio pagador.
-- No toca filas existentes (los 2 cobros viejos sin categoría son de QA/demo).
-- =============================================================================

BEGIN;

-- ── 1+2+3+4 · RPC de la escuela ──────────────────────────────────────────────
-- Cambia la firma (un parámetro nuevo con default): se retira la anterior.
DROP FUNCTION IF EXISTS public.school_register_athlete_for_tournament(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.school_register_athlete_for_tournament(
    p_event_id uuid,
    p_category_id uuid,
    p_child_id uuid DEFAULT NULL,
    p_athlete_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_event record; v_child record; v_category_name text;
    v_payer uuid; v_name text; v_email text; v_phone text; v_part_user uuid;
    v_existing uuid; v_payment_id uuid; v_registration_id uuid; v_amount numeric; v_inscritos integer;
BEGIN
    SELECT id, school_id, title, tournament_scope, status, is_paid, capacity
      INTO v_event FROM public.events WHERE id = p_event_id;
    IF v_event.id IS NULL THEN RAISE EXCEPTION 'Torneo no encontrado.'; END IF;
    IF v_event.school_id IS NULL OR NOT (v_event.school_id = ANY (public.user_admin_school_ids())) THEN
        RAISE EXCEPTION 'No autorizado: este torneo no es de tu escuela.' USING ERRCODE = '42501';
    END IF;
    IF v_event.tournament_scope <> 'internal' THEN RAISE EXCEPTION 'Esta inscripción es solo para torneos/ligas internas de una escuela.'; END IF;
    IF v_event.status NOT IN ('active', 'closed') THEN RAISE EXCEPTION 'El torneo todavía no está publicado.'; END IF;
    IF (p_child_id IS NULL) = (p_athlete_user_id IS NULL) THEN
        RAISE EXCEPTION 'Indica un deportista: un hijo o un atleta adulto.';
    END IF;

    SELECT category INTO v_category_name FROM public.event_categories_config
     WHERE id = p_category_id AND event_id = p_event_id AND active = true;
    IF v_category_name IS NULL THEN RAISE EXCEPTION 'Categoría no válida para este torneo.'; END IF;

    IF p_child_id IS NOT NULL THEN
        SELECT id, full_name, parent_id, school_id, is_active INTO v_child FROM public.children WHERE id = p_child_id;
        IF v_child.id IS NULL OR v_child.school_id IS DISTINCT FROM v_event.school_id THEN RAISE EXCEPTION 'Ese atleta no pertenece a esta escuela.'; END IF;
        IF v_child.is_active IS NOT TRUE THEN RAISE EXCEPTION 'El atleta está inactivo.'; END IF;
        v_payer := v_child.parent_id; v_name := v_child.full_name; v_part_user := v_child.parent_id;
        IF v_child.parent_id IS NOT NULL THEN
            SELECT LOWER(TRIM(u.email)) INTO v_email FROM auth.users u WHERE u.id = v_child.parent_id;
            SELECT phone INTO v_phone FROM public.profiles WHERE id = v_child.parent_id;
        END IF;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM public.school_members
                        WHERE profile_id = p_athlete_user_id AND school_id = v_event.school_id
                          AND role = 'athlete' AND status = 'active') THEN
            RAISE EXCEPTION 'Ese atleta no pertenece a esta escuela o está inactivo.';
        END IF;
        SELECT full_name, phone INTO v_name, v_phone FROM public.profiles WHERE id = p_athlete_user_id;
        SELECT LOWER(TRIM(u.email)) INTO v_email FROM auth.users u WHERE u.id = p_athlete_user_id;
        v_payer := p_athlete_user_id; v_part_user := p_athlete_user_id;
    END IF;

    -- Ya inscrito: se devuelve tal cual (no cuenta contra el cupo ni avisa de nuevo).
    SELECT id INTO v_existing FROM public.event_registrations
     WHERE event_id = p_event_id AND category_id = p_category_id
       AND COALESCE(child_id, user_id) = COALESCE(p_child_id, p_athlete_user_id) AND status <> 'cancelled';
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('registration_id', v_existing, 'already_registered', true,
                                  'parent_id', v_payer, 'is_paid', v_event.is_paid);
    END IF;

    -- Cupo: todas las inscripciones vivas del torneo (cualquier categoría).
    IF v_event.capacity IS NOT NULL AND v_event.capacity > 0 THEN
        SELECT count(*) INTO v_inscritos FROM public.event_registrations WHERE event_id = p_event_id AND status <> 'cancelled';
        IF v_inscritos >= v_event.capacity THEN
            RAISE EXCEPTION 'El torneo llegó a su cupo (%). Sube el cupo en la pestaña Info para inscribir a más.', v_event.capacity;
        END IF;
    END IF;

    IF v_event.is_paid IS NOT FALSE THEN
        IF v_payer IS NULL THEN RAISE EXCEPTION 'El atleta no tiene un acudiente (pagador) asignado: asígnalo antes de inscribirlo a un torneo con cobro.'; END IF;
        -- Tarifa vigente; si ya venció, la escuela inscribe con la última fase configurada.
        SELECT price_solo INTO v_amount FROM public.event_price_phases
         WHERE event_id = p_event_id AND valid_until >= CURRENT_DATE ORDER BY valid_until ASC LIMIT 1;
        IF v_amount IS NULL THEN
            SELECT price_solo INTO v_amount FROM public.event_price_phases
             WHERE event_id = p_event_id ORDER BY valid_until DESC LIMIT 1;
        END IF;
        IF v_amount IS NULL THEN RAISE EXCEPTION 'No hay una tarifa configurada para este torneo todavía.'; END IF;
        IF v_amount <= 0 THEN RAISE EXCEPTION 'La tarifa debe ser mayor que cero. Si el torneo es gratis, márcalo como gratis.'; END IF;
        INSERT INTO public.payments (school_id, user_id, child_id, parent_id, amount, status, payment_type, payment_category, concept, due_date, period_uniqueness_exempt)
        VALUES (v_event.school_id,
                CASE WHEN p_child_id IS NULL THEN p_athlete_user_id ELSE NULL END,
                p_child_id,
                CASE WHEN p_child_id IS NOT NULL THEN v_child.parent_id ELSE NULL END,
                v_amount, 'pending', 'one_time', 'torneo',
                'Inscripción torneo — ' || v_event.title || ' — ' || v_category_name,
                public.qr_first_charge_due_date(v_event.school_id, CURRENT_DATE), true)
        RETURNING id INTO v_payment_id;
    END IF;

    INSERT INTO public.event_registrations (event_id, user_id, child_id, category_id, participant_name, participant_email, participant_phone, participant_role, status, payment_status, school_id, payment_id)
    VALUES (p_event_id, v_part_user, p_child_id, p_category_id, v_name, v_email, COALESCE(v_phone, ''),
            CASE WHEN p_child_id IS NULL THEN 'athlete' ELSE 'parent' END,
            'approved', CASE WHEN v_event.is_paid IS FALSE THEN 'not_required' ELSE 'pending' END,
            v_event.school_id, v_payment_id)
    RETURNING id INTO v_registration_id;

    RETURN jsonb_build_object('registration_id', v_registration_id, 'already_registered', false,
                              'parent_id', v_payer, 'payment_id', v_payment_id, 'amount', v_amount,
                              'is_paid', v_event.is_paid, 'is_adult', p_child_id IS NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.school_register_athlete_for_tournament(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.school_register_athlete_for_tournament(uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.school_register_athlete_for_tournament(uuid, uuid, uuid, uuid) TO authenticated;

-- ── 2+3 · RPC de la familia: cupo y categoría del cobro ──────────────────────
-- Idéntica a la vigente salvo: lee capacity, valida el cupo (después del «ya inscrito»)
-- y estampa payment_category = 'torneo'.
CREATE OR REPLACE FUNCTION public.register_for_internal_tournament(
    p_event_id uuid, p_category_id uuid, p_child_id uuid DEFAULT NULL::uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE v_event record; v_category record; v_caller_role public.user_role; v_caller_email text; v_caller_phone text; v_caller_name text; v_participant_name text; v_registration_id uuid; v_payment_id uuid; v_amount numeric; v_inscritos integer;
BEGIN
    SELECT id, school_id, title, tournament_scope, status, registrations_open, is_paid, capacity INTO v_event FROM public.events WHERE id = p_event_id;
    IF v_event.id IS NULL THEN RAISE EXCEPTION 'Torneo no encontrado.'; END IF;
    IF v_event.tournament_scope <> 'internal' THEN RAISE EXCEPTION 'Esta inscripción es solo para torneos/ligas internas de una escuela.'; END IF;
    IF v_event.status <> 'active' OR v_event.registrations_open IS FALSE THEN RAISE EXCEPTION 'Las inscripciones no están abiertas.'; END IF;
    SELECT id, event_id INTO v_category FROM public.event_categories_config WHERE id = p_category_id AND event_id = p_event_id AND active = true;
    IF v_category.id IS NULL THEN RAISE EXCEPTION 'Categoría no válida para este torneo.'; END IF;
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    SELECT LOWER(TRIM(email)) INTO v_caller_email FROM auth.users WHERE id = auth.uid();
    SELECT full_name, phone INTO v_caller_name, v_caller_phone FROM public.profiles WHERE id = auth.uid();
    IF p_child_id IS NOT NULL THEN
        SELECT full_name INTO v_participant_name FROM public.children WHERE id = p_child_id AND parent_id = auth.uid() AND school_id = v_event.school_id;
        IF v_participant_name IS NULL THEN RAISE EXCEPTION 'Ese atleta no es un hijo tuyo inscrito en esta escuela.'; END IF;
    ELSE
        IF v_caller_role <> 'athlete' THEN RAISE EXCEPTION 'Solo un atleta adulto puede inscribirse a sí mismo (sin indicar un hijo).'; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.school_members WHERE profile_id = auth.uid() AND school_id = v_event.school_id AND role = 'athlete' AND status = 'active') THEN RAISE EXCEPTION 'No perteneces a la escuela dueña de este torneo.'; END IF;
        v_participant_name := v_caller_name;
    END IF;
    SELECT id, payment_id INTO v_registration_id, v_payment_id FROM public.event_registrations WHERE event_id = p_event_id AND category_id = p_category_id AND COALESCE(child_id, user_id) = COALESCE(p_child_id, auth.uid()) AND status <> 'cancelled';
    IF v_registration_id IS NOT NULL THEN RETURN v_registration_id; END IF;
    IF v_event.capacity IS NOT NULL AND v_event.capacity > 0 THEN
        SELECT count(*) INTO v_inscritos FROM public.event_registrations WHERE event_id = p_event_id AND status <> 'cancelled';
        IF v_inscritos >= v_event.capacity THEN RAISE EXCEPTION 'El torneo ya llegó a su cupo.'; END IF;
    END IF;
    IF v_event.is_paid IS FALSE THEN
        INSERT INTO public.event_registrations (event_id, user_id, child_id, category_id, participant_name, participant_email, participant_phone, participant_role, status, payment_status, school_id, payment_id)
        VALUES (p_event_id, auth.uid(), p_child_id, p_category_id, v_participant_name, v_caller_email, COALESCE(v_caller_phone, ''), CASE WHEN p_child_id IS NULL THEN 'athlete' ELSE 'parent' END, 'approved', 'not_required', v_event.school_id, NULL) RETURNING id INTO v_registration_id;
        RETURN v_registration_id;
    END IF;
    SELECT price_solo INTO v_amount FROM public.event_price_phases WHERE event_id = p_event_id AND valid_until >= CURRENT_DATE ORDER BY valid_until ASC LIMIT 1;
    IF v_amount IS NULL THEN RAISE EXCEPTION 'No hay una tarifa vigente configurada para este torneo todavía.'; END IF;
    INSERT INTO public.payments (school_id, user_id, child_id, parent_id, amount, status, payment_type, payment_category, concept, due_date, period_uniqueness_exempt)
    VALUES (v_event.school_id, CASE WHEN p_child_id IS NULL THEN auth.uid() ELSE NULL END, p_child_id, CASE WHEN p_child_id IS NOT NULL THEN auth.uid() ELSE NULL END, v_amount, 'pending', 'one_time', 'torneo', 'Inscripción torneo — ' || v_event.title || ' — ' || (SELECT category FROM public.event_categories_config WHERE id = p_category_id), public.qr_first_charge_due_date(v_event.school_id, CURRENT_DATE), true) RETURNING id INTO v_payment_id;
    INSERT INTO public.event_registrations (event_id, user_id, child_id, category_id, participant_name, participant_email, participant_phone, participant_role, status, payment_status, school_id, payment_id)
    VALUES (p_event_id, auth.uid(), p_child_id, p_category_id, v_participant_name, v_caller_email, COALESCE(v_caller_phone, ''), CASE WHEN p_child_id IS NULL THEN 'athlete' ELSE 'parent' END, 'pending', 'pending', v_event.school_id, v_payment_id) RETURNING id INTO v_registration_id;
    RETURN v_registration_id;
END; $function$;

COMMIT;
