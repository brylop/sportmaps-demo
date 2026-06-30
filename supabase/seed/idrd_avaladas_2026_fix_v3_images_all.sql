-- ============================================================
-- SPORTMAPS — Imagenes para TODAS las escuelas (fix v3)
--
-- v2 solo pintaba IDRD. Este fix:
--   1. Aplica imagenes a TODAS las escuelas (cover_image_url + logo_url) que
--      tengan los campos NULL, usando el PRIMER deporte del array sports[].
--   2. URLs Unsplash populares (high-quality, verificadas).
--   3. Fallback generico para escuelas sin sports[] o con deporte no mapeado.
--   4. Idempotente: COALESCE solo escribe si NULL, no pisa custom.
--
-- Aplicar despues de idrd_avaladas_2026_fix_v2.sql (este complementa).
-- ============================================================

BEGIN;


-- ============================================================
-- 1. Tabla temporal con mapping deporte -> URLs
-- ============================================================

CREATE TEMP TABLE _sport_images_v3 (
    sport_key text PRIMARY KEY,    -- normalizado lowercase para matchear robusto
    cover_url text NOT NULL,
    logo_url  text NOT NULL
);

-- URLs Unsplash de fotos populares con muchas visitas (estables a largo plazo).
-- w=1600 para cover (popups, hero), w=400 para logo (avatar).
-- Todas verificadas como activas y de uso libre.

INSERT INTO _sport_images_v3 (sport_key, cover_url, logo_url) VALUES
    -- Fútbol — pelota en cancha verde
    ('futbol',
     'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&q=80',
     'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80'),
    ('soccer',
     'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&q=80',
     'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80'),

    -- Patinaje — patines en ruta
    ('patinaje',
     'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=1600&q=80',
     'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&q=80'),
    ('patinaje de carreras',
     'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=1600&q=80',
     'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&q=80'),
    ('patinaje artistico',
     'https://images.unsplash.com/photo-1565992441121-4367c2967103?w=1600&q=80',
     'https://images.unsplash.com/photo-1565992441121-4367c2967103?w=400&q=80'),
    ('skate',
     'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?w=1600&q=80',
     'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?w=400&q=80'),

    -- Natación
    ('natacion',
     'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&q=80',
     'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=80'),
    ('swimming',
     'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&q=80',
     'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=80'),

    -- Tenis
    ('tenis',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1600&q=80',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=80'),
    ('tenis de campo',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1600&q=80',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=80'),
    ('tennis',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1600&q=80',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=80'),
    ('tenis de mesa',
     'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=1600&q=80',
     'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=400&q=80'),

    -- Baloncesto
    ('baloncesto',
     'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1600&q=80',
     'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80'),
    ('basquetbol',
     'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1600&q=80',
     'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80'),
    ('basket',
     'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1600&q=80',
     'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80'),

    -- Voleibol
    ('voleibol',
     'https://images.unsplash.com/photo-1592656094267-764a45160876?w=1600&q=80',
     'https://images.unsplash.com/photo-1592656094267-764a45160876?w=400&q=80'),
    ('voley',
     'https://images.unsplash.com/photo-1592656094267-764a45160876?w=1600&q=80',
     'https://images.unsplash.com/photo-1592656094267-764a45160876?w=400&q=80'),

    -- Ciclismo
    ('ciclismo',
     'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1600&q=80',
     'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=80'),
    ('cycling',
     'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1600&q=80',
     'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=80'),
    ('bmx',
     'https://images.unsplash.com/photo-1565992441121-4367c2967103?w=1600&q=80',
     'https://images.unsplash.com/photo-1565992441121-4367c2967103?w=400&q=80'),

    -- Karate / Taekwondo / Martial Arts
    ('karate',
     'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=1600&q=80',
     'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&q=80'),
    ('taekwondo',
     'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=1600&q=80',
     'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&q=80'),
    ('judo',
     'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=1600&q=80',
     'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&q=80'),
    ('boxeo',
     'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=1600&q=80',
     'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=80'),

    -- Otros
    ('squash',
     'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1600&q=80',
     'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&q=80'),
    ('bolos',
     'https://images.unsplash.com/photo-1538511637916-cfa05c2cf07a?w=1600&q=80',
     'https://images.unsplash.com/photo-1538511637916-cfa05c2cf07a?w=400&q=80'),
    ('bowling',
     'https://images.unsplash.com/photo-1538511637916-cfa05c2cf07a?w=1600&q=80',
     'https://images.unsplash.com/photo-1538511637916-cfa05c2cf07a?w=400&q=80'),
    ('baile deportivo',
     'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=1600&q=80',
     'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&q=80'),
    ('baile',
     'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=1600&q=80',
     'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&q=80'),
    ('dance',
     'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=1600&q=80',
     'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&q=80'),
    ('atletismo',
     'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1600&q=80',
     'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&q=80'),
    ('gimnasia',
     'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1600&q=80',
     'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80'),
    ('cheerleading',
     'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1600&q=80',
     'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&q=80'),
    ('rugby',
     'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1600&q=80',
     'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80'),
    ('beisbol',
     'https://images.unsplash.com/photo-1508344928-66a2f8b51c1b?w=1600&q=80',
     'https://images.unsplash.com/photo-1508344928-66a2f8b51c1b?w=400&q=80'),
    ('crossfit',
     'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80',
     'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80'),
    ('yoga',
     'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1600&q=80',
     'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&q=80'),

    -- Fallback generico — pista atletica con runner (todas las disciplinas)
    ('_default',
     'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1600&q=80',
     'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&q=80');


-- ============================================================
-- 2. Helper: normalizar string de deporte para matchear keys
--    Remueve tildes + lowercase + trim. (asume extension unaccent disponible
--    en Supabase; si no, hace un translate manual)
-- ============================================================

-- Helper inline en CTE: lower + translate tildes
-- (no creamos funcion porque no tenemos permisos en todos los schemas)


-- ============================================================
-- 3. UPDATE — todas las schools sin imagen, mapeadas por primer deporte
-- ============================================================

WITH school_first_sport AS (
    SELECT s.id AS school_id,
           -- primer deporte normalizado (lowercase + sin tildes)
           lower(translate(
               COALESCE((s.sports)[1], ''),
               'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑáéíóúàèìòùäëïöüâêîôûñ',
               'AEIOUAEIOUAEIOUAEIOUNaeiouaeiouaeiouaeioun'
           )) AS sport_key
      FROM public.schools s
     WHERE s.cover_image_url IS NULL
        OR s.logo_url IS NULL
),
sport_resolved AS (
    SELECT
        sfs.school_id,
        COALESCE(si.cover_url, def.cover_url) AS cover_url,
        COALESCE(si.logo_url,  def.logo_url)  AS logo_url
    FROM school_first_sport sfs
    CROSS JOIN _sport_images_v3 def
    LEFT JOIN _sport_images_v3 si ON si.sport_key = sfs.sport_key
    WHERE def.sport_key = '_default'
)
UPDATE public.schools s
   SET cover_image_url = COALESCE(s.cover_image_url, sr.cover_url),
       logo_url        = COALESCE(s.logo_url,        sr.logo_url),
       updated_at      = now()
  FROM sport_resolved sr
 WHERE s.id = sr.school_id;


-- ============================================================
-- 4. Verificacion (correr aparte si querés ver counts)
-- ============================================================
-- SELECT COUNT(*) FROM public.schools;
-- SELECT COUNT(*) FROM public.schools WHERE cover_image_url IS NOT NULL;
-- SELECT COUNT(*) FROM public.schools WHERE logo_url IS NOT NULL;


COMMIT;
