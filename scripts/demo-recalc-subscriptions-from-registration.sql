-- =============================================================================
-- DEMO — Recalcular trial / periodo / status de school_subscriptions
--        a partir de la FECHA DE REGISTRO real (schools.created_at).
--
-- Regla:
--   * trial = created_at + N días   (N = 7 para Elite, 14 para el resto)
--   * hoy < fin de trial  -> status 'trialing'  (con trial_ends_at, sin periodo)
--   * hoy >= fin de trial -> status 'active'     (periodo mensual vigente anclado
--                                                 al día del fin de trial)
--   * plan_code = 'enterprise' -> NO se toca (Custom / venta directa)
--
-- Idempotente: recalcula desde created_at cada vez que se corre.
-- Ejecutar en el SQL Editor de Supabase (proyecto de develop).
--
-- NOTA sobre 'starter' (Free Start): en saas-plans.ts es gratis permanente.
--   Aquí también recibe el trial de 14d por pedido explícito (basar todo en la
--   fecha de registro). Si prefieres dejar starter como free sin trial,
--   descomenta la línea marcada [EXCLUIR STARTER] en el WHERE de ambos pasos.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1 — PREVIEW (solo lectura). Revisa antes de aplicar el UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
WITH calc AS (
  SELECT
    ss.id,
    s.name                                   AS escuela,
    s.email                                  AS correo,
    s.created_at                             AS registro,
    ss.plan_code,
    CASE ss.plan_code WHEN 'elite' THEN 7 ELSE 14 END        AS trial_days,
    (s.created_at + make_interval(days =>
        CASE ss.plan_code WHEN 'elite' THEN 7 ELSE 14 END))  AS trial_end,
    now()                                    AS now_ts
  FROM school_subscriptions ss
  JOIN schools s ON s.id = ss.school_id
  WHERE ss.plan_code <> 'enterprise'
    -- AND ss.plan_code <> 'starter'   -- [EXCLUIR STARTER]
),
mses AS (
  SELECT c.*,
    GREATEST(0, (
      (EXTRACT(YEAR  FROM c.now_ts) - EXTRACT(YEAR  FROM c.trial_end)) * 12
    + (EXTRACT(MONTH FROM c.now_ts) - EXTRACT(MONTH FROM c.trial_end))
    - CASE WHEN EXTRACT(DAY FROM c.now_ts) < EXTRACT(DAY FROM c.trial_end)
           THEN 1 ELSE 0 END
    )::int) AS months_elapsed
  FROM calc c
)
SELECT
  escuela, correo, registro::date AS registro, plan_code,
  trial_end::date AS fin_trial,
  CASE WHEN now_ts < trial_end THEN 'trialing' ELSE 'active' END AS nuevo_status,
  CASE WHEN now_ts >= trial_end
       THEN (trial_end + make_interval(months => months_elapsed))::date END      AS periodo_inicio,
  CASE WHEN now_ts >= trial_end
       THEN (trial_end + make_interval(months => months_elapsed + 1))::date END  AS proximo_cobro,
  CASE WHEN now_ts < trial_end
       THEN CEIL(EXTRACT(EPOCH FROM (trial_end - now_ts)) / 86400)::int END       AS dias_trial_rest
FROM mses
ORDER BY registro DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2 — APLICAR. Corre esto cuando el preview se vea bien.
-- ─────────────────────────────────────────────────────────────────────────────
WITH calc AS (
  SELECT
    ss.id,
    ss.plan_code,
    (s.created_at + make_interval(days =>
        CASE ss.plan_code WHEN 'elite' THEN 7 ELSE 14 END)) AS trial_end,
    now() AS now_ts
  FROM school_subscriptions ss
  JOIN schools s ON s.id = ss.school_id
  WHERE ss.plan_code <> 'enterprise'
    -- AND ss.plan_code <> 'starter'   -- [EXCLUIR STARTER]
),
mses AS (
  SELECT c.*,
    GREATEST(0, (
      (EXTRACT(YEAR  FROM c.now_ts) - EXTRACT(YEAR  FROM c.trial_end)) * 12
    + (EXTRACT(MONTH FROM c.now_ts) - EXTRACT(MONTH FROM c.trial_end))
    - CASE WHEN EXTRACT(DAY FROM c.now_ts) < EXTRACT(DAY FROM c.trial_end)
           THEN 1 ELSE 0 END
    )::int) AS months_elapsed
  FROM calc c
)
UPDATE school_subscriptions ss SET
  trial_ends_at        = m.trial_end,
  status               = CASE WHEN m.now_ts < m.trial_end THEN 'trialing' ELSE 'active' END,
  billing_cycle        = COALESCE(ss.billing_cycle, 'monthly'),
  current_period_start = CASE WHEN m.now_ts >= m.trial_end
                              THEN m.trial_end + make_interval(months => m.months_elapsed) END,
  current_period_end   = CASE WHEN m.now_ts >= m.trial_end
                              THEN m.trial_end + make_interval(months => m.months_elapsed + 1) END,
  updated_at           = now()
FROM mses m
WHERE m.id = ss.id;
