-- ============================================================================
-- Rollback del piloto de Monster's Volley Club (1 equipo + 1 atleta: Alan
-- Gabriel Cordoba Castillo, doc 1031847289).
--
-- Borra en orden inverso al alta: documentos -> enrollment -> atleta -> team
-- (el team solo si queda sin nadie más adentro). NO borra los archivos del
-- bucket identity-documents — Storage no se toca desde SQL; si hace falta
-- borrarlos también, usar el endpoint de Storage con el service role sobre
-- cada storage_path que devuelva el SELECT de abajo antes de correr esto.
--
-- Correr paso por paso, no todo de un tirón, y revisar el conteo entre pasos.
-- ============================================================================

-- 0. Verificación previa — anotar los storage_path si se van a borrar del bucket también
SELECT document_type, storage_path
FROM public.athlete_documents
WHERE unregistered_athlete_id = 'dc5ec4e3-eebb-4546-b6f1-90df9007020b';

-- 1. Documentos (metadata; el archivo en Storage queda huérfano salvo borrado manual)
DELETE FROM public.athlete_documents
WHERE unregistered_athlete_id = 'dc5ec4e3-eebb-4546-b6f1-90df9007020b';

-- 2. Enrollment
DELETE FROM public.enrollments
WHERE id = 'b0479f6c-da14-4601-8899-3121be537588';

-- 3. Atleta
DELETE FROM public.unregistered_athletes
WHERE id = 'dc5ec4e3-eebb-4546-b6f1-90df9007020b';

-- 4. Team — solo si no quedó nadie más inscrito (verificar antes de borrar)
SELECT count(*) AS atletas_restantes
FROM public.enrollments
WHERE team_id = 'b45bd5cb-1ac5-457c-bb4e-129477f99108';

-- Si el conteo de arriba da 0:
-- DELETE FROM public.teams WHERE id = 'b45bd5cb-1ac5-457c-bb4e-129477f99108';
