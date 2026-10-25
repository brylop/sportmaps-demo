-- =============================================================================
-- 20261024211855_wa_identify_staff_por_telefono.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261024211852
-- Objetivo: identificar por teléfono a quien trabaja en la escuela (owner,
--   admin, school_admin o coach) para la planilla de asistencia por WhatsApp.
--   wa_identify_staff_admin_by_phone solo cubre owner/admin/school_admin y NO se
--   modifica. Mismo patrón que ella (20261003195158 + 20261008164914):
--   remitente solo si es celular colombiano (wa_celular_remitente_co: 10 dígitos
--   o 57+10; fijo o extranjero no cruza), perfil con wa_normalize_phone10_co,
--   array_agg (min(uuid) no existe), dos perfiles con el mismo número = ambiguo.
-- Firma: (p_integration_id uuid, p_contact_wa_id text) -> jsonb
--   {resultado: 'staff'|'no_staff'|'ambiguo', profile_id, role, school_id}
--   La escuela sale de la integración, no se confía en un parámetro.
-- Radio: función nueva, solo lectura; no toca tablas ni funciones existentes.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito; solo service_role.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.wa_identify_staff_by_phone(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_tel       text;
    v_ids       uuid[];
    v_role      text;
BEGIN
    SELECT school_id INTO v_school_id
      FROM public.school_whatsapp_integrations
     WHERE id = p_integration_id;

    IF v_school_id IS NULL THEN
        RETURN jsonb_build_object('resultado', 'no_staff', 'motivo', 'integracion_inexistente');
    END IF;

    v_tel := public.wa_celular_remitente_co(p_contact_wa_id);
    IF v_tel IS NULL THEN
        RETURN jsonb_build_object('resultado', 'no_staff', 'motivo', 'no_es_celular',
                                  'school_id', v_school_id);
    END IF;

    SELECT array_agg(DISTINCT p.id)
      INTO v_ids
      FROM public.profiles p
      JOIN public.school_members sm ON sm.profile_id = p.id
     WHERE public.wa_normalize_phone10_co(p.phone) = v_tel
       AND sm.school_id = v_school_id
       AND sm.role IN ('owner', 'admin', 'school_admin', 'coach')
       AND sm.status = 'active';

    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
        RETURN jsonb_build_object('resultado', 'ambiguo', 'school_id', v_school_id);
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
        RETURN jsonb_build_object('resultado', 'no_staff', 'school_id', v_school_id);
    END IF;

    -- Un mismo perfil puede tener varias filas de rol en la escuela: se informa
    -- el de mayor jerarquía (owner > school_admin > admin > coach).
    SELECT (array_agg(sm.role ORDER BY CASE sm.role
                WHEN 'owner'        THEN 1
                WHEN 'school_admin' THEN 2
                WHEN 'admin'        THEN 3
                ELSE 4 END))[1]
      INTO v_role
      FROM public.school_members sm
     WHERE sm.profile_id = v_ids[1]
       AND sm.school_id  = v_school_id
       AND sm.role IN ('owner', 'admin', 'school_admin', 'coach')
       AND sm.status = 'active';

    RETURN jsonb_build_object(
        'resultado', 'staff',
        'profile_id', v_ids[1],
        'role',       v_role,
        'school_id',  v_school_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.wa_identify_staff_by_phone(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_identify_staff_by_phone(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_identify_staff_by_phone(uuid, text) TO service_role;

COMMENT ON FUNCTION public.wa_identify_staff_by_phone(uuid, text) IS
    'Identifica por telefono (celular colombiano) a un miembro activo owner/admin/school_admin/coach de la escuela de la integracion. Solo service_role.';

COMMIT;
