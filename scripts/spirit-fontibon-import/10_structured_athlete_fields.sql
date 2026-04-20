-- =========================================================================
-- FASE 4 — Columnas estructuradas en children: tshirt_size, blood_type, eps_name
-- Evita que estos datos vivan como texto dentro de medical_info.
--
-- Pasos (correr los 2 bloques por separado si da problema junto):
--   1. Agregar columnas
--   2. Migrar data existente desde medical_info (regex)
-- =========================================================================


-- =========================================================================
-- PASO 1: Agregar columnas
-- =========================================================================
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS tshirt_size text,
  ADD COLUMN IF NOT EXISTS blood_type  text,
  ADD COLUMN IF NOT EXISTS eps_name    text;

COMMENT ON COLUMN public.children.tshirt_size IS 'Talla de camiseta (numerica 6-20 o letra XS/S/M/L/XL)';
COMMENT ON COLUMN public.children.blood_type  IS 'Tipo de sangre RH (O+, O-, A+, A-, B+, B-, AB+, AB-)';
COMMENT ON COLUMN public.children.eps_name    IS 'Nombre de la EPS del atleta';


-- =========================================================================
-- PASO 2: Migrar data existente desde medical_info (solo los que tengan "Talla:" o "EPS:")
-- =========================================================================
UPDATE public.children
   SET tshirt_size = NULLIF(
         TRIM(
           regexp_replace(
             COALESCE(substring(medical_info from 'Talla:\s*([^|]+)'), ''),
             '\s+$', ''
           )
         ),
         ''
       )
 WHERE medical_info LIKE '%Talla:%'
   AND tshirt_size IS NULL;

UPDATE public.children
   SET eps_name = NULLIF(
         TRIM(
           regexp_replace(
             COALESCE(substring(medical_info from 'EPS:\s*([^|]+)'), ''),
             '\s+$', ''
           )
         ),
         ''
       )
 WHERE medical_info LIKE '%EPS:%'
   AND eps_name IS NULL;

UPDATE public.children
   SET blood_type = NULLIF(
         TRIM(
           regexp_replace(
             COALESCE(substring(medical_info from 'RH:\s*([^|]+)'), ''),
             '\s+$', ''
           )
         ),
         ''
       )
 WHERE medical_info LIKE '%RH:%'
   AND blood_type IS NULL;


-- =========================================================================
-- VERIFICACION
-- =========================================================================
SELECT 'total'                            AS tipo, COUNT(*) AS n FROM public.children WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
UNION ALL
SELECT 'con_talla',                       COUNT(*)          FROM public.children WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND tshirt_size IS NOT NULL
UNION ALL
SELECT 'con_eps',                         COUNT(*)          FROM public.children WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND eps_name    IS NOT NULL
UNION ALL
SELECT 'con_rh',                          COUNT(*)          FROM public.children WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND blood_type  IS NOT NULL;


-- Sample de 5 atletas para revisar que migracion funciono
SELECT full_name, doc_number, tshirt_size, eps_name, blood_type
FROM public.children
WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
LIMIT 5;
