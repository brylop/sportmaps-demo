-- ============================================================
-- F0 (1/3) — Índices únicos de dedup por periodo para las 3 identidades
-- ------------------------------------------------------------
-- Cierra:
--   H1 — el único índice existente (`uniq_payment_active_period_per_child`)
--        solo cubría MENORES (child_id). Adultos (user_id) y no-registrados
--        (unregistered_athlete_id) quedaban SIN red de DB → duplicaban.
--   Hueco de estados — el índice viejo excluía 'overdue' y 'glosado', así que
--        al pasar un cobro a overdue (apply_late_fees) se salía del índice y
--        dejaba de estar protegido. Aquí se corrige con un set de estados
--        "activos" consistente en los 3 índices.
--
-- Conjunto canónico de estados ACTIVOS (obligación viva):
--   pending, awaiting_approval, paid, partial, overdue, glosado
--   (se excluyen failed, cancelled, rejected — 'approved' no existe en el CHECK real).
--
-- PREFLIGHT: si ya existen duplicados ACTIVOS con periodo poblado, el
-- CREATE UNIQUE INDEX fallaría con un 23505 críptico. En su lugar abortamos
-- con un mensaje claro para que se limpien primero (es dinero: no los toco).
-- Los duplicados con period NULL NO bloquean (el índice parcial los ignora).
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_child int; v_adult int; v_unreg int;
BEGIN
  SELECT count(*) INTO v_child FROM (
    SELECT 1 FROM public.payments
    WHERE child_id IS NOT NULL AND period_year IS NOT NULL AND period_month IS NOT NULL
      AND status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
    GROUP BY child_id, period_year, period_month HAVING count(*) > 1
  ) t;

  SELECT count(*) INTO v_adult FROM (
    SELECT 1 FROM public.payments
    WHERE child_id IS NULL AND user_id IS NOT NULL
      AND period_year IS NOT NULL AND period_month IS NOT NULL
      AND status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
    GROUP BY user_id, period_year, period_month HAVING count(*) > 1
  ) t;

  SELECT count(*) INTO v_unreg FROM (
    SELECT 1 FROM public.payments
    WHERE unregistered_athlete_id IS NOT NULL
      AND period_year IS NOT NULL AND period_month IS NOT NULL
      AND status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
    GROUP BY unregistered_athlete_id, period_year, period_month HAVING count(*) > 1
  ) t;

  IF v_child + v_adult + v_unreg > 0 THEN
    RAISE EXCEPTION
      'F0: duplicados activos con periodo poblado (menores=%, adultos=%, no_registrados=%). Limpiar antes de crear los indices unicos.',
      v_child, v_adult, v_unreg;
  END IF;
END $$;

-- Menor: reemplaza el índice viejo (que excluía overdue/glosado)
DROP INDEX IF EXISTS public.uniq_payment_active_period_per_child;
CREATE UNIQUE INDEX uniq_payment_active_period_per_child
  ON public.payments (child_id, period_year, period_month)
  WHERE child_id IS NOT NULL
    AND period_year IS NOT NULL AND period_month IS NOT NULL
    AND status IN ('pending','awaiting_approval','paid','partial','overdue','glosado');

-- Adulto (H1) — pago sin child_id, identificado por user_id
CREATE UNIQUE INDEX uniq_payment_active_period_per_adult
  ON public.payments (user_id, period_year, period_month)
  WHERE child_id IS NULL AND user_id IS NOT NULL
    AND period_year IS NOT NULL AND period_month IS NOT NULL
    AND status IN ('pending','awaiting_approval','paid','partial','overdue','glosado');

-- No registrado (H1)
CREATE UNIQUE INDEX uniq_payment_active_period_per_unreg
  ON public.payments (unregistered_athlete_id, period_year, period_month)
  WHERE unregistered_athlete_id IS NOT NULL
    AND period_year IS NOT NULL AND period_month IS NOT NULL
    AND status IN ('pending','awaiting_approval','paid','partial','overdue','glosado');

COMMIT;
