-- =============================================================================
-- 20260902174423_fix_bloqueador_b_trigger_insert_y_qr_offering_plan_id.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902172435
-- Objetivo: Fase 1 de docs/specs/vigencia-cobranza-y-sesiones-unificado.md §3.2
-- ("Bloqueador B") — decisión D5 confirmada con el usuario 2026-09-02: arreglar
-- las 3 rutas de cobro en vez de aflojar el matching del trigger.
--
-- El trigger fn_extend_enrollment_on_payment_paid() exige NEW.offering_plan_id
-- IS NOT NULL. Ninguna de las 3 rutas lo setea:
--   1. QR (generate_qr_monthly_charge) — inserta 'pending', luego otra ruta
--      hace el UPDATE a 'paid'. Alcanza con setearlo en el INSERT: se arregla
--      acá.
--   2. Registro manual en efectivo (RegisterCashPaymentModal.tsx) — inserta
--      DIRECTO como 'paid' cuando no hay cobro pendiente. Se arregla en el
--      frontend en un commit aparte.
--   3. Autopay (recurring-charges.service.ts) — también inserta DIRECTO como
--      'paid'. Se arregla en el BFF en un commit aparte.
--
-- Para 2 y 3, setear offering_plan_id NO ALCANZA: el trigger es hoy
-- AFTER UPDATE únicamente, y un INSERT directo como 'paid' nunca dispara un
-- UPDATE — no hay evento que lo active. Por eso esta migración también cambia
-- el trigger a AFTER INSERT OR UPDATE (único cambio a la lógica del trigger;
-- el matching por offering_plan_id/identidad del atleta queda IGUAL que hoy).
--
-- Verificado antes de escribir esto: TODA inscripción activa con expires_at
-- también tiene offering_plan_id (0 excepciones en 1243 activas) — los
-- enrollments solo-de-equipo (448) no participan de vigencia. Así que el
-- lookup de offering_plan_id en el QR (por child_id+school, la inscripción
-- activa más reciente) es seguro: si no hay plan, no hay nada que extender.
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

-- 1. Trigger también en INSERT — único cambio a fn_extend_enrollment_on_payment_paid()
--    es el IF de arriba (TG_OP='INSERT' cuenta como "recién pagado", igual que
--    OLD.status IS DISTINCT FROM 'paid' en un UPDATE). El resto del cuerpo
--    (matching por offering_plan_id + identidad del atleta, cálculo de
--    duración, UPDATE de enrollments) queda sin tocar.
CREATE OR REPLACE FUNCTION public.fn_extend_enrollment_on_payment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_enrollment record;
    v_duration   integer;
BEGIN
    IF NEW.status = 'paid'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
       AND NEW.offering_plan_id IS NOT NULL THEN

        SELECT e.id, e.expires_at, e.status
        INTO v_enrollment
        FROM public.enrollments e
        WHERE e.school_id = NEW.school_id
          AND e.offering_plan_id = NEW.offering_plan_id
          AND e.status IN ('active', 'cancelled')
          AND (
                (NEW.child_id IS NOT NULL AND e.child_id = NEW.child_id)
                OR
                (NEW.unregistered_athlete_id IS NOT NULL
                 AND e.unregistered_athlete_id = NEW.unregistered_athlete_id)
                OR
                (NEW.child_id IS NULL AND NEW.unregistered_athlete_id IS NULL
                 AND e.child_id IS NULL AND e.unregistered_athlete_id IS NULL
                 AND e.user_id IN (NEW.user_id, NEW.parent_id))
              )
        ORDER BY (e.status = 'active') DESC, e.created_at DESC
        LIMIT 1;

        IF FOUND THEN
            SELECT duration_days INTO v_duration
            FROM public.offering_plans
            WHERE id = NEW.offering_plan_id;

            UPDATE public.enrollments
            SET status      = 'active',
                expires_at  = GREATEST(COALESCE(v_enrollment.expires_at, CURRENT_DATE), CURRENT_DATE)
                               + COALESCE(v_duration, 30),
                updated_at  = now()
            WHERE id = v_enrollment.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_extend_enrollment_on_payment_paid() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_extend_enrollment_on_payment_paid() TO service_role;

DROP TRIGGER IF EXISTS trg_extend_enrollment_on_payment_paid ON public.payments;
CREATE TRIGGER trg_extend_enrollment_on_payment_paid
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_extend_enrollment_on_payment_paid();

COMMENT ON FUNCTION public.fn_extend_enrollment_on_payment_paid() IS
    'Extiende enrollments.expires_at cuando un payment con offering_plan_id pasa a paid — por INSERT directo (efectivo-manual, autopay) o por UPDATE pending->paid (QR, checkout). Antes solo disparaba en UPDATE, dejando ciegos los INSERT directos como paid (docs/specs/vigencia-cobranza-y-sesiones-unificado.md §3.2, Bloqueador B, D5 confirmado 2026-09-02).';

-- 2. QR: setea offering_plan_id al crear el cobro, buscándolo en la
--    inscripción activa más reciente del atleta en esa escuela. Mismo
--    signature/return type que la versión original (20260625000004) — no crea
--    overload.
CREATE OR REPLACE FUNCTION public.generate_qr_monthly_charge(p_slug text, p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_qr record; v_school_id uuid; v_school_name text;
    v_child record; v_amount numeric; v_payment_id uuid;
    v_existing uuid; v_existing_amount numeric;
    v_offering_plan_id uuid;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    v_school_id := v_qr.school_id;
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    SELECT * INTO v_child FROM public.children
    WHERE id = p_child_id AND parent_id = v_user_id AND school_id = v_school_id;
    IF v_child.id IS NULL THEN RAISE EXCEPTION 'Hijo no válido para esta escuela' USING ERRCODE='42501'; END IF;

    -- Dedup: si ya existe cobro del mes en curso, devolverlo (prioriza pendiente)
    SELECT id, amount INTO v_existing, v_existing_amount
    FROM public.payments
    WHERE child_id = p_child_id AND school_id = v_school_id
      AND due_date >= date_trunc('month', CURRENT_DATE)
      AND due_date <  date_trunc('month', CURRENT_DATE) + interval '1 month'
    ORDER BY (status = 'pending') DESC, created_at DESC
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'payment_id', v_existing, 'amount', v_existing_amount, 'reused', true);
    END IF;

    v_amount := COALESCE(
        NULLIF(v_qr.fixed_amount, 0),
        NULLIF(v_child.monthly_fee, 0),
        (SELECT NULLIF(price_monthly, 0) FROM public.teams WHERE id = v_child.team_id AND school_id = v_school_id),
        0);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'No hay cuota configurada para este atleta' USING ERRCODE='22023'; END IF;

    -- Bloqueador B: sin esto, trg_extend_enrollment_on_payment_paid nunca
    -- extiende expires_at cuando este cobro pase a paid. NULL si el atleta
    -- está en un enrollment solo-de-equipo (sin plan, sin vigencia) — no hay
    -- nada que extender en ese caso, y el trigger ya lo maneja como no-op.
    SELECT e.offering_plan_id INTO v_offering_plan_id
    FROM public.enrollments e
    WHERE e.school_id = v_school_id
      AND e.child_id = p_child_id
      AND e.status = 'active'
    ORDER BY e.created_at DESC
    LIMIT 1;

    INSERT INTO public.payments (school_id, branch_id, parent_id, child_id, team_id, offering_plan_id, concept, amount, due_date, status, payment_type, qr_id)
    VALUES (v_school_id, v_child.branch_id, v_user_id, p_child_id, v_child.team_id, v_offering_plan_id,
            'Mensualidad ' || to_char(CURRENT_DATE, 'MM/YYYY') || ' - ' || v_child.full_name || ' (' || v_school_name || ')',
            v_amount, CURRENT_DATE, 'pending', 'one_time', v_qr.id)
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'amount', v_amount, 'reused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_qr_monthly_charge(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_qr_monthly_charge(text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.generate_qr_monthly_charge(text, uuid) IS
    'Crea (o reutiliza) el cobro mensual del atleta vía QR de inscripción. Setea offering_plan_id desde la inscripción activa del atleta (fix Bloqueador B, D5 2026-09-02) para que trg_extend_enrollment_on_payment_paid pueda extender expires_at cuando el cobro pase a paid.';

COMMIT;
