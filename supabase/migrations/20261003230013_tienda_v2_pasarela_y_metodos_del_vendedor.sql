-- =============================================================================
-- 20261003230013_tienda_v2_pasarela_y_metodos_del_vendedor.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003230011
-- Objetivo: M-F0-7 de docs/specs/tienda-v2-f0-plan-migraciones.md. Hoy una
--   venta de tienda por Wompi cae en la cuenta de Dynasty (las llaves ENV del
--   BFF, §1.5 del plan) y el checkout muestra una cuenta bancaria inventada
--   (B2 del informe docs/qa/tienda-baseline-padre-2026-10-03.md).
--
--   1. store_payment_settings: qué medios acepta cada vendedor y por cuánto
--      reserva (transferencia / efectivo). Escritura solo por RPC
--      set_store_payment_settings, que no deja prender lo que no está
--      configurado (GATEWAY_NOT_CONFIGURED / NO_TRANSFER_ACCOUNTS).
--   2. Pasarela del vendedor, SIEMPRE sus llaves:
--      escuela → school_payment_providers (+ payment_provider_secrets cifrado);
--      externo → vendor_payment_providers + vendor_payment_provider_secrets
--      (nueva, cifrada en el BFF con PAYMENT_TOKENS_ENC_KEY, sin acceso del
--      cliente). access_token deja de ser NOT NULL (no se guarda en claro).
--   3. Las columnas de secreto en claro dejan de ser legibles por
--      authenticated (grant por columnas, trampa 4) y anon pierde todo.
--   4. _store_checkout_gateway (reemplaza el STUB de 230007): resuelve el medio
--      aceptado → fila de pasarela + minutos de reserva. Sin pasarela propia
--      el vendedor solo puede ofrecer transferencia y efectivo.
--   5. store_payment_methods (público: solo public_key/sandbox/flags) y
--      store_transfer_accounts (solo el comprador de la orden / la tienda; la
--      vitrina pública nunca ve números de cuenta — no repetir T1).
--
--   DECISIÓN PROVISIONAL D-5 = A (2026-10-03): cada vendedor cobra con SUS
--   llaves; jamás las globales del BFF. Wompi exige integrity + private key;
--   MP exige access token. Una escuela en payment_mode 'aggregator' sin fila
--   propia queda solo con transferencia/efectivo.
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

DO $pre$
BEGIN
    IF to_regprocedure('public._store_checkout_gateway(uuid,text)') IS NULL THEN
        RAISE EXCEPTION 'Falta M-F0-4 (20261003230007): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 1. Medios de pago por vendedor ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_payment_settings (
    vendor_profile_id     uuid PRIMARY KEY REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    accept_wompi          boolean NOT NULL DEFAULT false,
    accept_mercadopago    boolean NOT NULL DEFAULT false,
    accept_transfer       boolean NOT NULL DEFAULT false,
    accept_cash_pickup    boolean NOT NULL DEFAULT false,
    transfer_instructions text CHECK (transfer_instructions IS NULL OR length(transfer_instructions) <= 1000),
    transfer_hold_hours   integer NOT NULL DEFAULT 48 CHECK (transfer_hold_hours BETWEEN 1 AND 168),
    cash_hold_hours       integer NOT NULL DEFAULT 48 CHECK (cash_hold_hours BETWEEN 1 AND 168),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    updated_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.store_payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_payment_settings_select ON public.store_payment_settings;
CREATE POLICY store_payment_settings_select ON public.store_payment_settings
    FOR SELECT TO authenticated
    USING (public.can_manage_store(vendor_profile_id));
REVOKE ALL ON public.store_payment_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.store_payment_settings TO authenticated;
GRANT ALL ON public.store_payment_settings TO service_role;

-- ─── 2. Secretos de pasarela de vendedores externos (cifrados) ───────────────
CREATE TABLE IF NOT EXISTS public.vendor_payment_provider_secrets (
    provider_id          uuid PRIMARY KEY REFERENCES public.vendor_payment_providers(id) ON DELETE CASCADE,
    access_token_enc     text,
    private_key_enc      text,
    integrity_secret_enc text,
    events_secret_enc    text,
    updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_payment_provider_secrets ENABLE ROW LEVEL SECURITY;   -- sin policies
REVOKE ALL ON public.vendor_payment_provider_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vendor_payment_provider_secrets TO service_role;

COMMENT ON TABLE public.vendor_payment_provider_secrets IS
  'Tienda v2 M-F0-7: secretos de pasarela de vendedores externos cifrados en el BFF (gcm:…). Espejo de payment_provider_secrets. Solo service_role.';

ALTER TABLE public.vendor_payment_providers ALTER COLUMN access_token DROP NOT NULL;
COMMENT ON COLUMN public.vendor_payment_providers.access_token IS
  'DEPRECATED (M-F0-7): el BFF guarda los secretos cifrados en vendor_payment_provider_secrets y deja estas columnas en NULL.';

-- ─── 3. Columnas de secreto fuera del alcance del cliente ────────────────────
REVOKE ALL ON public.school_payment_providers, public.vendor_payment_providers FROM anon;
REVOKE SELECT ON public.school_payment_providers FROM authenticated;
GRANT SELECT (id, school_id, provider, public_key, sandbox, is_default, enabled, created_at, updated_at,
              connect_method, external_user_id, application_fee_pct, connect_status, connected_at,
              connected_by)
    ON public.school_payment_providers TO authenticated;
REVOKE SELECT ON public.vendor_payment_providers FROM authenticated;
GRANT SELECT (id, vendor_id, provider, public_key, sandbox, is_default, enabled, created_at, updated_at)
    ON public.vendor_payment_providers TO authenticated;

-- ─── 4. Resolución de la pasarela del vendedor (interna) ─────────────────────
-- Devuelve {gateway_id, gateway_kind} de la pasarela PROPIA del vendedor para
-- ese proveedor, o NULL. Exige los secretos imprescindibles cifrados.
CREATE OR REPLACE FUNCTION public._store_gateway_row(p_vendor_profile_id uuid, p_provider text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_vp public.vendor_profiles%ROWTYPE;
    v_id uuid;
BEGIN
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = p_vendor_profile_id;
    IF v_vp.id IS NULL OR p_provider NOT IN ('wompi', 'mercadopago') THEN
        RETURN NULL;
    END IF;

    IF v_vp.vendor_type::text = 'school' AND v_vp.school_id IS NOT NULL THEN
        SELECT spp.id INTO v_id
          FROM public.school_payment_providers spp
          JOIN public.payment_provider_secrets s ON s.provider_id = spp.id
         WHERE spp.school_id = v_vp.school_id
           AND spp.provider::text = p_provider
           AND spp.enabled
           AND spp.connect_status IN ('connected', 'connected_pending_webhook')
           AND CASE p_provider
                 WHEN 'wompi' THEN s.private_key_enc IS NOT NULL AND s.integrity_secret_enc IS NOT NULL
                 ELSE s.access_token_enc IS NOT NULL END
         ORDER BY spp.is_default DESC, spp.created_at
         LIMIT 1;
        RETURN CASE WHEN v_id IS NULL THEN NULL
                    ELSE jsonb_build_object('gateway_id', v_id, 'gateway_kind', 'school') END;
    END IF;

    SELECT vpp.id INTO v_id
      FROM public.vendor_payment_providers vpp
      LEFT JOIN public.vendor_payment_provider_secrets s ON s.provider_id = vpp.id
     WHERE vpp.vendor_id = v_vp.user_id
       AND vpp.provider::text = p_provider
       AND vpp.enabled
       AND CASE p_provider
             WHEN 'wompi' THEN COALESCE(s.private_key_enc, vpp.access_token) IS NOT NULL
                           AND COALESCE(s.integrity_secret_enc, vpp.integrity_secret) IS NOT NULL
             ELSE COALESCE(s.access_token_enc, vpp.access_token) IS NOT NULL END
     ORDER BY vpp.is_default DESC, vpp.created_at
     LIMIT 1;
    RETURN CASE WHEN v_id IS NULL THEN NULL
                ELSE jsonb_build_object('gateway_id', v_id, 'gateway_kind', 'vendor') END;
END;
$fn$;

-- Cuentas para transferencia del vendedor (interna; números completos).
--   escuela → school_settings.payment_accounts activas (+ cuenta bancaria legacy)
--   externo → vendor_bank_accounts activas
CREATE OR REPLACE FUNCTION public._store_transfer_accounts(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_vp  public.vendor_profiles%ROWTYPE;
    v_out jsonb := '[]'::jsonb;
    v_ss  record;
BEGIN
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = p_vendor_profile_id;
    IF v_vp.id IS NULL THEN
        RETURN v_out;
    END IF;

    IF v_vp.vendor_type::text = 'school' AND v_vp.school_id IS NOT NULL THEN
        SELECT payment_accounts, bank_name, bank_account_type, bank_account_number,
               COALESCE(bank_account_holder, bank_titular_name) AS holder, bank_titular_id
          INTO v_ss
          FROM public.school_settings WHERE school_id = v_vp.school_id;
        IF jsonb_typeof(v_ss.payment_accounts) = 'array' THEN
            SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                       'type', a ->> 'type', 'label', a ->> 'label', 'value', a ->> 'value',
                       'bank', a ->> 'bank', 'account_type', a ->> 'account_type',
                       'holder', a ->> 'holder', 'holder_id', a ->> 'holder_id'))), '[]'::jsonb)
              INTO v_out
              FROM jsonb_array_elements(v_ss.payment_accounts) a
             WHERE COALESCE((a ->> 'active')::boolean, true)
               AND NULLIF(btrim(COALESCE(a ->> 'value', '')), '') IS NOT NULL;
        END IF;
        IF NULLIF(btrim(COALESCE(v_ss.bank_account_number, '')), '') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_out) x
                            WHERE x ->> 'value' = btrim(v_ss.bank_account_number)) THEN
            v_out := v_out || jsonb_strip_nulls(jsonb_build_object(
                'type', 'bank', 'label', COALESCE(v_ss.bank_name, 'Cuenta bancaria'),
                'value', btrim(v_ss.bank_account_number), 'bank', v_ss.bank_name,
                'account_type', v_ss.bank_account_type, 'holder', v_ss.holder,
                'holder_id', v_ss.bank_titular_id));
        END IF;
        RETURN v_out;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'type', 'bank', 'label', b.bank_name, 'value', b.account_number, 'bank', b.bank_name,
               'account_type', b.account_type, 'holder', b.account_holder,
               'holder_id', b.document_number)) ORDER BY b.is_default DESC, b.created_at), '[]'::jsonb)
      INTO v_out
      FROM public.vendor_bank_accounts b
     WHERE b.vendor_profile_id = v_vp.id AND COALESCE(b.is_active, true);
    RETURN v_out;
END;
$fn$;

-- Reemplaza el STUB de 230007. Valida el medio contra lo que el vendedor
-- aceptó y contra lo que REALMENTE tiene configurado.
CREATE OR REPLACE FUNCTION public._store_checkout_gateway(p_vendor_profile_id uuid, p_method text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_s        public.store_payment_settings%ROWTYPE;
    v_gw       jsonb;
    v_accepted boolean;
BEGIN
    SELECT * INTO v_s FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id;
    v_accepted := CASE p_method
                    WHEN 'wompi'       THEN v_s.accept_wompi
                    WHEN 'mercadopago' THEN v_s.accept_mercadopago
                    WHEN 'transfer'    THEN v_s.accept_transfer
                    WHEN 'cash_pickup' THEN v_s.accept_cash_pickup
                    ELSE false END;
    IF v_s.vendor_profile_id IS NULL OR NOT COALESCE(v_accepted, false) THEN
        RAISE EXCEPTION 'PAYMENT_METHOD_NOT_ACCEPTED' USING ERRCODE = 'P0001',
              DETAIL = COALESCE(p_method, '');
    END IF;

    IF p_method IN ('wompi', 'mercadopago') THEN
        v_gw := public._store_gateway_row(p_vendor_profile_id, p_method);
        IF v_gw IS NULL THEN
            RAISE EXCEPTION 'GATEWAY_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = p_method;
        END IF;
        RETURN v_gw || jsonb_build_object('provider', p_method, 'hold_minutes', 45);
    END IF;

    IF p_method = 'transfer' THEN
        IF jsonb_array_length(public._store_transfer_accounts(p_vendor_profile_id)) = 0 THEN
            RAISE EXCEPTION 'NO_TRANSFER_ACCOUNTS' USING ERRCODE = 'P0001';
        END IF;
        RETURN jsonb_build_object('provider', 'transfer', 'hold_minutes', v_s.transfer_hold_hours * 60);
    END IF;

    RETURN jsonb_build_object('provider', 'cash_pickup', 'hold_minutes', v_s.cash_hold_hours * 60);
END;
$fn$;

-- ─── 5. RPC públicas ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_store_payment_settings(
    p_vendor_profile_id uuid, p_settings jsonb, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_cur   public.store_payment_settings%ROWTYPE;
    v_new   public.store_payment_settings%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_manage_store_as(p_vendor_profile_id, v_actor) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;
    IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
        RAISE EXCEPTION 'INVALID_SETTINGS' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_cur FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id FOR UPDATE;

    v_new.vendor_profile_id     := p_vendor_profile_id;
    v_new.accept_wompi          := COALESCE((p_settings ->> 'accept_wompi')::boolean, v_cur.accept_wompi, false);
    v_new.accept_mercadopago    := COALESCE((p_settings ->> 'accept_mercadopago')::boolean, v_cur.accept_mercadopago, false);
    v_new.accept_transfer       := COALESCE((p_settings ->> 'accept_transfer')::boolean, v_cur.accept_transfer, false);
    v_new.accept_cash_pickup    := COALESCE((p_settings ->> 'accept_cash_pickup')::boolean, v_cur.accept_cash_pickup, false);
    v_new.transfer_instructions := CASE WHEN p_settings ? 'transfer_instructions'
                                        THEN NULLIF(left(btrim(COALESCE(p_settings ->> 'transfer_instructions', '')), 1000), '')
                                        ELSE v_cur.transfer_instructions END;
    v_new.transfer_hold_hours   := COALESCE((p_settings ->> 'transfer_hold_hours')::integer, v_cur.transfer_hold_hours, 48);
    v_new.cash_hold_hours       := COALESCE((p_settings ->> 'cash_hold_hours')::integer, v_cur.cash_hold_hours, 48);

    IF v_new.accept_wompi AND public._store_gateway_row(p_vendor_profile_id, 'wompi') IS NULL THEN
        RAISE EXCEPTION 'GATEWAY_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = 'wompi';
    END IF;
    IF v_new.accept_mercadopago AND public._store_gateway_row(p_vendor_profile_id, 'mercadopago') IS NULL THEN
        RAISE EXCEPTION 'GATEWAY_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = 'mercadopago';
    END IF;
    IF v_new.accept_transfer AND jsonb_array_length(public._store_transfer_accounts(p_vendor_profile_id)) = 0 THEN
        RAISE EXCEPTION 'NO_TRANSFER_ACCOUNTS' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.store_payment_settings AS s (
        vendor_profile_id, accept_wompi, accept_mercadopago, accept_transfer, accept_cash_pickup,
        transfer_instructions, transfer_hold_hours, cash_hold_hours, updated_at, updated_by)
    VALUES (v_new.vendor_profile_id, v_new.accept_wompi, v_new.accept_mercadopago, v_new.accept_transfer,
            v_new.accept_cash_pickup, v_new.transfer_instructions, v_new.transfer_hold_hours,
            v_new.cash_hold_hours, now(), (SELECT p.id FROM public.profiles p WHERE p.id = v_actor))
    ON CONFLICT (vendor_profile_id) DO UPDATE
       SET accept_wompi = EXCLUDED.accept_wompi,
           accept_mercadopago = EXCLUDED.accept_mercadopago,
           accept_transfer = EXCLUDED.accept_transfer,
           accept_cash_pickup = EXCLUDED.accept_cash_pickup,
           transfer_instructions = EXCLUDED.transfer_instructions,
           transfer_hold_hours = EXCLUDED.transfer_hold_hours,
           cash_hold_hours = EXCLUDED.cash_hold_hours,
           updated_at = now(),
           updated_by = EXCLUDED.updated_by
    RETURNING * INTO v_new;

    RETURN to_jsonb(v_new);
END;
$fn$;

-- Lo que la vitrina puede saber: qué medios hay y la llave PÚBLICA de la pasarela.
CREATE OR REPLACE FUNCTION public.store_payment_methods(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_s       public.store_payment_settings%ROWTYPE;
    v_methods jsonb := '[]'::jsonb;
    v_gw      jsonb;
    v_row     record;
    v_p       text;
BEGIN
    IF NOT public.store_seller_allowed(p_vendor_profile_id) THEN
        RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', false, 'methods', '[]'::jsonb);
    END IF;
    SELECT * INTO v_s FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id;
    IF v_s.vendor_profile_id IS NULL THEN
        RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', true, 'methods', '[]'::jsonb);
    END IF;

    FOREACH v_p IN ARRAY ARRAY['wompi', 'mercadopago'] LOOP
        IF (v_p = 'wompi' AND v_s.accept_wompi) OR (v_p = 'mercadopago' AND v_s.accept_mercadopago) THEN
            v_gw := public._store_gateway_row(p_vendor_profile_id, v_p);
            IF v_gw IS NOT NULL THEN
                IF v_gw ->> 'gateway_kind' = 'school' THEN
                    SELECT public_key, sandbox INTO v_row FROM public.school_payment_providers
                     WHERE id = (v_gw ->> 'gateway_id')::uuid;
                ELSE
                    SELECT public_key, sandbox INTO v_row FROM public.vendor_payment_providers
                     WHERE id = (v_gw ->> 'gateway_id')::uuid;
                END IF;
                v_methods := v_methods || jsonb_build_object('method', v_p, 'provider', v_p,
                                                             'public_key', v_row.public_key, 'sandbox', v_row.sandbox);
            END IF;
        END IF;
    END LOOP;
    IF v_s.accept_transfer AND jsonb_array_length(public._store_transfer_accounts(p_vendor_profile_id)) > 0 THEN
        v_methods := v_methods || jsonb_build_object('method', 'transfer', 'hold_hours', v_s.transfer_hold_hours,
                                                     'requires_receipt', true);
    END IF;
    IF v_s.accept_cash_pickup THEN
        v_methods := v_methods || jsonb_build_object('method', 'cash_pickup', 'hold_hours', v_s.cash_hold_hours,
                                                     'requires_pickup', true);
    END IF;

    RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', true, 'methods', v_methods);
END;
$fn$;

-- Números de cuenta: solo al comprador de una orden de transferencia abierta
-- (o a quien administra la tienda). Nunca a la vitrina.
CREATE OR REPLACE FUNCTION public.store_transfer_accounts(p_order_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_o     public.orders%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF NOT (public.can_manage_store_as(v_o.vendor_profile_id, v_actor)
            OR (v_o.user_id = v_actor AND v_o.payment_method = 'transfer'
                AND v_o.status IN ('pending_payment', 'awaiting_approval'))) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
        'order_id', v_o.id,
        'reference', v_o.reference,
        'amount', v_o.total_amount,
        'expires_at', v_o.expires_at,
        'status', v_o.status,
        'accounts', public._store_transfer_accounts(v_o.vendor_profile_id),
        'instructions', (SELECT transfer_instructions FROM public.store_payment_settings
                          WHERE vendor_profile_id = v_o.vendor_profile_id));
END;
$fn$;

-- ─── 6. Alta/edición de la pasarela de un vendedor externo (transaccional) ───
-- Espejo de upsert_school_provider: fila visible + secretos cifrados en la
-- MISMA transacción (CLAUDE.md: multi-fila = RPC). Las columnas en claro
-- quedan en NULL. Una clave ausente en p_secrets_enc no borra la existente.
-- Solo service_role (el BFF cifra con PAYMENT_TOKENS_ENC_KEY y valida dueño).
CREATE OR REPLACE FUNCTION public.upsert_vendor_provider(
    p_vendor_id   uuid,
    p_provider    public.payment_provider,
    p_public_key  text,
    p_secrets_enc jsonb,
    p_sandbox     boolean DEFAULT true,
    p_enabled     boolean DEFAULT true,
    p_is_default  boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_id uuid;
BEGIN
    IF p_vendor_id IS NULL OR NULLIF(btrim(COALESCE(p_public_key, '')), '') IS NULL THEN
        RAISE EXCEPTION 'vendor_id y public_key son obligatorios' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.vendor_payment_providers AS v (
        vendor_id, provider, public_key, access_token, webhook_secret, integrity_secret,
        sandbox, enabled, is_default, updated_at)
    VALUES (p_vendor_id, p_provider, btrim(p_public_key), NULL, NULL, NULL,
            p_sandbox, p_enabled, p_is_default, now())
    ON CONFLICT (vendor_id, provider) DO UPDATE
       SET public_key = EXCLUDED.public_key,
           access_token = NULL, webhook_secret = NULL, integrity_secret = NULL,
           sandbox = EXCLUDED.sandbox,
           enabled = EXCLUDED.enabled,
           is_default = EXCLUDED.is_default,
           updated_at = now()
    RETURNING v.id INTO v_id;

    INSERT INTO public.vendor_payment_provider_secrets AS s (
        provider_id, access_token_enc, private_key_enc, integrity_secret_enc, events_secret_enc, updated_at)
    VALUES (v_id,
            p_secrets_enc ->> 'access_token_enc',
            p_secrets_enc ->> 'private_key_enc',
            p_secrets_enc ->> 'integrity_secret_enc',
            p_secrets_enc ->> 'events_secret_enc',
            now())
    ON CONFLICT (provider_id) DO UPDATE
       SET access_token_enc     = COALESCE(EXCLUDED.access_token_enc,     s.access_token_enc),
           private_key_enc      = COALESCE(EXCLUDED.private_key_enc,      s.private_key_enc),
           integrity_secret_enc = COALESCE(EXCLUDED.integrity_secret_enc, s.integrity_secret_enc),
           events_secret_enc    = COALESCE(EXCLUDED.events_secret_enc,    s.events_secret_enc),
           updated_at           = now();

    RETURN v_id;
END;
$fn$;

-- ─── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.upsert_vendor_provider(uuid, public.payment_provider, text, jsonb, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_vendor_provider(uuid, public.payment_provider, text, jsonb, boolean, boolean, boolean) TO service_role;
REVOKE ALL ON FUNCTION public._store_gateway_row(uuid, text)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_transfer_accounts(uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_checkout_gateway(uuid, text)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_store_payment_settings(uuid, jsonb, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_payment_methods(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_transfer_accounts(uuid, uuid)            FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._store_gateway_row(uuid, text)                TO service_role;
GRANT EXECUTE ON FUNCTION public.set_store_payment_settings(uuid, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_payment_methods(uuid)                   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_transfer_accounts(uuid, uuid)           TO authenticated, service_role;

COMMIT;
