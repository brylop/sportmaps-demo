-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 1/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WRESTLING FOR ALL  (IDRD-CLUB-club-deportivo-wrestling-for-all-1359)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-wrestling-for-all-1359';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WRESTLING FOR ALL',
      'Presidente: AIDEE MARICELA MORENO AREVALO. Deporte(s): Lucha. Localidad: Kennedy. Resolución R-D Nº 1359. Vigente hasta 2030-11-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3209619495',
      'wrestlingforall4@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-wrestling-for-all-1359',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-wrestling-for-all-1359', v_school_id, '{"resolucion_rd": "1359", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2025", "fecha_fin": "2030-11-24", "presidente": "AIDEE MARICELA MORENO AREVALO", "localidad": "Kennedy", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AIDEE MARICELA MORENO AREVALO. Deporte(s): Lucha. Localidad: Kennedy. Resolución R-D Nº 1359. Vigente hasta 2030-11-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209619495', phone),
      email       = COALESCE('wrestlingforall4@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1359", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2025", "fecha_fin": "2030-11-24", "presidente": "AIDEE MARICELA MORENO AREVALO", "localidad": "Kennedy", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-wrestling-for-all-1359';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3209619495', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ANDINO FUTBOL CLUB  (IDRD-CLUB-andino-futbol-club-129)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-andino-futbol-club-129';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ANDINO FUTBOL CLUB',
      'Presidente: IVAN NICOLAS GONZALEZ HERNANDEZ. Deporte(s): Fútbol, Fútbol de salón, Tejo. Localidad: Engativá. Resolución R-D Nº 129 / actualización Nº 965. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3192080137',
      'fcandino@gmail.com',
      ARRAY['Fútbol','Fútbol de salón','Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'andino-futbol-club-129',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-andino-futbol-club-129', v_school_id, '{"resolucion_rd": "129", "resolucion_actualizacion": "965", "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "IVAN NICOLAS GONZALEZ HERNANDEZ", "localidad": "Engativá", "sports": ["Fútbol", "Fútbol de salón", "Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVAN NICOLAS GONZALEZ HERNANDEZ. Deporte(s): Fútbol, Fútbol de salón, Tejo. Localidad: Engativá. Resolución R-D Nº 129 / actualización Nº 965. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3192080137', phone),
      email       = COALESCE('fcandino@gmail.com', email),
      sports      = ARRAY['Fútbol','Fútbol de salón','Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "129", "resolucion_actualizacion": "965", "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "IVAN NICOLAS GONZALEZ HERNANDEZ", "localidad": "Engativá", "sports": ["Fútbol", "Fútbol de salón", "Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-andino-futbol-club-129';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3192080137', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA BOGOTANA DE FUTBOL  (IDRD-CLUB-club-deportivo-academia-bogotana-de-futb-1748)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-bogotana-de-futb-1748';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA BOGOTANA DE FUTBOL',
      'Presidente: CARLOS EDUARDO PACHON LOPEZ. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 1748. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3057679094',
      'cskg8797@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-bogotana-de-futb-1748',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-bogotana-de-futb-1748', v_school_id, '{"resolucion_rd": "1748", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "CARLOS EDUARDO PACHON LOPEZ", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS EDUARDO PACHON LOPEZ. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 1748. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057679094', phone),
      email       = COALESCE('cskg8797@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1748", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "CARLOS EDUARDO PACHON LOPEZ", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-bogotana-de-futb-1748';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3057679094', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA FRANCESA DE FUTBOL  (IDRD-CLUB-club-deportivo-academia-francesa-de-futb-186)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-francesa-de-futb-186';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA FRANCESA DE FUTBOL',
      'Presidente: ELSA BONILLA PIRATOVA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 186 / actualización Nº 1690. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3158381496',
      'mcortes.navas@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-francesa-de-futb-186',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-francesa-de-futb-186', v_school_id, '{"resolucion_rd": "186", "resolucion_actualizacion": "1690", "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "ELSA BONILLA PIRATOVA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELSA BONILLA PIRATOVA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 186 / actualización Nº 1690. Vigente hasta 2027-03-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158381496', phone),
      email       = COALESCE('mcortes.navas@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "186", "resolucion_actualizacion": "1690", "fecha_inicio": "24-03-2022", "fecha_fin": "2027-03-24", "presidente": "ELSA BONILLA PIRATOVA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-francesa-de-futb-186';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3158381496', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA IGUARAN F.C.  (IDRD-CLUB-club-deportivo-academia-iguaran-fc-1686)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-iguaran-fc-1686';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA IGUARAN F.C.',
      'Presidente: CAMILO MISAEL IGUARAN CAMPO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1686. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3144796439',
      'academia@iguaran.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-iguaran-fc-1686',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-iguaran-fc-1686', v_school_id, '{"resolucion_rd": "1686", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "CAMILO MISAEL IGUARAN CAMPO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO MISAEL IGUARAN CAMPO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1686. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144796439', phone),
      email       = COALESCE('academia@iguaran.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1686", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "CAMILO MISAEL IGUARAN CAMPO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-iguaran-fc-1686';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3144796439', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACCIONES  (IDRD-CLUB-club-deportivo-acciones-876)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-acciones-876';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACCIONES',
      'Presidente: MARLON FABIAN BARBOSA PESELLIN. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 876 / actualización Nº 480. Vigente hasta 2030-08-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3123753482',
      'marlonfabian07@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-acciones-876',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-acciones-876', v_school_id, '{"resolucion_rd": "876", "resolucion_actualizacion": "480", "fecha_inicio": "22-08-2025", "fecha_fin": "2030-08-22", "presidente": "MARLON FABIAN BARBOSA PESELLIN", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARLON FABIAN BARBOSA PESELLIN. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 876 / actualización Nº 480. Vigente hasta 2030-08-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123753482', phone),
      email       = COALESCE('marlonfabian07@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "876", "resolucion_actualizacion": "480", "fecha_inicio": "22-08-2025", "fecha_fin": "2030-08-22", "presidente": "MARLON FABIAN BARBOSA PESELLIN", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-acciones-876';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3123753482', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ADVANTIX  (IDRD-CLUB-advantix-1580)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-advantix-1580';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ADVANTIX',
      'Presidente: VIVIANA CATALINA DELGADO RAMOS. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1580. Vigente hasta 2027-12-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3115315474',
      'teamadvantix2004@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'advantix-1580',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-advantix-1580', v_school_id, '{"resolucion_rd": "1580", "resolucion_actualizacion": null, "fecha_inicio": "05-12-2022", "fecha_fin": "2027-12-05", "presidente": "VIVIANA CATALINA DELGADO RAMOS", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VIVIANA CATALINA DELGADO RAMOS. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1580. Vigente hasta 2027-12-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115315474', phone),
      email       = COALESCE('teamadvantix2004@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1580", "resolucion_actualizacion": null, "fecha_inicio": "05-12-2022", "fecha_fin": "2027-12-05", "presidente": "VIVIANA CATALINA DELGADO RAMOS", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-advantix-1580';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3115315474', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AEROCLUB PARACAIDISMO COLOMBIA  (IDRD-CLUB-club-deportivo-aeroclub-paracaidismo-col-172)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-aeroclub-paracaidismo-col-172';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AEROCLUB PARACAIDISMO COLOMBIA',
      'Presidente: LUCÃA PATRICIA GUTIÃRREZ CASTAÃEDA. Deporte(s): Deportes Aereos. Localidad: Chapinero. Resolución R-D Nº 172. Vigente hasta 2030-02-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3102669623',
      'info@paracaidismocolombia.com',
      ARRAY['Deportes Aereos']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-aeroclub-paracaidismo-col-172',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-aeroclub-paracaidismo-col-172', v_school_id, '{"resolucion_rd": "172", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2025", "fecha_fin": "2030-02-28", "presidente": "LUCÃA PATRICIA GUTIÃRREZ CASTAÃEDA", "localidad": "Chapinero", "sports": ["Deportes Aereos"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUCÃA PATRICIA GUTIÃRREZ CASTAÃEDA. Deporte(s): Deportes Aereos. Localidad: Chapinero. Resolución R-D Nº 172. Vigente hasta 2030-02-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102669623', phone),
      email       = COALESCE('info@paracaidismocolombia.com', email),
      sports      = ARRAY['Deportes Aereos']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "172", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2025", "fecha_fin": "2030-02-28", "presidente": "LUCÃA PATRICIA GUTIÃRREZ CASTAÃEDA", "localidad": "Chapinero", "sports": ["Deportes Aereos"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-aeroclub-paracaidismo-col-172';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3102669623', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AEROSOUL  (IDRD-CLUB-club-deportivo-aerosoul-1107)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-aerosoul-1107';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AEROSOUL',
      'Presidente: CAMILA ANDREA CAMACHO URREGO. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 1107. Vigente hasta 2029-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3505554964',
      'aerosoulultimate@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-aerosoul-1107',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-aerosoul-1107', v_school_id, '{"resolucion_rd": "1107", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2024", "fecha_fin": "2029-08-15", "presidente": "CAMILA ANDREA CAMACHO URREGO", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILA ANDREA CAMACHO URREGO. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 1107. Vigente hasta 2029-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3505554964', phone),
      email       = COALESCE('aerosoulultimate@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1107", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2024", "fecha_fin": "2029-08-15", "presidente": "CAMILA ANDREA CAMACHO URREGO", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-aerosoul-1107';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3505554964', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DELFINES AGAPUS CLUB  (IDRD-CLUB-club-deportivo-delfines-agapus-club-1209)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-delfines-agapus-club-1209';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DELFINES AGAPUS CLUB',
      'Presidente: OMAIRA CRUZ LEÃN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1209. Vigente hasta 2029-08-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3112107888',
      'josegabrielcastro@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-delfines-agapus-club-1209',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-delfines-agapus-club-1209', v_school_id, '{"resolucion_rd": "1209", "resolucion_actualizacion": null, "fecha_inicio": "24-08-2024", "fecha_fin": "2029-08-24", "presidente": "OMAIRA CRUZ LEÃN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OMAIRA CRUZ LEÃN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1209. Vigente hasta 2029-08-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112107888', phone),
      email       = COALESCE('josegabrielcastro@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1209", "resolucion_actualizacion": null, "fecha_inicio": "24-08-2024", "fecha_fin": "2029-08-24", "presidente": "OMAIRA CRUZ LEÃN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-delfines-agapus-club-1209';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3112107888', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PARACAIDISMO XIELO  (IDRD-CLUB-club-deportivo-de-paracaidismo-xielo-1523)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-paracaidismo-xielo-1523';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PARACAIDISMO XIELO',
      'Presidente: ANA MARIA APONTE ZULUAGA. Deporte(s): Paracaidismo. Localidad: Usaquén. Resolución R-D Nº 1523. Vigente hasta 2029-11-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3102851055',
      'vuela@xielo.co',
      ARRAY['Paracaidismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-paracaidismo-xielo-1523',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-paracaidismo-xielo-1523', v_school_id, '{"resolucion_rd": "1523", "resolucion_actualizacion": null, "fecha_inicio": "06-11-2024", "fecha_fin": "2029-11-06", "presidente": "ANA MARIA APONTE ZULUAGA", "localidad": "Usaquén", "sports": ["Paracaidismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA MARIA APONTE ZULUAGA. Deporte(s): Paracaidismo. Localidad: Usaquén. Resolución R-D Nº 1523. Vigente hasta 2029-11-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102851055', phone),
      email       = COALESCE('vuela@xielo.co', email),
      sports      = ARRAY['Paracaidismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1523", "resolucion_actualizacion": null, "fecha_inicio": "06-11-2024", "fecha_fin": "2029-11-06", "presidente": "ANA MARIA APONTE ZULUAGA", "localidad": "Usaquén", "sports": ["Paracaidismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-paracaidismo-xielo-1523';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3102851055', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALEXANDRA VIVAS  (IDRD-CLUB-club-deportivo-alexandra-vivas-744)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alexandra-vivas-744';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALEXANDRA VIVAS',
      'Presidente: JHON WILLIAN TORRES NIEVA. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 744 / actualización Nº 1284. Vigente hasta 2027-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3105592125',
      'alxvivas.av@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alexandra-vivas-744',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alexandra-vivas-744', v_school_id, '{"resolucion_rd": "744", "resolucion_actualizacion": "1284", "fecha_inicio": "25-07-2022", "fecha_fin": "2027-07-25", "presidente": "JHON WILLIAN TORRES NIEVA", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON WILLIAN TORRES NIEVA. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 744 / actualización Nº 1284. Vigente hasta 2027-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105592125', phone),
      email       = COALESCE('alxvivas.av@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "744", "resolucion_actualizacion": "1284", "fecha_inicio": "25-07-2022", "fecha_fin": "2027-07-25", "presidente": "JHON WILLIAN TORRES NIEVA", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alexandra-vivas-744';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3105592125', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALIANZA BOGOTA  (IDRD-CLUB-alianza-bogota-1693)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-alianza-bogota-1693';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALIANZA BOGOTA',
      'Presidente: ALVARO DE JESÃÅ¡S PACHECO OCHOA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1693. Vigente hasta 2027-12-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3132927769',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'alianza-bogota-1693',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-alianza-bogota-1693', v_school_id, '{"resolucion_rd": "1693", "resolucion_actualizacion": null, "fecha_inicio": "21-12-2022", "fecha_fin": "2027-12-21", "presidente": "ALVARO DE JESÃÅ¡S PACHECO OCHOA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALVARO DE JESÃÅ¡S PACHECO OCHOA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1693. Vigente hasta 2027-12-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132927769', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1693", "resolucion_actualizacion": null, "fecha_inicio": "21-12-2022", "fecha_fin": "2027-12-21", "presidente": "ALVARO DE JESÃÅ¡S PACHECO OCHOA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-alianza-bogota-1693';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3132927769', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALIANZA ECUESTRE  (IDRD-CLUB-alianza-ecuestre-777)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-alianza-ecuestre-777';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALIANZA ECUESTRE',
      'Presidente: HUGO FERNANDO GAMBOA RODRIGUEZ. Deporte(s): Ecuestre. Localidad: Usaquén. Resolución R-D Nº 777. Vigente hasta 2027-07-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3102076090',
      'alianza.ecuestre@gmail.com',
      ARRAY['Ecuestre']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'alianza-ecuestre-777',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-alianza-ecuestre-777', v_school_id, '{"resolucion_rd": "777", "resolucion_actualizacion": null, "fecha_inicio": "13-07-2022", "fecha_fin": "2027-07-13", "presidente": "HUGO FERNANDO GAMBOA RODRIGUEZ", "localidad": "Usaquén", "sports": ["Ecuestre"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HUGO FERNANDO GAMBOA RODRIGUEZ. Deporte(s): Ecuestre. Localidad: Usaquén. Resolución R-D Nº 777. Vigente hasta 2027-07-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102076090', phone),
      email       = COALESCE('alianza.ecuestre@gmail.com', email),
      sports      = ARRAY['Ecuestre']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "777", "resolucion_actualizacion": null, "fecha_inicio": "13-07-2022", "fecha_fin": "2027-07-13", "presidente": "HUGO FERNANDO GAMBOA RODRIGUEZ", "localidad": "Usaquén", "sports": ["Ecuestre"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-alianza-ecuestre-777';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3102076090', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALIANZA FÃTBOL CLUB  (IDRD-CLUB-club-deportivo-alianza-fatbol-club-678)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alianza-fatbol-club-678';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALIANZA FÃTBOL CLUB',
      'Presidente: GUSTAVO CHAMUCERO GAITAN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 678 / actualización Nº 039. Vigente hasta 2026-09-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3013549006',
      'alianzasubafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alianza-fatbol-club-678',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alianza-fatbol-club-678', v_school_id, '{"resolucion_rd": "678", "resolucion_actualizacion": "039", "fecha_inicio": "22-09-2021", "fecha_fin": "2026-09-22", "presidente": "GUSTAVO CHAMUCERO GAITAN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GUSTAVO CHAMUCERO GAITAN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 678 / actualización Nº 039. Vigente hasta 2026-09-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013549006', phone),
      email       = COALESCE('alianzasubafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "678", "resolucion_actualizacion": "039", "fecha_inicio": "22-09-2021", "fecha_fin": "2026-09-22", "presidente": "GUSTAVO CHAMUCERO GAITAN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alianza-fatbol-club-678';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3013549006', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALIANZA SPORT  (IDRD-CLUB-alianza-sport-1333)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-alianza-sport-1333';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALIANZA SPORT',
      'Presidente: MIRIAM CECILIA ROBLES MORA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1333 / actualización Nº 291. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3108626599',
      'alianzasport@hotmail.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'alianza-sport-1333',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-alianza-sport-1333', v_school_id, '{"resolucion_rd": "1333", "resolucion_actualizacion": "291", "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "MIRIAM CECILIA ROBLES MORA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIRIAM CECILIA ROBLES MORA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1333 / actualización Nº 291. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108626599', phone),
      email       = COALESCE('alianzasport@hotmail.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1333", "resolucion_actualizacion": "291", "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "MIRIAM CECILIA ROBLES MORA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-alianza-sport-1333';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3108626599', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALL POWERS SPORTAEROBICS  (IDRD-CLUB-all-powers-sportaerobics-835)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-all-powers-sportaerobics-835';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALL POWERS SPORTAEROBICS',
      'Presidente: ELIAS MAURICIO MUÃâOZ CONTRERAS. Deporte(s): Gimnasia. Localidad: Fontibón. Resolución R-D Nº 835 / actualización Nº 77. Vigente hasta 2027-07-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '69429193126762386',
      'voleydiana@hotmail.com',
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'all-powers-sportaerobics-835',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-all-powers-sportaerobics-835', v_school_id, '{"resolucion_rd": "835", "resolucion_actualizacion": "77", "fecha_inicio": "22-07-2022", "fecha_fin": "2027-07-22", "presidente": "ELIAS MAURICIO MUÃâOZ CONTRERAS", "localidad": "Fontibón", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELIAS MAURICIO MUÃâOZ CONTRERAS. Deporte(s): Gimnasia. Localidad: Fontibón. Resolución R-D Nº 835 / actualización Nº 77. Vigente hasta 2027-07-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('69429193126762386', phone),
      email       = COALESCE('voleydiana@hotmail.com', email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "835", "resolucion_actualizacion": "77", "fecha_inicio": "22-07-2022", "fecha_fin": "2027-07-22", "presidente": "ELIAS MAURICIO MUÃâOZ CONTRERAS", "localidad": "Fontibón", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-all-powers-sportaerobics-835';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '69429193126762386', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALTAVISTA CAMPEONES CON CORAZON  (IDRD-CLUB-club-deportivo-altavista-campeones-con-c-1668)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-altavista-campeones-con-c-1668';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALTAVISTA CAMPEONES CON CORAZON',
      'Presidente: MARTHA AZUCENA MANRIQUE PEÃA. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1668. Vigente hasta 2029-11-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3123366453',
      'altavistaskatingclub@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-altavista-campeones-con-c-1668',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-altavista-campeones-con-c-1668', v_school_id, '{"resolucion_rd": "1668", "resolucion_actualizacion": null, "fecha_inicio": "19-11-2024", "fecha_fin": "2029-11-19", "presidente": "MARTHA AZUCENA MANRIQUE PEÃA", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTHA AZUCENA MANRIQUE PEÃA. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1668. Vigente hasta 2029-11-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123366453', phone),
      email       = COALESCE('altavistaskatingclub@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1668", "resolucion_actualizacion": null, "fecha_inicio": "19-11-2024", "fecha_fin": "2029-11-19", "presidente": "MARTHA AZUCENA MANRIQUE PEÃA", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-altavista-campeones-con-c-1668';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3123366453', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ANDECRAC  (IDRD-CLUB-andecrac-658)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-andecrac-658';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ANDECRAC',
      'Presidente: IBETH LILIANA MENDOZA TORRES. Deporte(s): Ajedrez, Bowling, Futbol 5, Goalball, Judo, Atletismo, Ciclismo, Natación, Triatlon. Localidad: Puente Aranda. Resolución R-D Nº 658. Vigente hasta 2028-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3124756560',
      'clubdeportivoandecracf5@gmail.com',
      ARRAY['Ajedrez','Bowling','Futbol 5','Goalball','Judo','Atletismo','Ciclismo','Natación','Triatlon']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'andecrac-658',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-andecrac-658', v_school_id, '{"resolucion_rd": "658", "resolucion_actualizacion": null, "fecha_inicio": "22-06-2023", "fecha_fin": "2028-06-21", "presidente": "IBETH LILIANA MENDOZA TORRES", "localidad": "Puente Aranda", "sports": ["Ajedrez", "Bowling", "Futbol 5", "Goalball", "Judo", "Atletismo", "Ciclismo", "Natación", "Triatlon"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IBETH LILIANA MENDOZA TORRES. Deporte(s): Ajedrez, Bowling, Futbol 5, Goalball, Judo, Atletismo, Ciclismo, Natación, Triatlon. Localidad: Puente Aranda. Resolución R-D Nº 658. Vigente hasta 2028-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124756560', phone),
      email       = COALESCE('clubdeportivoandecracf5@gmail.com', email),
      sports      = ARRAY['Ajedrez','Bowling','Futbol 5','Goalball','Judo','Atletismo','Ciclismo','Natación','Triatlon']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "658", "resolucion_actualizacion": null, "fecha_inicio": "22-06-2023", "fecha_fin": "2028-06-21", "presidente": "IBETH LILIANA MENDOZA TORRES", "localidad": "Puente Aranda", "sports": ["Ajedrez", "Bowling", "Futbol 5", "Goalball", "Judo", "Atletismo", "Ciclismo", "Natación", "Triatlon"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-andecrac-658';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3124756560', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ANDINOS  (IDRD-CLUB-andinos-1569)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-andinos-1569';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ANDINOS',
      'Presidente: BENIGNO GRACIA GIRALDO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1569. Vigente hasta 2028-12-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3142461527',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'andinos-1569',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-andinos-1569', v_school_id, '{"resolucion_rd": "1569", "resolucion_actualizacion": null, "fecha_inicio": "07-12-2023", "fecha_fin": "2028-12-06", "presidente": "BENIGNO GRACIA GIRALDO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BENIGNO GRACIA GIRALDO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1569. Vigente hasta 2028-12-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142461527', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1569", "resolucion_actualizacion": null, "fecha_inicio": "07-12-2023", "fecha_fin": "2028-12-06", "presidente": "BENIGNO GRACIA GIRALDO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-andinos-1569';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3142461527', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ANGELS SKATE CLUB  (IDRD-CLUB-club-deportivo-angels-skate-club-1535)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-angels-skate-club-1535';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ANGELS SKATE CLUB',
      'Presidente: HECTOR JULIO RIVERA GONZALEZ. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1535. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3104869904',
      'angels.skate.club@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-angels-skate-club-1535',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-angels-skate-club-1535', v_school_id, '{"resolucion_rd": "1535", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "HECTOR JULIO RIVERA GONZALEZ", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HECTOR JULIO RIVERA GONZALEZ. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1535. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3104869904', phone),
      email       = COALESCE('angels.skate.club@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1535", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "HECTOR JULIO RIVERA GONZALEZ", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-angels-skate-club-1535';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3104869904', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ANTARES DE LA SABANA  (IDRD-CLUB-antares-de-la-sabana-953)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-antares-de-la-sabana-953';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ANTARES DE LA SABANA',
      'Presidente: MARCELA EUGENIA MUÃâOZ POSADA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 953. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '4858076',
      'clubdeportivoantaresdelasabana@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'antares-de-la-sabana-953',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-antares-de-la-sabana-953', v_school_id, '{"resolucion_rd": "953", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "MARCELA EUGENIA MUÃâOZ POSADA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCELA EUGENIA MUÃâOZ POSADA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 953. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4858076', phone),
      email       = COALESCE('clubdeportivoantaresdelasabana@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "953", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "MARCELA EUGENIA MUÃâOZ POSADA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-antares-de-la-sabana-953';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '4858076', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAUROS  (IDRD-CLUB-club-deportivo-tauros-985)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tauros-985';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAUROS',
      'Presidente: SANTIAGO ALBERTO MAURICIO. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 985. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3144690575',
      'mauricio242515@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tauros-985',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tauros-985', v_school_id, '{"resolucion_rd": "985", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "SANTIAGO ALBERTO MAURICIO", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO ALBERTO MAURICIO. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 985. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144690575', phone),
      email       = COALESCE('mauricio242515@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "985", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "SANTIAGO ALBERTO MAURICIO", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tauros-985';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3144690575', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ARQUEROS ORION  (IDRD-CLUB-arqueros-orion-187)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-arqueros-orion-187';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ARQUEROS ORION',
      'Presidente: ALFONSO AMAYA POLANCO. Localidad: Barrios Unidos. Resolución R-D Nº 187. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3187836011',
      'alpolanc@yahoo.es',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'arqueros-orion-187',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-arqueros-orion-187', v_school_id, '{"resolucion_rd": "187", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "ALFONSO AMAYA POLANCO", "localidad": "Barrios Unidos", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALFONSO AMAYA POLANCO. Localidad: Barrios Unidos. Resolución R-D Nº 187. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187836011', phone),
      email       = COALESCE('alpolanc@yahoo.es', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "187", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "ALFONSO AMAYA POLANCO", "localidad": "Barrios Unidos", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-arqueros-orion-187';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3187836011', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ASORSUB DE LA ASOCIACION DE SORDOS DE SUBA - BOGOTÃÆÃÂ  (IDRD-CLUB-asorsub-de-la-asociacion-de-sordos-de-su-1003)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-asorsub-de-la-asociacion-de-sordos-de-su-1003';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ASORSUB DE LA ASOCIACION DE SORDOS DE SUBA - BOGOTÃÆÃÂ',
      'Presidente: JUAN CARLOS ESPINOSA BARRERA. Deporte(s): Sordos, Baloncesto, Bowling, Fútbol, Atletismo, Ciclismo, Natación, Tenis de mesa. Localidad: Suba. Resolución R-D Nº 1003. Vigente hasta 2027-09-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6846093',
      'asorsub2006@gmail.com',
      ARRAY['Sordos','Baloncesto','Bowling','Fútbol','Atletismo','Ciclismo','Natación','Tenis de mesa']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'asorsub-de-la-asociacion-de-sordos-de-su-1003',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-asorsub-de-la-asociacion-de-sordos-de-su-1003', v_school_id, '{"resolucion_rd": "1003", "resolucion_actualizacion": null, "fecha_inicio": "10-09-2022", "fecha_fin": "2027-09-10", "presidente": "JUAN CARLOS ESPINOSA BARRERA", "localidad": "Suba", "sports": ["Sordos", "Baloncesto", "Bowling", "Fútbol", "Atletismo", "Ciclismo", "Natación", "Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS ESPINOSA BARRERA. Deporte(s): Sordos, Baloncesto, Bowling, Fútbol, Atletismo, Ciclismo, Natación, Tenis de mesa. Localidad: Suba. Resolución R-D Nº 1003. Vigente hasta 2027-09-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6846093', phone),
      email       = COALESCE('asorsub2006@gmail.com', email),
      sports      = ARRAY['Sordos','Baloncesto','Bowling','Fútbol','Atletismo','Ciclismo','Natación','Tenis de mesa']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1003", "resolucion_actualizacion": null, "fecha_inicio": "10-09-2022", "fecha_fin": "2027-09-10", "presidente": "JUAN CARLOS ESPINOSA BARRERA", "localidad": "Suba", "sports": ["Sordos", "Baloncesto", "Bowling", "Fútbol", "Atletismo", "Ciclismo", "Natación", "Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-asorsub-de-la-asociacion-de-sordos-de-su-1003';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6846093', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ASOCIACIÃN FUTBOL CLASE  (IDRD-CLUB-club-deportivo-asociacian-futbol-clase-798)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-asociacian-futbol-clase-798';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ASOCIACIÃN FUTBOL CLASE',
      'Presidente: CHRISTIAN CAMILO QUINTERO QUINTERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 798. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3123673791',
      'clubfutbolclase@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-asociacian-futbol-clase-798',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-asociacian-futbol-clase-798', v_school_id, '{"resolucion_rd": "798", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "CHRISTIAN CAMILO QUINTERO QUINTERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CHRISTIAN CAMILO QUINTERO QUINTERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 798. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123673791', phone),
      email       = COALESCE('clubfutbolclase@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "798", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "CHRISTIAN CAMILO QUINTERO QUINTERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-asociacian-futbol-clase-798';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3123673791', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ASTROS COLOMBIA  (IDRD-CLUB-club-deportivo-astros-colombia-203)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-astros-colombia-203';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ASTROS COLOMBIA',
      'Presidente: CESAR IVAN URIBE MOLINA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 203 / actualización Nº 711. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3106994304',
      'jhercules130r@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-astros-colombia-203',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-astros-colombia-203', v_school_id, '{"resolucion_rd": "203", "resolucion_actualizacion": "711", "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "CESAR IVAN URIBE MOLINA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR IVAN URIBE MOLINA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 203 / actualización Nº 711. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106994304', phone),
      email       = COALESCE('jhercules130r@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "203", "resolucion_actualizacion": "711", "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "CESAR IVAN URIBE MOLINA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-astros-colombia-203';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3106994304', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLAS COLOMBIA  (IDRD-CLUB-atlas-colombia-888)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atlas-colombia-888';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLAS COLOMBIA',
      'Presidente: LUISA FERNANDA MORALES RAMIREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 888 / actualización Nº 212. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3203193752',
      'atlasfutbolclub@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atlas-colombia-888',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atlas-colombia-888', v_school_id, '{"resolucion_rd": "888", "resolucion_actualizacion": "212", "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "LUISA FERNANDA MORALES RAMIREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUISA FERNANDA MORALES RAMIREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 888 / actualización Nº 212. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203193752', phone),
      email       = COALESCE('atlasfutbolclub@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "888", "resolucion_actualizacion": "212", "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "LUISA FERNANDA MORALES RAMIREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atlas-colombia-888';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3203193752', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETICO FUNDACION OLIMPUS  (IDRD-CLUB-atletico-fundacion-olimpus-722)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletico-fundacion-olimpus-722';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETICO FUNDACION OLIMPUS',
      'Presidente: JULIAN FEDERICO MALDONADO GOMEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 722. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3204326541',
      'fundacionolimpuscrd@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletico-fundacion-olimpus-722',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletico-fundacion-olimpus-722', v_school_id, '{"resolucion_rd": "722", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "JULIAN FEDERICO MALDONADO GOMEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIAN FEDERICO MALDONADO GOMEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 722. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204326541', phone),
      email       = COALESCE('fundacionolimpuscrd@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "722", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "JULIAN FEDERICO MALDONADO GOMEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletico-fundacion-olimpus-722';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3204326541', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETICO INDEPENDIENTE JUNIOR  (IDRD-CLUB-atletico-independiente-junior-174)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletico-independiente-junior-174';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETICO INDEPENDIENTE JUNIOR',
      'Presidente: SARA PATRICIA PULIDO SANDOVAL. Deporte(s): Atletismo. Resolución R-D Nº 174 / actualización Nº 617. Vigente hasta 2027-02-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3012864741',
      'sandra.pulidosan@hotmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletico-independiente-junior-174',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletico-independiente-junior-174', v_school_id, '{"resolucion_rd": "174", "resolucion_actualizacion": "617", "fecha_inicio": "24-02-2022", "fecha_fin": "2027-02-24", "presidente": "SARA PATRICIA PULIDO SANDOVAL", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SARA PATRICIA PULIDO SANDOVAL. Deporte(s): Atletismo. Resolución R-D Nº 174 / actualización Nº 617. Vigente hasta 2027-02-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012864741', phone),
      email       = COALESCE('sandra.pulidosan@hotmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "174", "resolucion_actualizacion": "617", "fecha_inicio": "24-02-2022", "fecha_fin": "2027-02-24", "presidente": "SARA PATRICIA PULIDO SANDOVAL", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletico-independiente-junior-174';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETICO TIGRES  (IDRD-CLUB-atletico-tigres-512)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletico-tigres-512';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETICO TIGRES',
      'Presidente: JIMENA DEL SOCORRO GUERRA PAREDES. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 512 / actualización Nº 1609. Vigente hasta 2026-07-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '311974702',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletico-tigres-512',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletico-tigres-512', v_school_id, '{"resolucion_rd": "512", "resolucion_actualizacion": "1609", "fecha_inicio": "12-07-2021", "fecha_fin": "2026-07-12", "presidente": "JIMENA DEL SOCORRO GUERRA PAREDES", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JIMENA DEL SOCORRO GUERRA PAREDES. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 512 / actualización Nº 1609. Vigente hasta 2026-07-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('311974702', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "512", "resolucion_actualizacion": "1609", "fecha_inicio": "12-07-2021", "fecha_fin": "2026-07-12", "presidente": "JIMENA DEL SOCORRO GUERRA PAREDES", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletico-tigres-512';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '311974702', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETICOS DE CIUDADELA  (IDRD-CLUB-atleticos-de-ciudadela-1159)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atleticos-de-ciudadela-1159';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETICOS DE CIUDADELA',
      'Presidente: JAVIER ARTURO URIBE RUEDA. Deporte(s): Béisbol. Localidad: Engativá. Resolución R-D Nº 1159. Vigente hasta 2028-09-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3173144288',
      'uribejavier@yahoo.com',
      ARRAY['Béisbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atleticos-de-ciudadela-1159',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atleticos-de-ciudadela-1159', v_school_id, '{"resolucion_rd": "1159", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2023", "fecha_fin": "2028-09-26", "presidente": "JAVIER ARTURO URIBE RUEDA", "localidad": "Engativá", "sports": ["Béisbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAVIER ARTURO URIBE RUEDA. Deporte(s): Béisbol. Localidad: Engativá. Resolución R-D Nº 1159. Vigente hasta 2028-09-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173144288', phone),
      email       = COALESCE('uribejavier@yahoo.com', email),
      sports      = ARRAY['Béisbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1159", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2023", "fecha_fin": "2028-09-26", "presidente": "JAVIER ARTURO URIBE RUEDA", "localidad": "Engativá", "sports": ["Béisbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atleticos-de-ciudadela-1159';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3173144288', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETISMO PROYECTO ESTILO DE VIDA  (IDRD-CLUB-atletismo-proyecto-estilo-de-vida-1651)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletismo-proyecto-estilo-de-vida-1651';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETISMO PROYECTO ESTILO DE VIDA',
      'Presidente: EDGARD MARTIN SOLER PACHECO. Deporte(s): Atletismo. Localidad: Suba. Resolución R-D Nº 1651. Vigente hasta 2027-12-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3208170806',
      'clubdeportivoapev@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletismo-proyecto-estilo-de-vida-1651',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletismo-proyecto-estilo-de-vida-1651', v_school_id, '{"resolucion_rd": "1651", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2022", "fecha_fin": "2027-12-15", "presidente": "EDGARD MARTIN SOLER PACHECO", "localidad": "Suba", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGARD MARTIN SOLER PACHECO. Deporte(s): Atletismo. Localidad: Suba. Resolución R-D Nº 1651. Vigente hasta 2027-12-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208170806', phone),
      email       = COALESCE('clubdeportivoapev@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1651", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2022", "fecha_fin": "2027-12-15", "presidente": "EDGARD MARTIN SOLER PACHECO", "localidad": "Suba", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletismo-proyecto-estilo-de-vida-1651';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3208170806', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MARLIN DE BOGOTÃ  (IDRD-CLUB-marlin-de-bogota-1652)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-marlin-de-bogota-1652';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MARLIN DE BOGOTÃ',
      'Presidente: OSCAR VALDES GÃMEZ. Deporte(s): Béisbol. Localidad: San Cristóbal. Resolución R-D Nº 1652. Vigente hasta 2027-12-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3105647155',
      'valdesgomezoscar1@gmail.com',
      ARRAY['Béisbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'marlin-de-bogota-1652',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-marlin-de-bogota-1652', v_school_id, '{"resolucion_rd": "1652", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2022", "fecha_fin": "2027-12-15", "presidente": "OSCAR VALDES GÃMEZ", "localidad": "San Cristóbal", "sports": ["Béisbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR VALDES GÃMEZ. Deporte(s): Béisbol. Localidad: San Cristóbal. Resolución R-D Nº 1652. Vigente hasta 2027-12-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105647155', phone),
      email       = COALESCE('valdesgomezoscar1@gmail.com', email),
      sports      = ARRAY['Béisbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1652", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2022", "fecha_fin": "2027-12-15", "presidente": "OSCAR VALDES GÃMEZ", "localidad": "San Cristóbal", "sports": ["Béisbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-marlin-de-bogota-1652';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3105647155', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- AULA BILLAR  (IDRD-CLUB-aula-billar-1258)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-aula-billar-1258';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'AULA BILLAR',
      'Presidente: JOSÃâ° RODRIGO LOSADA SÃÂNCHEZ. Deporte(s): Billar. Localidad: Barrios Unidos. Resolución R-D Nº 1258. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3107856904',
      NULL,
      ARRAY['Billar']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'aula-billar-1258',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-aula-billar-1258', v_school_id, '{"resolucion_rd": "1258", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "JOSÃâ° RODRIGO LOSADA SÃÂNCHEZ", "localidad": "Barrios Unidos", "sports": ["Billar"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃâ° RODRIGO LOSADA SÃÂNCHEZ. Deporte(s): Billar. Localidad: Barrios Unidos. Resolución R-D Nº 1258. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107856904', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Billar']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1258", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "JOSÃâ° RODRIGO LOSADA SÃÂNCHEZ", "localidad": "Barrios Unidos", "sports": ["Billar"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-aula-billar-1258';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3107856904', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AZUL PROFUNDO  (IDRD-CLUB-club-deportivo-azul-profundo-905)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-azul-profundo-905';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AZUL PROFUNDO',
      'Presidente: JUAN CARLOS GONZALEZ CUELLAR. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 905 / actualización Nº 1155. Vigente hasta 2027-08-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3103070075',
      'azulprofundoclubdeportivo@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-azul-profundo-905',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-azul-profundo-905', v_school_id, '{"resolucion_rd": "905", "resolucion_actualizacion": "1155", "fecha_inicio": "23-08-2022", "fecha_fin": "2027-08-23", "presidente": "JUAN CARLOS GONZALEZ CUELLAR", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS GONZALEZ CUELLAR. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 905 / actualización Nº 1155. Vigente hasta 2027-08-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103070075', phone),
      email       = COALESCE('azulprofundoclubdeportivo@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "905", "resolucion_actualizacion": "1155", "fecha_inicio": "23-08-2022", "fecha_fin": "2027-08-23", "presidente": "JUAN CARLOS GONZALEZ CUELLAR", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-azul-profundo-905';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3103070075', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BVS SPORTS  (IDRD-CLUB-club-deportivo-bvs-sports-626)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bvs-sports-626';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BVS SPORTS',
      'Presidente: OSCAR RENE MORALES RODRIGUEZ. Deporte(s): Gimnasia, Voleibol, Fútbol, Baloncesto. Localidad: Usaquén. Resolución R-D Nº 626 / actualización Nº 626. Vigente hasta 2027-06-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3043493504',
      'bssports01@gmail.com',
      ARRAY['Gimnasia','Voleibol','Fútbol','Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bvs-sports-626',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bvs-sports-626', v_school_id, '{"resolucion_rd": "626", "resolucion_actualizacion": "626", "fecha_inicio": "15-06-2022", "fecha_fin": "2027-06-15", "presidente": "OSCAR RENE MORALES RODRIGUEZ", "localidad": "Usaquén", "sports": ["Gimnasia", "Voleibol", "Fútbol", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR RENE MORALES RODRIGUEZ. Deporte(s): Gimnasia, Voleibol, Fútbol, Baloncesto. Localidad: Usaquén. Resolución R-D Nº 626 / actualización Nº 626. Vigente hasta 2027-06-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043493504', phone),
      email       = COALESCE('bssports01@gmail.com', email),
      sports      = ARRAY['Gimnasia','Voleibol','Fútbol','Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "626", "resolucion_actualizacion": "626", "fecha_inicio": "15-06-2022", "fecha_fin": "2027-06-15", "presidente": "OSCAR RENE MORALES RODRIGUEZ", "localidad": "Usaquén", "sports": ["Gimnasia", "Voleibol", "Fútbol", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bvs-sports-626';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3043493504', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BACATA DC  (IDRD-CLUB-bacata-dc-170)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bacata-dc-170';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BACATA DC',
      'Presidente: DIANA MILENA RICO MESA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 170. Vigente hasta 2027-02-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3102352361',
      'clubdeportivobacatadc@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bacata-dc-170',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bacata-dc-170', v_school_id, '{"resolucion_rd": "170", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2022", "fecha_fin": "2027-02-23", "presidente": "DIANA MILENA RICO MESA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA MILENA RICO MESA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 170. Vigente hasta 2027-02-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102352361', phone),
      email       = COALESCE('clubdeportivobacatadc@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "170", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2022", "fecha_fin": "2027-02-23", "presidente": "DIANA MILENA RICO MESA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bacata-dc-170';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3102352361', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE BAILE DEPORTIVO BAILANDO ANDO  (IDRD-CLUB-club-de-baile-deportivo-bailando-ando-634)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-baile-deportivo-bailando-ando-634';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE BAILE DEPORTIVO BAILANDO ANDO',
      'Presidente: SHANON LUCIA CAMARGO QUIJANO. Deporte(s): Baile Deportivo. Localidad: Engativá. Resolución R-D Nº 634. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3023472010',
      'clubdebailedeportivobailandoando@hotmail.com',
      ARRAY['Baile Deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-baile-deportivo-bailando-ando-634',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-baile-deportivo-bailando-ando-634', v_school_id, '{"resolucion_rd": "634", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "SHANON LUCIA CAMARGO QUIJANO", "localidad": "Engativá", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SHANON LUCIA CAMARGO QUIJANO. Deporte(s): Baile Deportivo. Localidad: Engativá. Resolución R-D Nº 634. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3023472010', phone),
      email       = COALESCE('clubdebailedeportivobailandoando@hotmail.com', email),
      sports      = ARRAY['Baile Deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "634", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "SHANON LUCIA CAMARGO QUIJANO", "localidad": "Engativá", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-baile-deportivo-bailando-ando-634';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3023472010', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BAMBOO  (IDRD-CLUB-bamboo-1247)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bamboo-1247';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BAMBOO',
      'Presidente: MELANY JULIANA VASQUEZ MARIÃâO. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 1247 / actualización Nº 450. Vigente hasta 2028-10-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3202166748',
      'bambooultimatecol@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bamboo-1247',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bamboo-1247', v_school_id, '{"resolucion_rd": "1247", "resolucion_actualizacion": "450", "fecha_inicio": "17-10-2023", "fecha_fin": "2028-10-16", "presidente": "MELANY JULIANA VASQUEZ MARIÃâO", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MELANY JULIANA VASQUEZ MARIÃâO. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 1247 / actualización Nº 450. Vigente hasta 2028-10-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202166748', phone),
      email       = COALESCE('bambooultimatecol@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1247", "resolucion_actualizacion": "450", "fecha_inicio": "17-10-2023", "fecha_fin": "2028-10-16", "presidente": "MELANY JULIANA VASQUEZ MARIÃâO", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bamboo-1247';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3202166748', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BARBARIANS RUGBY FOOTBALL CLUB  (IDRD-CLUB-club-deportivo-barbarians-rugby-football-1690)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-barbarians-rugby-football-1690';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BARBARIANS RUGBY FOOTBALL CLUB',
      'Presidente: JAVIER ANDRES NORIEGA GUERRERO. Deporte(s): Rugby. Localidad: Engativá. Resolución R-D Nº 1690. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3125519005',
      'barbariansrfc@gmail.com',
      ARRAY['Rugby']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-barbarians-rugby-football-1690',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-barbarians-rugby-football-1690', v_school_id, '{"resolucion_rd": "1690", "resolucion_actualizacion": null, "fecha_inicio": "08-01-2026", "fecha_fin": "2031-01-08", "presidente": "JAVIER ANDRES NORIEGA GUERRERO", "localidad": "Engativá", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAVIER ANDRES NORIEGA GUERRERO. Deporte(s): Rugby. Localidad: Engativá. Resolución R-D Nº 1690. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125519005', phone),
      email       = COALESCE('barbariansrfc@gmail.com', email),
      sports      = ARRAY['Rugby']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1690", "resolucion_actualizacion": null, "fecha_inicio": "08-01-2026", "fecha_fin": "2031-01-08", "presidente": "JAVIER ANDRES NORIEGA GUERRERO", "localidad": "Engativá", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-barbarians-rugby-football-1690';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3125519005', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BARCELONA BOSA  (IDRD-CLUB-club-deportivo-barcelona-bosa-1740)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-barcelona-bosa-1740';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BARCELONA BOSA',
      'Presidente: MARVIN EDUARDO ANGOLA BALANTA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1740. Vigente hasta 2029-12-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3122277980',
      'gerenciabfcb@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-barcelona-bosa-1740',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-barcelona-bosa-1740', v_school_id, '{"resolucion_rd": "1740", "resolucion_actualizacion": null, "fecha_inicio": "11-12-2024", "fecha_fin": "2029-12-11", "presidente": "MARVIN EDUARDO ANGOLA BALANTA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARVIN EDUARDO ANGOLA BALANTA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1740. Vigente hasta 2029-12-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3122277980', phone),
      email       = COALESCE('gerenciabfcb@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1740", "resolucion_actualizacion": null, "fecha_inicio": "11-12-2024", "fecha_fin": "2029-12-11", "presidente": "MARVIN EDUARDO ANGOLA BALANTA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-barcelona-bosa-1740';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3122277980', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BARZA LIFOR  (IDRD-CLUB-barza-lifor-435)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-barza-lifor-435';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BARZA LIFOR',
      'Presidente: LIBARDO FORI ZAPE. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 435. Vigente hasta 2028-05-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '4508439',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'barza-lifor-435',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-barza-lifor-435', v_school_id, '{"resolucion_rd": "435", "resolucion_actualizacion": null, "fecha_inicio": "11-05-2023", "fecha_fin": "2028-05-10", "presidente": "LIBARDO FORI ZAPE", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LIBARDO FORI ZAPE. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 435. Vigente hasta 2028-05-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4508439', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "435", "resolucion_actualizacion": null, "fecha_inicio": "11-05-2023", "fecha_fin": "2028-05-10", "presidente": "LIBARDO FORI ZAPE", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-barza-lifor-435';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '4508439', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BARZA SOCCER  (IDRD-CLUB-club-deportivo-barza-soccer-448)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-barza-soccer-448';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BARZA SOCCER',
      'Presidente: RUBEN DARIO RAMIREZ MARTINEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 448 / actualización Nº 058. Vigente hasta 2029-06-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '43080213125555955',
      'barzasoccercd@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-barza-soccer-448',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-barza-soccer-448', v_school_id, '{"resolucion_rd": "448", "resolucion_actualizacion": "058", "fecha_inicio": "08-06-2024", "fecha_fin": "2029-06-08", "presidente": "RUBEN DARIO RAMIREZ MARTINEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RUBEN DARIO RAMIREZ MARTINEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 448 / actualización Nº 058. Vigente hasta 2029-06-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('43080213125555955', phone),
      email       = COALESCE('barzasoccercd@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "448", "resolucion_actualizacion": "058", "fecha_inicio": "08-06-2024", "fecha_fin": "2029-06-08", "presidente": "RUBEN DARIO RAMIREZ MARTINEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-barza-soccer-448';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '43080213125555955', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BELHORIZONT F.C.  (IDRD-CLUB-belhorizont-fc-1389)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-belhorizont-fc-1389';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BELHORIZONT F.C.',
      'Presidente: KAREN LILIANA ESPINOSA PULIDO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1389 / actualización Nº 1128. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3112211720',
      'manv42@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'belhorizont-fc-1389',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-belhorizont-fc-1389', v_school_id, '{"resolucion_rd": "1389", "resolucion_actualizacion": "1128", "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "KAREN LILIANA ESPINOSA PULIDO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN LILIANA ESPINOSA PULIDO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1389 / actualización Nº 1128. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112211720', phone),
      email       = COALESCE('manv42@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1389", "resolucion_actualizacion": "1128", "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "KAREN LILIANA ESPINOSA PULIDO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-belhorizont-fc-1389';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3112211720', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BESSER F.C  (IDRD-CLUB-club-deportivo-besser-fc-080)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-besser-fc-080';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BESSER F.C',
      'Presidente: LAURA PAOLA BALDION ALBARRACIN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 080 / actualización Nº 1749. Vigente hasta 2027-02-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '80179415335946',
      'pedrobesser@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-besser-fc-080',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-besser-fc-080', v_school_id, '{"resolucion_rd": "080", "resolucion_actualizacion": "1749", "fecha_inicio": "25-02-2022", "fecha_fin": "2027-02-25", "presidente": "LAURA PAOLA BALDION ALBARRACIN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LAURA PAOLA BALDION ALBARRACIN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 080 / actualización Nº 1749. Vigente hasta 2027-02-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('80179415335946', phone),
      email       = COALESCE('pedrobesser@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "080", "resolucion_actualizacion": "1749", "fecha_inicio": "25-02-2022", "fecha_fin": "2027-02-25", "presidente": "LAURA PAOLA BALDION ALBARRACIN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-besser-fc-080';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '80179415335946', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BMX BOGOTA  (IDRD-CLUB-bmx-bogota-1613)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bmx-bogota-1613';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BMX BOGOTA',
      'Presidente: MONICA VIVIANA ARANGUREN MARTIN. Deporte(s): Ciclismo. Localidad: Chapinero. Resolución R-D Nº 1613 / actualización Nº 643. Vigente hasta 2028-12-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3204999576',
      'clubbmxbogota@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bmx-bogota-1613',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bmx-bogota-1613', v_school_id, '{"resolucion_rd": "1613", "resolucion_actualizacion": "643", "fecha_inicio": "19-12-2023", "fecha_fin": "2028-12-18", "presidente": "MONICA VIVIANA ARANGUREN MARTIN", "localidad": "Chapinero", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MONICA VIVIANA ARANGUREN MARTIN. Deporte(s): Ciclismo. Localidad: Chapinero. Resolución R-D Nº 1613 / actualización Nº 643. Vigente hasta 2028-12-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204999576', phone),
      email       = COALESCE('clubbmxbogota@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1613", "resolucion_actualizacion": "643", "fecha_inicio": "19-12-2023", "fecha_fin": "2028-12-18", "presidente": "MONICA VIVIANA ARANGUREN MARTIN", "localidad": "Chapinero", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bmx-bogota-1613';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3204999576', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TITANES F.C.  (IDRD-CLUB-titanes-fc-150)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-titanes-fc-150';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TITANES F.C.',
      'Presidente: JULIÃÆÃÂN CAMILO ZAMBRANO VALDERRAMA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 150 / actualización Nº 392. Vigente hasta 2027-02-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '537787893014814291',
      'necaxafuerzazbasicas@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'titanes-fc-150',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-titanes-fc-150', v_school_id, '{"resolucion_rd": "150", "resolucion_actualizacion": "392", "fecha_inicio": "17-02-2022", "fecha_fin": "2027-02-17", "presidente": "JULIÃÆÃÂN CAMILO ZAMBRANO VALDERRAMA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIÃÆÃÂN CAMILO ZAMBRANO VALDERRAMA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 150 / actualización Nº 392. Vigente hasta 2027-02-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('537787893014814291', phone),
      email       = COALESCE('necaxafuerzazbasicas@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "150", "resolucion_actualizacion": "392", "fecha_inicio": "17-02-2022", "fecha_fin": "2027-02-17", "presidente": "JULIÃÆÃÂN CAMILO ZAMBRANO VALDERRAMA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-titanes-fc-150';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '537787893014814291', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BOGOTA ELITE D.C  (IDRD-CLUB-bogota-elite-dc-1397)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bogota-elite-dc-1397';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOGOTA ELITE D.C',
      'Presidente: MARCY JUDITH DIAZ GRANADOS SIERRA. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 1397. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3008021509',
      'contacto@clubbogotaelite.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bogota-elite-dc-1397',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bogota-elite-dc-1397', v_school_id, '{"resolucion_rd": "1397", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "MARCY JUDITH DIAZ GRANADOS SIERRA", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCY JUDITH DIAZ GRANADOS SIERRA. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 1397. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008021509', phone),
      email       = COALESCE('contacto@clubbogotaelite.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1397", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "MARCY JUDITH DIAZ GRANADOS SIERRA", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bogota-elite-dc-1397';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3008021509', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KAPITAL SOCCER F.C.  (IDRD-CLUB-club-deportivo-kapital-soccer-fc-998)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kapital-soccer-fc-998';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KAPITAL SOCCER F.C.',
      'Presidente: FRANCO ANDRES JOSA GRANJA. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 998. Vigente hasta 2029-07-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3102175468',
      'kapitalsoccerfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kapital-soccer-fc-998',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kapital-soccer-fc-998', v_school_id, '{"resolucion_rd": "998", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2024", "fecha_fin": "2029-07-29", "presidente": "FRANCO ANDRES JOSA GRANJA", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FRANCO ANDRES JOSA GRANJA. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 998. Vigente hasta 2029-07-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102175468', phone),
      email       = COALESCE('kapitalsoccerfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "998", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2024", "fecha_fin": "2029-07-29", "presidente": "FRANCO ANDRES JOSA GRANJA", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kapital-soccer-fc-998';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3102175468', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTA TENNIS CLUB CAMPESTRE  (IDRD-CLUB-club-deportivo-bogota-tennis-club-campes-244)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-tennis-club-campes-244';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTA TENNIS CLUB CAMPESTRE',
      'Presidente: LUIS FELIPE BARRIOS CADENA. Deporte(s): Golf, Natación, Squash, Tenis, Fútbol. Localidad: Suba. Resolución R-D Nº 244. Vigente hasta 2029-03-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '67614466760110',
      'bogotatennis@btcc.com.co',
      ARRAY['Golf','Natación','Squash','Tenis','Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogota-tennis-club-campes-244',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogota-tennis-club-campes-244', v_school_id, '{"resolucion_rd": "244", "resolucion_actualizacion": null, "fecha_inicio": "18-03-2024", "fecha_fin": "2029-03-18", "presidente": "LUIS FELIPE BARRIOS CADENA", "localidad": "Suba", "sports": ["Golf", "Natación", "Squash", "Tenis", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS FELIPE BARRIOS CADENA. Deporte(s): Golf, Natación, Squash, Tenis, Fútbol. Localidad: Suba. Resolución R-D Nº 244. Vigente hasta 2029-03-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('67614466760110', phone),
      email       = COALESCE('bogotatennis@btcc.com.co', email),
      sports      = ARRAY['Golf','Natación','Squash','Tenis','Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "244", "resolucion_actualizacion": null, "fecha_inicio": "18-03-2024", "fecha_fin": "2029-03-18", "presidente": "LUIS FELIPE BARRIOS CADENA", "localidad": "Suba", "sports": ["Golf", "Natación", "Squash", "Tenis", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-tennis-club-campes-244';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '67614466760110', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTANOS FÃTBOL CLUB  (IDRD-CLUB-club-deportivo-bogotanos-fatbol-club-1985)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogotanos-fatbol-club-1985';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTANOS FÃTBOL CLUB',
      'Presidente: JOSE FLAMINIO PIRANEQUE ESCOBAR. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1985. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3112172417',
      'bogotanos@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogotanos-fatbol-club-1985',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogotanos-fatbol-club-1985', v_school_id, '{"resolucion_rd": "1985", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "JOSE FLAMINIO PIRANEQUE ESCOBAR", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE FLAMINIO PIRANEQUE ESCOBAR. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1985. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112172417', phone),
      email       = COALESCE('bogotanos@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1985", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "JOSE FLAMINIO PIRANEQUE ESCOBAR", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogotanos-fatbol-club-1985';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3112172417', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BRECIA F.C  (IDRD-CLUB-brecia-fc-554)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-brecia-fc-554';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BRECIA F.C',
      'Presidente: WUILMAR RICARDO DAZA SOTELO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 554. Vigente hasta 2026-07-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3118287462',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'brecia-fc-554',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-brecia-fc-554', v_school_id, '{"resolucion_rd": "554", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2021", "fecha_fin": "2026-07-19", "presidente": "WUILMAR RICARDO DAZA SOTELO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WUILMAR RICARDO DAZA SOTELO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 554. Vigente hasta 2026-07-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118287462', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "554", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2021", "fecha_fin": "2026-07-19", "presidente": "WUILMAR RICARDO DAZA SOTELO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-brecia-fc-554';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3118287462', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BUSHIDO  (IDRD-CLUB-bushido-1024)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bushido-1024';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BUSHIDO',
      'Presidente: WILSON MARTINEZ PEÃâA. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1024. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '4001920',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bushido-1024',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bushido-1024', v_school_id, '{"resolucion_rd": "1024", "resolucion_actualizacion": null, "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "WILSON MARTINEZ PEÃâA", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON MARTINEZ PEÃâA. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1024. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4001920', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1024", "resolucion_actualizacion": null, "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "WILSON MARTINEZ PEÃâA", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bushido-1024';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '4001920', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CABOARA FUTBOL CLUB  (IDRD-CLUB-caboara-futbol-club-987)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-caboara-futbol-club-987';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CABOARA FUTBOL CLUB',
      'Presidente: CAMILO ERNESTO GODOY BOADA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 987. Vigente hasta 2027-08-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '312464526',
      'camiloernestogodoy@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'caboara-futbol-club-987',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-caboara-futbol-club-987', v_school_id, '{"resolucion_rd": "987", "resolucion_actualizacion": null, "fecha_inicio": "06-08-2022", "fecha_fin": "2027-08-06", "presidente": "CAMILO ERNESTO GODOY BOADA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ERNESTO GODOY BOADA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 987. Vigente hasta 2027-08-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('312464526', phone),
      email       = COALESCE('camiloernestogodoy@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "987", "resolucion_actualizacion": null, "fecha_inicio": "06-08-2022", "fecha_fin": "2027-08-06", "presidente": "CAMILO ERNESTO GODOY BOADA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-caboara-futbol-club-987';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '312464526', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ASOCIACION DEPORTIVA DEL SUR ORIENTE  (IDRD-CLUB-club-deportivo-asociacion-deportiva-del--031)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-asociacion-deportiva-del--031';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ASOCIACION DEPORTIVA DEL SUR ORIENTE',
      'Presidente: JOSE RAMIRO TORRES TORRES. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 031. Vigente hasta 2029-01-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '2804797',
      'torneojoven2020@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-asociacion-deportiva-del--031',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-asociacion-deportiva-del--031', v_school_id, '{"resolucion_rd": "031", "resolucion_actualizacion": null, "fecha_inicio": "26-01-2024", "fecha_fin": "2029-01-25", "presidente": "JOSE RAMIRO TORRES TORRES", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE RAMIRO TORRES TORRES. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 031. Vigente hasta 2029-01-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2804797', phone),
      email       = COALESCE('torneojoven2020@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "031", "resolucion_actualizacion": null, "fecha_inicio": "26-01-2024", "fecha_fin": "2029-01-25", "presidente": "JOSE RAMIRO TORRES TORRES", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-asociacion-deportiva-del--031';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '2804797', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAMEL SKATE  (IDRD-CLUB-camel-skate-129)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-camel-skate-129';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAMEL SKATE',
      'Presidente: RAFAEL ORLANDO RODRÃÆÃÂÃâÃÂGUEZ FERRO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 129. Vigente hasta 2028-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3002135183',
      'cameskate1@yahoo.es',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'camel-skate-129',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-camel-skate-129', v_school_id, '{"resolucion_rd": "129", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2023", "fecha_fin": "2028-02-21", "presidente": "RAFAEL ORLANDO RODRÃÆÃÂÃâÃÂGUEZ FERRO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAFAEL ORLANDO RODRÃÆÃÂÃâÃÂGUEZ FERRO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 129. Vigente hasta 2028-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002135183', phone),
      email       = COALESCE('cameskate1@yahoo.es', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "129", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2023", "fecha_fin": "2028-02-21", "presidente": "RAFAEL ORLANDO RODRÃÆÃÂÃâÃÂGUEZ FERRO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-camel-skate-129';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3002135183', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAMPESTRE GUAYMARAL  (IDRD-CLUB-campestre-guaymaral-343)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-campestre-guaymaral-343';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAMPESTRE GUAYMARAL',
      'Presidente: HERNÃÂN AGUILAR ÃÂLVAREZ. Deporte(s): Ecuestre, Golf, Natación, Squash, Tenis. Localidad: Suba. Resolución R-D Nº 343. Vigente hasta 2027-04-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3043493504',
      'gerencia@clubguaymaral.com.co',
      ARRAY['Ecuestre','Golf','Natación','Squash','Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'campestre-guaymaral-343',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-campestre-guaymaral-343', v_school_id, '{"resolucion_rd": "343", "resolucion_actualizacion": null, "fecha_inicio": "13-04-2022", "fecha_fin": "2027-04-13", "presidente": "HERNÃÂN AGUILAR ÃÂLVAREZ", "localidad": "Suba", "sports": ["Ecuestre", "Golf", "Natación", "Squash", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HERNÃÂN AGUILAR ÃÂLVAREZ. Deporte(s): Ecuestre, Golf, Natación, Squash, Tenis. Localidad: Suba. Resolución R-D Nº 343. Vigente hasta 2027-04-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043493504', phone),
      email       = COALESCE('gerencia@clubguaymaral.com.co', email),
      sports      = ARRAY['Ecuestre','Golf','Natación','Squash','Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "343", "resolucion_actualizacion": null, "fecha_inicio": "13-04-2022", "fecha_fin": "2027-04-13", "presidente": "HERNÃÂN AGUILAR ÃÂLVAREZ", "localidad": "Suba", "sports": ["Ecuestre", "Golf", "Natación", "Squash", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-campestre-guaymaral-343';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3043493504', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CANOE SPRINT CLUB  (IDRD-CLUB-canoe-sprint-club-1326)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-canoe-sprint-club-1326';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CANOE SPRINT CLUB',
      'Presidente: CAMILO ESTEBAN ESCAMILLA OSPINA,. Deporte(s): Canotaje. Localidad: Teusaquillo. Resolución R-D Nº 1326 / actualización Nº 286. Vigente hasta 2027-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3005995252',
      'canoesprintclub@gmail.com',
      ARRAY['Canotaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'canoe-sprint-club-1326',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-canoe-sprint-club-1326', v_school_id, '{"resolucion_rd": "1326", "resolucion_actualizacion": "286", "fecha_inicio": "28-10-2022", "fecha_fin": "2027-10-28", "presidente": "CAMILO ESTEBAN ESCAMILLA OSPINA,", "localidad": "Teusaquillo", "sports": ["Canotaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ESTEBAN ESCAMILLA OSPINA,. Deporte(s): Canotaje. Localidad: Teusaquillo. Resolución R-D Nº 1326 / actualización Nº 286. Vigente hasta 2027-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005995252', phone),
      email       = COALESCE('canoesprintclub@gmail.com', email),
      sports      = ARRAY['Canotaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1326", "resolucion_actualizacion": "286", "fecha_inicio": "28-10-2022", "fecha_fin": "2027-10-28", "presidente": "CAMILO ESTEBAN ESCAMILLA OSPINA,", "localidad": "Teusaquillo", "sports": ["Canotaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-canoe-sprint-club-1326';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3005995252', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPACIDAD EXTREMA BOSA CAEXBO  (IDRD-CLUB-capacidad-extrema-bosa-caexbo-716)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capacidad-extrema-bosa-caexbo-716';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPACIDAD EXTREMA BOSA CAEXBO',
      'Presidente: MIGUEL ANGEL GONZALEZ BARRETO. Deporte(s): Ajedrez, Baloncesto, Billar, Atletismo, Ciclismo, Esgrima, Natación, Levantamiento De Pesas, Tiro deportivo, Rugby, Tenis de mesa, Tenis, Voleibol, Triatlon, Discapacidad Fã­Sica. Localidad: Bosa. Resolución R-D Nº 716. Vigente hasta 2026-09-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3142436014',
      'nadped@gmai.com',
      ARRAY['Ajedrez','Baloncesto','Billar','Atletismo','Ciclismo','Esgrima','Natación','Levantamiento De Pesas','Tiro deportivo','Rugby','Tenis de mesa','Tenis','Voleibol','Triatlon','Discapacidad Fã­Sica']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capacidad-extrema-bosa-caexbo-716',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capacidad-extrema-bosa-caexbo-716', v_school_id, '{"resolucion_rd": "716", "resolucion_actualizacion": null, "fecha_inicio": "16-09-2021", "fecha_fin": "2026-09-16", "presidente": "MIGUEL ANGEL GONZALEZ BARRETO", "localidad": "Bosa", "sports": ["Ajedrez", "Baloncesto", "Billar", "Atletismo", "Ciclismo", "Esgrima", "Natación", "Levantamiento De Pesas", "Tiro deportivo", "Rugby", "Tenis de mesa", "Tenis", "Voleibol", "Triatlon", "Discapacidad Fã­Sica"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL GONZALEZ BARRETO. Deporte(s): Ajedrez, Baloncesto, Billar, Atletismo, Ciclismo, Esgrima, Natación, Levantamiento De Pesas, Tiro deportivo, Rugby, Tenis de mesa, Tenis, Voleibol, Triatlon, Discapacidad Fã­Sica. Localidad: Bosa. Resolución R-D Nº 716. Vigente hasta 2026-09-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142436014', phone),
      email       = COALESCE('nadped@gmai.com', email),
      sports      = ARRAY['Ajedrez','Baloncesto','Billar','Atletismo','Ciclismo','Esgrima','Natación','Levantamiento De Pesas','Tiro deportivo','Rugby','Tenis de mesa','Tenis','Voleibol','Triatlon','Discapacidad Fã­Sica']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "716", "resolucion_actualizacion": null, "fecha_inicio": "16-09-2021", "fecha_fin": "2026-09-16", "presidente": "MIGUEL ANGEL GONZALEZ BARRETO", "localidad": "Bosa", "sports": ["Ajedrez", "Baloncesto", "Billar", "Atletismo", "Ciclismo", "Esgrima", "Natación", "Levantamiento De Pesas", "Tiro deportivo", "Rugby", "Tenis de mesa", "Tenis", "Voleibol", "Triatlon", "Discapacidad Fã­Sica"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capacidad-extrema-bosa-caexbo-716';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3142436014', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CAPITAL BMX  (IDRD-CLUB-club-deportivo-capital-bmx-464)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-capital-bmx-464';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CAPITAL BMX',
      'Presidente: NIDIA MARCELA ROJAS RUBIANO. Deporte(s): Ciclismo. Localidad: Puente Aranda. Resolución R-D Nº 464 / actualización Nº 1641. Vigente hasta 2027-05-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3112171364',
      'capitalbmx@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-capital-bmx-464',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-capital-bmx-464', v_school_id, '{"resolucion_rd": "464", "resolucion_actualizacion": "1641", "fecha_inicio": "31-05-2022", "fecha_fin": "2027-05-31", "presidente": "NIDIA MARCELA ROJAS RUBIANO", "localidad": "Puente Aranda", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NIDIA MARCELA ROJAS RUBIANO. Deporte(s): Ciclismo. Localidad: Puente Aranda. Resolución R-D Nº 464 / actualización Nº 1641. Vigente hasta 2027-05-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112171364', phone),
      email       = COALESCE('capitalbmx@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "464", "resolucion_actualizacion": "1641", "fecha_inicio": "31-05-2022", "fecha_fin": "2027-05-31", "presidente": "NIDIA MARCELA ROJAS RUBIANO", "localidad": "Puente Aranda", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-capital-bmx-464';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3112171364', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPITALS BOGOTA  (IDRD-CLUB-capitals-bogota-604)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capitals-bogota-604';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPITALS BOGOTA',
      'Presidente: MONICA HAYDEE OSORIO DUSSAN. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 604. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3154950951',
      'presidencia@clubcapitals.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capitals-bogota-604',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capitals-bogota-604', v_school_id, '{"resolucion_rd": "604", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "MONICA HAYDEE OSORIO DUSSAN", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MONICA HAYDEE OSORIO DUSSAN. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 604. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3154950951', phone),
      email       = COALESCE('presidencia@clubcapitals.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "604", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "MONICA HAYDEE OSORIO DUSSAN", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capitals-bogota-604';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3154950951', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOS CARDENALES  (IDRD-CLUB-club-deportivo-los-cardenales-1020)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-cardenales-1020';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOS CARDENALES',
      'Presidente: LUIS ANTONIO PEÃA RAMIREZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1020. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3118270340',
      'deportivocardenales@hotmail.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-los-cardenales-1020',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-los-cardenales-1020', v_school_id, '{"resolucion_rd": "1020", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "LUIS ANTONIO PEÃA RAMIREZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ANTONIO PEÃA RAMIREZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1020. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118270340', phone),
      email       = COALESCE('deportivocardenales@hotmail.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1020", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "LUIS ANTONIO PEÃA RAMIREZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-cardenales-1020';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3118270340', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CARDENALES GOLD  (IDRD-CLUB-cardenales-gold-494)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cardenales-gold-494';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CARDENALES GOLD',
      'Presidente: RICARDO VARGAS ACOSTA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 494. Vigente hasta 2026-07-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '41125393112690241',
      'edfcardenalesgold09@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cardenales-gold-494',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cardenales-gold-494', v_school_id, '{"resolucion_rd": "494", "resolucion_actualizacion": null, "fecha_inicio": "02-07-2021", "fecha_fin": "2026-07-02", "presidente": "RICARDO VARGAS ACOSTA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICARDO VARGAS ACOSTA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 494. Vigente hasta 2026-07-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('41125393112690241', phone),
      email       = COALESCE('edfcardenalesgold09@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "494", "resolucion_actualizacion": null, "fecha_inicio": "02-07-2021", "fecha_fin": "2026-07-02", "presidente": "RICARDO VARGAS ACOSTA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cardenales-gold-494';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '41125393112690241', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DEL CARMEL CLUB CAMPESTRE  (IDRD-CLUB-club-deportivo-del-carmel-club-campestre-1166)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-del-carmel-club-campestre-1166';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DEL CARMEL CLUB CAMPESTRE',
      'Presidente: DAVID ISRAEL DREZNER SALAINSK. Deporte(s): Ajedrez, Bridge, Golf, Natación, Tenis, Tenis de mesa, Baloncesto, Fútbol, Voleibol. Localidad: Suba. Resolución R-D Nº 1166. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '64972723133970913',
      'actividadescarmel@gmail.com',
      ARRAY['Ajedrez','Bridge','Golf','Natación','Tenis','Tenis de mesa','Baloncesto','Fútbol','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-del-carmel-club-campestre-1166',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-del-carmel-club-campestre-1166', v_school_id, '{"resolucion_rd": "1166", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "DAVID ISRAEL DREZNER SALAINSK", "localidad": "Suba", "sports": ["Ajedrez", "Bridge", "Golf", "Natación", "Tenis", "Tenis de mesa", "Baloncesto", "Fútbol", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID ISRAEL DREZNER SALAINSK. Deporte(s): Ajedrez, Bridge, Golf, Natación, Tenis, Tenis de mesa, Baloncesto, Fútbol, Voleibol. Localidad: Suba. Resolución R-D Nº 1166. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('64972723133970913', phone),
      email       = COALESCE('actividadescarmel@gmail.com', email),
      sports      = ARRAY['Ajedrez','Bridge','Golf','Natación','Tenis','Tenis de mesa','Baloncesto','Fútbol','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1166", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "DAVID ISRAEL DREZNER SALAINSK", "localidad": "Suba", "sports": ["Ajedrez", "Bridge", "Golf", "Natación", "Tenis", "Tenis de mesa", "Baloncesto", "Fútbol", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-del-carmel-club-campestre-1166';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '64972723133970913', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CASTORES  (IDRD-CLUB-castores-1051)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-castores-1051';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CASTORES',
      'Presidente: MAYERLY GOMEZ TORRES. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 1051. Vigente hasta 2028-09-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3005685649',
      'faena1@hotmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'castores-1051',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-castores-1051', v_school_id, '{"resolucion_rd": "1051", "resolucion_actualizacion": null, "fecha_inicio": "13-09-2023", "fecha_fin": "2028-09-12", "presidente": "MAYERLY GOMEZ TORRES", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAYERLY GOMEZ TORRES. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 1051. Vigente hasta 2028-09-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005685649', phone),
      email       = COALESCE('faena1@hotmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1051", "resolucion_actualizacion": null, "fecha_inicio": "13-09-2023", "fecha_fin": "2028-09-12", "presidente": "MAYERLY GOMEZ TORRES", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-castores-1051';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3005685649', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CATERPILLAR MOTOR  (IDRD-CLUB-club-deportivo-caterpillar-motor-341)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-caterpillar-motor-341';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CATERPILLAR MOTOR',
      'Presidente: MARIA HELENA CHAPARRO ECHEVERRY. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 341. Vigente hasta 2029-03-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '21203033123040301',
      'talentohumano@clubcaterpillarmotor.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-caterpillar-motor-341',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-caterpillar-motor-341', v_school_id, '{"resolucion_rd": "341", "resolucion_actualizacion": null, "fecha_inicio": "21-03-2024", "fecha_fin": "2029-03-21", "presidente": "MARIA HELENA CHAPARRO ECHEVERRY", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA HELENA CHAPARRO ECHEVERRY. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 341. Vigente hasta 2029-03-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('21203033123040301', phone),
      email       = COALESCE('talentohumano@clubcaterpillarmotor.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "341", "resolucion_actualizacion": null, "fecha_inicio": "21-03-2024", "fecha_fin": "2029-03-21", "presidente": "MARIA HELENA CHAPARRO ECHEVERRY", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-caterpillar-motor-341';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '21203033123040301', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BROTHERS SPORT`S SAS  (IDRD-CLUB-club-deportivo-brothers-sports-sas-1733)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-brothers-sports-sas-1733';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BROTHERS SPORT`S SAS',
      'Presidente: ROBINSON FERNANDO PORTAL BARBOSA. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 1733. Vigente hasta 2031-01-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3023095575',
      'clubrothersports@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-brothers-sports-sas-1733',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-brothers-sports-sas-1733', v_school_id, '{"resolucion_rd": "1733", "resolucion_actualizacion": null, "fecha_inicio": "14-01-2026", "fecha_fin": "2031-01-14", "presidente": "ROBINSON FERNANDO PORTAL BARBOSA", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROBINSON FERNANDO PORTAL BARBOSA. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 1733. Vigente hasta 2031-01-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3023095575', phone),
      email       = COALESCE('clubrothersports@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1733", "resolucion_actualizacion": null, "fecha_inicio": "14-01-2026", "fecha_fin": "2031-01-14", "presidente": "ROBINSON FERNANDO PORTAL BARBOSA", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-brothers-sports-sas-1733';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3023095575', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CEDA S.A.S.  (IDRD-CLUB-ceda-sas-1194)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ceda-sas-1194';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CEDA S.A.S.',
      'Presidente: JUAN CARLOS ÃÂVILA MARTÃÂNEZ. Deporte(s): Natación. Resolución R-D Nº 1194. Vigente hasta 2027-10-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '55116643114567086',
      NULL,
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ceda-sas-1194',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ceda-sas-1194', v_school_id, '{"resolucion_rd": "1194", "resolucion_actualizacion": null, "fecha_inicio": "03-10-2022", "fecha_fin": "2027-10-03", "presidente": "JUAN CARLOS ÃÂVILA MARTÃÂNEZ", "localidad": null, "sports": ["Natación"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS ÃÂVILA MARTÃÂNEZ. Deporte(s): Natación. Resolución R-D Nº 1194. Vigente hasta 2027-10-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('55116643114567086', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1194", "resolucion_actualizacion": null, "fecha_inicio": "03-10-2022", "fecha_fin": "2027-10-03", "presidente": "JUAN CARLOS ÃÂVILA MARTÃÂNEZ", "localidad": null, "sports": ["Natación"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ceda-sas-1194';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CEDRO VOLEIBOL BOGOTANO  (IDRD-CLUB-cedro-voleibol-bogotano-542)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cedro-voleibol-bogotano-542';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CEDRO VOLEIBOL BOGOTANO',
      'Presidente: JOHN FREDY GARCIA CABEZAS. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 542. Vigente hasta 2026-07-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3142827769',
      NULL,
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cedro-voleibol-bogotano-542',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cedro-voleibol-bogotano-542', v_school_id, '{"resolucion_rd": "542", "resolucion_actualizacion": null, "fecha_inicio": "16-07-2021", "fecha_fin": "2026-07-16", "presidente": "JOHN FREDY GARCIA CABEZAS", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN FREDY GARCIA CABEZAS. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 542. Vigente hasta 2026-07-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142827769', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "542", "resolucion_actualizacion": null, "fecha_inicio": "16-07-2021", "fecha_fin": "2026-07-16", "presidente": "JOHN FREDY GARCIA CABEZAS", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cedro-voleibol-bogotano-542';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3142827769', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CENTENARIO  (IDRD-CLUB-club-deportivo-centenario-804)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-centenario-804';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CENTENARIO',
      'Presidente: FRANCISCO UMAÃA SABOGAL. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 804. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3142615840',
      'danimero1@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-centenario-804',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-centenario-804', v_school_id, '{"resolucion_rd": "804", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "FRANCISCO UMAÃA SABOGAL", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FRANCISCO UMAÃA SABOGAL. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 804. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142615840', phone),
      email       = COALESCE('danimero1@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "804", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "FRANCISCO UMAÃA SABOGAL", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-centenario-804';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3142615840', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CENTRO ITALIANO DI BOGOTA  (IDRD-CLUB-club-deportivo-centro-italiano-di-bogota-1447)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-centro-italiano-di-bogota-1447';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CENTRO ITALIANO DI BOGOTA',
      'Presidente: FABIO RICCARDI BRIGHENTI. Deporte(s): Natación, Tenis, Squash. Localidad: Usaquén. Resolución R-D Nº 1447. Vigente hasta 2030-11-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3187447546',
      'deportes@centroitalianodb.com',
      ARRAY['Natación','Tenis','Squash']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-centro-italiano-di-bogota-1447',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-centro-italiano-di-bogota-1447', v_school_id, '{"resolucion_rd": "1447", "resolucion_actualizacion": null, "fecha_inicio": "28-11-2025", "fecha_fin": "2030-11-28", "presidente": "FABIO RICCARDI BRIGHENTI", "localidad": "Usaquén", "sports": ["Natación", "Tenis", "Squash"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIO RICCARDI BRIGHENTI. Deporte(s): Natación, Tenis, Squash. Localidad: Usaquén. Resolución R-D Nº 1447. Vigente hasta 2030-11-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187447546', phone),
      email       = COALESCE('deportes@centroitalianodb.com', email),
      sports      = ARRAY['Natación','Tenis','Squash']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1447", "resolucion_actualizacion": null, "fecha_inicio": "28-11-2025", "fecha_fin": "2030-11-28", "presidente": "FABIO RICCARDI BRIGHENTI", "localidad": "Usaquén", "sports": ["Natación", "Tenis", "Squash"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-centro-italiano-di-bogota-1447';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3187447546', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA FUNDACION CULTURAL TCHYMINIGAGUA  (IDRD-CLUB-de-la-fundacion-cultural-tchyminigagua-545)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-fundacion-cultural-tchyminigagua-545';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA FUNDACION CULTURAL TCHYMINIGAGUA',
      'Presidente: OSCAR JAVIER GARCIA VASQUEZ. Deporte(s): Baloncesto, Fútbol, Fútbol de salón. Localidad: Engativá. Resolución R-D Nº 545. Vigente hasta 2027-05-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3115228681',
      'percusionatomica@hotmail.com',
      ARRAY['Baloncesto','Fútbol','Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-fundacion-cultural-tchyminigagua-545',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-fundacion-cultural-tchyminigagua-545', v_school_id, '{"resolucion_rd": "545", "resolucion_actualizacion": null, "fecha_inicio": "31-05-2022", "fecha_fin": "2027-05-31", "presidente": "OSCAR JAVIER GARCIA VASQUEZ", "localidad": "Engativá", "sports": ["Baloncesto", "Fútbol", "Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR JAVIER GARCIA VASQUEZ. Deporte(s): Baloncesto, Fútbol, Fútbol de salón. Localidad: Engativá. Resolución R-D Nº 545. Vigente hasta 2027-05-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115228681', phone),
      email       = COALESCE('percusionatomica@hotmail.com', email),
      sports      = ARRAY['Baloncesto','Fútbol','Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "545", "resolucion_actualizacion": null, "fecha_inicio": "31-05-2022", "fecha_fin": "2027-05-31", "presidente": "OSCAR JAVIER GARCIA VASQUEZ", "localidad": "Engativá", "sports": ["Baloncesto", "Fútbol", "Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-fundacion-cultural-tchyminigagua-545';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3115228681', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE KARATE - DO CHRYSLER COLMOTORES  (IDRD-CLUB-de-karate---do-chrysler-colmotores-347)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-karate---do-chrysler-colmotores-347';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE KARATE - DO CHRYSLER COLMOTORES',
      'Presidente: SERGIO IVAN VANEGAS SANCHEZ. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 347. Vigente hasta 2027-04-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3102483028',
      'vanalza1@hotmail.com',
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-karate---do-chrysler-colmotores-347',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-karate---do-chrysler-colmotores-347', v_school_id, '{"resolucion_rd": "347", "resolucion_actualizacion": null, "fecha_inicio": "18-04-2022", "fecha_fin": "2027-04-18", "presidente": "SERGIO IVAN VANEGAS SANCHEZ", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SERGIO IVAN VANEGAS SANCHEZ. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 347. Vigente hasta 2027-04-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102483028', phone),
      email       = COALESCE('vanalza1@hotmail.com', email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "347", "resolucion_actualizacion": null, "fecha_inicio": "18-04-2022", "fecha_fin": "2027-04-18", "presidente": "SERGIO IVAN VANEGAS SANCHEZ", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-karate---do-chrysler-colmotores-347';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3102483028', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA JUVE  (IDRD-CLUB-club-deportivo-la-juve-1078)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-juve-1078';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA JUVE',
      'Presidente: LICED ANGELICA MOYANO SALINAS. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1078. Vigente hasta 2030-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3212346199',
      'juventusbogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-juve-1078',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-juve-1078', v_school_id, '{"resolucion_rd": "1078", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2025", "fecha_fin": "2030-10-07", "presidente": "LICED ANGELICA MOYANO SALINAS", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LICED ANGELICA MOYANO SALINAS. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1078. Vigente hasta 2030-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212346199', phone),
      email       = COALESCE('juventusbogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1078", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2025", "fecha_fin": "2030-10-07", "presidente": "LICED ANGELICA MOYANO SALINAS", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-juve-1078';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3212346199', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO CISSCA  (IDRD-CLUB-club-deportivo-de-taekwondo-cissca-299)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-cissca-299';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO CISSCA',
      'Presidente: RICARDO ADOLFO ALVAREZ GACHARNA. Deporte(s): Taekwondo. Localidad: Antonio Nariño. Resolución R-D Nº 299. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3106992017',
      'abo.ricardoalvarez@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-cissca-299',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-cissca-299', v_school_id, '{"resolucion_rd": "299", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "RICARDO ADOLFO ALVAREZ GACHARNA", "localidad": "Antonio Nariño", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICARDO ADOLFO ALVAREZ GACHARNA. Deporte(s): Taekwondo. Localidad: Antonio Nariño. Resolución R-D Nº 299. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106992017', phone),
      email       = COALESCE('abo.ricardoalvarez@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "299", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "RICARDO ADOLFO ALVAREZ GACHARNA", "localidad": "Antonio Nariño", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-cissca-299';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3106992017', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CIUDADELA COLSUBSIDIO - ESFODECOL  (IDRD-CLUB-club-deportivo-ciudadela-colsubsidio---e-1689)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ciudadela-colsubsidio---e-1689';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CIUDADELA COLSUBSIDIO - ESFODECOL',
      'Presidente: WILLIAM RICARDO ESPINOSA NIÃO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1689. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3168243776',
      'esfodecolfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ciudadela-colsubsidio---e-1689',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ciudadela-colsubsidio---e-1689', v_school_id, '{"resolucion_rd": "1689", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "WILLIAM RICARDO ESPINOSA NIÃO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM RICARDO ESPINOSA NIÃO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1689. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3168243776', phone),
      email       = COALESCE('esfodecolfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1689", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "WILLIAM RICARDO ESPINOSA NIÃO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ciudadela-colsubsidio---e-1689';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3168243776', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CM ASTERI  (IDRD-CLUB-cm-asteri-346)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cm-asteri-346';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CM ASTERI',
      'Presidente: LUIS FELIPE INFANTE VARGAS. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 346 / actualización Nº 890. Vigente hasta 2027-04-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '20222100021842',
      'info@cmasteri.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cm-asteri-346',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cm-asteri-346', v_school_id, '{"resolucion_rd": "346", "resolucion_actualizacion": "890", "fecha_inicio": "18-04-2022", "fecha_fin": "2027-04-18", "presidente": "LUIS FELIPE INFANTE VARGAS", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS FELIPE INFANTE VARGAS. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 346 / actualización Nº 890. Vigente hasta 2027-04-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('20222100021842', phone),
      email       = COALESCE('info@cmasteri.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "346", "resolucion_actualizacion": "890", "fecha_inicio": "18-04-2022", "fecha_fin": "2027-04-18", "presidente": "LUIS FELIPE INFANTE VARGAS", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cm-asteri-346';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '20222100021842', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COBOS D.C.  (IDRD-CLUB-cobos-dc-006)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cobos-dc-006';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COBOS D.C.',
      'Presidente: DIANA MARCELA ORGANISTA ORTIZ,. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 006 / actualización Nº 819. Vigente hasta 2028-01-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '26462983043375099',
      'luceroortiz2000@yahoo.es',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cobos-dc-006',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cobos-dc-006', v_school_id, '{"resolucion_rd": "006", "resolucion_actualizacion": "819", "fecha_inicio": "23-01-2023", "fecha_fin": "2028-01-23", "presidente": "DIANA MARCELA ORGANISTA ORTIZ,", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA MARCELA ORGANISTA ORTIZ,. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 006 / actualización Nº 819. Vigente hasta 2028-01-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('26462983043375099', phone),
      email       = COALESCE('luceroortiz2000@yahoo.es', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "006", "resolucion_actualizacion": "819", "fecha_inicio": "23-01-2023", "fecha_fin": "2028-01-23", "presidente": "DIANA MARCELA ORGANISTA ORTIZ,", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cobos-dc-006';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '26462983043375099', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COCODRILOS BASKETBALL CLUB  (IDRD-CLUB-cocodrilos-basketball-club-1492)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cocodrilos-basketball-club-1492';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COCODRILOS BASKETBALL CLUB',
      'Presidente: JOSE LUIS SARMIENTO ALVAREZ. Deporte(s): Baloncesto. Localidad: Teusaquillo. Resolución R-D Nº 1492. Vigente hasta 2027-11-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3508920148',
      'cocodrilos.basketball@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cocodrilos-basketball-club-1492',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cocodrilos-basketball-club-1492', v_school_id, '{"resolucion_rd": "1492", "resolucion_actualizacion": null, "fecha_inicio": "23-11-2022", "fecha_fin": "2027-11-23", "presidente": "JOSE LUIS SARMIENTO ALVAREZ", "localidad": "Teusaquillo", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS SARMIENTO ALVAREZ. Deporte(s): Baloncesto. Localidad: Teusaquillo. Resolución R-D Nº 1492. Vigente hasta 2027-11-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3508920148', phone),
      email       = COALESCE('cocodrilos.basketball@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1492", "resolucion_actualizacion": null, "fecha_inicio": "23-11-2022", "fecha_fin": "2027-11-23", "presidente": "JOSE LUIS SARMIENTO ALVAREZ", "localidad": "Teusaquillo", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cocodrilos-basketball-club-1492';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3508920148', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO COMPENSAR  (IDRD-CLUB-club-deportivo-compensar-407)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-compensar-407';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO COMPENSAR',
      'Presidente: OSCAR MARIO RUIZ CRUZ. Deporte(s): Tenis, Natación, Fútbol, Atletismo Intelectual, Futbol Sala Intelectual, Padel, Esgrima, Patinaje, Baloncesto, Voleibol, Tenis de mesa, Karate, Squash, Bowling, Natacion Intelectual, Taekwondo, Ajedrez. Localidad: Engativá. Resolución R-D Nº 407 / actualización Nº 1737. Vigente hasta 2027-06-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '4280666',
      'jemunozv@compensar.com',
      ARRAY['Tenis','Natación','Fútbol','Atletismo Intelectual','Futbol Sala Intelectual','Padel','Esgrima','Patinaje','Baloncesto','Voleibol','Tenis de mesa','Karate','Squash','Bowling','Natacion Intelectual','Taekwondo','Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-compensar-407',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-compensar-407', v_school_id, '{"resolucion_rd": "407", "resolucion_actualizacion": "1737", "fecha_inicio": "01-06-2022", "fecha_fin": "2027-06-01", "presidente": "OSCAR MARIO RUIZ CRUZ", "localidad": "Engativá", "sports": ["Tenis", "Natación", "Fútbol", "Atletismo Intelectual", "Futbol Sala Intelectual", "Padel", "Esgrima", "Patinaje", "Baloncesto", "Voleibol", "Tenis de mesa", "Karate", "Squash", "Bowling", "Natacion Intelectual", "Taekwondo", "Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR MARIO RUIZ CRUZ. Deporte(s): Tenis, Natación, Fútbol, Atletismo Intelectual, Futbol Sala Intelectual, Padel, Esgrima, Patinaje, Baloncesto, Voleibol, Tenis de mesa, Karate, Squash, Bowling, Natacion Intelectual, Taekwondo, Ajedrez. Localidad: Engativá. Resolución R-D Nº 407 / actualización Nº 1737. Vigente hasta 2027-06-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4280666', phone),
      email       = COALESCE('jemunozv@compensar.com', email),
      sports      = ARRAY['Tenis','Natación','Fútbol','Atletismo Intelectual','Futbol Sala Intelectual','Padel','Esgrima','Patinaje','Baloncesto','Voleibol','Tenis de mesa','Karate','Squash','Bowling','Natacion Intelectual','Taekwondo','Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "407", "resolucion_actualizacion": "1737", "fecha_inicio": "01-06-2022", "fecha_fin": "2027-06-01", "presidente": "OSCAR MARIO RUIZ CRUZ", "localidad": "Engativá", "sports": ["Tenis", "Natación", "Fútbol", "Atletismo Intelectual", "Futbol Sala Intelectual", "Padel", "Esgrima", "Patinaje", "Baloncesto", "Voleibol", "Tenis de mesa", "Karate", "Squash", "Bowling", "Natacion Intelectual", "Taekwondo", "Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-compensar-407';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '4280666', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COMUNIDAD EL OSO  (IDRD-CLUB-comunidad-el-oso-669)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-comunidad-el-oso-669';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COMUNIDAD EL OSO',
      'Presidente: HERNÃÂN RICARDO MARTÃÂN MARTÃÂN. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 669. Vigente hasta 2027-06-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3222897653',
      'ultimatecomunidadeloso@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'comunidad-el-oso-669',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-comunidad-el-oso-669', v_school_id, '{"resolucion_rd": "669", "resolucion_actualizacion": null, "fecha_inicio": "22-06-2022", "fecha_fin": "2027-06-22", "presidente": "HERNÃÂN RICARDO MARTÃÂN MARTÃÂN", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HERNÃÂN RICARDO MARTÃÂN MARTÃÂN. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 669. Vigente hasta 2027-06-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222897653', phone),
      email       = COALESCE('ultimatecomunidadeloso@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "669", "resolucion_actualizacion": null, "fecha_inicio": "22-06-2022", "fecha_fin": "2027-06-22", "presidente": "HERNÃÂN RICARDO MARTÃÂN MARTÃÂN", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-comunidad-el-oso-669';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3222897653', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COPESPORT  (IDRD-CLUB-copesport-677)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-copesport-677';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COPESPORT',
      'Presidente: CLAUDIA PATRICIA ORTIZ RODRIGUEZ. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 677. Vigente hasta 2026-09-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3554204',
      'claupaortiz27@icloud.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'copesport-677',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-copesport-677', v_school_id, '{"resolucion_rd": "677", "resolucion_actualizacion": null, "fecha_inicio": "02-09-2021", "fecha_fin": "2026-09-02", "presidente": "CLAUDIA PATRICIA ORTIZ RODRIGUEZ", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA PATRICIA ORTIZ RODRIGUEZ. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 677. Vigente hasta 2026-09-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3554204', phone),
      email       = COALESCE('claupaortiz27@icloud.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "677", "resolucion_actualizacion": null, "fecha_inicio": "02-09-2021", "fecha_fin": "2026-09-02", "presidente": "CLAUDIA PATRICIA ORTIZ RODRIGUEZ", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-copesport-677';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3554204', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CORPORACION CLUB DE TENIS EL CAMPIN  (IDRD-CLUB-corporacion-club-de-tenis-el-campin-1208)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-corporacion-club-de-tenis-el-campin-1208';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CORPORACION CLUB DE TENIS EL CAMPIN',
      'Presidente: FERNANDO ROZO HERRERA. Deporte(s): Tenis. Localidad: Teusaquillo. Resolución R-D Nº 1208. Vigente hasta 2026-12-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '21212662121400',
      'ctc.admon@etb.net.co',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'corporacion-club-de-tenis-el-campin-1208',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-corporacion-club-de-tenis-el-campin-1208', v_school_id, '{"resolucion_rd": "1208", "resolucion_actualizacion": null, "fecha_inicio": "30-12-2021", "fecha_fin": "2026-12-30", "presidente": "FERNANDO ROZO HERRERA", "localidad": "Teusaquillo", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FERNANDO ROZO HERRERA. Deporte(s): Tenis. Localidad: Teusaquillo. Resolución R-D Nº 1208. Vigente hasta 2026-12-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('21212662121400', phone),
      email       = COALESCE('ctc.admon@etb.net.co', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1208", "resolucion_actualizacion": null, "fecha_inicio": "30-12-2021", "fecha_fin": "2026-12-30", "presidente": "FERNANDO ROZO HERRERA", "localidad": "Teusaquillo", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-corporacion-club-de-tenis-el-campin-1208';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '21212662121400', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CORPORACIÃN EL DORADO  (IDRD-CLUB-club-deportivo-corporacian-el-dorado-873)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-corporacian-el-dorado-873';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CORPORACIÃN EL DORADO',
      'Presidente: JAVIER ALEJANDRO PEREZ ROJAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 873. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3115619113',
      'corpo.eldorado@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-corporacian-el-dorado-873',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-corporacian-el-dorado-873', v_school_id, '{"resolucion_rd": "873", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "JAVIER ALEJANDRO PEREZ ROJAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAVIER ALEJANDRO PEREZ ROJAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 873. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115619113', phone),
      email       = COALESCE('corpo.eldorado@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "873", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "JAVIER ALEJANDRO PEREZ ROJAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-corporacian-el-dorado-873';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3115619113', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CORPORACIÃN ESCUELA ECUESTRE BACATÃ  (IDRD-CLUB-club-deportivo-corporacian-escuela-ecues-259)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-corporacian-escuela-ecues-259';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CORPORACIÃN ESCUELA ECUESTRE BACATÃ',
      'Presidente: YULI MARCELA RIVEROS SOLER. Deporte(s): Ecuestre. Localidad: Suba. Resolución R-D Nº 259 / actualización Nº 1739. Vigente hasta 2027-04-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3112738490',
      'administracion@bacata.org',
      ARRAY['Ecuestre']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-corporacian-escuela-ecues-259',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-corporacian-escuela-ecues-259', v_school_id, '{"resolucion_rd": "259", "resolucion_actualizacion": "1739", "fecha_inicio": "05-04-2022", "fecha_fin": "2027-04-05", "presidente": "YULI MARCELA RIVEROS SOLER", "localidad": "Suba", "sports": ["Ecuestre"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YULI MARCELA RIVEROS SOLER. Deporte(s): Ecuestre. Localidad: Suba. Resolución R-D Nº 259 / actualización Nº 1739. Vigente hasta 2027-04-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112738490', phone),
      email       = COALESCE('administracion@bacata.org', email),
      sports      = ARRAY['Ecuestre']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "259", "resolucion_actualizacion": "1739", "fecha_inicio": "05-04-2022", "fecha_fin": "2027-04-05", "presidente": "YULI MARCELA RIVEROS SOLER", "localidad": "Suba", "sports": ["Ecuestre"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-corporacian-escuela-ecues-259';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3112738490', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CORTAPALOS BOLO CLUB  (IDRD-CLUB-cortapalos-bolo-club-332)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cortapalos-bolo-club-332';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CORTAPALOS BOLO CLUB',
      'Presidente: MARIA PATRICIA CANDAMIL PINZON. Deporte(s): Bowling. Localidad: Engativá. Resolución R-D Nº 332 / actualización Nº 727. Vigente hasta 2028-04-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3102020128',
      NULL,
      ARRAY['Bowling']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cortapalos-bolo-club-332',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cortapalos-bolo-club-332', v_school_id, '{"resolucion_rd": "332", "resolucion_actualizacion": "727", "fecha_inicio": "17-04-2023", "fecha_fin": "2028-04-16", "presidente": "MARIA PATRICIA CANDAMIL PINZON", "localidad": "Engativá", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA PATRICIA CANDAMIL PINZON. Deporte(s): Bowling. Localidad: Engativá. Resolución R-D Nº 332 / actualización Nº 727. Vigente hasta 2028-04-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102020128', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Bowling']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "332", "resolucion_actualizacion": "727", "fecha_inicio": "17-04-2023", "fecha_fin": "2028-04-16", "presidente": "MARIA PATRICIA CANDAMIL PINZON", "localidad": "Engativá", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cortapalos-bolo-club-332';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3102020128', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COUNTRY CLUB DE BOGOTA  (IDRD-CLUB-country-club-de-bogota-874)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-country-club-de-bogota-874';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COUNTRY CLUB DE BOGOTA',
      'Presidente: CARLOS GUILLERMO CABRERA FALLA. Deporte(s): Bridge, Ecuestre, Fútbol, Golf, Natación, Squash, Tenis. Localidad: Usaquén. Resolución R-D Nº 874. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '6582700',
      'deportes@countryclubbogota.com',
      ARRAY['Bridge','Ecuestre','Fútbol','Golf','Natación','Squash','Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'country-club-de-bogota-874',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-country-club-de-bogota-874', v_school_id, '{"resolucion_rd": "874", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "CARLOS GUILLERMO CABRERA FALLA", "localidad": "Usaquén", "sports": ["Bridge", "Ecuestre", "Fútbol", "Golf", "Natación", "Squash", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS GUILLERMO CABRERA FALLA. Deporte(s): Bridge, Ecuestre, Fútbol, Golf, Natación, Squash, Tenis. Localidad: Usaquén. Resolución R-D Nº 874. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6582700', phone),
      email       = COALESCE('deportes@countryclubbogota.com', email),
      sports      = ARRAY['Bridge','Ecuestre','Fútbol','Golf','Natación','Squash','Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "874", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "CARLOS GUILLERMO CABRERA FALLA", "localidad": "Usaquén", "sports": ["Bridge", "Ecuestre", "Fútbol", "Golf", "Natación", "Squash", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-country-club-de-bogota-874';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '6582700', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COYOTES RUGBY CLUB BOGOTA  (IDRD-CLUB-coyotes-rugby-club-bogota-971)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-coyotes-rugby-club-bogota-971';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COYOTES RUGBY CLUB BOGOTA',
      'Presidente: EDUARDO FELIPE ZAMUDIO PERILLA. Deporte(s): Rugby. Localidad: Teusaquillo. Resolución R-D Nº 971. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '4739055',
      'duvanbarrera@gmail.com',
      ARRAY['Rugby']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'coyotes-rugby-club-bogota-971',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-coyotes-rugby-club-bogota-971', v_school_id, '{"resolucion_rd": "971", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "EDUARDO FELIPE ZAMUDIO PERILLA", "localidad": "Teusaquillo", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDUARDO FELIPE ZAMUDIO PERILLA. Deporte(s): Rugby. Localidad: Teusaquillo. Resolución R-D Nº 971. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4739055', phone),
      email       = COALESCE('duvanbarrera@gmail.com', email),
      sports      = ARRAY['Rugby']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "971", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "EDUARDO FELIPE ZAMUDIO PERILLA", "localidad": "Teusaquillo", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-coyotes-rugby-club-bogota-971';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '4739055', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CREATING WORLD CHAMPIONS BMX  (IDRD-CLUB-creating-world-champions-bmx-797)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-creating-world-champions-bmx-797';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CREATING WORLD CHAMPIONS BMX',
      'Presidente: RICHARD NILSO MONTERROSA ROMERO. Deporte(s): Ciclismo. Localidad: Suba. Resolución R-D Nº 797. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3193206332',
      NULL,
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'creating-world-champions-bmx-797',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-creating-world-champions-bmx-797', v_school_id, '{"resolucion_rd": "797", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "RICHARD NILSO MONTERROSA ROMERO", "localidad": "Suba", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICHARD NILSO MONTERROSA ROMERO. Deporte(s): Ciclismo. Localidad: Suba. Resolución R-D Nº 797. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193206332', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "797", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "RICHARD NILSO MONTERROSA ROMERO", "localidad": "Suba", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-creating-world-champions-bmx-797';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3193206332', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CURRAMBA FC  (IDRD-CLUB-curramba-fc-1103)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-curramba-fc-1103';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CURRAMBA FC',
      'Presidente: ANDREA VIVIANA PALACIO BEJARANO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1103 / actualización Nº 241. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3102048809',
      'currambafutbolclub@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'curramba-fc-1103',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-curramba-fc-1103', v_school_id, '{"resolucion_rd": "1103", "resolucion_actualizacion": "241", "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "ANDREA VIVIANA PALACIO BEJARANO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDREA VIVIANA PALACIO BEJARANO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1103 / actualización Nº 241. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102048809', phone),
      email       = COALESCE('currambafutbolclub@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1103", "resolucion_actualizacion": "241", "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "ANDREA VIVIANA PALACIO BEJARANO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-curramba-fc-1103';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3102048809', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DANE DE KARATE DO  (IDRD-CLUB-dane-de-karate-do-1336)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dane-de-karate-do-1336';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DANE DE KARATE DO',
      'Presidente: NELSON JAVIER UMBARILA BENAVIDES. Deporte(s): Karate. Localidad: Barrios Unidos. Resolución R-D Nº 1336. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3125823889',
      'clubdanekaretedo@gmail.com',
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dane-de-karate-do-1336',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dane-de-karate-do-1336', v_school_id, '{"resolucion_rd": "1336", "resolucion_actualizacion": null, "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "NELSON JAVIER UMBARILA BENAVIDES", "localidad": "Barrios Unidos", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NELSON JAVIER UMBARILA BENAVIDES. Deporte(s): Karate. Localidad: Barrios Unidos. Resolución R-D Nº 1336. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125823889', phone),
      email       = COALESCE('clubdanekaretedo@gmail.com', email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1336", "resolucion_actualizacion": null, "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "NELSON JAVIER UMBARILA BENAVIDES", "localidad": "Barrios Unidos", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dane-de-karate-do-1336';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3125823889', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DANZA Y SON BAILE DEPORTIVO  (IDRD-CLUB-danza-y-son-baile-deportivo-817)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-danza-y-son-baile-deportivo-817';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DANZA Y SON BAILE DEPORTIVO',
      'Presidente: FRANCY JOHANA GUTIERREZ BARRERA. Deporte(s): Baile Deportivo. Localidad: Suba. Resolución R-D Nº 817. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3103106164',
      NULL,
      ARRAY['Baile Deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'danza-y-son-baile-deportivo-817',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-danza-y-son-baile-deportivo-817', v_school_id, '{"resolucion_rd": "817", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "FRANCY JOHANA GUTIERREZ BARRERA", "localidad": "Suba", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FRANCY JOHANA GUTIERREZ BARRERA. Deporte(s): Baile Deportivo. Localidad: Suba. Resolución R-D Nº 817. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103106164', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Baile Deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "817", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "FRANCY JOHANA GUTIERREZ BARRERA", "localidad": "Suba", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-danza-y-son-baile-deportivo-817';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3103106164', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE CLAVADOS Y NATACION REAL CAPITAL  (IDRD-CLUB-club-deportivo-de-clavados-y-natacion-re-1107)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-clavados-y-natacion-re-1107';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE CLAVADOS Y NATACION REAL CAPITAL',
      'Presidente: ALBA ELIZABETH GONZALEZ BARRETO. Deporte(s): Natación. Localidad: Puente Aranda. Resolución R-D Nº 1107 / actualización Nº 686. Vigente hasta 2026-12-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3017764369',
      'clubdeportivorealcapital@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-clavados-y-natacion-re-1107',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-clavados-y-natacion-re-1107', v_school_id, '{"resolucion_rd": "1107", "resolucion_actualizacion": "686", "fecha_inicio": "30-12-2021", "fecha_fin": "2026-12-30", "presidente": "ALBA ELIZABETH GONZALEZ BARRETO", "localidad": "Puente Aranda", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALBA ELIZABETH GONZALEZ BARRETO. Deporte(s): Natación. Localidad: Puente Aranda. Resolución R-D Nº 1107 / actualización Nº 686. Vigente hasta 2026-12-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017764369', phone),
      email       = COALESCE('clubdeportivorealcapital@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1107", "resolucion_actualizacion": "686", "fecha_inicio": "30-12-2021", "fecha_fin": "2026-12-30", "presidente": "ALBA ELIZABETH GONZALEZ BARRETO", "localidad": "Puente Aranda", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-clavados-y-natacion-re-1107';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3017764369', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE ESGRIMA EL DORADO  (IDRD-CLUB-club-deportivo-de-esgrima-el-dorado-1617)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-esgrima-el-dorado-1617';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE ESGRIMA EL DORADO',
      'Presidente: MICHAEL STEVEN AGUDELO RINCÃN. Deporte(s): Esgrima. Localidad: Usaquén. Resolución R-D Nº 1617. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3244417929',
      'esgrimaeldorado@gmail.com',
      ARRAY['Esgrima']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-esgrima-el-dorado-1617',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-esgrima-el-dorado-1617', v_school_id, '{"resolucion_rd": "1617", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "MICHAEL STEVEN AGUDELO RINCÃN", "localidad": "Usaquén", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MICHAEL STEVEN AGUDELO RINCÃN. Deporte(s): Esgrima. Localidad: Usaquén. Resolución R-D Nº 1617. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3244417929', phone),
      email       = COALESCE('esgrimaeldorado@gmail.com', email),
      sports      = ARRAY['Esgrima']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1617", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "MICHAEL STEVEN AGUDELO RINCÃN", "localidad": "Usaquén", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-esgrima-el-dorado-1617';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3244417929', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE KARATE DO DEL CENTRO DE DESARROLLO COMUNITARIO LA VI  (IDRD-CLUB-club-deportivo-de-karate-do-del-centro-d-153)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-karate-do-del-centro-d-153';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE KARATE DO DEL CENTRO DE DESARROLLO COMUNITARIO LA VI',
      'Presidente: MIGUEL ANTONIO CORTES. Deporte(s): Karate. Localidad: Kennedy. Resolución R-D Nº 153. Vigente hasta 2028-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3223723757',
      'miguelsensei@yahoo.com',
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-karate-do-del-centro-d-153',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-karate-do-del-centro-d-153', v_school_id, '{"resolucion_rd": "153", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2023", "fecha_fin": "2028-02-27", "presidente": "MIGUEL ANTONIO CORTES", "localidad": "Kennedy", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANTONIO CORTES. Deporte(s): Karate. Localidad: Kennedy. Resolución R-D Nº 153. Vigente hasta 2028-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3223723757', phone),
      email       = COALESCE('miguelsensei@yahoo.com', email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "153", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2023", "fecha_fin": "2028-02-27", "presidente": "MIGUEL ANTONIO CORTES", "localidad": "Kennedy", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-karate-do-del-centro-d-153';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3223723757', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE KARATE DO JORGE ABRAHAM  (IDRD-CLUB-de-karate-do-jorge-abraham-124)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-karate-do-jorge-abraham-124';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE KARATE DO JORGE ABRAHAM',
      'Presidente: NIDYA ALEXANDRA MUÃâOZ MUÃâOZ. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 124 / actualización Nº 407. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '4937745',
      NULL,
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-karate-do-jorge-abraham-124',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-karate-do-jorge-abraham-124', v_school_id, '{"resolucion_rd": "124", "resolucion_actualizacion": "407", "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "NIDYA ALEXANDRA MUÃâOZ MUÃâOZ", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NIDYA ALEXANDRA MUÃâOZ MUÃâOZ. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 124 / actualización Nº 407. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4937745', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "124", "resolucion_actualizacion": "407", "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "NIDYA ALEXANDRA MUÃâOZ MUÃâOZ", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-karate-do-jorge-abraham-124';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '4937745', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA COOPERATIVA DEL MAGISTERIO CODEMA  (IDRD-CLUB-de-la-cooperativa-del-magisterio-codema-1023)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-cooperativa-del-magisterio-codema-1023';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA COOPERATIVA DEL MAGISTERIO CODEMA',
      'Presidente: MANUEL GERMAN MARTINEZ MARTINEZ,. Deporte(s): Baloncesto, Fútbol, Tejo, Atletismo, Bowling, Ciclismo, Billar, Ajedrez, Fútbol de salón, Tenis de mesa, Softbol, Voleibol. Localidad: Teusaquillo. Resolución R-D Nº 1023 / actualización Nº 1129. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3237505',
      'clubdeportivo@codema.coop',
      ARRAY['Baloncesto','Fútbol','Tejo','Atletismo','Bowling','Ciclismo','Billar','Ajedrez','Fútbol de salón','Tenis de mesa','Softbol','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-cooperativa-del-magisterio-codema-1023',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-cooperativa-del-magisterio-codema-1023', v_school_id, '{"resolucion_rd": "1023", "resolucion_actualizacion": "1129", "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "MANUEL GERMAN MARTINEZ MARTINEZ,", "localidad": "Teusaquillo", "sports": ["Baloncesto", "Fútbol", "Tejo", "Atletismo", "Bowling", "Ciclismo", "Billar", "Ajedrez", "Fútbol de salón", "Tenis de mesa", "Softbol", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL GERMAN MARTINEZ MARTINEZ,. Deporte(s): Baloncesto, Fútbol, Tejo, Atletismo, Bowling, Ciclismo, Billar, Ajedrez, Fútbol de salón, Tenis de mesa, Softbol, Voleibol. Localidad: Teusaquillo. Resolución R-D Nº 1023 / actualización Nº 1129. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3237505', phone),
      email       = COALESCE('clubdeportivo@codema.coop', email),
      sports      = ARRAY['Baloncesto','Fútbol','Tejo','Atletismo','Bowling','Ciclismo','Billar','Ajedrez','Fútbol de salón','Tenis de mesa','Softbol','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1023", "resolucion_actualizacion": "1129", "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "MANUEL GERMAN MARTINEZ MARTINEZ,", "localidad": "Teusaquillo", "sports": ["Baloncesto", "Fútbol", "Tejo", "Atletismo", "Bowling", "Ciclismo", "Billar", "Ajedrez", "Fútbol de salón", "Tenis de mesa", "Softbol", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-cooperativa-del-magisterio-codema-1023';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3237505', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO âTUCIDIDES PEREA ROSEROâ  (IDRD-CLUB-club-deportivo-atucidides-perea-roseroa-1279)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atucidides-perea-roseroa-1279';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO âTUCIDIDES PEREA ROSEROâ',
      'Presidente: RICARDO LEONARDO PEREA RODRIGUEZ. Deporte(s): Fútbol, Baloncesto, Voleibol, Tejo. Localidad: Suba. Resolución R-D Nº 1279. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3114957226',
      'escueladefutbolcorpoafro@gmail.com',
      ARRAY['Fútbol','Baloncesto','Voleibol','Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atucidides-perea-roseroa-1279',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atucidides-perea-roseroa-1279', v_school_id, '{"resolucion_rd": "1279", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "RICARDO LEONARDO PEREA RODRIGUEZ", "localidad": "Suba", "sports": ["Fútbol", "Baloncesto", "Voleibol", "Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICARDO LEONARDO PEREA RODRIGUEZ. Deporte(s): Fútbol, Baloncesto, Voleibol, Tejo. Localidad: Suba. Resolución R-D Nº 1279. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114957226', phone),
      email       = COALESCE('escueladefutbolcorpoafro@gmail.com', email),
      sports      = ARRAY['Fútbol','Baloncesto','Voleibol','Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1279", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "RICARDO LEONARDO PEREA RODRIGUEZ", "localidad": "Suba", "sports": ["Fútbol", "Baloncesto", "Voleibol", "Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atucidides-perea-roseroa-1279';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3114957226', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO Y RECREATIVO DE LA FUNDACION CALBERG  (IDRD-CLUB-club-deportivo-y-recreativo-de-la-fundac-1100)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-y-recreativo-de-la-fundac-1100';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO Y RECREATIVO DE LA FUNDACION CALBERG',
      'Presidente: MARIA INES CAVIEDES ROLDAN. Deporte(s): Discapacidad Cognitiva, Fútbol, Atletismo, Ciclismo, Natación. Localidad: Teusaquillo. Resolución R-D Nº 1100. Vigente hasta 2026-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '2553528',
      'fundacioncalbarg@hotmail.com',
      ARRAY['Discapacidad Cognitiva','Fútbol','Atletismo','Ciclismo','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-y-recreativo-de-la-fundac-1100',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-y-recreativo-de-la-fundac-1100', v_school_id, '{"resolucion_rd": "1100", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2021", "fecha_fin": "2026-12-13", "presidente": "MARIA INES CAVIEDES ROLDAN", "localidad": "Teusaquillo", "sports": ["Discapacidad Cognitiva", "Fútbol", "Atletismo", "Ciclismo", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA INES CAVIEDES ROLDAN. Deporte(s): Discapacidad Cognitiva, Fútbol, Atletismo, Ciclismo, Natación. Localidad: Teusaquillo. Resolución R-D Nº 1100. Vigente hasta 2026-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2553528', phone),
      email       = COALESCE('fundacioncalbarg@hotmail.com', email),
      sports      = ARRAY['Discapacidad Cognitiva','Fútbol','Atletismo','Ciclismo','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1100", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2021", "fecha_fin": "2026-12-13", "presidente": "MARIA INES CAVIEDES ROLDAN", "localidad": "Teusaquillo", "sports": ["Discapacidad Cognitiva", "Fútbol", "Atletismo", "Ciclismo", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-y-recreativo-de-la-fundac-1100';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '2553528', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA FUNDACION OSSAN CLUB  (IDRD-CLUB-de-la-fundacion-ossan-club-382)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-fundacion-ossan-club-382';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA FUNDACION OSSAN CLUB',
      'Presidente: OSCAR SANABRIA SUAREZ. Deporte(s): Atletismo. Localidad: Suba. Resolución R-D Nº 382. Vigente hasta 2028-04-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3784749319',
      NULL,
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-fundacion-ossan-club-382',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-fundacion-ossan-club-382', v_school_id, '{"resolucion_rd": "382", "resolucion_actualizacion": null, "fecha_inicio": "01-05-2023", "fecha_fin": "2028-04-30", "presidente": "OSCAR SANABRIA SUAREZ", "localidad": "Suba", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR SANABRIA SUAREZ. Deporte(s): Atletismo. Localidad: Suba. Resolución R-D Nº 382. Vigente hasta 2028-04-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3784749319', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "382", "resolucion_actualizacion": null, "fecha_inicio": "01-05-2023", "fecha_fin": "2028-04-30", "presidente": "OSCAR SANABRIA SUAREZ", "localidad": "Suba", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-fundacion-ossan-club-382';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3784749319', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA SOCIEDAD LATIN FIGHTER CHAMPIONSHIP SAS  (IDRD-CLUB-de-la-sociedad-latin-fighter-championshi-481)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-sociedad-latin-fighter-championshi-481';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA SOCIEDAD LATIN FIGHTER CHAMPIONSHIP SAS',
      'Presidente: MARÃÂA CATALINA DE NARVÃÂEZ CÃÂRDENAS. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 481. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3090490',
      'gerencia@lfccolombia.com',
      ARRAY['Sambo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-sociedad-latin-fighter-championshi-481',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-sociedad-latin-fighter-championshi-481', v_school_id, '{"resolucion_rd": "481", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "MARÃÂA CATALINA DE NARVÃÂEZ CÃÂRDENAS", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃÂA CATALINA DE NARVÃÂEZ CÃÂRDENAS. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 481. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3090490', phone),
      email       = COALESCE('gerencia@lfccolombia.com', email),
      sports      = ARRAY['Sambo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "481", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "MARÃÂA CATALINA DE NARVÃÂEZ CÃÂRDENAS", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-sociedad-latin-fighter-championshi-481';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3090490', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA UNIVERSIDAD DE CIENCIAS APLICADAS Y AMBIENTALES U.D.C.A.  (IDRD-CLUB-de-la-universidad-de-ciencias-aplicadas--495)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-universidad-de-ciencias-aplicadas--495';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA UNIVERSIDAD DE CIENCIAS APLICADAS Y AMBIENTALES U.D.C.A.',
      'Presidente: GERMAN ANZOLA MONTERO. Deporte(s): Ultimate, Voleibol, Patinaje, Fútbol, Esgrima, Ciclismo, Boxeo, Balonmano, Badminton, Baloncesto, Atletismo. Localidad: Suba. Resolución R-D Nº 495. Vigente hasta 2026-07-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6684700',
      'deportes@udca.edu.co',
      ARRAY['Ultimate','Voleibol','Patinaje','Fútbol','Esgrima','Ciclismo','Boxeo','Balonmano','Badminton','Baloncesto','Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-universidad-de-ciencias-aplicadas--495',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-universidad-de-ciencias-aplicadas--495', v_school_id, '{"resolucion_rd": "495", "resolucion_actualizacion": null, "fecha_inicio": "06-07-2021", "fecha_fin": "2026-07-06", "presidente": "GERMAN ANZOLA MONTERO", "localidad": "Suba", "sports": ["Ultimate", "Voleibol", "Patinaje", "Fútbol", "Esgrima", "Ciclismo", "Boxeo", "Balonmano", "Badminton", "Baloncesto", "Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GERMAN ANZOLA MONTERO. Deporte(s): Ultimate, Voleibol, Patinaje, Fútbol, Esgrima, Ciclismo, Boxeo, Balonmano, Badminton, Baloncesto, Atletismo. Localidad: Suba. Resolución R-D Nº 495. Vigente hasta 2026-07-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6684700', phone),
      email       = COALESCE('deportes@udca.edu.co', email),
      sports      = ARRAY['Ultimate','Voleibol','Patinaje','Fútbol','Esgrima','Ciclismo','Boxeo','Balonmano','Badminton','Baloncesto','Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "495", "resolucion_actualizacion": null, "fecha_inicio": "06-07-2021", "fecha_fin": "2026-07-06", "presidente": "GERMAN ANZOLA MONTERO", "localidad": "Suba", "sports": ["Ultimate", "Voleibol", "Patinaje", "Fútbol", "Esgrima", "Ciclismo", "Boxeo", "Balonmano", "Badminton", "Baloncesto", "Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-universidad-de-ciencias-aplicadas--495';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6684700', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA UNIVERSIDAD SERGIO ARBOLEDA  (IDRD-CLUB-de-la-universidad-sergio-arboleda-422)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-universidad-sergio-arboleda-422';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA UNIVERSIDAD SERGIO ARBOLEDA',
      'Presidente: RODRIGO FRANCISCO MANUEL NOGUERA CALDERÃÆÃ¢â¬ÅN. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 422 / actualización Nº 1670. Vigente hasta 2027-05-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3257500230',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-universidad-sergio-arboleda-422',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-universidad-sergio-arboleda-422', v_school_id, '{"resolucion_rd": "422", "resolucion_actualizacion": "1670", "fecha_inicio": "05-05-2022", "fecha_fin": "2027-05-05", "presidente": "RODRIGO FRANCISCO MANUEL NOGUERA CALDERÃÆÃ¢â¬ÅN", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RODRIGO FRANCISCO MANUEL NOGUERA CALDERÃÆÃ¢â¬ÅN. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 422 / actualización Nº 1670. Vigente hasta 2027-05-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3257500230', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "422", "resolucion_actualizacion": "1670", "fecha_inicio": "05-05-2022", "fecha_fin": "2027-05-05", "presidente": "RODRIGO FRANCISCO MANUEL NOGUERA CALDERÃÆÃ¢â¬ÅN", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-universidad-sergio-arboleda-422';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3257500230', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE NATACION GURAMI CLUB  (IDRD-CLUB-de-natacion-gurami-club-374)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-natacion-gurami-club-374';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE NATACION GURAMI CLUB',
      'Presidente: MIGUEL ANGEL SEGURA LOPEZ. Deporte(s): Natación. Localidad: Teusaquillo. Resolución R-D Nº 374 / actualización Nº 1088. Vigente hasta 2027-04-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3108516995',
      'guraminatacion@hotmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-natacion-gurami-club-374',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-natacion-gurami-club-374', v_school_id, '{"resolucion_rd": "374", "resolucion_actualizacion": "1088", "fecha_inicio": "26-04-2022", "fecha_fin": "2027-04-26", "presidente": "MIGUEL ANGEL SEGURA LOPEZ", "localidad": "Teusaquillo", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL SEGURA LOPEZ. Deporte(s): Natación. Localidad: Teusaquillo. Resolución R-D Nº 374 / actualización Nº 1088. Vigente hasta 2027-04-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108516995', phone),
      email       = COALESCE('guraminatacion@hotmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "374", "resolucion_actualizacion": "1088", "fecha_inicio": "26-04-2022", "fecha_fin": "2027-04-26", "presidente": "MIGUEL ANGEL SEGURA LOPEZ", "localidad": "Teusaquillo", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-natacion-gurami-club-374';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3108516995', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE NATACION Y CLAVADOS BOGOTA  (IDRD-CLUB-de-natacion-y-clavados-bogota-329)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-natacion-y-clavados-bogota-329';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE NATACION Y CLAVADOS BOGOTA',
      'Presidente: DAPHNE GISELLE ARIAS MARTINEZ. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 329. Vigente hasta 2028-04-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '21732193214419303',
      'clavadosbogota@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-natacion-y-clavados-bogota-329',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-natacion-y-clavados-bogota-329', v_school_id, '{"resolucion_rd": "329", "resolucion_actualizacion": null, "fecha_inicio": "14-04-2023", "fecha_fin": "2028-04-13", "presidente": "DAPHNE GISELLE ARIAS MARTINEZ", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAPHNE GISELLE ARIAS MARTINEZ. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 329. Vigente hasta 2028-04-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('21732193214419303', phone),
      email       = COALESCE('clavadosbogota@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "329", "resolucion_actualizacion": null, "fecha_inicio": "14-04-2023", "fecha_fin": "2028-04-13", "presidente": "DAPHNE GISELLE ARIAS MARTINEZ", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-natacion-y-clavados-bogota-329';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '21732193214419303', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ASOCIACIÃN REAL SOCIEDAD BOGOTÃ R Y D  (IDRD-CLUB-asociacian-real-sociedad-bogota-r-y-d-307)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-asociacian-real-sociedad-bogota-r-y-d-307';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ASOCIACIÃN REAL SOCIEDAD BOGOTÃ R Y D',
      'Presidente: KELLY JOAN REBELLON DUFFO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 307. Vigente hasta 2028-04-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3188381034',
      'danimero1@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'asociacian-real-sociedad-bogota-r-y-d-307',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-asociacian-real-sociedad-bogota-r-y-d-307', v_school_id, '{"resolucion_rd": "307", "resolucion_actualizacion": null, "fecha_inicio": "10-04-2023", "fecha_fin": "2028-04-09", "presidente": "KELLY JOAN REBELLON DUFFO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KELLY JOAN REBELLON DUFFO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 307. Vigente hasta 2028-04-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3188381034', phone),
      email       = COALESCE('danimero1@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "307", "resolucion_actualizacion": null, "fecha_inicio": "10-04-2023", "fecha_fin": "2028-04-09", "presidente": "KELLY JOAN REBELLON DUFFO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-asociacian-real-sociedad-bogota-r-y-d-307';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3188381034', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE PATINAJE NAVAJOS  (IDRD-CLUB-de-patinaje-navajos-726)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-patinaje-navajos-726';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE PATINAJE NAVAJOS',
      'Presidente: JUAN MANUEL GARZÃâN RODRÃÂGUEZ. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 726. Vigente hasta 2027-07-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3106662865',
      'clubnavajos@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-patinaje-navajos-726',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-patinaje-navajos-726', v_school_id, '{"resolucion_rd": "726", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2022", "fecha_fin": "2027-07-05", "presidente": "JUAN MANUEL GARZÃâN RODRÃÂGUEZ", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN MANUEL GARZÃâN RODRÃÂGUEZ. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 726. Vigente hasta 2027-07-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106662865', phone),
      email       = COALESCE('clubnavajos@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "726", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2022", "fecha_fin": "2027-07-05", "presidente": "JUAN MANUEL GARZÃâN RODRÃÂGUEZ", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-patinaje-navajos-726';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3106662865', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PATINAJE REAL BOGOTÃÂ  (IDRD-CLUB-club-deportivo-de-patinaje-real-bogotaa-037)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-real-bogotaa-037';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PATINAJE REAL BOGOTÃÂ',
      'Presidente: YULY YANNETH FAJARDO CALDERON. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 037. Vigente hasta 2029-02-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '802854880285983132334901',
      'realbogota@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-patinaje-real-bogotaa-037',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-patinaje-real-bogotaa-037', v_school_id, '{"resolucion_rd": "037", "resolucion_actualizacion": null, "fecha_inicio": "02-02-2024", "fecha_fin": "2029-02-01", "presidente": "YULY YANNETH FAJARDO CALDERON", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YULY YANNETH FAJARDO CALDERON. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 037. Vigente hasta 2029-02-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('802854880285983132334901', phone),
      email       = COALESCE('realbogota@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "037", "resolucion_actualizacion": null, "fecha_inicio": "02-02-2024", "fecha_fin": "2029-02-01", "presidente": "YULY YANNETH FAJARDO CALDERON", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-real-bogotaa-037';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '802854880285983132334901', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO OLYMPIC  (IDRD-CLUB-club-deportivo-de-taekwondo-olympic-1780)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-olympic-1780';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO OLYMPIC',
      'Presidente: JORGE ANDRES PARRA TORO. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1780. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3118526910',
      'clubtkdolympic@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-olympic-1780',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-olympic-1780', v_school_id, '{"resolucion_rd": "1780", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JORGE ANDRES PARRA TORO", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE ANDRES PARRA TORO. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1780. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118526910', phone),
      email       = COALESCE('clubtkdolympic@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1780", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JORGE ANDRES PARRA TORO", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-olympic-1780';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3118526910', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TAEKWONDO SAMGUK  (IDRD-CLUB-de-taekwondo-samguk-143)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-taekwondo-samguk-143';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TAEKWONDO SAMGUK',
      'Presidente: DIEGO ALEJANDRO OLARTE CORDOBA. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 143. Vigente hasta 2027-02-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '79630943013675454',
      'diego.olarte@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-taekwondo-samguk-143',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-taekwondo-samguk-143', v_school_id, '{"resolucion_rd": "143", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2022", "fecha_fin": "2027-02-16", "presidente": "DIEGO ALEJANDRO OLARTE CORDOBA", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ALEJANDRO OLARTE CORDOBA. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 143. Vigente hasta 2027-02-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('79630943013675454', phone),
      email       = COALESCE('diego.olarte@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "143", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2022", "fecha_fin": "2027-02-16", "presidente": "DIEGO ALEJANDRO OLARTE CORDOBA", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-taekwondo-samguk-143';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '79630943013675454', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TAEKWONDO SUA D.C.  (IDRD-CLUB-de-taekwondo-sua-dc-1561)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-taekwondo-sua-dc-1561';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TAEKWONDO SUA D.C.',
      'Presidente: LEONARDO CORTES RIVEROS. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1561 / actualización Nº 939. Vigente hasta 2027-11-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3143292627',
      'yudithortiz@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-taekwondo-sua-dc-1561',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-taekwondo-sua-dc-1561', v_school_id, '{"resolucion_rd": "1561", "resolucion_actualizacion": "939", "fecha_inicio": "30-11-2022", "fecha_fin": "2027-11-30", "presidente": "LEONARDO CORTES RIVEROS", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEONARDO CORTES RIVEROS. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1561 / actualización Nº 939. Vigente hasta 2027-11-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143292627', phone),
      email       = COALESCE('yudithortiz@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1561", "resolucion_actualizacion": "939", "fecha_inicio": "30-11-2022", "fecha_fin": "2027-11-30", "presidente": "LEONARDO CORTES RIVEROS", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-taekwondo-sua-dc-1561';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3143292627', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEL COMERCIO DE BOGOTÃÂ - CLUB DE TRABAJADORES ahora CLUB DEPORTI  (IDRD-CLUB-club-del-comercio-de-bogotaa---club-de-t-197)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-del-comercio-de-bogotaa---club-de-t-197';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEL COMERCIO DE BOGOTÃÂ - CLUB DE TRABAJADORES ahora CLUB DEPORTI',
      'Presidente: NESTOR ENRIQUE MORENO GONZALEZ. Deporte(s): Billar, Natación, Tenis. Localidad: Chapinero. Resolución R-D Nº 197. Vigente hasta 2028-03-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '21041003187124711',
      'atencionsocios@clubdelcomerciobogota.com',
      ARRAY['Billar','Natación','Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-del-comercio-de-bogotaa---club-de-t-197',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-del-comercio-de-bogotaa---club-de-t-197', v_school_id, '{"resolucion_rd": "197", "resolucion_actualizacion": null, "fecha_inicio": "09-03-2023", "fecha_fin": "2028-03-08", "presidente": "NESTOR ENRIQUE MORENO GONZALEZ", "localidad": "Chapinero", "sports": ["Billar", "Natación", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR ENRIQUE MORENO GONZALEZ. Deporte(s): Billar, Natación, Tenis. Localidad: Chapinero. Resolución R-D Nº 197. Vigente hasta 2028-03-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('21041003187124711', phone),
      email       = COALESCE('atencionsocios@clubdelcomerciobogota.com', email),
      sports      = ARRAY['Billar','Natación','Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "197", "resolucion_actualizacion": null, "fecha_inicio": "09-03-2023", "fecha_fin": "2028-03-08", "presidente": "NESTOR ENRIQUE MORENO GONZALEZ", "localidad": "Chapinero", "sports": ["Billar", "Natación", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-del-comercio-de-bogotaa---club-de-t-197';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '21041003187124711', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DEVILS ALL STARS  (IDRD-CLUB-devils-all-stars-727)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-devils-all-stars-727';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DEVILS ALL STARS',
      'Presidente: SERGIO ANDRE SUAREZ ORTIZ. Deporte(s): Porrismo. Localidad: Engativá. Resolución R-D Nº 727. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3115042713',
      'devilsallstars@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'devils-all-stars-727',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-devils-all-stars-727', v_school_id, '{"resolucion_rd": "727", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "SERGIO ANDRE SUAREZ ORTIZ", "localidad": "Engativá", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SERGIO ANDRE SUAREZ ORTIZ. Deporte(s): Porrismo. Localidad: Engativá. Resolución R-D Nº 727. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115042713', phone),
      email       = COALESCE('devilsallstars@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "727", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "SERGIO ANDRE SUAREZ ORTIZ", "localidad": "Engativá", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-devils-all-stars-727';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3115042713', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DI LEX  (IDRD-CLUB-club-deportivo-di-lex-1747)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-di-lex-1747';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DI LEX',
      'Presidente: ANDRES SANTIAGO ROJAS VILLALBA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1747. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3102948260',
      'gerrojs@yahoo.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-di-lex-1747',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-di-lex-1747', v_school_id, '{"resolucion_rd": "1747", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "ANDRES SANTIAGO ROJAS VILLALBA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES SANTIAGO ROJAS VILLALBA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1747. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102948260', phone),
      email       = COALESCE('gerrojs@yahoo.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1747", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "ANDRES SANTIAGO ROJAS VILLALBA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-di-lex-1747';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3102948260', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DIABLOS ROJOS  (IDRD-CLUB-diablos-rojos-679)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-diablos-rojos-679';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DIABLOS ROJOS',
      'Presidente: JOSUE NICOLAS RUGELES BARRETO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 679. Vigente hasta 2028-06-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3124881573',
      'diablosrojosfutclub@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'diablos-rojos-679',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-diablos-rojos-679', v_school_id, '{"resolucion_rd": "679", "resolucion_actualizacion": null, "fecha_inicio": "27-06-2023", "fecha_fin": "2028-06-26", "presidente": "JOSUE NICOLAS RUGELES BARRETO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSUE NICOLAS RUGELES BARRETO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 679. Vigente hasta 2028-06-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124881573', phone),
      email       = COALESCE('diablosrojosfutclub@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "679", "resolucion_actualizacion": null, "fecha_inicio": "27-06-2023", "fecha_fin": "2028-06-26", "presidente": "JOSUE NICOLAS RUGELES BARRETO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-diablos-rojos-679';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3124881573', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DINHOS  (IDRD-CLUB-dinhos-846)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dinhos-846';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DINHOS',
      'Presidente: ANGIE CATHERINE HERNANDEZ DIAZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 846. Vigente hasta 2028-08-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3242114851',
      'recepcion@dinhos.com.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dinhos-846',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dinhos-846', v_school_id, '{"resolucion_rd": "846", "resolucion_actualizacion": null, "fecha_inicio": "03-08-2023", "fecha_fin": "2028-08-02", "presidente": "ANGIE CATHERINE HERNANDEZ DIAZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGIE CATHERINE HERNANDEZ DIAZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 846. Vigente hasta 2028-08-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3242114851', phone),
      email       = COALESCE('recepcion@dinhos.com.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "846", "resolucion_actualizacion": null, "fecha_inicio": "03-08-2023", "fecha_fin": "2028-08-02", "presidente": "ANGIE CATHERINE HERNANDEZ DIAZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dinhos-846';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3242114851', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVOP EL MINUTO FUTBOL CLUB  (IDRD-CLUB-club-deportivop-el-minuto-futbol-club-17)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivop-el-minuto-futbol-club-17';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVOP EL MINUTO FUTBOL CLUB',
      'Presidente: DAVID ANDRES DAZA CAÃÆÃ¢â¬ËON. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 17 / actualización Nº 279. Vigente hasta 2029-01-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3138518496',
      'elminutofc@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivop-el-minuto-futbol-club-17',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivop-el-minuto-futbol-club-17', v_school_id, '{"resolucion_rd": "17", "resolucion_actualizacion": "279", "fecha_inicio": "24-01-2024", "fecha_fin": "2029-01-23", "presidente": "DAVID ANDRES DAZA CAÃÆÃ¢â¬ËON", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID ANDRES DAZA CAÃÆÃ¢â¬ËON. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 17 / actualización Nº 279. Vigente hasta 2029-01-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138518496', phone),
      email       = COALESCE('elminutofc@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "17", "resolucion_actualizacion": "279", "fecha_inicio": "24-01-2024", "fecha_fin": "2029-01-23", "presidente": "DAVID ANDRES DAZA CAÃÆÃ¢â¬ËON", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivop-el-minuto-futbol-club-17';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3138518496', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CORPORACION CLUB EL NOGAL  (IDRD-CLUB-club-deportivo-corporacion-club-el-nogal-008)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-corporacion-club-el-nogal-008';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CORPORACION CLUB EL NOGAL',
      'Presidente: MERY YOHANNA LARA VARGAS. Deporte(s): Ajedrez, Billar, Golf, Natación, Bowling, Squash, Tiro deportivo, Raquetball, Caza Deportiva. Localidad: Chapinero. Resolución R-D Nº 008 / actualización Nº 1741. Vigente hasta 2027-02-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3267700',
      NULL,
      ARRAY['Ajedrez','Billar','Golf','Natación','Bowling','Squash','Tiro deportivo','Raquetball','Caza Deportiva']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-corporacion-club-el-nogal-008',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-corporacion-club-el-nogal-008', v_school_id, '{"resolucion_rd": "008", "resolucion_actualizacion": "1741", "fecha_inicio": "28-02-2022", "fecha_fin": "2027-02-28", "presidente": "MERY YOHANNA LARA VARGAS", "localidad": "Chapinero", "sports": ["Ajedrez", "Billar", "Golf", "Natación", "Bowling", "Squash", "Tiro deportivo", "Raquetball", "Caza Deportiva"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MERY YOHANNA LARA VARGAS. Deporte(s): Ajedrez, Billar, Golf, Natación, Bowling, Squash, Tiro deportivo, Raquetball, Caza Deportiva. Localidad: Chapinero. Resolución R-D Nº 008 / actualización Nº 1741. Vigente hasta 2027-02-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3267700', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ajedrez','Billar','Golf','Natación','Bowling','Squash','Tiro deportivo','Raquetball','Caza Deportiva']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "008", "resolucion_actualizacion": "1741", "fecha_inicio": "28-02-2022", "fecha_fin": "2027-02-28", "presidente": "MERY YOHANNA LARA VARGAS", "localidad": "Chapinero", "sports": ["Ajedrez", "Billar", "Golf", "Natación", "Bowling", "Squash", "Tiro deportivo", "Raquetball", "Caza Deportiva"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-corporacion-club-el-nogal-008';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3267700', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EL SANJUANERO  (IDRD-CLUB-club-deportivo-el-sanjuanero-1299)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-sanjuanero-1299';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EL SANJUANERO',
      'Presidente: ALVARO NOVOA. Deporte(s): Tejo. Localidad: Kennedy. Resolución R-D Nº 1299. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3158976492',
      'alvaronovoa652@gmail.com',
      ARRAY['Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-el-sanjuanero-1299',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-el-sanjuanero-1299', v_school_id, '{"resolucion_rd": "1299", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "ALVARO NOVOA", "localidad": "Kennedy", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALVARO NOVOA. Deporte(s): Tejo. Localidad: Kennedy. Resolución R-D Nº 1299. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158976492', phone),
      email       = COALESCE('alvaronovoa652@gmail.com', email),
      sports      = ARRAY['Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1299", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "ALVARO NOVOA", "localidad": "Kennedy", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-sanjuanero-1299';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3158976492', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- EMMANUEL FC.  (IDRD-CLUB-emmanuel-fc-1101)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-emmanuel-fc-1101';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'EMMANUEL FC.',
      'Presidente: SERGIO HERNANDO CELY DIAZ,. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1101 / actualización Nº 705. Vigente hasta 2026-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3017561581',
      'ruben@emmanuelfc.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'emmanuel-fc-1101',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-emmanuel-fc-1101', v_school_id, '{"resolucion_rd": "1101", "resolucion_actualizacion": "705", "fecha_inicio": "13-12-2021", "fecha_fin": "2026-12-13", "presidente": "SERGIO HERNANDO CELY DIAZ,", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SERGIO HERNANDO CELY DIAZ,. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1101 / actualización Nº 705. Vigente hasta 2026-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017561581', phone),
      email       = COALESCE('ruben@emmanuelfc.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1101", "resolucion_actualizacion": "705", "fecha_inicio": "13-12-2021", "fecha_fin": "2026-12-13", "presidente": "SERGIO HERNANDO CELY DIAZ,", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-emmanuel-fc-1101';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3017561581', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ENGATIVA ESFORDIT  (IDRD-CLUB-engativa-esfordit-546)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-engativa-esfordit-546';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ENGATIVA ESFORDIT',
      'Presidente: LEDISSON DARYANNI NUÃâEZ CARVAJAL. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 546. Vigente hasta 2027-05-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '22832123204330533',
      'esfordit@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'engativa-esfordit-546',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-engativa-esfordit-546', v_school_id, '{"resolucion_rd": "546", "resolucion_actualizacion": null, "fecha_inicio": "31-05-2022", "fecha_fin": "2027-05-31", "presidente": "LEDISSON DARYANNI NUÃâEZ CARVAJAL", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEDISSON DARYANNI NUÃâEZ CARVAJAL. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 546. Vigente hasta 2027-05-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('22832123204330533', phone),
      email       = COALESCE('esfordit@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "546", "resolucion_actualizacion": null, "fecha_inicio": "31-05-2022", "fecha_fin": "2027-05-31", "presidente": "LEDISSON DARYANNI NUÃâEZ CARVAJAL", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-engativa-esfordit-546';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '22832123204330533', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GRANDES TALENTOS FUTBOL CLUB  (IDRD-CLUB-club-deportivo-grandes-talentos-futbol-c-025)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-grandes-talentos-futbol-c-025';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GRANDES TALENTOS FUTBOL CLUB',
      'Presidente: SAMIR GARZON SANCHEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 025. Vigente hasta 2029-01-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3132246195',
      'jposadasanchez54@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-grandes-talentos-futbol-c-025',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-grandes-talentos-futbol-c-025', v_school_id, '{"resolucion_rd": "025", "resolucion_actualizacion": null, "fecha_inicio": "26-01-2024", "fecha_fin": "2029-01-25", "presidente": "SAMIR GARZON SANCHEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SAMIR GARZON SANCHEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 025. Vigente hasta 2029-01-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132246195', phone),
      email       = COALESCE('jposadasanchez54@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "025", "resolucion_actualizacion": null, "fecha_inicio": "26-01-2024", "fecha_fin": "2029-01-25", "presidente": "SAMIR GARZON SANCHEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-grandes-talentos-futbol-c-025';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3132246195', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESPAÃâOL FUTBOL CLUB COLOMBIA  (IDRD-CLUB-espaaaol-futbol-club-colombia-1810)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-espaaaol-futbol-club-colombia-1810';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESPAÃâOL FUTBOL CLUB COLOMBIA',
      'Presidente: PABLO CESAR LEON MATEUS. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 1810. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '5305414',
      'jhon850923@yahoo.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'espaaaol-futbol-club-colombia-1810',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-espaaaol-futbol-club-colombia-1810', v_school_id, '{"resolucion_rd": "1810", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "PABLO CESAR LEON MATEUS", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PABLO CESAR LEON MATEUS. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 1810. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5305414', phone),
      email       = COALESCE('jhon850923@yahoo.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1810", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "PABLO CESAR LEON MATEUS", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-espaaaol-futbol-club-colombia-1810';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '5305414', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTEBAN CHAVES  (IDRD-CLUB-esteban-chaves-786)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-esteban-chaves-786';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTEBAN CHAVES',
      'Presidente: WILSON SANDOVAL HOYOS. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 786 / actualización Nº 634. Vigente hasta 2026-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '7500894',
      NULL,
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'esteban-chaves-786',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-esteban-chaves-786', v_school_id, '{"resolucion_rd": "786", "resolucion_actualizacion": "634", "fecha_inicio": "05-10-2021", "fecha_fin": "2026-10-05", "presidente": "WILSON SANDOVAL HOYOS", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON SANDOVAL HOYOS. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 786 / actualización Nº 634. Vigente hasta 2026-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7500894', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "786", "resolucion_actualizacion": "634", "fecha_inicio": "05-10-2021", "fecha_fin": "2026-10-05", "presidente": "WILSON SANDOVAL HOYOS", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-esteban-chaves-786';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '7500894', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESTRELLA EMBAJADORA  (IDRD-CLUB-club-deportivo-estrella-embajadora-1967)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-estrella-embajadora-1967';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESTRELLA EMBAJADORA',
      'Presidente: MARIA FERNANDA PARRA ROJAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1967. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3002065575',
      'clubestrellaembajadora@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-estrella-embajadora-1967',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-estrella-embajadora-1967', v_school_id, '{"resolucion_rd": "1967", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MARIA FERNANDA PARRA ROJAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA FERNANDA PARRA ROJAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1967. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002065575', phone),
      email       = COALESCE('clubestrellaembajadora@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1967", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MARIA FERNANDA PARRA ROJAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-estrella-embajadora-1967';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3002065575', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTRELLA ROJA  (IDRD-CLUB-estrella-roja-1343)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-estrella-roja-1343';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTRELLA ROJA',
      'Presidente: BLANCA CECILIA SUESCÃÅ¡N DE CASTRO. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 1343 / actualización Nº 1184. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3833355',
      'clubestrellaroja1985@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'estrella-roja-1343',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-estrella-roja-1343', v_school_id, '{"resolucion_rd": "1343", "resolucion_actualizacion": "1184", "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "BLANCA CECILIA SUESCÃÅ¡N DE CASTRO", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BLANCA CECILIA SUESCÃÅ¡N DE CASTRO. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 1343 / actualización Nº 1184. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3833355', phone),
      email       = COALESCE('clubestrellaroja1985@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1343", "resolucion_actualizacion": "1184", "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "BLANCA CECILIA SUESCÃÅ¡N DE CASTRO", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-estrella-roja-1343';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3833355', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CLUB ESTRELLAS DE LOS ANDES  (IDRD-CLUB-club-deportivo-club-estrellas-de-los-and-1965)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-club-estrellas-de-los-and-1965';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CLUB ESTRELLAS DE LOS ANDES',
      'Presidente: PAULA ANDREA VITERI VILLAMARIN. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 1965. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3148364204',
      'clubestrellasdelosandes@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-club-estrellas-de-los-and-1965',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-club-estrellas-de-los-and-1965', v_school_id, '{"resolucion_rd": "1965", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "PAULA ANDREA VITERI VILLAMARIN", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAULA ANDREA VITERI VILLAMARIN. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 1965. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3148364204', phone),
      email       = COALESCE('clubestrellasdelosandes@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1965", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "PAULA ANDREA VITERI VILLAMARIN", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-club-estrellas-de-los-and-1965';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3148364204', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTRELLAS DE SUBA  (IDRD-CLUB-estrellas-de-suba-1383)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-estrellas-de-suba-1383';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTRELLAS DE SUBA',
      'Presidente: EMMA LUCIA TORRES MUÃâOZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1383. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3118023713',
      'epestrellassuba@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'estrellas-de-suba-1383',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-estrellas-de-suba-1383', v_school_id, '{"resolucion_rd": "1383", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "EMMA LUCIA TORRES MUÃâOZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EMMA LUCIA TORRES MUÃâOZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1383. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118023713', phone),
      email       = COALESCE('epestrellassuba@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1383", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "EMMA LUCIA TORRES MUÃâOZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-estrellas-de-suba-1383';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3118023713', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESTRELLAS P.P.  (IDRD-CLUB-club-deportivo-estrellas-pp-635)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-estrellas-pp-635';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESTRELLAS P.P.',
      'Presidente: JAVIER ENRIQUE BARRETO MOSQUERA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 635 / actualización Nº 477. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3144319757',
      'futestrellaspp@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-estrellas-pp-635',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-estrellas-pp-635', v_school_id, '{"resolucion_rd": "635", "resolucion_actualizacion": "477", "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "JAVIER ENRIQUE BARRETO MOSQUERA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAVIER ENRIQUE BARRETO MOSQUERA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 635 / actualización Nº 477. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144319757', phone),
      email       = COALESCE('futestrellaspp@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "635", "resolucion_actualizacion": "477", "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "JAVIER ENRIQUE BARRETO MOSQUERA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-estrellas-pp-635';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3144319757', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTUDIANTES F.C.  (IDRD-CLUB-estudiantes-fc-791)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-estudiantes-fc-791';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTUDIANTES F.C.',
      'Presidente: ASDRUBAL ARENAS ARTUNDUAGA. Deporte(s): Fútbol. Localidad: Santa Fe. Resolución R-D Nº 791. Vigente hasta 2028-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Santa Fe',
      '6013341105',
      'arenas.j@jareniana.edu.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'estudiantes-fc-791',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-estudiantes-fc-791', v_school_id, '{"resolucion_rd": "791", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2023", "fecha_fin": "2028-07-25", "presidente": "ASDRUBAL ARENAS ARTUNDUAGA", "localidad": "Santa Fe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ASDRUBAL ARENAS ARTUNDUAGA. Deporte(s): Fútbol. Localidad: Santa Fe. Resolución R-D Nº 791. Vigente hasta 2028-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6013341105', phone),
      email       = COALESCE('arenas.j@jareniana.edu.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "791", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2023", "fecha_fin": "2028-07-25", "presidente": "ASDRUBAL ARENAS ARTUNDUAGA", "localidad": "Santa Fe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-estudiantes-fc-791';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Santa Fe', 'Bogotá', '6013341105', 4.6017892, -74.0791799, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- EUFORIA  (IDRD-CLUB-euforia-717)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-euforia-717';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'EUFORIA',
      'Presidente: MAURICIO EDUARDO PERDOMO BAUTISTA. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 717. Vigente hasta 2026-09-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3204716034',
      'mauroper80@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'euforia-717',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-euforia-717', v_school_id, '{"resolucion_rd": "717", "resolucion_actualizacion": null, "fecha_inicio": "16-09-2021", "fecha_fin": "2026-09-16", "presidente": "MAURICIO EDUARDO PERDOMO BAUTISTA", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAURICIO EDUARDO PERDOMO BAUTISTA. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 717. Vigente hasta 2026-09-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204716034', phone),
      email       = COALESCE('mauroper80@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "717", "resolucion_actualizacion": null, "fecha_inicio": "16-09-2021", "fecha_fin": "2026-09-16", "presidente": "MAURICIO EDUARDO PERDOMO BAUTISTA", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-euforia-717';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3204716034', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- EUROACADEMY ITALIA BOGOTÃÆÃÂ  (IDRD-CLUB-euroacademy-italia-bogotaaa-072)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-euroacademy-italia-bogotaaa-072';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'EUROACADEMY ITALIA BOGOTÃÆÃÂ',
      'Presidente: MARTHA ISABEL SUAREZ MARTINEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 072 / actualización Nº 928. Vigente hasta 2027-01-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '46427843102100421',
      'rmarsuaresmar@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'euroacademy-italia-bogotaaa-072',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-euroacademy-italia-bogotaaa-072', v_school_id, '{"resolucion_rd": "072", "resolucion_actualizacion": "928", "fecha_inicio": "27-01-2022", "fecha_fin": "2027-01-27", "presidente": "MARTHA ISABEL SUAREZ MARTINEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTHA ISABEL SUAREZ MARTINEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 072 / actualización Nº 928. Vigente hasta 2027-01-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('46427843102100421', phone),
      email       = COALESCE('rmarsuaresmar@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "072", "resolucion_actualizacion": "928", "fecha_inicio": "27-01-2022", "fecha_fin": "2027-01-27", "presidente": "MARTHA ISABEL SUAREZ MARTINEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-euroacademy-italia-bogotaaa-072';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '46427843102100421', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SÃPER CAMPEONES INTERNACIONAL CLUB DEPORTIVO  (IDRD-CLUB-club-deportivo-saper-campeones-internaci-1115)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-saper-campeones-internaci-1115';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SÃPER CAMPEONES INTERNACIONAL CLUB DEPORTIVO',
      'Presidente: CARLOS ARTURO VELAZQUEZ CABRERA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1115 / actualización Nº 1143. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3502558298',
      'criano06@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-saper-campeones-internaci-1115',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-saper-campeones-internaci-1115', v_school_id, '{"resolucion_rd": "1115", "resolucion_actualizacion": "1143", "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "CARLOS ARTURO VELAZQUEZ CABRERA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO VELAZQUEZ CABRERA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1115 / actualización Nº 1143. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3502558298', phone),
      email       = COALESCE('criano06@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1115", "resolucion_actualizacion": "1143", "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "CARLOS ARTURO VELAZQUEZ CABRERA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-saper-campeones-internaci-1115';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3502558298', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- EXTREME GAME TENIS DE MESA  (IDRD-CLUB-extreme-game-tenis-de-mesa-1332)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-extreme-game-tenis-de-mesa-1332';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'EXTREME GAME TENIS DE MESA',
      'Presidente: IVON EMILCE GÃMEZ BARBOSA. Deporte(s): Tenis de mesa. Localidad: Antonio Nariño. Resolución R-D Nº 1332. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3006323',
      'clubextremegame@gmail.com',
      ARRAY['Tenis de mesa']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'extreme-game-tenis-de-mesa-1332',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-extreme-game-tenis-de-mesa-1332', v_school_id, '{"resolucion_rd": "1332", "resolucion_actualizacion": null, "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "IVON EMILCE GÃMEZ BARBOSA", "localidad": "Antonio Nariño", "sports": ["Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVON EMILCE GÃMEZ BARBOSA. Deporte(s): Tenis de mesa. Localidad: Antonio Nariño. Resolución R-D Nº 1332. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006323', phone),
      email       = COALESCE('clubextremegame@gmail.com', email),
      sports      = ARRAY['Tenis de mesa']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1332", "resolucion_actualizacion": null, "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "IVON EMILCE GÃMEZ BARBOSA", "localidad": "Antonio Nariño", "sports": ["Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-extreme-game-tenis-de-mesa-1332';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3006323', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- F.D.G.  (IDRD-CLUB-fdg-297)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fdg-297';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'F.D.G.',
      'Presidente: CARMEN XIMENA GOMEZ ACOSTA. Deporte(s): Gimnasia. Localidad: Usaquén. Resolución R-D Nº 297. Vigente hasta 2027-03-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '5204872',
      NULL,
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fdg-297',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fdg-297', v_school_id, '{"resolucion_rd": "297", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2022", "fecha_fin": "2027-03-31", "presidente": "CARMEN XIMENA GOMEZ ACOSTA", "localidad": "Usaquén", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARMEN XIMENA GOMEZ ACOSTA. Deporte(s): Gimnasia. Localidad: Usaquén. Resolución R-D Nº 297. Vigente hasta 2027-03-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5204872', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "297", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2022", "fecha_fin": "2027-03-31", "presidente": "CARMEN XIMENA GOMEZ ACOSTA", "localidad": "Usaquén", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fdg-297';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '5204872', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FACODEXT ATALANTA F.C.  (IDRD-CLUB-club-deportivo-facodext-atalanta-fc-1646)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-facodext-atalanta-fc-1646';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FACODEXT ATALANTA F.C.',
      'Presidente: BRAYAN SANTIAGO VANEGAS ROA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1646. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3202311341',
      'atalantafclub@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-facodext-atalanta-fc-1646',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-facodext-atalanta-fc-1646', v_school_id, '{"resolucion_rd": "1646", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "BRAYAN SANTIAGO VANEGAS ROA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BRAYAN SANTIAGO VANEGAS ROA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1646. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202311341', phone),
      email       = COALESCE('atalantafclub@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1646", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "BRAYAN SANTIAGO VANEGAS ROA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-facodext-atalanta-fc-1646';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3202311341', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FAIR PLAY  (IDRD-CLUB-club-deportivo-fair-play-1246)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fair-play-1246';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FAIR PLAY',
      'Presidente: STEVEN MARCOS TORRES ALCALÃÂ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1246 / actualización Nº 1703. Vigente hasta 2028-10-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3144449102',
      'steven.torres@clubdeportivofairplay.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fair-play-1246',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fair-play-1246', v_school_id, '{"resolucion_rd": "1246", "resolucion_actualizacion": "1703", "fecha_inicio": "17-10-2023", "fecha_fin": "2028-10-16", "presidente": "STEVEN MARCOS TORRES ALCALÃÂ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: STEVEN MARCOS TORRES ALCALÃÂ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1246 / actualización Nº 1703. Vigente hasta 2028-10-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144449102', phone),
      email       = COALESCE('steven.torres@clubdeportivofairplay.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1246", "resolucion_actualizacion": "1703", "fecha_inicio": "17-10-2023", "fecha_fin": "2028-10-16", "presidente": "STEVEN MARCOS TORRES ALCALÃÂ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fair-play-1246';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3144449102', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FALCON  (IDRD-CLUB-falcon-1013)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-falcon-1013';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FALCON',
      'Presidente: PABLO ELI HERNÃÂNDEZ. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1013. Vigente hasta 2027-09-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3153159283',
      NULL,
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'falcon-1013',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-falcon-1013', v_school_id, '{"resolucion_rd": "1013", "resolucion_actualizacion": null, "fecha_inicio": "07-09-2022", "fecha_fin": "2027-09-07", "presidente": "PABLO ELI HERNÃÂNDEZ", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PABLO ELI HERNÃÂNDEZ. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1013. Vigente hasta 2027-09-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153159283', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1013", "resolucion_actualizacion": null, "fecha_inicio": "07-09-2022", "fecha_fin": "2027-09-07", "presidente": "PABLO ELI HERNÃÂNDEZ", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-falcon-1013';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3153159283', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TAEWKONDO FEDECOAM  (IDRD-CLUB-de-taewkondo-fedecoam-196)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-taewkondo-fedecoam-196';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TAEWKONDO FEDECOAM',
      'Presidente: DAVID RICARDO FLOREZ CAMARGO. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 196. Vigente hasta 2027-03-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3103070256',
      'fedecoamtkd@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-taewkondo-fedecoam-196',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-taewkondo-fedecoam-196', v_school_id, '{"resolucion_rd": "196", "resolucion_actualizacion": null, "fecha_inicio": "03-03-2022", "fecha_fin": "2027-03-03", "presidente": "DAVID RICARDO FLOREZ CAMARGO", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID RICARDO FLOREZ CAMARGO. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 196. Vigente hasta 2027-03-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103070256', phone),
      email       = COALESCE('fedecoamtkd@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "196", "resolucion_actualizacion": null, "fecha_inicio": "03-03-2022", "fecha_fin": "2027-03-03", "presidente": "DAVID RICARDO FLOREZ CAMARGO", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-taewkondo-fedecoam-196';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3103070256', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FEDESUBA  (IDRD-CLUB-fedesuba-835)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fedesuba-835';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FEDESUBA',
      'Presidente: LUIS FERNANDO JIMENEZ DIAZ. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 835 / actualización Nº 647. Vigente hasta 2026-10-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3118958968',
      NULL,
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fedesuba-835',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fedesuba-835', v_school_id, '{"resolucion_rd": "835", "resolucion_actualizacion": "647", "fecha_inicio": "14-10-2021", "fecha_fin": "2026-10-14", "presidente": "LUIS FERNANDO JIMENEZ DIAZ", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS FERNANDO JIMENEZ DIAZ. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 835 / actualización Nº 647. Vigente hasta 2026-10-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118958968', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "835", "resolucion_actualizacion": "647", "fecha_inicio": "14-10-2021", "fecha_fin": "2026-10-14", "presidente": "LUIS FERNANDO JIMENEZ DIAZ", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fedesuba-835';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3118958968', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FENIX  (IDRD-CLUB-fenix-294)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fenix-294';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FENIX',
      'Presidente: CESAR ANDRES CASTIBLANCO BERNAL. Deporte(s): Bowling. Localidad: Engativá. Resolución R-D Nº 294 / actualización Nº 1054. Vigente hasta 2028-04-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3003020599',
      'hdocampos@yahoo.com',
      ARRAY['Bowling']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fenix-294',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fenix-294', v_school_id, '{"resolucion_rd": "294", "resolucion_actualizacion": "1054", "fecha_inicio": "06-04-2023", "fecha_fin": "2028-04-05", "presidente": "CESAR ANDRES CASTIBLANCO BERNAL", "localidad": "Engativá", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR ANDRES CASTIBLANCO BERNAL. Deporte(s): Bowling. Localidad: Engativá. Resolución R-D Nº 294 / actualización Nº 1054. Vigente hasta 2028-04-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003020599', phone),
      email       = COALESCE('hdocampos@yahoo.com', email),
      sports      = ARRAY['Bowling']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "294", "resolucion_actualizacion": "1054", "fecha_inicio": "06-04-2023", "fecha_fin": "2028-04-05", "presidente": "CESAR ANDRES CASTIBLANCO BERNAL", "localidad": "Engativá", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fenix-294';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3003020599', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
