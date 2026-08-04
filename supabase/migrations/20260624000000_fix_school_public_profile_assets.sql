-- ============================================================
-- SPORTMAPS — Fix editor de perfil público de escuela
--
-- Corrige DOS bugs que dejaban inutilizable el editor de perfil
-- público (frontend/src/pages/school/SchoolPublicProfilePage.tsx):
--
-- BUG 1 — Subida de PORTADA bloqueada por RLS de storage.
--   El editor sube portadas a covers/{school_id}/... pero la policy
--   school_assets_admin_insert (migracion 20260307000001) fija
--   (storage.foldername(name))[1] = 'logos', asi que cualquier
--   upload a covers/ falla con
--     "new row violates row-level security policy".
--   FIX: recrear las policies INSERT/UPDATE/DELETE de school-assets
--   para aceptar foldername[1] IN ('logos','covers') bajo la carpeta
--   de la propia escuela.
--
-- BUG 2 — Guardar el perfil devuelve 403.
--   handleSave hace un UPDATE directo a public.schools que incluye
--   logo_url. El trigger enforce_branding_via_rpc (migracion
--   20260528000002) lanza 42501 al detectar cambio de logo_url fuera
--   de la RPC de branding => 403, y se cae TODO el update (ni textos
--   ni portada se guardan).
--   DECISION DE PRODUCTO: el logo/portada del PERFIL PÚBLICO es
--   identidad básica de la escuela, NO el white-label premium
--   (colores + watermark + dominio, que siguen gateados a Pro+ y
--   auditados via update_school_branding). Por eso se separa en una
--   RPC propia, sin gate de tier, con control de permisos por
--   school_members, que setea el flag de sesion para pasar el trigger.
--   branding_settings (colores) NO se toca aqui — sigue exclusivo de
--   update_school_branding.
--
-- Politica de la casa: search_path = pg_catalog, public, pg_temp en
-- TODA funcion nueva. Migraciones inmutables (fix en archivo nuevo).
-- ============================================================

BEGIN;


-- ============================================================
-- 1. Storage: permitir carpeta covers/ además de logos/
-- ============================================================
--
-- Ruta esperada para ambos: <kind>/<school_id>/<filename>
-- donde kind ∈ {logos, covers}. foldername[2] debe ser una escuela
-- de la que el caller es admin activo.

DROP POLICY IF EXISTS "school_assets_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_admin_delete" ON storage.objects;

CREATE POLICY "school_assets_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-assets'
  AND (storage.foldername(name))[1] IN ('logos', 'covers')
  AND (storage.foldername(name))[2] IN (
    SELECT school_id::text
    FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin', 'school_admin')
      AND status = 'active'
  )
);

CREATE POLICY "school_assets_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'school-assets'
  AND (storage.foldername(name))[1] IN ('logos', 'covers')
  AND (storage.foldername(name))[2] IN (
    SELECT school_id::text
    FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin', 'school_admin')
      AND status = 'active'
  )
);

CREATE POLICY "school_assets_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'school-assets'
  AND (storage.foldername(name))[1] IN ('logos', 'covers')
  AND (storage.foldername(name))[2] IN (
    SELECT school_id::text
    FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin', 'school_admin')
      AND status = 'active'
  )
);


-- ============================================================
-- 2. RPC update_school_public_profile — punto único de guardado
--    del perfil público (reemplaza el UPDATE directo del cliente)
-- ============================================================
--
-- Aplica:
--   - Auth check (auth.uid())
--   - Permiso: caller debe ser admin activo de la escuela
--   - Validacion logo_url  ∈ logos/{school_id}/...  (o NULL)
--   - Validacion cover_url ∈ covers/{school_id}/... (o NULL)
--     (anti-arbitrary-URL / anti-SSRF, igual que update_school_branding)
--   - Setea app.branding_via_rpc=true (local) para que el trigger
--     enforce_branding_via_rpc deje pasar el cambio de logo_url.
--
-- NO valida tier ni toca branding_settings (colores): eso es
-- exclusivo de update_school_branding. Aqui el logo es identidad
-- básica, disponible para cualquier escuela.

CREATE OR REPLACE FUNCTION public.update_school_public_profile(
    p_school_id        uuid,
    p_name             text DEFAULT NULL,
    p_description      text DEFAULT NULL,
    p_city             text DEFAULT NULL,
    p_address          text DEFAULT NULL,
    p_phone            text DEFAULT NULL,
    p_email            text DEFAULT NULL,
    p_website          text DEFAULT NULL,
    p_logo_url         text DEFAULT NULL,
    p_cover_image_url  text DEFAULT NULL,
    p_sports           text[] DEFAULT NULL
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

    -- 2.4 Flag de sesion (local) para pasar el trigger enforce_branding_via_rpc
    --     al actualizar logo_url. Vive solo dentro de esta transaccion.
    PERFORM set_config('app.branding_via_rpc', 'true', true);

    -- 2.5 UPDATE. COALESCE: solo pisa lo que se provee (NULL = sin cambio).
    --     Para logo/cover, '' (string vacio) significa "limpiar" => NULL.
    UPDATE public.schools
       SET name            = COALESCE(p_name, name),
           description     = COALESCE(p_description, description),
           city            = COALESCE(p_city, city),
           address         = COALESCE(p_address, address),
           phone           = COALESCE(p_phone, phone),
           email           = COALESCE(p_email, email),
           website         = COALESCE(p_website, website),
           logo_url        = CASE WHEN p_logo_url IS NULL THEN logo_url
                                  WHEN p_logo_url = '' THEN NULL
                                  ELSE p_logo_url END,
           cover_image_url = CASE WHEN p_cover_image_url IS NULL THEN cover_image_url
                                  WHEN p_cover_image_url = '' THEN NULL
                                  ELSE p_cover_image_url END,
           sports          = COALESCE(p_sports, sports),
           updated_at      = now()
     WHERE id = p_school_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'school_not_found');
    END IF;

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_school_public_profile(uuid, text, text, text, text, text, text, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_school_public_profile(uuid, text, text, text, text, text, text, text, text, text, text[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.update_school_public_profile IS
    'Guardado del perfil público de la escuela (textos + logo + portada). '
    'Control de permisos por school_members (admin activo). Valida que '
    'logo_url/cover_image_url pertenezcan al bucket school-assets de la '
    'escuela. NO valida tier ni toca branding_settings (colores): eso es '
    'exclusivo de update_school_branding. Setea app.branding_via_rpc para '
    'pasar el trigger enforce_branding_via_rpc al cambiar logo_url.';


-- ============================================================
-- 3. Refresh schema cache (para exponer la RPC en PostgREST)
-- ============================================================
NOTIFY pgrst, 'reload schema';


COMMIT;
