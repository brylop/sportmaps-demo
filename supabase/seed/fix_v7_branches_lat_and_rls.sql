-- ============================================================
-- SPORTMAPS — FIX v7: branches sin lat + RLS/GRANTs anon
--
-- Diagnostico:
--   1) Q1 mostro: 82 branches deportebogota + 151 branches mindeporte
--      tienen is_main + status=active pero LAT IS NULL.
--      Causa: existian de un seed anterior sin lat; los seeds nuevos
--      tienen WHERE NOT EXISTS (...AND is_main) sin chequear lat,
--      asi que NO las pisaron.
--   2) Q2 mostro: anon ve 0 branches → RLS/GRANT bloqueando al
--      cliente del frontend. Sin esto, el mapa /explorar queda en 0/0.
--
-- Estrategia:
--   A) UPDATE branches sin lat con jitter desde el centro de la ciudad
--      de la school (o Bogotá si no hay city geocodificable).
--   B) Reasegurar policy "Branches: select public" con USING(true) +
--      GRANT SELECT a anon en school_branches, schools, school_settings.
--
-- Idempotente. Aplicar después de fix_v6 + entidades_deportivas_*.
-- ============================================================

BEGIN;


-- ============================================================
-- A. ARREGLAR BRANCHES SIN LAT
-- ============================================================

-- A.1 — Lookup de coords por ciudad/departamento conocidos (capitales/centros).
--       Si la school.city no matchea, se usa fallback Bogotá.

CREATE TEMP TABLE _city_coords (
    city_key text PRIMARY KEY,   -- city normalizada lower + sin tildes
    lat double precision NOT NULL,
    lng double precision NOT NULL
);

INSERT INTO _city_coords (city_key, lat, lng) VALUES
    -- Departamentos (centros aproximados)
    ('amazonas',          -1.3053,  -71.4659),
    ('antioquia',          7.0000,  -75.5000),
    ('arauca',             6.6667,  -71.0000),
    ('arauca capital',     7.0903,  -70.7617),
    ('atlantico',         10.6773,  -74.9719),
    ('bolivar',            9.3660,  -74.8024),
    ('boyaca',             5.6279,  -72.8269),
    ('caqueta',            1.1153,  -74.1057),
    ('casanare',           5.5000,  -71.5000),
    ('cauca',              2.7156,  -76.6627),
    ('cesar',              9.3333,  -73.5000),
    ('choco',              6.0000,  -77.0000),
    ('cordoba',            8.3345,  -75.6666),
    ('cundinamarca',       4.7832,  -73.6731),
    ('guainia',            2.5000,  -69.0000),
    ('guaviare',           1.7899,  -72.3762),
    ('huila',              2.4739,  -75.5900),
    ('la guajira',        11.4354,  -72.9002),
    ('magdalena',         10.5808,  -74.0686),
    ('meta',               3.5000,  -73.0000),
    ('narino',             1.5842,  -77.8586),
    ('norte de santander', 8.4418,  -73.0493),
    ('putumayo',           0.5000,  -76.0000),
    ('quindio',            4.4028,  -75.7026),
    ('risaralda',          5.2103,  -75.9842),
    ('san andres',        12.5376,  -81.7204),
    ('santander',          7.0000,  -73.2500),
    ('sucre',              9.0000,  -75.0000),
    ('tolima',             4.0356,  -75.2087),
    ('valle del cauca',    3.6984,  -76.5502),
    ('vaupes',             0.4228,  -70.9468),
    ('vichada',            6.1909,  -67.4842),
    -- Ciudades
    ('armenia',            4.4920,  -75.7414),
    ('barranquilla',      10.9939,  -74.7926),
    ('bogota',             4.6533,  -74.0836),
    ('bogota d.c',         4.6533,  -74.0836),
    ('bogota d.c.',        4.6533,  -74.0836),
    ('bucaramanga',        7.1170,  -73.1047),
    ('buenaventura',       3.8882,  -77.0738),
    ('cali',               3.4108,  -76.5812),
    ('cartagena',         10.4266,  -75.5442),
    ('cucuta',             8.0776,  -72.4689),
    ('florencia',          1.6159,  -75.6143),
    ('ibague',             4.4386,  -75.2109),
    ('inirida',            3.8650,  -67.9260),
    ('leticia',           -4.2129,  -69.9426),
    ('manizales',          5.0744,  -75.5081),
    ('medellin',           6.2697,  -75.6026),
    ('mitu',               1.2587,  -70.2366),
    ('mocoa',              1.1466,  -76.6482),
    ('monteria',           8.6046,  -75.9783),
    ('neiva',              2.9257,  -75.2894),
    ('palmira',            3.5308,  -76.2988),
    ('pasto',              1.2140,  -77.2785),
    ('pereira',            4.7855,  -75.7883),
    ('popayan',            2.4431,  -76.5463),
    ('providencia',       13.3531,  -81.3750),
    ('puerto carreno',     6.1909,  -67.4842),
    ('quibdo',             5.6913,  -76.6531),
    ('san jose del guaviare', 2.5716, -72.6427),
    ('santa marta',       11.2321,  -74.1951),
    ('sincelejo',          9.2973,  -75.3927),
    ('valledupar',        10.4652,  -73.2530),
    ('villavicencio',      4.1115,  -73.4968);

-- A.2 — Función helper para normalizar city (lowercase + sin tildes)
CREATE OR REPLACE FUNCTION pg_temp._norm_city(c text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT lower(translate(
        COALESCE(c, ''),
        'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑáéíóúàèìòùäëïöüâêîôûñ',
        'AEIOUAEIOUAEIOUAEIOUNaeiouaeiouaeiouaeioun'
    ));
$$;

-- A.3 — UPDATE branches sin lat: usar coords de city, + jitter pequeño
--       para no apilar marcadores en el mismo punto exacto.

WITH targets AS (
    SELECT b.id AS branch_id,
           pg_temp._norm_city(s.city) AS city_key,
           b.school_id
      FROM public.school_branches b
      JOIN public.schools s ON s.id = b.school_id
      JOIN public.external_school_imports e ON e.school_id = b.school_id
     WHERE e.source IN ('mindeporte_entidades_2025_2026', 'deportebogota_2026')
       AND b.is_main = true
       AND (b.lat IS NULL OR b.lng IS NULL)
),
resolved AS (
    SELECT
        t.branch_id,
        t.school_id,
        -- lat/lng base: lookup city → coords; sino centro Bogotá
        COALESCE(c.lat, 4.6533) AS base_lat,
        COALESCE(c.lng, -74.0836) AS base_lng
      FROM targets t
      LEFT JOIN _city_coords c ON c.city_key = t.city_key
)
UPDATE public.school_branches b
   SET lat = r.base_lat  + (mod(abs(hashtext(r.school_id::text)),       300) - 150) / 5000.0,
       lng = r.base_lng + (mod(abs(hashtext(r.school_id::text) >> 8),  300) - 150) / 5000.0,
       updated_at = now()
  FROM resolved r
 WHERE b.id = r.branch_id;


-- ============================================================
-- B. RLS + GRANTs para anon (cliente del frontend /explorar)
-- ============================================================

-- B.1 — Reasegurar policy SELECT publica en school_branches.
--       USING(true) permite a cualquier rol con GRANT SELECT.
DROP POLICY IF EXISTS "Branches: select public" ON public.school_branches;
CREATE POLICY "Branches: select public" ON public.school_branches
    FOR SELECT USING (true);

-- B.2 — Reasegurar policy SELECT publica en schools.
DROP POLICY IF EXISTS "Schools: select public" ON public.schools;
CREATE POLICY "Schools: select public" ON public.schools
    FOR SELECT USING (true);

-- B.3 — Policy SELECT publica en school_settings (lectura de
--       public_profile_enabled requerida por el explorar).
DROP POLICY IF EXISTS "Settings: select public" ON public.school_settings;
CREATE POLICY "Settings: select public" ON public.school_settings
    FOR SELECT USING (public_profile_enabled = true);

-- B.4 — GRANT SELECT a anon (en Supabase default ya viene, pero
--       refuerza por si alguna migración hizo REVOKE silencioso).
GRANT SELECT ON public.school_branches  TO anon, authenticated;
GRANT SELECT ON public.schools          TO anon, authenticated;
GRANT SELECT ON public.school_settings  TO anon, authenticated;
GRANT SELECT ON public.external_school_imports TO anon, authenticated;


-- ============================================================
-- C. Verificación (correr aparte si querés)
-- ============================================================
-- SELECT e.source,
--        COUNT(*) AS branches_total,
--        COUNT(*) FILTER (WHERE b.lat IS NOT NULL) AS con_lat
-- FROM public.school_branches b
-- JOIN public.external_school_imports e ON e.school_id = b.school_id
-- WHERE b.is_main
-- GROUP BY e.source
-- ORDER BY e.source;
-- Esperado: deportebogota=82/82, idrd=70/70 (32 ya tenian fallback via fix_v6),
--           mindeporte=151/151.


COMMIT;
