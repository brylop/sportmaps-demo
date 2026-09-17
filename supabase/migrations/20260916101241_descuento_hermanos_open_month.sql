-- =============================================================================
-- 20260916101241_descuento_hermanos_open_month.sql
-- Autor: brylop   Fecha: 2026-09-16   Versión anterior: 20260915202324
-- Objetivo: F1 de docs/specs/descuentos-hermanos-primos-referidos.md — el
-- descuento por hermanos, primos y referidos que hoy no existe. Un atleta
-- puede llevar como máximo un tipo de descuento; hermanos es automático y se
-- recalcula cada mes (nunca se congela), primos/referido son manuales y usan
-- el mecanismo de fee_is_manual que ya existe (becas).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- DECISIONES DE PRODUCTO (cerradas 2026-09-15, ver el spec)
--
--   1. Uno solo por atleta — nunca se acumulan dos tipos de descuento.
--   2. Hermanos es automático y siempre activo si la escuela lo habilita — la
--      escuela NO lo marca atleta por atleta, se recalcula solo según quién
--      esté matriculado ese mes (si un hermano se retira, el descuento
--      desaparece solo el mes siguiente).
--   3. Primos (familia extendida) y referidos son manuales — la escuela los
--      asigna a mano, sin autoservicio. Reusan fee_is_manual/fee_reason
--      (20260827175215): la escuela fija el monto y ahora también
--      discount_type, para poder reportar y para que la UI (F3) bloquee
--      marcar un segundo tipo.
--   4. % de hermanos configurable POR ESCUELA (no un valor fijo global) —
--      mismo patrón que military_discount_enabled (20260903170318).
--   5. Umbral: desde el 2do hijo activo (el primero paga completo). El
--      "primero" es el que tiene la inscripción activa más antigua entre
--      hermanos (mismo parent_id, misma escuela).
--   6. Conflicto — el manual gana: fee_is_manual=true ya salta la cascada por
--      completo (incluida la parte de hermanos), así que si la escuela marca
--      primos/referido a mano, hermanos deja de evaluarse solo para ese
--      atleta mientras el manual esté activo. No hace falta código nuevo
--      para esto — es una consecuencia directa de dónde se engancha el CASE.
--
-- ALCANCE: el conteo de "hermanos activos" es por parent_id DENTRO DE LA
-- MISMA ESCUELA — dos hermanos en escuelas distintas no cuentan entre sí.
-- Solo aplica a menores (children.parent_id); adultos y no-registrados no
-- tienen padre en el modelo, así que nunca activan ni reciben el descuento
-- de hermanos.
--
-- El cambio va en las DOS funciones de generación (open_month y
-- preview_open_month), mismo criterio que exige el header de
-- fee_is_manual: si el preview no lo refleja, la pantalla de confirmación
-- miente. Se toma como base el CUERPO VIGENTE (20260910082224), que ya
-- incluye pausa de vacaciones y payment_category — no el de 20260827.

BEGIN;

-- ── 1. Config de hermanos por escuela ───────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS sibling_discount_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sibling_discount_percentage numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.school_settings.sibling_discount_enabled IS
  'Si true, open_month/preview_open_month aplican sibling_discount_percentage automáticamente desde el 2do hijo activo (mismo parent_id, misma escuela). Default false = apagado para todas. Configurable en Ajustes de la escuela (F2).';
COMMENT ON COLUMN public.school_settings.sibling_discount_percentage IS
  '0-100. Solo tiene efecto si sibling_discount_enabled = true. No se valida el rango en BD (se confía en la UI de F2, igual que otros % de la tabla).';

-- ── 2. Tipo de descuento manual en enrollments ──────────────────────────────
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS discount_type text
    CHECK (discount_type IN ('extended_family', 'referral'));

COMMENT ON COLUMN public.enrollments.discount_type IS
  'Tag del descuento MANUAL aplicado (primos/familia extendida o referido). Solo tiene sentido junto a fee_is_manual = true — el monto ya viene puesto a mano en monthly_fee, esto es para reportar y para que la UI (F3) impida marcar un segundo tipo. Hermanos NO usa esta columna: se calcula en vivo en open_month, nunca se guarda.';

-- ── 3. Auditoría del descuento de hermanos en el pago generado ─────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS sibling_discount_applied numeric;

COMMENT ON COLUMN public.payments.sibling_discount_applied IS
  'Monto que se restó por descuento de hermanos al generar este pago (NULL si no aplicó). Mismo patrón que early_payment_discount_applied: congela lo que pasó en ese momento — si el hermano se retira después, este pago ya generado no cambia de significado.';

-- ── 4. open_month: hermanos automático, primos/referido vía fee_is_manual ──
CREATE OR REPLACE FUNCTION public.open_month(
  p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_created          int := 0;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );

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
      -- Base: lo mismo que resolvía la cascada antes de este cambio.
      SELECT COALESCE(
               NULLIF(e.monthly_fee, 0),
               NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
               NULLIF(t.price_monthly, 0),
               NULLIF(c.monthly_fee, 0),
               0
             ) AS base_amount
    ) base
    CROSS JOIN LATERAL (
      -- % de hermanos si aplica: solo menores, escuela con el flag prendido,
      -- y existe otro hermano activo con inscripción MÁS ANTIGUA (ese es el
      -- "primero" que paga completo). fee_is_manual ya salta este bloque por
      -- completo más abajo (el manual gana, decisión #6).
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
$fn$;

COMMENT ON FUNCTION public.open_month(uuid, int, int, uuid) IS
  'Genera las cuotas del mes por una sola vía canónica. fee_is_manual=true salta la cascada Y el descuento de hermanos (el manual gana). Si no es manual, aplica sibling_discount_percentage automáticamente desde el 2do hijo activo (mismo parent_id, misma escuela) cuando school_settings.sibling_discount_enabled=true. Respeta pausas de vacaciones. Idempotente.';

-- ── 5. preview_open_month: MISMO criterio, para que la confirmación no mienta
CREATE OR REPLACE FUNCTION public.preview_open_month(
  p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_items            jsonb;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_due := make_date(p_year, p_month, LEAST(v_cutoff, extract(day from (v_month_end - 1))::int));

  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS athlete_name,
      CASE WHEN e.child_id IS NOT NULL THEN 'menor'
           WHEN e.user_id  IS NOT NULL THEN 'adulto'
           ELSE 'no_registrado' END                                AS tipo,
      fee.amount                                                   AS amount,
      fee.sibling_discount_applied                                 AS sibling_discount_applied
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
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'athlete',  el.athlete_name,
           'tipo',     el.tipo,
           'amount',   el.amount,
           'sibling_discount_applied', el.sibling_discount_applied,
           'due_date', v_due
         )), '[]'::jsonb)
  INTO v_items
  FROM elegibles el;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date', v_due,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
END;
$fn$;

COMMENT ON FUNCTION public.preview_open_month(uuid, int, int, uuid) IS
  'Vista previa de open_month sin persistir. MISMO criterio de hermanos/fee_is_manual — si difiere, la pantalla de confirmación miente.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Verificación (correr después de aplicar):
--
-- 1) Columnas nuevas existen:
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'school_settings' AND column_name LIKE 'sibling_discount%';
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'enrollments' AND column_name = 'discount_type';
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'payments' AND column_name = 'sibling_discount_applied';
--
-- 2) Prender hermanos en una escuela de prueba y confirmar que preview lo ve:
--    UPDATE school_settings SET sibling_discount_enabled = true,
--           sibling_discount_percentage = 10 WHERE school_id = '<school_id>';
--    -- con 2+ hijos activos del mismo parent_id en esa escuela:
--    SELECT public.preview_open_month('<school_id>', 2026, 10);
--    -- el hijo con la inscripción más antigua sale con amount completo y
--    -- sibling_discount_applied = null; el/los siguiente(s) con amount
--    -- reducido y sibling_discount_applied > 0.
--
-- 3) Retirar (status != 'active') al hermano más antiguo y correr preview de
--    nuevo: el que antes era "2do" ahora debe salir con amount completo (es
--    el único activo, ya no hay hermano más antiguo que lo anteceda).
--
-- 4) fee_is_manual sigue ganando: un atleta con fee_is_manual=true y 2+
--    hermanos activos NO debe llevar sibling_discount_applied — su monto es
--    el manual, tal cual, sin descuento de hermanos superpuesto.
--
-- 5) Sin sibling_discount_enabled (default false) el comportamiento no
--    cambia frente a lo que hacía 20260910082224 — mismo amount, sin la
--    columna nueva poblada.
--
-- Vuelta atrás: migración nueva que reponga el cuerpo de 20260910082224 para
-- las dos funciones, y ALTER TABLE ... DROP COLUMN para las tres columnas.
-- =============================================================================
