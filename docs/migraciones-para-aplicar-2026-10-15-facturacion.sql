-- =============================================================================
-- Facturacion SaaS: acuerdos comerciales (2026-10-15), en orden, para pegar UNA vez
-- en el SQL Editor de Supabase. Probadas en la base viva dentro de una transaccion
-- que termino en ROLLBACK; nada esta aplicado todavia.
--
-- Todo va en UNA transaccion: si algo falla, no se aplica nada. Al final se anotan
-- en supabase_migrations.schema_migrations para que quede el rastro.
--
--   1. 20261015124518_acuerdos_comerciales_saas
--        due_offset_days (vencimiento configurable, default 5), tablas
--        school_billing_schedule y school_one_time_charges (RLS: lee super_admin o
--        administracion de la escuela; escribe solo super_admin), RPC
--        admin_set_school_billing_agreement y generate_school_subscription_invoice
--        con escalones de precio y cobros unicos. Sin datos en las tablas nuevas y
--        con default 5, las demas escuelas facturan exactamente igual que antes.
--   2. 20261015124611_acuerdo_monster_volley
--        Carga el acuerdo de Monster's Volley Club: oct-2026 gratis; 5-nov
--        $289.000 + $130.000 certificado anual; dic/ene $289.000; desde feb-2027
--        $348.000; vence el dia 5. Activa saas_billing_enabled SIN generar factura
--        de octubre; la primera sale el 1-nov-2026 por el ciclo diario.
--
-- Despues de aplicar:  npm run seguridad:invariantes   (debe seguir en 0 criticas)
-- Las fuentes inmutables estan en supabase/migrations/; este archivo es la copia
-- para aplicar de una vez.
-- =============================================================================

BEGIN;


-- ▼▼▼ 20261015124518_acuerdos_comerciales_saas.sql ▼▼▼

-- =============================================================================
-- 20261015124518_acuerdos_comerciales_saas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014215112
-- Objetivo: que la facturación SaaS de UNA escuela soporte un acuerdo comercial:
--   precios que cambian en el tiempo, cobros únicos/anuales aparte y vencimiento
--   configurable. Las demás escuelas NO cambian: due_offset_days = 5 por defecto,
--   y sin filas en las tablas nuevas el precio sale igual que antes.
--
--   1. school_subscriptions.due_offset_days (0..28, default 5)
--   2. school_billing_schedule  - escalones de precio mensual del plan por fecha
--   3. school_one_time_charges  - cobros únicos o recurrentes cada N meses
--   4. admin_set_school_billing_agreement(...) - RPC de administración (gate igual
--      al de admin_set_school_custom_price: super_admin / service_role)
--   5. generate_school_subscription_invoice - base: definición VIVA al 2026-10-15;
--      cambios marcados con "ACUERDO:".
-- Precedencia del precio del plan: escalón del schedule (mayor effective_from <=
--   period_start) > custom_price_cents > catálogo por plan_code.
-- =============================================================================


-- 1. Vencimiento configurable ------------------------------------------------
ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS due_offset_days smallint NOT NULL DEFAULT 5;

ALTER TABLE public.school_subscriptions
  DROP CONSTRAINT IF EXISTS school_subscriptions_due_offset_days_check;
ALTER TABLE public.school_subscriptions
  ADD CONSTRAINT school_subscriptions_due_offset_days_check
  CHECK (due_offset_days BETWEEN 0 AND 28);

-- 2. Escalones de precio -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_billing_schedule (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  effective_from      date NOT NULL,
  monthly_price_cents integer NOT NULL CHECK (monthly_price_cents >= 0),
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, effective_from)
);

-- 3. Cobros únicos / recurrentes --------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_one_time_charges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code                text NOT NULL,
  label               text NOT NULL,
  amount_cents        integer NOT NULL CHECK (amount_cents >= 0),
  next_bill_on        date NOT NULL,
  renews_every_months smallint CHECK (renews_every_months IS NULL OR renews_every_months > 0),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'billed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_one_time_charges_school_active
  ON public.school_one_time_charges (school_id) WHERE status = 'active';

-- RLS: lectura super_admin o administración de esa escuela (NO user_school_ids(),
-- que incluye padres y atletas); escritura solo super_admin.
ALTER TABLE public.school_billing_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_one_time_charges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.school_billing_schedule FROM PUBLIC, anon;
REVOKE ALL ON public.school_one_time_charges FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_billing_schedule TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_one_time_charges TO authenticated;

DROP POLICY IF EXISTS school_billing_schedule_select ON public.school_billing_schedule;
CREATE POLICY school_billing_schedule_select ON public.school_billing_schedule
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = ANY (public.user_admin_school_ids()));
DROP POLICY IF EXISTS school_billing_schedule_insert ON public.school_billing_schedule;
CREATE POLICY school_billing_schedule_insert ON public.school_billing_schedule
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS school_billing_schedule_update ON public.school_billing_schedule;
CREATE POLICY school_billing_schedule_update ON public.school_billing_schedule
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS school_billing_schedule_delete ON public.school_billing_schedule;
CREATE POLICY school_billing_schedule_delete ON public.school_billing_schedule
  FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS school_one_time_charges_select ON public.school_one_time_charges;
CREATE POLICY school_one_time_charges_select ON public.school_one_time_charges
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = ANY (public.user_admin_school_ids()));
DROP POLICY IF EXISTS school_one_time_charges_insert ON public.school_one_time_charges;
CREATE POLICY school_one_time_charges_insert ON public.school_one_time_charges
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS school_one_time_charges_update ON public.school_one_time_charges;
CREATE POLICY school_one_time_charges_update ON public.school_one_time_charges
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS school_one_time_charges_delete ON public.school_one_time_charges;
CREATE POLICY school_one_time_charges_delete ON public.school_one_time_charges
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- 4. RPC de administración ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_school_billing_agreement(
  p_school_id uuid,
  p_due_offset_days smallint,
  p_schedule jsonb,
  p_one_time jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  e jsonb;
  v_n_sched integer := 0;
  v_n_one   integer := 0;
BEGIN
  IF NOT (
    public.is_super_admin()
    OR auth.role() = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'solo super_admin o el proceso del BFF pueden fijar un acuerdo comercial' USING ERRCODE = '42501';
  END IF;

  IF p_due_offset_days IS NOT NULL AND p_due_offset_days NOT BETWEEN 0 AND 28 THEN
    RAISE EXCEPTION 'due_offset_days debe estar entre 0 y 28' USING ERRCODE = '22023';
  END IF;
  IF p_schedule IS NOT NULL AND jsonb_typeof(p_schedule) <> 'array' THEN
    RAISE EXCEPTION 'p_schedule debe ser un arreglo JSON' USING ERRCODE = '22023';
  END IF;
  IF p_one_time IS NOT NULL AND jsonb_typeof(p_one_time) <> 'array' THEN
    RAISE EXCEPTION 'p_one_time debe ser un arreglo JSON' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.school_subscriptions WHERE school_id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id USING ERRCODE = '23503';
  END IF;

  -- Validar todo antes de escribir
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_schedule, '[]'::jsonb)) LOOP
    IF (e->>'effective_from') IS NULL OR (e->>'effective_from') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'schedule: effective_from inválida (YYYY-MM-DD): %', e USING ERRCODE = '22023';
    END IF;
    IF (e->>'monthly_price_cents') IS NULL OR (e->>'monthly_price_cents') !~ '^\d+$'
       OR (e->>'monthly_price_cents')::numeric > 2147483647 THEN
      RAISE EXCEPTION 'schedule: monthly_price_cents debe ser un entero >= 0: %', e USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_one_time, '[]'::jsonb)) LOOP
    IF COALESCE(e->>'code', '') = '' OR COALESCE(e->>'label', '') = '' THEN
      RAISE EXCEPTION 'one_time: code y label son obligatorios: %', e USING ERRCODE = '22023';
    END IF;
    IF (e->>'amount_cents') IS NULL OR (e->>'amount_cents') !~ '^\d+$'
       OR (e->>'amount_cents')::numeric > 2147483647 THEN
      RAISE EXCEPTION 'one_time: amount_cents debe ser un entero >= 0: %', e USING ERRCODE = '22023';
    END IF;
    IF (e->>'next_bill_on') IS NULL OR (e->>'next_bill_on') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'one_time: next_bill_on inválida (YYYY-MM-DD): %', e USING ERRCODE = '22023';
    END IF;
    IF e->>'renews_every_months' IS NOT NULL
       AND ((e->>'renews_every_months') !~ '^\d+$' OR (e->>'renews_every_months')::numeric NOT BETWEEN 1 AND 120) THEN
      RAISE EXCEPTION 'one_time: renews_every_months debe ser un entero entre 1 y 120 o null: %', e USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_due_offset_days IS NOT NULL THEN
    UPDATE public.school_subscriptions
       SET due_offset_days = p_due_offset_days, updated_at = now()
     WHERE school_id = p_school_id;
  END IF;

  IF p_schedule IS NOT NULL THEN
    DELETE FROM public.school_billing_schedule WHERE school_id = p_school_id;
    INSERT INTO public.school_billing_schedule (school_id, effective_from, monthly_price_cents, note)
    SELECT p_school_id, (x->>'effective_from')::date, (x->>'monthly_price_cents')::integer, x->>'note'
      FROM jsonb_array_elements(p_schedule) x;
    GET DIAGNOSTICS v_n_sched = ROW_COUNT;
  END IF;

  IF p_one_time IS NOT NULL THEN
    DELETE FROM public.school_one_time_charges WHERE school_id = p_school_id AND status = 'active';
    INSERT INTO public.school_one_time_charges
      (school_id, code, label, amount_cents, next_bill_on, renews_every_months)
    SELECT p_school_id, x->>'code', x->>'label', (x->>'amount_cents')::integer,
           (x->>'next_bill_on')::date, (x->>'renews_every_months')::smallint
      FROM jsonb_array_elements(p_one_time) x;
    GET DIAGNOSTICS v_n_one = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'school_id', p_school_id,
    'due_offset_days', (SELECT due_offset_days FROM public.school_subscriptions WHERE school_id = p_school_id),
    'schedule_rows', v_n_sched, 'one_time_rows', v_n_one
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_school_billing_agreement(uuid, smallint, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_billing_agreement(uuid, smallint, jsonb, jsonb) TO authenticated, service_role;

-- 5. Generador de facturas ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_school_subscription_invoice(p_school_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_sub            public.school_subscriptions%ROWTYPE;
    v_plan_cents     integer;
    v_addons_cents   integer;
    v_items          jsonb;
    v_period_start   date;
    v_period_end     date;
    v_due_date       date;
    v_invoice_id     uuid;
    v_invoice_number text;
    v_seq            integer;
    v_ultimo_fin     date;
    -- ACUERDO:
    v_step_cents     integer;
    v_one_cents      integer;
    v_one_items      jsonb;
BEGIN
    IF NOT (
        public.is_super_admin()
        OR auth.role() = 'service_role'
        OR session_user IN ('postgres', 'supabase_admin')
    ) THEN
        RAISE EXCEPTION 'solo super_admin o el proceso del BFF pueden generar facturas SaaS' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_sub
      FROM public.school_subscriptions
     WHERE school_id = p_school_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
            USING ERRCODE = '23503';
    END IF;

    SELECT MAX(period_end) INTO v_ultimo_fin
      FROM public.school_subscription_invoices
     WHERE school_id = p_school_id AND status <> 'cancelled';

    v_period_start := COALESCE(v_ultimo_fin, v_sub.current_period_start::date, CURRENT_DATE);
    v_period_end   := v_period_start + INTERVAL '1 month';
    -- ACUERDO: vencimiento configurable (default 5 = comportamiento anterior)
    v_due_date     := v_period_start + (v_sub.due_offset_days * INTERVAL '1 day');

    -- ACUERDO: escalón de precio vigente al inicio del período (si existe)
    SELECT s.monthly_price_cents INTO v_step_cents
      FROM public.school_billing_schedule s
     WHERE s.school_id = p_school_id AND s.effective_from <= v_period_start
     ORDER BY s.effective_from DESC
     LIMIT 1;

    v_plan_cents := COALESCE(
        v_step_cents,
        v_sub.custom_price_cents,
        CASE v_sub.plan_code
            WHEN 'starter'     THEN 0
            WHEN 'start'       THEN 6900000
            WHEN 'crecimiento' THEN 9900000
            WHEN 'profesional' THEN 15900000
            WHEN 'elite'       THEN 34900000
            ELSE 0
        END
    );

    SELECT COALESCE(SUM(a.monthly_price_cents), 0)::integer,
           COALESCE(jsonb_agg(jsonb_build_object(
               'kind', 'addon',
               'code', a.addon_key,
               'amount_cents', a.monthly_price_cents
           ) ORDER BY a.addon_key), '[]'::jsonb)
      INTO v_addons_cents, v_items
      FROM public.school_addons a
     WHERE a.school_id = p_school_id
       AND a.enabled
       AND a.monthly_price_cents > 0;

    v_items := jsonb_build_array(jsonb_build_object(
                   'kind', 'plan',
                   'code', v_sub.plan_code,
                   'amount_cents', v_plan_cents,
                   'negotiated', v_step_cents IS NOT NULL OR v_sub.custom_price_cents IS NOT NULL
               )) || v_items;

    -- ACUERDO: cobros únicos/recurrentes que vencen dentro o antes del período
    SELECT COALESCE(SUM(c.amount_cents), 0)::integer,
           COALESCE(jsonb_agg(jsonb_build_object(
               'kind', 'one_time',
               'code', c.code,
               'label', c.label,
               'amount_cents', c.amount_cents
           ) ORDER BY c.next_bill_on, c.code), '[]'::jsonb)
      INTO v_one_cents, v_one_items
      FROM public.school_one_time_charges c
     WHERE c.school_id = p_school_id
       AND c.status = 'active'
       AND c.next_bill_on < v_period_end;

    v_items := v_items || v_one_items;

    v_seq := v_sub.next_invoice_number;
    v_invoice_number := 'SM-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.school_subscription_invoices (
        school_id, invoice_number, plan_code, amount_cents, line_items,
        period_start, period_end, due_date, status
    ) VALUES (
        p_school_id, v_invoice_number, v_sub.plan_code, v_plan_cents + v_addons_cents + v_one_cents, v_items,
        v_period_start, v_period_end, v_due_date, 'pending'
    )
    ON CONFLICT (school_id, period_start) WHERE status <> 'cancelled' DO NOTHING
    RETURNING id INTO v_invoice_id;

    IF v_invoice_id IS NULL THEN
        SELECT id INTO v_invoice_id
          FROM public.school_subscription_invoices
         WHERE school_id = p_school_id AND period_start = v_period_start AND status <> 'cancelled';
        RETURN v_invoice_id;
    END IF;

    -- ACUERDO: solo si la factura se insertó de verdad, se avanzan los cobros incluidos
    UPDATE public.school_one_time_charges
       SET next_bill_on = CASE WHEN renews_every_months IS NOT NULL
                               THEN (next_bill_on + (renews_every_months * INTERVAL '1 month'))::date
                               ELSE next_bill_on END,
           status       = CASE WHEN renews_every_months IS NULL THEN 'billed' ELSE status END
     WHERE school_id = p_school_id
       AND status = 'active'
       AND next_bill_on < v_period_end;

    UPDATE public.school_subscriptions
       SET next_invoice_number = v_seq + 1
     WHERE school_id = p_school_id;

    RETURN v_invoice_id;
END;
$function$;

-- ▲▲▲ fin 20261015124518_acuerdos_comerciales_saas.sql ▲▲▲

-- ▼▼▼ 20261015124611_acuerdo_monster_volley.sql ▼▼▼

-- =============================================================================
-- 20261015124611_acuerdo_monster_volley.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261015124518
-- Objetivo: cargar el acuerdo comercial de Monster's Volley Club
--   (school_id eb3ebc77-4ea4-4992-96c8-3c8ec574578c) sobre las tablas de la
--   migración 20261015124518. Idempotente.
--
-- Acuerdo: octubre 2026 sin costo (implementación acompañada). 5-nov-2026:
--   $289.000 mensualidad + $130.000 certificado digital (una vez al año). Dic y
--   ene: $289.000 cada día 5. Desde el 5-feb-2027: $348.000 cada día 5. Sin costo:
--   rediseño de la página web e integración de WhatsApp.
--
-- SUPUESTOS NO CONFIRMADOS POR EL USUARIO:
--   · plan_code NO se cambia (sigue 'starter'; el precio sale del schedule).
--   · El certificado se renueva cada 12 meses al mismo valor.
--   · Los montos NO incluyen IVA; no hay líneas de impuesto.
--   · billing_emails queda como está (NULL).
-- Períodos del día 1 al día 1; la factura sale el 1 y vence el 5 (due_offset_days = 4).
-- No se usa admin_set_saas_billing_enabled: generaría de inmediato una factura de
--   octubre por $0. Se activa directo; la primera factura la genera el ciclo diario
--   el 1-nov-2026 (06:20 COT), período 1-nov a 1-dic, vence el 5-nov.
-- =============================================================================


INSERT INTO public.school_billing_schedule (school_id, effective_from, monthly_price_cents, note) VALUES
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2026-10-01', 0,        'Implementación acompañada'),
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2026-11-01', 28900000, 'Mensualidad (primer pago 5-nov-2026)'),
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2027-02-01', 34800000, 'Mensualidad desde el 5-feb-2027')
ON CONFLICT (school_id, effective_from) DO NOTHING;

INSERT INTO public.school_one_time_charges (school_id, code, label, amount_cents, next_bill_on, renews_every_months)
SELECT 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'certificado_digital', 'Certificado digital (anual)',
       13000000, DATE '2026-11-05', 12
 WHERE NOT EXISTS (
   SELECT 1 FROM public.school_one_time_charges
    WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c' AND code = 'certificado_digital'
 );

UPDATE public.school_subscriptions
   SET due_offset_days         = 4,
       billing_cycle           = 'monthly',
       current_period_start    = TIMESTAMPTZ '2026-10-01 00:00-05',
       current_period_end      = TIMESTAMPTZ '2026-11-01 00:00-05',
       saas_billing_enabled    = true,
       saas_billing_enabled_at = COALESCE(saas_billing_enabled_at, now()),
       metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('acuerdo_comercial', jsonb_build_object(
         'texto', 'Octubre 2026 sin costo (implementación acompañada). Primer pago el 5-nov-2026: $289.000 de mensualidad + $130.000 de certificado digital (pago completo, una vez al año). Diciembre y enero: $289.000 cada día 5. Desde el 5-feb-2027: $348.000 cada día 5. Sin costo para el club: rediseño de la página web e integración de WhatsApp.',
         'fecha', '2026-10-15',
         'sin_costo', jsonb_build_array('rediseno_web', 'whatsapp')
       )),
       updated_at = now()
 WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';

-- ▲▲▲ fin 20261015124611_acuerdo_monster_volley.sql ▲▲▲

-- Rastro en el registro de migraciones
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20261015124518', 'acuerdos_comerciales_saas'),
  ('20261015124611', 'acuerdo_monster_volley')
ON CONFLICT (version) DO NOTHING;

COMMIT;
