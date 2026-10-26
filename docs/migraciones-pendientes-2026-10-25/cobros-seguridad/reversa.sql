-- =============================================================================
-- reversa.sql — deshace 01_payments_monto_servidor_despues_de_s4.sql
-- (migración 20261025205957). Vuelve EXACTAMENTE a lo que está vivo hoy
-- (2026-10-25): función de 20261025205952 y trigger trg_zz_payments_monto_servidor,
-- que corre ANTES de S4. No toca datos: amount_source ya estampado se queda.
-- Las partes 1-4 (ya vivas) no tienen reversa aquí: ver LEEME.md.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '900ms';

CREATE OR REPLACE FUNCTION public.fn_payments_monto_servidor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_validos numeric[];
BEGIN
    -- RPC SECURITY DEFINER (postgres), BFF (service_role), SQL editor: no aplica.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- Staff de la escuela del cobro: opera como hoy (mismo criterio que DIN-24).
    IF NEW.school_id IS NOT NULL
       AND NEW.school_id = ANY (public.user_staff_school_ids())
       AND (TG_OP = 'INSERT' OR OLD.school_id IS NOT DISTINCT FROM NEW.school_id) THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.amount_source IS DISTINCT FROM OLD.amount_source THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: amount_source' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    -- ── INSERT ───────────────────────────────────────────────────────────────
    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
        RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING ERRCODE = '42501',
            HINT = 'El valor del pago debe ser mayor que cero.';
    END IF;

    IF (NEW.payment_category = 'mensualidad'
        OR (NEW.payment_category IS NULL AND NEW.concept ILIKE 'mensualidad%'))
       AND (NEW.child_id IS NOT NULL OR NEW.user_id IS NOT NULL) THEN
        v_validos := public.payments_montos_mensualidad_validos(NEW.school_id, NEW.child_id, NEW.user_id);
        IF coalesce(cardinality(v_validos), 0) > 0 AND NEW.amount = ANY (v_validos) THEN
            NEW.amount_source := 'servidor';
            RETURN NEW;
        END IF;
        -- CAMBIO 2026-10-24 (medición del radio): un monto distinto de la tarifa YA NO se
        -- rechaza. Abonos parciales y pagos de varios meses entran como 'cliente' y
        -- auto_approve_payment no los aprueba: los revisa una persona.
    END IF;

    -- Monto elegido por la familia (o sin tarifa con qué compararlo): se acepta,
    -- pero no se auto-aprueba.
    NEW.amount_source := 'cliente';
    RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_payments_monto_servidor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zzyz_payments_monto_servidor ON public.payments;
DROP TRIGGER IF EXISTS trg_zz_payments_monto_servidor ON public.payments;
CREATE TRIGGER trg_zz_payments_monto_servidor
    BEFORE INSERT OR UPDATE OF amount_source ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_payments_monto_servidor();

COMMIT;

SELECT tgname FROM pg_trigger
 WHERE tgrelid = 'public.payments'::regclass AND tgname LIKE '%monto_servidor%' AND NOT tgisinternal;
