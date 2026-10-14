-- =============================================================================
-- 20261013170548_tienda_ingresos_en_finanzas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261013170543
-- Objetivo: las ventas de la tienda escolar no aparecían en los ingresos que
--   mira la escuela (inicio, Finanzas, Contabilidad, estado de resultados,
--   CSV). Esta migración agrega SOLO funciones de LECTURA:
--   · store_income_lines(school, from, to, branch)     una fila por orden.
--   · store_income_summary(school, from, to, branch, group)  por mes|día|sede|método.
--   · store_income_has_store(school)                   ¿la escuela tiene tienda?
--   · finance_income_by_origin(owner_type, owner, from, to, branch, group)
--       mensualidades / inscripciones / artículos / torneos / otros_cobros
--       (de la fórmula única, finance_income_lines) + tienda, sin duplicar.
--   Fuente de la tienda: orders cobradas del vendor ESCOLAR de la escuela
--   (dueño por la foto order_items.owner_type/owner_id; si falta, el
--   vendor_profile tipo 'school' — misma regla que _store_order_owner),
--   neto de reembolsos completados, fecha = paid_at en America/Bogota, sede =
--   pickup_branch_id (la sede incluye las órdenes SIN sede, regla A3).
--   Permiso: el MISMO de la fórmula única, finance_permission('school', id,
--   'read'); coach/staff/padre/atleta/escuela ajena → 42501, nunca ceros.
-- Contrato (docs/specs/contabilidad-v2-f0-plan-migraciones.md §6,
--   docs/specs/tienda-cambio-gestion-a-tienda.md §4.1): la tienda NO se copia a
--   payments ni abre otra rama en cash_ledger. NO se tocan cash_ledger,
--   payments, finance_income_* ni finance_pnl_monthly. El asiento contable
--   sigue llegando por accounting_outbox (commerce_sale / commerce_refund) y su
--   procesamiento es F1 (libro mayor).
-- Decisión: el reembolso resta en el MES DE LA VENTA (paid_at), no en el de la
--   devolución: es lectura de recaudo neto por venta. El libro mayor (F1) lo
--   asentará en su propia fecha por el evento commerce_refund.
-- Rollback: DROP FUNCTION ×4 y DROP INDEX (no tienen dependientes).
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

DO $pre$
BEGIN
    IF to_regprocedure('public.finance_permission(text,uuid,text)') IS NULL
       OR to_regprocedure('public.finance_income_lines(text,uuid,date,date,uuid,boolean)') IS NULL THEN
        RAISE EXCEPTION 'Falta la fórmula única (20261003202416 / 20261003202419): aplicarlas antes.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'vendor_profiles' AND column_name = 'school_id')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'owner_type') THEN
        RAISE EXCEPTION 'Falta tienda v2 F0 (vendor_profiles.school_id / order_items.owner_type): aplicarla antes.';
    END IF;
END
$pre$;

-- Lectura por vendedor y fecha de cobro (la consulta parte de aquí).
CREATE INDEX IF NOT EXISTS orders_vendor_profile_paid_at_idx
    ON public.orders (vendor_profile_id, paid_at)
 WHERE paid_at IS NOT NULL;

-- ─── ¿La escuela tiene tienda? ───────────────────────────────────────────────
-- Tiene tienda = un vendor_profile escolar verificado, o ventas ya cobradas
-- (una tienda cerrada que vendió sigue mostrando su ingreso).
CREATE OR REPLACE FUNCTION public.store_income_has_store(p_school_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.finance_permission('school', p_school_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (
           SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.school_id = p_school_id
              AND vp.vendor_type::text = 'school'
              AND (vp.verification_status::text = 'verified'
                   OR EXISTS (SELECT 1 FROM public.orders o
                               WHERE o.vendor_profile_id = vp.id AND o.paid_at IS NOT NULL)))
      OR EXISTS (
           SELECT 1 FROM public.order_items oi
             JOIN public.orders o ON o.id = oi.order_id
            WHERE oi.owner_type = 'school' AND oi.owner_id = p_school_id
              AND o.paid_at IS NOT NULL);
END;
$function$;

-- ─── Líneas: una por orden cobrada de la tienda de la escuela ────────────────
-- service_role sin JWT puede leer (BFF). Un usuario sin permiso recibe 42501.
CREATE OR REPLACE FUNCTION public.store_income_lines(
    p_school_id uuid, p_from date, p_to date, p_branch_id uuid DEFAULT NULL)
 RETURNS TABLE (order_id uuid, school_id uuid, branch_id uuid, paid_date date,
                reference text, status text, payment_method text,
                gross_amount numeric, refunded_amount numeric, income_amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.finance_permission('school', p_school_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'store_income_lines: rango inválido % – %', p_from, p_to USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH vps AS (
      SELECT vp.id FROM public.vendor_profiles vp
       WHERE vp.school_id = p_school_id AND vp.vendor_type::text = 'school'
    ), cand AS (
      SELECT o.* FROM public.orders o
       WHERE o.paid_at >= (p_from::timestamp AT TIME ZONE 'America/Bogota')
         AND o.paid_at <  ((p_to + 1)::timestamp AT TIME ZONE 'America/Bogota')
         AND o.status IN ('paid','preparing','ready_for_pickup','shipped','delivered',
                          'refunded','partially_refunded')
         AND (o.vendor_profile_id IN (SELECT id FROM vps)
              OR EXISTS (SELECT 1 FROM public.order_items x
                          WHERE x.order_id = o.id AND x.owner_type = 'school' AND x.owner_id = p_school_id))
    )
    SELECT c.id,
           p_school_id,
           c.pickup_branch_id,
           (c.paid_at AT TIME ZONE 'America/Bogota')::date,
           c.reference,
           c.status,
           c.payment_method,
           COALESCE(c.total_amount, 0)::numeric,
           COALESCE(rf.refunded, 0)::numeric,
           GREATEST(COALESCE(c.total_amount, 0) - COALESCE(rf.refunded, 0), 0)::numeric
      FROM cand c
      LEFT JOIN public.vendor_profiles vp ON vp.id = c.vendor_profile_id
      LEFT JOIN LATERAL (SELECT x.owner_type, x.owner_id FROM public.order_items x
                          WHERE x.order_id = c.id AND x.owner_type IS NOT NULL LIMIT 1) oi ON true
      LEFT JOIN LATERAL (SELECT SUM(r.refund_amount) AS refunded FROM public.refunds r
                          WHERE r.order_id = c.id AND r.status = 'completed') rf ON true
     -- Dueño: la foto del ítem manda; sin foto, el vendor escolar (= _store_order_owner).
     WHERE COALESCE(oi.owner_type,
                    CASE WHEN vp.vendor_type::text = 'school' AND vp.school_id IS NOT NULL THEN 'school' ELSE 'vendor' END) = 'school'
       AND COALESCE(oi.owner_id,
                    CASE WHEN vp.vendor_type::text = 'school' AND vp.school_id IS NOT NULL THEN vp.school_id ELSE vp.id END) = p_school_id
       AND (p_branch_id IS NULL OR c.pickup_branch_id = p_branch_id OR c.pickup_branch_id IS NULL)   -- A3
     ORDER BY c.paid_at, c.id;
END;
$function$;

-- ─── Resumen: p_group ∈ month | day | branch | method ───────────────────────
CREATE OR REPLACE FUNCTION public.store_income_summary(
    p_school_id uuid, p_from date, p_to date, p_branch_id uuid DEFAULT NULL, p_group text DEFAULT 'month')
 RETURNS TABLE (bucket text, income_amount numeric, gross_amount numeric, refunded_amount numeric, tx_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF p_group IS NULL OR p_group NOT IN ('month','day','branch','method') THEN
    RAISE EXCEPTION 'store_income_summary: agrupamiento inválido %', p_group USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.finance_permission('school', p_school_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.b, SUM(g.inc)::numeric, SUM(g.gross)::numeric, SUM(g.ref)::numeric, COUNT(*)::integer
      FROM (
        SELECT CASE p_group
                 WHEN 'month'  THEN to_char(l.paid_date, 'YYYY-MM')
                 WHEN 'day'    THEN to_char(l.paid_date, 'YYYY-MM-DD')
                 WHEN 'method' THEN COALESCE(l.payment_method, 'sin_metodo')
                 ELSE COALESCE(l.branch_id::text, 'sin_sede')
               END AS b,
               l.income_amount AS inc, l.gross_amount AS gross, l.refunded_amount AS ref
          FROM public.store_income_lines(p_school_id, p_from, p_to, p_branch_id) l
      ) g
     GROUP BY g.b
     ORDER BY g.b;
END;
$function$;

-- ─── Ingresos por origen: fórmula única + tienda, sin duplicar ──────────────
-- La tienda no escribe en payments (D-2), así que las dos fuentes son
-- disjuntas: total = Σ finance_income_lines + Σ store_income_lines.
-- p_group ∈ month | total. Los cobros SIN payment_date van al bucket
-- 'sin_fecha' (igual que finance_income_summary); la tienda siempre tiene fecha.
-- Origen de los cobros por payment_category: mensualidad → mensualidades,
-- inscripcion → inscripciones, articulos → articulos, torneo → torneos, el
-- resto (incluido NULL: mensualidades del cron viejas) → otros_cobros.
CREATE OR REPLACE FUNCTION public.finance_income_by_origin(
    p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL, p_group text DEFAULT 'month')
 RETURNS TABLE (bucket text, origin text, income_amount numeric, tx_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF p_group IS NULL OR p_group NOT IN ('month','total') THEN
    RAISE EXCEPTION 'finance_income_by_origin: agrupamiento inválido %', p_group USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_owner_type IS DISTINCT FROM 'school' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT u.b, u.o, SUM(u.inc)::numeric, COUNT(*)::integer
      FROM (
        SELECT CASE WHEN l.payment_date IS NULL THEN 'sin_fecha'
                    WHEN p_group = 'month' THEN to_char(l.payment_date, 'YYYY-MM')
                    ELSE 'total' END AS b,
               CASE l.concept_key
                 WHEN 'mensualidad' THEN 'mensualidades'
                 WHEN 'inscripcion' THEN 'inscripciones'
                 WHEN 'articulos'   THEN 'articulos'
                 WHEN 'torneo'      THEN 'torneos'
                 ELSE 'otros_cobros'
               END AS o,
               l.income_amount AS inc
          FROM public.finance_income_lines(p_owner_type, p_owner_id, p_from, p_to, p_branch_id, true) l
        UNION ALL
        SELECT CASE WHEN p_group = 'month' THEN to_char(s.paid_date, 'YYYY-MM') ELSE 'total' END,
               'tienda',
               s.income_amount
          FROM public.store_income_lines(p_owner_id, p_from, p_to, p_branch_id) s
      ) u
     GROUP BY u.b, u.o
     ORDER BY u.b, u.o;
END;
$function$;

-- ─── GRANT / REVOKE ──────────────────────────────────────────────────────────
-- REVOKE explícito de authenticated y anon: los default privileges del esquema
-- les dan EXECUTE a toda función nueva (trampa 3 de CLAUDE.md).
REVOKE ALL ON FUNCTION public.store_income_has_store(uuid)                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_income_lines(uuid, date, date, uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_income_summary(uuid, date, date, uuid, text)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_income_by_origin(text, uuid, date, date, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_income_has_store(uuid)                              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_income_lines(uuid, date, date, uuid)                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_income_summary(uuid, date, date, uuid, text)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_income_by_origin(text, uuid, date, date, uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.store_income_lines(uuid, date, date, uuid) IS
  'Ventas cobradas de la tienda escolar (neto de reembolsos completados, fecha = paid_at Bogotá). Lectura; gate finance_permission read. No toca payments ni cash_ledger.';
COMMENT ON FUNCTION public.finance_income_by_origin(text, uuid, date, date, uuid, text) IS
  'Ingresos por origen: fórmula única (payments) + tienda, fuentes disjuntas. Gate finance_permission read.';

COMMIT;
