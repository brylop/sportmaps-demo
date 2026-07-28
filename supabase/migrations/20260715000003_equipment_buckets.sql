-- ============================================================
-- SPORTMAPS — Módulo de Dotación · Fase 1 (Storage)
--
-- Dos destinos, ambos PRIVADOS con RLS por owner (patrón del bucket certificates):
--   1. equipment-photos → fotos de checkout y devolución. Ruta:
--        {school_id}/{assignment_id}/{tipo}-{timestamp}.jpg
--   2. certificates (reuso) con prefijo dotacion/ → PDF de actas. Ruta:
--        dotacion/{school_id}/{assignment_id}.pdf
--
-- Los buckets públicos están bloqueados en el repo — todo va privado.
-- ============================================================

-- ─── 1. Bucket de fotos ────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('equipment-photos', 'equipment-photos', false, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Lectura: super-admin, admin de la escuela (del path), o coach activo de esa escuela.
-- El school_id es el primer segmento de la ruta; se valida forma UUID antes de castear.
DROP POLICY IF EXISTS "equipment_photos_read" ON storage.objects;
CREATE POLICY "equipment_photos_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'equipment-photos'
        AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND (
            public.is_super_admin()
            OR public.is_school_admin(((storage.foldername(name))[1])::uuid)
            OR EXISTS (
                SELECT 1 FROM public.school_members sm
                WHERE sm.school_id = ((storage.foldername(name))[1])::uuid
                  AND sm.profile_id = auth.uid()
                  AND sm.role = 'coach'
                  AND sm.status = 'active'
            )
        )
    );

-- Escritura: cualquier miembro ACTIVO de la escuela del path (coach que sube su
-- foto, o admin). El service role (BFF) bypassea igual.
DROP POLICY IF EXISTS "equipment_photos_write" ON storage.objects;
CREATE POLICY "equipment_photos_write"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'equipment-photos'
        AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = ((storage.foldername(name))[1])::uuid
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
        )
    );

-- ─── 2. Actas en el bucket certificates (prefijo dotacion/) ───────────────────
-- Reusa el bucket privado existente. Lectura: admin / super-admin / coach dueño.
-- La escritura la hace el BFF con service role (y la policy de escritura de
-- certificates ya cubre a owner/admin), por lo que no se agrega write aquí.
DROP POLICY IF EXISTS "certificates_read_dotacion_actas" ON storage.objects;
CREATE POLICY "certificates_read_dotacion_actas"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'certificates'
        AND name LIKE 'dotacion/%'
        AND EXISTS (
            SELECT 1 FROM public.equipment_assignments ea
            WHERE ea.acta_pdf_url = storage.objects.name
              AND (
                  public.is_super_admin()
                  OR public.is_school_admin(ea.school_id)
                  OR ea.assigned_to = auth.uid()
              )
        )
    );
