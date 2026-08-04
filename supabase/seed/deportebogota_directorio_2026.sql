-- ============================================================
-- SPORTMAPS — Escuelas/clubes deportebogota.com (auto-generado)
-- ============================================================
-- Origen: WP REST + scrape de perfiles /perfil/<slug>/
-- Generado por scripts/scrape_deportebogota.py
-- Idempotente: UPSERT por external_school_imports(external_ref) UNIQUE
-- ============================================================

BEGIN;

-- Club Estado Volley – Entrenamiento Femenino y Masculino (DPB-1356)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1356';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Estado Volley – Entrenamiento Femenino y Masculino',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Voleibol- Centro Deportivo Únete',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-estado-volley-entrenamiento-femenino-y-masculino-dpb1356',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1356', v_school_id, '{"wp_id": 1356, "wp_slug": "centro-deportivo-unete-copa-u", "wp_url": "https://deportebogota.com/perfil/centro-deportivo-unete-copa-u/", "address_raw": "Voleibol- Centro Deportivo Únete", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Fenerbahce (DPB-1353)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1353';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Fenerbahce',
      'Club deportivo en Bogotá. Categoría: Voleibol.',
      'academy', 'Bogotá',
      'Coliseo Castilla “IDRD”',
      NULL,
      NULL,
      ARRAY['Voleibol']::text[],
      NULL,
      true, false,
      'fenerbahce-dpb1353',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1353', v_school_id, '{"wp_id": 1353, "wp_slug": "voleibol-coliseo-castilla-idrd", "wp_url": "https://deportebogota.com/perfil/voleibol-coliseo-castilla-idrd/", "address_raw": "Coliseo Castilla “IDRD”", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Voleibol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Voleibol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Parque zonal Gilma Jiménez (DPB-1347)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1347';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Parque zonal Gilma Jiménez',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'parque-zonal-gilma-jimenez-dpb1347',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1347', v_school_id, '{"wp_id": 1347, "wp_slug": "parque-zonal-gilma-jimenez", "wp_url": "https://deportebogota.com/perfil/parque-zonal-gilma-jimenez/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- JUDO-COLEGIO RAFAEL BERNAL JIMENEZ / PLAZA DE LOS ARTESANOS / CLUB JUDOKAS UNIDOS DEL RAFAEL BERNAL JIMENEZ (DPB-1295)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1295';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUDO-COLEGIO RAFAEL BERNAL JIMENEZ / PLAZA DE LOS ARTESANOS / CLUB JUDOKAS UNIDOS DEL RAFAEL BERNAL JIMENEZ',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'judo-colegio-rafael-bernal-jimenez-plaza-de-los-artesanos-cl-dpb1295',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1295', v_school_id, '{"wp_id": 1295, "wp_slug": "judo-colegio-rafael-bernal-jimenez-plaza-de-los-artesanos-club-judokas-unidos-del-rafael-bernal-jimenez", "wp_url": "https://deportebogota.com/perfil/judo-colegio-rafael-bernal-jimenez-plaza-de-los-artesanos-club-judokas-unidos-del-rafael-bernal-jimenez/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Vissel Volley Club (DPB-1332)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1332';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Vissel Volley Club',
      'Club deportivo en Bogotá. Categoría: Voleibol.',
      'academy', 'Bogotá',
      'Coliseo del Colegio Esclavas',
      NULL,
      NULL,
      ARRAY['Voleibol']::text[],
      NULL,
      true, false,
      'vissel-volley-club-dpb1332',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1332', v_school_id, '{"wp_id": 1332, "wp_slug": "voleibol-coliseo-del-colegio-esclavas-vissel-volley-club", "wp_url": "https://deportebogota.com/perfil/voleibol-coliseo-del-colegio-esclavas-vissel-volley-club/", "address_raw": "Coliseo del Colegio Esclavas", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Voleibol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Voleibol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Piscinas parque Patio Bonito (DPB-1315)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1315';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Piscinas parque Patio Bonito',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'piscinas-parque-patio-bonito-dpb1315',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1315', v_school_id, '{"wp_id": 1315, "wp_slug": "piscinas-parque-patio-bonito", "wp_url": "https://deportebogota.com/perfil/piscinas-parque-patio-bonito/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club ProConcept (DPB-1327)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1327';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club ProConcept',
      'Club deportivo en Bogotá. Categoría: BMX Race.',
      'academy', 'Bogotá',
      'Unidad deportiva el Salitre',
      NULL,
      NULL,
      ARRAY['BMX Race']::text[],
      NULL,
      true, false,
      'club-proconcept-dpb1327',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1327', v_school_id, '{"wp_id": 1327, "wp_slug": "bmx-race-unidad-deportiva-el-salitre-club-proconcept", "wp_url": "https://deportebogota.com/perfil/bmx-race-unidad-deportiva-el-salitre-club-proconcept/", "address_raw": "Unidad deportiva el Salitre", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: BMX Race.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['BMX Race']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Unidad deportiva el Salitre', 'Bogotá',
         NULL, 4.6645881, -74.0973562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Polideportivo Timiza (DPB-1323)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1323';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Polideportivo Timiza',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'polideportivo-timiza-dpb1323',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1323', v_school_id, '{"wp_id": 1323, "wp_slug": "polideportivo-timiza", "wp_url": "https://deportebogota.com/perfil/polideportivo-timiza/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Polideportivo Castilla- Bogota (DPB-1321)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1321';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Polideportivo Castilla- Bogota',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'polideportivo-castilla--bogota-dpb1321',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1321', v_school_id, '{"wp_id": 1321, "wp_slug": "polideportivo-castilla-bogota-3", "wp_url": "https://deportebogota.com/perfil/polideportivo-castilla-bogota-3/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Patio Bonito (DPB-1319)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1319';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Patio Bonito',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'patio-bonito-dpb1319',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1319', v_school_id, '{"wp_id": 1319, "wp_slug": "patio-bonito", "wp_url": "https://deportebogota.com/perfil/patio-bonito/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Parque Piscinas de Patio Bonito (DPB-1317)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1317';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Parque Piscinas de Patio Bonito',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'parque-piscinas-de-patio-bonito-dpb1317',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1317', v_school_id, '{"wp_id": 1317, "wp_slug": "parque-piscinas-de-patio-bonito", "wp_url": "https://deportebogota.com/perfil/parque-piscinas-de-patio-bonito/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Patinodromo Marsella (DPB-1313)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1313';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Patinodromo Marsella',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'patinodromo-marsella-dpb1313',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1313', v_school_id, '{"wp_id": 1313, "wp_slug": "patinodromo-marsella", "wp_url": "https://deportebogota.com/perfil/patinodromo-marsella/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Polideportivo Castilla- Bogota (DPB-1311)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1311';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Polideportivo Castilla- Bogota',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'polideportivo-castilla--bogota-dpb1311',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1311', v_school_id, '{"wp_id": 1311, "wp_slug": "polideportivo-castilla-bogota-2", "wp_url": "https://deportebogota.com/perfil/polideportivo-castilla-bogota-2/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Cancha sintética Villa Alsacia-bOGOTA (DPB-1309)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1309';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Cancha sintética Villa Alsacia-bOGOTA',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'cancha-sintetica-villa-alsacia-bogota-dpb1309',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1309', v_school_id, '{"wp_id": 1309, "wp_slug": "cancha-sintetica-villa-alsacia-bogota", "wp_url": "https://deportebogota.com/perfil/cancha-sintetica-villa-alsacia-bogota/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Polideportivo Castilla- Bogota (DPB-1307)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1307';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Polideportivo Castilla- Bogota',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'polideportivo-castilla--bogota-dpb1307',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1307', v_school_id, '{"wp_id": 1307, "wp_slug": "polideportivo-castilla-bogota", "wp_url": "https://deportebogota.com/perfil/polideportivo-castilla-bogota/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- El tintal 2 etapa1 6a 94a26 (DPB-1301)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1301';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'El tintal 2 etapa1 6a 94a26',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'el-tintal-2-etapa1-6a-94a26-dpb1301',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1301', v_school_id, '{"wp_id": 1301, "wp_slug": "el-tintal-2-etapa1-6a-94a26", "wp_url": "https://deportebogota.com/perfil/el-tintal-2-etapa1-6a-94a26/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Complejo Acuático Simón Bolívar (DPB-1224)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1224';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Complejo Acuático Simón Bolívar',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'complejo-acuatico-simon-bolivar-dpb1224',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1224', v_school_id, '{"wp_id": 1224, "wp_slug": "complejo-acuatico-simon-bolivar-2", "wp_url": "https://deportebogota.com/perfil/complejo-acuatico-simon-bolivar-2/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Cedritos (DPB-492)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-492';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Cedritos',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Sierra Fútbol',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'cedritos-dpb492',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-492', v_school_id, '{"wp_id": 492, "wp_slug": "sierra-futbol-cedritos", "wp_url": "https://deportebogota.com/perfil/sierra-futbol-cedritos/", "address_raw": "Sierra Fútbol", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Complejo Acuático Simon Bolivar (DPB-541)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-541';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Complejo Acuático Simon Bolivar',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'complejo-acuatico-simon-bolivar-dpb541',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-541', v_school_id, '{"wp_id": 541, "wp_slug": "complejo-acuatico-simon-bolivar", "wp_url": "https://deportebogota.com/perfil/complejo-acuatico-simon-bolivar/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Deportivo Juventud CEDIJ (DPB-480)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-480';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo Juventud CEDIJ',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Nogales de Tibabuyes',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-deportivo-juventud-cedij-dpb480',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-480', v_school_id, '{"wp_id": 480, "wp_slug": "futbol-nogales-de-tibabuyes-club-deportivo-juventud-cedij", "wp_url": "https://deportebogota.com/perfil/futbol-nogales-de-tibabuyes-club-deportivo-juventud-cedij/", "address_raw": "Nogales de Tibabuyes", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- PARQUE VILLA MAGDALA (DPB-553)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-553';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PARQUE VILLA MAGDALA',
      'Club deportivo en Bogotá. Categoría: BALONCESTO.',
      'academy', 'Bogotá',
      'TWS-BASKETBALL',
      NULL,
      NULL,
      ARRAY['BALONCESTO']::text[],
      NULL,
      true, false,
      'parque-villa-magdala-dpb553',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-553', v_school_id, '{"wp_id": 553, "wp_slug": "baloncesto-tws-basketball-parque-villa-magdala", "wp_url": "https://deportebogota.com/perfil/baloncesto-tws-basketball-parque-villa-magdala/", "address_raw": "TWS-BASKETBALL", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: BALONCESTO.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['BALONCESTO']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- CLUB BUSHIDO JUDO (DPB-1213)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1213';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB BUSHIDO JUDO',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-bushido-judo-dpb1213',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1213', v_school_id, '{"wp_id": 1213, "wp_slug": "club-bushido-judo", "wp_url": "https://deportebogota.com/perfil/club-bushido-judo/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- KARATE DO, HAYUELOS, SHINDEN HEIWA (DPB-411)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-411';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KARATE DO, HAYUELOS, SHINDEN HEIWA',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'karate-do-hayuelos-shinden-heiwa-dpb411',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-411', v_school_id, '{"wp_id": 411, "wp_slug": "karate-do-hayuelos-shinden-heiwa", "wp_url": "https://deportebogota.com/perfil/karate-do-hayuelos-shinden-heiwa/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- qwerty (DPB-359)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-359';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'qwerty',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'qwerty-dpb359',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-359', v_school_id, '{"wp_id": 359, "wp_slug": "qwerty", "wp_url": "https://deportebogota.com/perfil/qwerty/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- La Cabrera (DPB-1205)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1205';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'La Cabrera',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Sierra Fútbol',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'la-cabrera-dpb1205',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1205', v_school_id, '{"wp_id": 1205, "wp_slug": "sierra-futbol-la-cabrera", "wp_url": "https://deportebogota.com/perfil/sierra-futbol-la-cabrera/", "address_raw": "Sierra Fútbol", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Bogota D.C (DPB-1199)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1199';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Bogota D.C',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'bogota-dc-dpb1199',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1199', v_school_id, '{"wp_id": 1199, "wp_slug": "bogota-d-c", "wp_url": "https://deportebogota.com/perfil/bogota-d-c/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- XMIND TOBERIN (DPB-1169)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-1169';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'XMIND TOBERIN',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'xmind-toberin-dpb1169',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-1169', v_school_id, '{"wp_id": 1169, "wp_slug": "xmind-toberin", "wp_url": "https://deportebogota.com/perfil/xmind-toberin/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Taekwondo Jung Do Kwan (DPB-706)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-706';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Taekwondo Jung Do Kwan',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'taekwondo-jung-do-kwan-dpb706',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-706', v_school_id, '{"wp_id": 706, "wp_slug": "taekwondo-jung-do-kwan-3", "wp_url": "https://deportebogota.com/perfil/taekwondo-jung-do-kwan-3/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Taekwondo Jung Do Kwan (DPB-704)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-704';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Taekwondo Jung Do Kwan',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'taekwondo-jung-do-kwan-dpb704',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-704', v_school_id, '{"wp_id": 704, "wp_slug": "taekwondo-jung-do-kwan-2", "wp_url": "https://deportebogota.com/perfil/taekwondo-jung-do-kwan-2/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Taekwondo Jung Do Kwan (DPB-695)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-695';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Taekwondo Jung Do Kwan',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'taekwondo-jung-do-kwan-dpb695',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-695', v_school_id, '{"wp_id": 695, "wp_slug": "taekwondo-jung-do-kwan", "wp_url": "https://deportebogota.com/perfil/taekwondo-jung-do-kwan/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Vikingos (DPB-689)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-689';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Vikingos',
      'Club deportivo en Bogotá. Categoría: voleibol.',
      'academy', 'Bogotá',
      'Colegio Nuestra Señora del Pilar, Chapinero',
      NULL,
      NULL,
      ARRAY['voleibol']::text[],
      NULL,
      true, false,
      'club-vikingos-dpb689',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-689', v_school_id, '{"wp_id": 689, "wp_slug": "voleibol-colegio-nuestra-senora-del-pilar-chapinero-club-vikingos", "wp_url": "https://deportebogota.com/perfil/voleibol-colegio-nuestra-senora-del-pilar-chapinero-club-vikingos/", "address_raw": "Colegio Nuestra Señora del Pilar, Chapinero", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: voleibol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['voleibol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Parque San Andres- Skate Dock (DPB-687)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-687';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Parque San Andres- Skate Dock',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Patinaje adultos y niños',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'parque-san-andres--skate-dock-dpb687',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-687', v_school_id, '{"wp_id": 687, "wp_slug": "patinaje-parque-san-andres-skate-dock", "wp_url": "https://deportebogota.com/perfil/patinaje-parque-san-andres-skate-dock/", "address_raw": "Patinaje adultos y niños", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Pureza de María (DPB-500)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-500';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Pureza de María',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Sierra Baloncesto',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'pureza-de-maria-dpb500',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-500', v_school_id, '{"wp_id": 500, "wp_slug": "sierra-baloncesto-pureza-de-maria", "wp_url": "https://deportebogota.com/perfil/sierra-baloncesto-pureza-de-maria/", "address_raw": "Sierra Baloncesto", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Alessandro Volta (DPB-498)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-498';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Alessandro Volta',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Sierra Fútbol',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'alessandro-volta-dpb498',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-498', v_school_id, '{"wp_id": 498, "wp_slug": "sierra-futbol-alessandro-volta", "wp_url": "https://deportebogota.com/perfil/sierra-futbol-alessandro-volta/", "address_raw": "Sierra Fútbol", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Pureza de María (DPB-496)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-496';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Pureza de María',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Sierra Fútbol',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'pureza-de-maria-dpb496',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-496', v_school_id, '{"wp_id": 496, "wp_slug": "sierra-futbol-pureza-de-maria", "wp_url": "https://deportebogota.com/perfil/sierra-futbol-pureza-de-maria/", "address_raw": "Sierra Fútbol", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Alameda (DPB-494)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-494';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Alameda',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Sierra Fútbol',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'alameda-dpb494',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-494', v_school_id, '{"wp_id": 494, "wp_slug": "sierra-futbol-alameda", "wp_url": "https://deportebogota.com/perfil/sierra-futbol-alameda/", "address_raw": "Sierra Fútbol", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Fútbol-Parque taller el ensueño-el ensueño (DPB-484)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-484';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Fútbol-Parque taller el ensueño-el ensueño',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'futbol-parque-taller-el-ensueno-el-ensueno-dpb484',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-484', v_school_id, '{"wp_id": 484, "wp_slug": "futbol-parque-taller-el-ensueno-el-ensueno", "wp_url": "https://deportebogota.com/perfil/futbol-parque-taller-el-ensueno-el-ensueno/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Deportivo Ramírez Gacha FC / Parque la Igualdad (DPB-468)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-468';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo Ramírez Gacha FC / Parque la Igualdad',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-deportivo-ramirez-gacha-fc-parque-la-igualdad-dpb468',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-468', v_school_id, '{"wp_id": 468, "wp_slug": "parque-la-igualdad", "wp_url": "https://deportebogota.com/perfil/parque-la-igualdad/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Parque CAFAM SUBA (DPB-429)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-429';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Parque CAFAM SUBA',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'parque-cafam-suba-dpb429',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-429', v_school_id, '{"wp_id": 429, "wp_slug": "parque-cafam-suba", "wp_url": "https://deportebogota.com/perfil/parque-cafam-suba/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Seven Basketball Club (DPB-423)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-423';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Seven Basketball Club',
      'Club deportivo en Bogotá. Categoría: Baloncesto.',
      'academy', 'Bogotá',
      'Parque Tierra Santa',
      NULL,
      NULL,
      ARRAY['Baloncesto']::text[],
      NULL,
      true, false,
      'seven-basketball-club-dpb423',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-423', v_school_id, '{"wp_id": 423, "wp_slug": "baloncesto-parque-tierra-santa-seven-basketball-club", "wp_url": "https://deportebogota.com/perfil/baloncesto-parque-tierra-santa-seven-basketball-club/", "address_raw": "Parque Tierra Santa", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Baloncesto.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Baloncesto']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Fútbol / Parque San Andrés / Club Alianza Bogotá (DPB-395)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-395';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Fútbol / Parque San Andrés / Club Alianza Bogotá',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'futbol-parque-san-andres-club-alianza-bogota-dpb395',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-395', v_school_id, '{"wp_id": 395, "wp_slug": "futbol-parque-san-andres-club-alianza-bogota", "wp_url": "https://deportebogota.com/perfil/futbol-parque-san-andres-club-alianza-bogota/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Alianza Bogotá (DPB-390)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-390';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Alianza Bogotá',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque San Andrés',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-alianza-bogota-dpb390',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-390', v_school_id, '{"wp_id": 390, "wp_slug": "parque-san-andres-3", "wp_url": "https://deportebogota.com/perfil/parque-san-andres-3/", "address_raw": "Parque San Andrés", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque San Andrés', 'Bogotá',
         NULL, 4.7128895, -74.1107896, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- AC Mundo Deportes (DPB-382)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-382';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'AC Mundo Deportes',
      'Club deportivo en Bogotá. Categoría: Natación.',
      'academy', 'Bogotá',
      'Parque La Serena',
      NULL,
      NULL,
      ARRAY['Natación']::text[],
      NULL,
      true, false,
      'ac-mundo-deportes-dpb382',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-382', v_school_id, '{"wp_id": 382, "wp_slug": "parque-la-serena", "wp_url": "https://deportebogota.com/perfil/parque-la-serena/", "address_raw": "Parque La Serena", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Natación.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Natación']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque La Serena', 'Bogotá',
         NULL, 4.7096978, -74.0925608, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Star Champions (DPB-378)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-378';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Star Champions',
      'Club deportivo en Bogotá. Categoría: Tenis.',
      'academy', 'Bogotá',
      'Parque San andrés',
      NULL,
      NULL,
      ARRAY['Tenis']::text[],
      NULL,
      true, false,
      'star-champions-dpb378',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-378', v_school_id, '{"wp_id": 378, "wp_slug": "parque-san-andres", "wp_url": "https://deportebogota.com/perfil/parque-san-andres/", "address_raw": "Parque San andrés", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Tenis.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Tenis']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque San andrés', 'Bogotá',
         NULL, 4.7128895, -74.1107896, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Xmind Colombia (DPB-275)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-275';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Xmind Colombia',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Skatepark Miniramp Ciudadela Colsubsidio',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-xmind-colombia-dpb275',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-275', v_school_id, '{"wp_id": 275, "wp_slug": "skatepark-miniramp-ciudadela-colsubsidio-club-xmind-colombia", "wp_url": "https://deportebogota.com/perfil/skatepark-miniramp-ciudadela-colsubsidio-club-xmind-colombia/", "address_raw": "Skatepark Miniramp Ciudadela Colsubsidio", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Octopus (DPB-270)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-270';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Octopus',
      'Club deportivo en Bogotá. Categoría: Natación.',
      'academy', 'Bogotá',
      'Barrio La Granja',
      NULL,
      NULL,
      ARRAY['Natación']::text[],
      NULL,
      true, false,
      'octopus-dpb270',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-270', v_school_id, '{"wp_id": 270, "wp_slug": "barrio-la-granja-octopus", "wp_url": "https://deportebogota.com/perfil/barrio-la-granja-octopus/", "address_raw": "Barrio La Granja", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Natación.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Natación']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Octopus (DPB-268)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-268';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Octopus',
      'Club deportivo en Bogotá. Categoría: Natación.',
      'academy', 'Bogotá',
      'Parque la Serena',
      NULL,
      NULL,
      ARRAY['Natación']::text[],
      NULL,
      true, false,
      'octopus-dpb268',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-268', v_school_id, '{"wp_id": 268, "wp_slug": "parque-la-serena-octopus", "wp_url": "https://deportebogota.com/perfil/parque-la-serena-octopus/", "address_raw": "Parque la Serena", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Natación.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Natación']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque la Serena', 'Bogotá',
         NULL, 4.7096978, -74.0925608, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Monserrate Roller (DPB-266)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-266';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Monserrate Roller',
      'Club deportivo en Bogotá. Categoría: Patinaje.',
      'academy', 'Bogotá',
      'Unidad Deportiva el Salitre',
      NULL,
      NULL,
      ARRAY['Patinaje']::text[],
      NULL,
      true, false,
      'monserrate-roller-dpb266',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-266', v_school_id, '{"wp_id": 266, "wp_slug": "unidad-deportiva-el-salitre-monserrate-roller", "wp_url": "https://deportebogota.com/perfil/unidad-deportiva-el-salitre-monserrate-roller/", "address_raw": "Unidad Deportiva el Salitre", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Patinaje.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Patinaje']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Unidad Deportiva el Salitre', 'Bogotá',
         NULL, 4.6645881, -74.0973562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club de Formación Ciclística Kronos (DPB-264)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-264';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club de Formación Ciclística Kronos',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Velódromo Luis Carlos Galán',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-de-formacion-ciclistica-kronos-dpb264',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-264', v_school_id, '{"wp_id": 264, "wp_slug": "velodromo-luis-carlos-galan-club-de-formacion-ciclistica-kronos", "wp_url": "https://deportebogota.com/perfil/velodromo-luis-carlos-galan-club-de-formacion-ciclistica-kronos/", "address_raw": "Velódromo Luis Carlos Galán", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Leopard BMX (DPB-262)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-262';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Leopard BMX',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque San Andrés',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'leopard-bmx-dpb262',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-262', v_school_id, '{"wp_id": 262, "wp_slug": "parque-san-andres-leopard-bmx", "wp_url": "https://deportebogota.com/perfil/parque-san-andres-leopard-bmx/", "address_raw": "Parque San Andrés", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque San Andrés', 'Bogotá',
         NULL, 4.7128895, -74.1107896, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Bayer BSA (DPB-260)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-260';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Bayer BSA',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Parque San Andrés',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-bayer-bsa-dpb260',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-260', v_school_id, '{"wp_id": 260, "wp_slug": "parque-san-andres-club-bsa", "wp_url": "https://deportebogota.com/perfil/parque-san-andres-club-bsa/", "address_raw": "Parque San Andrés", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque San Andrés', 'Bogotá',
         NULL, 4.7128895, -74.1107896, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club BSA (DPB-257)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-257';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club BSA',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Cancha La Luna',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-bsa-dpb257',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-257', v_school_id, '{"wp_id": 257, "wp_slug": "cancha-la-luna-club-bsa", "wp_url": "https://deportebogota.com/perfil/cancha-la-luna-club-bsa/", "address_raw": "Cancha La Luna", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Escuela Fenix E.D (DPB-256)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-256';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Escuela Fenix E.D',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'PRD Salitre',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'escuela-fenix-ed-dpb256',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-256', v_school_id, '{"wp_id": 256, "wp_slug": "prd-salitre-escuela-fenix-e-d", "wp_url": "https://deportebogota.com/perfil/prd-salitre-escuela-fenix-e-d/", "address_raw": "PRD Salitre", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Parque Carrefour Baviera- Escuela de Formación Deportiva Master Class Tenis (DPB-254)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-254';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Parque Carrefour Baviera- Escuela de Formación Deportiva Master Class Tenis',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'parque-carrefour-baviera--escuela-de-formacion-deportiva-mas-dpb254',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-254', v_school_id, '{"wp_id": 254, "wp_slug": "parque-san-andres-escuela-de-formacion-deportiva-master-class-tenis", "wp_url": "https://deportebogota.com/perfil/parque-san-andres-escuela-de-formacion-deportiva-master-class-tenis/", "address_raw": null, "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Escuela de Formación Deportiva Master Class Tenis (DPB-252)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-252';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Escuela de Formación Deportiva Master Class Tenis',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque Brisas de Iberia',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'escuela-de-formacion-deportiva-master-class-tenis-dpb252',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-252', v_school_id, '{"wp_id": 252, "wp_slug": "parque-brisas-de-iberia-escuela-de-formacion-deportiva-master-class-tenis", "wp_url": "https://deportebogota.com/perfil/parque-brisas-de-iberia-escuela-de-formacion-deportiva-master-class-tenis/", "address_raw": "Parque Brisas de Iberia", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Dojo Club Dan (DPB-250)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-250';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Dojo Club Dan',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Karate Do',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'dojo-club-dan-dpb250',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-250', v_school_id, '{"wp_id": 250, "wp_slug": "dojo-club-dan", "wp_url": "https://deportebogota.com/perfil/dojo-club-dan/", "address_raw": "Karate Do", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Karate Do', 'Bogotá',
         NULL, 4.6721599, -74.1102282, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Optima Sport Tenis (DPB-245)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-245';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Optima Sport Tenis',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque San Andrés',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'optima-sport-tenis-dpb245',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-245', v_school_id, '{"wp_id": 245, "wp_slug": "parque-san-andres-optima-sport-tenis", "wp_url": "https://deportebogota.com/perfil/parque-san-andres-optima-sport-tenis/", "address_raw": "Parque San Andrés", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque San Andrés', 'Bogotá',
         NULL, 4.7128895, -74.1107896, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Campeones Tenis Club (DPB-242)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-242';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Campeones Tenis Club',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque Fontanar del Río',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'campeones-tenis-club-dpb242',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-242', v_school_id, '{"wp_id": 242, "wp_slug": "parque-fontanar-del-rio-campeones-tenis-club", "wp_url": "https://deportebogota.com/perfil/parque-fontanar-del-rio-campeones-tenis-club/", "address_raw": "Parque Fontanar del Río", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque Fontanar del Río', 'Bogotá',
         NULL, 4.7563711, -74.1112877, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Campeones Tenis Club (DPB-240)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-240';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Campeones Tenis Club',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'PRD Salitre',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'campeones-tenis-club-dpb240',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-240', v_school_id, '{"wp_id": 240, "wp_slug": "prd-salitre-campeones-tenis-club", "wp_url": "https://deportebogota.com/perfil/prd-salitre-campeones-tenis-club/", "address_raw": "PRD Salitre", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Campeones Tenis Club (DPB-238)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-238';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Campeones Tenis Club',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque Juan Amarillo',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'campeones-tenis-club-dpb238',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-238', v_school_id, '{"wp_id": 238, "wp_slug": "parque-juan-amarillo-campeones-tenis-club", "wp_url": "https://deportebogota.com/perfil/parque-juan-amarillo-campeones-tenis-club/", "address_raw": "Parque Juan Amarillo", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque Juan Amarillo', 'Bogotá',
         NULL, 4.7290191, -74.1117516, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Deportivo Talentos Sariri F.C (DPB-236)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-236';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo Talentos Sariri F.C',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Cancha Sintética Florencia Norte',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-deportivo-talentos-sariri-fc-dpb236',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-236', v_school_id, '{"wp_id": 236, "wp_slug": "cancha-sintetica-florencia-norte-club-deportivo-talentos-sariri-f-c", "wp_url": "https://deportebogota.com/perfil/cancha-sintetica-florencia-norte-club-deportivo-talentos-sariri-f-c/", "address_raw": "Cancha Sintética Florencia Norte", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Polideportivo Nuevo Muzú – Club Atlético Leones FC (DPB-233)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-233';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Polideportivo Nuevo Muzú – Club Atlético Leones FC',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Fúbol',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'polideportivo-nuevo-muzu-club-atletico-leones-fc-dpb233',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-233', v_school_id, '{"wp_id": 233, "wp_slug": "polideportivo-nuevo-muzu-club-atletico-leones-fc", "wp_url": "https://deportebogota.com/perfil/polideportivo-nuevo-muzu-club-atletico-leones-fc/", "address_raw": "Fúbol", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Atlético Leones FC (DPB-231)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-231';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Atlético Leones FC',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Parque Metropolitano el Tunal',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-atletico-leones-fc-dpb231',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-231', v_school_id, '{"wp_id": 231, "wp_slug": "parque-metropolitano-el-tunal-club-atletico-leones-fc", "wp_url": "https://deportebogota.com/perfil/parque-metropolitano-el-tunal-club-atletico-leones-fc/", "address_raw": "Parque Metropolitano el Tunal", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque Metropolitano el Tunal', 'Bogotá',
         NULL, 4.5718773, -74.1341131, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Deportivo Lowenfeld (DPB-228)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-228';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo Lowenfeld',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Parque Normandía',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-deportivo-lowenfeld-dpb228',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-228', v_school_id, '{"wp_id": 228, "wp_slug": "parque-normandia-club-deportivo-lowenfeld", "wp_url": "https://deportebogota.com/perfil/parque-normandia-club-deportivo-lowenfeld/", "address_raw": "Parque Normandía", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque Normandía', 'Bogotá',
         NULL, 4.6785112, -74.1072020, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Deportivo Lowenfeld (DPB-226)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-226';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo Lowenfeld',
      'Club deportivo en Bogotá. Categoría: Skateboarding.',
      'academy', 'Bogotá',
      'Skatepark Movistar Arena',
      NULL,
      NULL,
      ARRAY['Skateboarding']::text[],
      NULL,
      true, false,
      'club-deportivo-lowenfeld-dpb226',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-226', v_school_id, '{"wp_id": 226, "wp_slug": "skatepark-movistar-arena-club-deportivo-lowenfeld", "wp_url": "https://deportebogota.com/perfil/skatepark-movistar-arena-club-deportivo-lowenfeld/", "address_raw": "Skatepark Movistar Arena", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Skateboarding.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Skateboarding']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Eagles Skate (DPB-223)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-223';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Eagles Skate',
      'Club deportivo en Bogotá. Categoría: Patinaje.',
      'academy', 'Bogotá',
      'Villa Deportiva Principal de Mosquera Cundinamarca',
      NULL,
      NULL,
      ARRAY['Patinaje']::text[],
      NULL,
      true, false,
      'club-eagles-skate-dpb223',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-223', v_school_id, '{"wp_id": 223, "wp_slug": "villa-deportiva-principal-de-mosquera-cundinamarca-club-eagles-skate", "wp_url": "https://deportebogota.com/perfil/villa-deportiva-principal-de-mosquera-cundinamarca-club-eagles-skate/", "address_raw": "Villa Deportiva Principal de Mosquera Cundinamarca", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Patinaje.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Patinaje']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Eagles Skate (DPB-221)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-221';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Eagles Skate',
      'Club deportivo en Bogotá. Categoría: Patinaje.',
      'academy', 'Bogotá',
      'Parque San Andres',
      NULL,
      NULL,
      ARRAY['Patinaje']::text[],
      NULL,
      true, false,
      'club-eagles-skate-dpb221',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-221', v_school_id, '{"wp_id": 221, "wp_slug": "parque-san-andres-club-eagles-skate", "wp_url": "https://deportebogota.com/perfil/parque-san-andres-club-eagles-skate/", "address_raw": "Parque San Andres", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Patinaje.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Patinaje']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque San Andres', 'Bogotá',
         NULL, 4.7128895, -74.1107896, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Leyendas Voleibol (DPB-217)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-217';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Leyendas Voleibol',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque el Bosque Popular',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-leyendas-voleibol-dpb217',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-217', v_school_id, '{"wp_id": 217, "wp_slug": "parque-el-bosque-popular-club-leyendas-voleibol", "wp_url": "https://deportebogota.com/perfil/parque-el-bosque-popular-club-leyendas-voleibol/", "address_raw": "Parque el Bosque Popular", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Leyendas Voleibol (DPB-215)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-215';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Leyendas Voleibol',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque el Trébol',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-leyendas-voleibol-dpb215',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-215', v_school_id, '{"wp_id": 215, "wp_slug": "parque-el-trebol-club-leyendas-voleibol", "wp_url": "https://deportebogota.com/perfil/parque-el-trebol-club-leyendas-voleibol/", "address_raw": "Parque el Trébol", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Su Majestad Tenis Club (DPB-212)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-212';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Su Majestad Tenis Club',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque J.J. Vargas',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'su-majestad-tenis-club-dpb212',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-212', v_school_id, '{"wp_id": 212, "wp_slug": "parque-j-j-vargas-su-majestad-tenis-club", "wp_url": "https://deportebogota.com/perfil/parque-j-j-vargas-su-majestad-tenis-club/", "address_raw": "Parque J.J. Vargas", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque J.J. Vargas', 'Bogotá',
         NULL, 4.6700959, -74.0824807, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Enzona (DPB-203)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-203';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Enzona',
      'Club deportivo en Bogotá. Categoría: Voleibol.',
      'academy', 'Bogotá',
      'Parque Roma',
      NULL,
      NULL,
      ARRAY['Voleibol']::text[],
      NULL,
      true, false,
      'club-enzona-dpb203',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-203', v_school_id, '{"wp_id": 203, "wp_slug": "parque-roma-club-enzona", "wp_url": "https://deportebogota.com/perfil/parque-roma-club-enzona/", "address_raw": "Parque Roma", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Voleibol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Voleibol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque Roma', 'Bogotá',
         NULL, 4.6070351, -74.1713028, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Enzona (DPB-199)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-199';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Enzona',
      'Club deportivo en Bogotá. Categoría: Voleibol.',
      'academy', 'Bogotá',
      'Coliseo Parque San Andrés',
      NULL,
      NULL,
      ARRAY['Voleibol']::text[],
      NULL,
      true, false,
      'club-enzona-dpb199',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-199', v_school_id, '{"wp_id": 199, "wp_slug": "coliseo-parque-san-andres", "wp_url": "https://deportebogota.com/perfil/coliseo-parque-san-andres/", "address_raw": "Coliseo Parque San Andrés", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Voleibol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Voleibol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club de Taekwondo Koryo (DPB-197)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-197';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club de Taekwondo Koryo',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Barrio Álamos Norte',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-de-taekwondo-koryo-dpb197',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-197', v_school_id, '{"wp_id": 197, "wp_slug": "barrio-alamos-norte-club-de-taekwondo-koryo", "wp_url": "https://deportebogota.com/perfil/barrio-alamos-norte-club-de-taekwondo-koryo/", "address_raw": "Barrio Álamos Norte", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Parque Normandía / Club deportivo PRESEAS FC – Filial CDI Alexis Viera (DPB-192)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-192';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Parque Normandía / Club deportivo PRESEAS FC – Filial CDI Alexis Viera',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Parque Villa Luz',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'parque-normandia-club-deportivo-preseas-fc-filial-cdi-alexis-dpb192',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-192', v_school_id, '{"wp_id": 192, "wp_slug": "parque-villa-luz-preseas-futbol-club-filial-cdi-alexis-viera", "wp_url": "https://deportebogota.com/perfil/parque-villa-luz-preseas-futbol-club-filial-cdi-alexis-viera/", "address_raw": "Parque Villa Luz", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque Villa Luz', 'Bogotá',
         NULL, 4.6823235, -74.1086938, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Deportivo Arroyo FC (DPB-159)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-159';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo Arroyo FC',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Parque La Europa',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-deportivo-arroyo-fc-dpb159',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-159', v_school_id, '{"wp_id": 159, "wp_slug": "parque-la-europa-club-deportivo-arroyo-fc", "wp_url": "https://deportebogota.com/perfil/parque-la-europa-club-deportivo-arroyo-fc/", "address_raw": "Parque La Europa", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Deportivo Arroyo FC (DPB-157)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-157';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo Arroyo FC',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Los 2 Puentes',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-deportivo-arroyo-fc-dpb157',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-157', v_school_id, '{"wp_id": 157, "wp_slug": "los-2-puentes-club-deportivo-arroyo-fc", "wp_url": "https://deportebogota.com/perfil/los-2-puentes-club-deportivo-arroyo-fc/", "address_raw": "Los 2 Puentes", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Deportivo Arroyo FC (DPB-155)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-155';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo Arroyo FC',
      'Club deportivo en Bogotá. Categoría: Fútbol.',
      'academy', 'Bogotá',
      'Parque Metropolitano Zona Franca',
      NULL,
      NULL,
      ARRAY['Fútbol']::text[],
      NULL,
      true, false,
      'club-deportivo-arroyo-fc-dpb155',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-155', v_school_id, '{"wp_id": 155, "wp_slug": "parque-metropolitano-zona-franca-club-deportivo-arroyo-fc", "wp_url": "https://deportebogota.com/perfil/parque-metropolitano-zona-franca-club-deportivo-arroyo-fc/", "address_raw": "Parque Metropolitano Zona Franca", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Fútbol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Fútbol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque Metropolitano Zona Franca', 'Bogotá',
         NULL, 4.6697062, -74.1649071, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club de Taekwondo Koryo (DPB-152)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-152';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club de Taekwondo Koryo',
      'Club deportivo en Bogotá. Categoría: Multideporte.',
      'academy', 'Bogotá',
      'Garcés Navas',
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      NULL,
      true, false,
      'club-de-taekwondo-koryo-dpb152',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-152', v_school_id, '{"wp_id": 152, "wp_slug": "garces-navas-club-koryo", "wp_url": "https://deportebogota.com/perfil/garces-navas-club-koryo/", "address_raw": "Garcés Navas", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Multideporte.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Multideporte']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Garcés Navas', 'Bogotá',
         NULL, 4.7160617, -74.1220549, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Wallon (DPB-149)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-149';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Wallon',
      'Club deportivo en Bogotá. Categoría: Voleibol.',
      'academy', 'Bogotá',
      'Centro Deportivo Únete',
      NULL,
      NULL,
      ARRAY['Voleibol']::text[],
      NULL,
      true, false,
      'club-wallon-dpb149',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-149', v_school_id, '{"wp_id": 149, "wp_slug": "centro-deportivo-unete-club-wallon", "wp_url": "https://deportebogota.com/perfil/centro-deportivo-unete-club-wallon/", "address_raw": "Centro Deportivo Únete", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Voleibol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Voleibol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Wallon (DPB-147)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-147';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Wallon',
      'Club deportivo en Bogotá. Categoría: Voleibol.',
      'academy', 'Bogotá',
      'Colegio el Carmen Teresiano',
      NULL,
      NULL,
      ARRAY['Voleibol']::text[],
      NULL,
      true, false,
      'club-wallon-dpb147',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-147', v_school_id, '{"wp_id": 147, "wp_slug": "colegio-el-carmen-teresiano", "wp_url": "https://deportebogota.com/perfil/colegio-el-carmen-teresiano/", "address_raw": "Colegio el Carmen Teresiano", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Voleibol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Voleibol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Club Trueno (DPB-139)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-139';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Trueno',
      'Club deportivo en Bogotá. Categoría: Patinaje.',
      'academy', 'Bogotá',
      'Parque San Andrés',
      NULL,
      NULL,
      ARRAY['Patinaje']::text[],
      NULL,
      true, false,
      'club-trueno-dpb139',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-139', v_school_id, '{"wp_id": 139, "wp_slug": "parque-san-andres-club-trueno-3", "wp_url": "https://deportebogota.com/perfil/parque-san-andres-club-trueno-3/", "address_raw": "Parque San Andrés", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Patinaje.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Patinaje']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Parque San Andrés', 'Bogotá',
         NULL, 4.7128895, -74.1107896, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Club Wallon (DPB-63)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'DPB-63';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      logo_url, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Wallon',
      'Club deportivo en Bogotá. Categoría: Voleibol.',
      'academy', 'Bogotá',
      'Colegio Nicolás Esguerra',
      NULL,
      NULL,
      ARRAY['Voleibol']::text[],
      NULL,
      true, false,
      'club-wallon-dpb63',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('deportebogota_2026', 'DPB-63', v_school_id, '{"wp_id": 63, "wp_slug": "colegio-nicolas-esguerra-club-wallon", "wp_url": "https://deportebogota.com/perfil/colegio-nicolas-esguerra-club-wallon/", "address_raw": "Colegio Nicolás Esguerra", "locality": null, "socials": []}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Club deportivo en Bogotá. Categoría: Voleibol.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      logo_url    = COALESCE(logo_url, NULL),
      sports      = ARRAY['Voleibol']::text[],
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Colegio Nicolás Esguerra', 'Bogotá',
         NULL, 4.6323917, -74.1210048, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;