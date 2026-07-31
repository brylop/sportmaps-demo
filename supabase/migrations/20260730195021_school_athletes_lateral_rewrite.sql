-- =============================================================================
-- 20260730195021_school_athletes_lateral_rewrite.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260730194230
-- Objetivo: school_athletes pasa de ~22 subconsultas correlacionadas por fila
--           a 4 LEFT JOIN LATERAL por rama. Es el query #1 de la aplicación
--           (4,98 % del tiempo total de BD) y el causante de la lentitud de
--           /deportistas.
-- =============================================================================
-- MEDICIÓN QUE MOTIVA EL CAMBIO (Dynasty, 424 atletas, 2026-07-30)
--
--   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM school_athletes WHERE school_id = <dynasty>
--     · como postgres (sin RLS):     1,4 ms ·      35 buffers
--     · como authenticated (con RLS): 555 ms · 107.627 buffers
--   pg_stat_statements: mean 840 ms · max 10.538 ms · 2.187 llamadas.
--
-- CAUSA
-- La vista traía ~22 subconsultas escalares correlacionadas por fila. Cada una
-- es un scan independiente de `enrollments` y, al ser la vista security_invoker,
-- arrastra su propio filtro RLS evaluado fila por fila
-- (is_school_admin(school_id) OR is_school_coach(school_id) OR …). En el plan
-- aparecen como ~22 SubPlan con loops=425, ~2.310 buffers cada uno, y todos con
-- un nodo `Sort` porque el ORDER BY created_at no tenía índice que lo soportara.
-- Aparte, el EXISTS de "¿tiene plan activo?" (SubPlan 46) costaba 88 ms él solo,
-- con un Seq Scan interno sobre `children` de 10.874 buffers para 742 filas.
--
-- QUÉ CAMBIA
-- Las ~22 subconsultas colapsan en 4 LATERAL por rama:
--   te  → inscripción de EQUIPO vigente (la más antigua)
--   pe  → inscripción de PLAN vigente (la más antigua)
--   pay → último pago
--   act → ¿existe alguna inscripción activa? (fallback de payment_status)
-- El criterio de desempate (ORDER BY e.created_at, gana la más antigua) es el
-- mismo que fijó 20260730170001: el plan/equipo mostrado NO cambia.
--
-- CONTRATO: las 33 columnas conservan nombre, orden y tipo. Ningún consumidor
-- (frontend, BFF, RPCs) necesita tocarse.
--
-- DOS DIFERENCIAS DELIBERADAS, solo alcanzables en estados imposibles para una
-- escuela mirando a sus propios atletas:
--   1. `teams` entra por LEFT JOIN (antes INNER en team_name / team_sport /
--      team_monthly_fee). Si un enrollment apuntara a un team invisible por RLS,
--      antes la fila se caía del pick y se elegía OTRA inscripción; ahora se
--      conserva el enrollment y solo el nombre queda NULL. Se prefiere no perder
--      al atleta del roster; team_monthly_fee ya tenía COALESCE(...,0).
--   2. `offering_plans` sigue por INNER JOIN, igual que antes, porque de ahí sale
--      la CUOTA. Pasarlo a LEFT podría devolver 0 donde antes había un monto
--      real, y eso es dinero.
--
-- ANTES DE APLICAR: correr el diff old-vs-new que está al final de este archivo
-- (bloque comentado) para confirmar 0 filas de diferencia sobre datos reales.
--
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ── 1. Índices que sostienen los LATERAL ─────────────────────────────────────
-- Parciales por status='active': es el único estado que la vista consulta, así
-- que el índice queda pequeño. `created_at` va en la clave para que el
-- ORDER BY … LIMIT 1 se resuelva por índice y desaparezcan los nodos Sort.
-- `enrollments` tiene ~1.000 filas activas: la creación es instantánea y no
-- necesita CONCURRENTLY.

CREATE INDEX IF NOT EXISTS idx_enrollments_child_active_created
    ON public.enrollments (child_id, created_at)
    WHERE status = 'active' AND child_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_user_school_active_created
    ON public.enrollments (user_id, school_id, created_at)
    WHERE status = 'active' AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_unregistered_active_created
    ON public.enrollments (unregistered_athlete_id, created_at)
    WHERE status = 'active' AND unregistered_athlete_id IS NOT NULL;

-- Último pago por atleta: (…, created_at DESC) resuelve el LIMIT 1 sin Sort.
CREATE INDEX IF NOT EXISTS idx_payments_child_school_created
    ON public.payments (child_id, school_id, created_at DESC)
    WHERE child_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_user_school_created
    ON public.payments (user_id, school_id, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_unregistered_school_created
    ON public.payments (unregistered_athlete_id, school_id, created_at DESC)
    WHERE unregistered_athlete_id IS NOT NULL;

-- ── 2. Vista reescrita ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.school_athletes
WITH (security_invoker = true) AS

-- ═══ RAMA 1: menores (children) ═════════════════════════════════════════════
SELECT c.id,
    c.full_name,
    c.avatar_url,
    c.school_id,
    COALESCE(c.branch_id, get_single_branch_id(c.school_id)) AS branch_id,
    c.team_id,
    c.date_of_birth,
    c.is_active,
    'child'::text AS athlete_type,
    c.parent_id,
    NULL::uuid AS user_id,
    c.medical_info,
    te.enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    -- Con plan activo el equipo es SOLO roster: cuota 0 SIEMPRE (el monthly_fee
    -- de la fila fusionada es el del plan). Sin plan, la cuota real del equipo.
    COALESCE(
        CASE WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
             ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
    CASE
        WHEN pe.offering_plan_id IS NOT NULL
            THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        WHEN te.enrollment_id IS NOT NULL
            THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
        ELSE COALESCE(c.monthly_fee, 0::numeric)
    END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
    COALESCE(p.email, c.parent_email_temp) AS parent_email,
    COALESCE(p.phone, c.parent_phone_temp) AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE WHEN act.has_active THEN 'pending'::text ELSE NULL::text END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL (
         SELECT e.id AS enrollment_id, e.team_id, e.start_date, e.monthly_fee,
                t.name AS team_name, t.sport AS team_sport,
                t.price_monthly AS team_price_monthly
           FROM enrollments e
           LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
          LIMIT 1
     ) te ON true
     LEFT JOIN LATERAL (
         SELECT e.offering_plan_id, e.start_date, e.monthly_fee, e.sessions_used,
                e.secondary_sessions_used, e.expires_at,
                op.name AS plan_name, op.price AS plan_price
           FROM enrollments e
           JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
          LIMIT 1
     ) pe ON true
     LEFT JOIN LATERAL (
         SELECT py.status, py.due_date
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id
          ORDER BY py.created_at DESC
          LIMIT 1
     ) pay ON true
     LEFT JOIN LATERAL (
         SELECT true AS has_active
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text
          LIMIT 1
     ) act ON true

UNION ALL

-- ═══ RAMA 2: adultos (profiles + school_members) ════════════════════════════
-- Ojo: todos los LATERAL filtran por e.school_id = sm.school_id. Sin eso, un
-- adulto inscrito en dos escuelas mostraba en la escuela A el plan y la cuota
-- de la escuela B (fuga corregida en 20260730170001; se conserva).
 SELECT pr.id,
    pr.full_name,
    pr.avatar_url,
    sm.school_id,
    COALESCE(te.team_branch_id, sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    te.team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    te.enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    COALESCE(
        CASE WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
             ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
    CASE
        WHEN pe.offering_plan_id IS NOT NULL
            THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        WHEN te.enrollment_id IS NOT NULL
            THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
        ELSE 0::numeric
    END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    pr.email AS parent_email,
    pr.phone AS parent_phone,
    COALESCE(
        ( SELECT sb.name FROM school_branches sb WHERE sb.id = te.team_branch_id),
        ( SELECT sb.name FROM school_branches sb WHERE sb.id = sm.branch_id),
        ( SELECT sb.name FROM school_branches sb WHERE sb.id = get_single_branch_id(sm.school_id))
    ) AS branch_name,
    COALESCE(pay.status,
        CASE WHEN act.has_active THEN 'pending'::text ELSE NULL::text END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL (
         SELECT e.id AS enrollment_id, e.team_id, e.start_date, e.monthly_fee,
                t.name AS team_name, t.sport AS team_sport,
                t.price_monthly AS team_price_monthly, t.branch_id AS team_branch_id
           FROM enrollments e
           LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id
            AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
          LIMIT 1
     ) te ON true
     LEFT JOIN LATERAL (
         SELECT e.offering_plan_id, e.start_date, e.monthly_fee, e.sessions_used,
                e.secondary_sessions_used, e.expires_at,
                op.name AS plan_name, op.price AS plan_price
           FROM enrollments e
           JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id
            AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
          LIMIT 1
     ) pe ON true
     LEFT JOIN LATERAL (
         SELECT py.status, py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id
          ORDER BY py.created_at DESC
          LIMIT 1
     ) pay ON true
     LEFT JOIN LATERAL (
         SELECT true AS has_active
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id
            AND e.status = 'active'::text
          LIMIT 1
     ) act ON true

UNION ALL

-- ═══ RAMA 3: no registrados (unregistered_athletes) ═════════════════════════
 SELECT ua.id,
    ua.full_name,
    NULL::text AS avatar_url,
    ua.school_id,
    COALESCE(ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    te.enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    COALESCE(
        CASE WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
             ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
    CASE
        WHEN pe.offering_plan_id IS NOT NULL
            THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        WHEN te.enrollment_id IS NOT NULL
            THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
        ELSE 0::numeric
    END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    ua.email AS parent_email,
    ua.phone AS parent_phone,
    COALESCE(
        ( SELECT sb.name FROM school_branches sb WHERE sb.id = ua.branch_id),
        ( SELECT sb.name FROM school_branches sb WHERE sb.id = get_single_branch_id(ua.school_id))
    ) AS branch_name,
    COALESCE(pay.status,
        CASE WHEN act.has_active THEN 'pending'::text ELSE NULL::text END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL (
         SELECT e.id AS enrollment_id, e.team_id, e.start_date, e.monthly_fee,
                t.name AS team_name, t.sport AS team_sport,
                t.price_monthly AS team_price_monthly
           FROM enrollments e
           LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
            AND e.team_id IS NOT NULL
          ORDER BY e.created_at
          LIMIT 1
     ) te ON true
     LEFT JOIN LATERAL (
         SELECT e.offering_plan_id, e.start_date, e.monthly_fee, e.sessions_used,
                e.secondary_sessions_used, e.expires_at,
                op.name AS plan_name, op.price AS plan_price
           FROM enrollments e
           JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
            AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
          LIMIT 1
     ) pe ON true
     LEFT JOIN LATERAL (
         SELECT py.status, py.due_date
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id
          ORDER BY py.created_at DESC
          LIMIT 1
     ) pay ON true
     LEFT JOIN LATERAL (
         SELECT true AS has_active
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
          LIMIT 1
     ) act ON true
  WHERE ua.linked_profile_id IS NULL;

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload config';

COMMIT;

-- =============================================================================
-- VERIFICACIÓN PREVIA (correr ANTES de aplicar, en una sesión aparte)
-- -----------------------------------------------------------------------------
-- Materializa el resultado de la vista ACTUAL, aplica la nueva, y compara.
-- Debe devolver 0 filas. Correr como el DUEÑO de la escuela (con RLS), no como
-- postgres, para que el universo de filas visibles sea el real.
--
--   -- 1. Snapshot con la vista vieja (antes de aplicar esta migración):
--   CREATE TABLE tmp_athletes_before AS
--     SELECT * FROM public.school_athletes;
--
--   -- 2. Aplicar esta migración.
--
--   -- 3. Diff simétrico: 0 filas = equivalencia total.
--   (SELECT * FROM tmp_athletes_before EXCEPT SELECT * FROM public.school_athletes)
--   UNION ALL
--   (SELECT * FROM public.school_athletes EXCEPT SELECT * FROM tmp_athletes_before);
--
--   -- 4. Limpieza:
--   DROP TABLE tmp_athletes_before;
--
-- NOTA: `CREATE TEMP TABLE` no sirve en el SQL Editor de Supabase (el pooler la
-- pierde entre statements). Por eso el snapshot es una tabla normal.
-- =============================================================================
