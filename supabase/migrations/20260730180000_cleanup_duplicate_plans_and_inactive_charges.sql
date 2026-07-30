-- ============================================================
-- SPORTMAPS — Limpieza de datos: planes duplicados y atletas inactivos que
--             seguían inscritos (y facturando)
-- ------------------------------------------------------------
-- Fecha: 2026-07-30
--
-- Acompaña a 20260730170000 (la baja de atleta corta plan y cobros) y
-- 20260730170001 (la vista deja de elegir el plan al azar). Aquellas arreglan la
-- causa; ésta corrige las filas que ya quedaron mal.
--
-- Nada se BORRA: todo pasa a 'cancelled', la misma semántica que usa el código.
-- Idempotente: cada UPDATE está guardado por el status de origen, así que
-- correrla dos veces no hace nada la segunda vez.
--
-- Los pagos ya recibidos ('paid', 'partial') NO se tocan en ningún bloque.
--
-- ALCANCE MEDIDO sobre la BD real el 2026-07-30 (no es un barrido a ciegas):
--   Bloque 1 → 3 inscripciones de 2 menores de MMA BLAIR TEAM (0 cobros vivos)
--   Bloque 2 → 61 inscripciones de atletas inactivos, en 5 escuelas
--   Bloque 3 → 10 cobros vivos por $1.717.750, en 3 escuelas
-- ============================================================

BEGIN;

-- ── BLOQUE 1. Planes activos duplicados (MMA BLAIR TEAM) ─────────────────────
-- Dos menores arrastraban DOS inscripciones activas con plan, así que cada
-- corrida del generador les emitía dos cuotas el mismo día. En el historial de
-- david se ve claro: $160.000 + $150.000 los días 23 al 28 de julio (ya
-- canceladas). Ninguno de los dos tiene cobros vivos hoy.
--
-- Criterio: sobrevive la inscripción MÁS ANTIGUA — la que arrastra el historial,
-- y el mismo criterio que aplica ahora el BFF al deduplicar. Decidido con el
-- usuario el 2026-07-30 para el caso de Luis, donde la elección cambia el precio.
--
-- david Lopez → conserva 4f121596 (COMBATE MMA + "Plan Mensual" $160.000).
--               Se corta "BASICO" $150.000 sin equipo.
UPDATE public.enrollments
   SET status     = 'cancelled',
       end_date   = COALESCE(end_date, CURRENT_DATE),
       updated_at = now()
 WHERE status = 'active'
   AND id = '2f32ef68-71e4-4f7d-b5d4-463201330aaa';

-- Luis Lopez → conserva 47187fa8 (COMBATE MMA + "Plan Mensual" $160.000).
--   Se cortan DOS filas:
--     e6bafdbb  GRAPPLING MMA + "Plan Intensivo" $280.000  (el plan duplicado)
--     6b0bdfc7  equipo MMA, cuota 0, sin plan              (tercera fila suelta)
--   La tercera no cobra (cuota 0 → open_month la ignora), pero lo dejaba en dos
--   rosters y el editor la cancelaría igual en el próximo guardado. Queda
--   inscrito solo en COMBATE MMA por $160.000/mes.
UPDATE public.enrollments
   SET status     = 'cancelled',
       end_date   = COALESCE(end_date, CURRENT_DATE),
       updated_at = now()
 WHERE status = 'active'
   AND id IN (
     'e6bafdbb-d997-4745-86fc-26b525e8d6f4',
     '6b0bdfc7-44b9-4aae-88fb-00b37641357a'
   );

-- Cobros vivos de los planes descartados (hoy: 0 en ambos menores; queda por si
-- el generador alcanzó a emitir alguno entre la medición y la aplicación).
UPDATE public.payments
   SET status     = 'cancelled',
       updated_at = now()
 WHERE status IN ('pending', 'awaiting_approval', 'overdue')
   AND (   (child_id = '8db1a28b-9857-4063-bac3-7b3a70427cd9'
            AND offering_plan_id = '9b6be2aa-88a9-4f8f-a15c-739a92f46f40')
        OR (child_id = 'fe419cec-5691-4658-a998-78903bc59f60'
            AND offering_plan_id = '03593cdb-ab7f-4629-ba4c-c04042776968'));


-- ── BLOQUE 2. Atletas inactivos con inscripción activa ───────────────────────
-- 61 inscripciones: DYNASTY VOLLEY CLUB 54 · VOLK FIT CLUB 3 ·
-- SPIRIT ALL STARS 2 · Monster's Volley Club 1 · patinaje real Bogotá 1.
--
-- Por qué es seguro cancelarlas: se comprobó atleta por atleta que las bajas de
-- DYNASTY se hicieron A MANO, de una en una, entre las 01:28 y las 17:06 del
-- 2026-07-30 (más 2 del 28/07) — son decisiones deliberadas, no un artefacto de
-- datos. Y de esos 54, NINGUNO tiene un solo pago recibido, 50 no tienen ningún
-- cobro y 52 llevan cuota $0: cancelar no deja de facturar a nadie que pagara.
--
-- Es la condición que el generador debería haber tenido siempre: open_month()
-- solo mira enrollments.status y nunca el estado del atleta, y por eso a
-- `omar pedraza` (VOLK, inactivado 02:54) se le emitió la cuota de julio a las
-- 03:07, después de su baja.
UPDATE public.enrollments e
   SET status     = 'cancelled',
       end_date   = COALESCE(e.end_date, CURRENT_DATE),
       updated_at = now()
 WHERE e.status = 'active'
   AND (
        -- menor dado de baja (children.is_active es global, no por escuela)
        EXISTS (SELECT 1 FROM public.children c
                 WHERE c.id = e.child_id AND c.is_active IS FALSE)
        -- adulto con membresía NO activa en ESA escuela
     OR EXISTS (SELECT 1 FROM public.school_members sm
                 WHERE sm.profile_id = e.user_id
                   AND sm.school_id  = e.school_id
                   AND sm.role       = 'athlete'
                   AND sm.status    <> 'active')
        -- atleta no registrado dado de baja
     OR EXISTS (SELECT 1 FROM public.unregistered_athletes ua
                 WHERE ua.id = e.unregistered_athlete_id AND ua.is_active IS FALSE)
   );


-- ── BLOQUE 3. Cobros vivos de atletas inactivos ──────────────────────────────
-- 10 cobros por $1.717.750: VOLK FIT CLUB 5 ($950.000, los 3 atletas de arriba),
-- DYNASTY 4 ($630.000) y Monster's 1 ($137.750).
UPDATE public.payments p
   SET status     = 'cancelled',
       updated_at = now()
 WHERE p.status IN ('pending', 'awaiting_approval', 'overdue')
   AND (
        EXISTS (SELECT 1 FROM public.children c
                 WHERE c.id = p.child_id AND c.is_active IS FALSE)
     OR EXISTS (SELECT 1 FROM public.school_members sm
                 WHERE sm.profile_id = p.user_id
                   AND sm.school_id  = p.school_id
                   AND sm.role       = 'athlete'
                   AND sm.status    <> 'active')
     OR EXISTS (SELECT 1 FROM public.unregistered_athletes ua
                 WHERE ua.id = p.unregistered_athlete_id AND ua.is_active IS FALSE)
   );

COMMIT;

NOTIFY pgrst, 'reload schema';


-- ── VERIFICACIÓN (correr después; las tres deben salir vacías) ────────────────

-- (a) ¿Queda algún atleta con DOS inscripciones activas con plan?
SELECT s.name AS escuela,
       COALESCE(c.full_name, pr.full_name, ua.full_name) AS atleta,
       count(*)                      AS planes_activos,
       array_agg(e.offering_plan_id) AS planes,
       array_agg(e.monthly_fee)      AS cuotas
  FROM public.enrollments e
  JOIN public.schools s                     ON s.id  = e.school_id
  LEFT JOIN public.children c               ON c.id  = e.child_id
  LEFT JOIN public.profiles pr              ON pr.id = e.user_id
  LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
 WHERE e.status = 'active'
   AND e.offering_plan_id IS NOT NULL
 GROUP BY 1, 2, e.school_id, e.child_id, e.user_id, e.unregistered_athlete_id
HAVING count(*) > 1
 ORDER BY 1, 2;

-- (b) ¿Queda algún atleta inactivo con inscripción activa?
SELECT s.name AS escuela, count(*) AS inscripciones
  FROM public.enrollments e
  JOIN public.schools s ON s.id = e.school_id
 WHERE e.status = 'active'
   AND (EXISTS (SELECT 1 FROM public.children c
                 WHERE c.id = e.child_id AND c.is_active IS FALSE)
     OR EXISTS (SELECT 1 FROM public.school_members sm
                 WHERE sm.profile_id = e.user_id AND sm.school_id = e.school_id
                   AND sm.role = 'athlete' AND sm.status <> 'active')
     OR EXISTS (SELECT 1 FROM public.unregistered_athletes ua
                 WHERE ua.id = e.unregistered_athlete_id AND ua.is_active IS FALSE))
 GROUP BY 1 ORDER BY 2 DESC;

-- (c) ¿Queda algún cobro vivo de un atleta inactivo?
SELECT s.name AS escuela, count(*) AS cobros, sum(p.amount) AS monto
  FROM public.payments p
  JOIN public.schools s ON s.id = p.school_id
 WHERE p.status IN ('pending', 'awaiting_approval', 'overdue')
   AND (EXISTS (SELECT 1 FROM public.children c
                 WHERE c.id = p.child_id AND c.is_active IS FALSE)
     OR EXISTS (SELECT 1 FROM public.school_members sm
                 WHERE sm.profile_id = p.user_id AND sm.school_id = p.school_id
                   AND sm.role = 'athlete' AND sm.status <> 'active')
     OR EXISTS (SELECT 1 FROM public.unregistered_athletes ua
                 WHERE ua.id = p.unregistered_athlete_id AND ua.is_active IS FALSE))
 GROUP BY 1 ORDER BY 2 DESC;
