-- ============================================================================
-- PREFLIGHT F0 — Inscripciones y cobros duplicados
-- ----------------------------------------------------------------------------
-- Plan: docs/plan-f0-inscripciones-y-cobros-duplicados.md §2
--
-- SOLO LECTURA. Ninguna sentencia escribe, borra ni crea nada.
-- Correr en el SQL Editor de Supabase (como postgres, sin RLS: queremos ver
-- TODAS las escuelas, no solo las visibles para un usuario).
--
-- Ejecutar bloque por bloque (el editor corre sentencia por sentencia).
-- Sin CREATE TEMP TABLE ni RAISE NOTICE: el pooler pierde la temp entre
-- sentencias y el notice no se ve. Todo se reporta con SELECT.
-- Fecha: 2026-07-31
-- ============================================================================


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ BLOQUE A — Resumen. Es el único que hay que correr para decidir.        │
-- └──────────────────────────────────────────────────────────────────────────┘
WITH
estados AS (
  SELECT ARRAY['pending','awaiting_approval','paid','partial','overdue','glosado'] AS activos
),
p1 AS (
  SELECT count(*) AS n
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'payments'
     AND indexname IN ('uniq_payment_active_period_per_child',
                       'uniq_payment_active_period_per_adult',
                       'uniq_payment_active_period_per_unreg')
),
p1b AS (
  SELECT count(*) AS n
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'enrollments'
     AND indexname IN ('uq_enrollment_child_team','uq_enrollment_child_plan',
                       'uq_enrollment_user_team','uq_enrollment_user_plan')
),
p2 AS (
  SELECT count(*) AS atletas, COALESCE(sum(activas), 0) AS filas
    FROM (
      SELECT count(*) AS activas
        FROM public.enrollments
       WHERE status = 'active'
         AND COALESCE(child_id, user_id, unregistered_athlete_id) IS NOT NULL
       GROUP BY school_id, COALESCE(child_id, user_id, unregistered_athlete_id)
      HAVING count(*) > 1
    ) t
),
p3 AS (
  SELECT count(*) AS grupos, COALESCE(sum(exceso), 0) AS cobros_de_mas,
         COALESCE(sum(monto_exceso), 0) AS monto_de_mas
    FROM (
      SELECT count(*) - 1                    AS exceso,
             sum(amount) - max(amount)       AS monto_exceso
        FROM public.payments, estados
       WHERE period_year IS NOT NULL AND period_month IS NOT NULL
         AND status = ANY (estados.activos)
         AND COALESCE(child_id, user_id, unregistered_athlete_id, parent_id) IS NOT NULL
       GROUP BY school_id,
                COALESCE(child_id, user_id, unregistered_athlete_id, parent_id),
                period_year, period_month
      HAVING count(*) > 1
    ) t
),
p4 AS (
  SELECT count(*) AS n
    FROM public.payments, estados
   WHERE child_id IS NULL AND user_id IS NULL AND parent_id IS NOT NULL
     AND status = ANY (estados.activos)
),
p5 AS (
  SELECT count(*) AS n
    FROM public.payments, estados
   WHERE period_year IS NULL
     AND status = ANY (estados.activos)
)
SELECT 1 AS orden,
       'P1 · índices únicos de payments'                      AS chequeo,
       p1.n::text || ' de 3'                                  AS resultado,
       CASE WHEN p1.n = 3 THEN 'OK — la red de DB está puesta'
            ELSE 'APLICAR 20260724000001_payment_period_dedup_indexes.sql (ver P3 primero)'
       END                                                    AS accion
  FROM p1
UNION ALL
SELECT 2, 'P1b · índices únicos de enrollments',
       p1b.n::text || ' de 4',
       CASE WHEN p1b.n = 4 THEN 'OK'
            ELSE 'Revisar: el spec asume que existen los 4' END
  FROM p1b
UNION ALL
SELECT 3, 'P2 · atletas con >1 inscripción activa (defecto D)',
       p2.atletas::text || ' atletas / ' || p2.filas::text || ' filas',
       CASE WHEN p2.atletas = 0 THEN 'OK — nada que fusionar'
            ELSE 'Correr BLOQUE B y BLOQUE D (preview del merge)' END
  FROM p2
UNION ALL
SELECT 4, 'P3 · cobros duplicados por (atleta, periodo)',
       p3.grupos::text || ' grupos / ' || p3.cobros_de_mas::text || ' cobros de más / $'
         || to_char(p3.monto_de_mas, 'FM999G999G999G999'),
       CASE WHEN p3.grupos = 0 THEN 'OK'
            ELSE 'DINERO — correr BLOQUE C. El usuario decide qué se anula.' END
  FROM p3
UNION ALL
SELECT 5, 'P4 · hueco 1 — cobros de adulto legacy (parent_id, sin user_id)',
       p4.n::text,
       CASE WHEN p4.n = 0 THEN 'Hueco teórico: no agregar índice'
            ELSE 'Evaluar 4º índice único parcial (plan §3.4)' END
  FROM p4
UNION ALL
SELECT 6, 'P5 · hueco 2 — cobros activos sin period_year',
       p5.n::text,
       CASE WHEN p5.n = 0 THEN 'OK — todos los cobros vivos tienen periodo'
            ELSE 'Decidir: backfill de period_* o documentar la exclusión' END
  FROM p5
 ORDER BY orden;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ BLOQUE B — Detalle de P2: quiénes tienen más de una inscripción activa. │
-- └──────────────────────────────────────────────────────────────────────────┘
SELECT s.name                                                   AS escuela,
       COALESCE(c.full_name, pr.full_name, ua.full_name)        AS atleta,
       CASE WHEN e.child_id IS NOT NULL THEN 'menor'
            WHEN e.user_id  IS NOT NULL THEN 'adulto'
            ELSE 'no_registrado' END                            AS tipo,
       count(*)                                                 AS inscripciones_activas,
       count(*) FILTER (WHERE e.offering_plan_id IS NOT NULL)   AS con_plan,
       count(DISTINCT e.team_id) FILTER (WHERE e.team_id IS NOT NULL) AS equipos_distintos,
       array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL)   AS equipos,
       array_agg(DISTINCT op.name) FILTER (WHERE op.name IS NOT NULL) AS planes,
       array_agg(DISTINCT e.monthly_fee) FILTER (WHERE e.monthly_fee IS NOT NULL) AS cuotas,
       min(e.created_at)::date                                  AS primera,
       max(e.created_at)::date                                  AS ultima
  FROM public.enrollments e
  JOIN public.schools s                       ON s.id  = e.school_id
  LEFT JOIN public.children c                 ON c.id  = e.child_id
  LEFT JOIN public.profiles pr                ON pr.id = e.user_id
  LEFT JOIN public.unregistered_athletes ua   ON ua.id = e.unregistered_athlete_id
  LEFT JOIN public.teams t                    ON t.id  = e.team_id
  LEFT JOIN public.offering_plans op          ON op.id = e.offering_plan_id
 WHERE e.status = 'active'
   AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
 GROUP BY s.name, 2, 3, e.school_id,
          COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id)
HAVING count(*) > 1
 ORDER BY inscripciones_activas DESC, escuela, atleta;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ BLOQUE C — Detalle de P3: cobros duplicados. ESTO ES PLATA.             │
-- │ Puede haber uno ya pagado: no se anula nada sin que lo decidas.         │
-- └──────────────────────────────────────────────────────────────────────────┘
SELECT s.name                                            AS escuela,
       COALESCE(c.full_name, pr.full_name, ua.full_name,
                pp.full_name || ' (legacy parent_id)')   AS atleta,
       p.period_year || '-' || lpad(p.period_month::text, 2, '0') AS periodo,
       count(*)                                          AS cobros,
       sum(p.amount)                                     AS total,
       sum(p.amount) - max(p.amount)                     AS exceso,
       array_agg(p.status ORDER BY p.created_at)         AS estados,
       array_agg(p.amount ORDER BY p.created_at)         AS montos,
       array_agg(p.id     ORDER BY p.created_at)         AS payment_ids,
       bool_or(p.status IN ('paid','partial'))           AS hay_alguno_pagado
  FROM public.payments p
  JOIN public.schools s                      ON s.id  = p.school_id
  LEFT JOIN public.children c                ON c.id  = p.child_id
  LEFT JOIN public.profiles pr               ON pr.id = p.user_id
  LEFT JOIN public.unregistered_athletes ua  ON ua.id = p.unregistered_athlete_id
  LEFT JOIN public.profiles pp               ON pp.id = p.parent_id
                                            AND p.child_id IS NULL AND p.user_id IS NULL
 WHERE p.period_year IS NOT NULL AND p.period_month IS NOT NULL
   AND p.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
   AND COALESCE(p.child_id, p.user_id, p.unregistered_athlete_id, p.parent_id) IS NOT NULL
 GROUP BY s.name, 2, p.school_id,
          COALESCE(p.child_id, p.user_id, p.unregistered_athlete_id, p.parent_id),
          p.period_year, p.period_month
HAVING count(*) > 1
 ORDER BY hay_alguno_pagado DESC, exceso DESC;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ BLOQUE D — Preview del merge (plan §3.3). NO ESCRIBE.                   │
-- │ Criterio: sobrevive la que tiene plan; si empatan, la más antigua.      │
-- │ La cuota gana al alza (máximo no-cero). Verificar antes de ejecutar.    │
-- └──────────────────────────────────────────────────────────────────────────┘
WITH activas AS (
  SELECT e.id, e.school_id, e.team_id, e.offering_plan_id, e.monthly_fee,
         e.sessions_used, e.secondary_sessions_used, e.created_at,
         COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) AS subject_id,
         row_number() OVER (
           PARTITION BY e.school_id, COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id)
           ORDER BY (e.offering_plan_id IS NOT NULL) DESC,  -- 1º: la que tiene plan
                    e.created_at                            -- 2º: la más antigua
         ) AS rn,
         count(*) OVER (
           PARTITION BY e.school_id, COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id)
         ) AS n_activas
    FROM public.enrollments e
   WHERE e.status = 'active'
     AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
),
grupos AS (
  SELECT school_id, subject_id,
         max(n_activas)                                                          AS activas,
         (array_agg(id ORDER BY rn))[1]                                          AS keep_id,
         array_agg(id ORDER BY rn) FILTER (WHERE rn > 1)                         AS drop_ids,
         (array_agg(team_id ORDER BY rn) FILTER (WHERE team_id IS NOT NULL))[1]  AS team_id_final,
         (array_agg(offering_plan_id ORDER BY rn)
            FILTER (WHERE offering_plan_id IS NOT NULL))[1]                      AS plan_id_final,
         max(NULLIF(monthly_fee, 0))                                             AS fee_final,
         count(DISTINCT team_id) FILTER (WHERE team_id IS NOT NULL)              AS equipos_distintos,
         count(DISTINCT offering_plan_id) FILTER (WHERE offering_plan_id IS NOT NULL) AS planes_distintos,
         max(sessions_used)                                                      AS sessions_used_final,
         max(secondary_sessions_used)                                            AS secondary_final
    FROM activas
   GROUP BY school_id, subject_id
  HAVING max(n_activas) > 1
)
SELECT s.name                                             AS escuela,
       COALESCE(c.full_name, pr.full_name, ua.full_name)  AS atleta,
       g.activas,
       g.keep_id                                          AS sobrevive,
       g.drop_ids                                         AS se_cancelan,
       tf.name                                            AS equipo_final,
       opf.name                                           AS plan_final,
       g.fee_final                                        AS cuota_final,
       g.sessions_used_final,
       g.secondary_final,
       CASE
         WHEN g.equipos_distintos > 1 AND g.planes_distintos > 1
           THEN '⚠ pierde equipos Y planes — revisar a mano'
         WHEN g.equipos_distintos > 1 THEN '⚠ tiene ' || g.equipos_distintos || ' equipos: solo queda uno'
         WHEN g.planes_distintos  > 1 THEN '⚠ tiene ' || g.planes_distintos  || ' planes: solo queda uno'
         ELSE 'limpio — equipo-solo + plan-solo'
       END                                                AS advertencia
  FROM grupos g
  JOIN public.schools s                      ON s.id   = g.school_id
  LEFT JOIN public.children c                ON c.id   = g.subject_id
  LEFT JOIN public.profiles pr               ON pr.id  = g.subject_id
  LEFT JOIN public.unregistered_athletes ua  ON ua.id  = g.subject_id
  LEFT JOIN public.teams tf                  ON tf.id  = g.team_id_final
  LEFT JOIN public.offering_plans opf        ON opf.id = g.plan_id_final
 ORDER BY (g.equipos_distintos > 1 OR g.planes_distintos > 1) DESC, g.activas DESC, escuela;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ BLOQUE E — Qué generaría open_month HOY vs. después del DISTINCT ON.    │
-- │ Reproduce la cascada de monto del RPC sin insertar nada.                │
-- └──────────────────────────────────────────────────────────────────────────┘
WITH base AS (
  SELECT e.school_id,
         COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) AS subject_id,
         COALESCE(c.full_name, pr.full_name, ua.full_name)          AS atleta,
         COALESCE(
           NULLIF(e.monthly_fee, 0),
           NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
           NULLIF(t.price_monthly, 0),
           NULLIF(c.monthly_fee, 0),
           0
         ) AS amount,
         e.offering_plan_id, e.created_at
    FROM public.enrollments e
    LEFT JOIN public.children c                ON c.id  = e.child_id
    LEFT JOIN public.profiles pr               ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes ua  ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams t                   ON t.id  = e.team_id
   WHERE e.status = 'active'
     AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
),
con_monto AS (SELECT * FROM base WHERE amount > 0),
-- La fila que sobreviviría al DISTINCT ON del plan §3.1 (mismo desempate que el merge)
elegidas AS (
  SELECT DISTINCT ON (school_id, subject_id) school_id, subject_id, amount
    FROM con_monto
   ORDER BY school_id, subject_id,
            (offering_plan_id IS NOT NULL) DESC, amount DESC, created_at
),
hoy     AS (SELECT school_id, count(*) AS filas, sum(amount) AS monto FROM con_monto GROUP BY school_id),
despues AS (SELECT school_id, count(*) AS filas, sum(amount) AS monto FROM elegidas  GROUP BY school_id)
SELECT s.name                AS escuela,
       h.filas               AS cobros_que_intenta_hoy,
       d.filas               AS cobros_con_distinct_on,
       h.filas - d.filas     AS cobros_de_mas_evitados,
       h.monto               AS monto_hoy,
       d.monto               AS monto_con_distinct_on,
       h.monto - d.monto     AS monto_de_mas_evitado
  FROM hoy h
  JOIN despues d USING (school_id)
  JOIN public.schools s ON s.id = h.school_id
 WHERE h.filas > d.filas
 ORDER BY cobros_de_mas_evitados DESC;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ BLOQUE I — Los que cobran por 2+ filas: ¿duplicado real o multi-         │
-- │ disciplina hecha a mano? Resultado del preflight 2026-07-31: 21 atletas. │
-- │ OJO: `children` también tiene team_id → calificar cobran.team_id.        │
-- └──────────────────────────────────────────────────────────────────────────┘
WITH activas AS (
  SELECT e.id, e.school_id, e.team_id, e.offering_plan_id, e.created_at,
         COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) AS subject_id,
         COALESCE(
           NULLIF(e.monthly_fee, 0),
           NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
           NULLIF(t.price_monthly, 0),
           NULLIF(c.monthly_fee, 0), 0) AS amount,
         t.name AS equipo, lower(t.sport) AS deporte, op2.name AS plan
    FROM public.enrollments e
    LEFT JOIN public.children c         ON c.id   = e.child_id
    LEFT JOIN public.teams t            ON t.id   = e.team_id
    LEFT JOIN public.offering_plans op2 ON op2.id = e.offering_plan_id
   WHERE e.status = 'active'
     AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
),
cobran AS (SELECT * FROM activas WHERE amount > 0)
SELECT s.name                                              AS escuela,
       COALESCE(c.full_name, pr.full_name, ua.full_name)   AS atleta,
       count(*)                                            AS filas_que_cobran,
       count(DISTINCT COALESCE(cobran.deporte, '—'))       AS deportes_distintos,
       array_agg(COALESCE(cobran.equipo, '(sin equipo)') || ' / ' || COALESCE(cobran.plan, '(sin plan)')
                 || ' = $' || to_char(cobran.amount, 'FM999G999G999')
                 ORDER BY cobran.amount DESC)              AS desglose,
       sum(cobran.amount)                                  AS total_hoy,
       max(cobran.amount)                                  AS quedaria_si_fusiono_al_max,
       sum(cobran.amount) - max(cobran.amount)             AS diferencia,
       CASE
         WHEN count(DISTINCT COALESCE(cobran.deporte, '—')) > 1
           THEN '🟢 MULTI-DISCIPLINA — NO fusionar, la escuela cobra las dos a propósito'
         WHEN count(DISTINCT cobran.team_id) FILTER (WHERE cobran.team_id IS NOT NULL) > 1
           THEN '🟡 mismo deporte, dos equipos — preguntar a la escuela'
         ELSE '🔴 DUPLICADO REAL — mismo equipo/plan repetido, fusionar'
       END                                                 AS veredicto
  FROM cobran
  JOIN public.schools s                      ON s.id  = cobran.school_id
  LEFT JOIN public.children c                ON c.id  = cobran.subject_id
  LEFT JOIN public.profiles pr               ON pr.id = cobran.subject_id
  LEFT JOIN public.unregistered_athletes ua  ON ua.id = cobran.subject_id
 GROUP BY s.name, 2, cobran.school_id, cobran.subject_id
HAVING count(*) > 1
 ORDER BY veredicto, diferencia DESC;
