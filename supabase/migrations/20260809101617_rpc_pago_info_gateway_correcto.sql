-- Migration: 20260809101617_rpc_pago_info_gateway_correcto.sql
-- Description: get_school_payment_info leía ss.epayco_enabled, una columna que ya
-- no existe.
--
-- La RPC se creó el 2026-04-22. El 2026-05-03, la migración 20260503000001
-- (wompi_migration) renombró epayco_enabled → wompi_enabled en school_settings:
-- en sus tres ramas (drop de la legacy, rename, o alta de la nueva) el resultado
-- es siempre que epayco_enabled deja de existir. Nadie actualizó la RPC.
--
-- plpgsql no valida las referencias a columnas al crear la función, solo al
-- ejecutarla, así que el error no aparece hasta que un acudiente abre el modal:
-- la función revienta con "column ss.epayco_enabled does not exist", el cliente
-- recibe error, bankSettings queda en null y el padre ve "La escuela no ha
-- configurado sus datos bancarios aún" — aunque los tenga cargados. De paso
-- hasGateway queda en false y tampoco se ofrece el pago online, que es
-- justamente lo contrario de lo que la escuela configuró.
--
-- El campo se resuelve vía to_jsonb(ss) en vez de nombrar la columna directo:
-- `to_jsonb(ss) ->> 'columna_inexistente'` devuelve NULL en lugar de fallar, así
-- que la función queda a salvo del renombrado en cualquier ambiente,
-- independientemente de cuál de las dos columnas tenga aplicada. Es deuda de la
-- deriva de esquema, no elegancia: nombrar la columna nos volvería a dejar
-- expuestos a que un ambiente esté del otro lado del rename.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_school_payment_info(
    p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_data jsonb;
    v_public_profile_enabled boolean;
BEGIN
    -- Gate: solo exponer info de escuelas que optaron por perfil publico.
    -- Si no es publica, devuelve null; el checkout no debe ser accesible.
    SELECT public_profile_enabled
    INTO v_public_profile_enabled
    FROM school_settings
    WHERE school_id = p_school_id;

    IF NOT COALESCE(v_public_profile_enabled, false) THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        -- Manual: cuenta bancaria + llaves
        'bank_name',            ss.bank_name,
        'bank_account_type',    ss.bank_account_type,
        'bank_account_number',  ss.bank_account_number,
        'payment_accounts',     COALESCE(ss.payment_accounts, '[]'::jsonb),
        -- Legacy: respaldo para clientes desplegados que aun no leen la lista
        'nequi_number',         ss.nequi_number,
        'daviplata_number',     ss.daviplata_number,
        'breb_number',          ss.breb_number,
        'transfer_key',         ss.transfer_key,
        'bank_titular_name',    ss.bank_titular_name,
        'bank_titular_id',      ss.bank_titular_id,
        'payment_qr_url',       ss.payment_qr_url,
        -- Gateways online. wompi_enabled es el toggle que edita la escuela en
        -- SportMaps Pay; se emite tambien como epayco_enabled por si quedara
        -- algun cliente viejo leyendo la clave anterior.
        'wompi_enabled',        COALESCE(
                                    (to_jsonb(ss) ->> 'wompi_enabled')::boolean,
                                    (to_jsonb(ss) ->> 'epayco_enabled')::boolean,
                                    false
                                ),
        'epayco_enabled',       COALESCE(
                                    (to_jsonb(ss) ->> 'wompi_enabled')::boolean,
                                    (to_jsonb(ss) ->> 'epayco_enabled')::boolean,
                                    false
                                ),
        'sportmaps_pay_enabled', ss.sportmaps_pay_terms_accepted_at IS NOT NULL,
        -- UX
        'fee_payer',            ss.fee_payer,
        'require_payment_proof', COALESCE(ss.require_payment_proof, true)
    )
    INTO v_data
    FROM school_settings ss
    WHERE ss.school_id = p_school_id;

    RETURN v_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_payment_info(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.get_school_payment_info(uuid) IS
    'Expone datos de pago publicos para checkout (cuenta bancaria + payment_accounts + flags de gateway). Solo responde si la escuela tiene public_profile_enabled=true.';

COMMIT;

NOTIFY pgrst, 'reload schema';
