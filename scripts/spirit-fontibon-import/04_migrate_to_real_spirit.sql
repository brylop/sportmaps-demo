-- =========================================================================
-- MIGRACION A SPIRIT ALL STARS REAL
-- Mueve los 6 equipos y 102 atletas de Spirit Fontibon (Test)
-- hacia la escuela SPIRIT ALL STARS (mancipechirivi28@gmail.com).
-- SQL plano, sin DO block. Idempotente (si ya se movieron, no pasa nada).
-- =========================================================================

-- ORIGEN (test):   jreyes@gmail.com
--   school_id: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee (Spirit Fontibon Test)
--   branch_id: ffffffff-1111-2222-3333-444444444444 (Fontibon)
--
-- DESTINO (real):  mancipechirivi28@gmail.com
--   school_id: f82ac14e-a5f9-41cf-9727-8bc9d6b687bb (SPIRIT ALL STARS)
--   branch_id: 74fb570b-4730-4ea8-a6d7-94ed53b485c3 (SPIRIT ALL STARS sede)

-- ========================================
-- 1. Mover los 6 equipos a SPIRIT ALL STARS
-- ========================================
UPDATE public.teams
   SET school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb',
       branch_id = '74fb570b-4730-4ea8-a6d7-94ed53b485c3',
       is_demo   = false
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
   AND name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS');

-- ========================================
-- 2. Mover los atletas de esos equipos
-- ========================================
UPDATE public.children
   SET school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb',
       branch_id = '74fb570b-4730-4ea8-a6d7-94ed53b485c3',
       is_demo   = false
 WHERE team_id IN (
       '11111111-1111-1111-1111-000000000001',  -- SPRINKLES
       '11111111-1111-1111-1111-000000000002',  -- BUTTERFLY
       '11111111-1111-1111-1111-000000000003',  -- BOMBSQUAD
       '11111111-1111-1111-1111-000000000004',  -- LEGENDS
       '11111111-1111-1111-1111-000000000005',  -- FIRESQUAD
       '11111111-1111-1111-1111-000000000006'   -- BOMBSHELLS
 );

-- ========================================
-- 3. VERIFICACION
-- ========================================
SELECT 'migrados_equipos' AS tipo, COUNT(*) AS total
FROM public.teams
WHERE school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb'
  AND name IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS');

SELECT 'migrados_atletas' AS tipo, COUNT(*) AS total
FROM public.children
WHERE school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb'
  AND team_id IN (
      '11111111-1111-1111-1111-000000000001',
      '11111111-1111-1111-1111-000000000002',
      '11111111-1111-1111-1111-000000000003',
      '11111111-1111-1111-1111-000000000004',
      '11111111-1111-1111-1111-000000000005',
      '11111111-1111-1111-1111-000000000006'
  );
