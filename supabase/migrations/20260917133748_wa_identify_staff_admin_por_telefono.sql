-- =============================================================================
-- 20260917133748_wa_identify_staff_admin_por_telefono.sql
-- Autor: brylop   Fecha: 2026-09-17   Versión anterior: 20260917131343
-- Objetivo: fase 3 de docs/specs/alta-atleta-por-foto-hoja-matricula.md — el
--   worker de WhatsApp necesita distinguir "esta foto la mandó un admin de la
--   escuela" ANTES del gate de identificación de acudiente (§4.2 del plan).
--   `wa_identify_by_phone` (20260916163755) resuelve la identidad de
--   ACUDIENTE por teléfono; esto resuelve la identidad de ADMIN por teléfono,
--   contra `school_members` (mismo criterio que usa `is_school_admin()`, no
--   la tabla `school_staff` que es solo un directorio de coaches sin rol).
--
--   Se extrae la normalización del teléfono (últimos 10 dígitos, celular
--   colombiano) a una función compartida, para no repetirla una tercera vez
--   — 20260916163755 queda intacta (inmutable), pero se REDEFINE
--   `wa_identify_by_phone` (CREATE OR REPLACE sobre el objeto vivo, no sobre
--   el archivo de esa migración) para que use el mismo helper. Mismo
--   comportamiento, una sola fuente de la regex.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

-- ── Helper compartido ─────────────────────────────────────────────────────
-- Devuelve los últimos 10 dígitos si parecen un celular colombiano (empieza
-- en 3), o NULL si no. Un fijo de Bogotá también tiene 10 dígitos pero no
-- arranca en 3 — no se cruza (mismo comentario que 20260916163755).
CREATE OR REPLACE FUNCTION public.wa_normalize_phone10_co(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT CASE
        WHEN right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10) ~ '^3[0-9]{9}$'
        THEN right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10)
        ELSE NULL
    END;
$function$;

REVOKE ALL ON FUNCTION public.wa_normalize_phone10_co(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_normalize_phone10_co(text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_normalize_phone10_co(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_normalize_phone10_co(text) TO service_role;

COMMENT ON FUNCTION public.wa_normalize_phone10_co(text) IS
    'Últimos 10 dígitos si parecen celular colombiano (^3[0-9]{9}$), NULL si no. '
    'Fuente única de esta regex — usada por wa_identify_by_phone y wa_identify_staff_admin_by_phone.';

-- ── Redefinir wa_identify_by_phone para usar el helper ─────────────────────
-- Mismo comportamiento exacto que la versión de 20260916163755: se cambia
-- SOLO la normalización del teléfono, no la lógica de negocio.
CREATE OR REPLACE FUNCTION public.wa_identify_by_phone(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_school_id  uuid;
    v_tel        text;
    v_parent_id  uuid;
    v_cuantos    int;
    v_es_familia boolean;
BEGIN
    SELECT school_id INTO v_school_id
    FROM public.school_whatsapp_integrations
    WHERE id = p_integration_id;

    IF v_school_id IS NULL THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'integracion_inexistente');
    END IF;

    v_tel := public.wa_normalize_phone10_co(p_contact_wa_id);
    IF v_tel IS NULL THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'no_es_celular');
    END IF;

    SELECT count(DISTINCT p.id), min(p.id)
      INTO v_cuantos, v_parent_id
    FROM public.profiles p
    WHERE public.wa_normalize_phone10_co(p.phone) = v_tel
      AND EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.parent_id = p.id
              AND c.school_id = v_school_id
              AND c.is_active
      );

    IF v_cuantos > 1 THEN
        RETURN jsonb_build_object('estado', 'ambiguo', 'motivo', 'varias_cuentas_mismo_numero');
    END IF;

    IF v_cuantos = 1 THEN
        UPDATE public.whatsapp_conversations
           SET parent_id  = v_parent_id,
               identified = true,
               updated_at = now()
         WHERE integration_id = p_integration_id
           AND contact_wa_id  = p_contact_wa_id;

        INSERT INTO public.whatsapp_identifications (
            integration_id, contact_wa_id, parent_id, email,
            otp_hash, otp_expires_at, attempts, verified_at, updated_at
        ) VALUES (
            p_integration_id, p_contact_wa_id, v_parent_id, NULL,
            NULL, NULL, 0, now(), now()
        )
        ON CONFLICT (integration_id, contact_wa_id) DO UPDATE SET
            parent_id   = EXCLUDED.parent_id,
            verified_at = now(),
            updated_at  = now();

        RETURN jsonb_build_object('estado', 'identificado', 'parent_id', v_parent_id);
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.school_id = v_school_id
          AND c.is_active
          AND public.wa_normalize_phone10_co(c.parent_phone_temp) = v_tel
    ) INTO v_es_familia;

    IF v_es_familia THEN
        RETURN jsonb_build_object('estado', 'debe_registrarse');
    END IF;

    RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'sin_coincidencia');
END;
$function$;

-- ── La función nueva: identidad de ADMIN por teléfono ──────────────────────
-- Acotada a UNA escuela (p_school_id), a diferencia de wa_identify_by_phone
-- que resuelve la escuela desde la integración — acá el llamador ya sabe en
-- qué escuela está la fila de la cola.
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
    v_tel        text;
    v_cuantos    int;
    v_profile_id uuid;
BEGIN
    v_tel := public.wa_normalize_phone10_co(p_wa_phone_number);
    IF v_tel IS NULL THEN
        RETURN jsonb_build_object('estado', 'no_es_staff_admin', 'motivo', 'no_es_celular');
    END IF;

    -- Mismo criterio que is_school_admin(): school_members activo, rol
    -- owner/admin/school_admin. NO se usa school_staff (directorio de
    -- coaches sin permisos, no es la fuente de autorización).
    SELECT count(DISTINCT p.id), min(p.id)
      INTO v_cuantos, v_profile_id
    FROM public.profiles p
    JOIN public.school_members sm ON sm.profile_id = p.id
    WHERE public.wa_normalize_phone10_co(p.phone) = v_tel
      AND sm.school_id = p_school_id
      AND sm.role IN ('owner', 'admin', 'school_admin')
      AND sm.status = 'active';

    -- Mismo criterio que wa_identify_by_phone: dos cuentas con el mismo
    -- número no se desempatan solas.
    IF v_cuantos > 1 THEN
        RETURN jsonb_build_object('estado', 'ambiguo');
    END IF;

    IF v_cuantos = 1 THEN
        RETURN jsonb_build_object('estado', 'identificado', 'profile_id', v_profile_id);
    END IF;

    RETURN jsonb_build_object('estado', 'no_es_staff_admin');
END;
$function$;

REVOKE ALL ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) TO service_role;

COMMENT ON FUNCTION public.wa_identify_staff_admin_by_phone(uuid, text) IS
    'Identifica si quien escribe por WhatsApp es owner/admin/school_admin activo de '
    'p_school_id, por los últimos 10 dígitos de profiles.phone. Se corre ANTES del '
    'gate de identificación de acudiente (ver alta-atleta-por-foto-hoja-matricula.md §4.2) '
    'para que un admin no tenga que estar identificado como padre para mandar una '
    'foto de matrícula. Devuelve identificado | ambiguo | no_es_staff_admin.';

COMMIT;

NOTIFY pgrst, 'reload schema';
