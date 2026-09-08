-- =============================================================================
-- 20260908102447_admin_set_payer_billing_details.sql
-- Autor: brylop   Fecha: 2026-09-08   Versión anterior: 20260905135210
-- Objetivo: RPC para que un admin/staff de escuela cargue los datos fiscales
--   (DIAN) del PAGADOR (padre o atleta adulto) cuando registra un pago manual
--   (efectivo/transferencia) desde RegisterCashPaymentModal, sin depender de
--   que ese padre haya pasado antes por el checkout online. La única policy
--   UPDATE de public.profiles es "auth.uid() = id" (self-only) — un admin NO
--   puede escribir en profiles.document_number de otro usuario directo desde
--   el cliente, de ahí la RPC SECURITY DEFINER con su propio guard de alcance
--   (el pagador debe pertenecer a la escuela del caller: padre de un atleta
--   suyo, o el atleta adulto mismo). Reusa las mismas columnas que ya llena
--   BillingDetailsForm.tsx en el checkout del padre (mismo shape).
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

CREATE OR REPLACE FUNCTION public.admin_set_payer_billing_details(
    p_school_id          uuid,
    p_user_id            uuid,
    p_document_type      text,
    p_document_number    text,
    p_billing_address    text,
    p_billing_state_dane text,
    p_billing_city_dane  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public.is_school_admin(p_school_id) THEN
        RAISE EXCEPTION 'solo un admin de la escuela puede cargar datos de facturacion del pagador'
            USING ERRCODE = '42501';
    END IF;

    IF p_document_type NOT IN ('CC','CE','NIT','PASAPORTE','TI','RC') THEN
        RAISE EXCEPTION 'tipo de documento invalido: %', p_document_type;
    END IF;

    -- Alcance: el pagador debe ser padre de un atleta de ESTA escuela, o el
    -- atleta adulto mismo — nunca un perfil ajeno a la escuela del caller.
    IF NOT EXISTS (
        SELECT 1 FROM public.school_athletes sa
         WHERE sa.school_id = p_school_id
           AND (sa.parent_id = p_user_id
                OR (sa.id = p_user_id AND sa.athlete_type = 'adult'))
    ) THEN
        RAISE EXCEPTION 'el usuario no es padre ni atleta adulto de esta escuela'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.profiles
       SET document_type      = p_document_type,
           document_number    = p_document_number,
           billing_address    = p_billing_address,
           billing_state_dane = p_billing_state_dane,
           billing_city_dane  = p_billing_city_dane
     WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.admin_set_payer_billing_details(uuid, uuid, text, text, text, text, text) IS
    'Carga datos fiscales DIAN del pagador (padre o atleta adulto) para facturacion electronica, desde el registro manual de pagos. SECURITY DEFINER: la unica policy UPDATE de profiles es self-only.';

REVOKE ALL ON FUNCTION public.admin_set_payer_billing_details(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_payer_billing_details(uuid, uuid, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_payer_billing_details(uuid, uuid, text, text, text, text, text) TO authenticated;

COMMIT;
