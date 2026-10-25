-- =============================================================================
-- 20261024211844_plan_por_asistencia_aplicar_cambio_plan.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261024211841
-- Objetivo: RPC aplicar_cambio_plan: cambia el plan de UNA inscripción en una
--   sola transacción y deja la fila de log. Solo service_role (BFF).
-- Depende de: 20261024211841 (enrollment_plan_changes).
--
-- DECISIONES (conservadoras):
--   * Beca/cuota manual (enrollments.fee_is_manual) NO se toca.
--   * p_year/p_month = el periodo AL QUE APLICA el plan nuevo (el próximo a
--     cobrar). Se guarda tal cual en el log.
--   * NO se modifica ningún cobro (payments). payments tiene ~24 triggers de
--     monto/descuentos/pronto pago/saldo a favor que no se auditaron para este
--     caso; reescribir un monto ahí puede chocar con ellos. El cambio de
--     enrollments.monthly_fee ya hace que los cobros FUTUROS salgan al precio
--     nuevo. La RPC solo INFORMA el cobro abierto (pending/overdue) de ese
--     periodo (cobro_abierto_id / cobro_abierto_estado) para que el BFF o la
--     escuela decidan; nunca toca uno pagado, con abono o con comprobante.
--   * El plan destino debe ser del mismo programa (offering) de la inscripción:
--     trg_sync_enrollment_offering_id copia offering_id desde el plan.
-- Radio: 1 fila de enrollments (FOR UPDATE) + 1 INSERT en el log por llamada.
--   Dispara en enrollments: trg_sync_enrollment_offering_id,
--   trg_sync_enrollments_team, trg_sync_program_participants_on_enrollments,
--   trg_updated_at. No toca status, así que no dispara los de cancelación.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.aplicar_cambio_plan(
    p_enrollment_id uuid,
    p_to_plan_id    uuid,
    p_source        text,
    p_clases        integer,
    p_year          integer,
    p_month         integer,
    p_debt          numeric DEFAULT 0,
    p_amount_paid   numeric DEFAULT NULL,
    p_queue_id      uuid    DEFAULT NULL,
    p_changed_by    text    DEFAULT 'auto',
    p_razon         text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_enr        public.enrollments%ROWTYPE;
    v_to         public.offering_plans%ROWTYPE;
    v_from_amt   numeric;
    v_dir        text;
    v_change_id  uuid;
    v_cobro_id   uuid;
    v_cobro_est  text;
BEGIN
    IF p_source IS NULL OR p_source NOT IN ('attendance', 'manual', 'api') THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'source_invalido');
    END IF;
    IF p_year IS NULL OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'periodo_invalido');
    END IF;

    SELECT * INTO v_enr
      FROM public.enrollments
     WHERE id = p_enrollment_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'inscripcion_inexistente');
    END IF;
    IF v_enr.status IS DISTINCT FROM 'active' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'inscripcion_no_activa');
    END IF;
    IF v_enr.school_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'inscripcion_sin_escuela');
    END IF;
    IF v_enr.fee_is_manual THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'cuota_manual');
    END IF;

    SELECT * INTO v_to FROM public.offering_plans WHERE id = p_to_plan_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'plan_destino_inexistente');
    END IF;
    IF v_to.school_id IS DISTINCT FROM v_enr.school_id THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'plan_de_otra_escuela');
    END IF;
    IF NOT v_to.is_active THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'plan_destino_inactivo');
    END IF;
    IF v_enr.offering_plan_id IS NOT DISTINCT FROM v_to.id THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'plan_destino_igual_al_actual');
    END IF;
    IF v_enr.offering_id IS NOT NULL AND v_enr.offering_id IS DISTINCT FROM v_to.offering_id THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'plan_de_otro_programa');
    END IF;
    IF v_to.price IS NULL OR v_to.price <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'plan_destino_sin_precio');
    END IF;

    -- Precio de partida: la cuota efectiva de la inscripción; si no hay, el
    -- precio del plan actual.
    v_from_amt := v_enr.monthly_fee;
    IF v_from_amt IS NULL AND v_enr.offering_plan_id IS NOT NULL THEN
        SELECT op.price INTO v_from_amt
          FROM public.offering_plans op
         WHERE op.id = v_enr.offering_plan_id;
    END IF;

    v_dir := CASE
        WHEN coalesce(v_from_amt, 0) < v_to.price THEN 'up'
        WHEN coalesce(v_from_amt, 0) > v_to.price THEN 'down'
        ELSE 'same_price'
    END;

    UPDATE public.enrollments
       SET offering_plan_id = v_to.id,
           monthly_fee      = v_to.price,
           updated_at       = now()
     WHERE id = v_enr.id;

    -- Solo informativo (ver cabecera): cobro abierto del periodo, sin tocarlo.
    -- array_agg en vez de min(uuid): min(uuid) no existe.
    SELECT (array_agg(p.id     ORDER BY p.created_at DESC))[1],
           (array_agg(p.status ORDER BY p.created_at DESC))[1]
      INTO v_cobro_id, v_cobro_est
      FROM public.payments p
     WHERE p.school_id    = v_enr.school_id
       AND p.period_year  = p_year
       AND p.period_month = p_month
       AND p.status IN ('pending', 'overdue')
       AND (   (v_enr.child_id IS NOT NULL AND p.child_id = v_enr.child_id)
            OR (v_enr.unregistered_athlete_id IS NOT NULL
                AND p.unregistered_athlete_id = v_enr.unregistered_athlete_id));

    INSERT INTO public.enrollment_plan_changes (
        school_id, enrollment_id, child_id, unregistered_athlete_id,
        from_plan_id, to_plan_id, from_amount, to_amount,
        clases_mes, amount_paid, period_year, period_month, debt_at_change,
        direction, source, mode, applied, queue_id, payment_id, changed_by, razon
    ) VALUES (
        v_enr.school_id, v_enr.id, v_enr.child_id, v_enr.unregistered_athlete_id,
        v_enr.offering_plan_id, v_to.id, v_from_amt, v_to.price,
        p_clases, p_amount_paid, p_year, p_month, coalesce(p_debt, 0),
        v_dir, p_source, 'auto', true, p_queue_id, NULL,
        coalesce(nullif(btrim(p_changed_by), ''), 'auto'), p_razon
    )
    RETURNING id INTO v_change_id;

    RETURN jsonb_build_object(
        'ok',                   true,
        'change_id',            v_change_id,
        'from_plan_id',         v_enr.offering_plan_id,
        'to_plan_id',           v_to.id,
        'from_amount',          v_from_amt,
        'to_amount',            v_to.price,
        'direction',            v_dir,
        'cobro_abierto_id',     v_cobro_id,
        'cobro_abierto_estado', v_cobro_est
    );
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_cambio_plan(uuid, uuid, text, integer, integer, integer, numeric, numeric, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aplicar_cambio_plan(uuid, uuid, text, integer, integer, integer, numeric, numeric, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_cambio_plan(uuid, uuid, text, integer, integer, integer, numeric, numeric, uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.aplicar_cambio_plan(uuid, uuid, text, integer, integer, integer, numeric, numeric, uuid, text, text) IS
    'Cambia plan y cuota de una inscripcion activa (no manual) y registra el cambio. No toca cobros. Solo service_role.';

COMMIT;
