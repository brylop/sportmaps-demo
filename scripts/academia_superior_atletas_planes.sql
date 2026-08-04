-- ============================================================
-- ACADEMIA SUPERIOR BOGOTA — atletas y sus planes
-- school_id = 773a4c06-2e33-4ecc-8b20-68c0a428a8f2
-- Correr bloque por bloque en el SQL Editor de Supabase.
--
-- Notas:
--  * school_athletes es una VISTA security_invoker con TRES ramas
--    UNION ALL, o sea tres tipos de atleta (athlete_type):
--      - 'child'        -> children, cuelga de un acudiente (parent_id)
--      - 'adult'        -> profiles + school_members (role='athlete'),
--                          cuenta propia, sin acudiente
--      - 'unregistered' -> unregistered_athletes, sin cuenta
--  * OJO: athlete_type='adult' significa "tiene cuenta propia", NO
--    "mayor de 18". La edad real sale de date_of_birth (bloque 7b).
--  * enrollments.status es TEXT: 'active' | 'cancelled' | 'pending'.
--    El sujeto es un XOR: child_id | user_id | unregistered_athlete_id.
--  * La cuota que manda es enrollments.monthly_fee; si es NULL cae
--    a offering_plans.price y luego a teams.price_monthly.
--  * payments NO tiene enrollment_id, pero SI tiene offering_plan_id.
--    El sujeto del cobro es:
--      menores      -> payments.child_id
--      sin cuenta   -> payments.unregistered_athlete_id
--      adultos      -> payments.user_id O payments.parent_id, segun el
--                      flujo (checkout directo vs generate_monthly_charges).
--                      Hay que mirar LOS DOS o se pierden filas.
--    mas team_id / period_year / period_month.
-- ============================================================


-- ============================================================
-- 1. ROSTER COMPLETO — un atleta por fila, con su plan
--    (esto es lo que ve la UI de Atletas)
-- ============================================================
SELECT sa.full_name            AS atleta,
       sa.athlete_type         AS tipo,          -- child | adult
       sa.is_active            AS activo,
       sa.plan_name            AS plan,
       sa.plan_monthly_fee     AS cuota_plan,
       sa.team_name            AS equipo,
       sa.team_monthly_fee     AS cuota_equipo,  -- 0 si ya tiene plan (equipo = solo roster)
       sa.price_monthly        AS cuota_efectiva,-- la que se cobra
       sa.plan_start_date      AS plan_desde,
       sa.expires_at           AS plan_vence,
       sa.sessions_used        AS sesiones_usadas,
       sa.payment_status        AS ultimo_cobro_estado,
       sa.payment_due_date      AS ultimo_cobro_vence,
       sa.parent_name          AS acudiente,
       sa.parent_email,
       sa.parent_phone,
       sa.branch_name          AS sede,
       sa.id                   AS athlete_id,
       sa.offering_plan_id
FROM public.school_athletes sa
WHERE sa.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
ORDER BY sa.is_active DESC, sa.plan_name NULLS LAST, sa.full_name;


-- ============================================================
-- 2. RESUMEN: cuantos atletas por plan + ingreso mensual esperado
-- ============================================================
SELECT COALESCE(sa.plan_name, '(sin plan)') AS plan,
       count(*)                             AS atletas,
       count(*) FILTER (WHERE sa.is_active) AS activos,
       min(sa.price_monthly)                AS cuota_min,
       max(sa.price_monthly)                AS cuota_max,
       sum(sa.price_monthly) FILTER (WHERE sa.is_active) AS ingreso_mensual_esperado
FROM public.school_athletes sa
WHERE sa.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
GROUP BY 1
ORDER BY atletas DESC;


-- ============================================================
-- 3. HUECOS: atletas activos sin plan, o con plan pero cuota 0
-- ============================================================
SELECT sa.full_name AS atleta,
       sa.athlete_type AS tipo,
       sa.plan_name    AS plan,
       sa.team_name    AS equipo,
       sa.price_monthly AS cuota_efectiva,
       CASE
         WHEN sa.offering_plan_id IS NULL AND sa.enrolled_team_id IS NULL THEN 'sin plan ni equipo'
         WHEN sa.offering_plan_id IS NULL                                  THEN 'solo equipo, sin plan'
         WHEN COALESCE(sa.price_monthly, 0) = 0                            THEN 'con plan pero cuota 0'
       END AS diagnostico,
       sa.parent_email,
       sa.id AS athlete_id
FROM public.school_athletes sa
WHERE sa.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
  AND sa.is_active
  AND ( sa.offering_plan_id IS NULL OR COALESCE(sa.price_monthly, 0) = 0 )
ORDER BY diagnostico, sa.full_name;


-- ============================================================
-- 4. DETALLE CRUDO — TODAS las inscripciones por atleta
--    (incluye canceladas: aca se ve el rastro de cambios de plan
--     y los duplicados de inscripcion activa)
-- ============================================================
SELECT COALESCE(c.full_name, p.full_name, ua.full_name) AS atleta,
       CASE WHEN e.child_id IS NOT NULL                THEN 'child'
            WHEN e.unregistered_athlete_id IS NOT NULL THEN 'unregistered'
            ELSE 'adult' END AS tipo,
       e.status,
       op.name        AS plan,
       op.price       AS precio_catalogo,
       t.name         AS equipo,
       t.price_monthly AS precio_equipo,
       e.monthly_fee  AS cuota_individual,   -- la que manda
       e.start_date, e.end_date, e.expires_at,
       e.created_at, e.updated_at,
       e.id AS enrollment_id
FROM public.enrollments e
LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
LEFT JOIN public.teams t           ON t.id  = e.team_id
LEFT JOIN public.children c        ON c.id  = e.child_id
LEFT JOIN public.profiles p        ON p.id  = e.user_id
LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
WHERE e.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
ORDER BY atleta, e.created_at;

-- 4b. Atletas con MAS de una inscripcion activa CON plan
--     (sintoma del bug de "asignar plan" que creaba una 2a inscripcion)
SELECT COALESCE(p.full_name, c.full_name) AS atleta,
       count(*) AS inscripciones_con_plan,
       array_agg(op.name       ORDER BY e.created_at) AS planes,
       array_agg(e.monthly_fee ORDER BY e.created_at) AS cuotas,
       array_agg(e.created_at  ORDER BY e.created_at) AS creadas,
       array_agg(e.id          ORDER BY e.created_at) AS enrollment_ids
FROM public.enrollments e
LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
LEFT JOIN public.children c        ON c.id  = e.child_id
LEFT JOIN public.profiles p        ON p.id  = e.user_id
WHERE e.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
  AND e.status = 'active'
  AND e.offering_plan_id IS NOT NULL
GROUP BY COALESCE(e.child_id, e.user_id), 1
HAVING count(*) > 1
ORDER BY 2 DESC;


-- ============================================================
-- 5. CATALOGO: los planes que vende la escuela + cuantos inscritos
-- ============================================================
SELECT o.name              AS oferta,
       o.offering_type     AS tipo_oferta,
       o.sport             AS deporte,
       op.name             AS plan,
       op.price,
       op.max_sessions     AS sesiones,
       op.duration_days    AS dias,
       op.auto_renew,
       op.is_active,
       ( SELECT count(*) FROM public.enrollments e
          WHERE e.offering_plan_id = op.id AND e.status = 'active' ) AS inscritos_activos,
       op.id AS offering_plan_id
FROM public.offering_plans op
JOIN public.offerings o ON o.id = op.offering_id
WHERE op.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
ORDER BY o.name, op.sort_order, op.name;


-- ============================================================
-- 6. PLAN vs COBROS del mes en curso (quien esta al dia)
--    Menores -> child_id. Adultos -> user_id O parent_id (los dos).
-- ============================================================
SELECT sa.full_name       AS atleta,
       sa.plan_name       AS plan,
       sa.price_monthly   AS cuota_efectiva,
       pay.concept,
       pay.amount         AS monto_cobrado,
       pay.amount_paid,
       pay.status         AS estado_cobro,
       pay.due_date,
       pay.payment_date,
       pay.payment_method,
       pay.period_year, pay.period_month,
       op_pay.name AS plan_del_cobro,      -- payments.offering_plan_id
       pay.parent_id,                      -- NULL/roto => "No tienes permiso para pagar"
       pay.user_id,
       pay.id AS payment_id
FROM public.school_athletes sa
LEFT JOIN public.payments pay
       ON pay.school_id = sa.school_id
      AND ( pay.child_id = sa.id
            OR (sa.user_id IS NOT NULL
                AND sa.user_id IN (pay.user_id, pay.parent_id)) )
      AND pay.period_year  = EXTRACT(YEAR  FROM CURRENT_DATE)::int
      AND pay.period_month = EXTRACT(MONTH FROM CURRENT_DATE)::int
LEFT JOIN public.offering_plans op_pay ON op_pay.id = pay.offering_plan_id
WHERE sa.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
  AND sa.is_active
ORDER BY (pay.id IS NULL) DESC, sa.plan_name NULLS LAST, sa.full_name;

-- 6b. Todos los cobros del atleta (sin filtrar periodo), util cuando
--     period_year/period_month vienen NULL (cobros viejos o de cron)
SELECT sa.full_name AS atleta,
       sa.plan_name AS plan,
       pay.created_at, pay.concept, pay.amount, pay.status,
       pay.due_date, pay.period_year, pay.period_month, pay.id AS payment_id
FROM public.school_athletes sa
JOIN public.payments pay
  ON pay.school_id = sa.school_id
 AND ( pay.child_id = sa.id
       OR (sa.user_id IS NOT NULL AND sa.user_id IN (pay.user_id, pay.parent_id)) )
WHERE sa.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
ORDER BY sa.full_name, pay.created_at DESC;


-- ============================================================
-- 7. MAYORES DE EDAD / ATLETAS ADULTOS
-- ============================================================

-- 7a. Solo los de cuenta propia (athlete_type='adult') con su plan
SELECT sa.full_name      AS atleta,
       sa.is_active      AS activo,          -- viene de school_members.status='active'
       sa.date_of_birth,
       CASE WHEN sa.date_of_birth IS NULL THEN NULL
            ELSE date_part('year', age(sa.date_of_birth))::int END AS edad,
       sa.plan_name      AS plan,
       sa.plan_monthly_fee AS cuota_plan,
       sa.team_name      AS equipo,
       sa.price_monthly  AS cuota_efectiva,
       sa.plan_start_date AS plan_desde,
       sa.expires_at     AS plan_vence,
       sa.sessions_used,
       sa.payment_status AS ultimo_cobro_estado,
       sa.payment_due_date,
       sa.parent_email   AS email,           -- en la rama adult es el email propio
       sa.parent_phone   AS telefono,
       sa.branch_name    AS sede,
       sa.user_id,
       sa.offering_plan_id
FROM public.school_athletes sa
WHERE sa.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
  AND sa.athlete_type = 'adult'
ORDER BY sa.is_active DESC, sa.plan_name NULLS LAST, sa.full_name;

-- 7b. MAYORES DE 18 POR EDAD REAL (cruza los tres tipos:
--     un 'child' puede haber cumplido 18 y un 'adult' puede ser menor)
SELECT sa.full_name AS atleta,
       sa.athlete_type AS tipo,
       sa.date_of_birth,
       date_part('year', age(sa.date_of_birth))::int AS edad,
       sa.is_active AS activo,
       sa.plan_name AS plan,
       sa.price_monthly AS cuota_efectiva,
       sa.team_name AS equipo,
       sa.parent_name AS acudiente,   -- si es 'child' y ya tiene 18, sigue colgado del acudiente
       sa.parent_email,
       sa.id AS athlete_id
FROM public.school_athletes sa
WHERE sa.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
  AND sa.date_of_birth IS NOT NULL
  AND sa.date_of_birth <= CURRENT_DATE - interval '18 years'
ORDER BY edad DESC, sa.full_name;

-- 7c. Conteo por tipo y mayoria de edad (para ver el reparto real)
SELECT sa.athlete_type AS tipo,
       CASE
         WHEN sa.date_of_birth IS NULL THEN 'sin fecha de nacimiento'
         WHEN sa.date_of_birth <= CURRENT_DATE - interval '18 years' THEN 'mayor de edad'
         ELSE 'menor de edad'
       END AS franja,
       count(*)                             AS atletas,
       count(*) FILTER (WHERE sa.is_active)  AS activos,
       count(*) FILTER (WHERE sa.offering_plan_id IS NOT NULL) AS con_plan,
       sum(sa.price_monthly) FILTER (WHERE sa.is_active) AS ingreso_mensual
FROM public.school_athletes sa
WHERE sa.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 7d. CRUDO, sin pasar por la vista — adultos desde school_members.
--     Sirve si un adulto "no aparece" en la UI: la vista es
--     security_invoker y las policies de profiles pueden esconder
--     al miembro inactivo (bug arreglado en mig 20260730160000).
--     En el SQL Editor corres como postgres, asi que aca SI salen todos.
SELECT pr.full_name AS atleta,
       pr.email,
       pr.phone,
       sm.status     AS estado_membresia,   -- active | inactive | ...
       sm.role,
       sm.created_at AS miembro_desde,
       pr.date_of_birth,
       CASE WHEN pr.date_of_birth IS NULL THEN NULL
            ELSE date_part('year', age(pr.date_of_birth))::int END AS edad,
       e.status      AS estado_inscripcion,
       op.name       AS plan,
       op.price      AS precio_catalogo,
       e.monthly_fee AS cuota_individual,
       t.name        AS equipo,
       e.start_date, e.expires_at, e.created_at AS inscrito_el,
       pr.id         AS profile_id,
       e.id          AS enrollment_id
FROM public.school_members sm
JOIN public.profiles pr ON pr.id = sm.profile_id
LEFT JOIN public.enrollments e     ON e.user_id = pr.id
                                  AND e.school_id = sm.school_id
LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
LEFT JOIN public.teams t           ON t.id  = e.team_id
WHERE sm.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
  AND sm.role = 'athlete'
ORDER BY pr.full_name, e.created_at;

-- 7e. Adultos activos SIN plan (los que no se les va a generar cobro)
SELECT pr.full_name AS atleta,
       pr.email,
       sm.status AS estado_membresia,
       count(e.id) FILTER (WHERE e.status = 'active') AS inscripciones_activas,
       count(e.id) FILTER (WHERE e.status = 'active'
                             AND e.offering_plan_id IS NOT NULL) AS con_plan
FROM public.school_members sm
JOIN public.profiles pr ON pr.id = sm.profile_id
LEFT JOIN public.enrollments e ON e.user_id = pr.id AND e.school_id = sm.school_id
WHERE sm.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
  AND sm.role = 'athlete'
  AND sm.status = 'active'
GROUP BY pr.full_name, pr.email, sm.status
HAVING count(e.id) FILTER (WHERE e.status = 'active'
                             AND e.offering_plan_id IS NOT NULL) = 0
ORDER BY pr.full_name;

-- 7f. Cobros de los adultos. El pagador cae en user_id O en parent_id
--     segun el flujo, asi que hay que mirar los dos.
SELECT pr.full_name AS atleta,
       pay.created_at, pay.concept, pay.amount, pay.amount_paid,
       pay.status, pay.due_date, pay.payment_date, pay.payment_method,
       pay.period_year, pay.period_month,
       op.name AS plan_del_cobro,
       CASE WHEN pay.user_id   = pr.id THEN 'user_id'
            WHEN pay.parent_id = pr.id THEN 'parent_id' END AS amarrado_por,
       pay.id AS payment_id
FROM public.school_members sm
JOIN public.profiles pr  ON pr.id = sm.profile_id
JOIN public.payments pay ON pay.school_id = sm.school_id
                        AND pr.id IN (pay.user_id, pay.parent_id)
LEFT JOIN public.offering_plans op ON op.id = pay.offering_plan_id
WHERE sm.school_id = '773a4c06-2e33-4ecc-8b20-68c0a428a8f2'
  AND sm.role = 'athlete'
ORDER BY pr.full_name, pay.created_at DESC;
