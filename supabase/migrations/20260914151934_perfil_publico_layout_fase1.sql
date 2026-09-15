-- =============================================================================
-- 20260914151934_perfil_publico_layout_fase1.sql
-- Autor: brylop   Fecha: 2026-09-14   Versión anterior: 20260914151925
-- Objetivo: Fase 1 de docs/specs/perfil-publico-plantillas.md — sumar el campo
--   que elige el layout del perfil público de la escuela (/s/:slug). Solo el
--   campo + su exposición en update_school_public_profile; el layout en sí
--   ('classic') es el único que existe todavía, el resto llega en fases
--   siguientes del mismo spec.
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

-- ============================================================
-- 1. Campo public_page_layout en schools
-- ============================================================
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS public_page_layout text NOT NULL DEFAULT 'classic'
  CONSTRAINT schools_public_page_layout_check
  CHECK (public_page_layout IN ('classic', 'modern', 'minimal', 'magazine'));

COMMENT ON COLUMN public.schools.public_page_layout IS
  'Layout elegido para el perfil público (/s/:slug). Ver docs/specs/perfil-publico-plantillas.md. '
  'Solo classic implementado en fase 1; modern/minimal/magazine llegan en fases siguientes.';

-- ============================================================
-- 2. update_school_public_profile — sumar p_public_page_layout
-- ============================================================
-- Sumar un parámetro cambia la firma (11 args -> 12), así que
-- CREATE OR REPLACE crearía un OVERLOAD nuevo en vez de reemplazar la
-- función — y PostgREST no puede elegir entre dos candidatos cuando lo
-- llaman con argumentos nombrados. Se DROPea la firma vieja primero.

DROP FUNCTION IF EXISTS public.update_school_public_profile(
    uuid, text, text, text, text, text, text, text, text, text, text[]
);

CREATE OR REPLACE FUNCTION public.update_school_public_profile(
    p_school_id          uuid,
    p_name               text DEFAULT NULL,
    p_description        text DEFAULT NULL,
    p_city               text DEFAULT NULL,
    p_address            text DEFAULT NULL,
    p_phone              text DEFAULT NULL,
    p_email              text DEFAULT NULL,
    p_website            text DEFAULT NULL,
    p_logo_url           text DEFAULT NULL,
    p_cover_image_url    text DEFAULT NULL,
    p_sports             text[] DEFAULT NULL,
    p_public_page_layout text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id        uuid := auth.uid();
    v_has_permission boolean;
    v_logo_prefix    text;
    v_cover_prefix   text;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    IF p_school_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_id_required');
    END IF;

    -- 2.1 Permiso: admin activo de la escuela
    SELECT EXISTS(
        SELECT 1 FROM public.school_members
         WHERE school_id = p_school_id
           AND profile_id = v_user_id
           AND role IN ('owner','super_admin','admin','school_admin')
           AND status = 'active'
    ) INTO v_has_permission;

    IF NOT v_has_permission THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;

    -- 2.2 Validacion logo_url: bucket school-assets, carpeta logos/<school_id>/
    IF p_logo_url IS NOT NULL AND p_logo_url <> '' THEN
        v_logo_prefix := '/storage/v1/object/public/school-assets/logos/' || p_school_id::text || '/';
        IF position(v_logo_prefix in p_logo_url) = 0
           AND p_logo_url NOT LIKE ('logos/' || p_school_id::text || '/%')
        THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'invalid_logo_url',
                'message', 'logo_url debe pertenecer al bucket school-assets de esta escuela.'
            );
        END IF;
    END IF;

    -- 2.3 Validacion cover_image_url: carpeta covers/<school_id>/
    IF p_cover_image_url IS NOT NULL AND p_cover_image_url <> '' THEN
        v_cover_prefix := '/storage/v1/object/public/school-assets/covers/' || p_school_id::text || '/';
        IF position(v_cover_prefix in p_cover_image_url) = 0
           AND p_cover_image_url NOT LIKE ('covers/' || p_school_id::text || '/%')
        THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'invalid_cover_image_url',
                'message', 'cover_image_url debe pertenecer al bucket school-assets de esta escuela.'
            );
        END IF;
    END IF;

    -- 2.4 Validacion public_page_layout: whitelist explícita (el CHECK de la
    --     columna ya la exige, esto solo da un error legible en vez de 23514).
    IF p_public_page_layout IS NOT NULL
       AND p_public_page_layout NOT IN ('classic', 'modern', 'minimal', 'magazine')
    THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'invalid_public_page_layout',
            'message', 'public_page_layout debe ser classic, modern, minimal o magazine.'
        );
    END IF;

    -- 2.5 Flag de sesion (local) para pasar el trigger enforce_branding_via_rpc
    --     al actualizar logo_url. Vive solo dentro de esta transaccion.
    PERFORM set_config('app.branding_via_rpc', 'true', true);

    -- 2.6 UPDATE. COALESCE: solo pisa lo que se provee (NULL = sin cambio).
    --     Para logo/cover, '' (string vacio) significa "limpiar" => NULL.
    UPDATE public.schools
       SET name                 = COALESCE(p_name, name),
           description          = COALESCE(p_description, description),
           city                 = COALESCE(p_city, city),
           address              = COALESCE(p_address, address),
           phone                = COALESCE(p_phone, phone),
           email                = COALESCE(p_email, email),
           website              = COALESCE(p_website, website),
           logo_url             = CASE WHEN p_logo_url IS NULL THEN logo_url
                                        WHEN p_logo_url = '' THEN NULL
                                        ELSE p_logo_url END,
           cover_image_url      = CASE WHEN p_cover_image_url IS NULL THEN cover_image_url
                                        WHEN p_cover_image_url = '' THEN NULL
                                        ELSE p_cover_image_url END,
           sports               = COALESCE(p_sports, sports),
           public_page_layout   = COALESCE(p_public_page_layout, public_page_layout),
           updated_at           = now()
     WHERE id = p_school_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_not_found');
    END IF;

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_school_public_profile(uuid, text, text, text, text, text, text, text, text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_school_public_profile(uuid, text, text, text, text, text, text, text, text, text, text[], text) TO authenticated, service_role;

COMMENT ON FUNCTION public.update_school_public_profile IS
    'Guardado del perfil público de la escuela (textos + logo + portada + layout). '
    'Control de permisos por school_members (admin activo). Valida que '
    'logo_url/cover_image_url pertenezcan al bucket school-assets de la '
    'escuela y que public_page_layout sea uno de los layouts soportados. '
    'NO valida tier ni toca branding_settings (colores): eso es '
    'exclusivo de update_school_branding. Setea app.branding_via_rpc para '
    'pasar el trigger enforce_branding_via_rpc al cambiar logo_url.';

NOTIFY pgrst, 'reload schema';

COMMIT;
