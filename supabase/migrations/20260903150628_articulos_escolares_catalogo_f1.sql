-- =============================================================================
-- 20260903150628_articulos_escolares_catalogo_f1.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260903144504
-- Objetivo: Fase 1 de "Catálogo de Artículos Escolares" (docs/specs/articulos-escolares-catalogo.md).
--   Catálogo liviano (guayos, uniformes) que un padre puede comprar en el mismo
--   momento en que paga inscripción/mensualidad, generando SU PROPIA fila en
--   `payments` — nunca fusionada con esos dos conceptos (ver
--   docs/specs/articulos-escolares-catalogo.md §0).
--
--   Incluye, además de la tabla nueva:
--   - `payments.payment_category`: sin esto, cash_ledger/school_payment_kpis()
--     fusionan artículos con mensualidad en los reportes (spec §7). Se estampa
--     acá mismo en `open_month()` (mensualidad) — el resto de los flujos
--     (inscripción en students-create-one.route.ts, PaymentCheckoutModal.tsx)
--     se estampan en el código de la app, fuera de esta migración.
--   - `cash_ledger` y `school_payment_kpis()` actualizados para exponer la
--     categoría, sin cambiar ninguna cifra que ya muestran hoy.
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

-- ── 1. Catálogo de artículos ─────────────────────────────────────────────────

CREATE TABLE public.school_merchandise_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  price         numeric(12,2) NOT NULL CHECK (price >= 0),
  size_options  text,               -- CSV libre, ej. "S,M,L,XL" — NULL si no aplica talla
  price_by_size jsonb,              -- opcional: {"S": 45000, "M": 50000} — override de `price`
                                     -- por talla. Reservada desde Fase 1, SIN UI hasta que la
                                     -- piloto confirme que hace falta (evita una 2ª migración).
  image_url     text CHECK (image_url IS NULL OR image_url ~ '^https://'),
  active        boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_merchandise_items IS
  'Catálogo liviano de artículos (guayos, uniformes, accesorios) que una escuela ofrece a los '
  'padres dentro del mismo flujo de pago de inscripción/mensualidad. NO es el Marketplace/Tienda '
  '(vendor_profiles/products) — ver docs/specs/articulos-escolares-catalogo.md §0.';
COMMENT ON COLUMN public.school_merchandise_items.price_by_size IS
  'Override de precio por talla, ej. {"S": 45000, "M": 50000}. Columna reservada en Fase 1 sin '
  'UI todavía — activar solo si la piloto confirma que el precio varía por talla (spec §9).';

CREATE INDEX idx_school_merchandise_items_school
  ON public.school_merchandise_items (school_id)
  WHERE active = true;

CREATE TRIGGER trg_school_merchandise_items_updated_at
  BEFORE UPDATE ON public.school_merchandise_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.school_merchandise_items ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro de la escuela ve los activos; el admin ve todo
-- (incluye inactivos, para poder editarlos). user_school_ids() es de solo
-- LECTURA (incluye padres/atletas) — correcto acá porque es la regla de las
-- tres funciones de alcance del repo.
CREATE POLICY school_merchandise_items_select ON public.school_merchandise_items
  FOR SELECT
  USING (
    (active = true AND school_id = ANY (public.user_school_ids()))
    OR public.is_school_admin(school_id)
  );

-- Escritura: solo admin de la escuela. FOR ALL exige WITH CHECK explícito
-- (regla del repo: sin él, el USING solo no valida el INSERT).
CREATE POLICY school_merchandise_items_write ON public.school_merchandise_items
  FOR ALL
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

REVOKE ALL ON public.school_merchandise_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_merchandise_items TO authenticated;

-- ── 2. Toggle por escuela (mismo patrón que wompi_enabled) ──────────────────

ALTER TABLE public.school_settings
  ADD COLUMN merchandise_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.merchandise_enabled IS
  'Si está en true, los padres ven la sección "¿Necesitas artículos?" al pagar. '
  'Nace en false para TODA escuela — activación manual por escuela (piloto: Besser), '
  'sin tabla school_addons de por medio (no es addon comercial, ver spec §9.5).';

-- ── 3. Categoría del pago — para separar en los reportes sin parsear texto ──

ALTER TABLE public.payments
  ADD COLUMN payment_category text
    CHECK (payment_category IS NULL OR payment_category IN ('mensualidad', 'inscripcion', 'articulos', 'otro'));

COMMENT ON COLUMN public.payments.payment_category IS
  'Categoría del cobro para reportes (mensualidad/inscripcion/articulos/otro). NULL en filas '
  'anteriores a esta migración — no se retropobló, no hace falta para separar artículos. '
  'Se estampa en open_month() (mensualidad, abajo), en '
  'bff/src/routes/students-create-one.route.ts chargeRegistrationFeeIfApplicable (inscripcion) y '
  'en frontend/src/components/payment/PaymentCheckoutModal.tsx (los 3 caminos de insert, según '
  'conceptType) — sin esos tres, la columna queda muda. Consumida por cash_ledger y '
  'school_payment_kpis() (abajo).';

CREATE INDEX idx_payments_payment_category
  ON public.payments (school_id, payment_category)
  WHERE payment_category IS NOT NULL;

-- ── 4. open_month(): estampa payment_category='mensualidad' ─────────────────
--
-- CREATE OR REPLACE reemplaza el cuerpo completo — se copia tal cual la versión
-- vigente (20260827175215_fee_is_manual_becas_cuota_exenta.sql) y se agrega
-- SOLO `payment_category` a la columna/valor del INSERT. Nada más cambia.

CREATE OR REPLACE FUNCTION public.open_month(
  p_school_id uuid,
  p_year      int,
  p_month     int,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_month_start date := make_date(p_year, p_month, 1);
  v_month_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff      int;
  v_due         date;
  v_created     int := 0;
  v_caller      uuid := auth.uid();
BEGIN
  -- Autorización: admin de la escuela / super admin. El cron y service_role
  -- corren sin auth.uid() (v_caller NULL) y pasan.
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  -- Serializa por (escuela, periodo): dos disparadores concurrentes (doble-clic,
  -- cron + botón el mismo día) esperan en fila → cero duplicados por carrera.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10) INTO v_cutoff
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );

  WITH elegibles AS (
    -- Una fila por ATLETA. Ver el encabezado: el desempate no mira el monto.
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(c.branch_id, t.branch_id)                             AS branch_id,
      c.parent_id,                       -- solo el menor tiene acudiente; adulto/unreg → NULL
      e.child_id,
      e.user_id,
      e.unregistered_athlete_id,
      e.team_id,
      e.offering_plan_id,
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')    AS athlete_name,
      fee.amount                                                     AS amount
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      -- Cuota manual (beca / descuento pactado): manda tal cual, sin caer a la
      -- cascada. Un becado con fee_is_manual=true y monthly_fee=0 queda con
      -- amount=0 y lo filtra el `fee.amount > 0` de abajo — no genera cobro.
      SELECT CASE
               WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
               ELSE COALESCE(
                 NULLIF(e.monthly_fee, 0),
                 NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
                 NULLIF(t.price_monthly, 0),
                 NULLIF(c.monthly_fee, 0),
                 0
               )
             END AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))  -- adulto (incl. legacy en parent_id)
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL
                   AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)  -- legacy sin periodo
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,   -- 1. el plan gobierna el cobro
             (e.team_id IS NOT NULL)          DESC,   -- 2. antes que una huérfana
             e.created_at ASC                         -- 3. la más antigua: carga el historial
  ),
  ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month, payment_category
    )
    SELECT
      el.school_id,
      el.branch_id,
      el.parent_id,
      el.child_id,
      el.user_id,
      el.unregistered_athlete_id,
      el.team_id,
      el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount,
      v_due,
      'pending',
      'subscription',
      p_year::smallint,
      p_month::smallint,
      'mensualidad'
    FROM elegibles el
    -- Cinturón (§11.3): el DISTINCT ON deduplica por la clave que elegimos. Basta una
    -- vía futura que produzca un choque no contemplado para volver a abortar un lote de
    -- 400 cobros. Con esto, ese fallo pasa a ser "se salta esa fila".
    -- No falsea el contador: RETURNING no devuelve las filas que chocan.
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object(
    'school_id', p_school_id,
    'year',      p_year,
    'month',     p_month,
    'due_date',  v_due,
    'generados', v_created
  );
END;
$$;

COMMENT ON FUNCTION public.open_month(uuid, int, int, uuid) IS
  'Genera las cuotas del mes para una escuela por una sola vía canónica (period poblado, subscription, sin prorrateo, dedup por mes calendario, advisory lock). Un cobro por ATLETA: DISTINCT ON con desempate plan > equipo > más antigua, sin mirar el monto. fee_is_manual=true salta la cascada (plan/equipo/children) y respeta el monto puesto a mano, incluido 0 (becado). Idempotente. Reemplaza cron/botón/insert client-side. Estampa payment_category=''mensualidad'' (20260903150628). OJO: no persiste ninguna apertura — monthly_closes no existe todavía, así que abrir el mes no deja rastro (desviación consciente respecto del spec del ciclo de mes).';

-- REVOKE/GRANT: open_month() ya los tenía de una migración anterior (RLS/GRANT
-- no se pierden en un CREATE OR REPLACE de una función existente), no hace
-- falta repetirlos acá.

-- ── 5. cash_ledger: expone payment_category sin cambiar ninguna cifra ───────
--
-- Mismo cuerpo dinámico que 20260707000001_cash_ledger_real_amounts.sql
-- (detecta expenses.owner_type y marketplace_transactions igual que antes),
-- con `payment_category` agregado al SELECT de ingresos y NULL en los otros
-- dos brazos del UNION ALL (egresos y marketplace no tienen este concepto).

DO $do$
DECLARE
    v_sql       text;
    v_has_owner boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'expenses'
           AND column_name = 'owner_type'
    ) INTO v_has_owner;

    v_sql := $base$
        SELECT 'income'::text  AS direction, p.id AS id,
               'school'::text   AS owner_type, p.school_id AS owner_id,
               p.school_id      AS school_id, p.branch_id AS branch_id,
               p.concept        AS concept,   NULL::uuid  AS category_id,
               LEAST(p.amount, COALESCE(p.amount_paid, p.amount)) AS amount,
               p.payment_date   AS movement_date,
               'payment'::text  AS source,    p.status::text AS status,
               p.payment_category AS payment_category
          FROM public.payments p
         WHERE p.status IN ('paid', 'partial')
    $base$;

    IF v_has_owner THEN
        v_sql := v_sql || $exp$
            UNION ALL
            SELECT 'expense'::text, e.id, e.owner_type, e.owner_id,
                   e.school_id, e.branch_id, e.concept, e.category_id,
                   e.amount, e.paid_date, 'expense'::text, e.status::text,
                   NULL::text
              FROM public.expenses e
             WHERE e.status = 'paid'
        $exp$;
    ELSE
        v_sql := v_sql || $exp$
            UNION ALL
            SELECT 'expense'::text, e.id, 'school'::text, e.school_id,
                   e.school_id, e.branch_id, e.concept, e.category_id,
                   e.amount, e.paid_date, 'expense'::text, e.status::text,
                   NULL::text
              FROM public.expenses e
             WHERE e.status = 'paid'
        $exp$;
    END IF;

    IF to_regclass('public.marketplace_transactions') IS NOT NULL THEN
        v_sql := v_sql || $mkt$
            UNION ALL
            SELECT 'income'::text, mt.id, 'vendor'::text, mt.vendor_profile_id,
                   NULL::uuid, NULL::uuid, COALESCE(mt.description, 'Venta'), NULL::uuid,
                   mt.gross_amount, mt.paid_at::date, 'marketplace'::text, mt.status::text,
                   NULL::text
              FROM public.marketplace_transactions mt
             WHERE mt.status = 'paid' AND mt.vendor_profile_id IS NOT NULL
        $mkt$;
    END IF;

    EXECUTE 'DROP VIEW IF EXISTS public.cash_ledger';
    EXECUTE 'CREATE VIEW public.cash_ledger WITH (security_invoker = true) AS ' || v_sql;
END $do$;

GRANT SELECT ON public.cash_ledger TO authenticated;
COMMENT ON VIEW public.cash_ledger IS
    'Libro de caja. Ingreso de pagos = LEAST(amount, COALESCE(amount_paid, amount)) para status paid/partial (base sin fee + abonos por lo recibido) + egresos (+ marketplace si existe). payment_category (solo en ingresos de pagos) permite separar mensualidad/inscripcion/articulos en reportes — NULL en egresos/marketplace y en pagos anteriores a 20260903150628. Adaptable a Fase 0 / multi-owner. security_invoker.';

-- ── 6. school_payment_kpis(): agrega revenue_articulos sin tocar revenue_total ──
--
-- revenue_total NO cambia (sigue siendo TODA la plata recibida, artículos
-- incluidos — ocultarla del total sería un bug peor que fusionarla). Se agrega
-- revenue_articulos aparte para que la tarjeta de Gestión de Pagos pueda
-- mostrar "de los cuales $Y son artículos" en vez de dejarlo mudo.

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

    -- Desglose aparte (spec articulos-escolares-catalogo.md §7): NO se resta de
    -- revenue_total, solo lo hace visible por separado.
    'revenue_articulos',
      COALESCE(SUM(CASE WHEN p.payment_category = 'articulos' AND p.status = 'paid'
                          THEN LEAST(p.amount, COALESCE(p.amount_paid, p.amount))
                        WHEN p.payment_category = 'articulos' AND p.status = 'partial'
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
    'revenue_total', 0, 'revenue_articulos', 0, 'tx_count', 0, 'charges_total', 0,
    'awaiting_count', 0, 'awaiting_amount', 0,
    'debt_count', 0, 'debt_amount', 0, 'attempts', 0, 'approval_rate', NULL
  ));
END;
$$;

COMMENT ON FUNCTION public.school_payment_kpis(uuid, uuid) IS
  'KPIs de pagos de una escuela agregados en DB sobre TODO el histórico (no sobre una página de resultados). tx_count cuenta transacciones reales (paid|partial), no cobros emitidos; approval_rate se calcula sobre intentos de pago. revenue_articulos (20260903150628) es un desglose informativo de revenue_total, no se resta de él.';

REVOKE ALL ON FUNCTION public.school_payment_kpis(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_payment_kpis(uuid, uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ──────────────────────────────────────────
--
-- 1) Columnas nuevas existen:
--    SELECT column_name FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'school_settings'
--       AND column_name = 'merchandise_enabled';
--    SELECT column_name FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'payments'
--       AND column_name = 'payment_category';
--
-- 2) RLS del catálogo: un padre (anon simulado) NO ve nada de otra escuela ni
--    ítems inactivos de la suya; un admin ve todo lo de su escuela:
--    SELECT set_config('request.jwt.claims', json_build_object('sub','<uuid padre>')::text, true);
--    SELECT * FROM public.school_merchandise_items; -- solo su escuela, solo active=true
--
-- 3) open_month() sigue generando idéntico (mismo conteo que antes) + ahora
--    con payment_category='mensualidad':
--    SELECT public.preview_open_month('<school_id>', 2026, 10);
--    SELECT public.open_month('<school_id>', 2026, 10);
--    SELECT payment_category, count(*) FROM public.payments
--     WHERE school_id = '<school_id>' AND period_year = 2026 AND period_month = 10
--     GROUP BY payment_category; -- debe salir 100% 'mensualidad'
--
-- 4) cash_ledger y school_payment_kpis() no cambiaron ninguna cifra:
--    comparar 'revenue_total' de school_payment_kpis() y el SUM(amount) de
--    cash_ledger para una escuela conocida, antes/después — deben coincidir
--    con lo que mostraban antes de esta migración.
--
-- Vuelta atrás: migración nueva que (a) DROP la tabla/columnas nuevas,
-- (b) reponga open_month()/cash_ledger/school_payment_kpis() a los cuerpos de
-- 20260827175215 / 20260707000001 / 20260730000005 respectivamente.
