-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 4/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- LAS AGUILAS  (IDRD-CLUB-las-aguilas-096)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-las-aguilas-096';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LAS AGUILAS',
      'Presidente: GUILLERMO TREJOS BENAVIDES. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 096. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3142586034',
      'trejosg3@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'las-aguilas-096',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-las-aguilas-096', v_school_id, '{"resolucion_rd": "096", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "GUILLERMO TREJOS BENAVIDES", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GUILLERMO TREJOS BENAVIDES. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 096. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142586034', phone),
      email       = COALESCE('trejosg3@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "096", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "GUILLERMO TREJOS BENAVIDES", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-las-aguilas-096';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3142586034', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOCCER STARS F.C.  (IDRD-CLUB-soccer-stars-fc-163)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-soccer-stars-fc-163';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOCCER STARS F.C.',
      'Presidente: JORGE ANTONIO CASALLAS RIVEROS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 163. Vigente hasta 2027-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3017660520',
      'junior0876@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'soccer-stars-fc-163',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-soccer-stars-fc-163', v_school_id, '{"resolucion_rd": "163", "resolucion_actualizacion": null, "fecha_inicio": "22-02-2022", "fecha_fin": "2027-02-22", "presidente": "JORGE ANTONIO CASALLAS RIVEROS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE ANTONIO CASALLAS RIVEROS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 163. Vigente hasta 2027-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017660520', phone),
      email       = COALESCE('junior0876@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "163", "resolucion_actualizacion": null, "fecha_inicio": "22-02-2022", "fecha_fin": "2027-02-22", "presidente": "JORGE ANTONIO CASALLAS RIVEROS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-soccer-stars-fc-163';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3017660520', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLÃâ°TICO NORMANDÃÂA DISTRITO CAPITAL  (IDRD-CLUB-atlaatico-normandaaa-distrito-capital-217)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atlaatico-normandaaa-distrito-capital-217';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLÃâ°TICO NORMANDÃÂA DISTRITO CAPITAL',
      'Presidente: CARLOS ARTURO TARAZONA BELTRAN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 217. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3012777321',
      'carlosarturotarazona@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atlaatico-normandaaa-distrito-capital-217',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atlaatico-normandaaa-distrito-capital-217', v_school_id, '{"resolucion_rd": "217", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "CARLOS ARTURO TARAZONA BELTRAN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO TARAZONA BELTRAN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 217. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012777321', phone),
      email       = COALESCE('carlosarturotarazona@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "217", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "CARLOS ARTURO TARAZONA BELTRAN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atlaatico-normandaaa-distrito-capital-217';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3012777321', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INDEPENDIENTE CAPITAL TINTAL F.C  (IDRD-CLUB-independiente-capital-tintal-fc-351)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-independiente-capital-tintal-fc-351';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INDEPENDIENTE CAPITAL TINTAL F.C',
      'Presidente: EVER ANDRES SANCHEZ GARCIA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 351. Vigente hasta 2028-04-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3142955850',
      'andrew.525@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'independiente-capital-tintal-fc-351',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-independiente-capital-tintal-fc-351', v_school_id, '{"resolucion_rd": "351", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2023", "fecha_fin": "2028-04-23", "presidente": "EVER ANDRES SANCHEZ GARCIA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EVER ANDRES SANCHEZ GARCIA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 351. Vigente hasta 2028-04-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142955850', phone),
      email       = COALESCE('andrew.525@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "351", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2023", "fecha_fin": "2028-04-23", "presidente": "EVER ANDRES SANCHEZ GARCIA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-independiente-capital-tintal-fc-351';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3142955850', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LEEDS FC  (IDRD-CLUB-club-deportivo-leeds-fc-902)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-leeds-fc-902';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LEEDS FC',
      'Presidente: HOLMAN JAVIER BELTRAN CASAS. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 902 / actualización Nº 202. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3246134682',
      'realleedsfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-leeds-fc-902',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-leeds-fc-902', v_school_id, '{"resolucion_rd": "902", "resolucion_actualizacion": "202", "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "HOLMAN JAVIER BELTRAN CASAS", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HOLMAN JAVIER BELTRAN CASAS. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 902 / actualización Nº 202. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3246134682', phone),
      email       = COALESCE('realleedsfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "902", "resolucion_actualizacion": "202", "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "HOLMAN JAVIER BELTRAN CASAS", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-leeds-fc-902';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3246134682', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- WALTHINO FUTBOL CLUB  (IDRD-CLUB-walthino-futbol-club-134)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-walthino-futbol-club-134';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'WALTHINO FUTBOL CLUB',
      'Presidente: JUAN CARLOS MORALES SAAVEDRA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 134. Vigente hasta 2027-02-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3007799126',
      'walthinfutbolclub@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'walthino-futbol-club-134',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-walthino-futbol-club-134', v_school_id, '{"resolucion_rd": "134", "resolucion_actualizacion": null, "fecha_inicio": "14-02-2022", "fecha_fin": "2027-02-14", "presidente": "JUAN CARLOS MORALES SAAVEDRA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS MORALES SAAVEDRA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 134. Vigente hasta 2027-02-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007799126', phone),
      email       = COALESCE('walthinfutbolclub@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "134", "resolucion_actualizacion": null, "fecha_inicio": "14-02-2022", "fecha_fin": "2027-02-14", "presidente": "JUAN CARLOS MORALES SAAVEDRA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-walthino-futbol-club-134';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3007799126', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SPORTING JDD FS  (IDRD-CLUB-sporting-jdd-fs-922)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sporting-jdd-fs-922';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPORTING JDD FS',
      'Presidente: JOSE DAVID DIAZ JULIO. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 922. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3007780877',
      'jose.diaz2247@correo.policia.gov.co',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sporting-jdd-fs-922',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sporting-jdd-fs-922', v_school_id, '{"resolucion_rd": "922", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "JOSE DAVID DIAZ JULIO", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE DAVID DIAZ JULIO. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 922. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007780877', phone),
      email       = COALESCE('jose.diaz2247@correo.policia.gov.co', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "922", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "JOSE DAVID DIAZ JULIO", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sporting-jdd-fs-922';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3007780877', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETICO SALITRE  (IDRD-CLUB-atletico-salitre-081)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletico-salitre-081';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETICO SALITRE',
      'Presidente: JHON JAIRO ISAZA MORALES. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 081. Vigente hasta 2027-02-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3202356729',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletico-salitre-081',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletico-salitre-081', v_school_id, '{"resolucion_rd": "081", "resolucion_actualizacion": null, "fecha_inicio": "17-02-2022", "fecha_fin": "2027-02-17", "presidente": "JHON JAIRO ISAZA MORALES", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON JAIRO ISAZA MORALES. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 081. Vigente hasta 2027-02-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202356729', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "081", "resolucion_actualizacion": null, "fecha_inicio": "17-02-2022", "fecha_fin": "2027-02-17", "presidente": "JHON JAIRO ISAZA MORALES", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletico-salitre-081';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3202356729', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ANCESTRAL  (IDRD-CLUB-club-deportivo-ancestral-1033)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ancestral-1033';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ANCESTRAL',
      'Presidente: MARTHA GRACIELA TURRIAGO HERRERA. Deporte(s): Tejo. Localidad: Puente Aranda. Resolución R-D Nº 1033. Vigente hasta 2030-09-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3102202118',
      'clubancestral5@gmail.com',
      ARRAY['Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ancestral-1033',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ancestral-1033', v_school_id, '{"resolucion_rd": "1033", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2025", "fecha_fin": "2030-09-23", "presidente": "MARTHA GRACIELA TURRIAGO HERRERA", "localidad": "Puente Aranda", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTHA GRACIELA TURRIAGO HERRERA. Deporte(s): Tejo. Localidad: Puente Aranda. Resolución R-D Nº 1033. Vigente hasta 2030-09-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102202118', phone),
      email       = COALESCE('clubancestral5@gmail.com', email),
      sports      = ARRAY['Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1033", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2025", "fecha_fin": "2030-09-23", "presidente": "MARTHA GRACIELA TURRIAGO HERRERA", "localidad": "Puente Aranda", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ancestral-1033';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3102202118', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ROCKSTARS CHEERLEADING AND GIMNASTICS  (IDRD-CLUB-club-deportivo-rockstars-cheerleading-an-170)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-rockstars-cheerleading-an-170';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ROCKSTARS CHEERLEADING AND GIMNASTICS',
      'Presidente: OSCAR JULIAN MONTERO MARTINEZ. Deporte(s): Porrismo. Localidad: Usaquén. Resolución R-D Nº 170. Vigente hasta 2030-02-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3212344427',
      'rockstarscentrodeentrenamiento@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-rockstars-cheerleading-an-170',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-rockstars-cheerleading-an-170', v_school_id, '{"resolucion_rd": "170", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2025", "fecha_fin": "2030-02-28", "presidente": "OSCAR JULIAN MONTERO MARTINEZ", "localidad": "Usaquén", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR JULIAN MONTERO MARTINEZ. Deporte(s): Porrismo. Localidad: Usaquén. Resolución R-D Nº 170. Vigente hasta 2030-02-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212344427', phone),
      email       = COALESCE('rockstarscentrodeentrenamiento@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "170", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2025", "fecha_fin": "2030-02-28", "presidente": "OSCAR JULIAN MONTERO MARTINEZ", "localidad": "Usaquén", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-rockstars-cheerleading-an-170';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3212344427', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KANO JUDO CLUB  (IDRD-CLUB-kano-judo-club-442)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kano-judo-club-442';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KANO JUDO CLUB',
      'Presidente: ANDREA MARCELA PINILLA BUSTOS. Deporte(s): Judo. Localidad: Antonio Nariño. Resolución R-D Nº 442. Vigente hasta 2027-05-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3219770230',
      'kanojudoclub@hotmail.com',
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kano-judo-club-442',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kano-judo-club-442', v_school_id, '{"resolucion_rd": "442", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2022", "fecha_fin": "2027-05-09", "presidente": "ANDREA MARCELA PINILLA BUSTOS", "localidad": "Antonio Nariño", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDREA MARCELA PINILLA BUSTOS. Deporte(s): Judo. Localidad: Antonio Nariño. Resolución R-D Nº 442. Vigente hasta 2027-05-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219770230', phone),
      email       = COALESCE('kanojudoclub@hotmail.com', email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "442", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2022", "fecha_fin": "2027-05-09", "presidente": "ANDREA MARCELA PINILLA BUSTOS", "localidad": "Antonio Nariño", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kano-judo-club-442';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3219770230', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTDEPORT SKATE  (IDRD-CLUB-futdeport-skate-1862)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futdeport-skate-1862';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTDEPORT SKATE',
      'Presidente: JOSÃâ° VICENTE SILVA BARRETO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1862. Vigente hasta 2028-01-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3045927545',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futdeport-skate-1862',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futdeport-skate-1862', v_school_id, '{"resolucion_rd": "1862", "resolucion_actualizacion": null, "fecha_inicio": "11-01-2023", "fecha_fin": "2028-01-11", "presidente": "JOSÃâ° VICENTE SILVA BARRETO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃâ° VICENTE SILVA BARRETO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1862. Vigente hasta 2028-01-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3045927545', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1862", "resolucion_actualizacion": null, "fecha_inicio": "11-01-2023", "fecha_fin": "2028-01-11", "presidente": "JOSÃâ° VICENTE SILVA BARRETO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futdeport-skate-1862';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3045927545', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- W.H WRESTLING  (IDRD-CLUB-wh-wrestling-634)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-wh-wrestling-634';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'W.H WRESTLING',
      'Presidente: WILMAR VICENTE HERNANDEZ GOMEZ. Deporte(s): Lucha. Localidad: La Candelaria. Resolución R-D Nº 634. Vigente hasta 2028-06-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'La Candelaria',
      '3003712876',
      'joseme191@hotmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'wh-wrestling-634',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-wh-wrestling-634', v_school_id, '{"resolucion_rd": "634", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2023", "fecha_fin": "2028-06-18", "presidente": "WILMAR VICENTE HERNANDEZ GOMEZ", "localidad": "La Candelaria", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILMAR VICENTE HERNANDEZ GOMEZ. Deporte(s): Lucha. Localidad: La Candelaria. Resolución R-D Nº 634. Vigente hasta 2028-06-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003712876', phone),
      email       = COALESCE('joseme191@hotmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "634", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2023", "fecha_fin": "2028-06-18", "presidente": "WILMAR VICENTE HERNANDEZ GOMEZ", "localidad": "La Candelaria", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-wh-wrestling-634';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'La Candelaria', 'Bogotá', '3003712876', 4.6843605, -74.0511562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WHITE SHARKS BOGOTA  (IDRD-CLUB-club-deportivo-white-sharks-bogota-135)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-white-sharks-bogota-135';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WHITE SHARKS BOGOTA',
      'Presidente: OSCAR FERNANDO AYALA RODRÃÂÃÂGUEZ. Deporte(s): Football Americano. Localidad: Fontibón. Resolución R-D Nº 135. Vigente hasta 2029-04-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3214821552',
      'whitesharksbogota@gmail.com',
      ARRAY['Football Americano']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-white-sharks-bogota-135',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-white-sharks-bogota-135', v_school_id, '{"resolucion_rd": "135", "resolucion_actualizacion": null, "fecha_inicio": "11-04-2024", "fecha_fin": "2029-04-11", "presidente": "OSCAR FERNANDO AYALA RODRÃÂÃÂGUEZ", "localidad": "Fontibón", "sports": ["Football Americano"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR FERNANDO AYALA RODRÃÂÃÂGUEZ. Deporte(s): Football Americano. Localidad: Fontibón. Resolución R-D Nº 135. Vigente hasta 2029-04-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214821552', phone),
      email       = COALESCE('whitesharksbogota@gmail.com', email),
      sports      = ARRAY['Football Americano']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "135", "resolucion_actualizacion": null, "fecha_inicio": "11-04-2024", "fecha_fin": "2029-04-11", "presidente": "OSCAR FERNANDO AYALA RODRÃÂÃÂGUEZ", "localidad": "Fontibón", "sports": ["Football Americano"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-white-sharks-bogota-135';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3214821552', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL AUSTRAL  (IDRD-CLUB-club-deportivo-real-austral-1158)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-austral-1158';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL AUSTRAL',
      'Presidente: FREDY ALEXANDER MOJICA PEREZ. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1158. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3112851006',
      'clubdeportivorealaustral@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-austral-1158',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-austral-1158', v_school_id, '{"resolucion_rd": "1158", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "FREDY ALEXANDER MOJICA PEREZ", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDY ALEXANDER MOJICA PEREZ. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1158. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112851006', phone),
      email       = COALESCE('clubdeportivorealaustral@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1158", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "FREDY ALEXANDER MOJICA PEREZ", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-austral-1158';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3112851006', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DISTRITO ELITE  (IDRD-CLUB-distrito-elite-424)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-distrito-elite-424';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DISTRITO ELITE',
      'Presidente: JAIME ARIEL CARO TALERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 424. Vigente hasta 2122-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3213585651',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'distrito-elite-424',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-distrito-elite-424', v_school_id, '{"resolucion_rd": "424", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2117", "fecha_fin": "2122-02-21", "presidente": "JAIME ARIEL CARO TALERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIME ARIEL CARO TALERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 424. Vigente hasta 2122-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213585651', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "424", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2117", "fecha_fin": "2122-02-21", "presidente": "JAIME ARIEL CARO TALERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-distrito-elite-424';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3213585651', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE FORMACION CICLISTICA KRONOS MTR  (IDRD-CLUB-club-de-formacion-ciclistica-kronos-mtr-059)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-formacion-ciclistica-kronos-mtr-059';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE FORMACION CICLISTICA KRONOS MTR',
      'Presidente: MARCO TULIO RUIZ BUITRAGO. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 059. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3115146756',
      'marco.t.ruiz@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-formacion-ciclistica-kronos-mtr-059',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-formacion-ciclistica-kronos-mtr-059', v_school_id, '{"resolucion_rd": "059", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "MARCO TULIO RUIZ BUITRAGO", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCO TULIO RUIZ BUITRAGO. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 059. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115146756', phone),
      email       = COALESCE('marco.t.ruiz@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "059", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "MARCO TULIO RUIZ BUITRAGO", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-formacion-ciclistica-kronos-mtr-059';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3115146756', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- YANKEES D.C  (IDRD-CLUB-yankees-dc-703)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-yankees-dc-703';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'YANKEES D.C',
      'Presidente: JUAN CARLOS MERCADO MENDOZA. Deporte(s): Béisbol. Localidad: Engativá. Resolución R-D Nº 703. Vigente hasta 2028-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3222522840',
      'juancarlosmm1208@gmail.com',
      ARRAY['Béisbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'yankees-dc-703',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-yankees-dc-703', v_school_id, '{"resolucion_rd": "703", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2023", "fecha_fin": "2028-06-28", "presidente": "JUAN CARLOS MERCADO MENDOZA", "localidad": "Engativá", "sports": ["Béisbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS MERCADO MENDOZA. Deporte(s): Béisbol. Localidad: Engativá. Resolución R-D Nº 703. Vigente hasta 2028-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222522840', phone),
      email       = COALESCE('juancarlosmm1208@gmail.com', email),
      sports      = ARRAY['Béisbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "703", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2023", "fecha_fin": "2028-06-28", "presidente": "JUAN CARLOS MERCADO MENDOZA", "localidad": "Engativá", "sports": ["Béisbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-yankees-dc-703';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3222522840', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL TALENTOS  (IDRD-CLUB-club-deportivo-real-talentos-1223)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-talentos-1223';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL TALENTOS',
      'Presidente: ORLANDO RODRÃGUEZ MARTÃNEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1223 / actualización Nº 060. Vigente hasta 2027-10-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3004946708',
      'orlandoroma0278@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-talentos-1223',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-talentos-1223', v_school_id, '{"resolucion_rd": "1223", "resolucion_actualizacion": "060", "fecha_inicio": "10-10-2022", "fecha_fin": "2027-10-10", "presidente": "ORLANDO RODRÃGUEZ MARTÃNEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ORLANDO RODRÃGUEZ MARTÃNEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1223 / actualización Nº 060. Vigente hasta 2027-10-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3004946708', phone),
      email       = COALESCE('orlandoroma0278@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1223", "resolucion_actualizacion": "060", "fecha_inicio": "10-10-2022", "fecha_fin": "2027-10-10", "presidente": "ORLANDO RODRÃGUEZ MARTÃNEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-talentos-1223';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3004946708', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LAZIO F.S  (IDRD-CLUB-lazio-fs-906)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-lazio-fs-906';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LAZIO F.S',
      'Presidente: DEIVID RICARDO RODRÃÂGUEZ DÃÂAZ. Deporte(s): Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 906. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3193759585',
      'rodriguez02deivid@hotmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'lazio-fs-906',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-lazio-fs-906', v_school_id, '{"resolucion_rd": "906", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "DEIVID RICARDO RODRÃÂGUEZ DÃÂAZ", "localidad": "Bosa", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DEIVID RICARDO RODRÃÂGUEZ DÃÂAZ. Deporte(s): Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 906. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193759585', phone),
      email       = COALESCE('rodriguez02deivid@hotmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "906", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "DEIVID RICARDO RODRÃÂGUEZ DÃÂAZ", "localidad": "Bosa", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-lazio-fs-906';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3193759585', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE PATINAJE LIBERTAD  (IDRD-CLUB-de-patinaje-libertad-685)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-patinaje-libertad-685';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE PATINAJE LIBERTAD',
      'Presidente: IMMER ORNAN MURCIA CONTRERAS. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 685. Vigente hasta 2027-06-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3138518487',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-patinaje-libertad-685',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-patinaje-libertad-685', v_school_id, '{"resolucion_rd": "685", "resolucion_actualizacion": null, "fecha_inicio": "24-06-2022", "fecha_fin": "2027-06-24", "presidente": "IMMER ORNAN MURCIA CONTRERAS", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IMMER ORNAN MURCIA CONTRERAS. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 685. Vigente hasta 2027-06-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138518487', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "685", "resolucion_actualizacion": null, "fecha_inicio": "24-06-2022", "fecha_fin": "2027-06-24", "presidente": "IMMER ORNAN MURCIA CONTRERAS", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-patinaje-libertad-685';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3138518487', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOLDADOS ELITE  (IDRD-CLUB-soldados-elite-1533)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-soldados-elite-1533';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOLDADOS ELITE',
      'Presidente: NICOLAS ODILIO PALACIOS LARA. Deporte(s): Baloncesto. Resolución R-D Nº 1533. Vigente hasta 2027-11-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3002239609',
      'administracion@clubsoldadoselite.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'soldados-elite-1533',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-soldados-elite-1533', v_school_id, '{"resolucion_rd": "1533", "resolucion_actualizacion": null, "fecha_inicio": "15-11-2022", "fecha_fin": "2027-11-15", "presidente": "NICOLAS ODILIO PALACIOS LARA", "localidad": null, "sports": ["Baloncesto"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS ODILIO PALACIOS LARA. Deporte(s): Baloncesto. Resolución R-D Nº 1533. Vigente hasta 2027-11-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002239609', phone),
      email       = COALESCE('administracion@clubsoldadoselite.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1533", "resolucion_actualizacion": null, "fecha_inicio": "15-11-2022", "fecha_fin": "2027-11-15", "presidente": "NICOLAS ODILIO PALACIOS LARA", "localidad": null, "sports": ["Baloncesto"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-soldados-elite-1533';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TIRO CON ARCO ULISES ARCHERY  (IDRD-CLUB-de-tiro-con-arco-ulises-archery-1015)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-tiro-con-arco-ulises-archery-1015';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TIRO CON ARCO ULISES ARCHERY',
      'Presidente: MARÃÂA CAMILA TORRES MENDOZA. Localidad: Suba. Resolución R-D Nº 1015 / actualización Nº 185. Vigente hasta 2027-09-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3107874818',
      'club.ulises.+archery@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-tiro-con-arco-ulises-archery-1015',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-tiro-con-arco-ulises-archery-1015', v_school_id, '{"resolucion_rd": "1015", "resolucion_actualizacion": "185", "fecha_inicio": "07-09-2022", "fecha_fin": "2027-09-07", "presidente": "MARÃÂA CAMILA TORRES MENDOZA", "localidad": "Suba", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃÂA CAMILA TORRES MENDOZA. Localidad: Suba. Resolución R-D Nº 1015 / actualización Nº 185. Vigente hasta 2027-09-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107874818', phone),
      email       = COALESCE('club.ulises.+archery@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1015", "resolucion_actualizacion": "185", "fecha_inicio": "07-09-2022", "fecha_fin": "2027-09-07", "presidente": "MARÃÂA CAMILA TORRES MENDOZA", "localidad": "Suba", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-tiro-con-arco-ulises-archery-1015';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3107874818', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CFC  (IDRD-CLUB-cfc-1264)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cfc-1264';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CFC',
      'Presidente: GERMAN ORLANDO CARDENAS SARMIENTO. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 1264. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3138527122',
      NULL,
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cfc-1264',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cfc-1264', v_school_id, '{"resolucion_rd": "1264", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "GERMAN ORLANDO CARDENAS SARMIENTO", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GERMAN ORLANDO CARDENAS SARMIENTO. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 1264. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138527122', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1264", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "GERMAN ORLANDO CARDENAS SARMIENTO", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cfc-1264';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3138527122', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE LUCHA OLIMPICA TEEN CHAMPIONS  (IDRD-CLUB-club-deportivo-de-lucha-olimpica-teen-ch-816)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-lucha-olimpica-teen-ch-816';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE LUCHA OLIMPICA TEEN CHAMPIONS',
      'Presidente: NEVIS YINNETH FRANCO MOTA. Deporte(s): Lucha. Localidad: Ciudad Bolívar. Resolución R-D Nº 816 / actualización Nº 816. Vigente hasta 2027-10-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3174590452',
      'clubteenchampions2017@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-lucha-olimpica-teen-ch-816',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-lucha-olimpica-teen-ch-816', v_school_id, '{"resolucion_rd": "816", "resolucion_actualizacion": "816", "fecha_inicio": "26-10-2022", "fecha_fin": "2027-10-26", "presidente": "NEVIS YINNETH FRANCO MOTA", "localidad": "Ciudad Bolívar", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NEVIS YINNETH FRANCO MOTA. Deporte(s): Lucha. Localidad: Ciudad Bolívar. Resolución R-D Nº 816 / actualización Nº 816. Vigente hasta 2027-10-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174590452', phone),
      email       = COALESCE('clubteenchampions2017@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "816", "resolucion_actualizacion": "816", "fecha_inicio": "26-10-2022", "fecha_fin": "2027-10-26", "presidente": "NEVIS YINNETH FRANCO MOTA", "localidad": "Ciudad Bolívar", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-lucha-olimpica-teen-ch-816';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3174590452', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PERLA NEGRA CITY SPORT F.CÃ¢â¬Â  (IDRD-CLUB-perla-negra-city-sport-fcaaa-1338)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-perla-negra-city-sport-fcaaa-1338';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PERLA NEGRA CITY SPORT F.CÃ¢â¬Â',
      'Presidente: MISAEL LIZARAZO MANRIQUE. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1338. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '49328863103235844',
      'misaellizarazo28@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'perla-negra-city-sport-fcaaa-1338',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-perla-negra-city-sport-fcaaa-1338', v_school_id, '{"resolucion_rd": "1338", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "MISAEL LIZARAZO MANRIQUE", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MISAEL LIZARAZO MANRIQUE. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1338. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('49328863103235844', phone),
      email       = COALESCE('misaellizarazo28@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1338", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "MISAEL LIZARAZO MANRIQUE", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-perla-negra-city-sport-fcaaa-1338';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '49328863103235844', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GOLDEN STEPS  (IDRD-CLUB-golden-steps-800)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-golden-steps-800';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GOLDEN STEPS',
      'Presidente: WILVER ENRIQUE FELICIANO CORAL. Deporte(s): Fútbol. Resolución R-D Nº 800. Vigente hasta 2027-07-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3124495126',
      'goldensteps@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'golden-steps-800',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-golden-steps-800', v_school_id, '{"resolucion_rd": "800", "resolucion_actualizacion": null, "fecha_inicio": "18-07-2022", "fecha_fin": "2027-07-18", "presidente": "WILVER ENRIQUE FELICIANO CORAL", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILVER ENRIQUE FELICIANO CORAL. Deporte(s): Fútbol. Resolución R-D Nº 800. Vigente hasta 2027-07-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124495126', phone),
      email       = COALESCE('goldensteps@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "800", "resolucion_actualizacion": null, "fecha_inicio": "18-07-2022", "fecha_fin": "2027-07-18", "presidente": "WILVER ENRIQUE FELICIANO CORAL", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-golden-steps-800';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- GUERREROS DEL SUR  (IDRD-CLUB-guerreros-del-sur-1310)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-guerreros-del-sur-1310';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GUERREROS DEL SUR',
      'Presidente: WILSON HERBER PÃâ°REZ CUTA. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1310. Vigente hasta 2027-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '6617032',
      'delsurguerreros@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'guerreros-del-sur-1310',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-guerreros-del-sur-1310', v_school_id, '{"resolucion_rd": "1310", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2022", "fecha_fin": "2027-10-19", "presidente": "WILSON HERBER PÃâ°REZ CUTA", "localidad": "Rafael Uribe Uribe", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON HERBER PÃâ°REZ CUTA. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1310. Vigente hasta 2027-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6617032', phone),
      email       = COALESCE('delsurguerreros@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1310", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2022", "fecha_fin": "2027-10-19", "presidente": "WILSON HERBER PÃâ°REZ CUTA", "localidad": "Rafael Uribe Uribe", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-guerreros-del-sur-1310';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '6617032', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORTING BETHEL F.C.  (IDRD-CLUB-club-deportivo-sporting-bethel-fc-027)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sporting-bethel-fc-027';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORTING BETHEL F.C.',
      'Presidente: HERNAN PACHECO PACHECO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 027. Vigente hasta 2031-01-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3122745462',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sporting-bethel-fc-027',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sporting-bethel-fc-027', v_school_id, '{"resolucion_rd": "027", "resolucion_actualizacion": null, "fecha_inicio": "22-01-2026", "fecha_fin": "2031-01-22", "presidente": "HERNAN PACHECO PACHECO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HERNAN PACHECO PACHECO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 027. Vigente hasta 2031-01-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3122745462', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "027", "resolucion_actualizacion": null, "fecha_inicio": "22-01-2026", "fecha_fin": "2031-01-22", "presidente": "HERNAN PACHECO PACHECO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sporting-bethel-fc-027';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3122745462', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUMPING  (IDRD-CLUB-jumping-1674)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jumping-1674';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUMPING',
      'Presidente: SUSAN JHOANN VASGAS CASTRO. Deporte(s): Gimnasia. Resolución R-D Nº 1674. Vigente hasta 2027-12-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '2241841',
      'mileniomaria@outlook.com',
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jumping-1674',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jumping-1674', v_school_id, '{"resolucion_rd": "1674", "resolucion_actualizacion": null, "fecha_inicio": "20-12-2022", "fecha_fin": "2027-12-20", "presidente": "SUSAN JHOANN VASGAS CASTRO", "localidad": null, "sports": ["Gimnasia"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SUSAN JHOANN VASGAS CASTRO. Deporte(s): Gimnasia. Resolución R-D Nº 1674. Vigente hasta 2027-12-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2241841', phone),
      email       = COALESCE('mileniomaria@outlook.com', email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1674", "resolucion_actualizacion": null, "fecha_inicio": "20-12-2022", "fecha_fin": "2027-12-20", "presidente": "SUSAN JHOANN VASGAS CASTRO", "localidad": null, "sports": ["Gimnasia"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jumping-1674';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- BMX EXTREME NITRO MANIA  (IDRD-CLUB-bmx-extreme-nitro-mania-523)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bmx-extreme-nitro-mania-523';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BMX EXTREME NITRO MANIA',
      'Presidente: MARÃÂA ALEJANDRA HURTADO OROZCO. Deporte(s): Ciclismo. Resolución R-D Nº 523. Vigente hasta 2027-05-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3213340485',
      'alecus289@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bmx-extreme-nitro-mania-523',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bmx-extreme-nitro-mania-523', v_school_id, '{"resolucion_rd": "523", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2022", "fecha_fin": "2027-05-24", "presidente": "MARÃÂA ALEJANDRA HURTADO OROZCO", "localidad": null, "sports": ["Ciclismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃÂA ALEJANDRA HURTADO OROZCO. Deporte(s): Ciclismo. Resolución R-D Nº 523. Vigente hasta 2027-05-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213340485', phone),
      email       = COALESCE('alecus289@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "523", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2022", "fecha_fin": "2027-05-24", "presidente": "MARÃÂA ALEJANDRA HURTADO OROZCO", "localidad": null, "sports": ["Ciclismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bmx-extreme-nitro-mania-523';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ARREGOCES  (IDRD-CLUB-arregoces-1639)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-arregoces-1639';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ARREGOCES',
      'Presidente: CESAR AUGUSTO ARREGOCES ALVAREZ. Deporte(s): Voleibol. Localidad: Suba. Resolución R-D Nº 1639. Vigente hasta 2027-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3115914747',
      'cesararregocesa@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'arregoces-1639',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-arregoces-1639', v_school_id, '{"resolucion_rd": "1639", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2022", "fecha_fin": "2027-12-13", "presidente": "CESAR AUGUSTO ARREGOCES ALVAREZ", "localidad": "Suba", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR AUGUSTO ARREGOCES ALVAREZ. Deporte(s): Voleibol. Localidad: Suba. Resolución R-D Nº 1639. Vigente hasta 2027-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115914747', phone),
      email       = COALESCE('cesararregocesa@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1639", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2022", "fecha_fin": "2027-12-13", "presidente": "CESAR AUGUSTO ARREGOCES ALVAREZ", "localidad": "Suba", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-arregoces-1639';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3115914747', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TAEKWONDO YONG-JI  (IDRD-CLUB-de-taekwondo-yong-ji-400)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-taekwondo-yong-ji-400';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TAEKWONDO YONG-JI',
      'Presidente: ANDRES ALFONSO FERRO. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 400. Vigente hasta 2027-05-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '80639053178368625',
      'draketkd23@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-taekwondo-yong-ji-400',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-taekwondo-yong-ji-400', v_school_id, '{"resolucion_rd": "400", "resolucion_actualizacion": null, "fecha_inicio": "02-05-2022", "fecha_fin": "2027-05-02", "presidente": "ANDRES ALFONSO FERRO", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES ALFONSO FERRO. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 400. Vigente hasta 2027-05-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('80639053178368625', phone),
      email       = COALESCE('draketkd23@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "400", "resolucion_actualizacion": null, "fecha_inicio": "02-05-2022", "fecha_fin": "2027-05-02", "presidente": "ANDRES ALFONSO FERRO", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-taekwondo-yong-ji-400';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '80639053178368625', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE ATLETISMO MOUNTAIN RUNNERS  (IDRD-CLUB-de-atletismo-mountain-runners-184)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-atletismo-mountain-runners-184';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE ATLETISMO MOUNTAIN RUNNERS',
      'Presidente: MARTHA INES RONCERIA REY. Deporte(s): Atletismo. Localidad: Chapinero. Resolución R-D Nº 184. Vigente hasta 2028-03-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3107693164',
      'marticarun@hotmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-atletismo-mountain-runners-184',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-atletismo-mountain-runners-184', v_school_id, '{"resolucion_rd": "184", "resolucion_actualizacion": null, "fecha_inicio": "06-03-2023", "fecha_fin": "2028-03-05", "presidente": "MARTHA INES RONCERIA REY", "localidad": "Chapinero", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTHA INES RONCERIA REY. Deporte(s): Atletismo. Localidad: Chapinero. Resolución R-D Nº 184. Vigente hasta 2028-03-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107693164', phone),
      email       = COALESCE('marticarun@hotmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "184", "resolucion_actualizacion": null, "fecha_inicio": "06-03-2023", "fecha_fin": "2028-03-05", "presidente": "MARTHA INES RONCERIA REY", "localidad": "Chapinero", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-atletismo-mountain-runners-184';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3107693164', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BRAVENESS  (IDRD-CLUB-braveness-1199)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-braveness-1199';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BRAVENESS',
      'Presidente: VIVIAM AURIS DE LA ROSA BOLAÃâOS. Deporte(s): Esgrima. Resolución R-D Nº 1199. Vigente hasta 2027-10-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3222817535',
      'braveness.entrenamiento@gmail.com',
      ARRAY['Esgrima']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'braveness-1199',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-braveness-1199', v_school_id, '{"resolucion_rd": "1199", "resolucion_actualizacion": null, "fecha_inicio": "03-10-2022", "fecha_fin": "2027-10-03", "presidente": "VIVIAM AURIS DE LA ROSA BOLAÃâOS", "localidad": null, "sports": ["Esgrima"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VIVIAM AURIS DE LA ROSA BOLAÃâOS. Deporte(s): Esgrima. Resolución R-D Nº 1199. Vigente hasta 2027-10-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222817535', phone),
      email       = COALESCE('braveness.entrenamiento@gmail.com', email),
      sports      = ARRAY['Esgrima']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1199", "resolucion_actualizacion": null, "fecha_inicio": "03-10-2022", "fecha_fin": "2027-10-03", "presidente": "VIVIAM AURIS DE LA ROSA BOLAÃâOS", "localidad": null, "sports": ["Esgrima"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-braveness-1199';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- IN NAE DO TAE KWON DO  (IDRD-CLUB-in-nae-do-tae-kwon-do-646)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-in-nae-do-tae-kwon-do-646';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'IN NAE DO TAE KWON DO',
      'Presidente: JOHN DENNISON MONTIEL DIAZ. Deporte(s): Taekwondo. Localidad: Engativá. Resolución R-D Nº 646. Vigente hasta 2027-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3213197029',
      'clubinnaedo@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'in-nae-do-tae-kwon-do-646',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-in-nae-do-tae-kwon-do-646', v_school_id, '{"resolucion_rd": "646", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2022", "fecha_fin": "2027-06-21", "presidente": "JOHN DENNISON MONTIEL DIAZ", "localidad": "Engativá", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN DENNISON MONTIEL DIAZ. Deporte(s): Taekwondo. Localidad: Engativá. Resolución R-D Nº 646. Vigente hasta 2027-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213197029', phone),
      email       = COALESCE('clubinnaedo@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "646", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2022", "fecha_fin": "2027-06-21", "presidente": "JOHN DENNISON MONTIEL DIAZ", "localidad": "Engativá", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-in-nae-do-tae-kwon-do-646';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3213197029', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PSG BOGOTA F.C.  (IDRD-CLUB-club-deportivo-psg-bogota-fc-267)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-psg-bogota-fc-267';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PSG BOGOTA F.C.',
      'Presidente: ALONSO ENRIQUE OJEDA MELO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 267. Vigente hasta 2030-03-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3167444208',
      'alonsojem@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-psg-bogota-fc-267',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-psg-bogota-fc-267', v_school_id, '{"resolucion_rd": "267", "resolucion_actualizacion": null, "fecha_inicio": "27-03-2025", "fecha_fin": "2030-03-27", "presidente": "ALONSO ENRIQUE OJEDA MELO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALONSO ENRIQUE OJEDA MELO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 267. Vigente hasta 2030-03-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3167444208', phone),
      email       = COALESCE('alonsojem@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "267", "resolucion_actualizacion": null, "fecha_inicio": "27-03-2025", "fecha_fin": "2030-03-27", "presidente": "ALONSO ENRIQUE OJEDA MELO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-psg-bogota-fc-267';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3167444208', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA ACADEMIA  (IDRD-CLUB-la-academia-571)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-academia-571';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA ACADEMIA',
      'Presidente: DAVID ENRIQUE ROJAS ACEVEDO. Deporte(s): Patinaje. Resolución R-D Nº 571. Vigente hasta 2027-06-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3105684327',
      'laacademiaesmasformacion@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-academia-571',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-academia-571', v_school_id, '{"resolucion_rd": "571", "resolucion_actualizacion": null, "fecha_inicio": "06-06-2022", "fecha_fin": "2027-06-06", "presidente": "DAVID ENRIQUE ROJAS ACEVEDO", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID ENRIQUE ROJAS ACEVEDO. Deporte(s): Patinaje. Resolución R-D Nº 571. Vigente hasta 2027-06-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105684327', phone),
      email       = COALESCE('laacademiaesmasformacion@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "571", "resolucion_actualizacion": null, "fecha_inicio": "06-06-2022", "fecha_fin": "2027-06-06", "presidente": "DAVID ENRIQUE ROJAS ACEVEDO", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-academia-571';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- FONDO DE EMPLEADOS UNIVERSIDAD DISTRITAL FRANCISCO JOSÃâ° DE CALDAS  (IDRD-CLUB-fondo-de-empleados-universidad-distrital-1414)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fondo-de-empleados-universidad-distrital-1414';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FONDO DE EMPLEADOS UNIVERSIDAD DISTRITAL FRANCISCO JOSÃâ° DE CALDAS',
      'Presidente: LUIS EDUARDO RESTREPO MORALES. Deporte(s): Bowling. Resolución R-D Nº 1414. Vigente hasta 2027-11-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '28531041',
      'sgerencia@feud.com.co',
      ARRAY['Bowling']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fondo-de-empleados-universidad-distrital-1414',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fondo-de-empleados-universidad-distrital-1414', v_school_id, '{"resolucion_rd": "1414", "resolucion_actualizacion": null, "fecha_inicio": "03-11-2022", "fecha_fin": "2027-11-03", "presidente": "LUIS EDUARDO RESTREPO MORALES", "localidad": null, "sports": ["Bowling"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS EDUARDO RESTREPO MORALES. Deporte(s): Bowling. Resolución R-D Nº 1414. Vigente hasta 2027-11-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('28531041', phone),
      email       = COALESCE('sgerencia@feud.com.co', email),
      sports      = ARRAY['Bowling']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1414", "resolucion_actualizacion": null, "fecha_inicio": "03-11-2022", "fecha_fin": "2027-11-03", "presidente": "LUIS EDUARDO RESTREPO MORALES", "localidad": null, "sports": ["Bowling"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fondo-de-empleados-universidad-distrital-1414';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TITANS BOGOTA  (IDRD-CLUB-club-deportivo-titans-bogota-469)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-titans-bogota-469';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TITANS BOGOTA',
      'Presidente: NORAIDA VARGAS TELLO. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 469 / actualización Nº 469. Vigente hasta 2029-04-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3106519523',
      'clubdepatinajetitansbogota@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-titans-bogota-469',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-titans-bogota-469', v_school_id, '{"resolucion_rd": "469", "resolucion_actualizacion": "469", "fecha_inicio": "15-04-2024", "fecha_fin": "2029-04-15", "presidente": "NORAIDA VARGAS TELLO", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NORAIDA VARGAS TELLO. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 469 / actualización Nº 469. Vigente hasta 2029-04-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106519523', phone),
      email       = COALESCE('clubdepatinajetitansbogota@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "469", "resolucion_actualizacion": "469", "fecha_inicio": "15-04-2024", "fecha_fin": "2029-04-15", "presidente": "NORAIDA VARGAS TELLO", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-titans-bogota-469';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3106519523', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KATRINAS ULTIMATE  (IDRD-CLUB-katrinas-ultimate-923)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-katrinas-ultimate-923';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KATRINAS ULTIMATE',
      'Presidente: VANESSA RODRIGUEZ SANABRIA. Deporte(s): Ultimate. Localidad: Engativá. Resolución R-D Nº 923. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3118885321',
      NULL,
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'katrinas-ultimate-923',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-katrinas-ultimate-923', v_school_id, '{"resolucion_rd": "923", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "VANESSA RODRIGUEZ SANABRIA", "localidad": "Engativá", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VANESSA RODRIGUEZ SANABRIA. Deporte(s): Ultimate. Localidad: Engativá. Resolución R-D Nº 923. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118885321', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "923", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "VANESSA RODRIGUEZ SANABRIA", "localidad": "Engativá", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-katrinas-ultimate-923';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3118885321', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE PATINAJE EN LA LINEA  (IDRD-CLUB-de-patinaje-en-la-linea-1734)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-patinaje-en-la-linea-1734';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE PATINAJE EN LA LINEA',
      'Presidente: JEISON STIVEN NIÃâO MORALES. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1734. Vigente hasta 2027-12-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3146159514',
      'fjotaene.m333@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-patinaje-en-la-linea-1734',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-patinaje-en-la-linea-1734', v_school_id, '{"resolucion_rd": "1734", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2022", "fecha_fin": "2027-12-27", "presidente": "JEISON STIVEN NIÃâO MORALES", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISON STIVEN NIÃâO MORALES. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1734. Vigente hasta 2027-12-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3146159514', phone),
      email       = COALESCE('fjotaene.m333@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1734", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2022", "fecha_fin": "2027-12-27", "presidente": "JEISON STIVEN NIÃâO MORALES", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-patinaje-en-la-linea-1734';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3146159514', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COLOMBIA SQUASH CENTER II  (IDRD-CLUB-colombia-squash-center-ii-574)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-colombia-squash-center-ii-574';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COLOMBIA SQUASH CENTER II',
      'Presidente: DAYAN CAROLINA HERRERA GONZALEZ. Deporte(s): Squash. Localidad: Suba. Resolución R-D Nº 574. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3102589303',
      'jsquash@hotmail.com',
      ARRAY['Squash']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'colombia-squash-center-ii-574',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-colombia-squash-center-ii-574', v_school_id, '{"resolucion_rd": "574", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "DAYAN CAROLINA HERRERA GONZALEZ", "localidad": "Suba", "sports": ["Squash"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAYAN CAROLINA HERRERA GONZALEZ. Deporte(s): Squash. Localidad: Suba. Resolución R-D Nº 574. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102589303', phone),
      email       = COALESCE('jsquash@hotmail.com', email),
      sports      = ARRAY['Squash']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "574", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "DAYAN CAROLINA HERRERA GONZALEZ", "localidad": "Suba", "sports": ["Squash"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-colombia-squash-center-ii-574';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3102589303', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO COLOMBIAN TRAMP  (IDRD-CLUB-club-deportivo-colombian-tramp-295)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-colombian-tramp-295';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO COLOMBIAN TRAMP',
      'Presidente: FRANCESCO ALBERTO FERNÃÂNDEZ TORRES. Deporte(s): Gimnasia. Localidad: Kennedy. Resolución R-D Nº 295 / actualización Nº 1531. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3212728156',
      'clubcolombiantramp@gmail.com',
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-colombian-tramp-295',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-colombian-tramp-295', v_school_id, '{"resolucion_rd": "295", "resolucion_actualizacion": "1531", "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "FRANCESCO ALBERTO FERNÃÂNDEZ TORRES", "localidad": "Kennedy", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FRANCESCO ALBERTO FERNÃÂNDEZ TORRES. Deporte(s): Gimnasia. Localidad: Kennedy. Resolución R-D Nº 295 / actualización Nº 1531. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212728156', phone),
      email       = COALESCE('clubcolombiantramp@gmail.com', email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "295", "resolucion_actualizacion": "1531", "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "FRANCESCO ALBERTO FERNÃÂNDEZ TORRES", "localidad": "Kennedy", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-colombian-tramp-295';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3212728156', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NUEVA JUVENTUD BOGOTÃÂ F.C.  (IDRD-CLUB-nueva-juventud-bogotaa-fc-448)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-nueva-juventud-bogotaa-fc-448';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NUEVA JUVENTUD BOGOTÃÂ F.C.',
      'Presidente: CESAR AUGUSTO SANCHEZ. Resolución R-D Nº 448. Vigente hasta 2027-05-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3204522414',
      'nuevajuventudubate@hotmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'nueva-juventud-bogotaa-fc-448',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-nueva-juventud-bogotaa-fc-448', v_school_id, '{"resolucion_rd": "448", "resolucion_actualizacion": null, "fecha_inicio": "17-05-2022", "fecha_fin": "2027-05-17", "presidente": "CESAR AUGUSTO SANCHEZ", "localidad": null, "sports": [], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR AUGUSTO SANCHEZ. Resolución R-D Nº 448. Vigente hasta 2027-05-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204522414', phone),
      email       = COALESCE('nuevajuventudubate@hotmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "448", "resolucion_actualizacion": null, "fecha_inicio": "17-05-2022", "fecha_fin": "2027-05-17", "presidente": "CESAR AUGUSTO SANCHEZ", "localidad": null, "sports": [], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-nueva-juventud-bogotaa-fc-448';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ALTLETISMO PARA TODOS  (IDRD-CLUB-altletismo-para-todos-1440)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-altletismo-para-todos-1440';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALTLETISMO PARA TODOS',
      'Presidente: GUSTAVO PEDRAZA ROMERO. Deporte(s): Atletismo. Resolución R-D Nº 1440. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3157978568',
      'atletismoparatodosbogota@hotmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'altletismo-para-todos-1440',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-altletismo-para-todos-1440', v_school_id, '{"resolucion_rd": "1440", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "GUSTAVO PEDRAZA ROMERO", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GUSTAVO PEDRAZA ROMERO. Deporte(s): Atletismo. Resolución R-D Nº 1440. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3157978568', phone),
      email       = COALESCE('atletismoparatodosbogota@hotmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1440", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "GUSTAVO PEDRAZA ROMERO", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-altletismo-para-todos-1440';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- SOLO PARA NOSOTRAS  (IDRD-CLUB-solo-para-nosotras-708)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-solo-para-nosotras-708';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOLO PARA NOSOTRAS',
      'Presidente: ADRIANA LISBET RIVERA DÃÂAZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 708. Vigente hasta 2028-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3203355986',
      'adriana.riveradiaz@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'solo-para-nosotras-708',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-solo-para-nosotras-708', v_school_id, '{"resolucion_rd": "708", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2023", "fecha_fin": "2028-06-28", "presidente": "ADRIANA LISBET RIVERA DÃÂAZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ADRIANA LISBET RIVERA DÃÂAZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 708. Vigente hasta 2028-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203355986', phone),
      email       = COALESCE('adriana.riveradiaz@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "708", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2023", "fecha_fin": "2028-06-28", "presidente": "ADRIANA LISBET RIVERA DÃÂAZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-solo-para-nosotras-708';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3203355986', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- WIZARD VOLLEY TEAM  (IDRD-CLUB-wizard-volley-team-1570)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-wizard-volley-team-1570';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'WIZARD VOLLEY TEAM',
      'Presidente: OSCAR MAURICIO GONZALEZ AREVALO. Deporte(s): Voleibol. Localidad: Barrios Unidos. Resolución R-D Nº 1570. Vigente hasta 2027-11-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3118049695',
      NULL,
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'wizard-volley-team-1570',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-wizard-volley-team-1570', v_school_id, '{"resolucion_rd": "1570", "resolucion_actualizacion": null, "fecha_inicio": "30-11-2022", "fecha_fin": "2027-11-30", "presidente": "OSCAR MAURICIO GONZALEZ AREVALO", "localidad": "Barrios Unidos", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR MAURICIO GONZALEZ AREVALO. Deporte(s): Voleibol. Localidad: Barrios Unidos. Resolución R-D Nº 1570. Vigente hasta 2027-11-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118049695', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1570", "resolucion_actualizacion": null, "fecha_inicio": "30-11-2022", "fecha_fin": "2027-11-30", "presidente": "OSCAR MAURICIO GONZALEZ AREVALO", "localidad": "Barrios Unidos", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-wizard-volley-team-1570';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3118049695', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUVENTUS ACADEMY BOGOTÃÂ  (IDRD-CLUB-juventus-academy-bogotaa-1230)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-juventus-academy-bogotaa-1230';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUVENTUS ACADEMY BOGOTÃÂ',
      'Presidente: JUAN MANUEL BEDOYA GARRIDO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1230. Vigente hasta 2027-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '7441116',
      'direcciongeneral@jacademycom.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'juventus-academy-bogotaa-1230',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-juventus-academy-bogotaa-1230', v_school_id, '{"resolucion_rd": "1230", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2022", "fecha_fin": "2027-10-07", "presidente": "JUAN MANUEL BEDOYA GARRIDO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN MANUEL BEDOYA GARRIDO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1230. Vigente hasta 2027-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7441116', phone),
      email       = COALESCE('direcciongeneral@jacademycom.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1230", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2022", "fecha_fin": "2027-10-07", "presidente": "JUAN MANUEL BEDOYA GARRIDO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-juventus-academy-bogotaa-1230';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '7441116', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VULCANOUS ULTIMATE CLUB  (IDRD-CLUB-vulcanous-ultimate-club-893)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-vulcanous-ultimate-club-893';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VULCANOUS ULTIMATE CLUB',
      'Presidente: MICHAEL CIFUENTES MALDONADO. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 893. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3102765422',
      'vulcanousultimate@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'vulcanous-ultimate-club-893',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-vulcanous-ultimate-club-893', v_school_id, '{"resolucion_rd": "893", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "MICHAEL CIFUENTES MALDONADO", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MICHAEL CIFUENTES MALDONADO. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 893. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102765422', phone),
      email       = COALESCE('vulcanousultimate@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "893", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "MICHAEL CIFUENTES MALDONADO", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-vulcanous-ultimate-club-893';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3102765422', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOCCER FUTURE  (IDRD-CLUB-soccer-future-857)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-soccer-future-857';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOCCER FUTURE',
      'Presidente: JOHN CARLOS RAMIREZ MARTINEZ. Deporte(s): Fútbol. Resolución R-D Nº 857. Vigente hasta 2027-07-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3112692620',
      'futuresoccer@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'soccer-future-857',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-soccer-future-857', v_school_id, '{"resolucion_rd": "857", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2022", "fecha_fin": "2027-07-26", "presidente": "JOHN CARLOS RAMIREZ MARTINEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN CARLOS RAMIREZ MARTINEZ. Deporte(s): Fútbol. Resolución R-D Nº 857. Vigente hasta 2027-07-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112692620', phone),
      email       = COALESCE('futuresoccer@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "857", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2022", "fecha_fin": "2027-07-26", "presidente": "JOHN CARLOS RAMIREZ MARTINEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-soccer-future-857';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PATINAJE RUNNING LG  (IDRD-CLUB-club-deportivo-de-patinaje-running-lg-1287)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-running-lg-1287';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PATINAJE RUNNING LG',
      'Presidente: GERMAN RAUL USECHE POLANCO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1287. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3115588179',
      'escuelarunninglg@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-patinaje-running-lg-1287',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-patinaje-running-lg-1287', v_school_id, '{"resolucion_rd": "1287", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "GERMAN RAUL USECHE POLANCO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GERMAN RAUL USECHE POLANCO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1287. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115588179', phone),
      email       = COALESCE('escuelarunninglg@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1287", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "GERMAN RAUL USECHE POLANCO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-running-lg-1287';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3115588179', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- EVOLUTION OF STARS  (IDRD-CLUB-evolution-of-stars-471)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-evolution-of-stars-471';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'EVOLUTION OF STARS',
      'Presidente: CRISTIAN CAMILO PARDO ROA. Deporte(s): Fútbol. Resolución R-D Nº 471. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3043873852',
      'clubdeportivoevolutionofstars@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'evolution-of-stars-471',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-evolution-of-stars-471', v_school_id, '{"resolucion_rd": "471", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "CRISTIAN CAMILO PARDO ROA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN CAMILO PARDO ROA. Deporte(s): Fútbol. Resolución R-D Nº 471. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043873852', phone),
      email       = COALESCE('clubdeportivoevolutionofstars@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "471", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "CRISTIAN CAMILO PARDO ROA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-evolution-of-stars-471';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- BCA ALL STARS  (IDRD-CLUB-bca-all-stars-009)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bca-all-stars-009';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BCA ALL STARS',
      'Presidente: MILTON ACERO GARCÃÆÃÂA. Deporte(s): Porrismo. Resolución R-D Nº 009. Vigente hasta 2028-01-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '73505483112054877',
      'miltonmasters@hotmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bca-all-stars-009',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bca-all-stars-009', v_school_id, '{"resolucion_rd": "009", "resolucion_actualizacion": null, "fecha_inicio": "23-01-2023", "fecha_fin": "2028-01-23", "presidente": "MILTON ACERO GARCÃÆÃÂA", "localidad": null, "sports": ["Porrismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MILTON ACERO GARCÃÆÃÂA. Deporte(s): Porrismo. Resolución R-D Nº 009. Vigente hasta 2028-01-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('73505483112054877', phone),
      email       = COALESCE('miltonmasters@hotmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "009", "resolucion_actualizacion": null, "fecha_inicio": "23-01-2023", "fecha_fin": "2028-01-23", "presidente": "MILTON ACERO GARCÃÆÃÂA", "localidad": null, "sports": ["Porrismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bca-all-stars-009';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- SUPERNOVA  (IDRD-CLUB-supernova-224)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-supernova-224';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SUPERNOVA',
      'Presidente: RONALD INFANTE CHISABA. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 224. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '71616253007970511',
      'gerente.supernova@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'supernova-224',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-supernova-224', v_school_id, '{"resolucion_rd": "224", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "RONALD INFANTE CHISABA", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RONALD INFANTE CHISABA. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 224. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('71616253007970511', phone),
      email       = COALESCE('gerente.supernova@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "224", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "RONALD INFANTE CHISABA", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-supernova-224';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '71616253007970511', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COM.BOGOTA F.C  (IDRD-CLUB-combogota-fc-1429)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-combogota-fc-1429';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COM.BOGOTA F.C',
      'Presidente: CÃÆÃ¢â¬Â°SAR AUGUSTO FIERRO BUITRAGO. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1429. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3055687656',
      'com.bogotafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'combogota-fc-1429',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-combogota-fc-1429', v_school_id, '{"resolucion_rd": "1429", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "CÃÆÃ¢â¬Â°SAR AUGUSTO FIERRO BUITRAGO", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CÃÆÃ¢â¬Â°SAR AUGUSTO FIERRO BUITRAGO. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1429. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3055687656', phone),
      email       = COALESCE('com.bogotafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1429", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "CÃÆÃ¢â¬Â°SAR AUGUSTO FIERRO BUITRAGO", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-combogota-fc-1429';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3055687656', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BOGOTÃÂ SUP  (IDRD-CLUB-bogotaa-sup-335)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bogotaa-sup-335';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOGOTÃÂ SUP',
      'Presidente: OSCAR ERNESTO MELENDEZ GONZALEZ. Deporte(s): Surf. Localidad: Barrios Unidos. Resolución R-D Nº 335. Vigente hasta 2028-04-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3154877098',
      'bogotasupclub@gmail.com',
      ARRAY['Surf']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bogotaa-sup-335',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bogotaa-sup-335', v_school_id, '{"resolucion_rd": "335", "resolucion_actualizacion": null, "fecha_inicio": "17-04-2023", "fecha_fin": "2028-04-16", "presidente": "OSCAR ERNESTO MELENDEZ GONZALEZ", "localidad": "Barrios Unidos", "sports": ["Surf"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR ERNESTO MELENDEZ GONZALEZ. Deporte(s): Surf. Localidad: Barrios Unidos. Resolución R-D Nº 335. Vigente hasta 2028-04-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3154877098', phone),
      email       = COALESCE('bogotasupclub@gmail.com', email),
      sports      = ARRAY['Surf']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "335", "resolucion_actualizacion": null, "fecha_inicio": "17-04-2023", "fecha_fin": "2028-04-16", "presidente": "OSCAR ERNESTO MELENDEZ GONZALEZ", "localidad": "Barrios Unidos", "sports": ["Surf"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bogotaa-sup-335';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3154877098', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ENERGY CHEER ALL STAR  (IDRD-CLUB-energy-cheer-all-star-110)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-energy-cheer-all-star-110';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ENERGY CHEER ALL STAR',
      'Presidente: JOSE BERNARDO VASQUEZ CASTRO. Deporte(s): Porrismo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 110. Vigente hasta 2028-02-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3138358420',
      'energycheerallstar@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'energy-cheer-all-star-110',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-energy-cheer-all-star-110', v_school_id, '{"resolucion_rd": "110", "resolucion_actualizacion": null, "fecha_inicio": "20-02-2023", "fecha_fin": "2028-02-20", "presidente": "JOSE BERNARDO VASQUEZ CASTRO", "localidad": "Rafael Uribe Uribe", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE BERNARDO VASQUEZ CASTRO. Deporte(s): Porrismo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 110. Vigente hasta 2028-02-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138358420', phone),
      email       = COALESCE('energycheerallstar@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "110", "resolucion_actualizacion": null, "fecha_inicio": "20-02-2023", "fecha_fin": "2028-02-20", "presidente": "JOSE BERNARDO VASQUEZ CASTRO", "localidad": "Rafael Uribe Uribe", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-energy-cheer-all-star-110';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3138358420', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LUCERO AZUL F.S  (IDRD-CLUB-lucero-azul-fs-818)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-lucero-azul-fs-818';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LUCERO AZUL F.S',
      'Presidente: LUIS ANTONIO MACHUCA. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 818. Vigente hasta 2028-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3203873543',
      'clubdeluceroazulfs@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'lucero-azul-fs-818',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-lucero-azul-fs-818', v_school_id, '{"resolucion_rd": "818", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2023", "fecha_fin": "2028-07-25", "presidente": "LUIS ANTONIO MACHUCA", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ANTONIO MACHUCA. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 818. Vigente hasta 2028-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203873543', phone),
      email       = COALESCE('clubdeluceroazulfs@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "818", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2023", "fecha_fin": "2028-07-25", "presidente": "LUIS ANTONIO MACHUCA", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-lucero-azul-fs-818';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3203873543', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOC-CLAN FC  (IDRD-CLUB-soc-clan-fc-057)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-soc-clan-fc-057';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOC-CLAN FC',
      'Presidente: GIOVANNY ANDRES GONZALEZ CORREA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 057. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3178864420',
      'escueladefutbolsocclan@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'soc-clan-fc-057',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-soc-clan-fc-057', v_school_id, '{"resolucion_rd": "057", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "GIOVANNY ANDRES GONZALEZ CORREA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GIOVANNY ANDRES GONZALEZ CORREA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 057. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3178864420', phone),
      email       = COALESCE('escueladefutbolsocclan@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "057", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "GIOVANNY ANDRES GONZALEZ CORREA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-soc-clan-fc-057';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3178864420', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA ROMA FUTBOL POPULAR FUTBOL CONSCIENTE  (IDRD-CLUB-club-deportivo-la-roma-futbol-popular-fu-594)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-roma-futbol-popular-fu-594';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA ROMA FUTBOL POPULAR FUTBOL CONSCIENTE',
      'Presidente: SEBASTIAN COVALEDA SARMIENTO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 594. Vigente hasta 2029-09-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3132615898',
      'clubdeportivolaroma@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-roma-futbol-popular-fu-594',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-roma-futbol-popular-fu-594', v_school_id, '{"resolucion_rd": "594", "resolucion_actualizacion": null, "fecha_inicio": "18-09-2024", "fecha_fin": "2029-09-18", "presidente": "SEBASTIAN COVALEDA SARMIENTO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SEBASTIAN COVALEDA SARMIENTO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 594. Vigente hasta 2029-09-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132615898', phone),
      email       = COALESCE('clubdeportivolaroma@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "594", "resolucion_actualizacion": null, "fecha_inicio": "18-09-2024", "fecha_fin": "2029-09-18", "presidente": "SEBASTIAN COVALEDA SARMIENTO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-roma-futbol-popular-fu-594';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3132615898', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GOLD FRIENDS LINE  (IDRD-CLUB-gold-friends-line-1850)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gold-friends-line-1850';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GOLD FRIENDS LINE',
      'Presidente: NELSON ENRIQUE ALFONSO LEÃâN. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1850. Vigente hasta 2028-01-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3172478060',
      'goldfriendsline08@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gold-friends-line-1850',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gold-friends-line-1850', v_school_id, '{"resolucion_rd": "1850", "resolucion_actualizacion": null, "fecha_inicio": "10-01-2023", "fecha_fin": "2028-01-10", "presidente": "NELSON ENRIQUE ALFONSO LEÃâN", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NELSON ENRIQUE ALFONSO LEÃâN. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1850. Vigente hasta 2028-01-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3172478060', phone),
      email       = COALESCE('goldfriendsline08@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1850", "resolucion_actualizacion": null, "fecha_inicio": "10-01-2023", "fecha_fin": "2028-01-10", "presidente": "NELSON ENRIQUE ALFONSO LEÃâN", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gold-friends-line-1850';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3172478060', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CHAMPIONÃÂ´S  (IDRD-CLUB-championaa-s-468)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-championaa-s-468';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CHAMPIONÃÂ´S',
      'Presidente: FREDDY ALBERTO HERNANDEZ PAEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 468. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3118513007',
      'clubdeportivochampions@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'championaa-s-468',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-championaa-s-468', v_school_id, '{"resolucion_rd": "468", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "FREDDY ALBERTO HERNANDEZ PAEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDDY ALBERTO HERNANDEZ PAEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 468. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118513007', phone),
      email       = COALESCE('clubdeportivochampions@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "468", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "FREDDY ALBERTO HERNANDEZ PAEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-championaa-s-468';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3118513007', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TAEKWONDO RYONG TAE DOJANG  (IDRD-CLUB-de-taekwondo-ryong-tae-dojang-639)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-taekwondo-ryong-tae-dojang-639';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TAEKWONDO RYONG TAE DOJANG',
      'Presidente: FABIOLA MENESES JIMENEZ. Deporte(s): Taekwondo. Localidad: Usaquén. Resolución R-D Nº 639. Vigente hasta 2028-06-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3184660894',
      'ryongtaedojang@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-taekwondo-ryong-tae-dojang-639',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-taekwondo-ryong-tae-dojang-639', v_school_id, '{"resolucion_rd": "639", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2023", "fecha_fin": "2028-06-18", "presidente": "FABIOLA MENESES JIMENEZ", "localidad": "Usaquén", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIOLA MENESES JIMENEZ. Deporte(s): Taekwondo. Localidad: Usaquén. Resolución R-D Nº 639. Vigente hasta 2028-06-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3184660894', phone),
      email       = COALESCE('ryongtaedojang@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "639", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2023", "fecha_fin": "2028-06-18", "presidente": "FABIOLA MENESES JIMENEZ", "localidad": "Usaquén", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-taekwondo-ryong-tae-dojang-639';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3184660894', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SONS SOCCER  (IDRD-CLUB-sons-soccer-013)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sons-soccer-013';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SONS SOCCER',
      'Presidente: ALEJANDRO CAMACHO ALVAREZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 013. Vigente hasta 2028-01-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '321606563',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sons-soccer-013',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sons-soccer-013', v_school_id, '{"resolucion_rd": "013", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2023", "fecha_fin": "2028-01-24", "presidente": "ALEJANDRO CAMACHO ALVAREZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEJANDRO CAMACHO ALVAREZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 013. Vigente hasta 2028-01-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('321606563', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "013", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2023", "fecha_fin": "2028-01-24", "presidente": "ALEJANDRO CAMACHO ALVAREZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sons-soccer-013';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '321606563', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA PAZ FÃÆÃ Â¡TBOL CLUB  (IDRD-CLUB-la-paz-faa-atbol-club-1025)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-paz-faa-atbol-club-1025';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA PAZ FÃÆÃ Â¡TBOL CLUB',
      'Presidente: SANDRA PATRICIA MORA ORTIZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1025. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3228583636',
      'clubdeportivolapazfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-paz-faa-atbol-club-1025',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-paz-faa-atbol-club-1025', v_school_id, '{"resolucion_rd": "1025", "resolucion_actualizacion": null, "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "SANDRA PATRICIA MORA ORTIZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA PATRICIA MORA ORTIZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1025. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3228583636', phone),
      email       = COALESCE('clubdeportivolapazfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1025", "resolucion_actualizacion": null, "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "SANDRA PATRICIA MORA ORTIZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-paz-faa-atbol-club-1025';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3228583636', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MONARKAS S.H.  (IDRD-CLUB-monarkas-sh-141)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-monarkas-sh-141';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MONARKAS S.H.',
      'Presidente: LISBEL MEDINA BELTRÃÂN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 141. Vigente hasta 2028-02-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3138509585',
      'migelitohans@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'monarkas-sh-141',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-monarkas-sh-141', v_school_id, '{"resolucion_rd": "141", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2023", "fecha_fin": "2028-02-24", "presidente": "LISBEL MEDINA BELTRÃÂN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LISBEL MEDINA BELTRÃÂN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 141. Vigente hasta 2028-02-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138509585', phone),
      email       = COALESCE('migelitohans@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "141", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2023", "fecha_fin": "2028-02-24", "presidente": "LISBEL MEDINA BELTRÃÂN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-monarkas-sh-141';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3138509585', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA JUGADA F.T  (IDRD-CLUB-la-jugada-ft-588)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-jugada-ft-588';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA JUGADA F.T',
      'Presidente: CELSO GABRIEL RUGE VILLAMIZAR. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 588. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '76464773165738809',
      'lajugadafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-jugada-ft-588',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-jugada-ft-588', v_school_id, '{"resolucion_rd": "588", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "CELSO GABRIEL RUGE VILLAMIZAR", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CELSO GABRIEL RUGE VILLAMIZAR. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 588. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('76464773165738809', phone),
      email       = COALESCE('lajugadafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "588", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "CELSO GABRIEL RUGE VILLAMIZAR", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-jugada-ft-588';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '76464773165738809', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MAMOOTS  (IDRD-CLUB-mamoots-133)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-mamoots-133';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MAMOOTS',
      'Presidente: SERGIO RICARDO RODRIGUEZ ACOSTA. Deporte(s): Ultimate. Localidad: Chapinero. Resolución R-D Nº 133. Vigente hasta 2028-02-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3123886865',
      NULL,
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'mamoots-133',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-mamoots-133', v_school_id, '{"resolucion_rd": "133", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2023", "fecha_fin": "2028-02-23", "presidente": "SERGIO RICARDO RODRIGUEZ ACOSTA", "localidad": "Chapinero", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SERGIO RICARDO RODRIGUEZ ACOSTA. Deporte(s): Ultimate. Localidad: Chapinero. Resolución R-D Nº 133. Vigente hasta 2028-02-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123886865', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "133", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2023", "fecha_fin": "2028-02-23", "presidente": "SERGIO RICARDO RODRIGUEZ ACOSTA", "localidad": "Chapinero", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-mamoots-133';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3123886865', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MAILOV FS  (IDRD-CLUB-club-deportivo-mailov-fs-983)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-mailov-fs-983';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MAILOV FS',
      'Presidente: SEBASTIAN CAMILO ACUÃA BARRAGAN. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 983. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '79224693003118199',
      'cdmailovfutsal@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-mailov-fs-983',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-mailov-fs-983', v_school_id, '{"resolucion_rd": "983", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "SEBASTIAN CAMILO ACUÃA BARRAGAN", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SEBASTIAN CAMILO ACUÃA BARRAGAN. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 983. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('79224693003118199', phone),
      email       = COALESCE('cdmailovfutsal@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "983", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "SEBASTIAN CAMILO ACUÃA BARRAGAN", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-mailov-fs-983';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '79224693003118199', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ACADEMIA REAL  (IDRD-CLUB-academia-real-987)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-academia-real-987';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ACADEMIA REAL',
      'Presidente: MANUEL ALEJANDRO ARANGUREN QUECANO. Localidad: Suba. Resolución R-D Nº 987. Vigente hasta 2028-08-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '67912533202433366',
      NULL,
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'academia-real-987',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-academia-real-987', v_school_id, '{"resolucion_rd": "987", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2023", "fecha_fin": "2028-08-29", "presidente": "MANUEL ALEJANDRO ARANGUREN QUECANO", "localidad": "Suba", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL ALEJANDRO ARANGUREN QUECANO. Localidad: Suba. Resolución R-D Nº 987. Vigente hasta 2028-08-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('67912533202433366', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "987", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2023", "fecha_fin": "2028-08-29", "presidente": "MANUEL ALEJANDRO ARANGUREN QUECANO", "localidad": "Suba", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-academia-real-987';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '67912533202433366', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JAZMIN F.C  (IDRD-CLUB-jazmin-fc-406)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jazmin-fc-406';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JAZMIN F.C',
      'Presidente: EDISSON HELVER MEDINA ROZO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 406. Vigente hasta 2028-05-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3209451294',
      'jazminf.c@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jazmin-fc-406',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jazmin-fc-406', v_school_id, '{"resolucion_rd": "406", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2023", "fecha_fin": "2028-05-03", "presidente": "EDISSON HELVER MEDINA ROZO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDISSON HELVER MEDINA ROZO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 406. Vigente hasta 2028-05-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209451294', phone),
      email       = COALESCE('jazminf.c@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "406", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2023", "fecha_fin": "2028-05-03", "presidente": "EDISSON HELVER MEDINA ROZO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jazmin-fc-406';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3209451294', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL PRIMAVERA  (IDRD-CLUB-real-primavera-964)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-primavera-964';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL PRIMAVERA',
      'Presidente: CRISTIAN EDUARDO BALLESTEROS VENTERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 964. Vigente hasta 2028-08-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3000615',
      'cd.realprimavera@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-primavera-964',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-primavera-964', v_school_id, '{"resolucion_rd": "964", "resolucion_actualizacion": null, "fecha_inicio": "24-08-2023", "fecha_fin": "2028-08-23", "presidente": "CRISTIAN EDUARDO BALLESTEROS VENTERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN EDUARDO BALLESTEROS VENTERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 964. Vigente hasta 2028-08-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3000615', phone),
      email       = COALESCE('cd.realprimavera@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "964", "resolucion_actualizacion": null, "fecha_inicio": "24-08-2023", "fecha_fin": "2028-08-23", "presidente": "CRISTIAN EDUARDO BALLESTEROS VENTERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-primavera-964';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3000615', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOBOS ALL STAR  (IDRD-CLUB-club-deportivo-lobos-all-star-965)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lobos-all-star-965';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOBOS ALL STAR',
      'Presidente: JHEYSON ANDRES ROCHA LIEVANO. Deporte(s): Porrismo. Localidad: San Cristóbal. Resolución R-D Nº 965. Vigente hasta 2029-07-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3215241110',
      'lobosallstar@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lobos-all-star-965',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lobos-all-star-965', v_school_id, '{"resolucion_rd": "965", "resolucion_actualizacion": null, "fecha_inicio": "23-07-2024", "fecha_fin": "2029-07-23", "presidente": "JHEYSON ANDRES ROCHA LIEVANO", "localidad": "San Cristóbal", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHEYSON ANDRES ROCHA LIEVANO. Deporte(s): Porrismo. Localidad: San Cristóbal. Resolución R-D Nº 965. Vigente hasta 2029-07-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3215241110', phone),
      email       = COALESCE('lobosallstar@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "965", "resolucion_actualizacion": null, "fecha_inicio": "23-07-2024", "fecha_fin": "2029-07-23", "presidente": "JHEYSON ANDRES ROCHA LIEVANO", "localidad": "San Cristóbal", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lobos-all-star-965';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3215241110', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DIAMOND TEAM  (IDRD-CLUB-diamond-team-381)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-diamond-team-381';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DIAMOND TEAM',
      'Presidente: YAMILE RUBIO RODRIGUEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 381. Vigente hasta 2028-04-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3112544116',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'diamond-team-381',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-diamond-team-381', v_school_id, '{"resolucion_rd": "381", "resolucion_actualizacion": null, "fecha_inicio": "01-05-2023", "fecha_fin": "2028-04-30", "presidente": "YAMILE RUBIO RODRIGUEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YAMILE RUBIO RODRIGUEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 381. Vigente hasta 2028-04-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112544116', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "381", "resolucion_actualizacion": null, "fecha_inicio": "01-05-2023", "fecha_fin": "2028-04-30", "presidente": "YAMILE RUBIO RODRIGUEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-diamond-team-381';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3112544116', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NEW WAY TENIS  (IDRD-CLUB-new-way-tenis-825)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-new-way-tenis-825';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NEW WAY TENIS',
      'Presidente: CARLOS ANDRÃâ°S ALGARRA FERNÃÂNDEZ. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 825. Vigente hasta 2028-07-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3202734650',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'new-way-tenis-825',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-new-way-tenis-825', v_school_id, '{"resolucion_rd": "825", "resolucion_actualizacion": null, "fecha_inicio": "28-07-2023", "fecha_fin": "2028-07-27", "presidente": "CARLOS ANDRÃâ°S ALGARRA FERNÃÂNDEZ", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRÃâ°S ALGARRA FERNÃÂNDEZ. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 825. Vigente hasta 2028-07-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202734650', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "825", "resolucion_actualizacion": null, "fecha_inicio": "28-07-2023", "fecha_fin": "2028-07-27", "presidente": "CARLOS ANDRÃâ°S ALGARRA FERNÃÂNDEZ", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-new-way-tenis-825';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3202734650', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NATIONAL POWER CHEER  (IDRD-CLUB-national-power-cheer-1097)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-national-power-cheer-1097';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NATIONAL POWER CHEER',
      'Presidente: DAVID JULIAN LAMPREA VARGAS. Deporte(s): Porrismo. Localidad: Engativá. Resolución R-D Nº 1097. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3204797919',
      NULL,
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'national-power-cheer-1097',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-national-power-cheer-1097', v_school_id, '{"resolucion_rd": "1097", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "DAVID JULIAN LAMPREA VARGAS", "localidad": "Engativá", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID JULIAN LAMPREA VARGAS. Deporte(s): Porrismo. Localidad: Engativá. Resolución R-D Nº 1097. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204797919', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1097", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "DAVID JULIAN LAMPREA VARGAS", "localidad": "Engativá", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-national-power-cheer-1097';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3204797919', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MACHINE FUTBOL CLUB  (IDRD-CLUB-machine-futbol-club-156)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-machine-futbol-club-156';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MACHINE FUTBOL CLUB',
      'Presidente: HARVEY ANTONIO BERMUDEZ MOLINA. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 156. Vigente hasta 2028-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '71706173102376319',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'machine-futbol-club-156',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-machine-futbol-club-156', v_school_id, '{"resolucion_rd": "156", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2023", "fecha_fin": "2028-02-27", "presidente": "HARVEY ANTONIO BERMUDEZ MOLINA", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HARVEY ANTONIO BERMUDEZ MOLINA. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 156. Vigente hasta 2028-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('71706173102376319', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "156", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2023", "fecha_fin": "2028-02-27", "presidente": "HARVEY ANTONIO BERMUDEZ MOLINA", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-machine-futbol-club-156';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '71706173102376319', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GUERREROS DE COLOMBIA F.C  (IDRD-CLUB-club-deportivo-guerreros-de-colombia-fc-23)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-guerreros-de-colombia-fc-23';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GUERREROS DE COLOMBIA F.C',
      'Presidente: JONATHAN ALEXANDER GALVEZ GARZON. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 23. Vigente hasta 2029-01-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '69494153213819335',
      'fcguerrerosdecolombia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-guerreros-de-colombia-fc-23',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-guerreros-de-colombia-fc-23', v_school_id, '{"resolucion_rd": "23", "resolucion_actualizacion": null, "fecha_inicio": "26-01-2024", "fecha_fin": "2029-01-25", "presidente": "JONATHAN ALEXANDER GALVEZ GARZON", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JONATHAN ALEXANDER GALVEZ GARZON. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 23. Vigente hasta 2029-01-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('69494153213819335', phone),
      email       = COALESCE('fcguerrerosdecolombia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "23", "resolucion_actualizacion": null, "fecha_inicio": "26-01-2024", "fecha_fin": "2029-01-25", "presidente": "JONATHAN ALEXANDER GALVEZ GARZON", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-guerreros-de-colombia-fc-23';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '69494153213819335', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VDS DANZA INCLUYENTE  (IDRD-CLUB-vds-danza-incluyente-434)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-vds-danza-incluyente-434';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VDS DANZA INCLUYENTE',
      'Presidente: LINA MARCELA CABRA SOTO. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 434. Vigente hasta 2028-05-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3112544116',
      'fundaciondiamondteam@hotmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'vds-danza-incluyente-434',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-vds-danza-incluyente-434', v_school_id, '{"resolucion_rd": "434", "resolucion_actualizacion": null, "fecha_inicio": "11-05-2023", "fecha_fin": "2028-05-10", "presidente": "LINA MARCELA CABRA SOTO", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LINA MARCELA CABRA SOTO. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 434. Vigente hasta 2028-05-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112544116', phone),
      email       = COALESCE('fundaciondiamondteam@hotmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "434", "resolucion_actualizacion": null, "fecha_inicio": "11-05-2023", "fecha_fin": "2028-05-10", "presidente": "LINA MARCELA CABRA SOTO", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-vds-danza-incluyente-434';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3112544116', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ARNOLDO IGUARAN F.C.  (IDRD-CLUB-arnoldo-iguaran-fc-289)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-arnoldo-iguaran-fc-289';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ARNOLDO IGUARAN F.C.',
      'Presidente: ARNOLDO ALBERTO IGUARAN ZUÃâIGA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 289. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '7166513',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'arnoldo-iguaran-fc-289',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-arnoldo-iguaran-fc-289', v_school_id, '{"resolucion_rd": "289", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "ARNOLDO ALBERTO IGUARAN ZUÃâIGA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ARNOLDO ALBERTO IGUARAN ZUÃâIGA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 289. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7166513', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "289", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "ARNOLDO ALBERTO IGUARAN ZUÃâIGA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-arnoldo-iguaran-fc-289';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '7166513', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KINDORA F.C.  (IDRD-CLUB-kindora-fc-509)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kindora-fc-509';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KINDORA F.C.',
      'Presidente: FRANKLIN HELMAN FAJARDO RIVERA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 509. Vigente hasta 2028-05-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '46467223118308072',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kindora-fc-509',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kindora-fc-509', v_school_id, '{"resolucion_rd": "509", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2023", "fecha_fin": "2028-05-23", "presidente": "FRANKLIN HELMAN FAJARDO RIVERA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FRANKLIN HELMAN FAJARDO RIVERA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 509. Vigente hasta 2028-05-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('46467223118308072', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "509", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2023", "fecha_fin": "2028-05-23", "presidente": "FRANKLIN HELMAN FAJARDO RIVERA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kindora-fc-509';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '46467223118308072', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BACKSWING TENNIS CLUB  (IDRD-CLUB-backswing-tennis-club-443)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-backswing-tennis-club-443';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BACKSWING TENNIS CLUB',
      'Presidente: JEYSON SNIDER MOLINA OCHOA. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 443. Vigente hasta 2028-05-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3144135933',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'backswing-tennis-club-443',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-backswing-tennis-club-443', v_school_id, '{"resolucion_rd": "443", "resolucion_actualizacion": null, "fecha_inicio": "16-05-2023", "fecha_fin": "2028-05-15", "presidente": "JEYSON SNIDER MOLINA OCHOA", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEYSON SNIDER MOLINA OCHOA. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 443. Vigente hasta 2028-05-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144135933', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "443", "resolucion_actualizacion": null, "fecha_inicio": "16-05-2023", "fecha_fin": "2028-05-15", "presidente": "JEYSON SNIDER MOLINA OCHOA", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-backswing-tennis-club-443';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3144135933', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CAMPEONES TENIS CLUB  (IDRD-CLUB-club-deportivo-campeones-tenis-club-1200)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-campeones-tenis-club-1200';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CAMPEONES TENIS CLUB',
      'Presidente: JOSÃ ALFREDO SALAMANCA GALINDO. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 1200. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '4978595',
      'campeonestenis@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-campeones-tenis-club-1200',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-campeones-tenis-club-1200', v_school_id, '{"resolucion_rd": "1200", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "JOSÃ ALFREDO SALAMANCA GALINDO", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ ALFREDO SALAMANCA GALINDO. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 1200. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4978595', phone),
      email       = COALESCE('campeonestenis@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1200", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "JOSÃ ALFREDO SALAMANCA GALINDO", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-campeones-tenis-club-1200';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '4978595', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TIGRES BOLO 0CLUB  (IDRD-CLUB-tigres-bolo-0club-221)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tigres-bolo-0club-221';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TIGRES BOLO 0CLUB',
      'Presidente: VICTOR MANUEL REITA FONSECA. Deporte(s): Bowling. Localidad: Chapinero. Resolución R-D Nº 221 / actualización Nº 220. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '61713902500400',
      NULL,
      ARRAY['Bowling']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tigres-bolo-0club-221',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tigres-bolo-0club-221', v_school_id, '{"resolucion_rd": "221", "resolucion_actualizacion": "220", "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "VICTOR MANUEL REITA FONSECA", "localidad": "Chapinero", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR MANUEL REITA FONSECA. Deporte(s): Bowling. Localidad: Chapinero. Resolución R-D Nº 221 / actualización Nº 220. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('61713902500400', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Bowling']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "221", "resolucion_actualizacion": "220", "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "VICTOR MANUEL REITA FONSECA", "localidad": "Chapinero", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tigres-bolo-0club-221';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '61713902500400', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CERROS TUTELARES DE BOGOTÃÂ  (IDRD-CLUB-cerros-tutelares-de-bogotaa-682)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cerros-tutelares-de-bogotaa-682';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CERROS TUTELARES DE BOGOTÃÂ',
      'Presidente: FREDDY MILLER AMAZO VELASCO. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 682. Vigente hasta 2028-06-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3922293103',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cerros-tutelares-de-bogotaa-682',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cerros-tutelares-de-bogotaa-682', v_school_id, '{"resolucion_rd": "682", "resolucion_actualizacion": null, "fecha_inicio": "27-06-2023", "fecha_fin": "2028-06-26", "presidente": "FREDDY MILLER AMAZO VELASCO", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDDY MILLER AMAZO VELASCO. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 682. Vigente hasta 2028-06-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3922293103', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "682", "resolucion_actualizacion": null, "fecha_inicio": "27-06-2023", "fecha_fin": "2028-06-26", "presidente": "FREDDY MILLER AMAZO VELASCO", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cerros-tutelares-de-bogotaa-682';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3922293103', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LIFEVOLLEY  (IDRD-CLUB-lifevolley-1149)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-lifevolley-1149';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LIFEVOLLEY',
      'Presidente: ANDRES RICARDO CORDOBA ORJUELA. Deporte(s): Voleibol. Localidad: Puente Aranda. Resolución R-D Nº 1149. Vigente hasta 2028-09-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3202598977',
      NULL,
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'lifevolley-1149',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-lifevolley-1149', v_school_id, '{"resolucion_rd": "1149", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2023", "fecha_fin": "2028-09-26", "presidente": "ANDRES RICARDO CORDOBA ORJUELA", "localidad": "Puente Aranda", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES RICARDO CORDOBA ORJUELA. Deporte(s): Voleibol. Localidad: Puente Aranda. Resolución R-D Nº 1149. Vigente hasta 2028-09-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202598977', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1149", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2023", "fecha_fin": "2028-09-26", "presidente": "ANDRES RICARDO CORDOBA ORJUELA", "localidad": "Puente Aranda", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-lifevolley-1149';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3202598977', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FÃÅ¡TBOL CLUB DEPORTIVO INTERNACIONAL  (IDRD-CLUB-faatbol-club-deportivo-internacional-683)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-faatbol-club-deportivo-internacional-683';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FÃÅ¡TBOL CLUB DEPORTIVO INTERNACIONAL',
      'Presidente: EDINSON DARIO RUIZ GÃâMEZ. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 683. Vigente hasta 2028-06-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3103377218',
      'clubcerrostutelares@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'faatbol-club-deportivo-internacional-683',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-faatbol-club-deportivo-internacional-683', v_school_id, '{"resolucion_rd": "683", "resolucion_actualizacion": null, "fecha_inicio": "27-06-2023", "fecha_fin": "2028-06-26", "presidente": "EDINSON DARIO RUIZ GÃâMEZ", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDINSON DARIO RUIZ GÃâMEZ. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 683. Vigente hasta 2028-06-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103377218', phone),
      email       = COALESCE('clubcerrostutelares@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "683", "resolucion_actualizacion": null, "fecha_inicio": "27-06-2023", "fecha_fin": "2028-06-26", "presidente": "EDINSON DARIO RUIZ GÃâMEZ", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-faatbol-club-deportivo-internacional-683';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3103377218', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BOGOTÃÂ SPRINTER  (IDRD-CLUB-bogotaa-sprinter-180)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bogotaa-sprinter-180';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOGOTÃÂ SPRINTER',
      'Presidente: BLANCA LILIANA MORENO CANCHON. Deporte(s): Canotaje. Localidad: Teusaquillo. Resolución R-D Nº 180. Vigente hasta 2028-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3114452022',
      'bogotasprinter@gmail.com',
      ARRAY['Canotaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bogotaa-sprinter-180',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bogotaa-sprinter-180', v_school_id, '{"resolucion_rd": "180", "resolucion_actualizacion": null, "fecha_inicio": "03-03-2023", "fecha_fin": "2028-03-02", "presidente": "BLANCA LILIANA MORENO CANCHON", "localidad": "Teusaquillo", "sports": ["Canotaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BLANCA LILIANA MORENO CANCHON. Deporte(s): Canotaje. Localidad: Teusaquillo. Resolución R-D Nº 180. Vigente hasta 2028-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114452022', phone),
      email       = COALESCE('bogotasprinter@gmail.com', email),
      sports      = ARRAY['Canotaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "180", "resolucion_actualizacion": null, "fecha_inicio": "03-03-2023", "fecha_fin": "2028-03-02", "presidente": "BLANCA LILIANA MORENO CANCHON", "localidad": "Teusaquillo", "sports": ["Canotaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bogotaa-sprinter-180';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3114452022', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE KARATE -DO ACUEDUCTO  (IDRD-CLUB-de-karate--do-acueducto-889)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-karate--do-acueducto-889';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE KARATE -DO ACUEDUCTO',
      'Presidente: SAEL GAMBOA RODRÃGUEZ. Deporte(s): Karate. Localidad: Puente Aranda. Resolución R-D Nº 889 / actualización Nº 1610. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3158431956',
      NULL,
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-karate--do-acueducto-889',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-karate--do-acueducto-889', v_school_id, '{"resolucion_rd": "889", "resolucion_actualizacion": "1610", "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "SAEL GAMBOA RODRÃGUEZ", "localidad": "Puente Aranda", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SAEL GAMBOA RODRÃGUEZ. Deporte(s): Karate. Localidad: Puente Aranda. Resolución R-D Nº 889 / actualización Nº 1610. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158431956', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "889", "resolucion_actualizacion": "1610", "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "SAEL GAMBOA RODRÃGUEZ", "localidad": "Puente Aranda", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-karate--do-acueducto-889';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3158431956', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE ARTES MARCIALES NÃN YUÃN HAPKIDO  (IDRD-CLUB-club-deportivo-de-artes-marciales-nan-yu-1134)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-artes-marciales-nan-yu-1134';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE ARTES MARCIALES NÃN YUÃN HAPKIDO',
      'Presidente: LUPE JOHANNA GONZALEZ TORRES. Deporte(s): Hapkido. Localidad: Bosa. Resolución R-D Nº 1134. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3142259769',
      'clubnanyuan@gmail.com',
      ARRAY['Hapkido']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-artes-marciales-nan-yu-1134',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-artes-marciales-nan-yu-1134', v_school_id, '{"resolucion_rd": "1134", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "LUPE JOHANNA GONZALEZ TORRES", "localidad": "Bosa", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUPE JOHANNA GONZALEZ TORRES. Deporte(s): Hapkido. Localidad: Bosa. Resolución R-D Nº 1134. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142259769', phone),
      email       = COALESCE('clubnanyuan@gmail.com', email),
      sports      = ARRAY['Hapkido']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1134", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "LUPE JOHANNA GONZALEZ TORRES", "localidad": "Bosa", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-artes-marciales-nan-yu-1134';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3142259769', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SKATE DOCK  (IDRD-CLUB-club-deportivo-skate-dock-320)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-skate-dock-320';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SKATE DOCK',
      'Presidente: JORGE EDUARDO PERÃâ°Z AGUDELO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 320. Vigente hasta 2029-03-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3178512440',
      'paula.murillo06@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-skate-dock-320',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-skate-dock-320', v_school_id, '{"resolucion_rd": "320", "resolucion_actualizacion": null, "fecha_inicio": "19-03-2024", "fecha_fin": "2029-03-19", "presidente": "JORGE EDUARDO PERÃâ°Z AGUDELO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE EDUARDO PERÃâ°Z AGUDELO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 320. Vigente hasta 2029-03-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3178512440', phone),
      email       = COALESCE('paula.murillo06@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "320", "resolucion_actualizacion": null, "fecha_inicio": "19-03-2024", "fecha_fin": "2029-03-19", "presidente": "JORGE EDUARDO PERÃâ°Z AGUDELO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-skate-dock-320';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3178512440', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE AJEDREZ ALPHA ZERO  (IDRD-CLUB-de-ajedrez-alpha-zero-175)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-ajedrez-alpha-zero-175';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE AJEDREZ ALPHA ZERO',
      'Presidente: CARLOS ARTURO RANGEL COLLAZOS. Deporte(s): Ajedrez. Localidad: Suba. Resolución R-D Nº 175. Vigente hasta 2028-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '72284803103095064',
      NULL,
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-ajedrez-alpha-zero-175',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-ajedrez-alpha-zero-175', v_school_id, '{"resolucion_rd": "175", "resolucion_actualizacion": null, "fecha_inicio": "03-03-2023", "fecha_fin": "2028-03-02", "presidente": "CARLOS ARTURO RANGEL COLLAZOS", "localidad": "Suba", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO RANGEL COLLAZOS. Deporte(s): Ajedrez. Localidad: Suba. Resolución R-D Nº 175. Vigente hasta 2028-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('72284803103095064', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "175", "resolucion_actualizacion": null, "fecha_inicio": "03-03-2023", "fecha_fin": "2028-03-02", "presidente": "CARLOS ARTURO RANGEL COLLAZOS", "localidad": "Suba", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-ajedrez-alpha-zero-175';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '72284803103095064', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AC MUNDO  (IDRD-CLUB-club-deportivo-ac-mundo-1046)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ac-mundo-1046';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AC MUNDO',
      'Presidente: JHON ANDRES RODRIGUEZ NEUSA. Deporte(s): Fútbol, Tenis, Tenis de mesa, Natación, Patinaje, Baloncesto, Voleibol. Localidad: Engativá. Resolución R-D Nº 1046. Vigente hasta 2028-09-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '80489793112707961',
      NULL,
      ARRAY['Fútbol','Tenis','Tenis de mesa','Natación','Patinaje','Baloncesto','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ac-mundo-1046',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ac-mundo-1046', v_school_id, '{"resolucion_rd": "1046", "resolucion_actualizacion": null, "fecha_inicio": "08-09-2023", "fecha_fin": "2028-09-07", "presidente": "JHON ANDRES RODRIGUEZ NEUSA", "localidad": "Engativá", "sports": ["Fútbol", "Tenis", "Tenis de mesa", "Natación", "Patinaje", "Baloncesto", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON ANDRES RODRIGUEZ NEUSA. Deporte(s): Fútbol, Tenis, Tenis de mesa, Natación, Patinaje, Baloncesto, Voleibol. Localidad: Engativá. Resolución R-D Nº 1046. Vigente hasta 2028-09-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('80489793112707961', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol','Tenis','Tenis de mesa','Natación','Patinaje','Baloncesto','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1046", "resolucion_actualizacion": null, "fecha_inicio": "08-09-2023", "fecha_fin": "2028-09-07", "presidente": "JHON ANDRES RODRIGUEZ NEUSA", "localidad": "Engativá", "sports": ["Fútbol", "Tenis", "Tenis de mesa", "Natación", "Patinaje", "Baloncesto", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ac-mundo-1046';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '80489793112707961', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CORPORACIÃâN CLUB SOCIAL Y DEPORTIVO ECOPETROL BOGOTA  (IDRD-CLUB-corporaciaan-club-social-y-deportivo-eco-413)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-corporaciaan-club-social-y-deportivo-eco-413';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CORPORACIÃâN CLUB SOCIAL Y DEPORTIVO ECOPETROL BOGOTA',
      'Presidente: LYDA MILENA ZABALETA RAMIREZ. Deporte(s): Béisbol, Baloncesto, Fútbol, Softbol, Tenis, Tenis de mesa, Voleibol, Bowling, Atletismo, Ajedrez, Taekwondo. Localidad: Suba. Resolución R-D Nº 413 / actualización Nº 435. Vigente hasta 2028-05-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3102094465',
      NULL,
      ARRAY['Béisbol','Baloncesto','Fútbol','Softbol','Tenis','Tenis de mesa','Voleibol','Bowling','Atletismo','Ajedrez','Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'corporaciaan-club-social-y-deportivo-eco-413',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-corporaciaan-club-social-y-deportivo-eco-413', v_school_id, '{"resolucion_rd": "413", "resolucion_actualizacion": "435", "fecha_inicio": "09-05-2023", "fecha_fin": "2028-05-08", "presidente": "LYDA MILENA ZABALETA RAMIREZ", "localidad": "Suba", "sports": ["Béisbol", "Baloncesto", "Fútbol", "Softbol", "Tenis", "Tenis de mesa", "Voleibol", "Bowling", "Atletismo", "Ajedrez", "Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LYDA MILENA ZABALETA RAMIREZ. Deporte(s): Béisbol, Baloncesto, Fútbol, Softbol, Tenis, Tenis de mesa, Voleibol, Bowling, Atletismo, Ajedrez, Taekwondo. Localidad: Suba. Resolución R-D Nº 413 / actualización Nº 435. Vigente hasta 2028-05-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102094465', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Béisbol','Baloncesto','Fútbol','Softbol','Tenis','Tenis de mesa','Voleibol','Bowling','Atletismo','Ajedrez','Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "413", "resolucion_actualizacion": "435", "fecha_inicio": "09-05-2023", "fecha_fin": "2028-05-08", "presidente": "LYDA MILENA ZABALETA RAMIREZ", "localidad": "Suba", "sports": ["Béisbol", "Baloncesto", "Fútbol", "Softbol", "Tenis", "Tenis de mesa", "Voleibol", "Bowling", "Atletismo", "Ajedrez", "Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-corporaciaan-club-social-y-deportivo-eco-413';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3102094465', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SPIRIT ALL STAR  (IDRD-CLUB-spirit-all-star-760)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-spirit-all-star-760';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPIRIT ALL STAR',
      'Presidente: CESAR RODOLFO CALDERON CASTILLO. Deporte(s): Porrismo. Localidad: Engativá. Resolución R-D Nº 760. Vigente hasta 2028-07-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3108619166',
      'spiritcheer.bogota@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'spirit-all-star-760',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-spirit-all-star-760', v_school_id, '{"resolucion_rd": "760", "resolucion_actualizacion": null, "fecha_inicio": "13-07-2023", "fecha_fin": "2028-07-12", "presidente": "CESAR RODOLFO CALDERON CASTILLO", "localidad": "Engativá", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR RODOLFO CALDERON CASTILLO. Deporte(s): Porrismo. Localidad: Engativá. Resolución R-D Nº 760. Vigente hasta 2028-07-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108619166', phone),
      email       = COALESCE('spiritcheer.bogota@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "760", "resolucion_actualizacion": null, "fecha_inicio": "13-07-2023", "fecha_fin": "2028-07-12", "presidente": "CESAR RODOLFO CALDERON CASTILLO", "localidad": "Engativá", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-spirit-all-star-760';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3108619166', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- USME  (IDRD-CLUB-usme-768)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-usme-768';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'USME',
      'Presidente: MARLON ANDRES SARMIENTO ALCANTAR. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 768. Vigente hasta 2028-07-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3123205822',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'usme-768',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-usme-768', v_school_id, '{"resolucion_rd": "768", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2023", "fecha_fin": "2028-07-18", "presidente": "MARLON ANDRES SARMIENTO ALCANTAR", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARLON ANDRES SARMIENTO ALCANTAR. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 768. Vigente hasta 2028-07-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123205822', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "768", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2023", "fecha_fin": "2028-07-18", "presidente": "MARLON ANDRES SARMIENTO ALCANTAR", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-usme-768';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3123205822', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESBAR BOSQUE  (IDRD-CLUB-esbar-bosque-905)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-esbar-bosque-905';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESBAR BOSQUE',
      'Presidente: LILIANA MARCELA CORREDOR CASTILLO. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 905. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3102176220',
      'lmcc89p@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'esbar-bosque-905',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-esbar-bosque-905', v_school_id, '{"resolucion_rd": "905", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "LILIANA MARCELA CORREDOR CASTILLO", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LILIANA MARCELA CORREDOR CASTILLO. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 905. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102176220', phone),
      email       = COALESCE('lmcc89p@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "905", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "LILIANA MARCELA CORREDOR CASTILLO", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-esbar-bosque-905';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3102176220', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BORUSIA FP  (IDRD-CLUB-club-deportivo-borusia-fp-869)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-borusia-fp-869';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BORUSIA FP',
      'Presidente: ARGENIS TRUJILLO POVEDA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 869 / actualización Nº 869. Vigente hasta 2028-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3203428926',
      'borusia_f_p@yahoo.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-borusia-fp-869',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-borusia-fp-869', v_school_id, '{"resolucion_rd": "869", "resolucion_actualizacion": "869", "fecha_inicio": "26-07-2023", "fecha_fin": "2028-07-25", "presidente": "ARGENIS TRUJILLO POVEDA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ARGENIS TRUJILLO POVEDA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 869 / actualización Nº 869. Vigente hasta 2028-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203428926', phone),
      email       = COALESCE('borusia_f_p@yahoo.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "869", "resolucion_actualizacion": "869", "fecha_inicio": "26-07-2023", "fecha_fin": "2028-07-25", "presidente": "ARGENIS TRUJILLO POVEDA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-borusia-fp-869';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3203428926', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTRELLAS DE LOS ANDES FÃÅ¡TBOL CLUB  (IDRD-CLUB-estrellas-de-los-andes-faatbol-club-1087)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-estrellas-de-los-andes-faatbol-club-1087';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTRELLAS DE LOS ANDES FÃÅ¡TBOL CLUB',
      'Presidente: MONICA PAOLA MORALES VILLAMARIN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1087 / actualización Nº 1137. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3195407836',
      'clubestrellasdelosandes@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'estrellas-de-los-andes-faatbol-club-1087',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-estrellas-de-los-andes-faatbol-club-1087', v_school_id, '{"resolucion_rd": "1087", "resolucion_actualizacion": "1137", "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "MONICA PAOLA MORALES VILLAMARIN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MONICA PAOLA MORALES VILLAMARIN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1087 / actualización Nº 1137. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195407836', phone),
      email       = COALESCE('clubestrellasdelosandes@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1087", "resolucion_actualizacion": "1137", "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "MONICA PAOLA MORALES VILLAMARIN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-estrellas-de-los-andes-faatbol-club-1087';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3195407836', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUNDARVID  (IDRD-CLUB-fundarvid-1240)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fundarvid-1240';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUNDARVID',
      'Presidente: ALVARO JAVIER HERRÃÂN CARVAJAL. Deporte(s): Sordos, Baloncesto, Billar, Atletismo, Ciclismo, Esgrima, Natación, Levantamiento De Pesas, Tiro deportivo, Rugby, Tenis de mesa, Tenis, Voleibol, Triatlon. Localidad: Engativá. Resolución R-D Nº 1240. Vigente hasta 2028-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '2240138',
      'comunicacionesfundarvid@gmail.com',
      ARRAY['Sordos','Baloncesto','Billar','Atletismo','Ciclismo','Esgrima','Natación','Levantamiento De Pesas','Tiro deportivo','Rugby','Tenis de mesa','Tenis','Voleibol','Triatlon']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fundarvid-1240',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fundarvid-1240', v_school_id, '{"resolucion_rd": "1240", "resolucion_actualizacion": null, "fecha_inicio": "13-10-2023", "fecha_fin": "2028-10-12", "presidente": "ALVARO JAVIER HERRÃÂN CARVAJAL", "localidad": "Engativá", "sports": ["Sordos", "Baloncesto", "Billar", "Atletismo", "Ciclismo", "Esgrima", "Natación", "Levantamiento De Pesas", "Tiro deportivo", "Rugby", "Tenis de mesa", "Tenis", "Voleibol", "Triatlon"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALVARO JAVIER HERRÃÂN CARVAJAL. Deporte(s): Sordos, Baloncesto, Billar, Atletismo, Ciclismo, Esgrima, Natación, Levantamiento De Pesas, Tiro deportivo, Rugby, Tenis de mesa, Tenis, Voleibol, Triatlon. Localidad: Engativá. Resolución R-D Nº 1240. Vigente hasta 2028-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2240138', phone),
      email       = COALESCE('comunicacionesfundarvid@gmail.com', email),
      sports      = ARRAY['Sordos','Baloncesto','Billar','Atletismo','Ciclismo','Esgrima','Natación','Levantamiento De Pesas','Tiro deportivo','Rugby','Tenis de mesa','Tenis','Voleibol','Triatlon']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1240", "resolucion_actualizacion": null, "fecha_inicio": "13-10-2023", "fecha_fin": "2028-10-12", "presidente": "ALVARO JAVIER HERRÃÂN CARVAJAL", "localidad": "Engativá", "sports": ["Sordos", "Baloncesto", "Billar", "Atletismo", "Ciclismo", "Esgrima", "Natación", "Levantamiento De Pesas", "Tiro deportivo", "Rugby", "Tenis de mesa", "Tenis", "Voleibol", "Triatlon"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fundarvid-1240';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '2240138', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE BEISBOL LEONES DE BOGOTA  (IDRD-CLUB-de-beisbol-leones-de-bogota-662)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-beisbol-leones-de-bogota-662';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE BEISBOL LEONES DE BOGOTA',
      'Presidente: ANDRES MONTERROSA PADILLA. Deporte(s): Béisbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 662. Vigente hasta 2028-06-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3158024163',
      'clubleonesdebogota@gmail.com',
      ARRAY['Béisbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-beisbol-leones-de-bogota-662',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-beisbol-leones-de-bogota-662', v_school_id, '{"resolucion_rd": "662", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2023", "fecha_fin": "2028-06-20", "presidente": "ANDRES MONTERROSA PADILLA", "localidad": "Rafael Uribe Uribe", "sports": ["Béisbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES MONTERROSA PADILLA. Deporte(s): Béisbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 662. Vigente hasta 2028-06-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158024163', phone),
      email       = COALESCE('clubleonesdebogota@gmail.com', email),
      sports      = ARRAY['Béisbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "662", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2023", "fecha_fin": "2028-06-20", "presidente": "ANDRES MONTERROSA PADILLA", "localidad": "Rafael Uribe Uribe", "sports": ["Béisbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-beisbol-leones-de-bogota-662';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3158024163', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FLORENTINA  (IDRD-CLUB-club-deportivo-florentina-995)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-florentina-995';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FLORENTINA',
      'Presidente: RAFAEL ANTONIO CASTAÃO RIAÃO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 995. Vigente hasta 2029-10-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3134848993',
      'clubdeportivoflorentina@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-florentina-995',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-florentina-995', v_school_id, '{"resolucion_rd": "995", "resolucion_actualizacion": null, "fecha_inicio": "04-10-2024", "fecha_fin": "2029-10-04", "presidente": "RAFAEL ANTONIO CASTAÃO RIAÃO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAFAEL ANTONIO CASTAÃO RIAÃO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 995. Vigente hasta 2029-10-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134848993', phone),
      email       = COALESCE('clubdeportivoflorentina@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "995", "resolucion_actualizacion": null, "fecha_inicio": "04-10-2024", "fecha_fin": "2029-10-04", "presidente": "RAFAEL ANTONIO CASTAÃO RIAÃO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-florentina-995';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3134848993', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPITAL BOGOTA  (IDRD-CLUB-capital-bogota-1093)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capital-bogota-1093';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPITAL BOGOTA',
      'Presidente: JOHN FREDY ORTIZ BARRERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1093. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3108171284',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capital-bogota-1093',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capital-bogota-1093', v_school_id, '{"resolucion_rd": "1093", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "JOHN FREDY ORTIZ BARRERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN FREDY ORTIZ BARRERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1093. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108171284', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1093", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "JOHN FREDY ORTIZ BARRERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capital-bogota-1093';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3108171284', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GOLD LION  (IDRD-CLUB-gold-lion-752)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gold-lion-752';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GOLD LION',
      'Presidente: JHON JAIRO MORALES CLAVIJO. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 752. Vigente hasta 2028-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3164901205',
      'clubgoldlion@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gold-lion-752',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gold-lion-752', v_school_id, '{"resolucion_rd": "752", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2023", "fecha_fin": "2028-07-25", "presidente": "JHON JAIRO MORALES CLAVIJO", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON JAIRO MORALES CLAVIJO. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 752. Vigente hasta 2028-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3164901205', phone),
      email       = COALESCE('clubgoldlion@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "752", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2023", "fecha_fin": "2028-07-25", "presidente": "JHON JAIRO MORALES CLAVIJO", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gold-lion-752';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3164901205', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE FUTBOL FORTIN COLOMBIA  (IDRD-CLUB-club-deportivo-de-futbol-fortin-colombia-100)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-futbol-fortin-colombia-100';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE FUTBOL FORTIN COLOMBIA',
      'Presidente: LUIS CARLOS ALVARADO DIAZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 100. Vigente hasta 2029-05-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '80463273124366510',
      'velezoficialcolombia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-futbol-fortin-colombia-100',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-futbol-fortin-colombia-100', v_school_id, '{"resolucion_rd": "100", "resolucion_actualizacion": null, "fecha_inicio": "23-05-2024", "fecha_fin": "2029-05-23", "presidente": "LUIS CARLOS ALVARADO DIAZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS CARLOS ALVARADO DIAZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 100. Vigente hasta 2029-05-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('80463273124366510', phone),
      email       = COALESCE('velezoficialcolombia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "100", "resolucion_actualizacion": null, "fecha_inicio": "23-05-2024", "fecha_fin": "2029-05-23", "presidente": "LUIS CARLOS ALVARADO DIAZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-futbol-fortin-colombia-100';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '80463273124366510', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LJM SKATE  (IDRD-CLUB-ljm-skate-1313)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ljm-skate-1313';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LJM SKATE',
      'Presidente: ALBA JEANNETHE GALVIS AREVALO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1313. Vigente hasta 2028-10-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '68966523152129056',
      'ljmskate1@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ljm-skate-1313',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ljm-skate-1313', v_school_id, '{"resolucion_rd": "1313", "resolucion_actualizacion": null, "fecha_inicio": "26-10-2023", "fecha_fin": "2028-10-25", "presidente": "ALBA JEANNETHE GALVIS AREVALO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALBA JEANNETHE GALVIS AREVALO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1313. Vigente hasta 2028-10-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('68966523152129056', phone),
      email       = COALESCE('ljmskate1@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1313", "resolucion_actualizacion": null, "fecha_inicio": "26-10-2023", "fecha_fin": "2028-10-25", "presidente": "ALBA JEANNETHE GALVIS AREVALO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ljm-skate-1313';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '68966523152129056', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TENIS LUIS PATIÃO  (IDRD-CLUB-de-tenis-luis-patiao-1470)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-tenis-luis-patiao-1470';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TENIS LUIS PATIÃO',
      'Presidente: LUIS ANTONIO PATIÃO. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 1470. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3125870378',
      'luisanpatenis@hotmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-tenis-luis-patiao-1470',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-tenis-luis-patiao-1470', v_school_id, '{"resolucion_rd": "1470", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "LUIS ANTONIO PATIÃO", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ANTONIO PATIÃO. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 1470. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125870378', phone),
      email       = COALESCE('luisanpatenis@hotmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1470", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "LUIS ANTONIO PATIÃO", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-tenis-luis-patiao-1470';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3125870378', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FI TT  (IDRD-CLUB-fi-tt-796)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fi-tt-796';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FI TT',
      'Presidente: DIEGO ARMANDO JIMENEZ VELANDIA. Deporte(s): Tenis de mesa. Localidad: Engativá. Resolución R-D Nº 796. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3134198971',
      'fitt.tenisdemesa@gmail.com',
      ARRAY['Tenis de mesa']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fi-tt-796',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fi-tt-796', v_school_id, '{"resolucion_rd": "796", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "DIEGO ARMANDO JIMENEZ VELANDIA", "localidad": "Engativá", "sports": ["Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ARMANDO JIMENEZ VELANDIA. Deporte(s): Tenis de mesa. Localidad: Engativá. Resolución R-D Nº 796. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134198971', phone),
      email       = COALESCE('fitt.tenisdemesa@gmail.com', email),
      sports      = ARRAY['Tenis de mesa']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "796", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "DIEGO ARMANDO JIMENEZ VELANDIA", "localidad": "Engativá", "sports": ["Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fi-tt-796';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3134198971', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE KICK BOXING TORII  (IDRD-CLUB-de-kick-boxing-torii-1199)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-kick-boxing-torii-1199';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE KICK BOXING TORII',
      'Presidente: YURI VIVIANA BALLEN DUCUARA. Deporte(s): Kick Boxing. Localidad: Suba. Resolución R-D Nº 1199. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3105853442',
      'toriikbogota@hotmail.com',
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-kick-boxing-torii-1199',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-kick-boxing-torii-1199', v_school_id, '{"resolucion_rd": "1199", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "YURI VIVIANA BALLEN DUCUARA", "localidad": "Suba", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YURI VIVIANA BALLEN DUCUARA. Deporte(s): Kick Boxing. Localidad: Suba. Resolución R-D Nº 1199. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105853442', phone),
      email       = COALESCE('toriikbogota@hotmail.com', email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1199", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "YURI VIVIANA BALLEN DUCUARA", "localidad": "Suba", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-kick-boxing-torii-1199';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3105853442', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DEPORTIVO BIKE RIDE  (IDRD-CLUB-deportivo-bike-ride-1106)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-deportivo-bike-ride-1106';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DEPORTIVO BIKE RIDE',
      'Presidente: NADDER RACHED HAMAD VELANDIA. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1106. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3196236081',
      'escuelabikeride@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'deportivo-bike-ride-1106',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-deportivo-bike-ride-1106', v_school_id, '{"resolucion_rd": "1106", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "NADDER RACHED HAMAD VELANDIA", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NADDER RACHED HAMAD VELANDIA. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1106. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3196236081', phone),
      email       = COALESCE('escuelabikeride@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1106", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "NADDER RACHED HAMAD VELANDIA", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-deportivo-bike-ride-1106';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3196236081', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DEPORTEO  (IDRD-CLUB-club-deportivo-deporteo-011)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-deporteo-011';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DEPORTEO',
      'Presidente: JUAN CAMILO NEMPEQUE RINCON. Deporte(s): Tenis, Fútbol, Patinaje, Natación. Localidad: Usaquén. Resolución R-D Nº 011. Vigente hasta 2029-01-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3192498698',
      'fundacion.deporteo@gmail.com',
      ARRAY['Tenis','Fútbol','Patinaje','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-deporteo-011',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-deporteo-011', v_school_id, '{"resolucion_rd": "011", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2024", "fecha_fin": "2029-01-23", "presidente": "JUAN CAMILO NEMPEQUE RINCON", "localidad": "Usaquén", "sports": ["Tenis", "Fútbol", "Patinaje", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CAMILO NEMPEQUE RINCON. Deporte(s): Tenis, Fútbol, Patinaje, Natación. Localidad: Usaquén. Resolución R-D Nº 011. Vigente hasta 2029-01-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3192498698', phone),
      email       = COALESCE('fundacion.deporteo@gmail.com', email),
      sports      = ARRAY['Tenis','Fútbol','Patinaje','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "011", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2024", "fecha_fin": "2029-01-23", "presidente": "JUAN CAMILO NEMPEQUE RINCON", "localidad": "Usaquén", "sports": ["Tenis", "Fútbol", "Patinaje", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-deporteo-011';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3192498698', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DAVALOS SKATING  (IDRD-CLUB-davalos-skating-1399)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-davalos-skating-1399';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DAVALOS SKATING',
      'Presidente: NAREN HAIR PEÃA HUERFANO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1399. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3142668875',
      'davalo.skating@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'davalos-skating-1399',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-davalos-skating-1399', v_school_id, '{"resolucion_rd": "1399", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "NAREN HAIR PEÃA HUERFANO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NAREN HAIR PEÃA HUERFANO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1399. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142668875', phone),
      email       = COALESCE('davalo.skating@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1399", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "NAREN HAIR PEÃA HUERFANO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-davalos-skating-1399';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3142668875', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO COREN-LI  (IDRD-CLUB-club-deportivo-coren-li-1297)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-coren-li-1297';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO COREN-LI',
      'Presidente: MIGUEL HUMBERTO CASTILLO MENDEZ. Deporte(s): Taekwondo. Localidad: San Cristóbal. Resolución R-D Nº 1297. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3003834919',
      'lorew03@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-coren-li-1297',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-coren-li-1297', v_school_id, '{"resolucion_rd": "1297", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "MIGUEL HUMBERTO CASTILLO MENDEZ", "localidad": "San Cristóbal", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL HUMBERTO CASTILLO MENDEZ. Deporte(s): Taekwondo. Localidad: San Cristóbal. Resolución R-D Nº 1297. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003834919', phone),
      email       = COALESCE('lorew03@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1297", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "MIGUEL HUMBERTO CASTILLO MENDEZ", "localidad": "San Cristóbal", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-coren-li-1297';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3003834919', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KURASH SONIC  (IDRD-CLUB-club-deportivo-kurash-sonic-1362)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kurash-sonic-1362';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KURASH SONIC',
      'Presidente: ERICK GIOVANNI HERNANDEZ AGUIRRE. Deporte(s): Kurash. Localidad: Engativá. Resolución R-D Nº 1362. Vigente hasta 2030-11-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3003890355',
      'clubdeportivokurashsonic@gmail.com',
      ARRAY['Kurash']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kurash-sonic-1362',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kurash-sonic-1362', v_school_id, '{"resolucion_rd": "1362", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2025", "fecha_fin": "2030-11-24", "presidente": "ERICK GIOVANNI HERNANDEZ AGUIRRE", "localidad": "Engativá", "sports": ["Kurash"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ERICK GIOVANNI HERNANDEZ AGUIRRE. Deporte(s): Kurash. Localidad: Engativá. Resolución R-D Nº 1362. Vigente hasta 2030-11-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003890355', phone),
      email       = COALESCE('clubdeportivokurashsonic@gmail.com', email),
      sports      = ARRAY['Kurash']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1362", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2025", "fecha_fin": "2030-11-24", "presidente": "ERICK GIOVANNI HERNANDEZ AGUIRRE", "localidad": "Engativá", "sports": ["Kurash"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kurash-sonic-1362';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3003890355', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WSE.SPORTS F.C.  (IDRD-CLUB-club-deportivo-wsesports-fc-1334)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-wsesports-fc-1334';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WSE.SPORTS F.C.',
      'Presidente: YONH ALEXANDER MONTES AGUIRRE. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1334 / actualización Nº 1502. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3142758809',
      'wse.sport@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-wsesports-fc-1334',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-wsesports-fc-1334', v_school_id, '{"resolucion_rd": "1334", "resolucion_actualizacion": "1502", "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "YONH ALEXANDER MONTES AGUIRRE", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YONH ALEXANDER MONTES AGUIRRE. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1334 / actualización Nº 1502. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142758809', phone),
      email       = COALESCE('wse.sport@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1334", "resolucion_actualizacion": "1502", "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "YONH ALEXANDER MONTES AGUIRRE", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-wsesports-fc-1334';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3142758809', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORT MIES MS  (IDRD-CLUB-club-deportivo-sport-mies-ms-1781)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-mies-ms-1781';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORT MIES MS',
      'Presidente: MARIA NATALIA ALBINO VARGAS. Deporte(s): Fútbol, Natación, Patinaje, Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1781. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3118771075',
      'sportmies23@gmail.com',
      ARRAY['Fútbol','Natación','Patinaje','Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sport-mies-ms-1781',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sport-mies-ms-1781', v_school_id, '{"resolucion_rd": "1781", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "MARIA NATALIA ALBINO VARGAS", "localidad": "Kennedy", "sports": ["Fútbol", "Natación", "Patinaje", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA NATALIA ALBINO VARGAS. Deporte(s): Fútbol, Natación, Patinaje, Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1781. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118771075', phone),
      email       = COALESCE('sportmies23@gmail.com', email),
      sports      = ARRAY['Fútbol','Natación','Patinaje','Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1781", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "MARIA NATALIA ALBINO VARGAS", "localidad": "Kennedy", "sports": ["Fútbol", "Natación", "Patinaje", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-mies-ms-1781';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3118771075', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- WORRS  (IDRD-CLUB-worrs-1388)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-worrs-1388';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'WORRS',
      'Presidente: INIRIDA ESMERALDA GONZALEZ BALLEN. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1388. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3005634803',
      'escuelaaita@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'worrs-1388',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-worrs-1388', v_school_id, '{"resolucion_rd": "1388", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "INIRIDA ESMERALDA GONZALEZ BALLEN", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: INIRIDA ESMERALDA GONZALEZ BALLEN. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1388. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005634803', phone),
      email       = COALESCE('escuelaaita@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1388", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "INIRIDA ESMERALDA GONZALEZ BALLEN", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-worrs-1388';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3005634803', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESFUDESA F.S.  (IDRD-CLUB-club-deportivo-esfudesa-fs-799)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-esfudesa-fs-799';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESFUDESA F.S.',
      'Presidente: NELSON MUÃOZ VELOSA. Deporte(s): Fútbol de salón. Localidad: Usaquén. Resolución R-D Nº 799. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3132946997',
      'ornamentacion40@hotmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-esfudesa-fs-799',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-esfudesa-fs-799', v_school_id, '{"resolucion_rd": "799", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "NELSON MUÃOZ VELOSA", "localidad": "Usaquén", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NELSON MUÃOZ VELOSA. Deporte(s): Fútbol de salón. Localidad: Usaquén. Resolución R-D Nº 799. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132946997', phone),
      email       = COALESCE('ornamentacion40@hotmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "799", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "NELSON MUÃOZ VELOSA", "localidad": "Usaquén", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-esfudesa-fs-799';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3132946997', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE PATINAJE BLACK SKATE  (IDRD-CLUB-club-de-patinaje-black-skate-099)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-patinaje-black-skate-099';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE PATINAJE BLACK SKATE',
      'Presidente: VANESSA ALEJANDRA NARANJO GARAVITO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 099. Vigente hasta 2030-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3158110668',
      'club.blackskate@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-patinaje-black-skate-099',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-patinaje-black-skate-099', v_school_id, '{"resolucion_rd": "099", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2025", "fecha_fin": "2030-02-21", "presidente": "VANESSA ALEJANDRA NARANJO GARAVITO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VANESSA ALEJANDRA NARANJO GARAVITO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 099. Vigente hasta 2030-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158110668', phone),
      email       = COALESCE('club.blackskate@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "099", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2025", "fecha_fin": "2030-02-21", "presidente": "VANESSA ALEJANDRA NARANJO GARAVITO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-patinaje-black-skate-099';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3158110668', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DINAMIC  (IDRD-CLUB-club-deportivo-dinamic-1148)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dinamic-1148';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DINAMIC',
      'Presidente: DANIELA ACUÃA BARON. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1148. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3175143863',
      'dinamic.evolution7@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dinamic-1148',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dinamic-1148', v_school_id, '{"resolucion_rd": "1148", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "DANIELA ACUÃA BARON", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIELA ACUÃA BARON. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1148. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3175143863', phone),
      email       = COALESCE('dinamic.evolution7@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1148", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "DANIELA ACUÃA BARON", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dinamic-1148';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3175143863', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALFA UNITED FOOTBALL CLUB COLOMBIA M.U.C  (IDRD-CLUB-club-deportivo-alfa-united-football-club-012)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alfa-united-football-club-012';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALFA UNITED FOOTBALL CLUB COLOMBIA M.U.C',
      'Presidente: JUAN SEBASTIAN GONZALEZ MORA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 012 / actualización Nº 1100. Vigente hasta 2029-01-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3123053491',
      'manchesterimg@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alfa-united-football-club-012',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alfa-united-football-club-012', v_school_id, '{"resolucion_rd": "012", "resolucion_actualizacion": "1100", "fecha_inicio": "23-01-2024", "fecha_fin": "2029-01-22", "presidente": "JUAN SEBASTIAN GONZALEZ MORA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIAN GONZALEZ MORA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 012 / actualización Nº 1100. Vigente hasta 2029-01-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123053491', phone),
      email       = COALESCE('manchesterimg@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "012", "resolucion_actualizacion": "1100", "fecha_inicio": "23-01-2024", "fecha_fin": "2029-01-22", "presidente": "JUAN SEBASTIAN GONZALEZ MORA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alfa-united-football-club-012';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3123053491', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PATINAJE AVIVAS2 RENDIMIENTO  (IDRD-CLUB-club-deportivo-de-patinaje-avivas2-rendi-1666)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-avivas2-rendi-1666';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PATINAJE AVIVAS2 RENDIMIENTO',
      'Presidente: KATLIN ESTEFANIA MENDOZA CASTILLO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1666. Vigente hasta 2029-11-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3144422539',
      'avivas2rendimiento@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-patinaje-avivas2-rendi-1666',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-patinaje-avivas2-rendi-1666', v_school_id, '{"resolucion_rd": "1666", "resolucion_actualizacion": null, "fecha_inicio": "28-11-2024", "fecha_fin": "2029-11-28", "presidente": "KATLIN ESTEFANIA MENDOZA CASTILLO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KATLIN ESTEFANIA MENDOZA CASTILLO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1666. Vigente hasta 2029-11-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144422539', phone),
      email       = COALESCE('avivas2rendimiento@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1666", "resolucion_actualizacion": null, "fecha_inicio": "28-11-2024", "fecha_fin": "2029-11-28", "presidente": "KATLIN ESTEFANIA MENDOZA CASTILLO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-avivas2-rendi-1666';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3144422539', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO SUEÃO OLÃMPICO  (IDRD-CLUB-club-deportivo-de-taekwondo-sueao-olampi-751)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-sueao-olampi-751';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO SUEÃO OLÃMPICO',
      'Presidente: GINA MARCELA ZABALETA GARCES. Deporte(s): Taekwondo. Localidad: Barrios Unidos. Resolución R-D Nº 751. Vigente hasta 2029-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3176132827',
      's.olimpicotkd@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-sueao-olampi-751',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-sueao-olampi-751', v_school_id, '{"resolucion_rd": "751", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2024", "fecha_fin": "2029-06-21", "presidente": "GINA MARCELA ZABALETA GARCES", "localidad": "Barrios Unidos", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GINA MARCELA ZABALETA GARCES. Deporte(s): Taekwondo. Localidad: Barrios Unidos. Resolución R-D Nº 751. Vigente hasta 2029-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3176132827', phone),
      email       = COALESCE('s.olimpicotkd@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "751", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2024", "fecha_fin": "2029-06-21", "presidente": "GINA MARCELA ZABALETA GARCES", "localidad": "Barrios Unidos", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-sueao-olampi-751';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3176132827', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO INVICTUS BASKETBALL CLUB  (IDRD-CLUB-club-deportivo-invictus-basketball-club-793)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-invictus-basketball-club-793';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO INVICTUS BASKETBALL CLUB',
      'Presidente: NICOLAS DE JESUS CIFUENTES SALAS. Deporte(s): Baloncesto. Localidad: Puente Aranda. Resolución R-D Nº 793. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3212078281',
      'clubinvictusbasketball@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-invictus-basketball-club-793',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-invictus-basketball-club-793', v_school_id, '{"resolucion_rd": "793", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "NICOLAS DE JESUS CIFUENTES SALAS", "localidad": "Puente Aranda", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS DE JESUS CIFUENTES SALAS. Deporte(s): Baloncesto. Localidad: Puente Aranda. Resolución R-D Nº 793. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212078281', phone),
      email       = COALESCE('clubinvictusbasketball@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "793", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "NICOLAS DE JESUS CIFUENTES SALAS", "localidad": "Puente Aranda", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-invictus-basketball-club-793';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3212078281', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WINNERS FUTBOL BOGOTA  (IDRD-CLUB-club-deportivo-winners-futbol-bogota-167)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-winners-futbol-bogota-167';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WINNERS FUTBOL BOGOTA',
      'Presidente: CESAR AUGUSTO CALDERON VILLARRAGA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 167. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3118119739',
      'clubdeportivowinners@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-winners-futbol-bogota-167',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-winners-futbol-bogota-167', v_school_id, '{"resolucion_rd": "167", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2024", "fecha_fin": "2029-02-27", "presidente": "CESAR AUGUSTO CALDERON VILLARRAGA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR AUGUSTO CALDERON VILLARRAGA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 167. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118119739', phone),
      email       = COALESCE('clubdeportivowinners@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "167", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2024", "fecha_fin": "2029-02-27", "presidente": "CESAR AUGUSTO CALDERON VILLARRAGA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-winners-futbol-bogota-167';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3118119739', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NEURO REAL F.C  (IDRD-CLUB-neuro-real-fc-1475)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-neuro-real-fc-1475';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NEURO REAL F.C',
      'Presidente: SANTIAGO SALCEDO ALFONSO. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1475. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3204060577',
      'neurorealfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'neuro-real-fc-1475',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-neuro-real-fc-1475', v_school_id, '{"resolucion_rd": "1475", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "SANTIAGO SALCEDO ALFONSO", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO SALCEDO ALFONSO. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1475. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204060577', phone),
      email       = COALESCE('neurorealfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1475", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "SANTIAGO SALCEDO ALFONSO", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-neuro-real-fc-1475';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3204060577', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GOLDEN SOCCER C.D  (IDRD-CLUB-club-deportivo-golden-soccer-cd-1757)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-golden-soccer-cd-1757';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GOLDEN SOCCER C.D',
      'Presidente: JHONATAN JAMITH CONTENTO QUIROGA. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1757. Vigente hasta 2029-02-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3212482010',
      'jhonatancontento93@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-golden-soccer-cd-1757',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-golden-soccer-cd-1757', v_school_id, '{"resolucion_rd": "1757", "resolucion_actualizacion": null, "fecha_inicio": "05-02-2024", "fecha_fin": "2029-02-04", "presidente": "JHONATAN JAMITH CONTENTO QUIROGA", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHONATAN JAMITH CONTENTO QUIROGA. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1757. Vigente hasta 2029-02-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212482010', phone),
      email       = COALESCE('jhonatancontento93@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1757", "resolucion_actualizacion": null, "fecha_inicio": "05-02-2024", "fecha_fin": "2029-02-04", "presidente": "JHONATAN JAMITH CONTENTO QUIROGA", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-golden-soccer-cd-1757';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3212482010', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL CARVAJAL FC  (IDRD-CLUB-club-deportivo-real-carvajal-fc-413)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-carvajal-fc-413';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL CARVAJAL FC',
      'Presidente: YAIR GONZALEZ MORENO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 413. Vigente hasta 2029-04-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3142243085',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-carvajal-fc-413',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-carvajal-fc-413', v_school_id, '{"resolucion_rd": "413", "resolucion_actualizacion": null, "fecha_inicio": "08-04-2024", "fecha_fin": "2029-04-08", "presidente": "YAIR GONZALEZ MORENO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YAIR GONZALEZ MORENO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 413. Vigente hasta 2029-04-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142243085', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "413", "resolucion_actualizacion": null, "fecha_inicio": "08-04-2024", "fecha_fin": "2029-04-08", "presidente": "YAIR GONZALEZ MORENO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-carvajal-fc-413';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3142243085', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE NATACION SINCROCAPITAL  (IDRD-CLUB-de-natacion-sincrocapital-1567)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-natacion-sincrocapital-1567';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE NATACION SINCROCAPITAL',
      'Presidente: ANGELA YOMARY AVILA FERNANDEZ. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 1567. Vigente hasta 2028-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3224138501',
      NULL,
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-natacion-sincrocapital-1567',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-natacion-sincrocapital-1567', v_school_id, '{"resolucion_rd": "1567", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2023", "fecha_fin": "2028-12-13", "presidente": "ANGELA YOMARY AVILA FERNANDEZ", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELA YOMARY AVILA FERNANDEZ. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 1567. Vigente hasta 2028-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3224138501', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1567", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2023", "fecha_fin": "2028-12-13", "presidente": "ANGELA YOMARY AVILA FERNANDEZ", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-natacion-sincrocapital-1567';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3224138501', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO INDEPENDIENTE CENTRAL F.C.  (IDRD-CLUB-club-deportivo-independiente-central-fc-1162)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-independiente-central-fc-1162';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO INDEPENDIENTE CENTRAL F.C.',
      'Presidente: JULIO CESAR DIAZ TRUJILLO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1162. Vigente hasta 2029-09-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3193964466',
      'independientecentral@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-independiente-central-fc-1162',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-independiente-central-fc-1162', v_school_id, '{"resolucion_rd": "1162", "resolucion_actualizacion": null, "fecha_inicio": "06-09-2024", "fecha_fin": "2029-09-06", "presidente": "JULIO CESAR DIAZ TRUJILLO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIO CESAR DIAZ TRUJILLO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1162. Vigente hasta 2029-09-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193964466', phone),
      email       = COALESCE('independientecentral@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1162", "resolucion_actualizacion": null, "fecha_inicio": "06-09-2024", "fecha_fin": "2029-09-06", "presidente": "JULIO CESAR DIAZ TRUJILLO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-independiente-central-fc-1162';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3193964466', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SKILL BIKERS  (IDRD-CLUB-club-deportivo-skill-bikers-062)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-skill-bikers-062';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SKILL BIKERS',
      'Presidente: CESAR DAVID GOMEZ SANABRIA. Deporte(s): Ciclismo. Localidad: San Cristóbal. Resolución R-D Nº 062. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3790000',
      'gomezsanabriacesardavid@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-skill-bikers-062',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-skill-bikers-062', v_school_id, '{"resolucion_rd": "062", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2024", "fecha_fin": "2029-02-22", "presidente": "CESAR DAVID GOMEZ SANABRIA", "localidad": "San Cristóbal", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR DAVID GOMEZ SANABRIA. Deporte(s): Ciclismo. Localidad: San Cristóbal. Resolución R-D Nº 062. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3790000', phone),
      email       = COALESCE('gomezsanabriacesardavid@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "062", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2024", "fecha_fin": "2029-02-22", "presidente": "CESAR DAVID GOMEZ SANABRIA", "localidad": "San Cristóbal", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-skill-bikers-062';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3790000', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WINNERS PATINAJE BOGOTA  (IDRD-CLUB-club-deportivo-winners-patinaje-bogota-252)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-winners-patinaje-bogota-252';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WINNERS PATINAJE BOGOTA',
      'Presidente: KAREN DAHYANNA RICO ROJAS. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 252. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3106495855',
      'clubdeportivowinnerspatinaje@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-winners-patinaje-bogota-252',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-winners-patinaje-bogota-252', v_school_id, '{"resolucion_rd": "252", "resolucion_actualizacion": null, "fecha_inicio": "06-03-2024", "fecha_fin": "2029-03-06", "presidente": "KAREN DAHYANNA RICO ROJAS", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN DAHYANNA RICO ROJAS. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 252. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106495855', phone),
      email       = COALESCE('clubdeportivowinnerspatinaje@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "252", "resolucion_actualizacion": null, "fecha_inicio": "06-03-2024", "fecha_fin": "2029-03-06", "presidente": "KAREN DAHYANNA RICO ROJAS", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-winners-patinaje-bogota-252';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3106495855', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SUMMIT ARTISTIC SWIMMING TEAM  (IDRD-CLUB-club-deportivo-summit-artistic-swimming--935)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-summit-artistic-swimming--935';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SUMMIT ARTISTIC SWIMMING TEAM',
      'Presidente: IVAN HENAO CUERVO. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 935. Vigente hasta 2029-07-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3112360176',
      'summitartisticswimming@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-summit-artistic-swimming--935',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-summit-artistic-swimming--935', v_school_id, '{"resolucion_rd": "935", "resolucion_actualizacion": null, "fecha_inicio": "15-07-2024", "fecha_fin": "2029-07-15", "presidente": "IVAN HENAO CUERVO", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVAN HENAO CUERVO. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 935. Vigente hasta 2029-07-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112360176', phone),
      email       = COALESCE('summitartisticswimming@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "935", "resolucion_actualizacion": null, "fecha_inicio": "15-07-2024", "fecha_fin": "2029-07-15", "presidente": "IVAN HENAO CUERVO", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-summit-artistic-swimming--935';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3112360176', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TALENTOS BOGOTA FUTBOL CLUB  (IDRD-CLUB-club-deportivo-talentos-bogota-futbol-cl-196)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-talentos-bogota-futbol-cl-196';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TALENTOS BOGOTA FUTBOL CLUB',
      'Presidente: ANGELICA MARIA BAYONA GAITAN. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 196. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3008239568',
      'angelicabayona.gaitan@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-talentos-bogota-futbol-cl-196',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-talentos-bogota-futbol-cl-196', v_school_id, '{"resolucion_rd": "196", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "ANGELICA MARIA BAYONA GAITAN", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELICA MARIA BAYONA GAITAN. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 196. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008239568', phone),
      email       = COALESCE('angelicabayona.gaitan@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "196", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "ANGELICA MARIA BAYONA GAITAN", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-talentos-bogota-futbol-cl-196';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3008239568', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ORANGE VOLLEY  (IDRD-CLUB-club-deportivo-orange-volley-1011)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-orange-volley-1011';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ORANGE VOLLEY',
      'Presidente: WILSON EDUARDO MORENO BULLA. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1011. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3105596448',
      'wemb87@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-orange-volley-1011',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-orange-volley-1011', v_school_id, '{"resolucion_rd": "1011", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "WILSON EDUARDO MORENO BULLA", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON EDUARDO MORENO BULLA. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1011. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105596448', phone),
      email       = COALESCE('wemb87@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1011", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "WILSON EDUARDO MORENO BULLA", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-orange-volley-1011';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3105596448', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB EXPOFIGHTING TAEKWONDO  (IDRD-CLUB-club-expofighting-taekwondo-449)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-expofighting-taekwondo-449';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB EXPOFIGHTING TAEKWONDO',
      'Presidente: DANIELA HIDALGO SALAS. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 449. Vigente hasta 2029-04-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3114653968',
      'expofighting@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-expofighting-taekwondo-449',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-expofighting-taekwondo-449', v_school_id, '{"resolucion_rd": "449", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2024", "fecha_fin": "2029-04-12", "presidente": "DANIELA HIDALGO SALAS", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIELA HIDALGO SALAS. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 449. Vigente hasta 2029-04-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114653968', phone),
      email       = COALESCE('expofighting@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "449", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2024", "fecha_fin": "2029-04-12", "presidente": "DANIELA HIDALGO SALAS", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-expofighting-taekwondo-449';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3114653968', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CHRONOS SKATES  (IDRD-CLUB-club-deportivo-chronos-skates-275)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-chronos-skates-275';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CHRONOS SKATES',
      'Presidente: HECTOR EDUARDO BARRERA SAGOBAL. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 275. Vigente hasta 2029-03-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '5197047',
      'chronos_skates@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-chronos-skates-275',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-chronos-skates-275', v_school_id, '{"resolucion_rd": "275", "resolucion_actualizacion": null, "fecha_inicio": "23-03-2024", "fecha_fin": "2029-03-23", "presidente": "HECTOR EDUARDO BARRERA SAGOBAL", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HECTOR EDUARDO BARRERA SAGOBAL. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 275. Vigente hasta 2029-03-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5197047', phone),
      email       = COALESCE('chronos_skates@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "275", "resolucion_actualizacion": null, "fecha_inicio": "23-03-2024", "fecha_fin": "2029-03-23", "presidente": "HECTOR EDUARDO BARRERA SAGOBAL", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-chronos-skates-275';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '5197047', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JDIEZ FUTBOL CLUB SAS  (IDRD-CLUB-club-deportivo-jdiez-futbol-club-sas-1198)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jdiez-futbol-club-sas-1198';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JDIEZ FUTBOL CLUB SAS',
      'Presidente: SEBASTIAN ALEJANDRO GONZALEZ CHAVES. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1198. Vigente hasta 2029-08-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3506213662',
      'sebastian.gonzalez@jdiez.com.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jdiez-futbol-club-sas-1198',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jdiez-futbol-club-sas-1198', v_school_id, '{"resolucion_rd": "1198", "resolucion_actualizacion": null, "fecha_inicio": "31-08-2024", "fecha_fin": "2029-08-31", "presidente": "SEBASTIAN ALEJANDRO GONZALEZ CHAVES", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SEBASTIAN ALEJANDRO GONZALEZ CHAVES. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1198. Vigente hasta 2029-08-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3506213662', phone),
      email       = COALESCE('sebastian.gonzalez@jdiez.com.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1198", "resolucion_actualizacion": null, "fecha_inicio": "31-08-2024", "fecha_fin": "2029-08-31", "presidente": "SEBASTIAN ALEJANDRO GONZALEZ CHAVES", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jdiez-futbol-club-sas-1198';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3506213662', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB ATLETICO CHACARITA JUNIORS FILIAL COLOMBIA  (IDRD-CLUB-club-atletico-chacarita-juniors-filial-c-434)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-atletico-chacarita-juniors-filial-c-434';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB ATLETICO CHACARITA JUNIORS FILIAL COLOMBIA',
      'Presidente: NICOLAS RODRIGO MATIZ VEGA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 434 / actualización Nº 1280. Vigente hasta 2029-04-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3176442846',
      'contacto@chacaritacol.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-atletico-chacarita-juniors-filial-c-434',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-atletico-chacarita-juniors-filial-c-434', v_school_id, '{"resolucion_rd": "434", "resolucion_actualizacion": "1280", "fecha_inicio": "11-04-2024", "fecha_fin": "2029-04-11", "presidente": "NICOLAS RODRIGO MATIZ VEGA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS RODRIGO MATIZ VEGA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 434 / actualización Nº 1280. Vigente hasta 2029-04-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3176442846', phone),
      email       = COALESCE('contacto@chacaritacol.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "434", "resolucion_actualizacion": "1280", "fecha_inicio": "11-04-2024", "fecha_fin": "2029-04-11", "presidente": "NICOLAS RODRIGO MATIZ VEGA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-atletico-chacarita-juniors-filial-c-434';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3176442846', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE AJEDREZ EL TABLAZO  (IDRD-CLUB-club-deportivo-de-ajedrez-el-tablazo-1103)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-ajedrez-el-tablazo-1103';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE AJEDREZ EL TABLAZO',
      'Presidente: JACQUELINE PERILLA CAMPOS. Deporte(s): Ajedrez. Localidad: Engativá. Resolución R-D Nº 1103. Vigente hasta 2029-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3204510691',
      'ajedrezeltablazo@gmail.com',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-ajedrez-el-tablazo-1103',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-ajedrez-el-tablazo-1103', v_school_id, '{"resolucion_rd": "1103", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2024", "fecha_fin": "2029-08-15", "presidente": "JACQUELINE PERILLA CAMPOS", "localidad": "Engativá", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JACQUELINE PERILLA CAMPOS. Deporte(s): Ajedrez. Localidad: Engativá. Resolución R-D Nº 1103. Vigente hasta 2029-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204510691', phone),
      email       = COALESCE('ajedrezeltablazo@gmail.com', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1103", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2024", "fecha_fin": "2029-08-15", "presidente": "JACQUELINE PERILLA CAMPOS", "localidad": "Engativá", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-ajedrez-el-tablazo-1103';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3204510691', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- XSPEED RACING CLUB  (IDRD-CLUB-xspeed-racing-club-495)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-xspeed-racing-club-495';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'XSPEED RACING CLUB',
      'Presidente: JORGE VLADIMIR PULIDO TOVAR. Deporte(s): Motociclismo. Localidad: Suba. Resolución R-D Nº 495 / actualización Nº 495. Vigente hasta 2029-04-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3118208234',
      'xspeedracingclub@gmail.com',
      ARRAY['Motociclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'xspeed-racing-club-495',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-xspeed-racing-club-495', v_school_id, '{"resolucion_rd": "495", "resolucion_actualizacion": "495", "fecha_inicio": "22-04-2024", "fecha_fin": "2029-04-22", "presidente": "JORGE VLADIMIR PULIDO TOVAR", "localidad": "Suba", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE VLADIMIR PULIDO TOVAR. Deporte(s): Motociclismo. Localidad: Suba. Resolución R-D Nº 495 / actualización Nº 495. Vigente hasta 2029-04-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118208234', phone),
      email       = COALESCE('xspeedracingclub@gmail.com', email),
      sports      = ARRAY['Motociclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "495", "resolucion_actualizacion": "495", "fecha_inicio": "22-04-2024", "fecha_fin": "2029-04-22", "presidente": "JORGE VLADIMIR PULIDO TOVAR", "localidad": "Suba", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-xspeed-racing-club-495';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3118208234', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
