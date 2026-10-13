-- =============================================================================
-- 20261010144555_cobros_f1_descuentos_automaticos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144554
-- Objetivo: F1 de «Cobros y pagos» (spec cobros-multiples §6.5 «Descuentos
--   automáticos: también quedan como ajuste (D16), sin reescribir sus RPCs»,
--   §12 M4).
--   Los descuentos que ya existen quedan registrados como ajuste, con su origen y
--   en orden, SIN tocar open_month, create_enrollment_with_payments ni
--   auto_approve_payment (RPC vivas con deriva frente al repo):
--     militar            → mensualidad cuya inscripción tiene fee_discount_origin='militar'
--     hermanos           → NEW.sibling_discount_applied > 0 (open_month)
--     alta_solo_este_mes → NEW.discount_pct + NEW.list_amount (alta)
--     pronto_pago        → el cobro queda 'paid' con early_payment_discount_applied > 0
--
--   1. public._descuentos_automaticos_calc(payments) — cálculo PURO (una sola
--      regla: la usan los dos triggers y el planificador de M8).
--   2. BEFORE INSERT trg_zzz_payments_descuentos_automaticos: estampa
--      list_amount / discount_amount para que el invariante de M6 valga desde el
--      nacimiento. Nombre «zzz»: los BEFORE disparan en orden alfabético y este
--      tiene que correr DESPUÉS de trg_zz_guard_payments_client (la guardia
--      rechaza list_amount en INSERT de acudiente/atleta; si estampáramos antes,
--      el checkout del acudiente con hermanos fallaría).
--   3. AFTER INSERT / AFTER UPDATE OF early_payment_discount_applied, status
--      trg_payments_descuentos_automaticos: inserta los ajustes.
--   Las filas de un lote (charge_batch_id puesto) las maneja create_charge_batch:
--   los dos triggers salen sin hacer nada.
--
-- Decisiones de lectura del spec (en «Contrato final F1»):
--   · Pronto pago: el ajuste se escribe cuando el cobro queda 'paid' con el valor
--     (no cuando el acudiente lo declara al subir el comprobante): un comprobante
--     rechazado no debe dejar un descuento registrado. No toca amount
--     (applies_to = 'pago').
--   · Militar: solo cuando el monto del cobro corresponde a la tarifa de la
--     inscripción (|monto + hermanos − monthly_fee| ≤ 1, tolerancia de redondeo de
--     open_month) y no es un cobro del alta. Un primer cobro prorrateado no recibe
--     etiqueta militar. Hoy hay 0 inscripciones marcadas.
--   · Una fila que llega con list_amount pero sin discount_pct (ningún camino vivo
--     lo hace: grep de list_amount en bff/src y frontend/src = 0) se recalcula:
--     list_amount = monto + hermanos + militar.
--
-- Radio (base viva, 2026-10-10, solo lectura):
--   · Los triggers solo actúan en INSERT nuevos y en UPDATE de estado / pronto
--     pago: ninguna fila existente cambia al aplicar esta migración.
--   · Filas que hoy recibirían ajustes si nacieran: hermanos 1, alta 4
--     (discount_pct), pronto pago 0, militar 0. Escuelas con hermanos activo: 2;
--     con pronto pago activo: 3; con militar: 1 (Besser, 0 inscripciones marcadas).
--   · Costo: la inmensa mayoría de filas (sin hermanos, sin lista, sin
--     inscripción militar) sale tras una consulta al índice parcial
--     ix_enrollments_fee_discount_origin (vacío hoy). Pendiente medir open_month de
--     Campestre con y sin trigger (bloque de medición en
--     supabase/migrations/_smoke/payment_adjustments_smoke.sql, con ROLLBACK).
-- =============================================================================

BEGIN;

-- ── 1. Cálculo puro ──────────────────────────────────────────────────────────
-- Devuelve NULL si la fila no tiene descuentos automáticos; si no:
-- { list_amount, discount_amount, context, items: [ {origin, basis, pct, amount,
--   reason_code, reason_text} … en orden ] }
CREATE OR REPLACE FUNCTION public._descuentos_automaticos_calc(p public.payments)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_is_mens   boolean := COALESCE(p.payment_category, 'mensualidad') = 'mensualidad';
    v_late      numeric := COALESCE(p.late_fee_amount, 0);
    v_net       numeric := p.amount - COALESCE(p.late_fee_amount, 0);  -- valor sin recargo
    v_sib       numeric := GREATEST(COALESCE(p.sibling_discount_applied, 0), 0);
    v_mil       numeric := 0;
    v_mil_pct   numeric;
    v_alta      numeric := 0;
    v_list      numeric;
    v_disc      numeric;
    v_fee       numeric;
    v_lprice    numeric;
    v_sib_pct   numeric;
    v_items     jsonb := '[]'::jsonb;
    v_es_alta   boolean := p.discount_pct IS NOT NULL AND p.list_amount IS NOT NULL;
BEGIN
    IF p.amount IS NULL THEN
        RETURN NULL;
    END IF;

    -- Militar (solo mensualidad con plan y fuera del alta).
    IF v_is_mens AND p.offering_plan_id IS NOT NULL AND NOT v_es_alta
       AND EXISTS (SELECT 1 FROM public.enrollments e0
                    WHERE e0.school_id = p.school_id
                      AND e0.fee_discount_origin IS NOT NULL) THEN
        SELECT e.monthly_fee,
               e.fee_discount_pct,
               COALESCE(NULLIF(op.price, 0), NULLIF(t.price_monthly, 0))
          INTO v_fee, v_mil_pct, v_lprice
          FROM public.enrollments e
          LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
          LEFT JOIN public.teams t           ON t.id  = e.team_id
         WHERE e.school_id = p.school_id
           AND e.offering_plan_id = p.offering_plan_id
           AND e.status = 'active'
           AND e.fee_discount_origin = 'militar'
           AND (
                 (p.child_id IS NOT NULL AND e.child_id = p.child_id)
              OR (p.child_id IS NULL AND p.unregistered_athlete_id IS NOT NULL
                    AND e.unregistered_athlete_id = p.unregistered_athlete_id)
              OR (p.child_id IS NULL AND p.unregistered_athlete_id IS NULL
                    AND p.user_id IS NOT NULL AND e.user_id = p.user_id)
           )
         ORDER BY e.created_at DESC
         LIMIT 1;

        IF FOUND AND v_fee IS NOT NULL AND v_lprice IS NOT NULL AND v_lprice > v_fee
           AND abs((v_net + v_sib) - v_fee) <= 1 THEN
            v_mil := v_lprice - v_fee;
        END IF;
    END IF;

    IF v_es_alta THEN
        v_list := p.list_amount;
        IF v_list < v_net THEN
            -- Lista menor que lo cobrado: incoherente; se ignora la lista.
            v_list := v_net + v_sib;
            v_disc := v_sib;
        ELSE
            v_disc := v_list - v_net;
            v_sib  := LEAST(v_sib, v_disc);
            v_alta := v_disc - v_sib;
        END IF;
    ELSE
        IF v_sib = 0 AND v_mil = 0 THEN
            IF p.list_amount IS NULL THEN
                RETURN NULL;
            END IF;
            -- Llegó lista sin descuento conocido: se respeta si es coherente.
            v_list := GREATEST(p.list_amount, v_net);
            v_disc := v_list - v_net;
        ELSE
            v_list := v_net + v_sib + v_mil;
            v_disc := v_sib + v_mil;
        END IF;
    END IF;

    IF v_mil > 0 THEN
        v_items := v_items || jsonb_build_object(
            'origin', 'militar',
            'basis', CASE WHEN v_mil_pct IS NOT NULL THEN 'porcentaje' ELSE 'valor' END,
            'pct', v_mil_pct,
            'amount', v_mil,
            'reason_code', 'convenio',
            'reason_text', 'Descuento Fuerza Militar');
    END IF;

    IF v_sib > 0 THEN
        SELECT NULLIF(ss.sibling_discount_percentage, 0) INTO v_sib_pct
          FROM public.school_settings ss WHERE ss.school_id = p.school_id;
        v_items := v_items || jsonb_build_object(
            'origin', 'hermanos',
            'basis', CASE WHEN v_sib_pct IS NOT NULL AND v_sib_pct <= 100 THEN 'porcentaje' ELSE 'valor' END,
            'pct', CASE WHEN v_sib_pct IS NOT NULL AND v_sib_pct <= 100 THEN v_sib_pct END,
            'amount', v_sib,
            'reason_code', 'hermanos',
            'reason_text', NULL);
    END IF;

    IF v_alta > 0 THEN
        v_items := v_items || jsonb_build_object(
            'origin', 'alta_solo_este_mes',
            'basis', 'porcentaje',
            'pct', p.discount_pct,
            'amount', v_alta,
            'reason_code', 'descuento_alta',
            'reason_text', NULL);
    END IF;

    RETURN jsonb_build_object(
        'list_amount', v_list,
        'discount_amount', v_disc,
        'context', CASE WHEN p.discount_pct IS NOT NULL THEN 'alta' ELSE 'al_crear' END,
        'items', v_items);
END;
$function$;

REVOKE ALL ON FUNCTION public._descuentos_automaticos_calc(public.payments) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._descuentos_automaticos_calc(public.payments) TO service_role;

-- ── 2. BEFORE INSERT: estampa list_amount / discount_amount ─────────────────
CREATE OR REPLACE FUNCTION public.fn_payments_descuentos_automaticos_bi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v jsonb;
BEGIN
    -- Filas de «Cobros y pagos»: create_charge_batch estampa y registra todo.
    IF NEW.charge_batch_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Camino rápido: sin lista, sin hermanos y sin posibilidad de militar.
    IF NEW.list_amount IS NULL
       AND COALESCE(NEW.sibling_discount_applied, 0) <= 0
       AND NOT (COALESCE(NEW.payment_category, 'mensualidad') = 'mensualidad'
                AND NEW.offering_plan_id IS NOT NULL) THEN
        RETURN NEW;
    END IF;

    v := public._descuentos_automaticos_calc(NEW);
    IF v IS NULL THEN
        RETURN NEW;
    END IF;

    NEW.list_amount     := (v->>'list_amount')::numeric;
    NEW.discount_amount := (v->>'discount_amount')::numeric;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_payments_descuentos_automaticos_bi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_payments_descuentos_automaticos_bi() TO service_role;

DROP TRIGGER IF EXISTS trg_zzz_payments_descuentos_automaticos ON public.payments;
CREATE TRIGGER trg_zzz_payments_descuentos_automaticos
    BEFORE INSERT ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_payments_descuentos_automaticos_bi();

-- ── 3. AFTER INSERT / UPDATE: inserta los ajustes ───────────────────────────
CREATE OR REPLACE FUNCTION public.fn_payments_descuentos_automaticos_ai()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v        jsonb;
    v_it     jsonb;
    v_seq    integer := 0;
    v_before numeric;
    v_after  numeric;
    v_epd    numeric := COALESCE(NEW.early_payment_discount_applied, 0);
    v_epd_pct numeric;
    v_actor  uuid;
BEGIN
    IF NEW.charge_batch_id IS NOT NULL AND TG_OP = 'INSERT' THEN
        RETURN NULL;
    END IF;

    -- (a) Descuentos que bajan amount, al nacer el cobro.
    IF TG_OP = 'INSERT' AND NEW.list_amount IS NOT NULL THEN
        v := public._descuentos_automaticos_calc(NEW);
        IF v IS NOT NULL AND jsonb_array_length(v->'items') > 0 THEN
            v_before := (v->>'list_amount')::numeric + COALESCE(NEW.late_fee_amount, 0);
            -- militar y «solo este mes» llevan a quien creó el cobro si se conoce.
            FOR v_it IN SELECT value FROM jsonb_array_elements(v->'items') LOOP
                v_seq   := v_seq + 1;
                v_after := v_before - (v_it->>'amount')::numeric;
                v_actor := CASE WHEN v_it->>'origin' IN ('militar', 'alta_solo_este_mes')
                                THEN NEW.created_by END;
                INSERT INTO public.payment_adjustments (
                    school_id, payment_id, charge_batch_id, kind, origin, applies_to,
                    sequence, basis, pct, amount, scope, context, reason_code, reason_text,
                    amount_before, amount_after, amount_paid_at, created_by)
                VALUES (
                    NEW.school_id, NEW.id, NULL, 'descuento', v_it->>'origin', 'monto',
                    v_seq, v_it->>'basis', (v_it->>'pct')::numeric, (v_it->>'amount')::numeric,
                    'linea', v->>'context', v_it->>'reason_code', v_it->>'reason_text',
                    v_before, v_after, COALESCE(NEW.amount_paid, 0), v_actor);
                v_before := v_after;
            END LOOP;
        END IF;
    END IF;

    -- (b) Pronto pago: se registra cuando el cobro queda pagado con ese valor.
    IF NEW.status = 'paid' AND v_epd > 0
       AND (TG_OP = 'INSERT'
            OR OLD.status IS DISTINCT FROM 'paid'
            OR OLD.early_payment_discount_applied IS DISTINCT FROM NEW.early_payment_discount_applied)
       AND NOT EXISTS (SELECT 1 FROM public.payment_adjustments a
                        WHERE a.payment_id = NEW.id AND a.origin = 'pronto_pago'
                          AND a.kind = 'descuento') THEN
        SELECT NULLIF(ss.early_payment_discount_percentage, 0) INTO v_epd_pct
          FROM public.school_settings ss WHERE ss.school_id = NEW.school_id;
        SELECT COALESCE(max(a.sequence), 0) + 1 INTO v_seq
          FROM public.payment_adjustments a WHERE a.payment_id = NEW.id;
        INSERT INTO public.payment_adjustments (
            school_id, payment_id, charge_batch_id, kind, origin, applies_to,
            sequence, basis, pct, amount, scope, context, reason_code, reason_text,
            amount_before, amount_after, amount_paid_at, created_by)
        VALUES (
            NEW.school_id, NEW.id, NEW.charge_batch_id, 'descuento', 'pronto_pago', 'pago',
            v_seq,
            CASE WHEN v_epd_pct IS NOT NULL AND v_epd_pct <= 100 THEN 'porcentaje' ELSE 'valor' END,
            CASE WHEN v_epd_pct IS NOT NULL AND v_epd_pct <= 100 THEN v_epd_pct END,
            v_epd, 'linea', 'al_pagar', 'pronto_pago', NULL,
            NEW.amount, NEW.amount, COALESCE(NEW.amount_paid, 0), NEW.approved_by);
    END IF;

    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_payments_descuentos_automaticos_ai() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_payments_descuentos_automaticos_ai() TO service_role;

DROP TRIGGER IF EXISTS trg_payments_descuentos_automaticos ON public.payments;
CREATE TRIGGER trg_payments_descuentos_automaticos
    AFTER INSERT OR UPDATE OF early_payment_discount_applied, status ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_payments_descuentos_automaticos_ai();

COMMIT;
