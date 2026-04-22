-- Migration: 20260422000005_school_payment_info_rpc.sql
-- Description: Expone los datos de pago de una escuela (bancarios + sportmaps
-- pay) a visitantes autenticados sin romper la RLS "staff only" de
-- school_settings. Retorna solo columnas publicas-para-checkout, nunca
-- cuotas/reglas internas (payment_cutoff_day, grace_days, fees, etc).

CREATE OR REPLACE FUNCTION public.get_school_payment_info(
    p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
        -- Manual: transferencia / nequi / daviplata
        'bank_name',            ss.bank_name,
        'bank_account_type',    ss.bank_account_type,
        'bank_account_number',  ss.bank_account_number,
        'nequi_number',         ss.nequi_number,
        'daviplata_number',     ss.daviplata_number,
        'bank_titular_name',    ss.bank_titular_name,
        'bank_titular_id',      ss.bank_titular_id,
        'payment_qr_url',       ss.payment_qr_url,
        -- Gateways online
        'epayco_enabled',       COALESCE(ss.epayco_enabled, false),
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
    'Expone datos de pago publicos para checkout (bancarios + flags de gateway). Solo responde si la escuela tiene public_profile_enabled=true.';
