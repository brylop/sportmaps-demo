-- ============================================================================
-- El lock de revision (requires_review) no se limpiaba NUNCA.
--
-- Lo pone `flag_payment_for_review` desde el webhook cuando la pasarela
-- rechaza una transaccion (migracion 20260503000005). Para quitarlo existe la
-- RPC `unblock_payment` y el endpoint POST /api/v1/admin/payments/unblock...
-- que ningun componente del frontend llama jamas. Resultado: 9 cobros de
-- DYNASTY VOLLEY CLUB quedaron muertos entre el 1 y el 15 de agosto de 2026 —
-- la escuela no podia ni registrar el efectivo — y 3 de ellos ya estaban en
-- 'paid' arrastrando la marca.
--
-- Aca se cierra el ciclo por el lado de la base: si el cobro se salda o se
-- anula, la revision deja de tener sentido y la bandera cae sola. El rastro de
-- auditoria (last_failure_at / last_failure_reason) se conserva intacto.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.clear_payment_review_on_settle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Solo al ENTRAR a un estado saldado/anulado, y solo si venia marcado.
    IF NEW.requires_review IS TRUE
       AND NEW.status IN ('paid', 'partial', 'cancelled', 'refunded')
       AND NEW.status IS DISTINCT FROM OLD.status
    THEN
        NEW.requires_review := false;
        NEW.unblocked_at    := COALESCE(NEW.unblocked_at, now());
        -- unblocked_by se deja como venga: si lo destrabo una persona el
        -- frontend ya lo poblo; si cayo por este trigger, queda NULL a
        -- proposito (nadie lo destrabo a mano).
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.clear_payment_review_on_settle() IS
    'Baja requires_review cuando el cobro pasa a paid/partial/cancelled/refunded. Conserva last_failure_* como auditoria.';

DROP TRIGGER IF EXISTS trg_clear_payment_review_on_settle ON public.payments;

CREATE TRIGGER trg_clear_payment_review_on_settle
    BEFORE UPDATE OF status ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.clear_payment_review_on_settle();

COMMIT;
