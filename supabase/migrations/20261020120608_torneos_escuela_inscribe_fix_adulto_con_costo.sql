-- =============================================================================
-- 20261020120608_torneos_escuela_inscribe_fix_adulto_con_costo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-20   Versión anterior: 20261020113226
-- Objetivo: corregir school_register_athlete_for_tournament (4 args, mig. 20261020113208):
--   inscribir a un atleta ADULTO en un torneo CON COSTO fallaba con
--   «record "v_child" is not assigned yet», porque el INSERT del cobro leía
--   v_child.parent_id aunque el camino fuera el del adulto (v_child sin asignar).
--   Ahora usa v_payer (acudiente del hijo; NULL en el adulto, que paga con user_id).
-- Detectado en la prueba con rollback del 2026-10-20. Misma firma y mismos GRANT:
--   CREATE OR REPLACE conserva los permisos vivos.
-- =============================================================================

BEGIN;

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

    SELECT id INTO v_existing FROM public.event_registrations
     WHERE event_id = p_event_id AND category_id = p_category_id
       AND COALESCE(child_id, user_id) = COALESCE(p_child_id, p_athlete_user_id) AND status <> 'cancelled';
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('registration_id', v_existing, 'already_registered', true,
                                  'parent_id', v_payer, 'is_paid', v_event.is_paid);
    END IF;

    IF v_event.capacity IS NOT NULL AND v_event.capacity > 0 THEN
        SELECT count(*) INTO v_inscritos FROM public.event_registrations WHERE event_id = p_event_id AND status <> 'cancelled';
        IF v_inscritos >= v_event.capacity THEN
            RAISE EXCEPTION 'El torneo llegó a su cupo (%). Sube el cupo en la pestaña Info para inscribir a más.', v_event.capacity;
        END IF;
    END IF;

    IF v_event.is_paid IS NOT FALSE THEN
        IF v_payer IS NULL THEN RAISE EXCEPTION 'El atleta no tiene un acudiente (pagador) asignado: asígnalo antes de inscribirlo a un torneo con cobro.'; END IF;
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
                CASE WHEN p_child_id IS NOT NULL THEN v_payer ELSE NULL END,
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

COMMIT;
