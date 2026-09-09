-- =============================================================================
-- 20260908152538_catalogo_torneos_y_articulos_self_service.sql
-- Autor: brylop   Fecha: 2026-09-08   Versión anterior: 20260908102447
-- Objetivo: (1) revertir PARCIALMENTE 20260903171854 — el catálogo de
--   artículos vuelve a ser editable por el admin/owner de la escuela (no solo
--   panel interno); el TOGGLE de activación (merchandise_enabled) se queda
--   exactamente como quedó el 3-sep (solo super admin lo prende/apaga). Es
--   decir: SportMaps sigue decidiendo QUÉ escuela tiene el módulo, la escuela
--   decide QUÉ VENDE dentro de él. (2) agrega un catálogo simétrico para
--   cobros de torneos (`school_tournament_items` + `tournament_charges_enabled`),
--   mismo patrón desde el día uno — self-service para la escuela, activación
--   gateada a super admin. (3) agrega 'torneo' a payments.payment_category y
--   su desglose en school_payment_kpis().
--
--   Decisión del usuario (2026-09-08) que motiva el punto 1: "la idea era
--   nosotros activar que puedan agregar esos catálogos... pero la
--   configuración lo hacen las escuelas y los nuevos items a cobrar también".
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

-- ── 1. school_merchandise_items: la escuela vuelve a poder editar su catálogo ──
--
-- Revierte SOLO esta policy de 20260903171854. El trigger
-- guard_merchandise_enabled_super_admin_only() sobre school_settings NO se
-- toca: el toggle sigue siendo exclusivo de super admin.

DROP POLICY IF EXISTS school_merchandise_items_write ON public.school_merchandise_items;
CREATE POLICY school_merchandise_items_write ON public.school_merchandise_items
  FOR ALL
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

-- ── 2. Catálogo de torneos (paralelo a artículos, sin tallas/imagen) ─────────

CREATE TABLE public.school_tournament_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  price       numeric(12,2) NOT NULL CHECK (price >= 0),
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_tournament_items IS
  'Catálogo liviano de cobros de torneo (ej. "Torneo Interclubes — $50.000") que una escuela '
  'ofrece a los padres dentro del mismo flujo de pago de inscripción/mensualidad/artículos. '
  'Genera su propia fila en payments (payment_category=''torneo''), nunca se funde con esos '
  'otros conceptos. NO es el módulo grande de "Torneos por Escuela" (events/event_delegations '
  'con brackets/resultados) — ver [[project_school_tournaments]] en memoria del proyecto.';

CREATE INDEX idx_school_tournament_items_school
  ON public.school_tournament_items (school_id)
  WHERE active = true;

CREATE TRIGGER trg_school_tournament_items_updated_at
  BEFORE UPDATE ON public.school_tournament_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.school_tournament_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_tournament_items_select ON public.school_tournament_items
  FOR SELECT
  USING (
    (active = true AND school_id = ANY (public.user_school_ids()))
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY school_tournament_items_write ON public.school_tournament_items
  FOR ALL
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

REVOKE ALL ON public.school_tournament_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_tournament_items TO authenticated;

-- ── 3. Toggle de activación — igual patrón/blindaje que merchandise_enabled ──

ALTER TABLE public.school_settings
  ADD COLUMN tournament_charges_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.tournament_charges_enabled IS
  'Si está en true, los padres ven la sección de cobros de torneo al pagar. Nace en false para '
  'TODA escuela — activación manual por escuela (piloto: Besser), gateada a super admin igual '
  'que merchandise_enabled (mismo trigger guard, ver abajo). La escuela SÍ administra el '
  'contenido del catálogo (school_tournament_items) una vez activado.';

CREATE OR REPLACE FUNCTION public.guard_tournament_charges_enabled_super_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.tournament_charges_enabled IS DISTINCT FROM OLD.tournament_charges_enabled
     AND NOT public.is_super_admin() THEN
    NEW.tournament_charges_enabled := OLD.tournament_charges_enabled;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_tournament_charges_enabled_super_admin_only() IS
  'Revierte school_settings.tournament_charges_enabled si quien actualiza la fila no es super '
  'admin — mismo patrón que guard_merchandise_enabled_super_admin_only() (20260903171854). El '
  'resto de la fila sigue editable por la escuela sin restricción.';

DROP TRIGGER IF EXISTS trg_guard_tournament_charges_enabled ON public.school_settings;
CREATE TRIGGER trg_guard_tournament_charges_enabled
  BEFORE UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_charges_enabled_super_admin_only();

-- RPCs para el panel interno (mismo patrón que admin_get/set_school_merchandise_enabled,
-- 20260903150628 + 20260904131122 — school_settings no tiene policy de SELECT para
-- is_super_admin(), solo is_school_admin()/owner).

CREATE OR REPLACE FUNCTION public.admin_get_school_tournament_charges_enabled(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT tournament_charges_enabled INTO v_enabled
  FROM public.school_settings WHERE school_id = p_school_id;

  RETURN COALESCE(v_enabled, false);
END;
$$;

COMMENT ON FUNCTION public.admin_get_school_tournament_charges_enabled(uuid) IS
  'Lee tournament_charges_enabled para el panel interno. Mismo motivo que admin_get_school_merchandise_enabled.';

REVOKE ALL ON FUNCTION public.admin_get_school_tournament_charges_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_school_tournament_charges_enabled(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_school_tournament_charges_enabled(
  p_school_id uuid,
  p_enabled   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  UPDATE public.school_settings
  SET tournament_charges_enabled = p_enabled
  WHERE school_id = p_school_id;

  IF NOT FOUND THEN
    INSERT INTO public.school_settings (school_id, tournament_charges_enabled)
    VALUES (p_school_id, p_enabled);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_set_school_tournament_charges_enabled(uuid, boolean) IS
  'Prende/apaga el catálogo de torneos para una escuela. Solo super admin — igual que '
  'admin_set_school_merchandise_enabled, no es un addon comercial (school_addons).';

REVOKE ALL ON FUNCTION public.admin_set_school_tournament_charges_enabled(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_tournament_charges_enabled(uuid, boolean) TO authenticated, service_role;

-- ── 4. payments.payment_category: agrega 'torneo' ────────────────────────────

ALTER TABLE public.payments DROP CONSTRAINT payments_payment_category_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_category_check
  CHECK (payment_category IS NULL OR payment_category IN ('mensualidad', 'inscripcion', 'articulos', 'torneo', 'otro'));

-- ── 5. school_payment_kpis(): agrega revenue_torneo (mismo patrón que revenue_articulos) ──
--
-- Cuerpo completo copiado tal cual de 20260903150628 + el bloque nuevo. No
-- cambia revenue_total ni ninguna otra cifra existente.

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

    'revenue_articulos',
      COALESCE(SUM(CASE WHEN p.payment_category = 'articulos' AND p.status = 'paid'
                          THEN LEAST(p.amount, COALESCE(p.amount_paid, p.amount))
                        WHEN p.payment_category = 'articulos' AND p.status = 'partial'
                          THEN COALESCE(p.amount_paid, 0)
                        ELSE 0 END), 0),

    -- Desglose nuevo (20260908152538), mismo patrón que revenue_articulos: NO
    -- se resta de revenue_total, solo lo hace visible por separado.
    'revenue_torneo',
      COALESCE(SUM(CASE WHEN p.payment_category = 'torneo' AND p.status = 'paid'
                          THEN LEAST(p.amount, COALESCE(p.amount_paid, p.amount))
                        WHEN p.payment_category = 'torneo' AND p.status = 'partial'
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
    'revenue_total', 0, 'revenue_articulos', 0, 'revenue_torneo', 0, 'tx_count', 0, 'charges_total', 0,
    'awaiting_count', 0, 'awaiting_amount', 0,
    'debt_count', 0, 'debt_amount', 0, 'attempts', 0, 'approval_rate', NULL
  ));
END;
$$;

COMMENT ON FUNCTION public.school_payment_kpis(uuid, uuid) IS
  'KPIs de pagos de una escuela agregados en DB sobre TODO el histórico. revenue_articulos '
  '(20260903150628) y revenue_torneo (20260908152538) son desgloses informativos de '
  'revenue_total, no se restan de él.';

REVOKE ALL ON FUNCTION public.school_payment_kpis(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_payment_kpis(uuid, uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ──────────────────────────────────────────
--
-- 1) El admin/owner de una escuela YA PUEDE editar su catálogo de artículos de
--    nuevo (regresión del blindaje del 3-sep, a propósito):
--    SELECT set_config('request.jwt.claims', json_build_object('sub','<uuid admin escuela>')::text, true);
--    INSERT INTO public.school_merchandise_items (school_id, name, price) VALUES ('<su escuela>', 'Test', 1000);
--    -- debe funcionar.
--
-- 2) El toggle sigue blindado a super admin (sin cambios respecto al 3-sep):
--    UPDATE public.school_settings SET merchandise_enabled = true WHERE school_id = '<su escuela>';
--    SELECT merchandise_enabled FROM public.school_settings WHERE school_id = '<su escuela>'; -- sigue igual que antes del UPDATE
--
-- 3) Un padre (miembro sin rol admin) NO puede escribir en ninguno de los dos catálogos.
--
-- 4) payments.payment_category acepta 'torneo':
--    INSERT INTO public.payments (school_id, amount, concept, due_date, status, payment_type, payment_category)
--    VALUES ('<escuela>', 1000, 'test torneo', now(), 'pending', 'one_time', 'torneo'); -- debe funcionar, luego borrar.
--
-- 5) school_payment_kpis() expone revenue_torneo sin cambiar revenue_total ni revenue_articulos.
--
-- Vuelta atrás: migración nueva que (a) repone la policy de escritura de
-- school_merchandise_items a is_super_admin() only, (b) DROP tabla
-- school_tournament_items + columna/trigger/RPCs de tournament_charges_enabled,
-- (c) quita 'torneo' del CHECK, (d) repone school_payment_kpis() sin revenue_torneo.
