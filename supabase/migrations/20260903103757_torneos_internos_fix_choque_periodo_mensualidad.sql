-- =============================================================================
-- 20260903103757_torneos_internos_fix_choque_periodo_mensualidad.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260902174423
-- Objetivo: bug real encontrado probando la Fase 5 (prueba de punta a punta,
-- no teórica) de docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md.
--
-- register_for_internal_tournament() inserta un `payments` pendiente para la
-- inscripción del torneo. `fn_payments_fill_period()` (trigger BEFORE INSERT
-- ya existente) rellena period_year/period_month desde due_date siempre que
-- vengan NULL — no hay forma de pedirle "dejalo sin período". El índice único
-- parcial `uniq_payment_active_period_per_child (child_id, period_year,
-- period_month) WHERE status IN (...)` entonces choca con la mensualidad que
-- YA existe para ese mismo niño en el mismo mes — que es el caso NORMAL para
-- cualquier atleta con matrícula activa, no un edge case. Reproducido en vivo:
-- segunda inscripción de dos hermanos con mensualidad activa → 23505
-- duplicate key en 'Escuela Demo SportMaps'.
--
-- El mismo problema late (sin disparar todavía) en chargeRegistrationFeeIfApplicable
-- (bff/src/routes/students-create-one.route.ts:381-382, matrícula) — hoy no se
-- ve porque el 100% de los planes tienen registration_fee en NULL/0 (nadie lo
-- activó nunca). Este fix lo cubre a él también, por si se activa después.
--
-- Solución quirúrgica: NO se toca el trigger compartido (usado por todos los
-- flujos de pago de la plataforma) ni se cambia el comportamiento por defecto
-- de nadie. Se agrega una columna opt-in que solo prende quien sepa que su
-- cobro es un adicional de una sola vez, no una mensualidad.
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

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS period_uniqueness_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payments.period_uniqueness_exempt IS
    'true = este cobro NO compite por el cupo único (child_id, period_year, period_month) de uniq_payment_active_period_per_child — para cargos adicionales de una sola vez (torneo, matrícula) que coexisten con la mensualidad del mismo mes. Default false: no cambia nada del comportamiento existente.';

-- Recrear el índice único con la excepción — 4073 filas hoy, instantáneo.
DROP INDEX IF EXISTS public.uniq_payment_active_period_per_child;
CREATE UNIQUE INDEX uniq_payment_active_period_per_child
    ON public.payments (child_id, period_year, period_month)
    WHERE (
        child_id IS NOT NULL
        AND period_year IS NOT NULL
        AND period_month IS NOT NULL
        AND status = ANY (ARRAY['pending','awaiting_approval','paid','partial','overdue','glosado'])
        AND NOT period_uniqueness_exempt
    );

-- register_for_internal_tournament(): marca su propio cobro como exento.
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

    SELECT price_solo INTO v_amount
      FROM public.event_price_phases
     WHERE event_id = p_event_id AND valid_until >= CURRENT_DATE
     ORDER BY valid_until ASC
     LIMIT 1;

    IF v_amount IS NULL THEN
        RAISE EXCEPTION 'No hay una tarifa vigente configurada para este torneo todavía.';
    END IF;

    -- period_uniqueness_exempt=true: FIX 2026-09-03 — este cobro es un
    -- adicional de una sola vez, no compite con la mensualidad del mismo mes.
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

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT indexdef FROM pg_indexes WHERE indexname = 'uniq_payment_active_period_per_child';
SELECT prosrc ILIKE '%period_uniqueness_exempt%' AS rpc_actualizada FROM pg_proc WHERE proname = 'register_for_internal_tournament';
