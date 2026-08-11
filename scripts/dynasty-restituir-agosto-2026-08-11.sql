-- ============================================================================
-- DYNASTY — restituir el cobro de AGOSTO 2026 a los atletas a los que el
-- cambio de plan se lo canceló y lo reemitió con período de JULIO.
--
-- Contexto
-- --------
-- Al cambiar el plan de un atleta, PUT /students/:id cancela su cobro impago y
-- emite uno nuevo. Eso es correcto. El defecto era el PERÍODO del reemplazo:
-- se calculaba sobre `plan_start_date`, que el editor manda prellenado con la
-- fecha de inscripción ORIGINAL. Resultado: el cobro nuevo nacía con el período
-- de un mes ya cerrado (julio) y en mora, y como el de agosto se acababa de
-- cancelar, agosto quedaba sin facturar.
--
-- El código ya está arreglado (billingStartForChange en students.ts): de acá en
-- adelante el reemplazo va al mes del cambio. Este script repara lo que ya pasó.
--
-- Criterio de identificación (los tres tienen que darse):
--   1. Existe un cobro con concepto 'Plan …' cuyo período es ANTERIOR al mes en
--      que se creó.
--   2. El mismo atleta tiene un cobro de agosto 2026 CANCELADO dentro de los
--      120 segundos de creado ese cobro de julio → es la misma operación, no una
--      coincidencia.
--   3. Hoy NO tiene ningún cobro de agosto vivo (nada distinto de 'cancelled').
--
-- Decisiones tomadas (cambiar acá si no son las que querés):
--   · MONTO = la cuota vigente del atleta: enrollments.monthly_fee y, si está
--     en NULL, offering_plans.price. Es la misma precedencia que usa el resto
--     del sistema. NO se reusa el monto del cobro cancelado: puede ser del plan
--     viejo.
--   · VENCIMIENTO = public.qr_first_charge_due_date(escuela, CURRENT_DATE), o
--     sea el más tardío entre el corte del mes y hoy + días de gracia, recortado
--     a fin de mes. Se usa esta regla —y no el corte pelado, que ya pasó— para
--     que el cobro NO nazca vencido: la familia no tiene por qué heredar una
--     mora que originó un bug nuestro. Si preferís el corte canónico (10-ago),
--     reemplazá esa llamada por public.school_due_date(school_id, 2026, 8).
--   · Los cobros de JULIO NO se tocan. Cobrar clases viejas impagas es decisión
--     de la escuela. El PASO 4 (opcional, comentado) los anula si deciden que no.
--
-- Ejecución: PASO 1 (revisar) → PASO 2 (aplicar) → PASO 3 (verificar).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1 — REVISAR. No escribe nada. Es exactamente lo que insertaría el PASO 2.
-- ─────────────────────────────────────────────────────────────────────────────
WITH escuela AS (
    SELECT id FROM public.schools WHERE name = 'DYNASTY VOLLEY CLUB'
),
retro AS (
    -- (1) cobros de cambio de plan con período retrofechado
    SELECT p.id, p.school_id, p.child_id, p.user_id, p.unregistered_athlete_id,
           p.amount AS monto_julio, p.period_year, p.period_month,
           p.status AS estado_julio, p.created_at
      FROM public.payments p
      JOIN escuela e ON e.id = p.school_id
     WHERE p.concept LIKE 'Plan %'
       AND p.period_year IS NOT NULL
       AND p.period_month IS NOT NULL
       AND make_date(p.period_year, p.period_month, 1)
           < date_trunc('month', p.created_at)::date
       AND p.created_at >= '2026-07-01'
),
pares AS (
    -- (2) el cobro de agosto que la MISMA operación canceló
    SELECT r.*,
           c.id     AS cobro_cancelado,
           c.amount AS monto_cancelado
      FROM retro r
      JOIN public.payments c
        ON c.school_id   = r.school_id
       AND c.status       = 'cancelled'
       AND c.period_year  = 2026
       AND c.period_month = 8
       AND COALESCE(c.child_id::text, c.user_id::text, c.unregistered_athlete_id::text)
         = COALESCE(r.child_id::text, r.user_id::text, r.unregistered_athlete_id::text)
       AND abs(extract(epoch FROM (c.updated_at - r.created_at))) < 120
),
faltantes AS (
    -- (3) y que hoy no tienen agosto vivo. Una fila por atleta.
    SELECT DISTINCT ON (COALESCE(p.child_id::text, p.user_id::text, p.unregistered_athlete_id::text))
           p.*
      FROM pares p
     WHERE NOT EXISTS (
         SELECT 1
           FROM public.payments q
          WHERE q.school_id    = p.school_id
            AND q.period_year  = 2026
            AND q.period_month = 8
            AND q.status <> 'cancelled'
            AND COALESCE(q.child_id::text, q.user_id::text, q.unregistered_athlete_id::text)
              = COALESCE(p.child_id::text, p.user_id::text, p.unregistered_athlete_id::text)
     )
     ORDER BY COALESCE(p.child_id::text, p.user_id::text, p.unregistered_athlete_id::text),
              p.created_at DESC
),
propuesta AS (
    SELECT f.school_id,
           f.child_id,
           f.user_id,
           f.unregistered_athlete_id,
           ch.full_name,
           ch.parent_id,
           insc.offering_plan_id,
           op.name  AS plan,
           COALESCE(insc.monthly_fee, op.price) AS monto,
           public.qr_first_charge_due_date(f.school_id, CURRENT_DATE) AS vence,
           f.monto_julio,
           f.estado_julio,
           f.monto_cancelado
      FROM faltantes f
      LEFT JOIN public.children ch ON ch.id = f.child_id
      -- La inscripción activa CON plan. LATERAL + LIMIT 1 porque un atleta puede
      -- tener más de una activa (dos disciplinas) y solo una lleva el plan.
      LEFT JOIN LATERAL (
          SELECT e.monthly_fee, e.offering_plan_id
            FROM public.enrollments e
           WHERE e.school_id = f.school_id
             AND e.status    = 'active'
             AND e.offering_plan_id IS NOT NULL
             AND COALESCE(e.child_id::text, e.user_id::text, e.unregistered_athlete_id::text)
               = COALESCE(f.child_id::text, f.user_id::text, f.unregistered_athlete_id::text)
           ORDER BY e.created_at
           LIMIT 1
      ) insc ON true
      LEFT JOIN public.offering_plans op ON op.id = insc.offering_plan_id
)
SELECT full_name                                   AS atleta,
       plan,
       monto                                       AS agosto_a_emitir,
       vence,
       monto_cancelado                             AS agosto_que_se_cancelo,
       monto_julio,
       estado_julio,
       CASE WHEN parent_id IS NULL THEN 'SIN ACUDIENTE — nacerá impagable online' END AS alerta_pagador,
       CASE WHEN monto IS NULL OR monto <= 0       THEN 'SIN CUOTA — no se emitirá' END AS alerta_monto
  FROM propuesta
 ORDER BY full_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2 — APLICAR. Corre la misma consulta y escribe.
--
-- Si un atleta ya tuviera agosto vivo, el índice único parcial
-- uniq_payment_active_period_per_child lo rechazaría; el NOT EXISTS del CTE ya
-- lo evita, así que no hace falta ON CONFLICT.
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

WITH escuela AS (
    SELECT id FROM public.schools WHERE name = 'DYNASTY VOLLEY CLUB'
),
retro AS (
    SELECT p.id, p.school_id, p.child_id, p.user_id, p.unregistered_athlete_id,
           p.created_at
      FROM public.payments p
      JOIN escuela e ON e.id = p.school_id
     WHERE p.concept LIKE 'Plan %'
       AND p.period_year IS NOT NULL
       AND p.period_month IS NOT NULL
       AND make_date(p.period_year, p.period_month, 1)
           < date_trunc('month', p.created_at)::date
       AND p.created_at >= '2026-07-01'
),
pares AS (
    SELECT r.*
      FROM retro r
      JOIN public.payments c
        ON c.school_id   = r.school_id
       AND c.status       = 'cancelled'
       AND c.period_year  = 2026
       AND c.period_month = 8
       AND COALESCE(c.child_id::text, c.user_id::text, c.unregistered_athlete_id::text)
         = COALESCE(r.child_id::text, r.user_id::text, r.unregistered_athlete_id::text)
       AND abs(extract(epoch FROM (c.updated_at - r.created_at))) < 120
),
faltantes AS (
    SELECT DISTINCT ON (COALESCE(p.child_id::text, p.user_id::text, p.unregistered_athlete_id::text))
           p.*
      FROM pares p
     WHERE NOT EXISTS (
         SELECT 1
           FROM public.payments q
          WHERE q.school_id    = p.school_id
            AND q.period_year  = 2026
            AND q.period_month = 8
            AND q.status <> 'cancelled'
            AND COALESCE(q.child_id::text, q.user_id::text, q.unregistered_athlete_id::text)
              = COALESCE(p.child_id::text, p.user_id::text, p.unregistered_athlete_id::text)
     )
     ORDER BY COALESCE(p.child_id::text, p.user_id::text, p.unregistered_athlete_id::text),
              p.created_at DESC
)
INSERT INTO public.payments (
    school_id, child_id, user_id, unregistered_athlete_id, parent_id,
    offering_plan_id, concept, amount, status, payment_type,
    due_date, period_year, period_month
)
SELECT f.school_id,
       f.child_id,
       f.user_id,
       f.unregistered_athlete_id,
       -- Sin pagador el guard anti-IDOR de create-session responde 403 al propio
       -- acudiente y el cobro es impagable online.
       ch.parent_id,
       insc.offering_plan_id,
       'Mensualidad 08/2026 - ' || COALESCE(ch.full_name, 'Atleta'),
       COALESCE(insc.monthly_fee, op.price),
       -- payments.status es TEXT, no el enum pay_status: literal pelado.
       'pending',
       -- payment_type solo admite one_time | subscription.
       'one_time',
       public.qr_first_charge_due_date(f.school_id, CURRENT_DATE),
       2026,
       8
  FROM faltantes f
  LEFT JOIN public.children ch ON ch.id = f.child_id
  LEFT JOIN LATERAL (
      SELECT e.monthly_fee, e.offering_plan_id
        FROM public.enrollments e
       WHERE e.school_id = f.school_id
         AND e.status    = 'active'
         AND e.offering_plan_id IS NOT NULL
         AND COALESCE(e.child_id::text, e.user_id::text, e.unregistered_athlete_id::text)
           = COALESCE(f.child_id::text, f.user_id::text, f.unregistered_athlete_id::text)
       ORDER BY e.created_at
       LIMIT 1
  ) insc ON true
  LEFT JOIN public.offering_plans op ON op.id = insc.offering_plan_id
 WHERE COALESCE(insc.monthly_fee, op.price) > 0;

COMMIT;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3 — VERIFICAR. Agosto 2026 de los atletas que aparecieron en el PASO 1.
-- ─────────────────────────────────────────────────────────────────────────────
/*
SELECT ch.full_name AS atleta,
       p.status,
       p.amount,
       p.due_date,
       p.period_year || '-' || lpad(p.period_month::text, 2, '0') AS periodo,
       p.parent_id IS NOT NULL AS tiene_pagador,
       p.created_at
  FROM public.payments p
  JOIN public.schools s  ON s.id  = p.school_id AND s.name = 'DYNASTY VOLLEY CLUB'
  LEFT JOIN public.children ch ON ch.id = p.child_id
 WHERE p.period_year = 2026
   AND p.period_month IN (7, 8)
   AND (p.concept LIKE 'Plan %' OR p.concept LIKE 'Mensualidad 08/2026%')
 ORDER BY ch.full_name, p.period_month, p.created_at;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4 (OPCIONAL) — anular los cobros de JULIO que nacieron de este defecto y
-- siguen impagos. Solo si la escuela decide NO cobrar esas clases viejas.
-- Los que la familia ya pagó (status 'paid') quedan intactos a propósito.
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

UPDATE public.payments p
   SET status     = 'cancelled',
       updated_at = now()
  FROM public.schools s
 WHERE s.id = p.school_id
   AND s.name = 'DYNASTY VOLLEY CLUB'
   AND p.concept LIKE 'Plan %'
   AND p.period_year = 2026
   AND p.period_month < 8
   AND p.status IN ('pending', 'overdue')
   AND p.created_at >= '2026-07-01'
   AND make_date(p.period_year, p.period_month, 1)
       < date_trunc('month', p.created_at)::date;

COMMIT;
*/
