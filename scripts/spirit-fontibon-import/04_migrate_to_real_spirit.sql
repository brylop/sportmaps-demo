-- =========================================================================
-- MIGRACION A SPIRIT ALL STARS REAL
-- Re-apunta los ~102 atletas de Spirit Fontibon (Test) a los equipos YA
-- CREADOS en SPIRIT ALL STARS (match por nombre, case-insensitive).
-- Los equipos de test quedan vacios (opcionalmente se borran al final).
-- SQL plano, sin DO block. Idempotente (si ya se remapearon, no pasa nada).
-- =========================================================================

-- ORIGEN (test):   jreyes@gmail.com
--   school_id: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee (Spirit Fontibon Test)
--   branch_id: ffffffff-1111-2222-3333-444444444444 (Fontibon)
--   teams:     SPRINKLES, BUTTERFLY, BOMBSQUAD, LEGENDS, FIRESQUAD, BOMBSHELLS
--
-- DESTINO (real):  mancipechirivi28@gmail.com
--   school_id: f82ac14e-a5f9-41cf-9727-8bc9d6b687bb (SPIRIT ALL STARS)
--   branch_id: 74fb570b-4730-4ea8-a6d7-94ed53b485c3 (SPIRIT ALL STARS sede)
--   teams:     Firesquad, Legends, Sprinkles, Butterfly, Bombsquad, Bombshells
--              (mismos nombres en cualquier case — ya creados por el owner)
--
-- EXCLUSIONES:
--   - Clementine Pulido Pardo (FIRESQUAD): ya existe como atleta real, no migra.


-- ========================================
-- PRE-CHECK: los 6 teams destino deben existir antes de correr esto
-- ========================================
SELECT 'pre_check_destino' AS tipo, COUNT(*) AS teams_encontrados
  FROM public.teams
 WHERE school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb'
   AND UPPER(name) IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS');
-- Esperado: 6. Si da <6, ABORTAR y crear los teams faltantes en el real.


-- ========================================
-- 1. Remapear atletas: test team -> real team (match por nombre)
-- ========================================
UPDATE public.children c
   SET team_id   = rt.id,
       school_id = rt.school_id,
       branch_id = rt.branch_id,
       is_demo   = false
  FROM public.teams tt
  JOIN public.teams rt
    ON UPPER(rt.name) = UPPER(tt.name)
   AND rt.school_id  = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb'
 WHERE c.team_id     = tt.id
   AND tt.school_id  = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
   AND UPPER(tt.name) IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
   AND c.full_name NOT ILIKE '%Clementine%Pulido%Pardo%';


-- ========================================
-- 2. VERIFICACION
-- ========================================
-- Atletas migrados al destino, por equipo real
SELECT rt.name AS equipo_real, COUNT(c.id) AS atletas
  FROM public.teams rt
  LEFT JOIN public.children c
         ON c.team_id = rt.id
        AND c.school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb'
 WHERE rt.school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb'
   AND UPPER(rt.name) IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
 GROUP BY rt.name
 ORDER BY rt.name;

-- Atletas que siguen en origen (deberia quedar solo Clementine o similares excluidos)
SELECT COUNT(*) AS atletas_remanentes_en_test
  FROM public.children
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- Teams de test y su ocupacion (deberian quedar en 0 — listos para borrar)
SELECT tt.name, COUNT(c.id) AS atletas
  FROM public.teams tt
  LEFT JOIN public.children c ON c.team_id = tt.id
 WHERE tt.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
 GROUP BY tt.name
 ORDER BY tt.name;


-- ========================================
-- 3. (OPCIONAL) Limpiar teams de test vacios
--    Descomentar despues de verificar que el bloque 2 salio OK
-- ========================================
-- DELETE FROM public.teams
--  WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
--    AND UPPER(name) IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
--    AND NOT EXISTS (
--        SELECT 1 FROM public.children c WHERE c.team_id = teams.id
--    );
