-- ============================================================================
-- Verificación del piloto (1 equipo + 1 atleta) — Monster's Volley Club, Sede Suba.
-- Pegar en el SQL Editor de Supabase o correr con psql. Solo SELECT, no escribe nada.
-- ============================================================================

-- 1. El equipo
SELECT id, name, sport, age_group, branch_id, active
FROM public.teams
WHERE id = 'b45bd5cb-1ac5-457c-bb4e-129477f99108';

-- 2. El atleta (datos personales, salud, contacto del acudiente)
SELECT id, full_name, doc_type, doc_number, date_of_birth, email, phone,
       blood_type, eps_name, guardian_phone, guardian_email,
       health_screening, intake_form_data, branch_id, is_active, created_at
FROM public.unregistered_athletes
WHERE id = 'dc5ec4e3-eebb-4546-b6f1-90df9007020b';

-- 3. La inscripción (atleta <-> equipo)
SELECT id, school_id, unregistered_athlete_id, team_id, status, start_date
FROM public.enrollments
WHERE id = 'b0479f6c-da14-4601-8899-3121be537588';

-- 4. Los 7 documentos cargados
SELECT document_type, storage_path, uploaded_at, verified
FROM public.athlete_documents
WHERE unregistered_athlete_id = 'dc5ec4e3-eebb-4546-b6f1-90df9007020b'
ORDER BY document_type;

-- 5. Todo junto, una fila por documento (para copiar/pegar rápido)
SELECT
  ua.full_name,
  t.name  AS equipo,
  e.status AS estado_inscripcion,
  ad.document_type,
  ad.storage_path
FROM public.unregistered_athletes ua
JOIN public.enrollments e ON e.unregistered_athlete_id = ua.id
JOIN public.teams t        ON t.id = e.team_id
LEFT JOIN public.athlete_documents ad ON ad.unregistered_athlete_id = ua.id
WHERE ua.id = 'dc5ec4e3-eebb-4546-b6f1-90df9007020b'
ORDER BY ad.document_type;
