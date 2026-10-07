-- =============================================================================
-- 20261007095911_ventas_wa_f0_carril_b.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261007095845
-- Objetivo: F0 (datos y permisos) de VENTAS POR WHATSAPP, solo CARRIL B
-- (cobros de servicio: clase de perfeccionamiento/refuerzo/extra, vacacionales,
-- torneos y viajes). Spec: docs/specs/ventas-por-whatsapp.md §16 (plan) y §17
-- (contrato con el BFF). Aprobado por el usuario el 2026-10-07.
--
--   1. payments.payment_category += clase_extra, vacacional, viaje (D-V4).
--   2. open_month: un cobro de artículos/torneo/clase extra/vacacional/viaje
--      del mes ya NO cuenta como «la mensualidad del período ya está cobrada».
--      (Bug encontrado al planear: con un torneo del mes, open_month se saltaba
--      la mensualidad del atleta.) Copiado de la BASE VIVA con
--      pg_get_functiondef el 2026-10-07 (la viva ya trae v_grace); único cambio:
--      la lista del NOT IN.
--   3. school_tournament_items: kind, image_url, starts_at, ends_at, capacity,
--      per_athlete, allow_installments (§4.4). Filas existentes → 'torneo'.
--   4. school_settings.wa_ventas_habilitadas (default false).
--   5. whatsapp_conversation_flows acepta flow 'venta' y sus pasos (§6.1).
--   6. Tabla puente wa_cobros_sueltos: clave anti-duplicados, vínculo
--      cobro↔ítem (cupos) y marca de «lo creó el bot» (D-V9). Solo service role.
--   7. RPC wa_catalogo_servicios     (solo lectura, para el bot).
--   8. RPC wa_crear_cobro_suelto     (transaccional, FOR UPDATE, idempotente).
--   9. RPC wa_anular_cobros_sueltos_vencidos (job del BFF cada 5 min).
--
-- Radio medido (2026-10-07, solo SELECT):
--   · payment_category articulos=1, torneo=2 (1 abierta), otro=1 en toda la
--     base → el cambio de open_month afecta a lo sumo 3 filas, y solo para
--     dejar de saltarse una mensualidad.
--   · school_tournament_items: las filas existentes reciben kind='torneo',
--     per_athlete=true, sin fecha ni cupo. Sus policies NO se tocan.
--   · whatsapp_conversation_flows: los CHECK solo amplían.
--
-- RLS: ninguna policy nueva ni modificada. wa_cobros_sueltos queda con RLS
-- activa y SIN policies (solo service role). Las 3 RPC: SECURITY DEFINER,
-- search_path fijo, REVOKE de PUBLIC/anon/authenticated (trampa 3: los default
-- privileges del esquema le dan EXECUTE a authenticated) y GRANT a service_role.
--
-- Pruebas: supabase/migrations/_smoke/ventas_wa_f0_smoke.sql (ROLLBACK).
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

-- ── 1. payment_category: += clase_extra, vacacional, viaje (solo amplía) ────
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_category_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_category_check
  CHECK (payment_category IS NULL OR payment_category = ANY (ARRAY[
    'mensualidad','inscripcion','articulos','torneo','otro','seguro','excedente',
    'clase_extra','vacacional','viaje'
  ]));

-- ── 2. open_month: los cobros de servicio no ocupan el período ──────────────
CREATE OR REPLACE FUNCTION public.open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_created          int := 0;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
  v_grace            int;
  v_today            date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(payment_grace_days, 5),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_grace, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_grace  := COALESCE(v_grace, 5);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );
  -- FIX 2026-10-05 (H-01): un cobro NUEVO nunca nace vencido. Si el corte del
  -- mes ya pasó (el cron abre el mes en curso todos los días, y una escuela que
  -- pone precio el 8 con corte el 1 recibía cobros vencidos esa misma noche), el
  -- vencimiento pasa a hoy + días de gracia: la MISMA regla que billingDue
  -- (bff/src/services/enrollmentBilling.ts) y qr_first_charge_due_date. El
  -- PERIODO no cambia: sigue siendo p_year/p_month.
  IF v_due < v_today THEN
    v_due := v_today + v_grace;
  END IF;

  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(c.branch_id, t.branch_id)                             AS branch_id,
      c.parent_id,
      e.child_id,
      e.user_id,
      e.unregistered_athlete_id,
      e.team_id,
      e.offering_plan_id,
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')    AS athlete_name,
      fee.amount                                                     AS amount,
      fee.sibling_discount_applied                                   AS sibling_discount_applied
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
               NULLIF(e.monthly_fee, 0),
               NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
               NULLIF(t.price_monthly, 0),
               NULLIF(c.monthly_fee, 0),
               0
             ) AS base_amount
    ) base
    CROSS JOIN LATERAL (
      SELECT CASE
               WHEN v_sibling_enabled AND v_sibling_pct > 0 AND c.parent_id IS NOT NULL
                    AND EXISTS (
                      SELECT 1 FROM public.enrollments e2
                      JOIN public.children c2 ON c2.id = e2.child_id
                      WHERE c2.parent_id = c.parent_id
                        AND e2.school_id = e.school_id
                        AND e2.status = 'active'
                        AND e2.child_id <> e.child_id
                        AND (e2.created_at < e.created_at
                             OR (e2.created_at = e.created_at AND e2.child_id < e.child_id))
                    )
               THEN v_sibling_pct
               ELSE 0
             END AS pct
    ) sib
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
             ELSE ROUND(base.base_amount * (1 - sib.pct / 100.0))
        END AS amount,
        CASE WHEN NOT e.fee_is_manual AND sib.pct > 0
             THEN ROUND(base.base_amount * sib.pct / 100.0)
        END AS sibling_discount_applied
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
          AND (
            r.resumed_at IS NULL
            OR date_trunc('month', (r.resumed_at AT TIME ZONE 'America/Bogota')::date)::date
                 >= v_month_start
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          -- 20261005221734: inscripción / seguro / excedente no son la
          -- mensualidad del período aunque traigan period_year/period_month.
          -- 20261007095911: tampoco artículos, torneo, clase extra, vacacional
          -- ni viaje (cobros sueltos de servicio, ventas por WhatsApp).
          AND COALESCE(p2.payment_category, '') NOT IN (
                'inscripcion', 'seguro', 'excedente',
                'articulos', 'torneo', 'clase_extra', 'vacacional', 'viaje')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL
                   AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  ),
  ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month, payment_category, sibling_discount_applied
    )
    SELECT
      el.school_id, el.branch_id, el.parent_id, el.child_id, el.user_id,
      el.unregistered_athlete_id, el.team_id, el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount, v_due, 'pending', 'subscription',
      p_year::smallint, p_month::smallint, 'mensualidad', el.sibling_discount_applied
    FROM elegibles el
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date',  v_due, 'generados', v_created
  );
END;
$function$;
-- ACL de open_month: CREATE OR REPLACE conserva la viva
-- ({postgres, authenticated, service_role}); no se toca.

-- ── 3. school_tournament_items: catálogo de cobros de servicio (§4.4) ───────
ALTER TABLE public.school_tournament_items
  ADD COLUMN IF NOT EXISTS kind               text        NOT NULL DEFAULT 'torneo',
  ADD COLUMN IF NOT EXISTS image_url          text        NULL,
  ADD COLUMN IF NOT EXISTS starts_at          timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ends_at            timestamptz NULL,
  ADD COLUMN IF NOT EXISTS capacity           integer     NULL,
  ADD COLUMN IF NOT EXISTS per_athlete        boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_installments boolean     NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_tournament_items_kind_chk') THEN
    ALTER TABLE public.school_tournament_items
      ADD CONSTRAINT school_tournament_items_kind_chk
      CHECK (kind IN ('torneo', 'viaje', 'clase_extra', 'vacacional', 'otro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_tournament_items_capacity_chk') THEN
    ALTER TABLE public.school_tournament_items
      ADD CONSTRAINT school_tournament_items_capacity_chk
      CHECK (capacity IS NULL OR capacity > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_tournament_items_fechas_chk') THEN
    ALTER TABLE public.school_tournament_items
      ADD CONSTRAINT school_tournament_items_fechas_chk
      CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at);
  END IF;
  -- Solo https: la URL viaja a WhatsApp (type:image, link) y a la app.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_tournament_items_image_url_chk') THEN
    ALTER TABLE public.school_tournament_items
      ADD CONSTRAINT school_tournament_items_image_url_chk
      CHECK (image_url IS NULL OR image_url ~ '^https://[^\s"''<>`]+$');
  END IF;
END $$;

COMMENT ON COLUMN public.school_tournament_items.kind IS
  'Tipo de cobro de servicio: torneo | viaje | clase_extra | vacacional | otro. Es también el payment_category del cobro que crea wa_crear_cobro_suelto (20261007095911).';
COMMENT ON COLUMN public.school_tournament_items.image_url IS
  'Afiche o foto (https). El bot de WhatsApp la manda con la ficha.';
COMMENT ON COLUMN public.school_tournament_items.starts_at IS
  'Inicio del servicio (clase, vacacional, torneo, viaje). Pasada COALESCE(ends_at, starts_at), el ítem deja de venderse por WhatsApp.';
COMMENT ON COLUMN public.school_tournament_items.capacity IS
  'Cupos. NULL = sin límite. wa_crear_cobro_suelto los descuenta con FOR UPDATE (solo cuenta ventas hechas por esa RPC).';
COMMENT ON COLUMN public.school_tournament_items.per_athlete IS
  'true = se cobra por atleta (el bot pregunta a cuál hijo); false = un cobro por familia.';
COMMENT ON COLUMN public.school_tournament_items.allow_installments IS
  'Admite cuotas (viaje). Fuera de v1: solo se guarda el dato.';

-- ── 4. Interruptor por escuela ───────────────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS wa_ventas_habilitadas boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.wa_ventas_habilitadas IS
  'Asistente WhatsApp: vende cobros de servicio (school_tournament_items) por el chat. Exige además tournament_charges_enabled (solo super admin). Default false.';

-- ── 5. whatsapp_conversation_flows: flujo 'venta' ────────────────────────────
ALTER TABLE public.whatsapp_conversation_flows
  DROP CONSTRAINT IF EXISTS whatsapp_conversation_flows_flow_check;
ALTER TABLE public.whatsapp_conversation_flows
  ADD CONSTRAINT whatsapp_conversation_flows_flow_check
  CHECK (flow = ANY (ARRAY['factura_electronica', 'venta']));

ALTER TABLE public.whatsapp_conversation_flows
  DROP CONSTRAINT IF EXISTS whatsapp_conversation_flows_step_check;
ALTER TABLE public.whatsapp_conversation_flows
  ADD CONSTRAINT whatsapp_conversation_flows_step_check
  CHECK (step = ANY (ARRAY[
    -- factura_electronica (sin cambios)
    'preguntar_quiere', 'elegir_canal', 'tipo_documento', 'numero', 'nombre', 'correo', 'confirmar',
    -- venta (20261007095911)
    'venta_elegir_item', 'venta_elegir_variante', 'venta_personalizar',
    'venta_elegir_atleta', 'venta_confirmar', 'venta_esperando_pago'
  ]));

-- ── 6. Tabla puente wa_cobros_sueltos (D-V9) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wa_cobros_sueltos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       uuid        NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  school_id        uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id          uuid        NULL REFERENCES public.school_tournament_items(id) ON DELETE SET NULL,
  parent_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id         uuid        NULL REFERENCES public.children(id) ON DELETE SET NULL,
  conversation_id  uuid        NULL REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  idempotency_key  text        NOT NULL,
  canal            text        NOT NULL DEFAULT 'whatsapp',
  vence_at         timestamptz NOT NULL,
  anulado_at       timestamptz NULL,
  anulado_motivo   text        NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wa_cobros_sueltos_clave_uq UNIQUE (school_id, idempotency_key),
  CONSTRAINT wa_cobros_sueltos_clave_len_chk CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  CONSTRAINT wa_cobros_sueltos_canal_chk CHECK (canal IN ('whatsapp')),
  CONSTRAINT wa_cobros_sueltos_motivo_chk CHECK (anulado_motivo IS NULL OR anulado_motivo IN ('venta_whatsapp_vencida')),
  CONSTRAINT wa_cobros_sueltos_anulado_chk CHECK ((anulado_at IS NULL) = (anulado_motivo IS NULL))
);

COMMENT ON TABLE public.wa_cobros_sueltos IS
  'Cobros de servicio creados por wa_crear_cobro_suelto (ventas por WhatsApp, carril B). Clave de '
  'idempotencia, ítem del catálogo (cupos) y vencimiento de 1 h. Solo service role (RLS sin policies). '
  'Spec docs/specs/ventas-por-whatsapp.md §16.';

CREATE INDEX IF NOT EXISTS idx_wa_cobros_sueltos_item
  ON public.wa_cobros_sueltos (item_id);
CREATE INDEX IF NOT EXISTS idx_wa_cobros_sueltos_por_vencer
  ON public.wa_cobros_sueltos (vence_at)
  WHERE anulado_at IS NULL;

ALTER TABLE public.wa_cobros_sueltos ENABLE ROW LEVEL SECURITY;
-- Sin policies, a propósito: nadie la lee ni la escribe desde el navegador.
REVOKE ALL ON public.wa_cobros_sueltos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_cobros_sueltos TO service_role;

-- ── 7. wa_catalogo_servicios: lo que el bot puede vender (solo lectura) ─────
CREATE OR REPLACE FUNCTION public.wa_catalogo_servicios(
  p_school_id uuid,
  p_buscar    text    DEFAULT NULL,
  p_limite    integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  c_vivos  constant text[] := ARRAY['pending','overdue','awaiting_approval','partial','paid','glosado'];
  v_lim    int := LEAST(GREATEST(COALESCE(p_limite, 10), 1), 20);
  v_hab    boolean := false;
  v_norm   text;
  v_tokens text[];
  v_items  jsonb;
BEGIN
  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object('habilitado', false, 'items', '[]'::jsonb);
  END IF;

  SELECT COALESCE(ss.tournament_charges_enabled, false) AND COALESCE(ss.wa_ventas_habilitadas, false)
    INTO v_hab
  FROM public.school_settings ss
  WHERE ss.school_id = p_school_id;

  v_hab := COALESCE(v_hab, false) AND public.school_is_operational(p_school_id);
  IF NOT v_hab THEN
    RETURN jsonb_build_object('habilitado', false, 'items', '[]'::jsonb);
  END IF;

  -- Búsqueda: palabras de 4+ letras, sin tildes ni signos. Coincide si el
  -- nombre o la descripción contienen alguna; ordena por cuántas contiene.
  v_norm := regexp_replace(
              lower(translate(COALESCE(p_buscar, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
              '[^a-z0-9 ]', ' ', 'g');
  SELECT COALESCE(array_agg(DISTINCT t), ARRAY[]::text[]) INTO v_tokens
  FROM regexp_split_to_table(v_norm, '\s+') AS t
  WHERE char_length(t) >= 4;

  SELECT COALESCE(jsonb_agg(x.j ORDER BY x.puntaje DESC, x.sort_order, x.starts_at NULLS LAST, x.name), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      i.sort_order, i.starts_at, i.name, s.puntaje,
      jsonb_build_object(
        'id',              i.id,
        'nombre',          i.name,
        'descripcion',     i.description,
        'tipo',            i.kind,
        'precio',          i.price,
        'imagen_url',      i.image_url,
        'inicia_en',       i.starts_at,
        'termina_en',      i.ends_at,
        'cupos',           i.capacity,
        'cupos_restantes', CASE WHEN i.capacity IS NULL THEN NULL
                                ELSE GREATEST(i.capacity - c.vivos, 0) END,
        'por_atleta',      i.per_athlete
      ) AS j
    FROM public.school_tournament_items i
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS vivos
      FROM public.wa_cobros_sueltos w
      JOIN public.payments p ON p.id = w.payment_id
      WHERE w.item_id = i.id AND p.status = ANY (c_vivos)
    ) c
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS puntaje
      FROM unnest(v_tokens) AS tk
      WHERE regexp_replace(lower(translate(i.name || ' ' || COALESCE(i.description, ''),
                                           'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
                           '[^a-z0-9 ]', ' ', 'g') LIKE '%' || tk || '%'
    ) s
    WHERE i.school_id = p_school_id
      AND i.active
      AND i.price > 0
      AND (COALESCE(i.ends_at, i.starts_at) IS NULL OR COALESCE(i.ends_at, i.starts_at) > now())
      AND (cardinality(v_tokens) = 0 OR s.puntaje > 0)
    ORDER BY s.puntaje DESC, i.sort_order, i.starts_at NULLS LAST, i.name
    LIMIT v_lim
  ) x;

  RETURN jsonb_build_object('habilitado', true, 'items', v_items);
END;
$$;

COMMENT ON FUNCTION public.wa_catalogo_servicios(uuid, text, integer) IS
  'Catálogo del carril B para el bot de WhatsApp: ítems activos, con precio, no vencidos y con su cupo restante. '
  'habilitado=false si falta tournament_charges_enabled o wa_ventas_habilitadas. Solo service role. (20261007095911)';

REVOKE ALL ON FUNCTION public.wa_catalogo_servicios(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_catalogo_servicios(uuid, text, integer) TO service_role;

-- ── 8. wa_crear_cobro_suelto: el cobro de la venta (transaccional) ──────────
CREATE OR REPLACE FUNCTION public.wa_crear_cobro_suelto(
  p_school_id        uuid,
  p_item_id          uuid,
  p_parent_id        uuid,
  p_child_id         uuid,
  p_idempotency_key  text,
  p_conversation_id  uuid    DEFAULT NULL,
  p_minutos_vigencia integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  c_vivos     constant text[] := ARRAY['pending','overdue','awaiting_approval','partial','paid','glosado'];
  v_key       text := btrim(COALESCE(p_idempotency_key, ''));
  v_min       int  := LEAST(GREATEST(COALESCE(p_minutos_vigencia, 60), 15), 120);
  v_hoy       date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_hab       boolean;
  v_item      public.school_tournament_items%ROWTYPE;
  v_prev      record;
  v_child     text;
  v_vivos     int;
  v_existente uuid;
  v_pid       uuid;
  v_concepto  text;
  v_vence     timestamptz;
BEGIN
  IF char_length(v_key) < 8 OR char_length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'clave_invalida');
  END IF;
  IF p_school_id IS NULL OR p_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'item_no_disponible');
  END IF;
  IF p_parent_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'familia_no_valida');
  END IF;

  -- Interruptores: catálogo prendido por SportMaps + ventas por WhatsApp de la escuela.
  SELECT COALESCE(ss.tournament_charges_enabled, false) AND COALESCE(ss.wa_ventas_habilitadas, false)
    INTO v_hab
  FROM public.school_settings ss
  WHERE ss.school_id = p_school_id;
  IF NOT COALESCE(v_hab, false) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ventas_deshabilitadas');
  END IF;
  IF NOT public.school_is_operational(p_school_id) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'escuela_no_operativa');
  END IF;

  -- Candado del ítem: serializa a todos los que compran el mismo ítem (cupos e
  -- idempotencia exactos con los 3 BFF a la vez).
  SELECT * INTO v_item
  FROM public.school_tournament_items
  WHERE id = p_item_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'item_no_disponible');
  END IF;

  -- Idempotencia (después del candado: ve lo que commiteó el otro).
  SELECT w.payment_id, w.item_id, w.parent_id, w.child_id, w.vence_at,
         p.amount, p.concept, p.payment_category, p.status
    INTO v_prev
  FROM public.wa_cobros_sueltos w
  JOIN public.payments p ON p.id = w.payment_id
  WHERE w.school_id = p_school_id AND w.idempotency_key = v_key;
  IF FOUND THEN
    IF v_prev.item_id IS DISTINCT FROM p_item_id
       OR v_prev.parent_id IS DISTINCT FROM p_parent_id
       OR v_prev.child_id IS DISTINCT FROM p_child_id THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'clave_reutilizada');
    END IF;
    SELECT count(*)::int INTO v_vivos
    FROM public.wa_cobros_sueltos w JOIN public.payments p ON p.id = w.payment_id
    WHERE w.item_id = p_item_id AND p.status = ANY (c_vivos);
    RETURN jsonb_build_object(
      'ok', true, 'idempotente', true,
      'payment_id', v_prev.payment_id,
      'monto', v_prev.amount,
      'concepto', v_prev.concept,
      'categoria', v_prev.payment_category,
      'estado', v_prev.status,
      'vence_at', v_prev.vence_at,
      'cupos_restantes', CASE WHEN v_item.capacity IS NULL THEN NULL
                              ELSE GREATEST(v_item.capacity - v_vivos, 0) END
    );
  END IF;

  -- Ítem vendible.
  IF NOT v_item.active THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'item_no_disponible');
  END IF;
  IF COALESCE(v_item.ends_at, v_item.starts_at) IS NOT NULL
     AND COALESCE(v_item.ends_at, v_item.starts_at) <= now() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'item_vencido');
  END IF;
  IF COALESCE(v_item.price, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'item_sin_precio');
  END IF;

  -- Familia identificada de la escuela (mismo criterio que wa_identify_by_phone).
  IF NOT EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.parent_id = p_parent_id AND c.school_id = p_school_id AND c.is_active
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'familia_no_valida');
  END IF;

  IF p_child_id IS NOT NULL THEN
    SELECT c.full_name INTO v_child
    FROM public.children c
    WHERE c.id = p_child_id AND c.parent_id = p_parent_id
      AND c.school_id = p_school_id AND c.is_active;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'atleta_no_valido');
    END IF;
  ELSIF v_item.per_athlete THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'atleta_requerido');
  END IF;

  -- Ya lo compró (cobro vivo del mismo ítem para el mismo atleta / familia).
  SELECT w.payment_id INTO v_existente
  FROM public.wa_cobros_sueltos w
  JOIN public.payments p ON p.id = w.payment_id
  WHERE w.item_id = p_item_id
    AND p.status = ANY (c_vivos)
    AND (CASE WHEN p_child_id IS NOT NULL THEN w.child_id = p_child_id
              ELSE w.parent_id = p_parent_id AND w.child_id IS NULL END)
  ORDER BY w.created_at DESC
  LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ya_inscrito', 'payment_id', v_existente);
  END IF;

  -- Cupos (exactos: el ítem está bloqueado).
  SELECT count(*)::int INTO v_vivos
  FROM public.wa_cobros_sueltos w JOIN public.payments p ON p.id = w.payment_id
  WHERE w.item_id = p_item_id AND p.status = ANY (c_vivos);
  IF v_item.capacity IS NOT NULL AND v_vivos >= v_item.capacity THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sin_cupos');
  END IF;

  v_concepto := v_item.name
    || CASE WHEN v_item.starts_at IS NOT NULL
            THEN ' · ' || to_char(v_item.starts_at AT TIME ZONE 'America/Bogota', 'DD/MM')
            ELSE '' END
    || CASE WHEN v_child IS NOT NULL THEN ' · ' || v_child ELSE '' END;
  v_vence := now() + make_interval(mins => v_min);

  BEGIN
    INSERT INTO public.payments (
      school_id, parent_id, child_id, amount, concept, due_date, status,
      payment_type, payment_category, period_uniqueness_exempt
    ) VALUES (
      p_school_id, p_parent_id, p_child_id, v_item.price, v_concepto, v_hoy, 'pending',
      'one_time', v_item.kind, true
    )
    RETURNING id INTO v_pid;

    INSERT INTO public.wa_cobros_sueltos (
      payment_id, school_id, item_id, parent_id, child_id, conversation_id,
      idempotency_key, vence_at
    ) VALUES (
      v_pid, p_school_id, p_item_id, p_parent_id, p_child_id, p_conversation_id,
      v_key, v_vence
    );
  EXCEPTION WHEN unique_violation THEN
    -- La misma clave entró por otro ítem en paralelo (el candado es por ítem).
    -- El subbloque deshace el payment insertado.
    RETURN jsonb_build_object('ok', false, 'codigo', 'clave_reutilizada');
  END;

  RETURN jsonb_build_object(
    'ok', true, 'idempotente', false,
    'payment_id', v_pid,
    'monto', v_item.price,
    'concepto', v_concepto,
    'categoria', v_item.kind,
    'estado', 'pending',
    'vence_at', v_vence,
    'cupos_restantes', CASE WHEN v_item.capacity IS NULL THEN NULL
                            ELSE GREATEST(v_item.capacity - v_vivos - 1, 0) END
  );
END;
$$;

COMMENT ON FUNCTION public.wa_crear_cobro_suelto(uuid, uuid, uuid, uuid, text, uuid, integer) IS
  'Ventas por WhatsApp, carril B: crea UN cobro (payments) de un ítem de school_tournament_items para una '
  'familia identificada, con su payment_category, vencimiento de 1 h (wa_cobros_sueltos.vence_at) y cupos '
  'con FOR UPDATE. Idempotente por (school_id, idempotency_key). Errores de negocio en {ok:false, codigo}. '
  'Solo service role. (20261007095911)';

REVOKE ALL ON FUNCTION public.wa_crear_cobro_suelto(uuid, uuid, uuid, uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_crear_cobro_suelto(uuid, uuid, uuid, uuid, text, uuid, integer) TO service_role;

-- ── 9. wa_anular_cobros_sueltos_vencidos: el job de la hora ──────────────────
CREATE OR REPLACE FUNCTION public.wa_anular_cobros_sueltos_vencidos(
  p_limite         integer DEFAULT 200,
  p_margen_minutos integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_lim    int := LEAST(GREATEST(COALESCE(p_limite, 200), 1), 1000);
  v_margen int := LEAST(GREATEST(COALESCE(p_margen_minutos, 15), 0), 240);
  v_rev    int := 0;
  v_ids    uuid[];
BEGIN
  -- Solo lo que el bot creó (está en la tabla puente), venció hace más del
  -- margen y sigue sin pagar. awaiting_approval (mandó comprobante), paid y
  -- partial NO se tocan. SKIP LOCKED: los 3 BFF corren el job a la vez.
  WITH cand AS (
    SELECT w.payment_id
    FROM public.wa_cobros_sueltos w
    JOIN public.payments p ON p.id = w.payment_id
    WHERE w.anulado_at IS NULL
      AND w.vence_at + make_interval(mins => v_margen) < now()
      AND p.status IN ('pending', 'overdue')
    ORDER BY w.vence_at
    LIMIT v_lim
    FOR UPDATE OF w, p SKIP LOCKED
  ), upd AS (
    UPDATE public.payments p
       SET status = 'cancelled',
           rejection_reason = 'venta_whatsapp_vencida',
           updated_at = now()
      FROM cand c
     WHERE p.id = c.payment_id
       AND p.status IN ('pending', 'overdue')
    RETURNING p.id
  ), marca AS (
    UPDATE public.wa_cobros_sueltos w
       SET anulado_at = now(),
           anulado_motivo = 'venta_whatsapp_vencida'
      FROM upd
     WHERE w.payment_id = upd.id
    RETURNING w.payment_id
  )
  SELECT (SELECT count(*)::int FROM cand),
         COALESCE((SELECT array_agg(payment_id) FROM marca), ARRAY[]::uuid[])
    INTO v_rev, v_ids;

  RETURN jsonb_build_object(
    'revisados', v_rev,
    'anulados', cardinality(v_ids),
    'payment_ids', to_jsonb(v_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.wa_anular_cobros_sueltos_vencidos(integer, integer) IS
  'Anula (cancelled, rejection_reason=venta_whatsapp_vencida) los cobros sueltos de ventas por WhatsApp que '
  'pasaron su vence_at + margen sin pagarse (pending/overdue). Idempotente, en lotes, SKIP LOCKED. Solo service role. (20261007095911)';

REVOKE ALL ON FUNCTION public.wa_anular_cobros_sueltos_vencidos(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_anular_cobros_sueltos_vencidos(integer, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ──────────────────────────────────────────
-- 1) Grants (esperado: solo postgres y service_role):
--    select proname, proacl from pg_proc where proname in
--      ('wa_catalogo_servicios','wa_crear_cobro_suelto','wa_anular_cobros_sueltos_vencidos');
-- 2) Tabla cerrada: select relrowsecurity from pg_class where relname = 'wa_cobros_sueltos';  -- true
--    select count(*) from pg_policies where tablename = 'wa_cobros_sueltos';                   -- 0
-- 3) Smoke completo: supabase/migrations/_smoke/ventas_wa_f0_smoke.sql
-- 4) npm run seguridad:invariantes  → sin CRÍTICAS nuevas.
--
-- Vuelta atrás (migración NUEVA): DROP de las 3 funciones y de wa_cobros_sueltos;
-- reponer open_month con el NOT IN de 20261005221734; CHECK de payment_category
-- y de whatsapp_conversation_flows sin los valores nuevos (antes, pasar a 'otro'
-- las filas que los usen); DROP de las columnas nuevas.
