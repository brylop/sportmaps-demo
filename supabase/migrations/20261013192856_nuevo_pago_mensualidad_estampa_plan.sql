-- =============================================================================
-- 20261013192856_nuevo_pago_mensualidad_estampa_plan.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013192838
-- Objetivo: «Nuevo pago» de mensualidad no daba vigencia. El trigger
--   fn_payments_monto_cobro_cliente → _payments_cobro_cliente_normalizar solo
--   estampaba offering_plan_id si el cliente ya lo mandaba; el modal de «Nuevo
--   pago» no lo manda, el cobro quedaba sin plan y al aprobarlo
--   fn_extend_enrollment_on_payment_paid (exige offering_plan_id) no extendía
--   expires_at. Ahora la rama mensualidad asigna siempre el plan de la
--   inscripción con la que se tarifó. Spec: docs/specs/dreamers-cierre-total.md F1.
--
-- Parte del cuerpo VIVO de producción (md5 sin CR 12764905482323295b7ac9fa03e13180).
-- ACL viva: postgres, service_role, authenticated (EXECUTE). Se conserva.
-- =============================================================================

BEGIN;

DO $guard$
DECLARE
    v_md5 text;
BEGIN
    SELECT md5(replace(p.prosrc, E'\r', '')) INTO v_md5
      FROM pg_proc p
     WHERE p.oid = 'public._payments_cobro_cliente_normalizar(public.payments)'::regprocedure;
    IF v_md5 IS DISTINCT FROM '12764905482323295b7ac9fa03e13180'
       AND v_md5 IS DISTINCT FROM 'd8dffde245013004f4a8d5265f16b43c' THEN
        RAISE EXCEPTION '_payments_cobro_cliente_normalizar cambió en la base (md5 %); revisar antes de reemplazar', v_md5;
    END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public._payments_cobro_cliente_normalizar(p payments)
 RETURNS payments
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_uid        uuid := auth.uid();
    v_cat        text := COALESCE(p.payment_category, 'mensualidad');
    v_tarifa     numeric;
    v_plan       uuid;
    v_encontrado boolean := false;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: sesión'
            USING ERRCODE = '42501', HINT = 'Inicia sesión para registrar un pago.';
    END IF;

    -- ── Identidad: el cobro es del propio usuario o de un hijo suyo ─────────
    IF p.unregistered_athlete_id IS NOT NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: unregistered_athlete_id' USING ERRCODE = '42501';
    END IF;
    IF p.qr_id IS NOT NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: qr_id' USING ERRCODE = '42501';
    END IF;
    IF p.user_id IS NOT NULL AND p.user_id <> v_uid THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: user_id' USING ERRCODE = '42501';
    END IF;
    IF p.parent_id IS NOT NULL AND p.parent_id <> v_uid THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: parent_id' USING ERRCODE = '42501';
    END IF;
    IF p.child_id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.children c
            WHERE c.id = p.child_id AND c.parent_id = v_uid) THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: child_id'
            USING ERRCODE = '42501',
                  HINT = 'Solo puedes registrar pagos de tus propios deportistas.';
    END IF;

    -- ── Categorías sin tarifa de servidor: monto libre, sin efectos ─────────
    IF v_cat NOT IN ('mensualidad', 'inscripcion', 'seguro') THEN
        p.offering_plan_id := NULL;
        p.period_uniqueness_exempt := true;
        RETURN p;
    END IF;

    -- ── Tarifa de la inscripción del atleta en esa escuela ─────────────────
    SELECT c.tarifa, c.offering_plan_id
      INTO v_tarifa, v_plan
      FROM (
        SELECT e.offering_plan_id, e.team_id, e.scheduling_team_id, e.status, e.created_at,
               CASE v_cat
                 WHEN 'mensualidad' THEN COALESCE(NULLIF(e.monthly_fee, 0),
                                                  NULLIF(t.price_monthly, 0),
                                                  NULLIF(op.price, 0))
                 WHEN 'inscripcion' THEN NULLIF(op.registration_fee, 0)
                 WHEN 'seguro'      THEN NULLIF(op.insurance_fee, 0)
               END AS tarifa
          FROM public.enrollments e
          LEFT JOIN public.teams          t  ON t.id  = e.team_id
          LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
         WHERE e.school_id = p.school_id
           AND e.status IN ('active', 'pending', 'cancelled')
           AND (
                 (p.child_id IS NOT NULL AND e.child_id = p.child_id)
              OR (p.child_id IS NULL
                  AND e.child_id IS NULL
                  AND e.unregistered_athlete_id IS NULL
                  AND e.user_id = v_uid)
               )
      ) c
     WHERE c.tarifa IS NOT NULL
     -- COALESCE(…, false): un booleano NULL ordenaría PRIMERO con DESC.
     ORDER BY (c.status = 'active') DESC,
              (c.status = 'pending') DESC,
              COALESCE(c.offering_plan_id = p.offering_plan_id, false) DESC,
              COALESCE(c.team_id = p.team_id OR c.scheduling_team_id = p.team_id, false) DESC,
              COALESCE(c.tarifa = p.amount, false) DESC,
              c.created_at DESC NULLS LAST
     LIMIT 1;
    v_encontrado := FOUND;

    -- Legado "equipo directo" (hijo sin inscripción): solo mensualidad.
    IF NOT v_encontrado AND v_cat = 'mensualidad' AND p.child_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(ch.monthly_fee, 0), NULLIF(t.price_monthly, 0))
          INTO v_tarifa
          FROM public.children ch
          LEFT JOIN public.teams t ON t.id = ch.team_id
         WHERE ch.id = p.child_id
           AND ch.school_id = p.school_id;
        v_plan := NULL;
        v_encontrado := v_tarifa IS NOT NULL;
    END IF;

    IF v_cat = 'mensualidad' THEN
        IF NOT v_encontrado OR COALESCE(v_tarifa, 0) <= 0 THEN
            RAISE EXCEPTION 'No encontramos el valor de la mensualidad de este deportista en la escuela. Pídele a la escuela que te genere el cobro.'
                USING ERRCODE = 'P0001', DETAIL = 'PAYMENT_AMOUNT_UNPRICED';
        END IF;
        p.amount := v_tarifa;
        -- 20261013192856: SIEMPRE el plan de la inscripción encontrada. Antes
        -- solo se pisaba si el cliente lo mandaba, y el «Nuevo pago» de
        -- mensualidad (que no lo manda) quedaba sin plan → al aprobarlo
        -- fn_extend_enrollment_on_payment_paid no extendía la vigencia.
        -- Si no hubo inscripción (legado «equipo directo») v_plan es NULL.
        p.offering_plan_id := v_plan;
        p.period_uniqueness_exempt := false;
        RETURN p;
    END IF;

    -- inscripcion / seguro
    IF v_encontrado AND COALESCE(v_tarifa, 0) > 0 THEN
        p.amount := v_tarifa;
        p.offering_plan_id := v_plan;
    ELSE
        p.offering_plan_id := NULL;
    END IF;
    p.period_uniqueness_exempt := true;
    RETURN p;
END;
$function$
;

-- ACL viva: EXECUTE a postgres, service_role, authenticated (sin anon/PUBLIC).
REVOKE ALL ON FUNCTION public._payments_cobro_cliente_normalizar(public.payments) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._payments_cobro_cliente_normalizar(public.payments) TO authenticated, service_role;

COMMIT;
