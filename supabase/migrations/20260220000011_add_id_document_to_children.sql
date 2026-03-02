-- Migración para añadir soporte de documento de identidad en PDF
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS id_document_url text;

-- Asegurar que el bucket para documentos existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-documents', 'identity-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para el bucket identity-documents
-- Permitir lectura pública de los documentos
CREATE POLICY "Public Document Read"
ON storage.objects FOR SELECT
USING (bucket_id = 'identity-documents');

-- Permitir a los padres subir sus documentos
CREATE POLICY "Parents Upload Documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Permitir a los padres eliminar sus documentos
CREATE POLICY "Parents Delete Documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'identity-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
