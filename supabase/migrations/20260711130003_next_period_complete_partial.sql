-- ============================================================
-- SPORTMAPS — next_unpaid_period: un mes 'partial' se COMPLETA, no se avanza
-- ------------------------------------------------------------
-- Bug: si el último periodo quedó 'partial' (abono en curso), la RPC igual
-- sugería el mes siguiente (mes+1) → al pagar de nuevo aparecía Agosto en vez
-- de completar Julio. Ahora, si el último periodo activo está 'partial', el
-- objetivo es ESE MISMO mes (para completar el saldo). Solo se avanza cuando
-- el último quedó totalmente pagado (paid/approved) o ya en validación.
-- Fecha: 2026-07-11
-- ============================================================

CREATE OR REPLACE FUNCTION public.next_unpaid_period(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today          date := CURRENT_DATE;
    v_curr_year      smallint := EXTRACT(YEAR  FROM v_today)::smallint;
    v_curr_month     smallint := EXTRACT(MONTH FROM v_today)::smallint;
    v_last_year      smallint;
    v_last_month     smallint;
    v_last_status    text;
    v_target_year    smallint;
    v_target_month   smallint;
    v_target_status  jsonb;
BEGIN
    IF p_child_id IS NULL THEN
        RETURN jsonb_build_object('error', 'child_id_required');
    END IF;

    SELECT period_year, period_month, status
      INTO v_last_year, v_last_month, v_last_status
      FROM public.payments
     WHERE child_id     = p_child_id
       AND period_year  IS NOT NULL
       AND period_month IS NOT NULL
       AND status IN ('paid', 'approved', 'awaiting_approval', 'pending', 'partial')
     ORDER BY period_year DESC, period_month DESC,
              CASE status
                WHEN 'paid'              THEN 1
                WHEN 'approved'          THEN 2
                WHEN 'partial'           THEN 3
                WHEN 'awaiting_approval' THEN 4
                WHEN 'pending'           THEN 5
                ELSE 9
              END
     LIMIT 1;

    -- Caso A: nunca ha pagado nada → sugerir mes actual
    IF v_last_year IS NULL THEN
        v_target_year  := v_curr_year;
        v_target_month := v_curr_month;
    ELSIF v_last_status IN ('partial', 'pending') THEN
        -- Caso B1: el último periodo NO está saldado (abono en curso o cobro
        -- pendiente sin pagar) → el objetivo es ESE MISMO mes, para completarlo.
        v_target_year  := v_last_year;
        v_target_month := v_last_month;
    ELSE
        -- Caso B2: el último quedó pagado/en validación → el mes siguiente.
        v_target_year  := v_last_year;
        v_target_month := v_last_month + 1;
        IF v_target_month > 12 THEN
            v_target_month := 1;
            v_target_year  := v_target_year + 1;
        END IF;

        -- Si el siguiente sugerido cae en el pasado, avanzar al mes actual.
        IF make_date(v_target_year::int, v_target_month::int, 1)
           < make_date(v_curr_year::int,   v_curr_month::int,  1)
        THEN
            v_target_year  := v_curr_year;
            v_target_month := v_curr_month;
        END IF;
    END IF;

    v_target_status := public.period_payment_status(p_child_id, v_target_year, v_target_month);

    RETURN jsonb_build_object(
        'year',             v_target_year,
        'month',            v_target_month,
        'label',            public.format_period_label(v_target_year, v_target_month),
        'current_status',     v_target_status->>'status',
        'last_active_period', CASE
            WHEN v_last_year IS NULL THEN NULL
            ELSE jsonb_build_object(
                'year',   v_last_year,
                'month',  v_last_month,
                'status', v_last_status,
                'label',  public.format_period_label(v_last_year, v_last_month)
            )
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_unpaid_period(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
