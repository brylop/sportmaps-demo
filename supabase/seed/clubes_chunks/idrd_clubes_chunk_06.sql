-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 6/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- JIRETH SKATE C.D  (IDRD-CLUB-jireth-skate-cd-191)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jireth-skate-cd-191';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JIRETH SKATE C.D',
      'Presidente: MILENA VILLALOBOS ROJAS. Deporte(s): Patinaje. Resolución R-D Nº 191. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3012917295',
      'jirethcd@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jireth-skate-cd-191',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jireth-skate-cd-191', v_school_id, '{"resolucion_rd": "191", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "MILENA VILLALOBOS ROJAS", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MILENA VILLALOBOS ROJAS. Deporte(s): Patinaje. Resolución R-D Nº 191. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012917295', phone),
      email       = COALESCE('jirethcd@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "191", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "MILENA VILLALOBOS ROJAS", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jireth-skate-cd-191';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- BOGOTA PUEBLA F.C  (IDRD-CLUB-bogota-puebla-fc-205)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bogota-puebla-fc-205';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOGOTA PUEBLA F.C',
      'Presidente: DANIEL IVAN RUEDA VELANDIA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 205. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '92495844343598',
      'danielrueda87@mail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bogota-puebla-fc-205',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bogota-puebla-fc-205', v_school_id, '{"resolucion_rd": "205", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "DANIEL IVAN RUEDA VELANDIA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL IVAN RUEDA VELANDIA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 205. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('92495844343598', phone),
      email       = COALESCE('danielrueda87@mail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "205", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "DANIEL IVAN RUEDA VELANDIA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bogota-puebla-fc-205';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '92495844343598', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUTBOL CLUB BENFICA  (IDRD-CLUB-club-deportivo-futbol-club-benfica-219)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-futbol-club-benfica-219';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUTBOL CLUB BENFICA',
      'Presidente: DIEGO ARMANDO BALLESTEROS CAICEDO. Deporte(s): Fútbol. Resolución R-D Nº 219. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3043291458',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-futbol-club-benfica-219',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-futbol-club-benfica-219', v_school_id, '{"resolucion_rd": "219", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "DIEGO ARMANDO BALLESTEROS CAICEDO", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ARMANDO BALLESTEROS CAICEDO. Deporte(s): Fútbol. Resolución R-D Nº 219. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043291458', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "219", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "DIEGO ARMANDO BALLESTEROS CAICEDO", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-futbol-club-benfica-219';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALBERTO GAMERO FC  (IDRD-CLUB-club-deportivo-alberto-gamero-fc-225)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alberto-gamero-fc-225';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALBERTO GAMERO FC',
      'Presidente: PABLO FELIPE MURCIA LÃPEZ. Deporte(s): Fútbol. Resolución R-D Nº 225. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3118254077',
      'info.futbolvida@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alberto-gamero-fc-225',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alberto-gamero-fc-225', v_school_id, '{"resolucion_rd": "225", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "PABLO FELIPE MURCIA LÃPEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PABLO FELIPE MURCIA LÃPEZ. Deporte(s): Fútbol. Resolución R-D Nº 225. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118254077', phone),
      email       = COALESCE('info.futbolvida@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "225", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "PABLO FELIPE MURCIA LÃPEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alberto-gamero-fc-225';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CHATURANGA  (IDRD-CLUB-club-deportivo-chaturanga-260)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-chaturanga-260';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CHATURANGA',
      'Presidente: LILIANA ESPERANZA SEPULVEDA AGUDELO. Deporte(s): Ajedrez. Localidad: Suba. Resolución R-D Nº 260. Vigente hasta 2027-03-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '300651370',
      'clubajedezchaturanga@gmail.com',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-chaturanga-260',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-chaturanga-260', v_school_id, '{"resolucion_rd": "260", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2022", "fecha_fin": "2027-03-16", "presidente": "LILIANA ESPERANZA SEPULVEDA AGUDELO", "localidad": "Suba", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LILIANA ESPERANZA SEPULVEDA AGUDELO. Deporte(s): Ajedrez. Localidad: Suba. Resolución R-D Nº 260. Vigente hasta 2027-03-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('300651370', phone),
      email       = COALESCE('clubajedezchaturanga@gmail.com', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "260", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2022", "fecha_fin": "2027-03-16", "presidente": "LILIANA ESPERANZA SEPULVEDA AGUDELO", "localidad": "Suba", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-chaturanga-260';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '300651370', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DERDH  (IDRD-CLUB-derdh-264)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-derdh-264';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DERDH',
      'Presidente: FELIPE SANCHEZ SARMIENTO. Deporte(s): Natación, Taekwondo, Fútbol de salón, Patinaje, Fútbol, Tenis, Gimnasia, Baloncesto, Voleibol. Resolución R-D Nº 264. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3193657939',
      'derdh.2020@gmail.com',
      ARRAY['Natación','Taekwondo','Fútbol de salón','Patinaje','Fútbol','Tenis','Gimnasia','Baloncesto','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'derdh-264',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-derdh-264', v_school_id, '{"resolucion_rd": "264", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "FELIPE SANCHEZ SARMIENTO", "localidad": null, "sports": ["Natación", "Taekwondo", "Fútbol de salón", "Patinaje", "Fútbol", "Tenis", "Gimnasia", "Baloncesto", "Voleibol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FELIPE SANCHEZ SARMIENTO. Deporte(s): Natación, Taekwondo, Fútbol de salón, Patinaje, Fútbol, Tenis, Gimnasia, Baloncesto, Voleibol. Resolución R-D Nº 264. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193657939', phone),
      email       = COALESCE('derdh.2020@gmail.com', email),
      sports      = ARRAY['Natación','Taekwondo','Fútbol de salón','Patinaje','Fútbol','Tenis','Gimnasia','Baloncesto','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "264", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "FELIPE SANCHEZ SARMIENTO", "localidad": null, "sports": ["Natación", "Taekwondo", "Fútbol de salón", "Patinaje", "Fútbol", "Tenis", "Gimnasia", "Baloncesto", "Voleibol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-derdh-264';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- LEONES AZULES  (IDRD-CLUB-leones-azules-263)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-leones-azules-263';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEONES AZULES',
      'Presidente: JONATHAN HERLEY TRIVIÃO GAMBA. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 263. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3165101051',
      'cdleonesazules@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'leones-azules-263',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-leones-azules-263', v_school_id, '{"resolucion_rd": "263", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "JONATHAN HERLEY TRIVIÃO GAMBA", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JONATHAN HERLEY TRIVIÃO GAMBA. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 263. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165101051', phone),
      email       = COALESCE('cdleonesazules@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "263", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "JONATHAN HERLEY TRIVIÃO GAMBA", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-leones-azules-263';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3165101051', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE SAMBO TITANES  (IDRD-CLUB-club-deportivo-de-sambo-titanes-266)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-titanes-266';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE SAMBO TITANES',
      'Presidente: LILIANA PATRICIA SIERRA MENDIETA. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 266. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3142752754',
      'lilosierra699@gmail.com',
      ARRAY['Sambo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-sambo-titanes-266',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-sambo-titanes-266', v_school_id, '{"resolucion_rd": "266", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "LILIANA PATRICIA SIERRA MENDIETA", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LILIANA PATRICIA SIERRA MENDIETA. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 266. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142752754', phone),
      email       = COALESCE('lilosierra699@gmail.com', email),
      sports      = ARRAY['Sambo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "266", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "LILIANA PATRICIA SIERRA MENDIETA", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-titanes-266';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3142752754', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CENTROFORM  (IDRD-CLUB-centroform-265)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-centroform-265';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CENTROFORM',
      'Presidente: ELMER IGNACIO VILLAMIL VERGARA. Deporte(s): Tenis, Voleibol. Localidad: Barrios Unidos. Resolución R-D Nº 265. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3103039400',
      'villamilelmer@gmail.com',
      ARRAY['Tenis','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'centroform-265',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-centroform-265', v_school_id, '{"resolucion_rd": "265", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "ELMER IGNACIO VILLAMIL VERGARA", "localidad": "Barrios Unidos", "sports": ["Tenis", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELMER IGNACIO VILLAMIL VERGARA. Deporte(s): Tenis, Voleibol. Localidad: Barrios Unidos. Resolución R-D Nº 265. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103039400', phone),
      email       = COALESCE('villamilelmer@gmail.com', email),
      sports      = ARRAY['Tenis','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "265", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "ELMER IGNACIO VILLAMIL VERGARA", "localidad": "Barrios Unidos", "sports": ["Tenis", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-centroform-265';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3103039400', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LIONTA F.C  (IDRD-CLUB-lionta-fc-276)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-lionta-fc-276';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LIONTA F.C',
      'Presidente: CARLOS ANDRES CAMPOS RIAÃOS. Deporte(s): Fútbol. Resolución R-D Nº 276. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3203544325',
      'liontaescuela@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'lionta-fc-276',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-lionta-fc-276', v_school_id, '{"resolucion_rd": "276", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "CARLOS ANDRES CAMPOS RIAÃOS", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRES CAMPOS RIAÃOS. Deporte(s): Fútbol. Resolución R-D Nº 276. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203544325', phone),
      email       = COALESCE('liontaescuela@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "276", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "CARLOS ANDRES CAMPOS RIAÃOS", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-lionta-fc-276';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ARC RUGBY CLUB  (IDRD-CLUB-arc-rugby-club-268)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-arc-rugby-club-268';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ARC RUGBY CLUB',
      'Presidente: IVAN CAMILO GOMEZ MALAGON. Deporte(s): Rugby. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 268. Vigente hasta 2027-03-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3112064229',
      'ivancamilogomezma@gmail.com',
      ARRAY['Rugby']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'arc-rugby-club-268',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-arc-rugby-club-268', v_school_id, '{"resolucion_rd": "268", "resolucion_actualizacion": null, "fecha_inicio": "22-03-2022", "fecha_fin": "2027-03-22", "presidente": "IVAN CAMILO GOMEZ MALAGON", "localidad": "Rafael Uribe Uribe", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVAN CAMILO GOMEZ MALAGON. Deporte(s): Rugby. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 268. Vigente hasta 2027-03-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112064229', phone),
      email       = COALESCE('ivancamilogomezma@gmail.com', email),
      sports      = ARRAY['Rugby']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "268", "resolucion_actualizacion": null, "fecha_inicio": "22-03-2022", "fecha_fin": "2027-03-22", "presidente": "IVAN CAMILO GOMEZ MALAGON", "localidad": "Rafael Uribe Uribe", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-arc-rugby-club-268';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3112064229', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA 10  (IDRD-CLUB-club-deportivo-la-10-270)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-10-270';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA 10',
      'Presidente: LUIS CARLOS JIMENEZ RODRIGUEZ. Deporte(s): Fútbol. Resolución R-D Nº 270. Vigente hasta 2027-03-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3504213981',
      'jrluiski@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-10-270',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-10-270', v_school_id, '{"resolucion_rd": "270", "resolucion_actualizacion": null, "fecha_inicio": "23-03-2022", "fecha_fin": "2027-03-23", "presidente": "LUIS CARLOS JIMENEZ RODRIGUEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS CARLOS JIMENEZ RODRIGUEZ. Deporte(s): Fútbol. Resolución R-D Nº 270. Vigente hasta 2027-03-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3504213981', phone),
      email       = COALESCE('jrluiski@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "270", "resolucion_actualizacion": null, "fecha_inicio": "23-03-2022", "fecha_fin": "2027-03-23", "presidente": "LUIS CARLOS JIMENEZ RODRIGUEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-10-270';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE SAMBO IRMAOS OSMA  (IDRD-CLUB-club-deportivo-de-sambo-irmaos-osma-273)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-irmaos-osma-273';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE SAMBO IRMAOS OSMA',
      'Presidente: LUISA FERNANDA MENDEZ DIAZ. Deporte(s): Sambo. Localidad: Kennedy. Resolución R-D Nº 273. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3508999822',
      NULL,
      ARRAY['Sambo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-sambo-irmaos-osma-273',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-sambo-irmaos-osma-273', v_school_id, '{"resolucion_rd": "273", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "LUISA FERNANDA MENDEZ DIAZ", "localidad": "Kennedy", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUISA FERNANDA MENDEZ DIAZ. Deporte(s): Sambo. Localidad: Kennedy. Resolución R-D Nº 273. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3508999822', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Sambo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "273", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "LUISA FERNANDA MENDEZ DIAZ", "localidad": "Kennedy", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-irmaos-osma-273';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3508999822', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PLANETA FUTBOL  (IDRD-CLUB-planeta-futbol-275)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-planeta-futbol-275';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PLANETA FUTBOL',
      'Presidente: JAIR ALBERTO GUTIERREZ CRUZ. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 275. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3134456305',
      'cdplanetafutbol@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'planeta-futbol-275',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-planeta-futbol-275', v_school_id, '{"resolucion_rd": "275", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "JAIR ALBERTO GUTIERREZ CRUZ", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIR ALBERTO GUTIERREZ CRUZ. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 275. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134456305', phone),
      email       = COALESCE('cdplanetafutbol@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "275", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "JAIR ALBERTO GUTIERREZ CRUZ", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-planeta-futbol-275';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3134456305', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MOVILSER FUTBOL CLUB  (IDRD-CLUB-movilser-futbol-club-272)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-movilser-futbol-club-272';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MOVILSER FUTBOL CLUB',
      'Presidente: JUAN DAVID ARIZA HERRERA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 272. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3102250189',
      'jdavidarz@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'movilser-futbol-club-272',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-movilser-futbol-club-272', v_school_id, '{"resolucion_rd": "272", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "JUAN DAVID ARIZA HERRERA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN DAVID ARIZA HERRERA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 272. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102250189', phone),
      email       = COALESCE('jdavidarz@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "272", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "JUAN DAVID ARIZA HERRERA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-movilser-futbol-club-272';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3102250189', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JDA SPEED BIKE PROFESIONAL TEAM  (IDRD-CLUB-jda-speed-bike-profesional-team-283)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jda-speed-bike-profesional-team-283';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JDA SPEED BIKE PROFESIONAL TEAM',
      'Presidente: JUAN DAVID AGUIRRE GONZÃLEZ. Deporte(s): Ciclismo. Resolución R-D Nº 283. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3144492219',
      'juancho1238@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jda-speed-bike-profesional-team-283',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jda-speed-bike-profesional-team-283', v_school_id, '{"resolucion_rd": "283", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "JUAN DAVID AGUIRRE GONZÃLEZ", "localidad": null, "sports": ["Ciclismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN DAVID AGUIRRE GONZÃLEZ. Deporte(s): Ciclismo. Resolución R-D Nº 283. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144492219', phone),
      email       = COALESCE('juancho1238@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "283", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "JUAN DAVID AGUIRRE GONZÃLEZ", "localidad": null, "sports": ["Ciclismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jda-speed-bike-profesional-team-283';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE PATINAJE SKR PRO BOGOTÃ  (IDRD-CLUB-club-de-patinaje-skr-pro-bogota-274)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-patinaje-skr-pro-bogota-274';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE PATINAJE SKR PRO BOGOTÃ',
      'Presidente: DANIEL ORLANDO GARCIA CELEITA. Deporte(s): Patinaje. Resolución R-D Nº 274. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3143069108',
      'skaterunning2016@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-patinaje-skr-pro-bogota-274',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-patinaje-skr-pro-bogota-274', v_school_id, '{"resolucion_rd": "274", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "DANIEL ORLANDO GARCIA CELEITA", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL ORLANDO GARCIA CELEITA. Deporte(s): Patinaje. Resolución R-D Nº 274. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143069108', phone),
      email       = COALESCE('skaterunning2016@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "274", "resolucion_actualizacion": null, "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "DANIEL ORLANDO GARCIA CELEITA", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-patinaje-skr-pro-bogota-274';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- SPK BOGOTA  (IDRD-CLUB-spk-bogota-285)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-spk-bogota-285';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPK BOGOTA',
      'Presidente: NICOLAS ALBERTO GARCIA LOPEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 285. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3022581577',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'spk-bogota-285',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-spk-bogota-285', v_school_id, '{"resolucion_rd": "285", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "NICOLAS ALBERTO GARCIA LOPEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS ALBERTO GARCIA LOPEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 285. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3022581577', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "285", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "NICOLAS ALBERTO GARCIA LOPEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-spk-bogota-285';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3022581577', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO KIDS DO KWAN  (IDRD-CLUB-club-deportivo-de-taekwondo-kids-do-kwan-286)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-kids-do-kwan-286';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO KIDS DO KWAN',
      'Presidente: LOURDES CATALINA NEIRA RICARDO. Deporte(s): Taekwondo. Localidad: Usaquén. Resolución R-D Nº 286. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3193790938',
      'cataneira03@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-kids-do-kwan-286',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-kids-do-kwan-286', v_school_id, '{"resolucion_rd": "286", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "LOURDES CATALINA NEIRA RICARDO", "localidad": "Usaquén", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LOURDES CATALINA NEIRA RICARDO. Deporte(s): Taekwondo. Localidad: Usaquén. Resolución R-D Nº 286. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193790938', phone),
      email       = COALESCE('cataneira03@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "286", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "LOURDES CATALINA NEIRA RICARDO", "localidad": "Usaquén", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-kids-do-kwan-286';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3193790938', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO 226  (IDRD-CLUB-club-deportivo-226-302)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-226-302';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO 226',
      'Presidente: OSWALDO ALBERTO SANTOS CRUZ. Deporte(s): Triatlon. Localidad: Suba. Resolución R-D Nº 302 / actualización Nº 606. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3138889048',
      '2dos26veintiseis@gmail.com',
      ARRAY['Triatlon']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-226-302',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-226-302', v_school_id, '{"resolucion_rd": "302", "resolucion_actualizacion": "606", "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "OSWALDO ALBERTO SANTOS CRUZ", "localidad": "Suba", "sports": ["Triatlon"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSWALDO ALBERTO SANTOS CRUZ. Deporte(s): Triatlon. Localidad: Suba. Resolución R-D Nº 302 / actualización Nº 606. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138889048', phone),
      email       = COALESCE('2dos26veintiseis@gmail.com', email),
      sports      = ARRAY['Triatlon']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "302", "resolucion_actualizacion": "606", "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "OSWALDO ALBERTO SANTOS CRUZ", "localidad": "Suba", "sports": ["Triatlon"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-226-302';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3138889048', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE FUTBOL FORGERON FC  (IDRD-CLUB-club-deportivo-de-futbol-forgeron-fc-301)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-futbol-forgeron-fc-301';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE FUTBOL FORGERON FC',
      'Presidente: LEONEL CASTAÃEDA RUBIANO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 301. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3005560644',
      'eda@forgeronfc.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-futbol-forgeron-fc-301',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-futbol-forgeron-fc-301', v_school_id, '{"resolucion_rd": "301", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "LEONEL CASTAÃEDA RUBIANO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEONEL CASTAÃEDA RUBIANO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 301. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005560644', phone),
      email       = COALESCE('eda@forgeronfc.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "301", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "LEONEL CASTAÃEDA RUBIANO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-futbol-forgeron-fc-301';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3005560644', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JAGUARES DEL NOGAL  (IDRD-CLUB-jaguares-del-nogal-293)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jaguares-del-nogal-293';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JAGUARES DEL NOGAL',
      'Presidente: CINDY KATHERINE CARDENAS GARZÃN. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 293. Vigente hasta 2027-03-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3108559154',
      NULL,
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jaguares-del-nogal-293',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jaguares-del-nogal-293', v_school_id, '{"resolucion_rd": "293", "resolucion_actualizacion": null, "fecha_inicio": "30-03-2022", "fecha_fin": "2027-03-30", "presidente": "CINDY KATHERINE CARDENAS GARZÃN", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CINDY KATHERINE CARDENAS GARZÃN. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 293. Vigente hasta 2027-03-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108559154', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "293", "resolucion_actualizacion": null, "fecha_inicio": "30-03-2022", "fecha_fin": "2027-03-30", "presidente": "CINDY KATHERINE CARDENAS GARZÃN", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jaguares-del-nogal-293';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3108559154', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- IAP TEAM  (IDRD-CLUB-iap-team-312)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-iap-team-312';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'IAP TEAM',
      'Presidente: NICOLAS FABIAN CHAVEZ GARCIA. Deporte(s): Atletismo. Resolución R-D Nº 312. Vigente hasta 2027-04-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3102980662',
      NULL,
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'iap-team-312',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-iap-team-312', v_school_id, '{"resolucion_rd": "312", "resolucion_actualizacion": null, "fecha_inicio": "06-04-2022", "fecha_fin": "2027-04-06", "presidente": "NICOLAS FABIAN CHAVEZ GARCIA", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS FABIAN CHAVEZ GARCIA. Deporte(s): Atletismo. Resolución R-D Nº 312. Vigente hasta 2027-04-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102980662', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "312", "resolucion_actualizacion": null, "fecha_inicio": "06-04-2022", "fecha_fin": "2027-04-06", "presidente": "NICOLAS FABIAN CHAVEZ GARCIA", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-iap-team-312';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- BOXING CLUB BOGOTA  (IDRD-CLUB-boxing-club-bogota-357)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-boxing-club-bogota-357';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOXING CLUB BOGOTA',
      'Presidente: LEONARDO ARTURO ORJUELA VELASCO. Deporte(s): Boxeo. Localidad: Teusaquillo. Resolución R-D Nº 357. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3197361386',
      'boxingclubcolombia@gmail.com',
      ARRAY['Boxeo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'boxing-club-bogota-357',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-boxing-club-bogota-357', v_school_id, '{"resolucion_rd": "357", "resolucion_actualizacion": null, "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "LEONARDO ARTURO ORJUELA VELASCO", "localidad": "Teusaquillo", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEONARDO ARTURO ORJUELA VELASCO. Deporte(s): Boxeo. Localidad: Teusaquillo. Resolución R-D Nº 357. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3197361386', phone),
      email       = COALESCE('boxingclubcolombia@gmail.com', email),
      sports      = ARRAY['Boxeo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "357", "resolucion_actualizacion": null, "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "LEONARDO ARTURO ORJUELA VELASCO", "localidad": "Teusaquillo", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-boxing-club-bogota-357';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3197361386', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETICO MIRANDES MMM  (IDRD-CLUB-atletico-mirandes-mmm-366)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletico-mirandes-mmm-366';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETICO MIRANDES MMM',
      'Presidente: DANIEL ALBERTO MIRANDA PEREZ. Deporte(s): Fútbol. Resolución R-D Nº 366. Vigente hasta 2027-04-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3125681482',
      'danimero1@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletico-mirandes-mmm-366',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletico-mirandes-mmm-366', v_school_id, '{"resolucion_rd": "366", "resolucion_actualizacion": null, "fecha_inicio": "22-04-2022", "fecha_fin": "2027-04-22", "presidente": "DANIEL ALBERTO MIRANDA PEREZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL ALBERTO MIRANDA PEREZ. Deporte(s): Fútbol. Resolución R-D Nº 366. Vigente hasta 2027-04-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125681482', phone),
      email       = COALESCE('danimero1@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "366", "resolucion_actualizacion": null, "fecha_inicio": "22-04-2022", "fecha_fin": "2027-04-22", "presidente": "DANIEL ALBERTO MIRANDA PEREZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletico-mirandes-mmm-366';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- PALMA ALDEA F.S  (IDRD-CLUB-palma-aldea-fs-344)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-palma-aldea-fs-344';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PALMA ALDEA F.S',
      'Presidente: CHRISTIAN YAIR RODRIGUEZ SOSSA. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 344. Vigente hasta 2027-04-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3105875807',
      'palmaaldeaf.c@outlook.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'palma-aldea-fs-344',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-palma-aldea-fs-344', v_school_id, '{"resolucion_rd": "344", "resolucion_actualizacion": null, "fecha_inicio": "13-04-2022", "fecha_fin": "2027-04-13", "presidente": "CHRISTIAN YAIR RODRIGUEZ SOSSA", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CHRISTIAN YAIR RODRIGUEZ SOSSA. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 344. Vigente hasta 2027-04-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105875807', phone),
      email       = COALESCE('palmaaldeaf.c@outlook.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "344", "resolucion_actualizacion": null, "fecha_inicio": "13-04-2022", "fecha_fin": "2027-04-13", "presidente": "CHRISTIAN YAIR RODRIGUEZ SOSSA", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-palma-aldea-fs-344';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3105875807', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KAIROS SOCCER F.C  (IDRD-CLUB-club-deportivo-kairos-soccer-fc-376)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kairos-soccer-fc-376';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KAIROS SOCCER F.C',
      'Presidente: JIMMY JAMES SALAZAR PEÃÆÃ¢â¬ËA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 376. Vigente hasta 2027-05-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3107605703',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kairos-soccer-fc-376',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kairos-soccer-fc-376', v_school_id, '{"resolucion_rd": "376", "resolucion_actualizacion": null, "fecha_inicio": "13-05-2022", "fecha_fin": "2027-05-13", "presidente": "JIMMY JAMES SALAZAR PEÃÆÃ¢â¬ËA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JIMMY JAMES SALAZAR PEÃÆÃ¢â¬ËA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 376. Vigente hasta 2027-05-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107605703', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "376", "resolucion_actualizacion": null, "fecha_inicio": "13-05-2022", "fecha_fin": "2027-05-13", "presidente": "JIMMY JAMES SALAZAR PEÃÆÃ¢â¬ËA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kairos-soccer-fc-376';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3107605703', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- Club Deportivo DE SAMBO GÃRGOLAS  (IDRD-CLUB-club-deportivo-de-sambo-gargolas-375)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-gargolas-375';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Club Deportivo DE SAMBO GÃRGOLAS',
      'Presidente: MARIA FERNANDA NIZO LONDOÃO. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 375. Vigente hasta 2027-04-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3142752754',
      'gargolassambo@gmail.com',
      ARRAY['Sambo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-sambo-gargolas-375',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-sambo-gargolas-375', v_school_id, '{"resolucion_rd": "375", "resolucion_actualizacion": null, "fecha_inicio": "26-04-2022", "fecha_fin": "2027-04-26", "presidente": "MARIA FERNANDA NIZO LONDOÃO", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA FERNANDA NIZO LONDOÃO. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 375. Vigente hasta 2027-04-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142752754', phone),
      email       = COALESCE('gargolassambo@gmail.com', email),
      sports      = ARRAY['Sambo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "375", "resolucion_actualizacion": null, "fecha_inicio": "26-04-2022", "fecha_fin": "2027-04-26", "presidente": "MARIA FERNANDA NIZO LONDOÃO", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-gargolas-375';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3142752754', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE BOCCIA AGUILAS DORADAS  (IDRD-CLUB-club-de-boccia-aguilas-doradas-386)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-boccia-aguilas-doradas-386';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE BOCCIA AGUILAS DORADAS',
      'Presidente: ABELARDO CASTRO BOHORQUEZ. Deporte(s): Boccia. Localidad: Kennedy. Resolución R-D Nº 386. Vigente hasta 2027-04-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3153342014',
      'clubaguilasdoradaspc@yahoo.com',
      ARRAY['Boccia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-boccia-aguilas-doradas-386',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-boccia-aguilas-doradas-386', v_school_id, '{"resolucion_rd": "386", "resolucion_actualizacion": null, "fecha_inicio": "28-04-2022", "fecha_fin": "2027-04-28", "presidente": "ABELARDO CASTRO BOHORQUEZ", "localidad": "Kennedy", "sports": ["Boccia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ABELARDO CASTRO BOHORQUEZ. Deporte(s): Boccia. Localidad: Kennedy. Resolución R-D Nº 386. Vigente hasta 2027-04-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153342014', phone),
      email       = COALESCE('clubaguilasdoradaspc@yahoo.com', email),
      sports      = ARRAY['Boccia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "386", "resolucion_actualizacion": null, "fecha_inicio": "28-04-2022", "fecha_fin": "2027-04-28", "presidente": "ABELARDO CASTRO BOHORQUEZ", "localidad": "Kennedy", "sports": ["Boccia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-boccia-aguilas-doradas-386';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3153342014', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BOGOTA SKATING CLUB  (IDRD-CLUB-bogota-skating-club-406)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bogota-skating-club-406';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOGOTA SKATING CLUB',
      'Presidente: JOSE SEBASTIAN GOMEZ ROMERO. Deporte(s): Patinaje. Resolución R-D Nº 406. Vigente hasta 2027-05-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3133889027',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bogota-skating-club-406',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bogota-skating-club-406', v_school_id, '{"resolucion_rd": "406", "resolucion_actualizacion": null, "fecha_inicio": "03-05-2022", "fecha_fin": "2027-05-03", "presidente": "JOSE SEBASTIAN GOMEZ ROMERO", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE SEBASTIAN GOMEZ ROMERO. Deporte(s): Patinaje. Resolución R-D Nº 406. Vigente hasta 2027-05-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133889027', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "406", "resolucion_actualizacion": null, "fecha_inicio": "03-05-2022", "fecha_fin": "2027-05-03", "presidente": "JOSE SEBASTIAN GOMEZ ROMERO", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bogota-skating-club-406';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LUCERO AZUL SPORT  (IDRD-CLUB-club-deportivo-lucero-azul-sport-349)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lucero-azul-sport-349';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LUCERO AZUL SPORT',
      'Presidente: JOHANNA MILENA TIVAQUIRA URREA. Deporte(s): Atletismo, Baloncesto, Ciclismo, Fútbol, Fútbol de salón, Natación, Patinaje, Taekwondo, Tenis, Voleibol. Resolución R-D Nº 349. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3104548814',
      NULL,
      ARRAY['Atletismo','Baloncesto','Ciclismo','Fútbol','Fútbol de salón','Natación','Patinaje','Taekwondo','Tenis','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lucero-azul-sport-349',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lucero-azul-sport-349', v_school_id, '{"resolucion_rd": "349", "resolucion_actualizacion": null, "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "JOHANNA MILENA TIVAQUIRA URREA", "localidad": null, "sports": ["Atletismo", "Baloncesto", "Ciclismo", "Fútbol", "Fútbol de salón", "Natación", "Patinaje", "Taekwondo", "Tenis", "Voleibol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANNA MILENA TIVAQUIRA URREA. Deporte(s): Atletismo, Baloncesto, Ciclismo, Fútbol, Fútbol de salón, Natación, Patinaje, Taekwondo, Tenis, Voleibol. Resolución R-D Nº 349. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3104548814', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Atletismo','Baloncesto','Ciclismo','Fútbol','Fútbol de salón','Natación','Patinaje','Taekwondo','Tenis','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "349", "resolucion_actualizacion": null, "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "JOHANNA MILENA TIVAQUIRA URREA", "localidad": null, "sports": ["Atletismo", "Baloncesto", "Ciclismo", "Fútbol", "Fútbol de salón", "Natación", "Patinaje", "Taekwondo", "Tenis", "Voleibol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lucero-azul-sport-349';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALIANZA BETEL  (IDRD-CLUB-club-deportivo-alianza-betel-412)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alianza-betel-412';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALIANZA BETEL',
      'Presidente: VLADIMIR OVALLE GONZALEZ. Deporte(s): Fútbol. Resolución R-D Nº 412. Vigente hasta 2027-05-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3115990073',
      'contacto@colmenaresasociados.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alianza-betel-412',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alianza-betel-412', v_school_id, '{"resolucion_rd": "412", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2022", "fecha_fin": "2027-05-04", "presidente": "VLADIMIR OVALLE GONZALEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VLADIMIR OVALLE GONZALEZ. Deporte(s): Fútbol. Resolución R-D Nº 412. Vigente hasta 2027-05-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115990073', phone),
      email       = COALESCE('contacto@colmenaresasociados.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "412", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2022", "fecha_fin": "2027-05-04", "presidente": "VLADIMIR OVALLE GONZALEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alianza-betel-412';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPITAL FUTSAL  (IDRD-CLUB-capital-futsal-413)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capital-futsal-413';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPITAL FUTSAL',
      'Presidente: JEFERSSON LOPEZ RODRIGUEZ. Deporte(s): Fútbol de salón. Localidad: Engativá. Resolución R-D Nº 413. Vigente hasta 2027-05-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3212325263',
      'capitalfutsalfc@hotmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capital-futsal-413',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capital-futsal-413', v_school_id, '{"resolucion_rd": "413", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2022", "fecha_fin": "2027-05-04", "presidente": "JEFERSSON LOPEZ RODRIGUEZ", "localidad": "Engativá", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEFERSSON LOPEZ RODRIGUEZ. Deporte(s): Fútbol de salón. Localidad: Engativá. Resolución R-D Nº 413. Vigente hasta 2027-05-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212325263', phone),
      email       = COALESCE('capitalfutsalfc@hotmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "413", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2022", "fecha_fin": "2027-05-04", "presidente": "JEFERSSON LOPEZ RODRIGUEZ", "localidad": "Engativá", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capital-futsal-413';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3212325263', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BOXING CLUB COLOMBIA  (IDRD-CLUB-boxing-club-colombia-420)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-boxing-club-colombia-420';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOXING CLUB COLOMBIA',
      'Presidente: LEONARDO ARTURO ORJUELA VELASCO. Deporte(s): Boxeo. Localidad: Teusaquillo. Resolución R-D Nº 420. Vigente hasta 2027-05-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3197361386',
      'boxingclubcolombia@gmail.com',
      ARRAY['Boxeo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'boxing-club-colombia-420',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-boxing-club-colombia-420', v_school_id, '{"resolucion_rd": "420", "resolucion_actualizacion": null, "fecha_inicio": "05-05-2022", "fecha_fin": "2027-05-05", "presidente": "LEONARDO ARTURO ORJUELA VELASCO", "localidad": "Teusaquillo", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEONARDO ARTURO ORJUELA VELASCO. Deporte(s): Boxeo. Localidad: Teusaquillo. Resolución R-D Nº 420. Vigente hasta 2027-05-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3197361386', phone),
      email       = COALESCE('boxingclubcolombia@gmail.com', email),
      sports      = ARRAY['Boxeo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "420", "resolucion_actualizacion": null, "fecha_inicio": "05-05-2022", "fecha_fin": "2027-05-05", "presidente": "LEONARDO ARTURO ORJUELA VELASCO", "localidad": "Teusaquillo", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-boxing-club-colombia-420';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3197361386', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TITANES CIEGOS CLUB  (IDRD-CLUB-titanes-ciegos-club-441)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-titanes-ciegos-club-441';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TITANES CIEGOS CLUB',
      'Presidente: ZAMIR GONZALEZ CORTAZAR. Deporte(s): Discapacidad Visual. Resolución R-D Nº 441. Vigente hasta 2027-05-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3104787890',
      'titanesciegosclub@gmail.com',
      ARRAY['Discapacidad Visual']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'titanes-ciegos-club-441',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-titanes-ciegos-club-441', v_school_id, '{"resolucion_rd": "441", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2022", "fecha_fin": "2027-05-09", "presidente": "ZAMIR GONZALEZ CORTAZAR", "localidad": null, "sports": ["Discapacidad Visual"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ZAMIR GONZALEZ CORTAZAR. Deporte(s): Discapacidad Visual. Resolución R-D Nº 441. Vigente hasta 2027-05-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3104787890', phone),
      email       = COALESCE('titanesciegosclub@gmail.com', email),
      sports      = ARRAY['Discapacidad Visual']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "441", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2022", "fecha_fin": "2027-05-09", "presidente": "ZAMIR GONZALEZ CORTAZAR", "localidad": null, "sports": ["Discapacidad Visual"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-titanes-ciegos-club-441';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KENZUKI  (IDRD-CLUB-club-deportivo-kenzuki-453)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kenzuki-453';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KENZUKI',
      'Presidente: ELKIN DAVID FRANCO AMORTEGUI. Deporte(s): Fútbol de salón. Resolución R-D Nº 453 / actualización Nº ELKIN DAVID FRANCO AMORTEGUI. Vigente hasta 2027-05-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3154856323',
      'clubdeportivoknz@kenzukijenas.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kenzuki-453',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kenzuki-453', v_school_id, '{"resolucion_rd": "453", "resolucion_actualizacion": "ELKIN DAVID FRANCO AMORTEGUI", "fecha_inicio": "12-05-2022", "fecha_fin": "2027-05-12", "presidente": "ELKIN DAVID FRANCO AMORTEGUI", "localidad": null, "sports": ["Fútbol de salón"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELKIN DAVID FRANCO AMORTEGUI. Deporte(s): Fútbol de salón. Resolución R-D Nº 453 / actualización Nº ELKIN DAVID FRANCO AMORTEGUI. Vigente hasta 2027-05-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3154856323', phone),
      email       = COALESCE('clubdeportivoknz@kenzukijenas.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "453", "resolucion_actualizacion": "ELKIN DAVID FRANCO AMORTEGUI", "fecha_inicio": "12-05-2022", "fecha_fin": "2027-05-12", "presidente": "ELKIN DAVID FRANCO AMORTEGUI", "localidad": null, "sports": ["Fútbol de salón"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kenzuki-453';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO TAIKIHKWAN  (IDRD-CLUB-club-deportivo-de-taekwondo-taikihkwan-408)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-taikihkwan-408';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO TAIKIHKWAN',
      'Presidente: PAULA ANDREA GARZON ALMARIO. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 408. Vigente hasta 2027-05-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3219054012',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-taikihkwan-408',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-taikihkwan-408', v_school_id, '{"resolucion_rd": "408", "resolucion_actualizacion": null, "fecha_inicio": "03-05-2022", "fecha_fin": "2027-05-03", "presidente": "PAULA ANDREA GARZON ALMARIO", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAULA ANDREA GARZON ALMARIO. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 408. Vigente hasta 2027-05-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219054012', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "408", "resolucion_actualizacion": null, "fecha_inicio": "03-05-2022", "fecha_fin": "2027-05-03", "presidente": "PAULA ANDREA GARZON ALMARIO", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-taikihkwan-408';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3219054012', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LIGHTNING COLOMBIA  (IDRD-CLUB-lightning-colombia-525)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-lightning-colombia-525';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LIGHTNING COLOMBIA',
      'Presidente: ERIC SAMUEL TYNDALL. Deporte(s): Hockey Sobre Hielo. Localidad: Usaquén. Resolución R-D Nº 525. Vigente hasta 2027-06-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3142541354',
      'lightninghockeycolombia@gmail.com',
      ARRAY['Hockey Sobre Hielo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'lightning-colombia-525',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-lightning-colombia-525', v_school_id, '{"resolucion_rd": "525", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2022", "fecha_fin": "2027-06-09", "presidente": "ERIC SAMUEL TYNDALL", "localidad": "Usaquén", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ERIC SAMUEL TYNDALL. Deporte(s): Hockey Sobre Hielo. Localidad: Usaquén. Resolución R-D Nº 525. Vigente hasta 2027-06-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142541354', phone),
      email       = COALESCE('lightninghockeycolombia@gmail.com', email),
      sports      = ARRAY['Hockey Sobre Hielo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "525", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2022", "fecha_fin": "2027-06-09", "presidente": "ERIC SAMUEL TYNDALL", "localidad": "Usaquén", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-lightning-colombia-525';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3142541354', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MAS QUE VENCEDORES BMX CLUB  (IDRD-CLUB-mas-que-vencedores-bmx-club-504)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-mas-que-vencedores-bmx-club-504';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MAS QUE VENCEDORES BMX CLUB',
      'Presidente: YEISON DIRCEO FLOREZ FIERRO. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 504. Vigente hasta 2027-05-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3222002010',
      NULL,
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'mas-que-vencedores-bmx-club-504',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-mas-que-vencedores-bmx-club-504', v_school_id, '{"resolucion_rd": "504", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2022", "fecha_fin": "2027-05-19", "presidente": "YEISON DIRCEO FLOREZ FIERRO", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YEISON DIRCEO FLOREZ FIERRO. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 504. Vigente hasta 2027-05-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222002010', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "504", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2022", "fecha_fin": "2027-05-19", "presidente": "YEISON DIRCEO FLOREZ FIERRO", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-mas-que-vencedores-bmx-club-504';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3222002010', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FENIX B.D.C  (IDRD-CLUB-fenix-bdc-558)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fenix-bdc-558';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FENIX B.D.C',
      'Presidente: FABIAN ALBERTO ZAMUDIO AVILA. Deporte(s): Fútbol. Resolución R-D Nº 558. Vigente hasta 2027-06-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3058765856',
      'jfenixbogotadc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fenix-bdc-558',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fenix-bdc-558', v_school_id, '{"resolucion_rd": "558", "resolucion_actualizacion": null, "fecha_inicio": "01-06-2022", "fecha_fin": "2027-06-01", "presidente": "FABIAN ALBERTO ZAMUDIO AVILA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIAN ALBERTO ZAMUDIO AVILA. Deporte(s): Fútbol. Resolución R-D Nº 558. Vigente hasta 2027-06-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3058765856', phone),
      email       = COALESCE('jfenixbogotadc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "558", "resolucion_actualizacion": null, "fecha_inicio": "01-06-2022", "fecha_fin": "2027-06-01", "presidente": "FABIAN ALBERTO ZAMUDIO AVILA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fenix-bdc-558';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EMPRESARIAL VORRUSIA LIVE SPORT SAS  (IDRD-CLUB-club-deportivo-empresarial-vorrusia-live-548)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-empresarial-vorrusia-live-548';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EMPRESARIAL VORRUSIA LIVE SPORT SAS',
      'Presidente: RAFAEL PEREZ MORENO. Deporte(s): Fútbol, Natación, Baloncesto. Localidad: Tunjuelito. Resolución R-D Nº 548 / actualización Nº RAFAEL PEREZ MORENO. Vigente hasta 2027-06-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3208181417',
      'vorrusialivesports@gmail.com',
      ARRAY['Fútbol','Natación','Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-empresarial-vorrusia-live-548',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-empresarial-vorrusia-live-548', v_school_id, '{"resolucion_rd": "548", "resolucion_actualizacion": "RAFAEL PEREZ MORENO", "fecha_inicio": "01-06-2022", "fecha_fin": "2027-06-01", "presidente": "RAFAEL PEREZ MORENO", "localidad": "Tunjuelito", "sports": ["Fútbol", "Natación", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAFAEL PEREZ MORENO. Deporte(s): Fútbol, Natación, Baloncesto. Localidad: Tunjuelito. Resolución R-D Nº 548 / actualización Nº RAFAEL PEREZ MORENO. Vigente hasta 2027-06-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208181417', phone),
      email       = COALESCE('vorrusialivesports@gmail.com', email),
      sports      = ARRAY['Fútbol','Natación','Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "548", "resolucion_actualizacion": "RAFAEL PEREZ MORENO", "fecha_inicio": "01-06-2022", "fecha_fin": "2027-06-01", "presidente": "RAFAEL PEREZ MORENO", "localidad": "Tunjuelito", "sports": ["Fútbol", "Natación", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-empresarial-vorrusia-live-548';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3208181417', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SKATE NED  (IDRD-CLUB-skate-ned-560)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-skate-ned-560';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SKATE NED',
      'Presidente: NELSON SOLER GARCIA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 560. Vigente hasta 2027-06-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3152929569',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'skate-ned-560',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-skate-ned-560', v_school_id, '{"resolucion_rd": "560", "resolucion_actualizacion": null, "fecha_inicio": "02-06-2022", "fecha_fin": "2027-06-02", "presidente": "NELSON SOLER GARCIA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NELSON SOLER GARCIA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 560. Vigente hasta 2027-06-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3152929569', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "560", "resolucion_actualizacion": null, "fecha_inicio": "02-06-2022", "fecha_fin": "2027-06-02", "presidente": "NELSON SOLER GARCIA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-skate-ned-560';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3152929569', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUNDACIÃN DEPORTIVA HURACAN NUEVA ERA  (IDRD-CLUB-fundacian-deportiva-huracan-nueva-era-561)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fundacian-deportiva-huracan-nueva-era-561';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUNDACIÃN DEPORTIVA HURACAN NUEVA ERA',
      'Presidente: LUIS MAGEN MONTAÃO DAJOME. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 561. Vigente hasta 2027-06-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3003056941',
      'fundahuracan@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fundacian-deportiva-huracan-nueva-era-561',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fundacian-deportiva-huracan-nueva-era-561', v_school_id, '{"resolucion_rd": "561", "resolucion_actualizacion": null, "fecha_inicio": "02-06-2022", "fecha_fin": "2027-06-02", "presidente": "LUIS MAGEN MONTAÃO DAJOME", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS MAGEN MONTAÃO DAJOME. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 561. Vigente hasta 2027-06-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003056941', phone),
      email       = COALESCE('fundahuracan@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "561", "resolucion_actualizacion": null, "fecha_inicio": "02-06-2022", "fecha_fin": "2027-06-02", "presidente": "LUIS MAGEN MONTAÃO DAJOME", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fundacian-deportiva-huracan-nueva-era-561';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3003056941', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- C.D.Y.M  (IDRD-CLUB-cdym-565)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cdym-565';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'C.D.Y.M',
      'Presidente: ROGER STEVEN MOSQUERA ORJUELA. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 565. Vigente hasta 2028-05-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3008620804',
      'clubdeportivoyesidmosquera@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cdym-565',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cdym-565', v_school_id, '{"resolucion_rd": "565", "resolucion_actualizacion": null, "fecha_inicio": "01-06-2023", "fecha_fin": "2028-05-31", "presidente": "ROGER STEVEN MOSQUERA ORJUELA", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROGER STEVEN MOSQUERA ORJUELA. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 565. Vigente hasta 2028-05-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008620804', phone),
      email       = COALESCE('clubdeportivoyesidmosquera@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "565", "resolucion_actualizacion": null, "fecha_inicio": "01-06-2023", "fecha_fin": "2028-05-31", "presidente": "ROGER STEVEN MOSQUERA ORJUELA", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cdym-565';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3008620804', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GALÃCTICOS F.C,  (IDRD-CLUB-galacticos-fc-581)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-galacticos-fc-581';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GALÃCTICOS F.C,',
      'Presidente: EDWIN ALEGRÃA ARBOLEDA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 581. Vigente hasta 2027-06-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3156439495',
      'edwin.alegria2011@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'galacticos-fc-581',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-galacticos-fc-581', v_school_id, '{"resolucion_rd": "581", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2022", "fecha_fin": "2027-06-09", "presidente": "EDWIN ALEGRÃA ARBOLEDA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN ALEGRÃA ARBOLEDA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 581. Vigente hasta 2027-06-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3156439495', phone),
      email       = COALESCE('edwin.alegria2011@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "581", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2022", "fecha_fin": "2027-06-09", "presidente": "EDWIN ALEGRÃA ARBOLEDA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-galacticos-fc-581';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3156439495', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PATÃN CRISTAL BOGOTÃ  (IDRD-CLUB-club-deportivo-patan-cristal-bogota-582)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-patan-cristal-bogota-582';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PATÃN CRISTAL BOGOTÃ',
      'Presidente: SONIA KATHERINE OSPINA MORENO,. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 582. Vigente hasta 2027-06-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3006586266',
      'patincristal@yahoo.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-patan-cristal-bogota-582',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-patan-cristal-bogota-582', v_school_id, '{"resolucion_rd": "582", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2022", "fecha_fin": "2027-06-09", "presidente": "SONIA KATHERINE OSPINA MORENO,", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SONIA KATHERINE OSPINA MORENO,. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 582. Vigente hasta 2027-06-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006586266', phone),
      email       = COALESCE('patincristal@yahoo.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "582", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2022", "fecha_fin": "2027-06-09", "presidente": "SONIA KATHERINE OSPINA MORENO,", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-patan-cristal-bogota-582';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3006586266', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO PYONGWON  (IDRD-CLUB-club-deportivo-taekwondo-pyongwon-632)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-pyongwon-632';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO PYONGWON',
      'Presidente: JONNY ARLEY PARRA DAZA. Resolución R-D Nº 632. Vigente hasta 2027-06-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3107551768',
      'pyongwonclubdeportivo@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-pyongwon-632',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-pyongwon-632', v_school_id, '{"resolucion_rd": "632", "resolucion_actualizacion": null, "fecha_inicio": "16-06-2022", "fecha_fin": "2027-06-16", "presidente": "JONNY ARLEY PARRA DAZA", "localidad": null, "sports": [], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JONNY ARLEY PARRA DAZA. Resolución R-D Nº 632. Vigente hasta 2027-06-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107551768', phone),
      email       = COALESCE('pyongwonclubdeportivo@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "632", "resolucion_actualizacion": null, "fecha_inicio": "16-06-2022", "fecha_fin": "2027-06-16", "presidente": "JONNY ARLEY PARRA DAZA", "localidad": null, "sports": [], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-pyongwon-632';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ATHENAS D.C  (IDRD-CLUB-athenas-dc-633)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-athenas-dc-633';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATHENAS D.C',
      'Presidente: JORGE ELIECER RODRÃGUEZ RODRÃGUEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 633. Vigente hasta 2027-06-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3214192968',
      'academiadeportivaathenas@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'athenas-dc-633',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-athenas-dc-633', v_school_id, '{"resolucion_rd": "633", "resolucion_actualizacion": null, "fecha_inicio": "16-06-2022", "fecha_fin": "2027-06-16", "presidente": "JORGE ELIECER RODRÃGUEZ RODRÃGUEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE ELIECER RODRÃGUEZ RODRÃGUEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 633. Vigente hasta 2027-06-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214192968', phone),
      email       = COALESCE('academiadeportivaathenas@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "633", "resolucion_actualizacion": null, "fecha_inicio": "16-06-2022", "fecha_fin": "2027-06-16", "presidente": "JORGE ELIECER RODRÃGUEZ RODRÃGUEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-athenas-dc-633';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3214192968', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SPEED RIDER SKATE  (IDRD-CLUB-speed-rider-skate-643)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-speed-rider-skate-643';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPEED RIDER SKATE',
      'Presidente: SHARON NATALIA BUSTOS OCHOA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 643. Vigente hasta 2027-06-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3219266921',
      'natab1019@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'speed-rider-skate-643',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-speed-rider-skate-643', v_school_id, '{"resolucion_rd": "643", "resolucion_actualizacion": null, "fecha_inicio": "17-06-2022", "fecha_fin": "2027-06-17", "presidente": "SHARON NATALIA BUSTOS OCHOA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SHARON NATALIA BUSTOS OCHOA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 643. Vigente hasta 2027-06-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219266921', phone),
      email       = COALESCE('natab1019@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "643", "resolucion_actualizacion": null, "fecha_inicio": "17-06-2022", "fecha_fin": "2027-06-17", "presidente": "SHARON NATALIA BUSTOS OCHOA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-speed-rider-skate-643';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3219266921', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- K1DO TIGRES BLANCOS DOJANG K1DOJANG  (IDRD-CLUB-k1do-tigres-blancos-dojang-k1dojang-649)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-k1do-tigres-blancos-dojang-k1dojang-649';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'K1DO TIGRES BLANCOS DOJANG K1DOJANG',
      'Presidente: JUAN PABLO DUQUE CRUZ. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 649. Vigente hasta 2027-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3102266709',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'k1do-tigres-blancos-dojang-k1dojang-649',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-k1do-tigres-blancos-dojang-k1dojang-649', v_school_id, '{"resolucion_rd": "649", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2022", "fecha_fin": "2027-06-21", "presidente": "JUAN PABLO DUQUE CRUZ", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO DUQUE CRUZ. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 649. Vigente hasta 2027-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102266709', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "649", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2022", "fecha_fin": "2027-06-21", "presidente": "JUAN PABLO DUQUE CRUZ", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-k1do-tigres-blancos-dojang-k1dojang-649';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3102266709', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLÃTICO D.C  (IDRD-CLUB-club-deportivo-atlatico-dc-635)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-dc-635';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLÃTICO D.C',
      'Presidente: CAMILO ANDRÃS ESCUDERO ORTÃZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 635. Vigente hasta 2027-06-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3204752798',
      'atleticodc.bogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlatico-dc-635',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlatico-dc-635', v_school_id, '{"resolucion_rd": "635", "resolucion_actualizacion": null, "fecha_inicio": "16-06-2022", "fecha_fin": "2027-06-16", "presidente": "CAMILO ANDRÃS ESCUDERO ORTÃZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ANDRÃS ESCUDERO ORTÃZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 635. Vigente hasta 2027-06-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204752798', phone),
      email       = COALESCE('atleticodc.bogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "635", "resolucion_actualizacion": null, "fecha_inicio": "16-06-2022", "fecha_fin": "2027-06-16", "presidente": "CAMILO ANDRÃS ESCUDERO ORTÃZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-dc-635';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3204752798', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MONARCA F.C  (IDRD-CLUB-monarca-fc-655)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-monarca-fc-655';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MONARCA F.C',
      'Presidente: PABLO ANDRES ARIAS GARCIA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 655. Vigente hasta 2027-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3174040820',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'monarca-fc-655',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-monarca-fc-655', v_school_id, '{"resolucion_rd": "655", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2022", "fecha_fin": "2027-06-21", "presidente": "PABLO ANDRES ARIAS GARCIA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PABLO ANDRES ARIAS GARCIA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 655. Vigente hasta 2027-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174040820', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "655", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2022", "fecha_fin": "2027-06-21", "presidente": "PABLO ANDRES ARIAS GARCIA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-monarca-fc-655';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3174040820', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALIANZA SUA  (IDRD-CLUB-club-deportivo-alianza-sua-670)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alianza-sua-670';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALIANZA SUA',
      'Presidente: CRISTIAN CAMILO CRISTANCHO BERNAL. Deporte(s): Fútbol, Fútbol de salón. Localidad: Ciudad Bolívar. Resolución R-D Nº 670 / actualización Nº 1034. Vigente hasta 2027-07-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3173553439',
      'alianzasua@gmail.com',
      ARRAY['Fútbol','Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alianza-sua-670',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alianza-sua-670', v_school_id, '{"resolucion_rd": "670", "resolucion_actualizacion": "1034", "fecha_inicio": "15-07-2022", "fecha_fin": "2027-07-15", "presidente": "CRISTIAN CAMILO CRISTANCHO BERNAL", "localidad": "Ciudad Bolívar", "sports": ["Fútbol", "Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN CAMILO CRISTANCHO BERNAL. Deporte(s): Fútbol, Fútbol de salón. Localidad: Ciudad Bolívar. Resolución R-D Nº 670 / actualización Nº 1034. Vigente hasta 2027-07-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173553439', phone),
      email       = COALESCE('alianzasua@gmail.com', email),
      sports      = ARRAY['Fútbol','Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "670", "resolucion_actualizacion": "1034", "fecha_inicio": "15-07-2022", "fecha_fin": "2027-07-15", "presidente": "CRISTIAN CAMILO CRISTANCHO BERNAL", "localidad": "Ciudad Bolívar", "sports": ["Fútbol", "Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alianza-sua-670';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3173553439', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TEAM SPIRIT ACADEMY S.C  (IDRD-CLUB-team-spirit-academy-sc-671)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-team-spirit-academy-sc-671';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TEAM SPIRIT ACADEMY S.C',
      'Presidente: ROLANDO BELLO SANABRIA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 671. Vigente hasta 2027-06-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3134731898',
      'info@teamspirit21.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'team-spirit-academy-sc-671',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-team-spirit-academy-sc-671', v_school_id, '{"resolucion_rd": "671", "resolucion_actualizacion": null, "fecha_inicio": "22-06-2022", "fecha_fin": "2027-06-22", "presidente": "ROLANDO BELLO SANABRIA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROLANDO BELLO SANABRIA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 671. Vigente hasta 2027-06-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134731898', phone),
      email       = COALESCE('info@teamspirit21.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "671", "resolucion_actualizacion": null, "fecha_inicio": "22-06-2022", "fecha_fin": "2027-06-22", "presidente": "ROLANDO BELLO SANABRIA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-team-spirit-academy-sc-671';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3134731898', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO P&Z  (IDRD-CLUB-club-deportivo-pz-676)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pz-676';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO P&Z',
      'Presidente: CARLOS ALBERTO MARTINEZ. Deporte(s): Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 676. Vigente hasta 2027-06-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3209628276',
      'club.pyz@outlook.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pz-676',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pz-676', v_school_id, '{"resolucion_rd": "676", "resolucion_actualizacion": null, "fecha_inicio": "23-06-2022", "fecha_fin": "2027-06-23", "presidente": "CARLOS ALBERTO MARTINEZ", "localidad": "Kennedy", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALBERTO MARTINEZ. Deporte(s): Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 676. Vigente hasta 2027-06-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209628276', phone),
      email       = COALESCE('club.pyz@outlook.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "676", "resolucion_actualizacion": null, "fecha_inicio": "23-06-2022", "fecha_fin": "2027-06-23", "presidente": "CARLOS ALBERTO MARTINEZ", "localidad": "Kennedy", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pz-676';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3209628276', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GENERACIÃN G  (IDRD-CLUB-generacian-g-242)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-generacian-g-242';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GENERACIÃN G',
      'Presidente: EDWIN ALFONSO GUEVARA CABANILLAS. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 242. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3012931535',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'generacian-g-242',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-generacian-g-242', v_school_id, '{"resolucion_rd": "242", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "EDWIN ALFONSO GUEVARA CABANILLAS", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN ALFONSO GUEVARA CABANILLAS. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 242. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012931535', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "242", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "EDWIN ALFONSO GUEVARA CABANILLAS", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-generacian-g-242';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3012931535', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PASION AZULGRANA  (IDRD-CLUB-pasion-azulgrana-688)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-pasion-azulgrana-688';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PASION AZULGRANA',
      'Presidente: JEFFERSON ANDERSON PAEZ LOPEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 688. Vigente hasta 2027-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3107747478',
      'japeaz86@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'pasion-azulgrana-688',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-pasion-azulgrana-688', v_school_id, '{"resolucion_rd": "688", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2022", "fecha_fin": "2027-06-28", "presidente": "JEFFERSON ANDERSON PAEZ LOPEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEFFERSON ANDERSON PAEZ LOPEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 688. Vigente hasta 2027-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107747478', phone),
      email       = COALESCE('japeaz86@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "688", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2022", "fecha_fin": "2027-06-28", "presidente": "JEFFERSON ANDERSON PAEZ LOPEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-pasion-azulgrana-688';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3107747478', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TFC OPEN  (IDRD-CLUB-tfc-open-721)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tfc-open-721';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TFC OPEN',
      'Presidente: RICARDO ANDRES NIETO BARATO. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 721. Vigente hasta 2027-07-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3165279015',
      'ricardo@tfcopen.co',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tfc-open-721',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tfc-open-721', v_school_id, '{"resolucion_rd": "721", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2022", "fecha_fin": "2027-07-05", "presidente": "RICARDO ANDRES NIETO BARATO", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICARDO ANDRES NIETO BARATO. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 721. Vigente hasta 2027-07-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165279015', phone),
      email       = COALESCE('ricardo@tfcopen.co', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "721", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2022", "fecha_fin": "2027-07-05", "presidente": "RICARDO ANDRES NIETO BARATO", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tfc-open-721';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3165279015', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GORILAS DE BOGOTA BASKETBALL CLUB  (IDRD-CLUB-club-deportivo-gorilas-de-bogota-basketb-1067)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-gorilas-de-bogota-basketb-1067';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GORILAS DE BOGOTA BASKETBALL CLUB',
      'Presidente: SANTIAGO FEDERICO MERCHAN HERRERA. Deporte(s): Baloncesto. Localidad: Usaquén. Resolución R-D Nº 1067. Vigente hasta 2030-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3184492381',
      'mhesan9@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-gorilas-de-bogota-basketb-1067',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-gorilas-de-bogota-basketb-1067', v_school_id, '{"resolucion_rd": "1067", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2025", "fecha_fin": "2030-10-07", "presidente": "SANTIAGO FEDERICO MERCHAN HERRERA", "localidad": "Usaquén", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO FEDERICO MERCHAN HERRERA. Deporte(s): Baloncesto. Localidad: Usaquén. Resolución R-D Nº 1067. Vigente hasta 2030-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3184492381', phone),
      email       = COALESCE('mhesan9@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1067", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2025", "fecha_fin": "2030-10-07", "presidente": "SANTIAGO FEDERICO MERCHAN HERRERA", "localidad": "Usaquén", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-gorilas-de-bogota-basketb-1067';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3184492381', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ANGELES BOGOTA  (IDRD-CLUB-angeles-bogota-700)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-angeles-bogota-700';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ANGELES BOGOTA',
      'Presidente: JARWIN YEZID VEGA SANDOVAL. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 700. Vigente hasta 2027-06-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3105023681',
      NULL,
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'angeles-bogota-700',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-angeles-bogota-700', v_school_id, '{"resolucion_rd": "700", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2022", "fecha_fin": "2027-06-29", "presidente": "JARWIN YEZID VEGA SANDOVAL", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JARWIN YEZID VEGA SANDOVAL. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 700. Vigente hasta 2027-06-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105023681', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "700", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2022", "fecha_fin": "2027-06-29", "presidente": "JARWIN YEZID VEGA SANDOVAL", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-angeles-bogota-700';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3105023681', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUNDACIÃN DVSPORT  (IDRD-CLUB-fundacian-dvsport-759)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fundacian-dvsport-759';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUNDACIÃN DVSPORT',
      'Presidente: RAFAEL ROBERTO NORIEGA ORTEGA. Deporte(s): Balonmano, Voleibol. Localidad: Fontibón. Resolución R-D Nº 759. Vigente hasta 2027-07-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3138522711',
      'dvsportvolley@gmail.com',
      ARRAY['Balonmano','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fundacian-dvsport-759',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fundacian-dvsport-759', v_school_id, '{"resolucion_rd": "759", "resolucion_actualizacion": null, "fecha_inicio": "12-07-2022", "fecha_fin": "2027-07-12", "presidente": "RAFAEL ROBERTO NORIEGA ORTEGA", "localidad": "Fontibón", "sports": ["Balonmano", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAFAEL ROBERTO NORIEGA ORTEGA. Deporte(s): Balonmano, Voleibol. Localidad: Fontibón. Resolución R-D Nº 759. Vigente hasta 2027-07-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138522711', phone),
      email       = COALESCE('dvsportvolley@gmail.com', email),
      sports      = ARRAY['Balonmano','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "759", "resolucion_actualizacion": null, "fecha_inicio": "12-07-2022", "fecha_fin": "2027-07-12", "presidente": "RAFAEL ROBERTO NORIEGA ORTEGA", "localidad": "Fontibón", "sports": ["Balonmano", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fundacian-dvsport-759';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3138522711', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AJEDREZ FORMANDO LIDERES  (IDRD-CLUB-club-deportivo-ajedrez-formando-lideres-733)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ajedrez-formando-lideres-733';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AJEDREZ FORMANDO LIDERES',
      'Presidente: JUAN GUILLERMO ARBOLEDA RODRIGUEZ. Deporte(s): Ajedrez. Localidad: Puente Aranda. Resolución R-D Nº 733 / actualización Nº 193. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3108515799',
      'chessclubformandolideres@gmail.com',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ajedrez-formando-lideres-733',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ajedrez-formando-lideres-733', v_school_id, '{"resolucion_rd": "733", "resolucion_actualizacion": "193", "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "JUAN GUILLERMO ARBOLEDA RODRIGUEZ", "localidad": "Puente Aranda", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN GUILLERMO ARBOLEDA RODRIGUEZ. Deporte(s): Ajedrez. Localidad: Puente Aranda. Resolución R-D Nº 733 / actualización Nº 193. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108515799', phone),
      email       = COALESCE('chessclubformandolideres@gmail.com', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "733", "resolucion_actualizacion": "193", "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "JUAN GUILLERMO ARBOLEDA RODRIGUEZ", "localidad": "Puente Aranda", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ajedrez-formando-lideres-733';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3108515799', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TAEKWONDO TKDCONVOY,  (IDRD-CLUB-taekwondo-tkdconvoy-812)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taekwondo-tkdconvoy-812';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEKWONDO TKDCONVOY,',
      'Presidente: DIANA MARCELA BELTRAN CADENA. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 812. Vigente hasta 2027-07-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3108076004',
      'omargarzon075@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taekwondo-tkdconvoy-812',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taekwondo-tkdconvoy-812', v_school_id, '{"resolucion_rd": "812", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2022", "fecha_fin": "2027-07-19", "presidente": "DIANA MARCELA BELTRAN CADENA", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA MARCELA BELTRAN CADENA. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 812. Vigente hasta 2027-07-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108076004', phone),
      email       = COALESCE('omargarzon075@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "812", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2022", "fecha_fin": "2027-07-19", "presidente": "DIANA MARCELA BELTRAN CADENA", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taekwondo-tkdconvoy-812';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3108076004', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GUECHAS  (IDRD-CLUB-club-deportivo-guechas-1298)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-guechas-1298';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GUECHAS',
      'Presidente: FABIO ALBERTO SALAS SUAREZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1298. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '4587203',
      'clubdeportivoguechas@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-guechas-1298',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-guechas-1298', v_school_id, '{"resolucion_rd": "1298", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "FABIO ALBERTO SALAS SUAREZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIO ALBERTO SALAS SUAREZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1298. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4587203', phone),
      email       = COALESCE('clubdeportivoguechas@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1298", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "FABIO ALBERTO SALAS SUAREZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-guechas-1298';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '4587203', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SEVEN BASKETBALL CLUB  (IDRD-CLUB-seven-basketball-club-816)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-seven-basketball-club-816';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SEVEN BASKETBALL CLUB',
      'Presidente: JIMMY ANTONIO CÃRDOBA MUÃOZ. Deporte(s): Baloncesto. Localidad: Usaquén. Resolución R-D Nº 816. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3105594645',
      'jimmy.cordoba7@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'seven-basketball-club-816',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-seven-basketball-club-816', v_school_id, '{"resolucion_rd": "816", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2022", "fecha_fin": "2027-08-05", "presidente": "JIMMY ANTONIO CÃRDOBA MUÃOZ", "localidad": "Usaquén", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JIMMY ANTONIO CÃRDOBA MUÃOZ. Deporte(s): Baloncesto. Localidad: Usaquén. Resolución R-D Nº 816. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105594645', phone),
      email       = COALESCE('jimmy.cordoba7@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "816", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2022", "fecha_fin": "2027-08-05", "presidente": "JIMMY ANTONIO CÃRDOBA MUÃOZ", "localidad": "Usaquén", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-seven-basketball-club-816';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3105594645', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BHQZ F.C  (IDRD-CLUB-bhqz-fc-825)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bhqz-fc-825';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BHQZ F.C',
      'Presidente: EDGAR ANDRÃS BOHÃRQUEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 825. Vigente hasta 2027-08-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3222238937',
      'andresbhqz@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bhqz-fc-825',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bhqz-fc-825', v_school_id, '{"resolucion_rd": "825", "resolucion_actualizacion": null, "fecha_inicio": "08-08-2022", "fecha_fin": "2027-08-08", "presidente": "EDGAR ANDRÃS BOHÃRQUEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR ANDRÃS BOHÃRQUEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 825. Vigente hasta 2027-08-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222238937', phone),
      email       = COALESCE('andresbhqz@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "825", "resolucion_actualizacion": null, "fecha_inicio": "08-08-2022", "fecha_fin": "2027-08-08", "presidente": "EDGAR ANDRÃS BOHÃRQUEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bhqz-fc-825';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3222238937', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE CICLISMO COLOMBIA IN  (IDRD-CLUB-club-deportivo-de-ciclismo-colombia-in-826)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-ciclismo-colombia-in-826';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE CICLISMO COLOMBIA IN',
      'Presidente: EDGAR ALAXANDER AGUIRRE. Deporte(s): Ciclismo. Localidad: Kennedy. Resolución R-D Nº 826. Vigente hasta 2027-07-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3219644833',
      'arte21puertas@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-ciclismo-colombia-in-826',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-ciclismo-colombia-in-826', v_school_id, '{"resolucion_rd": "826", "resolucion_actualizacion": null, "fecha_inicio": "21-07-2022", "fecha_fin": "2027-07-21", "presidente": "EDGAR ALAXANDER AGUIRRE", "localidad": "Kennedy", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR ALAXANDER AGUIRRE. Deporte(s): Ciclismo. Localidad: Kennedy. Resolución R-D Nº 826. Vigente hasta 2027-07-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219644833', phone),
      email       = COALESCE('arte21puertas@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "826", "resolucion_actualizacion": null, "fecha_inicio": "21-07-2022", "fecha_fin": "2027-07-21", "presidente": "EDGAR ALAXANDER AGUIRRE", "localidad": "Kennedy", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-ciclismo-colombia-in-826';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3219644833', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LUDOVITA  (IDRD-CLUB-club-deportivo-ludovita-1249)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ludovita-1249';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LUDOVITA',
      'Presidente: CLAUDIO ALONSO HERNANDEZ RODRIGUEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1249 / actualización Nº 627. Vigente hasta 2028-10-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3165393093',
      'claudiohernandez913@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ludovita-1249',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ludovita-1249', v_school_id, '{"resolucion_rd": "1249", "resolucion_actualizacion": "627", "fecha_inicio": "17-10-2023", "fecha_fin": "2028-10-16", "presidente": "CLAUDIO ALONSO HERNANDEZ RODRIGUEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIO ALONSO HERNANDEZ RODRIGUEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1249 / actualización Nº 627. Vigente hasta 2028-10-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165393093', phone),
      email       = COALESCE('claudiohernandez913@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1249", "resolucion_actualizacion": "627", "fecha_inicio": "17-10-2023", "fecha_fin": "2028-10-16", "presidente": "CLAUDIO ALONSO HERNANDEZ RODRIGUEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ludovita-1249';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3165393093', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTBOL SEVEN CAPITALINOS  (IDRD-CLUB-futbol-seven-capitalinos-839)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futbol-seven-capitalinos-839';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTBOL SEVEN CAPITALINOS',
      'Presidente: JUAN SEBASTIAN TORRES AGUILAR. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 839. Vigente hasta 2027-08-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3153672679',
      'futbol7capitalinos@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futbol-seven-capitalinos-839',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futbol-seven-capitalinos-839', v_school_id, '{"resolucion_rd": "839", "resolucion_actualizacion": null, "fecha_inicio": "04-08-2022", "fecha_fin": "2027-08-04", "presidente": "JUAN SEBASTIAN TORRES AGUILAR", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIAN TORRES AGUILAR. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 839. Vigente hasta 2027-08-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153672679', phone),
      email       = COALESCE('futbol7capitalinos@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "839", "resolucion_actualizacion": null, "fecha_inicio": "04-08-2022", "fecha_fin": "2027-08-04", "presidente": "JUAN SEBASTIAN TORRES AGUILAR", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futbol-seven-capitalinos-839';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3153672679', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SOCCER FUTURE  (IDRD-CLUB-club-deportivo-soccer-future-857)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-soccer-future-857';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SOCCER FUTURE',
      'Presidente: JOHN CARLOS RAMÃREZ MARTÃNEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 857. Vigente hasta 2027-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3112692620',
      'futuresoccer@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-soccer-future-857',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-soccer-future-857', v_school_id, '{"resolucion_rd": "857", "resolucion_actualizacion": null, "fecha_inicio": "11-08-2022", "fecha_fin": "2027-08-11", "presidente": "JOHN CARLOS RAMÃREZ MARTÃNEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN CARLOS RAMÃREZ MARTÃNEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 857. Vigente hasta 2027-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112692620', phone),
      email       = COALESCE('futuresoccer@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "857", "resolucion_actualizacion": null, "fecha_inicio": "11-08-2022", "fecha_fin": "2027-08-11", "presidente": "JOHN CARLOS RAMÃREZ MARTÃNEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-soccer-future-857';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3112692620', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PUMAS CRACK ÌS  (IDRD-CLUB-club-deportivo-pumas-crack-is-838)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pumas-crack-is-838';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PUMAS CRACK ÌS',
      'Presidente: JHON MANUEL SEGURA SANCHEZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 838 / actualización Nº 1760. Vigente hasta 2027-08-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '48481733185893221',
      'pumasbogotacolombia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pumas-crack-is-838',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pumas-crack-is-838', v_school_id, '{"resolucion_rd": "838", "resolucion_actualizacion": "1760", "fecha_inicio": "12-08-2022", "fecha_fin": "2027-08-12", "presidente": "JHON MANUEL SEGURA SANCHEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON MANUEL SEGURA SANCHEZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 838 / actualización Nº 1760. Vigente hasta 2027-08-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('48481733185893221', phone),
      email       = COALESCE('pumasbogotacolombia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "838", "resolucion_actualizacion": "1760", "fecha_inicio": "12-08-2022", "fecha_fin": "2027-08-12", "presidente": "JHON MANUEL SEGURA SANCHEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pumas-crack-is-838';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '48481733185893221', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FORZA CLUB DE ESGRIMA  (IDRD-CLUB-forza-club-de-esgrima-879)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-forza-club-de-esgrima-879';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FORZA CLUB DE ESGRIMA',
      'Presidente: SANTIAGO PACHON NIÃO. Deporte(s): Esgrima. Localidad: Engativá. Resolución R-D Nº 879. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3132192720',
      'forza.esgrima@gmail.com',
      ARRAY['Esgrima']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'forza-club-de-esgrima-879',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-forza-club-de-esgrima-879', v_school_id, '{"resolucion_rd": "879", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "SANTIAGO PACHON NIÃO", "localidad": "Engativá", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO PACHON NIÃO. Deporte(s): Esgrima. Localidad: Engativá. Resolución R-D Nº 879. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132192720', phone),
      email       = COALESCE('forza.esgrima@gmail.com', email),
      sports      = ARRAY['Esgrima']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "879", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "SANTIAGO PACHON NIÃO", "localidad": "Engativá", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-forza-club-de-esgrima-879';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3132192720', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LEYENDAS VOLEIBOL  (IDRD-CLUB-leyendas-voleibol-889)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-leyendas-voleibol-889';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEYENDAS VOLEIBOL',
      'Presidente: LUIS FELIPE CABRA HUERTAS. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 889. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3164522539',
      'lufe-28@hotmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'leyendas-voleibol-889',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-leyendas-voleibol-889', v_school_id, '{"resolucion_rd": "889", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "LUIS FELIPE CABRA HUERTAS", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS FELIPE CABRA HUERTAS. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 889. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3164522539', phone),
      email       = COALESCE('lufe-28@hotmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "889", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "LUIS FELIPE CABRA HUERTAS", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-leyendas-voleibol-889';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3164522539', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTSAL SPORTING  (IDRD-CLUB-futsal-sporting-913)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futsal-sporting-913';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTSAL SPORTING',
      'Presidente: JUAN CAMILO LUQUE CELI. Deporte(s): Fútbol de salón. Localidad: Engativá. Resolución R-D Nº 913. Vigente hasta 2027-08-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3052956002',
      'futsalsp99@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futsal-sporting-913',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futsal-sporting-913', v_school_id, '{"resolucion_rd": "913", "resolucion_actualizacion": null, "fecha_inicio": "24-08-2022", "fecha_fin": "2027-08-24", "presidente": "JUAN CAMILO LUQUE CELI", "localidad": "Engativá", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CAMILO LUQUE CELI. Deporte(s): Fútbol de salón. Localidad: Engativá. Resolución R-D Nº 913. Vigente hasta 2027-08-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3052956002', phone),
      email       = COALESCE('futsalsp99@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "913", "resolucion_actualizacion": null, "fecha_inicio": "24-08-2022", "fecha_fin": "2027-08-24", "presidente": "JUAN CAMILO LUQUE CELI", "localidad": "Engativá", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futsal-sporting-913';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3052956002', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- HURACÃN BOGOTÃ  (IDRD-CLUB-huracan-bogota-947)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-huracan-bogota-947';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'HURACÃN BOGOTÃ',
      'Presidente: LUIS EDUARDO GONZÃLEZ SARMIENTO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 947. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3112453119',
      'cahuracanbogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'huracan-bogota-947',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-huracan-bogota-947', v_school_id, '{"resolucion_rd": "947", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "LUIS EDUARDO GONZÃLEZ SARMIENTO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS EDUARDO GONZÃLEZ SARMIENTO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 947. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112453119', phone),
      email       = COALESCE('cahuracanbogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "947", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "LUIS EDUARDO GONZÃLEZ SARMIENTO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-huracan-bogota-947';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3112453119', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUVENTUD C.E.D.I.J  (IDRD-CLUB-juventud-cedij-952)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-juventud-cedij-952';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUVENTUD C.E.D.I.J',
      'Presidente: WILSON GIOVANNY VELANDIA BARRETO. Deporte(s): Fútbol, Voleibol. Localidad: Suba. Resolución R-D Nº 952. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3204274564',
      NULL,
      ARRAY['Fútbol','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'juventud-cedij-952',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-juventud-cedij-952', v_school_id, '{"resolucion_rd": "952", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "WILSON GIOVANNY VELANDIA BARRETO", "localidad": "Suba", "sports": ["Fútbol", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON GIOVANNY VELANDIA BARRETO. Deporte(s): Fútbol, Voleibol. Localidad: Suba. Resolución R-D Nº 952. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204274564', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "952", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "WILSON GIOVANNY VELANDIA BARRETO", "localidad": "Suba", "sports": ["Fútbol", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-juventud-cedij-952';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3204274564', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE FÃTBOL WILSON CHARA  (IDRD-CLUB-club-deportivo-de-fatbol-wilson-chara-958)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-fatbol-wilson-chara-958';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE FÃTBOL WILSON CHARA',
      'Presidente: WILSON CHARA USURIAGA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 958. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3144639800',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-fatbol-wilson-chara-958',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-fatbol-wilson-chara-958', v_school_id, '{"resolucion_rd": "958", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "WILSON CHARA USURIAGA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON CHARA USURIAGA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 958. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144639800', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "958", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "WILSON CHARA USURIAGA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-fatbol-wilson-chara-958';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3144639800', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FÃTBOL CLUB CAPITAL CITY  (IDRD-CLUB-fatbol-club-capital-city-1000)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fatbol-club-capital-city-1000';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FÃTBOL CLUB CAPITAL CITY',
      'Presidente: ANDRÃS ORLANDO TORRES QUINTERO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1000. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3158282823',
      'futbolclubcapitalcity@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fatbol-club-capital-city-1000',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fatbol-club-capital-city-1000', v_school_id, '{"resolucion_rd": "1000", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2022", "fecha_fin": "2027-08-05", "presidente": "ANDRÃS ORLANDO TORRES QUINTERO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRÃS ORLANDO TORRES QUINTERO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1000. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158282823', phone),
      email       = COALESCE('futbolclubcapitalcity@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1000", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2022", "fecha_fin": "2027-08-05", "presidente": "ANDRÃS ORLANDO TORRES QUINTERO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fatbol-club-capital-city-1000';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3158282823', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CÃNIT VOLLEY CLUB  (IDRD-CLUB-canit-volley-club-1039)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-canit-volley-club-1039';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CÃNIT VOLLEY CLUB',
      'Presidente: LIZETH MAYRIN VANEGAS CASTILLA. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 1039. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3106250025',
      'clubcenit2021@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'canit-volley-club-1039',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-canit-volley-club-1039', v_school_id, '{"resolucion_rd": "1039", "resolucion_actualizacion": null, "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "LIZETH MAYRIN VANEGAS CASTILLA", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LIZETH MAYRIN VANEGAS CASTILLA. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 1039. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106250025', phone),
      email       = COALESCE('clubcenit2021@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1039", "resolucion_actualizacion": null, "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "LIZETH MAYRIN VANEGAS CASTILLA", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-canit-volley-club-1039';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3106250025', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FIZTA CYCLING CLUB  (IDRD-CLUB-fizta-cycling-club-1072)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fizta-cycling-club-1072';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FIZTA CYCLING CLUB',
      'Presidente: CAMILO ANDRÃS SÃNCHEZ ROJAS. Deporte(s): Ciclismo. Localidad: Teusaquillo. Resolución R-D Nº 1072. Vigente hasta 2027-09-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3102260452',
      'fitzacolombia@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fizta-cycling-club-1072',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fizta-cycling-club-1072', v_school_id, '{"resolucion_rd": "1072", "resolucion_actualizacion": null, "fecha_inicio": "13-09-2022", "fecha_fin": "2027-09-13", "presidente": "CAMILO ANDRÃS SÃNCHEZ ROJAS", "localidad": "Teusaquillo", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ANDRÃS SÃNCHEZ ROJAS. Deporte(s): Ciclismo. Localidad: Teusaquillo. Resolución R-D Nº 1072. Vigente hasta 2027-09-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102260452', phone),
      email       = COALESCE('fitzacolombia@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1072", "resolucion_actualizacion": null, "fecha_inicio": "13-09-2022", "fecha_fin": "2027-09-13", "presidente": "CAMILO ANDRÃS SÃNCHEZ ROJAS", "localidad": "Teusaquillo", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fizta-cycling-club-1072';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3102260452', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EL FUERTE BOGOTÃ  (IDRD-CLUB-club-deportivo-el-fuerte-bogota-1150)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-fuerte-bogota-1150';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EL FUERTE BOGOTÃ',
      'Presidente: CÃSAR AUGUSTO PINZÃN ROJAS. Deporte(s): Boxeo. Localidad: Usaquén. Resolución R-D Nº 1150. Vigente hasta 2027-09-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3006777172',
      'elfuertebogota@outlook.com',
      ARRAY['Boxeo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-el-fuerte-bogota-1150',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-el-fuerte-bogota-1150', v_school_id, '{"resolucion_rd": "1150", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2022", "fecha_fin": "2027-09-23", "presidente": "CÃSAR AUGUSTO PINZÃN ROJAS", "localidad": "Usaquén", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CÃSAR AUGUSTO PINZÃN ROJAS. Deporte(s): Boxeo. Localidad: Usaquén. Resolución R-D Nº 1150. Vigente hasta 2027-09-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006777172', phone),
      email       = COALESCE('elfuertebogota@outlook.com', email),
      sports      = ARRAY['Boxeo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1150", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2022", "fecha_fin": "2027-09-23", "presidente": "CÃSAR AUGUSTO PINZÃN ROJAS", "localidad": "Usaquén", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-fuerte-bogota-1150';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3006777172', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GAMA R&C  (IDRD-CLUB-gama-rc-1179)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gama-rc-1179';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GAMA R&C',
      'Presidente: MONICA ALEJANDRA ROJAS ESQUIVEL. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1179. Vigente hasta 2027-09-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '8122603',
      'clubdepatinajegama@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gama-rc-1179',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gama-rc-1179', v_school_id, '{"resolucion_rd": "1179", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2022", "fecha_fin": "2027-09-27", "presidente": "MONICA ALEJANDRA ROJAS ESQUIVEL", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MONICA ALEJANDRA ROJAS ESQUIVEL. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1179. Vigente hasta 2027-09-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('8122603', phone),
      email       = COALESCE('clubdepatinajegama@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1179", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2022", "fecha_fin": "2027-09-27", "presidente": "MONICA ALEJANDRA ROJAS ESQUIVEL", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gama-rc-1179';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '8122603', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOS DEL ZAM  (IDRD-CLUB-club-deportivo-los-del-zam-1076)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-del-zam-1076';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOS DEL ZAM',
      'Presidente: JULIANDER SCHNEIDER ZAMBRANO QUEVEDO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1076. Vigente hasta 2027-09-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3222294401',
      'info.efd.los.del.zam777@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-los-del-zam-1076',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-los-del-zam-1076', v_school_id, '{"resolucion_rd": "1076", "resolucion_actualizacion": null, "fecha_inicio": "14-09-2022", "fecha_fin": "2027-09-14", "presidente": "JULIANDER SCHNEIDER ZAMBRANO QUEVEDO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIANDER SCHNEIDER ZAMBRANO QUEVEDO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1076. Vigente hasta 2027-09-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222294401', phone),
      email       = COALESCE('info.efd.los.del.zam777@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1076", "resolucion_actualizacion": null, "fecha_inicio": "14-09-2022", "fecha_fin": "2027-09-14", "presidente": "JULIANDER SCHNEIDER ZAMBRANO QUEVEDO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-del-zam-1076';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3222294401', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NEW CREW  (IDRD-CLUB-club-deportivo-new-crew-1077)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-new-crew-1077';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NEW CREW',
      'Presidente: JOSÃ NICOLÃS MEJÃA DE LA PEÃA. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 1077. Vigente hasta 2027-09-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '5195785',
      'newcrewsk8@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-new-crew-1077',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-new-crew-1077', v_school_id, '{"resolucion_rd": "1077", "resolucion_actualizacion": null, "fecha_inicio": "14-09-2022", "fecha_fin": "2027-09-14", "presidente": "JOSÃ NICOLÃS MEJÃA DE LA PEÃA", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ NICOLÃS MEJÃA DE LA PEÃA. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 1077. Vigente hasta 2027-09-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5195785', phone),
      email       = COALESCE('newcrewsk8@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1077", "resolucion_actualizacion": null, "fecha_inicio": "14-09-2022", "fecha_fin": "2027-09-14", "presidente": "JOSÃ NICOLÃS MEJÃA DE LA PEÃA", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-new-crew-1077';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '5195785', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LEGENDS VOLEY CLUB  (IDRD-CLUB-legends-voley-club-1183)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-legends-voley-club-1183';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEGENDS VOLEY CLUB',
      'Presidente: EDWIN GIOVANNI RIVERA REYES. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 1183 / actualización Nº 252. Vigente hasta 2027-09-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3208972696',
      'legendsvoleyclub@outlook.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'legends-voley-club-1183',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-legends-voley-club-1183', v_school_id, '{"resolucion_rd": "1183", "resolucion_actualizacion": "252", "fecha_inicio": "29-09-2022", "fecha_fin": "2027-09-29", "presidente": "EDWIN GIOVANNI RIVERA REYES", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN GIOVANNI RIVERA REYES. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 1183 / actualización Nº 252. Vigente hasta 2027-09-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208972696', phone),
      email       = COALESCE('legendsvoleyclub@outlook.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1183", "resolucion_actualizacion": "252", "fecha_inicio": "29-09-2022", "fecha_fin": "2027-09-29", "presidente": "EDWIN GIOVANNI RIVERA REYES", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-legends-voley-club-1183';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3208972696', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KUAN YU  (IDRD-CLUB-kuan-yu-1187)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kuan-yu-1187';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KUAN YU',
      'Presidente: CLAUDIA JANETH HORTUA GONZALEZ. Deporte(s): Wushu. Localidad: Fontibón. Resolución R-D Nº 1187. Vigente hasta 2027-09-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3115183912',
      'hortuayhortuaabogados@gmail.com',
      ARRAY['Wushu']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kuan-yu-1187',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kuan-yu-1187', v_school_id, '{"resolucion_rd": "1187", "resolucion_actualizacion": null, "fecha_inicio": "30-09-2022", "fecha_fin": "2027-09-30", "presidente": "CLAUDIA JANETH HORTUA GONZALEZ", "localidad": "Fontibón", "sports": ["Wushu"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA JANETH HORTUA GONZALEZ. Deporte(s): Wushu. Localidad: Fontibón. Resolución R-D Nº 1187. Vigente hasta 2027-09-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115183912', phone),
      email       = COALESCE('hortuayhortuaabogados@gmail.com', email),
      sports      = ARRAY['Wushu']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1187", "resolucion_actualizacion": null, "fecha_inicio": "30-09-2022", "fecha_fin": "2027-09-30", "presidente": "CLAUDIA JANETH HORTUA GONZALEZ", "localidad": "Fontibón", "sports": ["Wushu"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kuan-yu-1187';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3115183912', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DND CYCLING BOGOTÃ  (IDRD-CLUB-dnd-cycling-bogota-1182)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dnd-cycling-bogota-1182';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DND CYCLING BOGOTÃ',
      'Presidente: EDWIN ENRIQUE DONADO CORREAL. Deporte(s): Ciclismo. Localidad: Bosa. Resolución R-D Nº 1182. Vigente hasta 2027-09-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3177867347',
      'dndcicling@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dnd-cycling-bogota-1182',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dnd-cycling-bogota-1182', v_school_id, '{"resolucion_rd": "1182", "resolucion_actualizacion": null, "fecha_inicio": "29-09-2022", "fecha_fin": "2027-09-29", "presidente": "EDWIN ENRIQUE DONADO CORREAL", "localidad": "Bosa", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN ENRIQUE DONADO CORREAL. Deporte(s): Ciclismo. Localidad: Bosa. Resolución R-D Nº 1182. Vigente hasta 2027-09-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3177867347', phone),
      email       = COALESCE('dndcicling@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1182", "resolucion_actualizacion": null, "fecha_inicio": "29-09-2022", "fecha_fin": "2027-09-29", "presidente": "EDWIN ENRIQUE DONADO CORREAL", "localidad": "Bosa", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dnd-cycling-bogota-1182';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3177867347', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAURIOS ESCUELA DE CICLISMO INFANTIL  (IDRD-CLUB-club-deportivo-saurios-escuela-de-ciclis-1200)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-saurios-escuela-de-ciclis-1200';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAURIOS ESCUELA DE CICLISMO INFANTIL',
      'Presidente: ANA MILENA ORTEGA GUSTÃN. Deporte(s): Ciclismo. Localidad: Puente Aranda. Resolución R-D Nº 1200. Vigente hasta 2027-10-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3173751263',
      'sauriosciclismoinfantil@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-saurios-escuela-de-ciclis-1200',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-saurios-escuela-de-ciclis-1200', v_school_id, '{"resolucion_rd": "1200", "resolucion_actualizacion": null, "fecha_inicio": "03-10-2022", "fecha_fin": "2027-10-03", "presidente": "ANA MILENA ORTEGA GUSTÃN", "localidad": "Puente Aranda", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA MILENA ORTEGA GUSTÃN. Deporte(s): Ciclismo. Localidad: Puente Aranda. Resolución R-D Nº 1200. Vigente hasta 2027-10-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173751263', phone),
      email       = COALESCE('sauriosciclismoinfantil@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1200", "resolucion_actualizacion": null, "fecha_inicio": "03-10-2022", "fecha_fin": "2027-10-03", "presidente": "ANA MILENA ORTEGA GUSTÃN", "localidad": "Puente Aranda", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-saurios-escuela-de-ciclis-1200';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3173751263', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE BALONCESTO KOYOYES  (IDRD-CLUB-club-deportivo-de-baloncesto-koyoyes-1219)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-koyoyes-1219';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE BALONCESTO KOYOYES',
      'Presidente: JOSE LUIS JACOBO GARNICA. Deporte(s): Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 1219. Vigente hasta 2027-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3134961338',
      'koyotesclub@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-baloncesto-koyoyes-1219',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-baloncesto-koyoyes-1219', v_school_id, '{"resolucion_rd": "1219", "resolucion_actualizacion": null, "fecha_inicio": "05-10-2022", "fecha_fin": "2027-10-05", "presidente": "JOSE LUIS JACOBO GARNICA", "localidad": "San Cristóbal", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS JACOBO GARNICA. Deporte(s): Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 1219. Vigente hasta 2027-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134961338', phone),
      email       = COALESCE('koyotesclub@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1219", "resolucion_actualizacion": null, "fecha_inicio": "05-10-2022", "fecha_fin": "2027-10-05", "presidente": "JOSE LUIS JACOBO GARNICA", "localidad": "San Cristóbal", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-koyoyes-1219';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3134961338', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MINOTAUROS  (IDRD-CLUB-club-deportivo-minotauros-201)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-minotauros-201';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MINOTAUROS',
      'Presidente: BRAYAN YESID PULIDO ROMERO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 201. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3007324663',
      'cdminotauros@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-minotauros-201',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-minotauros-201', v_school_id, '{"resolucion_rd": "201", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "BRAYAN YESID PULIDO ROMERO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BRAYAN YESID PULIDO ROMERO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 201. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007324663', phone),
      email       = COALESCE('cdminotauros@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "201", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "BRAYAN YESID PULIDO ROMERO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-minotauros-201';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3007324663', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TSR TINTAL SOBRE RUEDAS  (IDRD-CLUB-tsr-tintal-sobre-ruedas-1227)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tsr-tintal-sobre-ruedas-1227';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TSR TINTAL SOBRE RUEDAS',
      'Presidente: JEIMY JOHANA GUERRERO MÃNDEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1227. Vigente hasta 2027-10-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3003176155',
      'tintaldeportivo@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tsr-tintal-sobre-ruedas-1227',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tsr-tintal-sobre-ruedas-1227', v_school_id, '{"resolucion_rd": "1227", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2022", "fecha_fin": "2027-10-06", "presidente": "JEIMY JOHANA GUERRERO MÃNDEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEIMY JOHANA GUERRERO MÃNDEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1227. Vigente hasta 2027-10-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003176155', phone),
      email       = COALESCE('tintaldeportivo@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1227", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2022", "fecha_fin": "2027-10-06", "presidente": "JEIMY JOHANA GUERRERO MÃNDEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tsr-tintal-sobre-ruedas-1227';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3003176155', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LOS CONTRAMONTAÃA  (IDRD-CLUB-los-contramontaaa-1259)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-los-contramontaaa-1259';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LOS CONTRAMONTAÃA',
      'Presidente: KEVIN DANIEL CAMPOS MELO. Deporte(s): Ciclismo. Localidad: Suba. Resolución R-D Nº 1259. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3142379198',
      'a@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'los-contramontaaa-1259',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-los-contramontaaa-1259', v_school_id, '{"resolucion_rd": "1259", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "KEVIN DANIEL CAMPOS MELO", "localidad": "Suba", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KEVIN DANIEL CAMPOS MELO. Deporte(s): Ciclismo. Localidad: Suba. Resolución R-D Nº 1259. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142379198', phone),
      email       = COALESCE('a@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1259", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "KEVIN DANIEL CAMPOS MELO", "localidad": "Suba", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-los-contramontaaa-1259';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3142379198', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NOTARIOS FC  (IDRD-CLUB-notarios-fc-1260)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-notarios-fc-1260';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NOTARIOS FC',
      'Presidente: PEDRO PABLO ORJUELA MÃNDEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1260. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3124033912',
      'pedro.orj20@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'notarios-fc-1260',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-notarios-fc-1260', v_school_id, '{"resolucion_rd": "1260", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "PEDRO PABLO ORJUELA MÃNDEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO PABLO ORJUELA MÃNDEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1260. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124033912', phone),
      email       = COALESCE('pedro.orj20@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1260", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "PEDRO PABLO ORJUELA MÃNDEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-notarios-fc-1260';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3124033912', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INDEPENDIENTE SAN LORENZO  (IDRD-CLUB-independiente-san-lorenzo-1334)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-independiente-san-lorenzo-1334';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INDEPENDIENTE SAN LORENZO',
      'Presidente: CARMELA AGREDA CHICUNQUE. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1334. Vigente hasta 2027-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3123124799',
      'charmy1122@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'independiente-san-lorenzo-1334',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-independiente-san-lorenzo-1334', v_school_id, '{"resolucion_rd": "1334", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2022", "fecha_fin": "2027-10-28", "presidente": "CARMELA AGREDA CHICUNQUE", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARMELA AGREDA CHICUNQUE. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1334. Vigente hasta 2027-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123124799', phone),
      email       = COALESCE('charmy1122@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1334", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2022", "fecha_fin": "2027-10-28", "presidente": "CARMELA AGREDA CHICUNQUE", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-independiente-san-lorenzo-1334';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3123124799', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CYPHERS FC  (IDRD-CLUB-cyphers-fc-1336)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cyphers-fc-1336';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CYPHERS FC',
      'Presidente: ERICK CAMACHO VARGAS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1336. Vigente hasta 2027-10-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '6012651444',
      'erickcv85@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cyphers-fc-1336',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cyphers-fc-1336', v_school_id, '{"resolucion_rd": "1336", "resolucion_actualizacion": null, "fecha_inicio": "31-10-2022", "fecha_fin": "2027-10-31", "presidente": "ERICK CAMACHO VARGAS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ERICK CAMACHO VARGAS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1336. Vigente hasta 2027-10-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6012651444', phone),
      email       = COALESCE('erickcv85@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1336", "resolucion_actualizacion": null, "fecha_inicio": "31-10-2022", "fecha_fin": "2027-10-31", "presidente": "ERICK CAMACHO VARGAS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cyphers-fc-1336';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '6012651444', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LUDWIG GUTTMANN  (IDRD-CLUB-ludwig-guttmann-1112)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ludwig-guttmann-1112';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LUDWIG GUTTMANN',
      'Presidente: JHON SEBASTIAN MATALLANA GARCÃA. Deporte(s): Atletismo. Localidad: Fontibón. Resolución R-D Nº 1112. Vigente hasta 2026-12-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3195223763',
      'sebasrianmatallana91@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ludwig-guttmann-1112',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ludwig-guttmann-1112', v_school_id, '{"resolucion_rd": "1112", "resolucion_actualizacion": null, "fecha_inicio": "28-12-2021", "fecha_fin": "2026-12-28", "presidente": "JHON SEBASTIAN MATALLANA GARCÃA", "localidad": "Fontibón", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON SEBASTIAN MATALLANA GARCÃA. Deporte(s): Atletismo. Localidad: Fontibón. Resolución R-D Nº 1112. Vigente hasta 2026-12-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195223763', phone),
      email       = COALESCE('sebasrianmatallana91@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1112", "resolucion_actualizacion": null, "fecha_inicio": "28-12-2021", "fecha_fin": "2026-12-28", "presidente": "JHON SEBASTIAN MATALLANA GARCÃA", "localidad": "Fontibón", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ludwig-guttmann-1112';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3195223763', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO C.P.A. F.S  (IDRD-CLUB-club-deportivo-cpa-fs-1239)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cpa-fs-1239';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO C.P.A. F.S',
      'Presidente: CARLOS JULIO PORTILLA ANGEL. Deporte(s): Fútbol de salón. Localidad: Ciudad Bolívar. Resolución R-D Nº 1239. Vigente hasta 2027-11-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3173045213',
      'cjportilla@yahoo.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cpa-fs-1239',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cpa-fs-1239', v_school_id, '{"resolucion_rd": "1239", "resolucion_actualizacion": null, "fecha_inicio": "02-11-2022", "fecha_fin": "2027-11-02", "presidente": "CARLOS JULIO PORTILLA ANGEL", "localidad": "Ciudad Bolívar", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS JULIO PORTILLA ANGEL. Deporte(s): Fútbol de salón. Localidad: Ciudad Bolívar. Resolución R-D Nº 1239. Vigente hasta 2027-11-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173045213', phone),
      email       = COALESCE('cjportilla@yahoo.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1239", "resolucion_actualizacion": null, "fecha_inicio": "02-11-2022", "fecha_fin": "2027-11-02", "presidente": "CARLOS JULIO PORTILLA ANGEL", "localidad": "Ciudad Bolívar", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cpa-fs-1239';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3173045213', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BUSHIDO JUDO  (IDRD-CLUB-bushido-judo-1341)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bushido-judo-1341';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BUSHIDO JUDO',
      'Presidente: JOAN SEBASTIAN RAMIREZ BELTRAN. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 1341 / actualización Nº 1202. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3016159041',
      'clubdejudobushido@gmail.com',
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bushido-judo-1341',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bushido-judo-1341', v_school_id, '{"resolucion_rd": "1341", "resolucion_actualizacion": "1202", "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "JOAN SEBASTIAN RAMIREZ BELTRAN", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOAN SEBASTIAN RAMIREZ BELTRAN. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 1341 / actualización Nº 1202. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3016159041', phone),
      email       = COALESCE('clubdejudobushido@gmail.com', email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1341", "resolucion_actualizacion": "1202", "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "JOAN SEBASTIAN RAMIREZ BELTRAN", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bushido-judo-1341';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3016159041', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ANTARES  (IDRD-CLUB-antares-1380)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-antares-1380';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ANTARES',
      'Presidente: DIEGO ALEJANDRO BONILLA OROZCO. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 1380. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3002591978',
      'antaresclubdeportivo@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'antares-1380',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-antares-1380', v_school_id, '{"resolucion_rd": "1380", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "DIEGO ALEJANDRO BONILLA OROZCO", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ALEJANDRO BONILLA OROZCO. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 1380. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002591978', phone),
      email       = COALESCE('antaresclubdeportivo@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1380", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "DIEGO ALEJANDRO BONILLA OROZCO", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-antares-1380';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3002591978', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- THE KONGâS F.C  (IDRD-CLUB-the-kongas-fc-1382)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-the-kongas-fc-1382';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'THE KONGâS F.C',
      'Presidente: JUAN PABLO MORENO BECERRA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1382. Vigente hasta 2027-11-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3195461010',
      'thekongsgame@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'the-kongas-fc-1382',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-the-kongas-fc-1382', v_school_id, '{"resolucion_rd": "1382", "resolucion_actualizacion": null, "fecha_inicio": "07-11-2022", "fecha_fin": "2027-11-07", "presidente": "JUAN PABLO MORENO BECERRA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO MORENO BECERRA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1382. Vigente hasta 2027-11-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195461010', phone),
      email       = COALESCE('thekongsgame@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1382", "resolucion_actualizacion": null, "fecha_inicio": "07-11-2022", "fecha_fin": "2027-11-07", "presidente": "JUAN PABLO MORENO BECERRA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-the-kongas-fc-1382';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3195461010', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SUEÃOS DE GLORIA  (IDRD-CLUB-sueaos-de-gloria-1413)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sueaos-de-gloria-1413';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SUEÃOS DE GLORIA',
      'Presidente: OSCAR JAVIER CABEZAS MONDRAGÃN. Deporte(s): Levantamiento De Pesas. Localidad: Engativá. Resolución R-D Nº 1413. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3175679911',
      'clubdeportivosuenosdegloria@gmail.com',
      ARRAY['Levantamiento De Pesas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sueaos-de-gloria-1413',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sueaos-de-gloria-1413', v_school_id, '{"resolucion_rd": "1413", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "OSCAR JAVIER CABEZAS MONDRAGÃN", "localidad": "Engativá", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR JAVIER CABEZAS MONDRAGÃN. Deporte(s): Levantamiento De Pesas. Localidad: Engativá. Resolución R-D Nº 1413. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3175679911', phone),
      email       = COALESCE('clubdeportivosuenosdegloria@gmail.com', email),
      sports      = ARRAY['Levantamiento De Pesas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1413", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "OSCAR JAVIER CABEZAS MONDRAGÃN", "localidad": "Engativá", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sueaos-de-gloria-1413';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3175679911', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RACING PILOTS ACADEMY RPA  (IDRD-CLUB-racing-pilots-academy-rpa-1435)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-racing-pilots-academy-rpa-1435';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RACING PILOTS ACADEMY RPA',
      'Presidente: WILMAN ESTEBAN CHIVATA CORREDOR. Deporte(s): Motociclismo. Localidad: Engativá. Resolución R-D Nº 1435. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3146105217',
      'racingpilotsacademy@gmail.com',
      ARRAY['Motociclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'racing-pilots-academy-rpa-1435',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-racing-pilots-academy-rpa-1435', v_school_id, '{"resolucion_rd": "1435", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "WILMAN ESTEBAN CHIVATA CORREDOR", "localidad": "Engativá", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILMAN ESTEBAN CHIVATA CORREDOR. Deporte(s): Motociclismo. Localidad: Engativá. Resolución R-D Nº 1435. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3146105217', phone),
      email       = COALESCE('racingpilotsacademy@gmail.com', email),
      sports      = ARRAY['Motociclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1435", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "WILMAN ESTEBAN CHIVATA CORREDOR", "localidad": "Engativá", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-racing-pilots-academy-rpa-1435';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3146105217', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUDOKAS UNIDOS DEL RBJ  (IDRD-CLUB-judokas-unidos-del-rbj-1416)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-judokas-unidos-del-rbj-1416';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUDOKAS UNIDOS DEL RBJ',
      'Presidente: OMAR ERNESTO FLORIDO RAMOS. Deporte(s): Judo. Localidad: Barrios Unidos. Resolución R-D Nº 1416. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3118125530',
      NULL,
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'judokas-unidos-del-rbj-1416',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-judokas-unidos-del-rbj-1416', v_school_id, '{"resolucion_rd": "1416", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "OMAR ERNESTO FLORIDO RAMOS", "localidad": "Barrios Unidos", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OMAR ERNESTO FLORIDO RAMOS. Deporte(s): Judo. Localidad: Barrios Unidos. Resolución R-D Nº 1416. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118125530', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1416", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "OMAR ERNESTO FLORIDO RAMOS", "localidad": "Barrios Unidos", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-judokas-unidos-del-rbj-1416';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3118125530', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INTERCONTINENTAL FC  (IDRD-CLUB-intercontinental-fc-1417)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-intercontinental-fc-1417';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INTERCONTINENTAL FC',
      'Presidente: JEISSON FELIPE SANABRIA ORTIZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1417. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3238067609',
      'c.dintercontinentalfc2022@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'intercontinental-fc-1417',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-intercontinental-fc-1417', v_school_id, '{"resolucion_rd": "1417", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "JEISSON FELIPE SANABRIA ORTIZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISSON FELIPE SANABRIA ORTIZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1417. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3238067609', phone),
      email       = COALESCE('c.dintercontinentalfc2022@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1417", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "JEISSON FELIPE SANABRIA ORTIZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-intercontinental-fc-1417';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3238067609', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PRINCE CLUB DE FUTBOL  (IDRD-CLUB-prince-club-de-futbol-1436)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-prince-club-de-futbol-1436';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PRINCE CLUB DE FUTBOL',
      'Presidente: GERSON JAIR PRINCE ARIAS. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1436. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3213042311',
      'princeclubdefutbol@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'prince-club-de-futbol-1436',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-prince-club-de-futbol-1436', v_school_id, '{"resolucion_rd": "1436", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "GERSON JAIR PRINCE ARIAS", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GERSON JAIR PRINCE ARIAS. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1436. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213042311', phone),
      email       = COALESCE('princeclubdefutbol@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1436", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "GERSON JAIR PRINCE ARIAS", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-prince-club-de-futbol-1436';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3213042311', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BAEKDU TAEKWONDO CLUB  (IDRD-CLUB-club-deportivo-baekdu-taekwondo-club-88.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-baekdu-taekwondo-club-88.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BAEKDU TAEKWONDO CLUB',
      'Presidente: CRISTHIAN DAVID SANABRIA RINCON. Deporte(s): Taekwondo. Localidad: La Candelaria. Resolución R-D Nº 88.0 / actualización Nº N/A. Vigente hasta 2029-02-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'La Candelaria',
      '3053099676',
      'baekdutaekwondoclub@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-baekdu-taekwondo-club-88.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-baekdu-taekwondo-club-88.0', v_school_id, '{"resolucion_rd": "88.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-12", "fecha_fin": "2029-02-12", "presidente": "CRISTHIAN DAVID SANABRIA RINCON", "localidad": "La Candelaria", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTHIAN DAVID SANABRIA RINCON. Deporte(s): Taekwondo. Localidad: La Candelaria. Resolución R-D Nº 88.0 / actualización Nº N/A. Vigente hasta 2029-02-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3053099676', phone),
      email       = COALESCE('baekdutaekwondoclub@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "88.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-12", "fecha_fin": "2029-02-12", "presidente": "CRISTHIAN DAVID SANABRIA RINCON", "localidad": "La Candelaria", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-baekdu-taekwondo-club-88.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'La Candelaria', 'Bogotá', '3053099676', 4.6843605, -74.0511562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CHEER TIME  (IDRD-CLUB-club-deportivo-cheer-time-101.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cheer-time-101.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CHEER TIME',
      'Presidente: CARLOS ANDRES PENAGOS DIAZ. Deporte(s): Porrismo. Localidad: Suba. Resolución R-D Nº 101.0 / actualización Nº N/A. Vigente hasta 2029-02-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3143792570',
      'bogotacheertime@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cheer-time-101.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cheer-time-101.0', v_school_id, '{"resolucion_rd": "101.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-12", "fecha_fin": "2029-02-12", "presidente": "CARLOS ANDRES PENAGOS DIAZ", "localidad": "Suba", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRES PENAGOS DIAZ. Deporte(s): Porrismo. Localidad: Suba. Resolución R-D Nº 101.0 / actualización Nº N/A. Vigente hasta 2029-02-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143792570', phone),
      email       = COALESCE('bogotacheertime@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "101.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-12", "fecha_fin": "2029-02-12", "presidente": "CARLOS ANDRES PENAGOS DIAZ", "localidad": "Suba", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cheer-time-101.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3143792570', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CARNEROS DC  (IDRD-CLUB-carneros-dc-1456)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-carneros-dc-1456';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CARNEROS DC',
      'Presidente: HAROLD IGNACIO GRIJALBA CASTIBLANCO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1456. Vigente hasta 2027-11-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3173645270',
      'carnerosdc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'carneros-dc-1456',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-carneros-dc-1456', v_school_id, '{"resolucion_rd": "1456", "resolucion_actualizacion": null, "fecha_inicio": "14-11-2022", "fecha_fin": "2027-11-14", "presidente": "HAROLD IGNACIO GRIJALBA CASTIBLANCO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HAROLD IGNACIO GRIJALBA CASTIBLANCO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1456. Vigente hasta 2027-11-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173645270', phone),
      email       = COALESCE('carnerosdc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1456", "resolucion_actualizacion": null, "fecha_inicio": "14-11-2022", "fecha_fin": "2027-11-14", "presidente": "HAROLD IGNACIO GRIJALBA CASTIBLANCO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-carneros-dc-1456';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3173645270', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPITAL FORCE FUTBOL CLUB  (IDRD-CLUB-capital-force-futbol-club-1454)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capital-force-futbol-club-1454';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPITAL FORCE FUTBOL CLUB',
      'Presidente: JHON FREDY GALEANO RUIZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1454. Vigente hasta 2027-11-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3203214359',
      'jhonfredygaleano16@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capital-force-futbol-club-1454',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capital-force-futbol-club-1454', v_school_id, '{"resolucion_rd": "1454", "resolucion_actualizacion": null, "fecha_inicio": "11-11-2022", "fecha_fin": "2027-11-11", "presidente": "JHON FREDY GALEANO RUIZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON FREDY GALEANO RUIZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1454. Vigente hasta 2027-11-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203214359', phone),
      email       = COALESCE('jhonfredygaleano16@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1454", "resolucion_actualizacion": null, "fecha_inicio": "11-11-2022", "fecha_fin": "2027-11-11", "presidente": "JHON FREDY GALEANO RUIZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capital-force-futbol-club-1454';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3203214359', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NATACIÃN PULPOS  (IDRD-CLUB-natacian-pulpos-401)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-natacian-pulpos-401';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NATACIÃN PULPOS',
      'Presidente: CARLOS ALBEIRO RUIZ TORRES. Deporte(s): Natación. Localidad: Ciudad Bolívar. Resolución R-D Nº 401. Vigente hasta 2028-05-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3163562703',
      NULL,
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'natacian-pulpos-401',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-natacian-pulpos-401', v_school_id, '{"resolucion_rd": "401", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2023", "fecha_fin": "2028-05-03", "presidente": "CARLOS ALBEIRO RUIZ TORRES", "localidad": "Ciudad Bolívar", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALBEIRO RUIZ TORRES. Deporte(s): Natación. Localidad: Ciudad Bolívar. Resolución R-D Nº 401. Vigente hasta 2028-05-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3163562703', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "401", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2023", "fecha_fin": "2028-05-03", "presidente": "CARLOS ALBEIRO RUIZ TORRES", "localidad": "Ciudad Bolívar", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-natacian-pulpos-401';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3163562703', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SUBA FUTBOLERA  (IDRD-CLUB-club-deportivo-suba-futbolera-050)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-suba-futbolera-050';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SUBA FUTBOLERA',
      'Presidente: VICTOR ARBEY MOJICA ROBLES. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 050. Vigente hasta 2028-02-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3202911580',
      'subafutbolera@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-suba-futbolera-050',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-suba-futbolera-050', v_school_id, '{"resolucion_rd": "050", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2023", "fecha_fin": "2028-02-03", "presidente": "VICTOR ARBEY MOJICA ROBLES", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR ARBEY MOJICA ROBLES. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 050. Vigente hasta 2028-02-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202911580', phone),
      email       = COALESCE('subafutbolera@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "050", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2023", "fecha_fin": "2028-02-03", "presidente": "VICTOR ARBEY MOJICA ROBLES", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-suba-futbolera-050';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3202911580', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TEAM LEOPARDOS CLUB  (IDRD-CLUB-team-leopardos-club-1469)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-team-leopardos-club-1469';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TEAM LEOPARDOS CLUB',
      'Presidente: NICOLÃS SALINAS SEFAIR. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1469. Vigente hasta 2027-11-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3007215088',
      'clubatletismoleopardos@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'team-leopardos-club-1469',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-team-leopardos-club-1469', v_school_id, '{"resolucion_rd": "1469", "resolucion_actualizacion": null, "fecha_inicio": "16-11-2022", "fecha_fin": "2027-11-16", "presidente": "NICOLÃS SALINAS SEFAIR", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLÃS SALINAS SEFAIR. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1469. Vigente hasta 2027-11-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007215088', phone),
      email       = COALESCE('clubatletismoleopardos@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1469", "resolucion_actualizacion": null, "fecha_inicio": "16-11-2022", "fecha_fin": "2027-11-16", "presidente": "NICOLÃS SALINAS SEFAIR", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-team-leopardos-club-1469';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3007215088', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACTIVE BODYTECH  (IDRD-CLUB-club-deportivo-active-bodytech-1534)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-active-bodytech-1534';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACTIVE BODYTECH',
      'Presidente: JUAN PABLO CABRERA VÃSQUEZ,. Deporte(s): Natación, Gimnasia, Fútbol, Taekwondo. Localidad: Chapinero. Resolución R-D Nº 1534. Vigente hasta 2027-11-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3125197248',
      'cabrera@activebodytech.com',
      ARRAY['Natación','Gimnasia','Fútbol','Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-active-bodytech-1534',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-active-bodytech-1534', v_school_id, '{"resolucion_rd": "1534", "resolucion_actualizacion": null, "fecha_inicio": "28-11-2022", "fecha_fin": "2027-11-28", "presidente": "JUAN PABLO CABRERA VÃSQUEZ,", "localidad": "Chapinero", "sports": ["Natación", "Gimnasia", "Fútbol", "Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO CABRERA VÃSQUEZ,. Deporte(s): Natación, Gimnasia, Fútbol, Taekwondo. Localidad: Chapinero. Resolución R-D Nº 1534. Vigente hasta 2027-11-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125197248', phone),
      email       = COALESCE('cabrera@activebodytech.com', email),
      sports      = ARRAY['Natación','Gimnasia','Fútbol','Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1534", "resolucion_actualizacion": null, "fecha_inicio": "28-11-2022", "fecha_fin": "2027-11-28", "presidente": "JUAN PABLO CABRERA VÃSQUEZ,", "localidad": "Chapinero", "sports": ["Natación", "Gimnasia", "Fútbol", "Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-active-bodytech-1534';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3125197248', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO P.K.  (IDRD-CLUB-club-deportivo-pk-1582)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pk-1582';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO P.K.',
      'Presidente: NELLY JULIETT LUQUE LARA. Deporte(s): Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 1582. Vigente hasta 2027-12-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3222007369',
      'polikennedy@hotmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pk-1582',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pk-1582', v_school_id, '{"resolucion_rd": "1582", "resolucion_actualizacion": null, "fecha_inicio": "06-12-2022", "fecha_fin": "2027-12-06", "presidente": "NELLY JULIETT LUQUE LARA", "localidad": "Kennedy", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NELLY JULIETT LUQUE LARA. Deporte(s): Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 1582. Vigente hasta 2027-12-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222007369', phone),
      email       = COALESCE('polikennedy@hotmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1582", "resolucion_actualizacion": null, "fecha_inicio": "06-12-2022", "fecha_fin": "2027-12-06", "presidente": "NELLY JULIETT LUQUE LARA", "localidad": "Kennedy", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pk-1582';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3222007369', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JUVENTUD BOGOTANA D.C.  (IDRD-CLUB-club-deportivo-juventud-bogotana-dc-1537)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-juventud-bogotana-dc-1537';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JUVENTUD BOGOTANA D.C.',
      'Presidente: WILLIAM ANDRES PENAGOS SUAREZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1537. Vigente hasta 2027-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '4592768',
      'juventudbogotanadc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-juventud-bogotana-dc-1537',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-juventud-bogotana-dc-1537', v_school_id, '{"resolucion_rd": "1537", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2022", "fecha_fin": "2027-11-25", "presidente": "WILLIAM ANDRES PENAGOS SUAREZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM ANDRES PENAGOS SUAREZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1537. Vigente hasta 2027-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4592768', phone),
      email       = COALESCE('juventudbogotanadc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1537", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2022", "fecha_fin": "2027-11-25", "presidente": "WILLIAM ANDRES PENAGOS SUAREZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-juventud-bogotana-dc-1537';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '4592768', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WOLF TEAM MMA  (IDRD-CLUB-club-deportivo-wolf-team-mma-1546)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-wolf-team-mma-1546';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WOLF TEAM MMA',
      'Presidente: AURA MARCELA GASCA ROJAS. Deporte(s): Boxeo. Localidad: Fontibón. Resolución R-D Nº 1546. Vigente hasta 2027-11-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3002091484',
      'wolfteammma13@gmail.com',
      ARRAY['Boxeo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-wolf-team-mma-1546',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-wolf-team-mma-1546', v_school_id, '{"resolucion_rd": "1546", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2022", "fecha_fin": "2027-11-29", "presidente": "AURA MARCELA GASCA ROJAS", "localidad": "Fontibón", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AURA MARCELA GASCA ROJAS. Deporte(s): Boxeo. Localidad: Fontibón. Resolución R-D Nº 1546. Vigente hasta 2027-11-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002091484', phone),
      email       = COALESCE('wolfteammma13@gmail.com', email),
      sports      = ARRAY['Boxeo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1546", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2022", "fecha_fin": "2027-11-29", "presidente": "AURA MARCELA GASCA ROJAS", "localidad": "Fontibón", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-wolf-team-mma-1546';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3002091484', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CANTERA PATRIOTA BOGOTÃ  (IDRD-CLUB-club-deportivo-cantera-patriota-bogota-1588)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cantera-patriota-bogota-1588';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CANTERA PATRIOTA BOGOTÃ',
      'Presidente: MARÃA ALEXANDRA GALINDO GÃMEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1588. Vigente hasta 2027-12-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3223951544',
      'canterapatriotabogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cantera-patriota-bogota-1588',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cantera-patriota-bogota-1588', v_school_id, '{"resolucion_rd": "1588", "resolucion_actualizacion": null, "fecha_inicio": "06-12-2022", "fecha_fin": "2027-12-06", "presidente": "MARÃA ALEXANDRA GALINDO GÃMEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃA ALEXANDRA GALINDO GÃMEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1588. Vigente hasta 2027-12-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3223951544', phone),
      email       = COALESCE('canterapatriotabogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1588", "resolucion_actualizacion": null, "fecha_inicio": "06-12-2022", "fecha_fin": "2027-12-06", "presidente": "MARÃA ALEXANDRA GALINDO GÃMEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cantera-patriota-bogota-1588';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3223951544', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BIG BANG ROLLER  (IDRD-CLUB-club-deportivo-big-bang-roller-1589)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-big-bang-roller-1589';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BIG BANG ROLLER',
      'Presidente: JOSÃ RICARDO ESPITIA HERRERA. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1589. Vigente hasta 2027-12-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3196119941',
      'bigbangclubclubdeportivo@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-big-bang-roller-1589',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-big-bang-roller-1589', v_school_id, '{"resolucion_rd": "1589", "resolucion_actualizacion": null, "fecha_inicio": "06-12-2022", "fecha_fin": "2027-12-06", "presidente": "JOSÃ RICARDO ESPITIA HERRERA", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ RICARDO ESPITIA HERRERA. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1589. Vigente hasta 2027-12-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3196119941', phone),
      email       = COALESCE('bigbangclubclubdeportivo@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1589", "resolucion_actualizacion": null, "fecha_inicio": "06-12-2022", "fecha_fin": "2027-12-06", "presidente": "JOSÃ RICARDO ESPITIA HERRERA", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-big-bang-roller-1589';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3196119941', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HORSES  (IDRD-CLUB-club-deportivo-horses-1575)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-horses-1575';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HORSES',
      'Presidente: CRISTIAN ANDRES AGUIRRE HENAO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1575. Vigente hasta 2027-12-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3204780747',
      'horses.efd@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-horses-1575',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-horses-1575', v_school_id, '{"resolucion_rd": "1575", "resolucion_actualizacion": null, "fecha_inicio": "05-12-2022", "fecha_fin": "2027-12-05", "presidente": "CRISTIAN ANDRES AGUIRRE HENAO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN ANDRES AGUIRRE HENAO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1575. Vigente hasta 2027-12-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204780747', phone),
      email       = COALESCE('horses.efd@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1575", "resolucion_actualizacion": null, "fecha_inicio": "05-12-2022", "fecha_fin": "2027-12-05", "presidente": "CRISTIAN ANDRES AGUIRRE HENAO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-horses-1575';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3204780747', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INSADEC CLUB DEPORTIVO Y ARTÃSTICO  (IDRD-CLUB-insadec-club-deportivo-y-artastico-1635)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-insadec-club-deportivo-y-artastico-1635';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSADEC CLUB DEPORTIVO Y ARTÃSTICO',
      'Presidente: AXEL DARLEY LONDOÃO RIAÃO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1635. Vigente hasta 2027-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3212058895',
      'informacion@insadec.org',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'insadec-club-deportivo-y-artastico-1635',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-insadec-club-deportivo-y-artastico-1635', v_school_id, '{"resolucion_rd": "1635", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2022", "fecha_fin": "2027-12-13", "presidente": "AXEL DARLEY LONDOÃO RIAÃO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AXEL DARLEY LONDOÃO RIAÃO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1635. Vigente hasta 2027-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212058895', phone),
      email       = COALESCE('informacion@insadec.org', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1635", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2022", "fecha_fin": "2027-12-13", "presidente": "AXEL DARLEY LONDOÃO RIAÃO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-insadec-club-deportivo-y-artastico-1635';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3212058895', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTEBAN CHAVES - FUN  (IDRD-CLUB-esteban-chaves---fun-1653)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-esteban-chaves---fun-1653';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTEBAN CHAVES - FUN',
      'Presidente: JAIRO ALFONSO CHAVES DEVIA. Deporte(s): Ciclismo. Localidad: Usaquén. Resolución R-D Nº 1653. Vigente hasta 2027-12-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3172583328',
      'fundacionestebanchaves@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'esteban-chaves---fun-1653',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-esteban-chaves---fun-1653', v_school_id, '{"resolucion_rd": "1653", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2022", "fecha_fin": "2027-12-15", "presidente": "JAIRO ALFONSO CHAVES DEVIA", "localidad": "Usaquén", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIRO ALFONSO CHAVES DEVIA. Deporte(s): Ciclismo. Localidad: Usaquén. Resolución R-D Nº 1653. Vigente hasta 2027-12-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3172583328', phone),
      email       = COALESCE('fundacionestebanchaves@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1653", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2022", "fecha_fin": "2027-12-15", "presidente": "JAIRO ALFONSO CHAVES DEVIA", "localidad": "Usaquén", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-esteban-chaves---fun-1653';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3172583328', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ELITE MADELENA JEANS  (IDRD-CLUB-club-deportivo-elite-madelena-jeans-651)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-elite-madelena-jeans-651';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ELITE MADELENA JEANS',
      'Presidente: JEAN ANDREY RINCON ALFONSO. Deporte(s): Baloncesto. Localidad: Ciudad Bolívar. Resolución R-D Nº 651. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3132310527',
      'madelenabaloncesto@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-elite-madelena-jeans-651',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-elite-madelena-jeans-651', v_school_id, '{"resolucion_rd": "651", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "JEAN ANDREY RINCON ALFONSO", "localidad": "Ciudad Bolívar", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEAN ANDREY RINCON ALFONSO. Deporte(s): Baloncesto. Localidad: Ciudad Bolívar. Resolución R-D Nº 651. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132310527', phone),
      email       = COALESCE('madelenabaloncesto@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "651", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "JEAN ANDREY RINCON ALFONSO", "localidad": "Ciudad Bolívar", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-elite-madelena-jeans-651';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3132310527', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTUROS GIGANTES  (IDRD-CLUB-futuros-gigantes-1672)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futuros-gigantes-1672';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTUROS GIGANTES',
      'Presidente: FABIAN GUILLERMO GUERRERO RODRIGUEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1672. Vigente hasta 2027-12-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3222689579',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futuros-gigantes-1672',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futuros-gigantes-1672', v_school_id, '{"resolucion_rd": "1672", "resolucion_actualizacion": null, "fecha_inicio": "20-12-2022", "fecha_fin": "2027-12-20", "presidente": "FABIAN GUILLERMO GUERRERO RODRIGUEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIAN GUILLERMO GUERRERO RODRIGUEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1672. Vigente hasta 2027-12-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222689579', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1672", "resolucion_actualizacion": null, "fecha_inicio": "20-12-2022", "fecha_fin": "2027-12-20", "presidente": "FABIAN GUILLERMO GUERRERO RODRIGUEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futuros-gigantes-1672';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3222689579', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DOJO CORAZÃN DE GUERRERO  (IDRD-CLUB-dojo-corazan-de-guerrero-1662)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dojo-corazan-de-guerrero-1662';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DOJO CORAZÃN DE GUERRERO',
      'Presidente: FREDDY ALEXANDER ESGUERRA AVILA. Deporte(s): Muay Thai. Localidad: Bosa. Resolución R-D Nº 1662. Vigente hasta 2027-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3112572482',
      'dojocorazonguerrero17@gmail.com',
      ARRAY['Muay Thai']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dojo-corazan-de-guerrero-1662',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dojo-corazan-de-guerrero-1662', v_school_id, '{"resolucion_rd": "1662", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2022", "fecha_fin": "2027-12-19", "presidente": "FREDDY ALEXANDER ESGUERRA AVILA", "localidad": "Bosa", "sports": ["Muay Thai"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDDY ALEXANDER ESGUERRA AVILA. Deporte(s): Muay Thai. Localidad: Bosa. Resolución R-D Nº 1662. Vigente hasta 2027-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112572482', phone),
      email       = COALESCE('dojocorazonguerrero17@gmail.com', email),
      sports      = ARRAY['Muay Thai']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1662", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2022", "fecha_fin": "2027-12-19", "presidente": "FREDDY ALEXANDER ESGUERRA AVILA", "localidad": "Bosa", "sports": ["Muay Thai"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dojo-corazan-de-guerrero-1662';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3112572482', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MONSERRATE  (IDRD-CLUB-club-deportivo-monserrate-004)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-monserrate-004';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MONSERRATE',
      'Presidente: CESAR AUGUSTO ARENAS OSPINA. Deporte(s): Fútbol. Localidad: Santa Fe. Resolución R-D Nº 004. Vigente hasta 2031-01-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Santa Fe',
      '3112062223',
      'escuelasmonserrate@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-monserrate-004',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-monserrate-004', v_school_id, '{"resolucion_rd": "004", "resolucion_actualizacion": null, "fecha_inicio": "21-01-2026", "fecha_fin": "2031-01-21", "presidente": "CESAR AUGUSTO ARENAS OSPINA", "localidad": "Santa Fe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR AUGUSTO ARENAS OSPINA. Deporte(s): Fútbol. Localidad: Santa Fe. Resolución R-D Nº 004. Vigente hasta 2031-01-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112062223', phone),
      email       = COALESCE('escuelasmonserrate@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "004", "resolucion_actualizacion": null, "fecha_inicio": "21-01-2026", "fecha_fin": "2031-01-21", "presidente": "CESAR AUGUSTO ARENAS OSPINA", "localidad": "Santa Fe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-monserrate-004';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Santa Fe', 'Bogotá', '3112062223', 4.6017892, -74.0791799, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PSG JUAN XXIII  (IDRD-CLUB-club-deportivo-psg-juan-xxiii-1671)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-psg-juan-xxiii-1671';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PSG JUAN XXIII',
      'Presidente: JOHANNA ANDREA PEREZ RODRIGUEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1671. Vigente hasta 2027-12-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3174216697',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-psg-juan-xxiii-1671',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-psg-juan-xxiii-1671', v_school_id, '{"resolucion_rd": "1671", "resolucion_actualizacion": null, "fecha_inicio": "20-12-2022", "fecha_fin": "2027-12-20", "presidente": "JOHANNA ANDREA PEREZ RODRIGUEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANNA ANDREA PEREZ RODRIGUEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1671. Vigente hasta 2027-12-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174216697', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1671", "resolucion_actualizacion": null, "fecha_inicio": "20-12-2022", "fecha_fin": "2027-12-20", "presidente": "JOHANNA ANDREA PEREZ RODRIGUEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-psg-juan-xxiii-1671';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3174216697', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALBATROS TEAM S.A.S  (IDRD-CLUB-albatros-team-sas-1743)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-albatros-team-sas-1743';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALBATROS TEAM S.A.S',
      'Presidente: SANDRA CECILIA CABALLERO BARRETO. Deporte(s): Atletismo, Natación, Triatlon. Localidad: Barrios Unidos. Resolución R-D Nº 1743. Vigente hasta 2027-12-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3183005612',
      'albatrosteam2022@gmail.com',
      ARRAY['Atletismo','Natación','Triatlon']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'albatros-team-sas-1743',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-albatros-team-sas-1743', v_school_id, '{"resolucion_rd": "1743", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2022", "fecha_fin": "2027-12-23", "presidente": "SANDRA CECILIA CABALLERO BARRETO", "localidad": "Barrios Unidos", "sports": ["Atletismo", "Natación", "Triatlon"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA CECILIA CABALLERO BARRETO. Deporte(s): Atletismo, Natación, Triatlon. Localidad: Barrios Unidos. Resolución R-D Nº 1743. Vigente hasta 2027-12-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183005612', phone),
      email       = COALESCE('albatrosteam2022@gmail.com', email),
      sports      = ARRAY['Atletismo','Natación','Triatlon']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1743", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2022", "fecha_fin": "2027-12-23", "presidente": "SANDRA CECILIA CABALLERO BARRETO", "localidad": "Barrios Unidos", "sports": ["Atletismo", "Natación", "Triatlon"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-albatros-team-sas-1743';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3183005612', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TSUNAMI BMX  (IDRD-CLUB-tsunami-bmx-1750)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tsunami-bmx-1750';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TSUNAMI BMX',
      'Presidente: JUAN PABLO NÃÃEZ GALLEGO. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1750. Vigente hasta 2027-12-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3017613394',
      'tsunamibmxclub@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tsunami-bmx-1750',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tsunami-bmx-1750', v_school_id, '{"resolucion_rd": "1750", "resolucion_actualizacion": null, "fecha_inicio": "30-12-2022", "fecha_fin": "2027-12-30", "presidente": "JUAN PABLO NÃÃEZ GALLEGO", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO NÃÃEZ GALLEGO. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1750. Vigente hasta 2027-12-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017613394', phone),
      email       = COALESCE('tsunamibmxclub@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1750", "resolucion_actualizacion": null, "fecha_inicio": "30-12-2022", "fecha_fin": "2027-12-30", "presidente": "JUAN PABLO NÃÃEZ GALLEGO", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tsunami-bmx-1750';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3017613394', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INTERNACIONAL DE BOGOTA F.C  (IDRD-CLUB-internacional-de-bogota-fc-1827)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-internacional-de-bogota-fc-1827';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INTERNACIONAL DE BOGOTA F.C',
      'Presidente: ANDRÃS GENARO GUTIÃRREZ PULIDO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1827. Vigente hasta 2028-01-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3108163563',
      'andes_guty@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'internacional-de-bogota-fc-1827',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-internacional-de-bogota-fc-1827', v_school_id, '{"resolucion_rd": "1827", "resolucion_actualizacion": null, "fecha_inicio": "05-01-2023", "fecha_fin": "2028-01-05", "presidente": "ANDRÃS GENARO GUTIÃRREZ PULIDO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRÃS GENARO GUTIÃRREZ PULIDO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1827. Vigente hasta 2028-01-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108163563', phone),
      email       = COALESCE('andes_guty@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1827", "resolucion_actualizacion": null, "fecha_inicio": "05-01-2023", "fecha_fin": "2028-01-05", "presidente": "ANDRÃS GENARO GUTIÃRREZ PULIDO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-internacional-de-bogota-fc-1827';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3108163563', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTILO LIBRE CABS  (IDRD-CLUB-estilo-libre-cabs-1742)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-estilo-libre-cabs-1742';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTILO LIBRE CABS',
      'Presidente: MARÃA CRISTINA FERRUCHO PORRAS. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 1742. Vigente hasta 2027-12-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3132570883',
      'clubestilolibre.bog@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'estilo-libre-cabs-1742',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-estilo-libre-cabs-1742', v_school_id, '{"resolucion_rd": "1742", "resolucion_actualizacion": null, "fecha_inicio": "28-12-2022", "fecha_fin": "2027-12-28", "presidente": "MARÃA CRISTINA FERRUCHO PORRAS", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃA CRISTINA FERRUCHO PORRAS. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 1742. Vigente hasta 2027-12-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132570883', phone),
      email       = COALESCE('clubestilolibre.bog@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1742", "resolucion_actualizacion": null, "fecha_inicio": "28-12-2022", "fecha_fin": "2027-12-28", "presidente": "MARÃA CRISTINA FERRUCHO PORRAS", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-estilo-libre-cabs-1742';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3132570883', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JF FLORENTINO F.C  (IDRD-CLUB-jf-florentino-fc-1805)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jf-florentino-fc-1805';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JF FLORENTINO F.C',
      'Presidente: JUDY ASTRID MUÃâOZ MELO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1805. Vigente hasta 2027-12-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3227052789',
      'jfflorentinofc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jf-florentino-fc-1805',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jf-florentino-fc-1805', v_school_id, '{"resolucion_rd": "1805", "resolucion_actualizacion": null, "fecha_inicio": "20-12-2022", "fecha_fin": "2027-12-20", "presidente": "JUDY ASTRID MUÃâOZ MELO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUDY ASTRID MUÃâOZ MELO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1805. Vigente hasta 2027-12-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3227052789', phone),
      email       = COALESCE('jfflorentinofc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1805", "resolucion_actualizacion": null, "fecha_inicio": "20-12-2022", "fecha_fin": "2027-12-20", "presidente": "JUDY ASTRID MUÃâOZ MELO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jf-florentino-fc-1805';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3227052789', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CORPORACIÃN CLUB CAMPESTRE LOS ARRAYANES  (IDRD-CLUB-corporacian-club-campestre-los-arrayanes-658)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-corporacian-club-campestre-los-arrayanes-658';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CORPORACIÃN CLUB CAMPESTRE LOS ARRAYANES',
      'Presidente: ANDRES AUGUSTO ALARCON ACEVEDO. Deporte(s): Fútbol, Natación, Squash, Tenis, Ecuestre, Golf. Localidad: Suba. Resolución R-D Nº 658. Vigente hasta 2026-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6760070',
      NULL,
      ARRAY['Fútbol','Natación','Squash','Tenis','Ecuestre','Golf']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'corporacian-club-campestre-los-arrayanes-658',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-corporacian-club-campestre-los-arrayanes-658', v_school_id, '{"resolucion_rd": "658", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2021", "fecha_fin": "2026-08-30", "presidente": "ANDRES AUGUSTO ALARCON ACEVEDO", "localidad": "Suba", "sports": ["Fútbol", "Natación", "Squash", "Tenis", "Ecuestre", "Golf"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES AUGUSTO ALARCON ACEVEDO. Deporte(s): Fútbol, Natación, Squash, Tenis, Ecuestre, Golf. Localidad: Suba. Resolución R-D Nº 658. Vigente hasta 2026-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6760070', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol','Natación','Squash','Tenis','Ecuestre','Golf']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "658", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2021", "fecha_fin": "2026-08-30", "presidente": "ANDRES AUGUSTO ALARCON ACEVEDO", "localidad": "Suba", "sports": ["Fútbol", "Natación", "Squash", "Tenis", "Ecuestre", "Golf"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-corporacian-club-campestre-los-arrayanes-658';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6760070', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESPAÃOL FÃTBOL CLUB COLOMBIA  (IDRD-CLUB-espaaol-fatbol-club-colombia-1810)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-espaaol-fatbol-club-colombia-1810';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESPAÃOL FÃTBOL CLUB COLOMBIA',
      'Presidente: PABLO CESAR LEON MATEUS. Deporte(s): Fútbol. Resolución R-D Nº 1810. Vigente hasta 2028-01-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3228152498',
      'jhon850923@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'espaaol-fatbol-club-colombia-1810',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-espaaol-fatbol-club-colombia-1810', v_school_id, '{"resolucion_rd": "1810", "resolucion_actualizacion": null, "fecha_inicio": "03-01-2023", "fecha_fin": "2028-01-03", "presidente": "PABLO CESAR LEON MATEUS", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PABLO CESAR LEON MATEUS. Deporte(s): Fútbol. Resolución R-D Nº 1810. Vigente hasta 2028-01-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3228152498', phone),
      email       = COALESCE('jhon850923@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1810", "resolucion_actualizacion": null, "fecha_inicio": "03-01-2023", "fecha_fin": "2028-01-03", "presidente": "PABLO CESAR LEON MATEUS", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-espaaol-fatbol-club-colombia-1810';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- VICTORIA BASKETBALL  (IDRD-CLUB-victoria-basketball-1815)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-victoria-basketball-1815';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VICTORIA BASKETBALL',
      'Presidente: RAFAEL EMILIO GOMEZ DIAZ. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 1815. Vigente hasta 2028-01-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '6014728061',
      'victoriabasketballclub@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'victoria-basketball-1815',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-victoria-basketball-1815', v_school_id, '{"resolucion_rd": "1815", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2023", "fecha_fin": "2028-01-04", "presidente": "RAFAEL EMILIO GOMEZ DIAZ", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAFAEL EMILIO GOMEZ DIAZ. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 1815. Vigente hasta 2028-01-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6014728061', phone),
      email       = COALESCE('victoriabasketballclub@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1815", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2023", "fecha_fin": "2028-01-04", "presidente": "RAFAEL EMILIO GOMEZ DIAZ", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-victoria-basketball-1815';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '6014728061', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUNDACIÃN RESPIRAR VIDA R.V  (IDRD-CLUB-club-deportivo-fundacian-respirar-vida-r-1831)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fundacian-respirar-vida-r-1831';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUNDACIÃN RESPIRAR VIDA R.V',
      'Presidente: JOSÃ ASDRUBAL GARCÃA VERGARA. Deporte(s): Fútbol, Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 1831. Vigente hasta 2028-01-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3212332178',
      NULL,
      ARRAY['Fútbol','Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fundacian-respirar-vida-r-1831',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fundacian-respirar-vida-r-1831', v_school_id, '{"resolucion_rd": "1831", "resolucion_actualizacion": null, "fecha_inicio": "05-01-2023", "fecha_fin": "2028-01-05", "presidente": "JOSÃ ASDRUBAL GARCÃA VERGARA", "localidad": "Kennedy", "sports": ["Fútbol", "Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ ASDRUBAL GARCÃA VERGARA. Deporte(s): Fútbol, Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 1831. Vigente hasta 2028-01-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212332178', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol','Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1831", "resolucion_actualizacion": null, "fecha_inicio": "05-01-2023", "fecha_fin": "2028-01-05", "presidente": "JOSÃ ASDRUBAL GARCÃA VERGARA", "localidad": "Kennedy", "sports": ["Fútbol", "Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fundacian-respirar-vida-r-1831';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3212332178', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VOLEY MACHINE  (IDRD-CLUB-voley-machine-1834)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-voley-machine-1834';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VOLEY MACHINE',
      'Presidente: AIXA LORENA AYALA VELASCO. Deporte(s): Voleibol. Localidad: Fontibón. Resolución R-D Nº 1834. Vigente hasta 2028-01-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3117483041',
      NULL,
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'voley-machine-1834',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-voley-machine-1834', v_school_id, '{"resolucion_rd": "1834", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2023", "fecha_fin": "2028-01-04", "presidente": "AIXA LORENA AYALA VELASCO", "localidad": "Fontibón", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AIXA LORENA AYALA VELASCO. Deporte(s): Voleibol. Localidad: Fontibón. Resolución R-D Nº 1834. Vigente hasta 2028-01-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3117483041', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1834", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2023", "fecha_fin": "2028-01-04", "presidente": "AIXA LORENA AYALA VELASCO", "localidad": "Fontibón", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-voley-machine-1834';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3117483041', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ANDANDO,  (IDRD-CLUB-club-deportivo-andando-1847)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-andando-1847';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ANDANDO,',
      'Presidente: RICARDO TALERO FANDIÃO. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1847. Vigente hasta 2028-01-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3102713776',
      'fundacionandando@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-andando-1847',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-andando-1847', v_school_id, '{"resolucion_rd": "1847", "resolucion_actualizacion": null, "fecha_inicio": "09-01-2023", "fecha_fin": "2028-01-09", "presidente": "RICARDO TALERO FANDIÃO", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICARDO TALERO FANDIÃO. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1847. Vigente hasta 2028-01-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102713776', phone),
      email       = COALESCE('fundacionandando@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1847", "resolucion_actualizacion": null, "fecha_inicio": "09-01-2023", "fecha_fin": "2028-01-09", "presidente": "RICARDO TALERO FANDIÃO", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-andando-1847';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3102713776', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CENTRO ESPECIALIZADO DE ENTRENAMIENTO FISICO CS SKATE SAS  (IDRD-CLUB-centro-especializado-de-entrenamiento-fi-1854)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-centro-especializado-de-entrenamiento-fi-1854';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CENTRO ESPECIALIZADO DE ENTRENAMIENTO FISICO CS SKATE SAS',
      'Presidente: YESID RICARDO GUANTIVA CASTILLO. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1854. Vigente hasta 2028-01-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3046098016',
      'ceefcsskate@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'centro-especializado-de-entrenamiento-fi-1854',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-centro-especializado-de-entrenamiento-fi-1854', v_school_id, '{"resolucion_rd": "1854", "resolucion_actualizacion": null, "fecha_inicio": "10-01-2023", "fecha_fin": "2028-01-10", "presidente": "YESID RICARDO GUANTIVA CASTILLO", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YESID RICARDO GUANTIVA CASTILLO. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1854. Vigente hasta 2028-01-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3046098016', phone),
      email       = COALESCE('ceefcsskate@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1854", "resolucion_actualizacion": null, "fecha_inicio": "10-01-2023", "fecha_fin": "2028-01-10", "presidente": "YESID RICARDO GUANTIVA CASTILLO", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-centro-especializado-de-entrenamiento-fi-1854';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3046098016', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO IRON SHARKS  (IDRD-CLUB-club-deportivo-iron-sharks-002)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-iron-sharks-002';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO IRON SHARKS',
      'Presidente: GIOBERTI ALEJANDRO MORALES AGATON. Deporte(s): Levantamiento De Pesas. Localidad: Engativá. Resolución R-D Nº 002. Vigente hasta 2028-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3002205317',
      'marorova17@gmail.com',
      ARRAY['Levantamiento De Pesas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-iron-sharks-002',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-iron-sharks-002', v_school_id, '{"resolucion_rd": "002", "resolucion_actualizacion": null, "fecha_inicio": "16-01-2023", "fecha_fin": "2028-01-16", "presidente": "GIOBERTI ALEJANDRO MORALES AGATON", "localidad": "Engativá", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GIOBERTI ALEJANDRO MORALES AGATON. Deporte(s): Levantamiento De Pesas. Localidad: Engativá. Resolución R-D Nº 002. Vigente hasta 2028-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002205317', phone),
      email       = COALESCE('marorova17@gmail.com', email),
      sports      = ARRAY['Levantamiento De Pesas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "002", "resolucion_actualizacion": null, "fecha_inicio": "16-01-2023", "fecha_fin": "2028-01-16", "presidente": "GIOBERTI ALEJANDRO MORALES AGATON", "localidad": "Engativá", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-iron-sharks-002';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3002205317', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAGTENIS  (IDRD-CLUB-club-deportivo-sagtenis-014)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sagtenis-014';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAGTENIS',
      'Presidente: SEBASTIAN ALVAREZ GUTIERREZ. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 014. Vigente hasta 2028-01-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3187179144',
      'sagtenis@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sagtenis-014',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sagtenis-014', v_school_id, '{"resolucion_rd": "014", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2023", "fecha_fin": "2028-01-24", "presidente": "SEBASTIAN ALVAREZ GUTIERREZ", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SEBASTIAN ALVAREZ GUTIERREZ. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 014. Vigente hasta 2028-01-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187179144', phone),
      email       = COALESCE('sagtenis@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "014", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2023", "fecha_fin": "2028-01-24", "presidente": "SEBASTIAN ALVAREZ GUTIERREZ", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sagtenis-014';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3187179144', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TIRO RANGERS SHOOTING CLUB RSC  (IDRD-CLUB-club-deportivo-de-tiro-rangers-shooting--012)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-tiro-rangers-shooting--012';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TIRO RANGERS SHOOTING CLUB RSC',
      'Presidente: TITO BORIS RESTREPO OJEDA. Deporte(s): Tiro deportivo. Resolución R-D Nº 012. Vigente hasta 2028-01-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3014101502',
      'titoboris@hotmail.com',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-tiro-rangers-shooting--012',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-tiro-rangers-shooting--012', v_school_id, '{"resolucion_rd": "012", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2023", "fecha_fin": "2028-01-24", "presidente": "TITO BORIS RESTREPO OJEDA", "localidad": null, "sports": ["Tiro deportivo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: TITO BORIS RESTREPO OJEDA. Deporte(s): Tiro deportivo. Resolución R-D Nº 012. Vigente hasta 2028-01-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3014101502', phone),
      email       = COALESCE('titoboris@hotmail.com', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "012", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2023", "fecha_fin": "2028-01-24", "presidente": "TITO BORIS RESTREPO OJEDA", "localidad": null, "sports": ["Tiro deportivo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-tiro-rangers-shooting--012';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- TEAM 20 BOGOTÃ POWERLIFTING  (IDRD-CLUB-team-20-bogota-powerlifting-056)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-team-20-bogota-powerlifting-056';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TEAM 20 BOGOTÃ POWERLIFTING',
      'Presidente: MAIRA ALEJANDRA MALAVER CALLEJAS. Deporte(s): Powerlifting. Localidad: Chapinero. Resolución R-D Nº 056. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3102477064',
      'team20powerlifting@gmail.com',
      ARRAY['Powerlifting']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'team-20-bogota-powerlifting-056',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-team-20-bogota-powerlifting-056', v_school_id, '{"resolucion_rd": "056", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "MAIRA ALEJANDRA MALAVER CALLEJAS", "localidad": "Chapinero", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAIRA ALEJANDRA MALAVER CALLEJAS. Deporte(s): Powerlifting. Localidad: Chapinero. Resolución R-D Nº 056. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102477064', phone),
      email       = COALESCE('team20powerlifting@gmail.com', email),
      sports      = ARRAY['Powerlifting']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "056", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "MAIRA ALEJANDRA MALAVER CALLEJAS", "localidad": "Chapinero", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-team-20-bogota-powerlifting-056';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3102477064', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
