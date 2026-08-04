-- ============================================================
-- LIMPIEZA DE DATOS — DYNASTY VOLLEY CLUB (2d509571-3238-4c04-ac3f-6dfe20539226)
-- ------------------------------------------------------------
-- NO es una migración: es data de un solo tenant. Correr a mano en el SQL
-- Editor, paso por paso, revisando el SELECT de verificación de cada bloque.
-- Correr DESPUÉS de aplicar 20260730000000_enrollment_no_split_rows.sql
-- (esa migración ya fusiona las inscripciones partidas; aquí queda lo demás).
--
-- Contexto: 396 invitaciones enviadas el 6-jul, 419 atletas pre-cargados,
-- 415 aún sin padre. La pre-carga está sana (0 correos rotos). Esto limpia los
-- 3 focos sueltos detectados el 2026-07-29.
-- ============================================================


-- ══ PASO 0 — GABRIELA SORACÁ PLAZA: dos planes activos distintos ═══════════
-- No la fusiona la migración: su fila de equipo (MENORES FEMENINO) ya recibió
-- "SENIORS 8 Clases" el 2026-07-30 01:18, y además arrastra una fila plan-solo
-- con PLAN ELITE del 2026-07-29 13:50. Dos planes ≠ patrón fusionable.
-- Decisión: se queda SENIORS 8 Clases (el más reciente, ya sobre el equipo).

-- 0.a Verificar antes (debe mostrar las 2 filas activas descritas)
SELECT e.id, e.status, t.name AS equipo, op.name AS plan, e.monthly_fee, e.updated_at
FROM public.enrollments e
LEFT JOIN public.teams t ON t.id = e.team_id
LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
WHERE e.child_id = '0feb1e3a-27f1-4da7-b96c-21dfa5b8d901'
ORDER BY e.created_at;

-- 0.b Cancelar la fila de PLAN ELITE (queda 1 activa: equipo + SENIORS 8 Clases)
UPDATE public.enrollments
   SET status = 'cancelled', end_date = COALESCE(end_date, CURRENT_DATE)
 WHERE id = '7e237501-1411-4537-8ef8-ba6055c6756c'
   AND status = 'active';


-- ══ PASO 1 — Invitación espuria (correo con typo + hijo inexistente) ════════
-- janethgarzo@gmail.com / "Adriana Juana Díaz Ramirez" no corresponde a ningún
-- atleta. El correo real es janethgarzon@gmail.com (ANA ISABELLA FORERO GARZON),
-- que ya tiene su propia invitación. Si alguien acepta la espuria, se crea un
-- hijo fantasma.

-- 1.a Verificar (debe devolver 2 filas: la buena y la espuria)
SELECT id, email, child_name, status
FROM public.invitations
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND lower(email) IN ('janethgarzo@gmail.com', 'janethgarzon@gmail.com');

-- 1.b Anular solo la espuria
UPDATE public.invitations
   SET status = 'declined'
 WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
   AND lower(trim(email)) = 'janethgarzo@gmail.com'
   AND status = 'pending';


-- ══ PASO 2 — Equipo duplicado MINIVOLLEY ═══════════════════════════════════
-- "MINIVOLLEY -BENJAMINES" (con guion, precio 150.000, 1 atleta) es un duplicado
-- de "MINIVOLLEY BENJAMINES" (68 atletas). El precio del equipo es irrelevante
-- en el modelo actual (plan manda, equipo = roster), pero el equipo duplicado
-- parte el roster.

-- 2.a Ver ambos equipos y a quién arrastra el duplicado
SELECT t.id, t.name, t.price_monthly,
       (SELECT count(*) FROM public.children c WHERE c.team_id = t.id) AS atletas_children,
       (SELECT count(*) FROM public.enrollments e WHERE e.team_id = t.id AND e.status = 'active') AS inscripciones_activas
FROM public.teams t
WHERE t.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND t.name ILIKE '%MINIVOLLEY%';

-- 2.a VERIFICADO el 2026-07-30:
--   c05c3247-0121-4894-9b77-88db8001d754  "MINIVOLLEY -BENJAMINES"  150.000  1 atleta   0 inscripciones activas  ← DUPLICADO
--   864c9ee7-0e01-4901-8f16-816961688919  "MINIVOLLEY BENJAMINES"        0  68 atletas 68 inscripciones activas  ← BUENO
--
-- CUIDADO con la dirección: mover en sentido contrario vacía el equipo real y
-- deja a los 68 atletas colgando del duplicado.
--
-- 2.b NO hay que mover a nadie. El único atleta del duplicado ES la LUCIANA
--     duplicada del PASO 3 (cabfbfa4…, creada el 13-jun). Los dos problemas son
--     el mismo: al descartarla, el equipo duplicado queda en 0.
--     → Ejecutar primero el PASO 3, después volver aquí.

-- 2.c Neutralizar el equipo duplicado, ya vacío (no borrarlo: puede tener historial).
--     `teams` no tiene is_active en el esquema versionado; si existe en tu BD,
--     esta query lo dice:
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'teams'
  AND column_name IN ('is_active', 'active');

--     Renombrarlo funciona en cualquier caso — nadie lo elige en un desplegable
--     que dice "NO USAR":
UPDATE public.teams
   SET name = 'MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)'
 WHERE id = 'c05c3247-0121-4894-9b77-88db8001d754';

--     Y si is_active existe, además:
/*
UPDATE public.teams SET is_active = false WHERE id = 'c05c3247-0121-4894-9b77-88db8001d754';
*/


-- ══ PASO 3 — Atleta duplicado: LUCIANA RODRIGUEZ MAHECHA ═══════════════════
-- Dos registros del mismo atleta, mismo acudiente (alexei.transportes@outlook.com),
-- ambos huérfanos, 0 pagos, 1 inscripción cada uno, en equipos DISTINTOS:
--   cabfbfa4… "luciana rodriguez mahecha"  creado 2026-06-13  team c05c3247…
--   2c616d7f… "LUCIANA RODRIGUEZ MAHECHA"  creado 2026-07-06  team 864c9ee7…
-- Si no se resuelve, al entrar el papá el claim adopta LOS DOS y ve dos hijos.

-- 3.a ¿En qué equipo está cada uno? (define cuál es el bueno)
SELECT c.id, c.full_name, c.created_at, c.team_id, t.name AS equipo,
       (SELECT count(*) FROM public.enrollments e WHERE e.child_id = c.id AND e.status='active') AS inscripciones,
       (SELECT count(*) FROM public.payments  p WHERE p.child_id = c.id) AS pagos,
       (SELECT count(*) FROM public.attendance_records a WHERE a.child_id = c.id) AS asistencias
FROM public.children c
LEFT JOIN public.teams t ON t.id = c.team_id
WHERE c.id IN ('cabfbfa4-258c-4abf-b76a-8d59b90f8cba', '2c616d7f-143e-49f9-8462-d4610b8838db');

-- 3.b Sobrevive el registro del import del 6-jul (2c616d7f…): es el que matchea
--     la invitación y está en el equipo real (MINIVOLLEY BENJAMINES). Se descarta
--     el del 13-jun (cabfbfa4…), que está en el equipo duplicado.
--
--     Quitarle el correo es lo que de verdad resuelve el problema: sin
--     parent_email_temp, claim_orphan_children ya no lo puede adoptar y el papá
--     verá UN solo hijo al entrar.
UPDATE public.enrollments
   SET status = 'cancelled', end_date = CURRENT_DATE
 WHERE child_id = 'cabfbfa4-258c-4abf-b76a-8d59b90f8cba' AND status = 'active';

UPDATE public.children
   SET parent_email_temp = NULL,
       parent_phone_temp = NULL,
       is_active         = false
 WHERE id = 'cabfbfa4-258c-4abf-b76a-8d59b90f8cba';

-- 3.c Si prefieres borrarlo de raíz (solo si 3.a confirma 0 pagos y 0 asistencias)
/*
DELETE FROM public.enrollments WHERE child_id = 'cabfbfa4-258c-4abf-b76a-8d59b90f8cba';
DELETE FROM public.children    WHERE id       = 'cabfbfa4-258c-4abf-b76a-8d59b90f8cba';
*/


-- ══ PASO 4 — Invitaciones duplicadas ya aceptadas (opcional) ═══════════════
-- anyela0123@gmail.com y paularozo@gmail.com tienen 2 invitaciones aceptadas
-- cada uno, al mismo hijo. Son inofensivas (el segundo accept encuentra al hijo
-- por parent_id y solo actualiza) y el índice único nuevo solo cubre 'pending'.
-- Se dejan como registro histórico. Para verlas:
SELECT id, email, child_name, status, created_at
FROM public.invitations
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND lower(email) IN ('anyela0123@gmail.com', 'paularozo@gmail.com')
ORDER BY email, created_at;


-- ══ VERIFICACIÓN FINAL ═════════════════════════════════════════════════════
-- Todos los contadores deben quedar en 0.
WITH d AS (SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid AS id)
SELECT 'atletas con nombre duplicado' AS chequeo, coalesce(sum(veces - 1), 0) AS casos FROM (
  SELECT count(*) AS veces FROM public.children c
   WHERE c.school_id = (SELECT id FROM d) AND c.is_active
   GROUP BY lower(regexp_replace(trim(c.full_name), '\s+', ' ', 'g'))
  HAVING count(*) > 1) a
UNION ALL
SELECT 'atletas con 2+ inscripciones activas', count(*) FROM (
  SELECT e.child_id FROM public.enrollments e
   WHERE e.school_id = (SELECT id FROM d) AND e.status = 'active' AND e.child_id IS NOT NULL
   GROUP BY e.child_id HAVING count(*) > 1) b
UNION ALL
SELECT 'invitaciones pendientes sin atleta pre-cargado', count(*) FROM public.invitations i
 WHERE i.school_id = (SELECT id FROM d) AND i.status = 'pending'
   AND NOT EXISTS (SELECT 1 FROM public.children c
                    WHERE c.school_id = i.school_id
                      AND lower(trim(c.parent_email_temp)) = lower(trim(i.email)));
