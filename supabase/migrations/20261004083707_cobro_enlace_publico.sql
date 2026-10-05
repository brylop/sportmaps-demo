-- =============================================================================
-- 20261004083707_cobro_enlace_publico.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261004080918
-- Objetivo: el enlace público de UN cobro — https://sportmaps.co/p/<token> —
-- que llevan como botón las plantillas de cobranza de WhatsApp
-- (bff/whatsapp-templates/*.json). Sin esta ruta la cobranza por WhatsApp no
-- sale nunca: el job manda null en el botón y cae a correo
-- (payment-lifecycle-emails.job.ts, motivo 'sin_enlace').
--
-- Por qué una tabla nueva y no `payment_links.token`:
--   · payment_links es una SESIÓN DE CHECKOUT: nace con la pasarela ya elegida
--     (provider_reference), vive 72 h y el índice único parcial
--     uq_payment_links_one_pending_per_payment permite UNA sola 'pending' por
--     cobro. Un enlace de WhatsApp vive 30 días y todavía no sabe si la familia
--     va a pagar en línea o por transferencia. Meterlo ahí bloquearía el
--     checkout real del cobro (23505) o lo expiraría a las 72 h.
--   · Al pagar en línea desde /p/<token> SÍ se crea un payment_link normal
--     (el mismo que crea POST /payments/create-session), así el webhook de
--     Wompi lo concilia sin cambios.
--
-- Seguridad (CLAUDE.md):
--   · RLS activa y SIN policies: nadie fuera de service_role lee la tabla. El
--     token es la credencial; una policy "by_token" sería USING(true)
--     (trampa 5). La resolución va por RPC SECURITY DEFINER que recibe el token.
--   · Las RPC son solo para service_role (las llama el BFF). REVOKE explícito a
--     anon y authenticated (trampa 3: REVOKE FROM PUBLIC no alcanza).
--   · Token: 18 bytes aleatorios de pgcrypto → 24 caracteres base64url
--     (144 bits). No contiene el payment_id ni nada derivable.
--   · Estados en text + CHECK, no CREATE TYPE.
--
-- NO APLICADA. Hasta que se aplique, el BFF degrada solo: tokenDelBoton()
-- devuelve null (sigue saliendo el correo) y /p/<token> responde "enlace no
-- válido".
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_public_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    token           text NOT NULL UNIQUE
                    CHECK (token ~ '^[A-Za-z0-9_-]{24}$'),
    -- active   → el que se reusa en los envíos nuevos del mismo cobro.
    -- replaced → se emitió uno nuevo porque a este le quedaban < 7 días; SIGUE
    --            abriendo hasta su expires_at (la familia puede tener el
    --            WhatsApp viejo en el chat).
    -- revoked  → no abre más (anulación manual).
    status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'replaced', 'revoked')),
    expires_at      timestamptz NOT NULL,
    open_count      integer NOT NULL DEFAULT 0,
    last_opened_at  timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Un solo token 'active' por cobro: es el que se reusa en cada envío.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_public_tokens_one_active
    ON public.payment_public_tokens (payment_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_payment_public_tokens_school
    ON public.payment_public_tokens (school_id);

COMMENT ON TABLE public.payment_public_tokens IS
    'Enlace público sin login de UN cobro (https://sportmaps.co/p/<token>). Solo service_role; '
    'se emite con cobro_enlace_publico_emitir() y se resuelve con cobro_enlace_publico_resolver().';

ALTER TABLE public.payment_public_tokens ENABLE ROW LEVEL SECURITY;
-- Sin policies a propósito. Y sin privilegios para los roles de PostgREST:
-- los default privileges del esquema se los otorgan a anon/authenticated.
REVOKE ALL ON TABLE public.payment_public_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_public_tokens TO service_role;

-- ── Emitir (o reusar) el token de un cobro ──────────────────────────────────
-- Reusa el 'active' si le quedan más de 7 días; si no, lo pasa a 'replaced'
-- (sigue abriendo hasta vencer) y emite uno nuevo. Así cada escalón de la
-- cobranza (día -5 … +12) manda el MISMO enlace mientras sea útil.
CREATE OR REPLACE FUNCTION public.cobro_enlace_publico_emitir(
    p_payment_id uuid,
    p_dias integer DEFAULT 30
)
RETURNS TABLE (enlace_token text, vence_en timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school  uuid;
    v_dias    integer := LEAST(GREATEST(COALESCE(p_dias, 30), 1), 90);
    v_actual  public.payment_public_tokens%ROWTYPE;
BEGIN
    -- Serializa por cobro sin tomar lock de fila sobre payments (tabla caliente:
    -- el webhook y open_month la escriben). Dos envíos simultáneos del mismo
    -- cobro no pueden crear dos 'active' (además lo impide el índice único).
    PERFORM pg_advisory_xact_lock(hashtextextended('cobro_enlace_publico:' || p_payment_id::text, 0));

    SELECT p.school_id INTO v_school FROM public.payments p WHERE p.id = p_payment_id;
    IF v_school IS NULL THEN
        RAISE EXCEPTION 'cobro_no_existe' USING ERRCODE = 'P0002';
    END IF;

    SELECT t.* INTO v_actual
      FROM public.payment_public_tokens t
     WHERE t.payment_id = p_payment_id AND t.status = 'active';

    IF FOUND AND v_actual.expires_at > now() + interval '7 days' THEN
        RETURN QUERY SELECT v_actual.token, v_actual.expires_at;
        RETURN;
    END IF;

    IF FOUND THEN
        UPDATE public.payment_public_tokens t
           SET status = 'replaced'
         WHERE t.id = v_actual.id;
    END IF;

    RETURN QUERY
    INSERT INTO public.payment_public_tokens AS t (payment_id, school_id, token, expires_at)
    VALUES (
        p_payment_id,
        v_school,
        translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
        now() + make_interval(days => v_dias)
    )
    RETURNING t.token, t.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.cobro_enlace_publico_emitir(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobro_enlace_publico_emitir(uuid, integer) TO service_role;

-- ── Resolver un token ───────────────────────────────────────────────────────
-- Sin fila = no existe (el BFF responde lo mismo que a un token mal formado,
-- para no dar un oráculo de existencia). 'vencido' y 'revocado' sí se
-- distinguen: el que los tiene ya tuvo el enlace legítimo.
CREATE OR REPLACE FUNCTION public.cobro_enlace_publico_resolver(p_token text)
RETURNS TABLE (payment_id uuid, school_id uuid, vence_en timestamptz, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_row public.payment_public_tokens%ROWTYPE;
BEGIN
    IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{24}$' THEN
        RETURN;
    END IF;

    SELECT t.* INTO v_row FROM public.payment_public_tokens t WHERE t.token = p_token;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_row.status = 'revoked' THEN
        RETURN QUERY SELECT v_row.payment_id, v_row.school_id, v_row.expires_at, 'revocado'::text;
        RETURN;
    END IF;

    IF v_row.expires_at <= now() THEN
        RETURN QUERY SELECT v_row.payment_id, v_row.school_id, v_row.expires_at, 'vencido'::text;
        RETURN;
    END IF;

    -- Métrica mínima: ¿la familia abre el enlace? (la cobranza por WhatsApp
    -- se mide por esto antes que por pagos).
    UPDATE public.payment_public_tokens t
       SET open_count = t.open_count + 1, last_opened_at = now()
     WHERE t.id = v_row.id;

    RETURN QUERY SELECT v_row.payment_id, v_row.school_id, v_row.expires_at, 'vigente'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.cobro_enlace_publico_resolver(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobro_enlace_publico_resolver(text) TO service_role;

COMMIT;
