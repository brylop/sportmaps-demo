-- =========================================================================
-- ROLLBACK: Borra equipos demo y atletas de Spirit Fontibon (Test).
-- NO borra la escuela ni la sede.
-- SQL plano, sin DO block.
-- =========================================================================

-- 1. Borrar atletas de los equipos Butterfly/etc.
DELETE FROM public.children
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
   AND is_demo = true
   AND team_id IN (
       SELECT id FROM public.teams
        WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
          AND is_demo = true
          AND name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
   );

-- 2. Borrar equipos
DELETE FROM public.teams
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
   AND is_demo = true
   AND name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS');

-- 3. Verificacion (debe dar 0 en ambos)
SELECT 'equipos_restantes' AS tipo, COUNT(*) AS total
FROM public.teams
WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND is_demo = true
  AND name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS');

SELECT 'atletas_restantes' AS tipo, COUNT(*) AS total
FROM public.children
WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND is_demo = true;
