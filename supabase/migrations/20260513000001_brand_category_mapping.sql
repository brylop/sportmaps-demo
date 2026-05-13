-- ============================================================
-- SPORTMAPS — Mapeo marca <-> categoria + seed suplementos/nutricion
--
-- Problema: el dropdown de marca del wizard muestra TODAS las marcas
-- sin importar la categoria. Resultado: al elegir "Suplementos" salen
-- Nike, Adidas, Hoka, Babolat... y no hay marcas de suplementos
-- seeded en la BD.
--
-- Fix:
--   1. Tabla junction product_brand_categories (N:N marca-categoria).
--   2. Seed de marcas de suplementos y nutricion que faltaban.
--   3. Mapeo de las 17 marcas existentes a sus categorias.
--
-- Consumidor: useBrands(categoryId?) filtra por categoria via join.
-- ============================================================


-- 1. Tabla junction marca <-> categoria
CREATE TABLE IF NOT EXISTS public.product_brand_categories (
    brand_id    uuid NOT NULL REFERENCES public.product_brands(id)    ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (brand_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_pbc_brand    ON public.product_brand_categories(brand_id);
CREATE INDEX IF NOT EXISTS idx_pbc_category ON public.product_brand_categories(category_id);

ALTER TABLE public.product_brand_categories ENABLE ROW LEVEL SECURITY;

-- SELECT publico (mismo patron que product_brands)
DROP POLICY IF EXISTS "pbc_public_read" ON public.product_brand_categories;
CREATE POLICY "pbc_public_read"
    ON public.product_brand_categories
    FOR SELECT
    USING (true);

-- Solo admin escribe
DROP POLICY IF EXISTS "pbc_admin_write" ON public.product_brand_categories;
CREATE POLICY "pbc_admin_write"
    ON public.product_brand_categories
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
             WHERE p.id = auth.uid()
               AND p.role::text IN ('admin', 'super_admin')
        )
    );

COMMENT ON TABLE public.product_brand_categories IS
    'Junction N:N entre product_brands y product_categories. Una marca puede pertenecer a varias categorias (Nike => ropa + calzado + accesorios).';


-- 2. Seed de marcas que faltaban (suplementos, nutricion, gym)
INSERT INTO public.product_brands (slug, name, is_official) VALUES
    -- Suplementos
    ('optimum-nutrition',  'Optimum Nutrition',  true),
    ('muscletech',         'MuscleTech',         true),
    ('gnc',                'GNC',                true),
    ('bsn',                'BSN',                true),
    ('dymatize',           'Dymatize',           true),
    ('universal',          'Universal Nutrition', true),
    ('cellucor',           'Cellucor',           true),
    ('musclemeds',         'MuscleMeds',         true),
    ('scivation',          'Scivation',          true),
    ('isopure',            'Isopure',            true),
    -- Nutricion deportiva
    ('quest',              'Quest Nutrition',    true),
    ('kind',               'KIND',               true),
    ('clif',               'Clif Bar',           true),
    ('rxbar',              'RXBAR',              true),
    ('gatorade',           'Gatorade',           true),
    ('powerade',           'Powerade',           true),
    -- Equipamiento gym
    ('rogue',              'Rogue Fitness',      true),
    ('eleiko',             'Eleiko',             true),
    ('technogym',          'Technogym',          true),
    -- Ciclismo
    ('specialized',        'Specialized',        true),
    ('trek',               'Trek',               true),
    ('giant',              'Giant',              true)
ON CONFLICT (slug) DO NOTHING;


-- 3. Mapeo marca -> categorias
--    Estrategia: insertar (brand_id, category_id) buscando por slug en ambas tablas.
--    Esto sobrevive a cualquier orden de UUID y al ON CONFLICT del seed inicial.
INSERT INTO public.product_brand_categories (brand_id, category_id)
SELECT b.id, c.id
  FROM public.product_brands     b
  JOIN public.product_categories c
       ON (b.slug, c.slug) IN (
            -- ============ DEPORTIVAS GENERALES ============
            -- Nike, Adidas, Puma, Under Armour, Reebok: ropa + calzado + accesorios
            ('nike',         'ropa-deportiva'), ('nike',         'calzado'), ('nike',         'accesorios'),
            ('adidas',       'ropa-deportiva'), ('adidas',       'calzado'), ('adidas',       'accesorios'),
            ('puma',         'ropa-deportiva'), ('puma',         'calzado'), ('puma',         'accesorios'),
            ('under-armour', 'ropa-deportiva'), ('under-armour', 'calzado'), ('under-armour', 'accesorios'),
            ('reebok',       'ropa-deportiva'), ('reebok',       'calzado'), ('reebok',       'accesorios'),

            -- ============ RUNNING ESPECIALIZADO ============
            -- Asics, Mizuno, New Balance, On, Hoka: calzado + ropa
            ('asics',       'calzado'), ('asics',       'ropa-deportiva'),
            ('mizuno',      'calzado'), ('mizuno',      'ropa-deportiva'),
            ('new-balance', 'calzado'), ('new-balance', 'ropa-deportiva'),
            ('on-running',  'calzado'), ('on-running',  'ropa-deportiva'),
            ('hoka',        'calzado'), ('hoka',        'ropa-deportiva'),

            -- ============ FUTBOL ============
            ('umbro', 'ropa-deportiva'), ('umbro', 'calzado'), ('umbro', 'equipamiento'),

            -- ============ TENIS / PADEL ============
            ('wilson',  'equipamiento'), ('wilson',  'accesorios'),
            ('babolat', 'equipamiento'), ('babolat', 'accesorios'),
            ('head',    'equipamiento'), ('head',    'accesorios'),

            -- ============ DEPORTES DE PELOTA ============
            ('molten', 'equipamiento'),
            ('mikasa', 'equipamiento'),

            -- ============ SUPLEMENTOS ============
            ('optimum-nutrition',  'suplementos'),
            ('muscletech',         'suplementos'),
            ('gnc',                'suplementos'), ('gnc', 'nutricion-deportiva'),
            ('bsn',                'suplementos'),
            ('dymatize',           'suplementos'),
            ('universal',          'suplementos'),
            ('cellucor',           'suplementos'),
            ('musclemeds',         'suplementos'),
            ('scivation',          'suplementos'),
            ('isopure',            'suplementos'),

            -- ============ NUTRICION DEPORTIVA ============
            ('quest',    'nutricion-deportiva'),
            ('kind',     'nutricion-deportiva'),
            ('clif',     'nutricion-deportiva'),
            ('rxbar',    'nutricion-deportiva'),
            ('gatorade', 'nutricion-deportiva'),
            ('powerade', 'nutricion-deportiva'),

            -- ============ EQUIPAMIENTO GYM ============
            ('rogue',     'equipamiento'),
            ('eleiko',    'equipamiento'),
            ('technogym', 'equipamiento'),

            -- ============ CICLISMO ============
            ('specialized', 'equipamiento'), ('specialized', 'accesorios'),
            ('trek',        'equipamiento'), ('trek',        'accesorios'),
            ('giant',       'equipamiento'), ('giant',       'accesorios')
       )
ON CONFLICT (brand_id, category_id) DO NOTHING;


-- 4. "Sin marca" / generica: mapeada a TODAS las categorias para que siempre
--    aparezca como fallback cuando el vendor no quiere especificar marca.
INSERT INTO public.product_brand_categories (brand_id, category_id)
SELECT b.id, c.id
  FROM public.product_brands     b
 CROSS JOIN public.product_categories c
 WHERE b.slug = 'generica'
ON CONFLICT (brand_id, category_id) DO NOTHING;


-- 5. Refresh schema cache para PostgREST
NOTIFY pgrst, 'reload config';
