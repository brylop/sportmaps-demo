-- Fix: Corregir políticas RLS del bucket identity-documents
-- El path de upload es: children/{userId}/docs/{filename}
-- foldername() retorna ['children', '{userId}', 'docs']
-- La política anterior verificaba [1] = 'children', no el userId

-- Eliminar políticas anteriores incorrectas (si existen)
DROP POLICY IF EXISTS "Parents Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Parents Delete Documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Document Read" ON storage.objects;

-- Asegurar que el bucket existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-documents', 'identity-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir lectura pública
CREATE POLICY "identity_docs_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'identity-documents');

-- Permitir a usuarios autenticados subir documentos en su carpeta
-- Path: children/{auth.uid()}/docs/{filename}
-- foldername() index: [1]=children, [2]={userId}, [3]=docs
CREATE POLICY "identity_docs_authenticated_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Permitir a usuarios autenticados eliminar sus documentos
CREATE POLICY "identity_docs_authenticated_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'identity-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Permitir a usuarios autenticados actualizar sus documentos
CREATE POLICY "identity_docs_authenticated_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'identity-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Reload schema cache
NOTIFY pgrst, 'reload config';
