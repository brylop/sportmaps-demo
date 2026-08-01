-- ============================================================================
-- F0 · PASO 1 — Limpieza sin ambigüedad de plata
-- ----------------------------------------------------------------------------
-- Plan: docs/plan-f0-inscripciones-y-cobros-duplicados.md §7.5
-- Preflight que lo justifica: scripts/f0_preflight.sql
--
-- Cubre SOLO lo que no requiere decisión de nadie:
--   A+B · 10 inscripciones huérfanas (sin equipo ni plan)
--   C   · 13 cobros "(pendiente validación post-migración)" de GYM RM que
--         duplican un cobro YA PAGADO del mismo mes  → mora falsa
--   D   · 1 doble cobro pending de agosto (David Rios, GYM RM)
--
-- NO cubre (necesita que GYM RM decida):
--   · DUVAN, NINI, ROBINSON — ¿su cuota real es $130.000 o $70.000?
--   · JUAN JOSE RAMIREZ — tiene DOS cobros PAGADOS de julio ($140.000 donde
--     debían ser $70.000). Es plata recaudada de más: se devuelve o se acredita
--     al mes siguiente. Esa decisión no se automatiza.
--
-- Correr los bloques EN ORDEN. Cada write va precedido de su preview.
-- El paso 0 deja respaldo: todo es reversible.
-- Fecha: 2026-07-31
-- ============================================================================


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PASO 0 — Respaldo. Correr SIEMPRE antes de cualquier write.              │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.bkp_f0_enrollments_20260731 AS
SELECT * FROM public.enrollments
 WHERE id IN (
   '1657b12f-8784-4a75-a76a-8e3053501c07','345b3a2b-b379-4105-8abd-6d7a31f4322b',
   '9a7eef74-8498-4a09-97df-bc3aabab66fe','8176c9d5-f9cf-4d28-a9eb-d84173432e43',
   'bc30c75e-ecaf-4c81-9dd7-197f2b56f121','1fae4b79-732f-4d24-8c31-fcfc30891561',
   '055ea164-e41e-4b6e-9dec-8e6b436c1f4b','21b86b78-658f-42eb-a40e-09ffbe0f5dca',
   '0af23242-39d7-4a39-a0d4-85fc9e2b940f','514fd335-8e9e-412d-a26b-fc4c1e0125ea'
 );

CREATE TABLE IF NOT EXISTS public.bkp_f0_payments_20260731 AS
SELECT p.* FROM public.payments p
  JOIN public.schools s ON s.id = p.school_id AND s.name = 'GYM RM'
 WHERE p.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado');

-- Verificar el respaldo (esperado: 10 y >0)
SELECT (SELECT count(*) FROM public.bkp_f0_enrollments_20260731) AS enrollments_respaldadas,
       (SELECT count(*) FROM public.bkp_f0_payments_20260731)    AS payments_respaldados;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PASO 1 — PREVIEW de las 10 huérfanas (A+B)                              │
-- └──────────────────────────────────────────────────────────────────────────┘
SELECT s.name AS escuela,
       COALESCE(c.full_name, pr.full_name, ua.full_name) AS atleta,
       e.id, e.team_id, e.offering_plan_id, e.monthly_fee, e.status, e.created_at::date
  FROM public.enrollments e
  JOIN public.schools s                      ON s.id  = e.school_id
  LEFT JOIN public.children c                ON c.id  = e.child_id
  LEFT JOIN public.profiles pr               ON pr.id = e.user_id
  LEFT JOIN public.unregistered_athletes ua  ON ua.id = e.unregistered_athlete_id
 WHERE e.id IN (
   '1657b12f-8784-4a75-a76a-8e3053501c07','345b3a2b-b379-4105-8abd-6d7a31f4322b',
   '9a7eef74-8498-4a09-97df-bc3aabab66fe','8176c9d5-f9cf-4d28-a9eb-d84173432e43',
   'bc30c75e-ecaf-4c81-9dd7-197f2b56f121','1fae4b79-732f-4d24-8c31-fcfc30891561',
   '055ea164-e41e-4b6e-9dec-8e6b436c1f4b','21b86b78-658f-42eb-a40e-09ffbe0f5dca',
   '0af23242-39d7-4a39-a0d4-85fc9e2b940f','514fd335-8e9e-412d-a26b-fc4c1e0125ea'
 )
 ORDER BY escuela, atleta;
-- Esperado: 10 filas, TODAS con team_id NULL y offering_plan_id NULL, status 'active'.
-- Si alguna trae equipo o plan → PARAR: los datos cambiaron desde el preflight.


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PASO 1 — WRITE. Cancela las 10 huérfanas.                               │
-- │ El AND final es el guard: aunque la lista estuviera mal, solo puede      │
-- │ tocar filas que efectivamente no tienen equipo ni plan.                  │
-- └──────────────────────────────────────────────────────────────────────────┘
UPDATE public.enrollments
   SET status = 'cancelled', end_date = CURRENT_DATE, updated_at = now()
 WHERE id IN (
   -- A · huérfanas en $0 (cero impacto en cobros)
   '1657b12f-8784-4a75-a76a-8e3053501c07',  -- GABRIELA CALDERA (Dynasty)
   '345b3a2b-b379-4105-8abd-6d7a31f4322b',  -- DAIRA VALENCIA (GYM RM)
   '9a7eef74-8498-4a09-97df-bc3aabab66fe',  -- KAREN VELASQUEZ (GYM RM)
   '8176c9d5-f9cf-4d28-a9eb-d84173432e43',  -- LESLY PEÑA (GYM RM)
   'bc30c75e-ecaf-4c81-9dd7-197f2b56f121',  -- SAMUEL BELTRAN (GYM RM)
   '1fae4b79-732f-4d24-8c31-fcfc30891561',  -- YAQUELIN OLIVERA (GYM RM)
   '055ea164-e41e-4b6e-9dec-8e6b436c1f4b',  -- YESSICA GOMEZ (GYM RM)
   -- B · huérfanas que duplican un monto idéntico al que queda
   '21b86b78-658f-42eb-a40e-09ffbe0f5dca',  -- LUIS DAVID TURIZO   70k/70k
   '0af23242-39d7-4a39-a0d4-85fc9e2b940f',  -- LUZ HERMIDA         70k/70k
   '514fd335-8e9e-412d-a26b-fc4c1e0125ea'   -- JULIAN (MMA BLAIR) 150k/150k
 )
   AND status = 'active'
   AND team_id IS NULL
   AND offering_plan_id IS NULL;
-- Esperado: UPDATE 10


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PASO 2 — PREVIEW: mora falsa de GYM RM                                  │
-- │ Cobros "(pendiente validación post-migración)" NO pagados, cuyo atleta   │
-- │ YA tiene un cobro PAGADO del mismo mes. Son el sobrante del import.      │
-- └──────────────────────────────────────────────────────────────────────────┘
WITH candidatos AS (
  SELECT p.id, p.amount, p.status, p.due_date, p.concept,
         COALESCE(p.child_id, p.user_id, p.unregistered_athlete_id) AS subject_id,
         p.school_id
    FROM public.payments p
    JOIN public.schools s ON s.id = p.school_id AND s.name = 'GYM RM'
   WHERE p.concept ILIKE '%pendiente validaci%post-migraci%'
     AND p.status IN ('pending','overdue')
),
con_pago AS (
  SELECT k.*
    FROM candidatos k
   WHERE EXISTS (
     SELECT 1 FROM public.payments q
      WHERE q.school_id = k.school_id
        AND COALESCE(q.child_id, q.user_id, q.unregistered_athlete_id) = k.subject_id
        AND to_char(q.due_date,'YYYY-MM') = to_char(k.due_date,'YYYY-MM')
        AND q.id <> k.id
        AND q.status = 'paid'
   )
)
SELECT COALESCE(c.full_name, pr.full_name, ua.full_name) AS atleta,
       cp.id, cp.concept, cp.amount, cp.status, cp.due_date
  FROM con_pago cp
  LEFT JOIN public.children c                ON c.id  = cp.subject_id
  LEFT JOIN public.profiles pr               ON pr.id = cp.subject_id
  LEFT JOIN public.unregistered_athletes ua  ON ua.id = cp.subject_id
 ORDER BY atleta;
-- Esperado: ~13 filas, todas 'overdue'. Revisar la lista con GYM RM antes del write.


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PASO 2 — WRITE. Anula la mora falsa.                                    │
-- │ Solo toca cobros NO pagados que duplican uno pagado del mismo mes.       │
-- └──────────────────────────────────────────────────────────────────────────┘
WITH candidatos AS (
  SELECT p.id, p.due_date,
         COALESCE(p.child_id, p.user_id, p.unregistered_athlete_id) AS subject_id,
         p.school_id
    FROM public.payments p
    JOIN public.schools s ON s.id = p.school_id AND s.name = 'GYM RM'
   WHERE p.concept ILIKE '%pendiente validaci%post-migraci%'
     AND p.status IN ('pending','overdue')
),
a_anular AS (
  SELECT k.id
    FROM candidatos k
   WHERE EXISTS (
     SELECT 1 FROM public.payments q
      WHERE q.school_id = k.school_id
        AND COALESCE(q.child_id, q.user_id, q.unregistered_athlete_id) = k.subject_id
        AND to_char(q.due_date,'YYYY-MM') = to_char(k.due_date,'YYYY-MM')
        AND q.id <> k.id
        AND q.status = 'paid'
   )
)
UPDATE public.payments
   SET status = 'cancelled', updated_at = now()
 WHERE id IN (SELECT id FROM a_anular)
   AND status IN ('pending','overdue');   -- guard: nunca toca un 'paid'


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PASO 3 — David Rios (GYM RM): dos PLAN RM MENSUAL idénticos de agosto.  │
-- │ Ambos pending: se anula el más reciente antes de que alguien pague.      │
-- └──────────────────────────────────────────────────────────────────────────┘
-- PREVIEW
SELECT id, concept, amount, status, due_date, created_at
  FROM public.payments
 WHERE id IN ('360afae0-3017-4de3-9ea5-542f6241160a',
              '3140fe51-4877-4a03-a0bb-0beb61edf8b8')
 ORDER BY created_at;
-- Confirmar: mismo monto, mismo ciclo, ambos 'pending'.

-- WRITE (anula el segundo)
UPDATE public.payments
   SET status = 'cancelled', updated_at = now()
 WHERE id = '3140fe51-4877-4a03-a0bb-0beb61edf8b8'
   AND status = 'pending';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ VERIFICACIÓN FINAL                                                       │
-- └──────────────────────────────────────────────────────────────────────────┘
-- 1. Ya no quedan huérfanas activas con otra inscripción que cobre
SELECT count(*) AS huerfanas_activas_restantes
  FROM public.enrollments
 WHERE status = 'active' AND team_id IS NULL AND offering_plan_id IS NULL;

-- 2. Cartera de GYM RM antes vs después
SELECT 'antes' AS momento, status, count(*), sum(amount)
  FROM public.bkp_f0_payments_20260731 GROUP BY status
UNION ALL
SELECT 'despues', p.status, count(*), sum(p.amount)
  FROM public.payments p
  JOIN public.schools s ON s.id = p.school_id AND s.name = 'GYM RM'
 WHERE p.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado','cancelled')
 GROUP BY p.status
 ORDER BY momento DESC, status;

-- 3. Lo que queda pendiente de decisión (NO se tocó)
SELECT 'DUVAN / NINI / ROBINSON — confirmar cuota real 130k vs 70k' AS pendiente
UNION ALL SELECT 'JUAN JOSE RAMIREZ — dos cobros PAGADOS de julio: devolver o acreditar';


-- ============================================================================
-- ROLLBACK (si algo salió mal)
-- ----------------------------------------------------------------------------
-- UPDATE public.enrollments e
--    SET status = b.status, end_date = b.end_date, updated_at = now()
--   FROM public.bkp_f0_enrollments_20260731 b WHERE e.id = b.id;
--
-- UPDATE public.payments p
--    SET status = b.status, updated_at = now()
--   FROM public.bkp_f0_payments_20260731 b WHERE p.id = b.id;
--
-- Los respaldos se borran cuando el resultado esté validado:
--   DROP TABLE public.bkp_f0_enrollments_20260731;
--   DROP TABLE public.bkp_f0_payments_20260731;
-- ============================================================================
