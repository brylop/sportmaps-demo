-- ============================================================
-- SPORTMAPS — IDRD avaladas 2026 — FIX v2 (junio 2026)
--
-- Aplicar DESPUES del seed idrd_avaladas_2026.sql original.
--
-- Resuelve 3 problemas detectados en staging:
--
--   1. BRANCHES DUPLICADAS (136 vs 68 esperadas) — el seed corrio 2 veces
--      y school_branches no tiene UNIQUE (school_id, is_main), por eso
--      el ON CONFLICT no atrapaba. Limpieza: para cada school IDRD que
--      tenga >1 branch is_main, dejamos la mas antigua y borramos el resto.
--
--   2. FALTAN 3 ESCUELAS — el Excel tiene 3 pares de escuelas distintas
--      con el mismo aval (135, 588, 679). El UNIQUE en external_ref
--      bloqueo el segundo INSERT de cada par. Insertamos las 3 con
--      external_ref distinguido (IDRD-AVAL-<aval>-B).
--
--   3. SIN IMAGENES — schools.cover_image_url y logo_url estan vacios.
--      Mapeamos primary sport -> URL Unsplash representativa y UPDATE.
--
-- Idempotente: re-correr es seguro (DELETE/UPDATE usan WHERE selectivos
-- y los INSERT de las 3 escuelas usan ON CONFLICT external_ref).
-- ============================================================

BEGIN;


-- ============================================================
-- 1. CLEANUP — borrar branches IDRD duplicadas (dejar la mas antigua)
-- ============================================================

WITH ranked_branches AS (
    SELECT
        b.id,
        b.school_id,
        ROW_NUMBER() OVER (
            PARTITION BY b.school_id, b.is_main
            ORDER BY b.created_at ASC, b.id ASC
        ) AS rn
    FROM public.school_branches b
    JOIN public.external_school_imports e ON e.school_id = b.school_id
    WHERE e.source = 'idrd_bogota_2026'
      AND b.is_main = true
),
to_delete AS (
    SELECT id FROM ranked_branches WHERE rn > 1
)
DELETE FROM public.school_branches
 WHERE id IN (SELECT id FROM to_delete);

-- Verificacion post-cleanup (info en NOTICE)
DO $$
DECLARE v_remaining int;
BEGIN
    SELECT COUNT(*) INTO v_remaining
      FROM public.school_branches b
      JOIN public.external_school_imports e ON e.school_id = b.school_id
     WHERE e.source = 'idrd_bogota_2026';
    RAISE NOTICE 'Branches IDRD post-cleanup: %', v_remaining;
END $$;


-- ============================================================
-- 2. INSERTAR LAS 3 IDRD FALTANTES (avales 135, 588, 679 — el "B")
-- ============================================================

-- 2.A — Aval 135 segundo registro: ESCUELA DE FORMACION DEPORTIVA CROSSROLL SPEED
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
    SELECT school_id INTO v_existing FROM public.external_school_imports
     WHERE external_ref = 'IDRD-AVAL-135-B';
    IF v_existing IS NULL THEN
        INSERT INTO public.schools (
            name, description, school_type, city, address, phone, email, sports,
            verified, is_demo, slug, onboarding_status
        ) VALUES (
            'ESCUELA DE FORMACION DEPORTIVA CROSSROLL SPEED',
            'Escuela avalada por IDRD Bogotá (Aval Nº 135 — segundo registro). Patinaje de carreras.',
            'academy', 'Bogotá', 'CALLE 70 SUR No. 70-30', NULL, NULL,
            ARRAY['Patinaje de carreras']::text[],
            true, false,
            'escuela-de-formacion-deportiva-crossroll-speed-135b',
            'completed'
        ) RETURNING id INTO v_school_id;

        INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
        VALUES ('idrd_bogota_2026', 'IDRD-AVAL-135-B', v_school_id,
                '{"aval": 135, "note": "duplicate aval — second school"}'::jsonb);

        INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
        UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;
    END IF;
END $$;

-- 2.B — Aval 588 segundo registro: ESCUELA DE FORMACION DEPORTIVA VERONA
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
    SELECT school_id INTO v_existing FROM public.external_school_imports
     WHERE external_ref = 'IDRD-AVAL-588-B';
    IF v_existing IS NULL THEN
        INSERT INTO public.schools (
            name, description, school_type, city, address, phone, email, sports,
            verified, is_demo, slug, onboarding_status
        ) VALUES (
            'ESCUELA DE FORMACION DEPORTIVA VERONA',
            'Escuela avalada por IDRD Bogotá (Aval Nº 588 — segundo registro). Fútbol.',
            'academy', 'Bogotá', NULL, NULL, NULL,
            ARRAY['Fútbol']::text[],
            true, false,
            'escuela-de-formacion-deportiva-verona-588b',
            'completed'
        ) RETURNING id INTO v_school_id;

        INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
        VALUES ('idrd_bogota_2026', 'IDRD-AVAL-588-B', v_school_id,
                '{"aval": 588, "note": "duplicate aval — second school"}'::jsonb);

        INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
        UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;
    END IF;
END $$;

-- 2.C — Aval 679 segundo registro: ESCUELA DE FORMACION DEPORTIVA ROLLING SPACE
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
    SELECT school_id INTO v_existing FROM public.external_school_imports
     WHERE external_ref = 'IDRD-AVAL-679-B';
    IF v_existing IS NULL THEN
        INSERT INTO public.schools (
            name, description, school_type, city, address, phone, email, sports,
            verified, is_demo, slug, onboarding_status
        ) VALUES (
            'ESCUELA DE FORMACION DEPORTIVA ROLLING SPACE',
            'Escuela avalada por IDRD Bogotá (Aval Nº 679 — segundo registro). Patinaje.',
            'academy', 'Bogotá', NULL, NULL, NULL,
            ARRAY['Patinaje']::text[],
            true, false,
            'escuela-de-formacion-deportiva-rolling-space-679b',
            'completed'
        ) RETURNING id INTO v_school_id;

        INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
        VALUES ('idrd_bogota_2026', 'IDRD-AVAL-679-B', v_school_id,
                '{"aval": 679, "note": "duplicate aval — second school"}'::jsonb);

        INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
        UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

        -- Aproximacion lat/lng (Rolling Space en Bogota, sin geocode preciso)
        INSERT INTO public.school_branches (school_id, name, address, city, lat, lng, is_main, status)
        VALUES (v_school_id, 'Sede Principal', NULL, 'Bogotá', 4.5863, -74.1000, true, 'active');
    END IF;
END $$;


-- ============================================================
-- 3. IMAGENES POR DEPORTE — cover_image_url + logo_url
-- ============================================================
--
-- Mapeo primary_sport -> URL Unsplash (CDN gratis, sin auth).
-- cover_image_url: imagen grande (1600px) para hero/popup.
-- logo_url: imagen cuadrada (400px) para avatar/marcador.
--
-- Solo actualizamos escuelas que NO tengan ya cover/logo (no pisar custom).

CREATE TEMP TABLE _sport_images (
    sport text PRIMARY KEY,
    cover_url text NOT NULL,
    logo_url text NOT NULL
);

INSERT INTO _sport_images (sport, cover_url, logo_url) VALUES
    ('Fútbol',
     'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1600&q=80',
     'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=400&q=80'),
    ('Patinaje de carreras',
     'https://images.unsplash.com/photo-1591741471265-8e8db8e0d063?w=1600&q=80',
     'https://images.unsplash.com/photo-1591741471265-8e8db8e0d063?w=400&q=80'),
    ('Patinaje artístico',
     'https://images.unsplash.com/photo-1551522435-a13afa10f103?w=1600&q=80',
     'https://images.unsplash.com/photo-1551522435-a13afa10f103?w=400&q=80'),
    ('Patinaje',
     'https://images.unsplash.com/photo-1591741471265-8e8db8e0d063?w=1600&q=80',
     'https://images.unsplash.com/photo-1591741471265-8e8db8e0d063?w=400&q=80'),
    ('Natación',
     'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&q=80',
     'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=80'),
    ('Tenis',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1600&q=80',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=80'),
    ('Tenis de campo',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1600&q=80',
     'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=80'),
    ('Tenis de mesa',
     'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=1600&q=80',
     'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=400&q=80'),
    ('Baloncesto',
     'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1600&q=80',
     'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80'),
    ('Voleibol',
     'https://images.unsplash.com/photo-1592656094267-764a45160876?w=1600&q=80',
     'https://images.unsplash.com/photo-1592656094267-764a45160876?w=400&q=80'),
    ('Ciclismo',
     'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1600&q=80',
     'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=80'),
    ('Karate',
     'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=1600&q=80',
     'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&q=80'),
    ('Taekwondo',
     'https://images.unsplash.com/photo-1599582909646-2117a6b1c46e?w=1600&q=80',
     'https://images.unsplash.com/photo-1599582909646-2117a6b1c46e?w=400&q=80'),
    ('Squash',
     'https://images.unsplash.com/photo-1622279488297-7b8e8a3a1d61?w=1600&q=80',
     'https://images.unsplash.com/photo-1622279488297-7b8e8a3a1d61?w=400&q=80'),
    ('Bolos',
     'https://images.unsplash.com/photo-1538511637916-cfa05c2cf07a?w=1600&q=80',
     'https://images.unsplash.com/photo-1538511637916-cfa05c2cf07a?w=400&q=80'),
    ('Baile deportivo',
     'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=1600&q=80',
     'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&q=80');

-- Fallback generico (deporte no mapeado) — usa una imagen deportiva neutra
INSERT INTO _sport_images (sport, cover_url, logo_url) VALUES
    ('_default',
     'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1600&q=80',
     'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=80');

-- UPDATE: por cada escuela IDRD, tomar el primer sport (sports[1]) y aplicar el mapping.
UPDATE public.schools s
   SET cover_image_url = COALESCE(s.cover_image_url, COALESCE(si.cover_url, def.cover_url)),
       logo_url        = COALESCE(s.logo_url,        COALESCE(si.logo_url,  def.logo_url)),
       updated_at      = now()
  FROM public.external_school_imports e
  LEFT JOIN _sport_images si ON si.sport = (
      SELECT sp FROM public.schools s2 WHERE s2.id = e.school_id
      CROSS JOIN LATERAL unnest(s2.sports) sp LIMIT 1
  )
  LEFT JOIN _sport_images def ON def.sport = '_default'
 WHERE e.source = 'idrd_bogota_2026'
   AND s.id = e.school_id;


-- ============================================================
-- 4. Verificacion final (NOTICE — para revisar en logs)
-- ============================================================

DO $$
DECLARE
    v_total int;
    v_with_branch int;
    v_with_cover int;
    v_with_logo int;
BEGIN
    SELECT COUNT(*) INTO v_total
      FROM public.external_school_imports WHERE source = 'idrd_bogota_2026';
    SELECT COUNT(DISTINCT b.school_id) INTO v_with_branch
      FROM public.school_branches b
      JOIN public.external_school_imports e ON e.school_id = b.school_id
     WHERE e.source = 'idrd_bogota_2026' AND b.lat IS NOT NULL;
    SELECT COUNT(*) INTO v_with_cover
      FROM public.schools s
      JOIN public.external_school_imports e ON e.school_id = s.id
     WHERE e.source = 'idrd_bogota_2026' AND s.cover_image_url IS NOT NULL;
    SELECT COUNT(*) INTO v_with_logo
      FROM public.schools s
      JOIN public.external_school_imports e ON e.school_id = s.id
     WHERE e.source = 'idrd_bogota_2026' AND s.logo_url IS NOT NULL;

    RAISE NOTICE '─────────────────────────────────────';
    RAISE NOTICE 'IDRD totales en DB: % (esperado 70)', v_total;
    RAISE NOTICE 'Con branch (visible en mapa): % (esperado ~69)', v_with_branch;
    RAISE NOTICE 'Con cover_image_url: % (esperado 70)', v_with_cover;
    RAISE NOTICE 'Con logo_url: % (esperado 70)', v_with_logo;
    RAISE NOTICE '─────────────────────────────────────';
END $$;


COMMIT;
