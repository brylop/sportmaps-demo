-- =============================================================================
-- 20261005214302_hour_bank_overage_charges.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005214300 (renumerada: depende de F-A 20261005214245)
-- Objetivo: F-E de docs/specs/dreamers-reglas-completas-plan.md (W4 / F5, D8 de
-- docs/specs/dreamers-niveles-por-horas-y-progresion.md) — cargo por horas de
-- más del banco de horas. Extiende D-10 ("solo notifica") a "notifica con un
-- cargo pre-calculado que el owner confirma o descarta". Nunca factura solo.
--
--   1. school_settings.hour_bank_overage_charges_enabled (default false →
--      no-op para todas las escuelas hasta prenderlo por datos).
--   2. Tabla hour_bank_overage_charges (una fila por periodo, UNIQUE period_id):
--      suggested → confirmed | dismissed. RLS solo lectura para
--      user_admin_school_ids(); toda escritura por RPC/BFF con service_role.
--   3. RPCs (solo service_role):
--        · hour_bank_overage_calc(period)          — la fórmula, un solo lugar.
--        · generate_hour_bank_overage_suggestions() — cron diario del BFF.
--        · recompute_hour_bank_overage(period)      — tras corregir una visita.
--        · confirm_hour_bank_overage(id, actor)     — FOR UPDATE, crea el cobro.
--   4. B7 (/facturar-fuera-de-plan): índice único parcial que hace idempotente
--      el cobro de clases fuera de plan (doble clic = un solo cobro).
--
-- Fórmula (D8): tarifa_hora = precio_plan ÷ (minutos_incluidos ÷ 60).
--   hours_billing_rounding = 'hour_up' → horas = ceil(excedente ÷ 60), aplicado
--   SOLO al total del excedente del periodo (no visita por visita).
--   'none' → horas = excedente ÷ 60 (fraccional).
--   monto = round(precio × minutos_facturables ÷ minutos_incluidos), que es
--   exactamente horas × tarifa sin arrastrar el redondeo de la tarifa.
--   Espejo TS (solo para tests y logs): bff/src/jobs/hour-bank-overage.job.ts.
--
-- ⚠ DEPENDENCIA DURA — migración de F-A (base de cobros compartida) aplicada
-- ANTES que esta y antes de desplegar el BFF de F-E:
--   a) payments_payment_category_check acepta 'excedente' (si no, el INSERT de
--      confirm_hour_bank_overage y el de /facturar-fuera-de-plan fallan 23514).
--   b) uniq_payment_active_period_per_adult / _per_unreg recreados con
--      AND NOT period_uniqueness_exempt (si no, el cobro de un adulto o un no
--      registrado con mensualidad del mismo mes choca 23505).
--   c) fn_extend_enrollment_on_payment_paid / open_month ignoran 'excedente'.
--      Además este cobro va con offering_plan_id NULL, así que el trigger de
--      vigencia no lo toca de todas formas.
-- Esta migración NO duplica nada de eso.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ─── 0. Deriva versionada: hours_billing_rounding existe en la base viva pero
--        ninguna migración del repo la crea. IF NOT EXISTS = no-op en vivo.
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS hours_billing_rounding text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.school_settings'::regclass
       AND pg_get_constraintdef(oid) ILIKE '%hours_billing_rounding%'
  ) THEN
    ALTER TABLE public.school_settings
      ADD CONSTRAINT school_settings_hours_billing_rounding_check
      CHECK (hours_billing_rounding IN ('none', 'hour_up'));
  END IF;
END $$;

-- ─── 1. Flag por escuela ─────────────────────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS hour_bank_overage_charges_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.hour_bank_overage_charges_enabled IS
  'F-E: genera cargos SUGERIDOS por horas de más del banco de horas al cerrar el periodo. El owner confirma (crea el cobro) o descarta. Default false = solo el aviso D-10 de siempre.';

-- ─── 2. Tabla de sugerencias ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hour_bank_overage_charges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id),
  period_id        uuid NOT NULL UNIQUE REFERENCES public.hour_bank_periods(id),
  enrollment_id    uuid NOT NULL REFERENCES public.enrollments(id),
  included_minutes integer,
  consumed_minutes integer,
  overage_minutes  integer,
  billable_hours   numeric,
  hourly_rate      numeric,
  amount           numeric,
  rounding         text,
  plan_price       numeric,
  status           text NOT NULL DEFAULT 'suggested'
                   CHECK (status IN ('suggested', 'confirmed', 'dismissed')),
  payment_id       uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  decided_by       uuid REFERENCES public.profiles(id),
  decided_at       timestamptz,
  dismiss_reason   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hour_bank_overage_charges_school_status
  ON public.hour_bank_overage_charges (school_id, status);

COMMENT ON TABLE public.hour_bank_overage_charges IS
  'F-E (D8): un cargo sugerido por periodo del banco de horas cerrado con excedente. suggested → confirmed (crea payments excedente) | dismissed. Solo lectura para admins por RLS; escrituras por RPC/BFF (service_role).';

ALTER TABLE public.hour_bank_overage_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hour_bank_overage_charges_select_admin ON public.hour_bank_overage_charges;
CREATE POLICY hour_bank_overage_charges_select_admin
  ON public.hour_bank_overage_charges
  FOR SELECT
  TO authenticated
  -- (SELECT …)::uuid[] = initplan: la función corre una vez por consulta, no
  -- por fila. Sin el cast, ANY(subconsulta) compara uuid contra uuid[].
  USING (school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));

REVOKE ALL ON public.hour_bank_overage_charges FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.hour_bank_overage_charges FROM authenticated;
GRANT SELECT ON public.hour_bank_overage_charges TO authenticated;
GRANT ALL ON public.hour_bank_overage_charges TO service_role;

-- ─── 3·. Formato es-CO para conceptos y avisos: 22062.5 → '22.062,5',
--        19.0000 → '19', 18.5167 → '18,52'. A mano porque to_char con G/D
--        depende de lc_numeric del servidor.
CREATE OR REPLACE FUNCTION public.hour_bank_fmt_es(p_value numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT replace(to_char(trunc(x), 'FM999,999,999,990'), ',', '.')
         || CASE WHEN x <> trunc(x)
                 THEN ',' || rtrim(split_part(to_char(x - trunc(x), 'FM0.00'), '.', 2), '0')
                 ELSE '' END
    FROM (SELECT round(abs(p_value), 2) AS x) v;
$$;

REVOKE ALL ON FUNCTION public.hour_bank_fmt_es(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hour_bank_fmt_es(numeric) TO service_role;

-- ─── 3a. La fórmula, en un solo lugar ───────────────────────────────────────
-- Devuelve 0 filas si el periodo no tiene excedente o no hay precio/minutos
-- con que calcular la tarifa (plan sin precio, minutos incluidos 0).
CREATE OR REPLACE FUNCTION public.hour_bank_overage_calc(p_period_id uuid)
RETURNS TABLE (
  school_id        uuid,
  enrollment_id    uuid,
  included_minutes integer,
  consumed_minutes integer,
  overage_minutes  integer,
  billable_hours   numeric,
  hourly_rate      numeric,
  amount           numeric,
  rounding         text,
  plan_price       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH base AS (
    SELECT p.school_id,
           p.enrollment_id,
           p.included_minutes,
           p.consumed_minutes,
           (p.consumed_minutes - p.included_minutes)                 AS overage,
           COALESCE(ss.hours_billing_rounding, 'none')                AS rounding,
           op.price                                                   AS price
      FROM public.hour_bank_periods p
      JOIN public.enrollments e         ON e.id = p.enrollment_id
      LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
      LEFT JOIN public.school_settings ss ON ss.school_id = p.school_id
     WHERE p.id = p_period_id
  ),
  bill AS (
    SELECT b.*,
           CASE WHEN b.rounding = 'hour_up'
                THEN ceil(b.overage / 60.0) * 60
                ELSE b.overage::numeric
           END AS billable_minutes
      FROM base b
     WHERE b.overage > 0
       AND b.included_minutes > 0
       AND COALESCE(b.price, 0) > 0
  )
  SELECT b.school_id,
         b.enrollment_id,
         b.included_minutes,
         b.consumed_minutes,
         b.overage,
         round(b.billable_minutes / 60.0, 4),
         round(b.price / (b.included_minutes / 60.0), 4),
         round(b.price * b.billable_minutes / b.included_minutes),
         b.rounding,
         b.price
    FROM bill b;
$$;

REVOKE ALL ON FUNCTION public.hour_bank_overage_calc(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hour_bank_overage_calc(uuid) TO service_role;

-- ─── 3b. Generador (cron diario 03:00 Bogotá, bff/src/jobs/hour-bank-overage.job.ts)
CREATE OR REPLACE FUNCTION public.generate_hour_bank_overage_suggestions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_today    date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_period   record;
  v_calc     record;
  v_id       uuid;
  v_name     text;
  v_created  integer := 0;
  v_skipped  integer := 0;
  v_notified integer := 0;
  v_months   text[] := ARRAY['enero','febrero','marzo','abril','mayo','junio','julio',
                             'agosto','septiembre','octubre','noviembre','diciembre'];
BEGIN
  FOR v_period IN
    SELECT p.id, p.period_start
      FROM public.hour_bank_periods p
      JOIN public.school_settings ss
        ON ss.school_id = p.school_id
       AND ss.hours_plan_enabled
       AND ss.hour_bank_overage_charges_enabled
     WHERE p.period_end < v_today
       AND p.consumed_minutes > p.included_minutes
       AND NOT EXISTS (SELECT 1 FROM public.hour_bank_overage_charges c
                        WHERE c.period_id = p.id)
       -- Visitas sin cerrar o esperando la corrección del owner (D-8): el
       -- consumo todavía puede cambiar. Se reintenta la noche siguiente.
       AND NOT EXISTS (SELECT 1 FROM public.hour_bank_visits v
                        WHERE v.period_id = p.id
                          AND v.status IN ('open', 'pending_review'))
     ORDER BY p.period_start
  LOOP
    SELECT * INTO v_calc FROM public.hour_bank_overage_calc(v_period.id);
    IF NOT FOUND OR v_calc.amount IS NULL OR v_calc.amount <= 0 THEN
      v_skipped := v_skipped + 1;   -- sin precio / sin minutos incluidos
      CONTINUE;
    END IF;

    v_id := NULL;
    INSERT INTO public.hour_bank_overage_charges (
      school_id, period_id, enrollment_id, included_minutes, consumed_minutes,
      overage_minutes, billable_hours, hourly_rate, amount, rounding, plan_price
    ) VALUES (
      v_calc.school_id, v_period.id, v_calc.enrollment_id, v_calc.included_minutes,
      v_calc.consumed_minutes, v_calc.overage_minutes, v_calc.billable_hours,
      v_calc.hourly_rate, v_calc.amount, v_calc.rounding, v_calc.plan_price
    )
    ON CONFLICT (period_id) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      CONTINUE;   -- otra corrida concurrente ya la creó
    END IF;
    v_created := v_created + 1;

    -- Un aviso al owner por fila nueva. Defensivo: un fallo de notificación
    -- no revierte la sugerencia (mismo patrón que D-10 en 20260905124655).
    BEGIN
      SELECT COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')
        INTO v_name
        FROM public.enrollments e
        LEFT JOIN public.children c               ON c.id  = e.child_id
        LEFT JOIN public.profiles pr              ON pr.id = e.user_id
        LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
       WHERE e.id = v_calc.enrollment_id;

      INSERT INTO public.notifications (user_id, school_id, type, category, title, message, link, data)
      SELECT s.owner_id, v_calc.school_id, 'hour_bank_overage_charge', 'payment',
             '⏱️ Horas por encima del plan — cobro por confirmar',
             format('%s usó %s min de %s incluidos en %s %s. Cobro sugerido: %s h × $%s = $%s. Confírmalo o descártalo en Control de acceso.',
                    COALESCE(v_name, 'Atleta'), v_calc.consumed_minutes, v_calc.included_minutes,
                    v_months[extract(month FROM v_period.period_start)::int],
                    extract(year FROM v_period.period_start)::int,
                    public.hour_bank_fmt_es(v_calc.billable_hours),
                    public.hour_bank_fmt_es(v_calc.hourly_rate),
                    public.hour_bank_fmt_es(v_calc.amount)),
             '/school/access-control',
             jsonb_build_object('overage_charge_id', v_id, 'period_id', v_period.id,
                                'amount', v_calc.amount)
        FROM public.schools s
       WHERE s.id = v_calc.school_id
         AND s.owner_id IS NOT NULL;
      IF FOUND THEN v_notified := v_notified + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped,
                            'notified', v_notified, 'as_of', v_today);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_hour_bank_overage_suggestions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_hour_bank_overage_suggestions() TO service_role;

-- ─── 3c. Recalcular una sugerencia tras corregir una visita ──────────────────
-- Solo toca filas 'suggested'. Nunca una confirmada (ya es un cobro) ni una
-- descartada. Si la corrección deja el periodo sin excedente, la descarta.
CREATE OR REPLACE FUNCTION public.recompute_hour_bank_overage(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row  public.hour_bank_overage_charges%ROWTYPE;
  v_calc record;
BEGIN
  SELECT * INTO v_row
    FROM public.hour_bank_overage_charges
   WHERE period_id = p_period_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'no_suggestion');
  END IF;
  IF v_row.status <> 'suggested' THEN
    RETURN jsonb_build_object('result', 'untouched', 'status', v_row.status);
  END IF;

  SELECT * INTO v_calc FROM public.hour_bank_overage_calc(p_period_id);

  IF NOT FOUND OR v_calc.amount IS NULL OR v_calc.amount <= 0 THEN
    UPDATE public.hour_bank_overage_charges
       SET status = 'dismissed',
           dismiss_reason = 'Sin excedente tras corregir una visita',
           decided_at = now(),
           updated_at = now()
     WHERE id = v_row.id;
    RETURN jsonb_build_object('result', 'dismissed', 'id', v_row.id);
  END IF;

  UPDATE public.hour_bank_overage_charges
     SET included_minutes = v_calc.included_minutes,
         consumed_minutes = v_calc.consumed_minutes,
         overage_minutes  = v_calc.overage_minutes,
         billable_hours   = v_calc.billable_hours,
         hourly_rate      = v_calc.hourly_rate,
         amount           = v_calc.amount,
         rounding         = v_calc.rounding,
         plan_price       = v_calc.plan_price,
         updated_at       = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('result', 'recomputed', 'id', v_row.id, 'amount', v_calc.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_hour_bank_overage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_hour_bank_overage(uuid) TO service_role;

-- ─── 3d. Confirmar: crea el cobro en la MISMA transacción ────────────────────
-- El BFF ya validó rol owner y que la fila sea de su escuela.
CREATE OR REPLACE FUNCTION public.confirm_hour_bank_overage(p_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row        public.hour_bank_overage_charges%ROWTYPE;
  v_period     record;
  v_enr        record;
  v_payment_id uuid;
  v_today      date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_months     text[] := ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
BEGIN
  SELECT * INTO v_row
    FROM public.hour_bank_overage_charges
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_row.status <> 'suggested' THEN
    RETURN jsonb_build_object('error', 'not_suggested', 'status', v_row.status,
                              'payment_id', v_row.payment_id);
  END IF;
  IF COALESCE(v_row.amount, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;

  SELECT period_start INTO v_period
    FROM public.hour_bank_periods WHERE id = v_row.period_id;

  -- Mismo armado de pagador que open_month: parent_id = acudiente del menor;
  -- el adulto paga como user_id; el no registrado queda sin parent_id.
  SELECT e.child_id, e.user_id, e.unregistered_athlete_id, e.team_id,
         c.parent_id,
         COALESCE(c.branch_id, t.branch_id) AS branch_id
    INTO v_enr
    FROM public.enrollments e
    LEFT JOIN public.children c ON c.id = e.child_id
    LEFT JOIN public.teams    t ON t.id = e.team_id
   WHERE e.id = v_row.enrollment_id;

  INSERT INTO public.payments (
    school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
    team_id, offering_plan_id, amount, concept, due_date, status, payment_type,
    payment_category, period_year, period_month, period_uniqueness_exempt
  ) VALUES (
    v_row.school_id,
    v_enr.branch_id,
    v_enr.parent_id,
    v_enr.child_id,
    v_enr.user_id,
    v_enr.unregistered_athlete_id,
    v_enr.team_id,
    NULL,                                   -- sin plan: no extiende vigencia (B3)
    v_row.amount,
    format('Horas por encima del plan — %s %s — %s h × $%s',
           v_months[extract(month FROM v_period.period_start)::int],
           extract(year FROM v_period.period_start)::int,
           public.hour_bank_fmt_es(v_row.billable_hours),
           public.hour_bank_fmt_es(v_row.hourly_rate)),
    v_today + 5,                            -- decisión usuario 2026-10-05
    'pending',
    'one_time',
    'excedente',                            -- requiere F-A (CHECK)
    extract(year  FROM v_period.period_start)::smallint,
    extract(month FROM v_period.period_start)::smallint,
    true                                    -- convive con la mensualidad del mes
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.hour_bank_overage_charges
     SET status     = 'confirmed',
         payment_id = v_payment_id,
         decided_by = p_actor,
         decided_at = now(),
         updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('payment_id', v_payment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_hour_bank_overage(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_hour_bank_overage(uuid, uuid) TO service_role;

-- ─── 4. B7: /facturar-fuera-de-plan idempotente ──────────────────────────────
-- La ruta hacía SELECT → INSERT sin llave: doble clic o dos pestañas = dos
-- cobros. Desde F-E la ruta marca sus cobros payment_category='excedente' y el
-- concepto empieza por 'Clases por encima del plan' o 'Clases sin plan
-- vigente'; este índice deja uno activo por atleta + mes + motivo. El 23505 lo
-- traduce la ruta a 'ya_facturado'. Filas viejas (categoría NULL) no entran
-- al índice → no puede fallar al crearse; la ruta conserva su SELECT previo.
-- Los cobros de horas ('Horas por encima…') quedan fuera: los protege la
-- UNIQUE(period_id) de hour_bank_overage_charges.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_out_of_plan_classes
  ON public.payments (
    school_id,
    (COALESCE(child_id, unregistered_athlete_id, user_id)),
    period_year,
    period_month,
    (split_part(concept, ' — ', 1))
  )
  WHERE payment_category = 'excedente'
    AND concept LIKE 'Clases %'
    AND status IN ('pending', 'awaiting_approval', 'paid', 'partial', 'overdue', 'glosado');

COMMIT;

NOTIFY pgrst, 'reload schema';
