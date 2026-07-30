-- ============================================================
-- SPORTMAPS — Connected Accounts F0.1: ruta de escritura cifrada
-- ------------------------------------------------------------
-- Ref: docs/payments-connected-accounts-fase0-cierre.md §2 (F0.1). Fecha: 2026-07-30
--
-- PROBLEMA QUE RESUELVE
-- La mig 20260714000004 creó payment_provider_secrets (secretos cifrados, solo
-- service_role) pero NADIE la escribía: encryptSecret() del BFF no se invocaba en
-- ninguna ruta, así que la tabla quedó vacía y payment_mode='direct' era inalcanzable.
--
-- POR QUÉ UNA RPC Y NO DOS ESCRITURAS DESDE EL BFF
-- Conectar una pasarela toca DOS tablas (la fila visible + la fila de secretos). Desde
-- supabase-js no hay transacción: si la segunda escritura falla, queda un provider sin
-- secretos y el resolver — fail-closed — apaga el checkout de esa escuela. La RPC hace
-- ambos upserts en una sola transacción.
--
-- LA DB NUNCA VE LOS SECRETOS EN CLARO
-- El cifrado es AES-256-GCM en el BFF con PAYMENT_TOKENS_ENC_KEY (utils/payment-crypto).
-- Esta función recibe los valores YA CIFRADOS en p_secrets_enc. Postgres no conoce la
-- clave ni puede descifrar.
--
-- POR QUÉ NO SE OTORGA A `authenticated`
-- Si el cliente pudiera llamarla directo se saltaría el gate de addon y la validación de
-- llaves contra la API del proveedor, ambos en el BFF. Solo service_role.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_school_provider(
    p_school_id        uuid,
    p_provider         public.payment_provider,
    p_public_key       text,
    p_secrets_enc      jsonb,
    p_sandbox          boolean       DEFAULT true,
    p_enabled          boolean       DEFAULT true,
    p_is_default       boolean       DEFAULT false,
    p_connect_method   text          DEFAULT 'manual',
    p_connect_status   text          DEFAULT 'connected',
    p_connected_by     uuid          DEFAULT NULL,
    p_external_user_id text          DEFAULT NULL,
    p_token_expires_at timestamptz   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_provider_id uuid;
BEGIN
    IF p_school_id IS NULL OR p_public_key IS NULL THEN
        RAISE EXCEPTION 'school_id y public_key son obligatorios';
    END IF;

    -- ── Fila visible. Los secretos legacy quedan en NULL a propósito: viven cifrados
    --    en payment_provider_secrets (columnas legacy DEPRECATED por 20260714000004).
    INSERT INTO public.school_payment_providers AS spp (
        school_id, provider, public_key, sandbox, enabled, is_default,
        connect_method, connect_status, connected_by, connected_at, external_user_id,
        updated_at
    )
    VALUES (
        p_school_id, p_provider, p_public_key, p_sandbox, p_enabled, p_is_default,
        p_connect_method, p_connect_status, p_connected_by, now(), p_external_user_id,
        now()
    )
    ON CONFLICT (school_id, provider) DO UPDATE
       SET public_key       = EXCLUDED.public_key,
           sandbox          = EXCLUDED.sandbox,
           enabled          = EXCLUDED.enabled,
           is_default       = EXCLUDED.is_default,
           connect_method   = EXCLUDED.connect_method,
           connect_status   = EXCLUDED.connect_status,
           connected_by     = COALESCE(EXCLUDED.connected_by, spp.connected_by),
           connected_at     = COALESCE(spp.connected_at, EXCLUDED.connected_at),
           external_user_id = COALESCE(EXCLUDED.external_user_id, spp.external_user_id),
           updated_at       = now()
    RETURNING spp.id INTO v_provider_id;

    -- ── Fila de secretos. Merge por clave con COALESCE: una clave ausente (o null) en
    --    p_secrets_enc NO borra la existente. Editar solo la private_key no puede dejar
    --    a la escuela sin events_secret. Para limpiar todo, borrar el provider (la FK
    --    tiene ON DELETE CASCADE).
    INSERT INTO public.payment_provider_secrets AS pps (
        provider_id, access_token_enc, refresh_token_enc, private_key_enc,
        integrity_secret_enc, events_secret_enc, token_expires_at, updated_at
    )
    VALUES (
        v_provider_id,
        p_secrets_enc ->> 'access_token_enc',
        p_secrets_enc ->> 'refresh_token_enc',
        p_secrets_enc ->> 'private_key_enc',
        p_secrets_enc ->> 'integrity_secret_enc',
        p_secrets_enc ->> 'events_secret_enc',
        p_token_expires_at,
        now()
    )
    ON CONFLICT (provider_id) DO UPDATE
       SET access_token_enc     = COALESCE(EXCLUDED.access_token_enc,     pps.access_token_enc),
           refresh_token_enc    = COALESCE(EXCLUDED.refresh_token_enc,    pps.refresh_token_enc),
           private_key_enc      = COALESCE(EXCLUDED.private_key_enc,      pps.private_key_enc),
           integrity_secret_enc = COALESCE(EXCLUDED.integrity_secret_enc, pps.integrity_secret_enc),
           events_secret_enc    = COALESCE(EXCLUDED.events_secret_enc,    pps.events_secret_enc),
           token_expires_at     = COALESCE(EXCLUDED.token_expires_at,     pps.token_expires_at),
           updated_at           = now();

    RETURN v_provider_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_school_provider IS
  'Conecta/actualiza la pasarela de una escuela en UNA transacción (fila visible + '
  'secretos cifrados). Recibe los secretos YA cifrados por el BFF (AES-256-GCM); la DB '
  'nunca ve plaintext. Merge por clave: clave ausente no borra la existente. '
  'Solo service_role — el cliente no debe saltarse el gate de addon ni la validación de '
  'llaves del BFF.';

-- ── Permisos: explícito por RPC (SECURITY DEFINER no exime al caller de EXECUTE) ──
REVOKE ALL ON FUNCTION public.upsert_school_provider(
    uuid, public.payment_provider, text, jsonb, boolean, boolean, boolean,
    text, text, uuid, text, timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_school_provider(
    uuid, public.payment_provider, text, jsonb, boolean, boolean, boolean,
    text, text, uuid, text, timestamptz
) TO service_role;

-- ── has_entitlement: hacer explícito el EXECUTE de service_role ────────────────
-- El BFF usa has_entitlement() como gate del addon de pasarela, llamándola con
-- service_role. Hoy funciona sólo por accidente: la función se creó en 20260513000007,
-- DESPUÉS de la migración 20260513000003 que revocó `public` de las helpers, así que
-- conservó el GRANT por defecto a PUBLIC y service_role entra por ahí. La próxima pasada
-- de endurecimiento del linter la dejaría sin permiso y el gate — que es fail-closed —
-- empezaría a negar toda conexión de pasarela sin una causa evidente.
GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
