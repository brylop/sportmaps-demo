-- ============================================================================
-- 20260503000004 — Periodo (mes/año) explicito en payments.
--
-- Problema: hoy `concept` es texto libre ("Mensualidad Mayo 2026") y `due_date`
-- se setea a hoy en cada insert. No hay forma confiable de saber QUE mes paga
-- cada cuota, lo que permite que el padre pague el mismo mes dos veces sin que
-- el sistema detecte el duplicado.
--
-- Solucion: dos columnas estructuradas (period_year, period_month) + unique
-- partial index que blinda contra duplicados en estados activos
-- (paid / approved / awaiting_approval / pending). Refunded/declined/cancelled
-- pueden coexistir sin chocar.
--
-- Backfill: para registros existentes derivamos el periodo desde due_date.
-- Si due_date es nulo, lo dejamos NULL (no rompemos historia).
--
-- RPCs publicas:
--   - next_unpaid_period(p_child_id)    : devuelve {year, month, label, status}
--                                          con el siguiente mes a pagar.
--   - period_payment_status(p_child_id, year, month) : estado del periodo.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas de periodo
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS period_year  smallint,
    ADD COLUMN IF NOT EXISTS period_month smallint;

ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_period_month_range;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_period_month_range
    CHECK (period_month IS NULL OR (period_month BETWEEN 1 AND 12));

ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_period_year_range;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_period_year_range
    CHECK (period_year IS NULL OR (period_year BETWEEN 2020 AND 2100));

COMMENT ON COLUMN public.payments.period_year  IS
  'Año del periodo cubierto por este pago (mensualidad). NULL para pagos one-time / inscripcion.';
COMMENT ON COLUMN public.payments.period_month IS
  'Mes (1-12) del periodo cubierto. NULL si no aplica (inscripcion, abono libre).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill desde due_date para mensualidades existentes
-- ─────────────────────────────────────────────────────────────────────────────
-- Heuristica conservadora: solo rellenamos cuando concept contiene "mensual"
-- (case-insensitive). El resto se queda NULL para no clasificar mal una
-- inscripcion como mensualidad.
--
-- IMPORTANTE: si ya existen duplicados activos (mismo child_id + mismo mes
-- derivado), backfilleamos solo el mas reciente (paid > approved > awaiting_approval
-- > pending > partial) y dejamos el resto en NULL para que el unique index no
-- falle al crearse. Asi la historia queda preservada y el admin puede limpiar
-- los duplicados despues si quiere.

WITH candidates AS (
    SELECT
        id,
        child_id,
        EXTRACT(YEAR  FROM due_date)::smallint AS y,
        EXTRACT(MONTH FROM due_date)::smallint AS m,
        status,
        ROW_NUMBER() OVER (
            PARTITION BY child_id,
                         EXTRACT(YEAR  FROM due_date)::smallint,
                         EXTRACT(MONTH FROM due_date)::smallint
            ORDER BY
              CASE status
                WHEN 'paid'              THEN 1
                WHEN 'approved'          THEN 2
                WHEN 'partial'           THEN 3
                WHEN 'awaiting_approval' THEN 4
                WHEN 'pending'           THEN 5
                ELSE 9
              END,
              created_at DESC
        ) AS rn
      FROM public.payments
     WHERE period_year IS NULL
       AND period_month IS NULL
       AND child_id    IS NOT NULL
       AND due_date    IS NOT NULL
       AND concept     ILIKE '%mensual%'
       AND status IN ('pending', 'awaiting_approval', 'paid', 'approved', 'partial')
)
UPDATE public.payments p
   SET period_year  = c.y,
       period_month = c.m
  FROM candidates c
 WHERE p.id = c.id
   AND c.rn = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Unique index parcial: bloquea duplicados activos del mismo periodo
-- ─────────────────────────────────────────────────────────────────────────────
-- Solo aplica cuando hay child_id + periodo definido. Ignora pagos del padre
-- sin hijo (adultos), inscripcion (period NULL), refunded/declined/cancelled.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_active_period_per_child
    ON public.payments (child_id, period_year, period_month)
    WHERE child_id     IS NOT NULL
      AND period_year  IS NOT NULL
      AND period_month IS NOT NULL
      AND status IN ('pending', 'awaiting_approval', 'paid', 'approved', 'partial');

-- Index auxiliar para queries rapidas por (child, periodo)
CREATE INDEX IF NOT EXISTS idx_payments_child_period
    ON public.payments (child_id, period_year DESC, period_month DESC)
    WHERE child_id IS NOT NULL AND period_year IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Helper: format_period_label — etiqueta en espanol independiente del locale
-- ─────────────────────────────────────────────────────────────────────────────
-- to_char('TMMonth') depende de lc_time del servidor; en Supabase suele estar
-- en C y devuelve "May" en lugar de "Mayo". Mapeamos a mano para garantizar
-- consistencia.

CREATE OR REPLACE FUNCTION public.format_period_label(
    p_year  smallint,
    p_month smallint
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (ARRAY[
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ])[p_month] || ' ' || p_year::text
$$;

GRANT EXECUTE ON FUNCTION public.format_period_label(smallint, smallint)
    TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: period_payment_status — estado del mes pedido para ese hijo
-- ─────────────────────────────────────────────────────────────────────────────
-- Devuelve { status, payment_id, paid_at, label } o { status: 'unpaid' } si
-- nadie ha pagado ese periodo para el hijo.
-- status posibles: paid, approved, awaiting_approval, pending, partial, unpaid

CREATE OR REPLACE FUNCTION public.period_payment_status(
    p_child_id     uuid,
    p_period_year  smallint,
    p_period_month smallint
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row record;
BEGIN
    IF p_child_id IS NULL OR p_period_year IS NULL OR p_period_month IS NULL THEN
        RETURN jsonb_build_object('status', 'unpaid');
    END IF;

    SELECT id, status, payment_date, approved_at, amount, concept
      INTO v_row
      FROM public.payments
     WHERE child_id      = p_child_id
       AND period_year   = p_period_year
       AND period_month  = p_period_month
       AND status IN ('pending', 'awaiting_approval', 'paid', 'approved', 'partial')
     ORDER BY
        -- prioriza paid/approved sobre los estados intermedios
        CASE status
          WHEN 'paid'              THEN 1
          WHEN 'approved'          THEN 2
          WHEN 'partial'           THEN 3
          WHEN 'awaiting_approval' THEN 4
          WHEN 'pending'           THEN 5
          ELSE 9
        END,
        created_at DESC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'unpaid');
    END IF;

    RETURN jsonb_build_object(
        'status',     v_row.status,
        'payment_id', v_row.id,
        'paid_at',    COALESCE(v_row.approved_at, v_row.payment_date),
        'amount',     v_row.amount,
        'concept',    v_row.concept,
        'label',      public.format_period_label(p_period_year, p_period_month)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.period_payment_status(uuid, smallint, smallint)
    TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: next_unpaid_period — calcula que mes deberia pagar a continuacion
-- ─────────────────────────────────────────────────────────────────────────────
-- Logica:
--  1. Buscar el ultimo periodo con pago activo (paid / awaiting_approval / etc).
--  2. El siguiente sin pago activo es el candidato.
--  3. Si no hay nada pagado, default = mes actual.
--  4. No retrocede en el tiempo: nunca sugiere un mes anterior al actual
--     a menos que haya un gap explicito (mensualidad atrasada).
--
-- Devuelve:
--   { year, month, label, current_status, last_active_period }
-- donde current_status es el estado del mes sugerido para que el frontend
-- decida si pedir confirmacion ("ya pagaste, ¿adelantar?"), y
-- last_active_period puede estar en cualquier estado activo (no solo 'paid').

CREATE OR REPLACE FUNCTION public.next_unpaid_period(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

    -- Ultimo periodo con pago activo (paid/approved gana sobre awaiting/pending)
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
    ELSE
        -- Caso B: ya tiene historia → el mes siguiente al ultimo registrado
        v_target_year  := v_last_year;
        v_target_month := v_last_month + 1;
        IF v_target_month > 12 THEN
            v_target_month := 1;
            v_target_year  := v_target_year + 1;
        END IF;

        -- Caso C: si el siguiente sugerido cae en el pasado (ej. ultimo pago
        -- fue hace meses), avanzar hasta el mes actual para no proponer un
        -- pago vencido sin contexto. El frontend igual puede mostrar gap.
        IF make_date(v_target_year::int, v_target_month::int, 1)
           < make_date(v_curr_year::int,   v_curr_month::int,  1)
        THEN
            v_target_year  := v_curr_year;
            v_target_month := v_curr_month;
        END IF;
    END IF;

    -- Estado del mes sugerido (puede estar awaiting_approval ya, etc.)
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

COMMIT;
