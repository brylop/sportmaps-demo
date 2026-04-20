-- =========================================================================
-- VERIFICACION PRE-MIGRACION: Spirit Fontibon (Test) -> SPIRIT ALL STARS (Real)
--
-- Correr ANTES del 04_migrate_to_real_spirit.sql para congelar el baseline.
-- Correr DESPUES del 04 y comparar: los conteos de "destino" deben igualar
-- los conteos de "origen" pre-migracion.
-- =========================================================================

-- ORIGEN (test):   aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
-- DESTINO (real):  f82ac14e-a5f9-41cf-9727-8bc9d6b687bb
-- Equipos: SPRINKLES, BUTTERFLY, BOMBSQUAD, LEGENDS, FIRESQUAD, BOMBSHELLS
--          (existen en AMBAS escuelas — el 04 remapea atletas por nombre)

-- =========================================================================
-- 1. Conteos generales ORIGEN vs DESTINO
-- =========================================================================
SELECT 'origen_equipos'  AS tipo, COUNT(*) AS total
  FROM public.teams
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
   AND UPPER(name) IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
UNION ALL
SELECT 'origen_atletas',  COUNT(*)
  FROM public.children
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
UNION ALL
SELECT 'destino_equipos', COUNT(*)
  FROM public.teams
 WHERE school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb'
   AND UPPER(name) IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
UNION ALL
SELECT 'destino_atletas', COUNT(*)
  FROM public.children
 WHERE school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb';

-- Esperado ANTES:   origen_equipos=6, origen_atletas≈102, destino_equipos=6, destino_atletas = (lo que ya tenga el real)
-- Esperado DESPUES: origen_equipos=6 (vacios, listos para borrar), origen_atletas=1 (Clementine),
--                   destino_equipos=6, destino_atletas = destino_inicial + 101

-- =========================================================================
-- 2. Desglose de atletas por equipo (origen Y destino)
-- =========================================================================
SELECT 'origen' AS lado, t.name AS equipo, COUNT(c.id) AS atletas
  FROM public.teams t
  LEFT JOIN public.children c ON c.team_id = t.id
 WHERE t.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
   AND UPPER(t.name) IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
 GROUP BY t.name
UNION ALL
SELECT 'destino', t.name, COUNT(c.id)
  FROM public.teams t
  LEFT JOIN public.children c ON c.team_id = t.id
 WHERE t.school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb'
   AND UPPER(t.name) IN ('SPRINKLES','BUTTERFLY','BOMBSQUAD','LEGENDS','FIRESQUAD','BOMBSHELLS')
 GROUP BY t.name
 ORDER BY lado, equipo;

-- =========================================================================
-- 3. Campos estructurados (fase-4) — verificar antes de migrar
-- =========================================================================
SELECT 'atletas_con_talla' AS tipo, COUNT(*) AS total
  FROM public.children
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND tshirt_size IS NOT NULL
UNION ALL
SELECT 'atletas_con_eps',    COUNT(*)
  FROM public.children
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND eps_name    IS NOT NULL
UNION ALL
SELECT 'atletas_con_rh',     COUNT(*)
  FROM public.children
 WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND blood_type  IS NOT NULL;

-- =========================================================================
-- 4. Invitaciones pendientes — avisar si hay que reapuntar manualmente
-- =========================================================================
SELECT i.status, COUNT(*) AS total
  FROM public.invitations i
 WHERE i.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
 GROUP BY i.status
 ORDER BY i.status;

-- Invitaciones PENDING en origen — despues del 04 quedarian huerfanas si no se migran.
-- El trigger trg_fix_invitation_school_id solo corrige en INSERT/UPDATE de team_id,
-- asi que revisar esta lista antes de correr el 04.
SELECT i.id, i.invited_email, i.child_name, i.role_to_assign, i.team_id, i.status
  FROM public.invitations i
 WHERE i.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
   AND i.status = 'pending'
 ORDER BY i.created_at DESC;

-- =========================================================================
-- 5. Enrollments activos — deben viajar con los atletas (FK a children)
-- =========================================================================
SELECT COUNT(*) AS enrollments_origen
  FROM public.enrollments e
  JOIN public.children  c ON c.id = e.child_id
 WHERE c.school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- =========================================================================
-- 6. Exclusiones explicitas — deben quedarse en el school de test
-- =========================================================================
-- Clementine Pulido Pardo (FIRESQUAD) — NO debe migrar.
-- Pre:  school_id = aaaaaaaa-... (origen)
-- Post: school_id = aaaaaaaa-... (sigue en origen, NO en destino)
SELECT full_name, doc_number, school_id, team_id
  FROM public.children
 WHERE full_name ILIKE '%Clementine%Pulido%Pardo%';

-- =========================================================================
-- 7. Flag de demo — confirmar que el 04 dejo is_demo=false
-- =========================================================================
SELECT 'teams_demo_destino'    AS tipo, COUNT(*) AS total
  FROM public.teams
 WHERE school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb' AND is_demo = true
UNION ALL
SELECT 'children_demo_destino', COUNT(*)
  FROM public.children
 WHERE school_id = 'f82ac14e-a5f9-41cf-9727-8bc9d6b687bb' AND is_demo = true;

-- Esperado DESPUES del 04: ambos en 0.
