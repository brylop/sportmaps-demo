-- =============================================================================
-- 20261010143743_seguridad_s1_descuento_pronto_pago.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010143132
-- Objetivo: rama de seguridad S1 (docs/specs/cobros-multiples.md, hallazgo H5).
--   El pronto pago lo calcula el SERVIDOR; lo que mande el navegador del
--   acudiente/atleta es solo un tope.
-- =============================================================================
--
-- ── El hueco (verificado contra la base viva el 2026-10-10) ──────────────────
-- `payments.early_payment_discount_applied` se calculaba SOLO en el navegador
-- (frontend/src/lib/earlyPaymentDiscount.ts) y lo escribía el propio acudiente
-- (PaymentCheckoutModal: 2 INSERT + 2 UPDATE). La guardia viva
-- `fn_guard_payments_client` (trg_zz_guard_payments_client):
--   · en UPDATE solo lo bloquea si el cobro NO queda en 'awaiting_approval'
--     (rama final del CASE) → el acudiente que sube comprobante elige el valor;
--   · en INSERT no lo mira (tampoco `sibling_discount_applied` ni `created_at`);
--   · `created_at` no está en la lista → el acudiente puede moverlo y reabrir la
--     ventana de N días.
-- Y TRES funciones vivas lo restan al aprobar: `auto_approve_payment`,
-- `resolve_glosa` (amount_paid = amount − early_payment_discount_applied) y
-- `notify_school_payment_paid`. Camino real: el acudiente fija descuento = X,
-- transfiere amount − X, el comprobante sale amarillo (MONTO_DIFIERE) → glosa →
-- el admin la acepta → cobro 'paid' con X regalado. Con X = amount queda en 0.
-- GRANTs de columna: anon y authenticated tienen INSERT/UPDATE en las 83
-- columnas; las policies 'Payments: update parent' / 'update athlete' permiten
-- el UPDATE de la fila propia. El único freno es el trigger.
--
-- Radio hoy: 0 filas con early_payment_discount_applied no nulo (de 5.497);
-- 3 escuelas con pronto pago prendido (MMA BLAIR TEAM, ACADEMIA SUPERIOR
-- BOGOTA, Escuela Demo SportMaps; 10 %, 5 días). Nadie se lo autoaplicó.
--
-- ── El arreglo ────────────────────────────────────────────────────────────────
-- 1. Trigger NUEVO `trg_zzz_pronto_pago_servidor` (BEFORE INSERT OR UPDATE,
--    corre DESPUÉS de trg_zz_guard_payments_client por orden alfabético). Para
--    peticiones de cliente (JWT authenticated/anon) que NO son personal de la
--    escuela del cobro:
--      · early_payment_discount_applied := LEAST(lo pedido, lo que calcula el
--        servidor) con la MISMA regla que lib/earlyPaymentDiscount.ts:
--          - solo mensualidad (payment_category NULL o 'mensualidad');
--          - school_settings.early_payment_discount_enabled y percentage > 0;
--          - ventana: fecha Bogotá de created_at + days (0 → 5, como el front)
--            >= hoy Bogotá; created_at = now() en INSERT, el de la fila en UPDATE;
--          - sin cobro ANTERIOR pending/overdue/partial del mismo atleta (o del
--            mismo acudiente si no hay child_id) en la escuela;
--          - monto = round(amount × percentage / 100).
--        Si el resultado es 0 queda NULL. Recorta en vez de rechazar para no
--        romper el checkout cuando el navegador y el servidor difieran (hora de
--        corte, cobro reutilizado): el comprobante por el valor de más cae en
--        MONTO_DIFIERE y lo ve la escuela, como cualquier pago incompleto.
--        Un valor que NO cambia (el congelado que el front reenvía) no se toca.
--      · created_at: en UPDATE se conserva el de la fila; en INSERT no puede
--        quedar en el futuro.
--      · sibling_discount_applied en INSERT ≠ 0 → PAYMENT_FIELD_LOCKED (solo lo
--        estampa open_month; el cliente nunca lo manda).
--    El personal de la escuela, service_role (BFF, webhooks, crons), las RPC
--    sin JWT y el SQL editor quedan fuera: mismo criterio de staff que la
--    guardia (user_staff_school_ids(), sin cambiar de escuela).
--    Es SECURITY DEFINER porque el acudiente sin fila en school_members NO lee
--    school_settings por RLS (policy user_school_ids()): con SECURITY INVOKER
--    se le borraría el descuento legítimo. Al ser función de trigger no se
--    puede invocar como RPC; igual se revoca EXECUTE.
--    Quién es "cliente" se decide con auth.role() (claims del JWT que fija
--    PostgREST, no falsificables por el cliente) porque dentro de un SECURITY
--    DEFINER current_user es el dueño.
-- 2. CHECK `payments_pronto_pago_rango`: 0 <= early_payment_discount_applied
--    <= amount (spec cobros-multiples §15 «nunca amount por debajo de
--    amount_paid + early_payment_discount_applied»). Defensa para cualquier
--    camino que escape del trigger. Valida al instante: 0 filas no nulas.
-- No se toca `fn_guard_payments_client`, `auto_approve_payment`,
-- `resolve_glosa` ni `notify_school_payment_paid` (RPCs vivas con deriva frente
-- al repo; el spec pide no tocarlas): con el valor ya acotado en la escritura,
-- las tres restan algo que calculó el servidor.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_payments_pronto_pago_servidor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_rol      text := COALESCE(auth.role(), '');
    v_pedido   numeric;
    v_enabled  boolean;
    v_days     integer;
    v_pct      numeric;
    v_base     timestamptz;
    v_impago   boolean := false;
    v_max      numeric := 0;
    v_final    numeric;
BEGIN
    -- Solo peticiones de cliente (PostgREST con JWT de usuario). service_role,
    -- crons, SQL editor y migraciones (sin claims) no se tocan.
    IF v_rol NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- Personal de la escuela del cobro: decide el pronto pago a mano
    -- (spec §15). Mismo criterio que fn_guard_payments_client.
    IF NEW.school_id IS NOT NULL
       AND NEW.school_id = ANY (public.user_staff_school_ids())
       AND (TG_OP = 'INSERT' OR OLD.school_id IS NOT DISTINCT FROM NEW.school_id) THEN
        RETURN NEW;
    END IF;

    -- created_at abre la ventana del pronto pago: el cliente no lo mueve.
    IF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
    ELSIF NEW.created_at IS NULL OR NEW.created_at > now() THEN
        NEW.created_at := now();
    END IF;

    -- Descuento por hermanos: solo lo estampa open_month (servidor).
    IF TG_OP = 'INSERT' AND COALESCE(NEW.sibling_discount_applied, 0) <> 0 THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: sibling_discount_applied'
            USING ERRCODE = '42501',
                  HINT = 'El descuento por hermanos lo calcula el sistema.';
    END IF;

    v_pedido := NEW.early_payment_discount_applied;
    IF v_pedido IS NULL THEN
        RETURN NEW;
    END IF;
    -- El valor congelado que el front reenvía sin cambios no se recalcula
    -- (ya pasó por aquí cuando se escribió).
    IF TG_OP = 'UPDATE' AND v_pedido IS NOT DISTINCT FROM OLD.early_payment_discount_applied THEN
        RETURN NEW;
    END IF;

    -- ── Tope calculado por el servidor (= lib/earlyPaymentDiscount.ts) ──────
    IF v_pedido > 0
       AND COALESCE(NEW.amount, 0) > 0
       AND (NEW.payment_category IS NULL OR NEW.payment_category = 'mensualidad') THEN
        SELECT ss.early_payment_discount_enabled,
               COALESCE(NULLIF(ss.early_payment_discount_days, 0), 5),
               COALESCE(ss.early_payment_discount_percentage, 0)
          INTO v_enabled, v_days, v_pct
          FROM public.school_settings ss
         WHERE ss.school_id = NEW.school_id;

        IF COALESCE(v_enabled, false) AND v_pct > 0 THEN
            v_base := CASE WHEN TG_OP = 'INSERT' THEN now() ELSE OLD.created_at END;

            IF (now() AT TIME ZONE 'America/Bogota')::date
               <= (v_base AT TIME ZONE 'America/Bogota')::date + v_days THEN

                IF NEW.child_id IS NOT NULL THEN
                    SELECT EXISTS (
                        SELECT 1 FROM public.payments p
                         WHERE p.school_id = NEW.school_id
                           AND p.child_id = NEW.child_id
                           AND p.status IN ('pending', 'overdue', 'partial')
                           AND p.created_at < v_base
                           AND p.id IS DISTINCT FROM NEW.id
                    ) INTO v_impago;
                ELSIF NEW.parent_id IS NOT NULL THEN
                    SELECT EXISTS (
                        SELECT 1 FROM public.payments p
                         WHERE p.school_id = NEW.school_id
                           AND p.parent_id = NEW.parent_id
                           AND p.status IN ('pending', 'overdue', 'partial')
                           AND p.created_at < v_base
                           AND p.id IS DISTINCT FROM NEW.id
                    ) INTO v_impago;
                END IF;

                IF NOT v_impago THEN
                    v_max := round(NEW.amount * v_pct / 100);
                END IF;
            END IF;
        END IF;
    END IF;

    v_final := LEAST(GREATEST(v_pedido, 0), v_max);
    NEW.early_payment_discount_applied := CASE WHEN v_final > 0 THEN v_final ELSE NULL END;

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fn_payments_pronto_pago_servidor() IS
  'S1/H5: el pronto pago que escribe un cliente no-staff se acota al calculado por el servidor (school_settings + ventana + sin impagos anteriores); created_at inmutable para el cliente; sibling_discount_applied vedado en INSERT.';

REVOKE ALL ON FUNCTION public.fn_payments_pronto_pago_servidor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_payments_pronto_pago_servidor() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_zzz_pronto_pago_servidor ON public.payments;
CREATE TRIGGER trg_zzz_pronto_pago_servidor
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_payments_pronto_pago_servidor();

-- Defensa en profundidad: ningún camino deja un pronto pago negativo o mayor
-- que el cobro. 0 filas no nulas hoy → valida al instante.
ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_pronto_pago_rango;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_pronto_pago_rango
    CHECK (early_payment_discount_applied IS NULL
           OR (early_payment_discount_applied >= 0
               AND early_payment_discount_applied <= amount))
    NOT VALID;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_pronto_pago_rango;

COMMIT;
