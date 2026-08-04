-- ============================================================
-- SPORTMAPS — Linter Fase 1b ronda 2
-- Cierra el warning de public_bucket_allows_listing en el bucket
-- product-images, creado en 20260512000009_product_images_bucket.
--
-- La policy "product_images_public_read" hace
--     USING (bucket_id = 'product-images')
-- sin filtro, lo que permite a anon hacer LIST de todos los
-- objetos del bucket. El frontend solo necesita download por
-- URL publica (getPublicUrl en ProductGalleryUploader.tsx L77),
-- no LIST.
--
-- En Supabase, public=true ya permite el download por CDN sin
-- necesidad de policy SELECT. Entonces dropear la policy cierra
-- el LIST sin romper la visualizacion.
-- ============================================================

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;


-- Refresh schema cache.
NOTIFY pgrst, 'reload config';
