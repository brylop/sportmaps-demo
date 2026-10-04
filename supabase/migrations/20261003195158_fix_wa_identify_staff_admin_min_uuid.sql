-- =============================================================================
-- 20261003195158_fix_wa_identify_staff_admin_min_uuid.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003193624
-- Objetivo: wa_identify_staff_admin_by_phone revienta con CUALQUIER celular
--           válido: usa min(p.id) sobre uuid, y min(uuid) no existe en
--           PostgreSQL (ERROR 42883).
-- =============================================================================
-- Verificado contra la base viva el 2026-10-03:
--
--   select wa_identify_staff_admin_by_phone('<escuela>', '573001234567');
--   → ERROR 42883: function min(uuid) does not exist
--
-- plpgsql no resuelve las funciones del cuerpo hasta ejecutar la línea, así que
-- 20260917133748 se aplicó sin error y la función nunca respondió. Es el MISMO
-- bug que ya se había corregido en wa_identify_by_phone (ver memoria del bot:
-- «min(uuid) no existe»), copiado a la función nueva.
--
-- Consecuencia: la rama staff-admin del worker de comprobantes (alta de atleta
-- por foto de la hoja de matrícula, desde el WhatsApp del admin) nunca se
-- activó por WhatsApp, y el clasificador de atención nunca devolvió 'staff'.
--
-- Fix: array_agg(DISTINCT …), igual que wa_identify_by_phone. Misma firma, mismo
-- contrato de salida, mismos grants.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.wa_identify_staff_admin_by_phone(
    p_school_id uuid,
    p_wa_phone_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_tel  text;
    v_ids  uuid[];
BEGIN
    v_tel := public.wa_normalize_phone10_co(p_wa_phone_number);
    IF v_tel IS NULL THEN
        RETURN jsonb_build_object('estado', 'no_es_staff_admin', 'motivo', 'no_es_celular');
    END IF;

    -- Mismo criterio que is_school_admin(): school_members activo, rol
    -- owner/admin/school_admin.
    SELECT array_agg(DISTINCT p.id)
      INTO v_ids
    FROM public.profiles p
    JOIN public.school_members sm ON sm.profile_id = p.id
    WHERE public.wa_normalize_phone10_co(p.phone) = v_tel
      AND sm.school_id = p_school_id
      AND sm.role IN ('owner', 'admin', 'school_admin')
      AND sm.status = 'active';

    -- Dos cuentas con el mismo número no se desempatan solas.
    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
        RETURN jsonb_build_object('estado', 'ambiguo');
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
        RETURN jsonb_build_object('estado', 'identificado', 'profile_id', v_ids[1]);
    END IF;

    RETURN jsonb_build_object('estado', 'no_es_staff_admin');
END;
$function$;

REVOKE ALL ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) TO service_role;

COMMIT;
