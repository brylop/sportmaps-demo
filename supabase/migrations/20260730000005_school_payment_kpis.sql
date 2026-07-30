-- ============================================================
-- KPIs de pagos agregados en el servidor (arregla el "Histórico acumulado" falso)
-- ------------------------------------------------------------
-- BUG: PaymentsAutomationPage cargaba los pagos con .limit(100) ordenado por
--   created_at DESC y calculaba las 4 tarjetas sobre ESE array. En una escuela
--   con >100 cobros creados en pocas horas, la ventana de 100 filas cubría solo
--   unas horas y las tarjetas mentían:
--     Ingresos Totales  $150.000  (real: $1.250.000 — 7 de 8 pagos fuera de la ventana)
--     Transacciones     100       (real: 8 — contaba cobros pendientes como transacciones)
--     Tasa Aprobación   1%        (real: 100%)
--   Subir el límite solo mueve el bug más arriba: la agregación tiene que pasar
--   en la DB, no sobre una página de resultados.
--
-- SEMÁNTICA (la anterior estaba mal, no solo truncada):
--   · revenue_total  = dinero REALMENTE recibido, histórico completo.
--                      paid → LEAST(amount, amount_paid) (deja la base sin fee de
--                      pasarela, igual que cash_ledger); partial → amount_paid.
--   · tx_count       = transacciones REALES (paid|partial). Un cobro emitido y no
--                      pagado NO es una transacción: no se movió plata.
--   · charges_total  = cobros emitidos (todos los estados) — dato aparte.
--   · approval_rate  = sobre INTENTOS de pago (paid|partial|rejected|failed), no
--                      sobre cobros emitidos. NULL si no hubo ningún intento.
--   · awaiting_*     = "Por Validar": comprobante reportado esperando aprobación
--                      (mismo criterio que la pestaña Cobros del frontend).
--   · debt_*         = deuda viva por cobrar (saldo, no el total del cobro).
--
-- Solo lectura: no cambia datos ni esquema, agrega una función.
-- Fecha: 2026-07-30
-- ============================================================

CREATE OR REPLACE FUNCTION public.school_payment_kpis(
  p_school_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_out    jsonb;
BEGIN
  -- Mismo gate que open_month/preview_open_month. service_role y el cron corren
  -- sin auth.uid() (v_caller NULL) y pasan.
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para ver los KPIs de pagos de esta escuela.';
  END IF;

  SELECT jsonb_build_object(
    'revenue_total',
      COALESCE(SUM(CASE WHEN p.status = 'paid'
                          THEN LEAST(p.amount, COALESCE(p.amount_paid, p.amount))
                        WHEN p.status = 'partial'
                          THEN COALESCE(p.amount_paid, 0)
                        ELSE 0 END), 0),

    'tx_count',      count(*) FILTER (WHERE p.status IN ('paid', 'partial')),
    'charges_total', count(*),

    'awaiting_count',
      count(*) FILTER (WHERE p.status = 'awaiting_approval'
                          OR (p.status = 'pending' AND COALESCE(p.receipt_url, '') <> '')),
    'awaiting_amount',
      COALESCE(SUM(CASE WHEN p.status = 'awaiting_approval'
                          OR (p.status = 'pending' AND COALESCE(p.receipt_url, '') <> '')
                        THEN GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                        ELSE 0 END), 0),

    'debt_count',  count(*) FILTER (WHERE p.status IN ('pending', 'overdue', 'glosado')),
    'debt_amount',
      COALESCE(SUM(CASE WHEN p.status IN ('pending', 'overdue', 'glosado')
                        THEN GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                        ELSE 0 END), 0),

    'attempts', count(*) FILTER (WHERE p.status IN ('paid', 'partial', 'rejected', 'failed')),
    'approval_rate',
      CASE WHEN count(*) FILTER (WHERE p.status IN ('paid', 'partial', 'rejected', 'failed')) = 0
           THEN NULL
           ELSE round(
                  100.0 * count(*) FILTER (WHERE p.status IN ('paid', 'partial'))
                  / count(*) FILTER (WHERE p.status IN ('paid', 'partial', 'rejected', 'failed')),
                  1)
      END
  )
  INTO v_out
  FROM public.payments p
  WHERE p.school_id = p_school_id
    AND (p_branch_id IS NULL OR p.branch_id = p_branch_id);

  RETURN COALESCE(v_out, jsonb_build_object(
    'revenue_total', 0, 'tx_count', 0, 'charges_total', 0,
    'awaiting_count', 0, 'awaiting_amount', 0,
    'debt_count', 0, 'debt_amount', 0, 'attempts', 0, 'approval_rate', NULL
  ));
END;
$$;

COMMENT ON FUNCTION public.school_payment_kpis(uuid, uuid) IS
  'KPIs de pagos de una escuela agregados en DB sobre TODO el histórico (no sobre una página de resultados). tx_count cuenta transacciones reales (paid|partial), no cobros emitidos; approval_rate se calcula sobre intentos de pago.';

REVOKE ALL ON FUNCTION public.school_payment_kpis(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_payment_kpis(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
