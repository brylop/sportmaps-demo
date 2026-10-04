-- =============================================================================
-- 20261003202421_finanzas_libro_paginado.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202419
-- Objetivo: Contabilidad v2 · F0 · M3. Libro de caja paginado en el servidor
--   (blindaje 2.7 / H7: hoy la pantalla lee cash_ledger entero y PostgREST lo
--   corta en 1.000 filas, y los totales se suman en el cliente sobre lo que
--   llegó). Tres RPC nuevas sobre cash_ledger (SECURITY INVOKER: heredan la RLS
--   y el filtro de ingreso de M2) con gate explícito para devolver 42501 y no
--   una lista vacía:
--   · finance_ledger_page   — keyset por (movement_date DESC NULLS LAST, id DESC).
--   · finance_ledger_totals — totales del rango (nunca la suma de la página),
--                             con los movimientos SIN fecha aparte.
--   · finance_pnl_monthly   — estado de resultados del año agregado en el servidor.
-- Plan: docs/specs/contabilidad-v2-f0-plan-migraciones.md §2 M3.
-- Rollback: DROP FUNCTION ×3 (sin dependientes en la base).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.finance_ledger_page(
    p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL, p_direction text DEFAULT NULL,
    p_cursor_date date DEFAULT NULL, p_cursor_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 50, p_include_undated boolean DEFAULT false)
 RETURNS SETOF public.cash_ledger
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_direction IS NOT NULL AND p_direction NOT IN ('income','expense') THEN
    RAISE EXCEPTION 'finance_ledger_page: dirección inválida %', p_direction USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT l.*
      FROM public.cash_ledger l
     WHERE l.owner_type = p_owner_type
       AND l.owner_id = p_owner_id
       AND (p_branch_id IS NULL OR l.branch_id = p_branch_id OR l.branch_id IS NULL)
       AND (p_direction IS NULL OR l.direction = p_direction)
       AND ((l.movement_date BETWEEN p_from AND p_to)
            OR (p_include_undated AND l.movement_date IS NULL))
       -- keyset: el orden es (fecha DESC NULLS LAST, id DESC). Los sin fecha van
       -- al final; un cursor sin fecha significa "ya estamos en la cola sin fecha".
       AND (p_cursor_id IS NULL
            OR (p_cursor_date IS NOT NULL
                AND (l.movement_date IS NULL
                     OR (l.movement_date, l.id) < (p_cursor_date, p_cursor_id)))
            OR (p_cursor_date IS NULL
                AND l.movement_date IS NULL AND l.id < p_cursor_id))
     ORDER BY l.movement_date DESC NULLS LAST, l.id DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_ledger_totals(
    p_owner_type text, p_owner_id uuid, p_from date, p_to date,
    p_branch_id uuid DEFAULT NULL)
 RETURNS TABLE (direction text, total numeric, n integer, undated_total numeric, undated_n integer)
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT d.dir,
           COALESCE(SUM(l.amount) FILTER (WHERE l.movement_date IS NOT NULL), 0)::numeric,
           (COUNT(l.id) FILTER (WHERE l.movement_date IS NOT NULL))::integer,
           COALESCE(SUM(l.amount) FILTER (WHERE l.movement_date IS NULL), 0)::numeric,
           (COUNT(l.id) FILTER (WHERE l.movement_date IS NULL))::integer
      FROM (VALUES ('income'::text), ('expense'::text)) AS d(dir)
      LEFT JOIN public.cash_ledger l
        ON l.direction = d.dir
       AND l.owner_type = p_owner_type
       AND l.owner_id = p_owner_id
       AND (p_branch_id IS NULL OR l.branch_id = p_branch_id OR l.branch_id IS NULL)
       AND ((l.movement_date BETWEEN p_from AND p_to) OR l.movement_date IS NULL)
     GROUP BY d.dir
     ORDER BY d.dir DESC;   -- income, expense
END;
$function$;

-- Estado de resultados del año: una fila por (mes, dirección, categoría).
-- month NULL = movimientos sin fecha (C8): cuentan en el total del año, no en
-- ningún mes. Ingresos: category_id NULL y concept_key = payment_category.
CREATE OR REPLACE FUNCTION public.finance_pnl_monthly(
    p_owner_type text, p_owner_id uuid, p_year integer, p_branch_id uuid DEFAULT NULL)
 RETURNS TABLE (month integer, direction text, category_id uuid, concept_key text, total numeric, n integer)
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF NOT public.finance_permission(p_owner_type, p_owner_id, 'read') THEN
    RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'finance_pnl_monthly: año inválido %', p_year USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT EXTRACT(MONTH FROM l.movement_date)::integer,
           l.direction,
           l.category_id,
           CASE WHEN l.direction = 'income' THEN COALESCE(l.payment_category, 'sin_categoria') END,
           SUM(l.amount)::numeric,
           COUNT(*)::integer
      FROM public.cash_ledger l
     WHERE l.owner_type = p_owner_type
       AND l.owner_id = p_owner_id
       AND (p_branch_id IS NULL OR l.branch_id = p_branch_id OR l.branch_id IS NULL)
       AND (l.movement_date BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
            OR l.movement_date IS NULL)
     GROUP BY 1, 2, 3, 4
     ORDER BY 1 NULLS LAST, 2, 3, 4;
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_ledger_page(text, uuid, date, date, uuid, text, date, uuid, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_ledger_totals(text, uuid, date, date, uuid)                                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_pnl_monthly(text, uuid, integer, uuid)                                      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_ledger_page(text, uuid, date, date, uuid, text, date, uuid, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_ledger_totals(text, uuid, date, date, uuid)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_pnl_monthly(text, uuid, integer, uuid)                                      TO authenticated;

COMMIT;
