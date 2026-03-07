-- supabase/migrations/20260307000001_branding_settings.sql

-- ─────────────────────────────────────────────────────────────
-- 1. COLUMNA branding_settings en tabla schools
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.schools
ADD COLUMN IF NOT EXISTS branding_settings JSONB NOT NULL DEFAULT '{
  "primary_color": "#0ea5e9",
  "secondary_color": "#64748b",
  "show_sportmaps_watermark": true
}'::jsonb;

-- Validación: garantiza que siempre existan las 3 keys mínimas (Dropped to recreate if exists)
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS valid_branding_settings;

ALTER TABLE public.schools
ADD CONSTRAINT valid_branding_settings CHECK (
  branding_settings ? 'primary_color' AND
  branding_settings ? 'secondary_color' AND
  branding_settings ? 'show_sportmaps_watermark'
);

-- Índice GIN para consultas futuras sobre el JSONB
CREATE INDEX IF NOT EXISTS idx_schools_branding
ON public.schools USING gin(branding_settings);

-- ─────────────────────────────────────────────────────────────
-- 2. BUCKET de Storage para logos y assets de escuelas
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-assets',
  'school-assets',
  true,
  2097152, -- 2MB máximo por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. RLS POLICIES para Storage
-- ─────────────────────────────────────────────────────────────

-- Para que sea idempotente, primero borramos las posibles politicas previas
DROP POLICY IF EXISTS "school_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_admin_delete" ON storage.objects;

-- Lectura pública (logos son assets públicos)
CREATE POLICY "school_assets_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'school-assets');

-- Solo el admin de la escuela puede subir su logo
-- La ruta debe ser: logos/{school_id}/{filename}
CREATE POLICY "school_assets_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] IN (
    SELECT school_id::text
    FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin', 'school_admin')
      AND status = 'active'
  )
);

-- Solo el admin puede actualizar (reemplazar) su logo
CREATE POLICY "school_assets_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'school-assets'
  AND (storage.foldername(name))[2] IN (
    SELECT school_id::text
    FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin', 'school_admin')
      AND status = 'active'
  )
);

-- Solo el admin puede borrar su logo
CREATE POLICY "school_assets_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'school-assets'
  AND (storage.foldername(name))[2] IN (
    SELECT school_id::text
    FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin', 'school_admin')
      AND status = 'active'
  )
);

-- ─────────────────────────────────────────────────────────────
-- 4. RLS en tabla schools para UPDATE de branding_settings
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "school_admin_update_branding" ON public.schools;

-- Política específica para que el admin pueda actualizar
-- branding_settings y logo_url en su escuela
CREATE POLICY "school_admin_update_branding"
ON public.schools FOR UPDATE TO authenticated
USING (
  id IN (
    SELECT school_id
    FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin', 'school_admin')
      AND status = 'active'
  )
)
WITH CHECK (
  id IN (
    SELECT school_id
    FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'super_admin', 'admin', 'school_admin')
      AND status = 'active'
  )
);

-- ─────────────────────────────────────────────────────────────
-- 5. FUNCIÓN helper para leer branding de una escuela por token
--    (usada en useInvitationBranding — sin sesión activa)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_school_branding_by_invitation(
  p_token TEXT
)
RETURNS TABLE (
  school_name  TEXT,
  logo_url     TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  show_sportmaps_watermark BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.name,
    s.logo_url,
    s.branding_settings->>'primary_color',
    s.branding_settings->>'secondary_color',
    (s.branding_settings->>'show_sportmaps_watermark')::boolean
  FROM public.invitations i
  JOIN public.schools s ON s.id = i.school_id
  WHERE i.token = p_token
    AND i.status = 'pending'
  LIMIT 1;
$$;

-- Acceso público a esta función (el usuario no tiene sesión aún)
GRANT EXECUTE ON FUNCTION public.get_school_branding_by_invitation(TEXT)
TO anon, authenticated;
