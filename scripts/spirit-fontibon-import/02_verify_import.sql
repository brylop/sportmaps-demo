-- =========================================================================
-- VERIFICACION POST-CARGA
-- Corre despues de 01_create para validar que todo quedo bien.
-- =========================================================================

-- 1. Equipos demo cargados
SELECT 'equipos' AS tipo, name, age_group, is_demo, created_at
FROM public.teams
WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND is_demo = true
  AND name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
ORDER BY name;

-- 2. Atletas por equipo
SELECT 'conteo' AS tipo, t.name AS team, COUNT(c.id) AS atletas
FROM public.teams t
LEFT JOIN public.children c ON c.team_id = t.id AND c.is_demo = true
WHERE t.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND t.is_demo = true
  AND t.name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
GROUP BY t.name
ORDER BY t.name;

-- 3. Atletas pendientes de completar info
SELECT 'pendientes' AS tipo, c.full_name, t.name AS team, c.medical_info
FROM public.children c
JOIN public.teams t ON t.id = c.team_id
WHERE c.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND (c.medical_info LIKE '%PENDIENTE%' OR c.medical_info LIKE '%PLACEHOLDER%');

-- 4. Resumen total
SELECT 'resumen' AS tipo,
    (SELECT COUNT(*) FROM public.teams WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND is_demo = true AND name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')) AS equipos,
    (SELECT COUNT(*) FROM public.children WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND is_demo = true AND team_id IN (SELECT id FROM public.teams WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND is_demo = true AND name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS'))) AS atletas;
