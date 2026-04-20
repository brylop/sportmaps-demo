-- =========================================================================
-- FIX: Crear enrollments para los 102 atletas cargados
-- Esto sincroniza el contador de "Inscribir" con el del card del equipo
-- =========================================================================

-- Inserta un enrollment activo por cada atleta demo en los equipos de Fontibon
INSERT INTO public.enrollments (school_id, child_id, team_id, status, start_date)
SELECT
    c.school_id,
    c.id AS child_id,
    c.team_id,
    'active'::enroll_status,
    CURRENT_DATE
FROM public.children c
WHERE c.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND c.is_demo = true
  AND c.team_id IN (
      '11111111-1111-1111-1111-000000000001',
      '11111111-1111-1111-1111-000000000002',
      '11111111-1111-1111-1111-000000000003',
      '11111111-1111-1111-1111-000000000004',
      '11111111-1111-1111-1111-000000000005',
      '11111111-1111-1111-1111-000000000006'
  )
  -- Evitar duplicados si ya existe un enrollment para este child+team
  AND NOT EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.child_id = c.id
        AND e.team_id = c.team_id
        AND e.status = 'active'
  );

-- ========================================
-- VERIFICACION: enrollments por equipo
-- ========================================
SELECT t.name AS team, COUNT(e.id) AS enrollments_activos
FROM public.teams t
LEFT JOIN public.enrollments e ON e.team_id = t.id AND e.status = 'active'
WHERE t.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND t.is_demo = true
  AND t.name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
GROUP BY t.name
ORDER BY t.name;

-- Total
SELECT 'total_enrollments' AS tipo, COUNT(*) AS total
FROM public.enrollments
WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND status = 'active'
  AND child_id IS NOT NULL;
