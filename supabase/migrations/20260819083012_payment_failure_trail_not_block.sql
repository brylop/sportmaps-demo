-- ============================================================================
-- El rastro del intento fallido nunca se guardaba, y el que sí se guardaba
-- bloqueaba de más.
--
-- Barrido del 19 ago 2026 sobre 10 transacciones fallidas de DYNASTY VOLLEY
-- CLUB (2026-08-01 a 08-15), contrastadas contra la API de Wompi: ni un peso
-- capturado, ningún cobro doble. El problema era de operación, no contable.
--
-- Hueco 1 — el UPDATE del link reventaba EN SILENCIO.
--   `mapWompiStatus` devuelve rejected/failed/refunded, y el webhook los
--   escribe en payment_links.status como 'declined'/'failed'/'refunded'
--   (wompi.ts:408, mercadopago.ts:388). Pero el CHECK solo admitía
--   pending|paid|expired|cancelled: Postgres rechazaba la fila con 23514 y
--   NADIE leía el error de ese .update(). Por eso los 10 links siguen en
--   'pending' con failed_attempts = 0. Misma clase de falla que el
--   payment_method='wompi' que ya costó caro antes.
--
-- Hueco 2 — abandonar un PSE bloqueaba al pagador en TODA la plataforma.
--   `flag_payment_for_review` marca requires_review, y esa marca la lee
--   `is_user_payment_blocked` para frenar cualquier checkout nuevo (escuela,
--   marketplace, cart). Se disparaba con CUALQUIER estado no aprobado: 4 de
--   los 10 rechazos son «rechazada por el usuario» en PSE — el padre cerró la
--   pestaña. Eso no es un incidente, es martes.
--
--   Una declinación ordinaria (el banco dijo que no) no deja plata en el aire:
--   no hay nada que revisar, hay que reintentar. Solo ERROR y VOIDED son
--   ambiguos — ahí no sabemos si el dinero se movió — y solo esos ameritan
--   parar la fila hasta que alguien mire.
--
-- Acá van las dos piezas de base: el CHECK que acepta lo que el código
-- escribe, y una RPC que guarda el rastro SIN bloquear.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. payment_links.status — admitir los estados terminales que el webhook emite
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_links
    DROP CONSTRAINT IF EXISTS payment_links_status_check;

ALTER TABLE public.payment_links
    ADD CONSTRAINT payment_links_status_check
    CHECK (status = ANY (ARRAY[
        'pending'::text,
        'paid'::text,
        'expired'::text,
        'cancelled'::text,
        -- Terminales de pasarela. 'declined' = el banco dijo que no;
        -- 'failed' = ERROR de la pasarela; 'refunded' = VOIDED.
        'declined'::text,
        'failed'::text,
        'refunded'::text
    ]));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. record_payment_failure — el rastro sin el bloqueo
-- ─────────────────────────────────────────────────────────────────────────────
-- Gemela de flag_payment_for_review pero SIN tocar requires_review. Para las
-- declinaciones ordinarias: queda constancia de que hubo un intento y por qué
-- se cayó, y el padre puede volver a intentar sin pedirle permiso a nadie.

CREATE OR REPLACE FUNCTION public.record_payment_failure(
    p_kind TEXT,
    p_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF p_kind = 'payment' THEN
        UPDATE public.payments
        SET last_failure_at = now(),
            last_failure_reason = p_reason,
            updated_at = now()
        WHERE id = p_id;
    ELSIF p_kind = 'order' THEN
        UPDATE public.orders
        SET last_failure_at = now(),
            last_failure_reason = p_reason,
            updated_at = now()
        WHERE id = p_id;
    ELSIF p_kind = 'marketplace_transaction' THEN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
            EXECUTE 'UPDATE public.marketplace_transactions SET last_failure_at = now(), last_failure_reason = $1, updated_at = now() WHERE id = $2'
                USING p_reason, p_id;
        END IF;
    ELSIF p_kind = 'session_booking' THEN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='session_bookings') THEN
            EXECUTE 'UPDATE public.session_bookings SET last_failure_at = now(), last_failure_reason = $1, updated_at = now() WHERE id = $2'
                USING p_reason, p_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'invalid_kind: %', p_kind;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.record_payment_failure(TEXT, UUID, TEXT) IS
    'Registra last_failure_at/reason de un intento fallido SIN marcar requires_review. Para declinaciones ordinarias: dejan rastro pero no bloquean el reintento.';

-- Solo el webhook la llama. El default privilege del esquema le da EXECUTE a
-- authenticated en toda funcion nueva, asi que hay que revocarlo explicito.
REVOKE ALL ON FUNCTION public.record_payment_failure(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_failure(TEXT, UUID, TEXT) TO service_role;

COMMIT;
