-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 2 de 3.

-- =============================================================================
-- 20261008163938_tienda_stock_por_variante_y_categorias_gym.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008163338
-- Objetivo: inventario por variante del lado de la tienda (primer cliente: un
--   gimnasio que vende ropa, suplementos y accesorios).
--
--   1. products.stock pasa a ser el CACHÉ de la suma de sus variantes activas
--      (spec tienda v2 §4.1). Hoy un producto con tallas queda con
--      products.stock = 0 (el wizard lo crea así) aunque sus variantes tengan
--      unidades: "Mis productos" e Inventario mostraban "Stock: 0".
--      · Trigger de restricción DIFERIDO (al COMMIT) sobre product_variants:
--        corre después de que la transacción tomó todos sus FOR UPDATE de
--        variantes, así el bloqueo del producto queda al final (mismo orden
--        canónico que create_cart_order / _settle_order_paid: variantes y
--        luego productos). Un trigger inmediato bloquearía el producto en
--        medio del loop de variantes y dos pagos concurrentes del mismo
--        producto podían cruzarse (deadlock).
--      · Lo escribe solo el trigger (DEFINER); el cliente sigue sin UPDATE
--        de stock (M-F0-2) y el stock de cada variante sigue moviéndose solo
--        por inventory_adjust / RPCs de orden, con kardex.
--      · Backfill una vez de los productos con variantes.
--   2. validate_product_vendor_capability no revalida la capacidad del
--      vendedor cuando lo único que cambia es stock/reserved/updated_at: el
--      caché (y la venta que lo dispara) no puede fallar porque al vendedor
--      le quitaron la capacidad después de publicar.
--   3. Catálogo de categorías: "voleibol" en Deporte (Ropa Deportiva, Calzado,
--      Accesorios, Equipamiento), tipos de accesorio de gimnasio y "Tipo de
--      prenda" (opcional) en Ropa Deportiva; se quita el "ciclismo" repetido
--      de Equipamiento. Ninguno es obligatorio: no traba productos existentes.
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
    IF to_regprocedure('public.inventory_adjust(uuid, uuid, integer, text, text, uuid)') IS NULL THEN
        RAISE EXCEPTION 'Falta M-F0-2 (20261003202434): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 2. Capacidad del vendedor: no aplica a cambios de solo stock ────────────
CREATE OR REPLACE FUNCTION public.validate_product_vendor_capability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_capabilities jsonb;
BEGIN
    -- Cambio de solo inventario (caché de variantes, reservas, ventas): no es
    -- una publicación ni una edición del vendedor.
    IF TG_OP = 'UPDATE'
       AND (to_jsonb(NEW) - 'stock' - 'reserved' - 'updated_at')
         = (to_jsonb(OLD) - 'stock' - 'reserved' - 'updated_at') THEN
        RETURN NEW;
    END IF;

    -- Solo validar si tiene vendor_profile_id
    IF NEW.vendor_profile_id IS NOT NULL THEN
        SELECT capabilities INTO v_capabilities
        FROM public.vendor_profiles
        WHERE id = NEW.vendor_profile_id;

        IF v_capabilities IS NULL THEN
            RAISE EXCEPTION 'Perfil de vendedor no encontrado.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT COALESCE((v_capabilities->>'can_sell_products')::boolean, false) THEN
            RAISE EXCEPTION 'Este vendedor no tiene permisos para vender productos fisicos. Active la capacidad de productos en su perfil.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_product_vendor_capability() FROM PUBLIC, anon, authenticated;

-- ─── 1. products.stock = Σ stock de variantes activas ───────────────────────
CREATE OR REPLACE FUNCTION public.fn_product_stock_from_variants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_ids uuid[];
    v_id  uuid;
BEGIN
    v_ids := CASE TG_OP
                 WHEN 'INSERT' THEN ARRAY[NEW.product_id]
                 WHEN 'DELETE' THEN ARRAY[OLD.product_id]
                 ELSE ARRAY[NEW.product_id, OLD.product_id]
             END;
    FOREACH v_id IN ARRAY v_ids LOOP
        CONTINUE WHEN v_id IS NULL;
        UPDATE public.products p
           SET stock = s.total
          FROM (SELECT COALESCE(sum(v.stock) FILTER (WHERE v.is_active IS NOT FALSE), 0)::integer AS total
                  FROM public.product_variants v
                 WHERE v.product_id = v_id) s
         WHERE p.id = v_id
           AND p.stock IS DISTINCT FROM s.total;
    END LOOP;
    RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_product_stock_from_variants() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.fn_product_stock_from_variants() IS
  'Tienda v2 §4.1: products.stock = suma del stock de las variantes activas. Trigger diferido (al COMMIT) para bloquear el producto después de las variantes.';

DROP TRIGGER IF EXISTS trg_product_stock_from_variants ON public.product_variants;
CREATE CONSTRAINT TRIGGER trg_product_stock_from_variants
    AFTER INSERT OR UPDATE OF stock, is_active, product_id OR DELETE ON public.product_variants
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION public.fn_product_stock_from_variants();

COMMENT ON COLUMN public.products.stock IS
  'Producto SIN variantes: su stock (lo mueve inventory_adjust / RPCs de orden). Producto CON variantes: caché de solo lectura = suma de variantes activas (trg_product_stock_from_variants).';

-- Backfill de los productos con variantes (caché, no un movimiento de
-- inventario: el stock real de cada variante no cambia, no hay kardex).
UPDATE public.products p
   SET stock = s.total
  FROM (SELECT v.product_id,
               COALESCE(sum(v.stock) FILTER (WHERE v.is_active IS NOT FALSE), 0)::integer AS total
          FROM public.product_variants v
         GROUP BY v.product_id) s
 WHERE p.id = s.product_id
   AND p.stock IS DISTINCT FROM s.total;

-- ─── 3. Catálogo: opciones útiles para un gimnasio ──────────────────────────
-- Agrega opciones (sin duplicar) al campo `p_key` del attribute_schema de la
-- categoría `p_slug`, y deja las opciones únicas en su orden original.
CREATE OR REPLACE FUNCTION pg_temp.cat_add_options(p_slug text, p_key text, p_opts text[], p_before text DEFAULT 'otro')
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    UPDATE public.product_categories c
       SET attribute_schema = (
           SELECT jsonb_agg(
                    CASE WHEN f ->> 'key' = p_key THEN
                        jsonb_set(f, '{options}', (
                            WITH cur AS (
                                SELECT o, ord FROM jsonb_array_elements_text(COALESCE(f -> 'options', '[]'::jsonb))
                                       WITH ORDINALITY AS t(o, ord)
                            ), dedup AS (
                                SELECT o, min(ord) AS ord FROM cur GROUP BY o
                            ), base AS (
                                SELECT o, ord::numeric AS ord FROM dedup
                                UNION ALL
                                -- Las nuevas van antes de p_before ('otro') si existe; si no, al final.
                                SELECT n.o, COALESCE((SELECT d.ord FROM dedup d WHERE d.o = p_before) - 0.5 + n.i / 1000.0,
                                                     100000 + n.i)
                                  FROM unnest(p_opts) WITH ORDINALITY AS n(o, i)
                                 WHERE NOT EXISTS (SELECT 1 FROM dedup d WHERE d.o = n.o)
                            )
                            SELECT jsonb_agg(o ORDER BY ord) FROM base))
                    ELSE f END
                    ORDER BY ord)
             FROM jsonb_array_elements(c.attribute_schema) WITH ORDINALITY AS a(f, ord))
     WHERE c.slug = p_slug
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.attribute_schema) f WHERE f ->> 'key' = p_key);
END;
$fn$;

SELECT pg_temp.cat_add_options('ropa-deportiva', 'deporte', ARRAY['voleibol', 'funcional']);
SELECT pg_temp.cat_add_options('calzado',        'deporte', ARRAY['voleibol']);
SELECT pg_temp.cat_add_options('accesorios',     'deporte', ARRAY['voleibol']);
SELECT pg_temp.cat_add_options('equipamiento',   'deporte', ARRAY['voleibol']);   -- además deja un solo "ciclismo"
SELECT pg_temp.cat_add_options('accesorios',     'tipo',
       ARRAY['shaker', 'cinturon-de-levantamiento', 'straps', 'munequeras', 'rodilleras', 'guantes-de-gimnasio']);

-- "Tipo de prenda" (opcional) en Ropa Deportiva, después de Género.
UPDATE public.product_categories c
   SET attribute_schema = (
       SELECT jsonb_agg(f ORDER BY ord)
         FROM (SELECT f, ord::numeric AS ord
                 FROM jsonb_array_elements(c.attribute_schema) WITH ORDINALITY AS a(f, ord)
               UNION ALL
               SELECT jsonb_build_object(
                        'key', 'tipo_prenda', 'type', 'select', 'label', 'Tipo de prenda',
                        'options', jsonb_build_array('camiseta', 'esqueleto', 'top', 'licra', 'short',
                                                     'pantaloneta', 'sudadera', 'chaqueta', 'conjunto', 'otro'),
                        'required', false, 'applies_to', 'product'),
                      COALESCE((SELECT o.ord FROM jsonb_array_elements(c.attribute_schema) WITH ORDINALITY AS o(g, ord)
                                 WHERE g ->> 'key' = 'genero'), 0) + 0.5) x(f, ord))
 WHERE c.slug = 'ropa-deportiva'
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.attribute_schema) f WHERE f ->> 'key' = 'tipo_prenda');

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261008163938', '20261008163938_tienda_stock_por_variante_y_categorias_gym', 'sql-editor 2026-10-08') on conflict (version) do nothing;
