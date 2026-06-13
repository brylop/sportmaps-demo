-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 2/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- FENIX CLUB DEPORTE CAPITAL  (IDRD-CLUB-fenix-club-deporte-capital-970)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fenix-club-deporte-capital-970';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FENIX CLUB DEPORTE CAPITAL',
      'Presidente: NORBERTO OSWALDO CHEYNE VILLARRAGA. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 970 / actualización Nº 161. Vigente hasta 2027-08-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3046432456',
      NULL,
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fenix-club-deporte-capital-970',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fenix-club-deporte-capital-970', v_school_id, '{"resolucion_rd": "970", "resolucion_actualizacion": "161", "fecha_inicio": "12-08-2022", "fecha_fin": "2027-08-12", "presidente": "NORBERTO OSWALDO CHEYNE VILLARRAGA", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NORBERTO OSWALDO CHEYNE VILLARRAGA. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 970 / actualización Nº 161. Vigente hasta 2027-08-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3046432456', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "970", "resolucion_actualizacion": "161", "fecha_inicio": "12-08-2022", "fecha_fin": "2027-08-12", "presidente": "NORBERTO OSWALDO CHEYNE VILLARRAGA", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fenix-club-deporte-capital-970';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3046432456', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FIRES SKATES  (IDRD-CLUB-fires-skates-1301)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fires-skates-1301';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FIRES SKATES',
      'Presidente: CESAR AUGUSTO GUERRERO NAGLES. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1301. Vigente hasta 2027-10-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3005994962',
      'guerreropatines11@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fires-skates-1301',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fires-skates-1301', v_school_id, '{"resolucion_rd": "1301", "resolucion_actualizacion": null, "fecha_inicio": "18-10-2022", "fecha_fin": "2027-10-18", "presidente": "CESAR AUGUSTO GUERRERO NAGLES", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR AUGUSTO GUERRERO NAGLES. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1301. Vigente hasta 2027-10-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005994962', phone),
      email       = COALESCE('guerreropatines11@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1301", "resolucion_actualizacion": null, "fecha_inicio": "18-10-2022", "fecha_fin": "2027-10-18", "presidente": "CESAR AUGUSTO GUERRERO NAGLES", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fires-skates-1301';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3005994962', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FLYING EAGLES  (IDRD-CLUB-flying-eagles-479)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-flying-eagles-479';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FLYING EAGLES',
      'Presidente: GABRIEL ENRIQUE FUENTES PITALUA. Deporte(s): Baloncesto. Localidad: Los Mártires. Resolución R-D Nº 479. Vigente hasta 2028-05-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3015824253',
      NULL,
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'flying-eagles-479',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-flying-eagles-479', v_school_id, '{"resolucion_rd": "479", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2023", "fecha_fin": "2028-05-21", "presidente": "GABRIEL ENRIQUE FUENTES PITALUA", "localidad": "Los Mártires", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GABRIEL ENRIQUE FUENTES PITALUA. Deporte(s): Baloncesto. Localidad: Los Mártires. Resolución R-D Nº 479. Vigente hasta 2028-05-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3015824253', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "479", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2023", "fecha_fin": "2028-05-21", "presidente": "GABRIEL ENRIQUE FUENTES PITALUA", "localidad": "Los Mártires", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-flying-eagles-479';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3015824253', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FREDY LEON  (IDRD-CLUB-fredy-leon-1035)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fredy-leon-1035';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FREDY LEON',
      'Presidente: FREDY ALBERTO LEON ARISTIZABAL. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1035. Vigente hasta 2028-09-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3133483140',
      'clubdeportivofredyleon@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fredy-leon-1035',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fredy-leon-1035', v_school_id, '{"resolucion_rd": "1035", "resolucion_actualizacion": null, "fecha_inicio": "07-09-2023", "fecha_fin": "2028-09-06", "presidente": "FREDY ALBERTO LEON ARISTIZABAL", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDY ALBERTO LEON ARISTIZABAL. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1035. Vigente hasta 2028-09-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133483140', phone),
      email       = COALESCE('clubdeportivofredyleon@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1035", "resolucion_actualizacion": null, "fecha_inicio": "07-09-2023", "fecha_fin": "2028-09-06", "presidente": "FREDY ALBERTO LEON ARISTIZABAL", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fredy-leon-1035';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3133483140', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TAEKWONDO FREEMEN  (IDRD-CLUB-taekwondo-freemen-894)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taekwondo-freemen-894';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEKWONDO FREEMEN',
      'Presidente: ROSA MARCELA GOENAGA OLIVARES. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 894 / actualización Nº 138. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3112090599',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taekwondo-freemen-894',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taekwondo-freemen-894', v_school_id, '{"resolucion_rd": "894", "resolucion_actualizacion": "138", "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "ROSA MARCELA GOENAGA OLIVARES", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROSA MARCELA GOENAGA OLIVARES. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 894 / actualización Nº 138. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112090599', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "894", "resolucion_actualizacion": "138", "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "ROSA MARCELA GOENAGA OLIVARES", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taekwondo-freemen-894';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3112090599', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FREEWIND  (IDRD-CLUB-freewind-478)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-freewind-478';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FREEWIND',
      'Presidente: DANIEL TORRES VALENCIA. Deporte(s): Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 478. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3219733305',
      'clubpatinajefrewind@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'freewind-478',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-freewind-478', v_school_id, '{"resolucion_rd": "478", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "DANIEL TORRES VALENCIA", "localidad": "San Cristóbal", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL TORRES VALENCIA. Deporte(s): Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 478. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219733305', phone),
      email       = COALESCE('clubpatinajefrewind@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "478", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "DANIEL TORRES VALENCIA", "localidad": "San Cristóbal", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-freewind-478';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3219733305', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUDAM  (IDRD-CLUB-fudam-856)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fudam-856';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUDAM',
      'Presidente: LUZ MYRIAM ROCÃÆÃÂO PEREZ RUBIO. Deporte(s): Taekwondo. Localidad: Usaquén. Resolución R-D Nº 856. Vigente hasta 2026-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '8143063',
      'fudamcolombia@yahoo.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fudam-856',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fudam-856', v_school_id, '{"resolucion_rd": "856", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2021", "fecha_fin": "2026-10-19", "presidente": "LUZ MYRIAM ROCÃÆÃÂO PEREZ RUBIO", "localidad": "Usaquén", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUZ MYRIAM ROCÃÆÃÂO PEREZ RUBIO. Deporte(s): Taekwondo. Localidad: Usaquén. Resolución R-D Nº 856. Vigente hasta 2026-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('8143063', phone),
      email       = COALESCE('fudamcolombia@yahoo.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "856", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2021", "fecha_fin": "2026-10-19", "presidente": "LUZ MYRIAM ROCÃÆÃÂO PEREZ RUBIO", "localidad": "Usaquén", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fudam-856';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '8143063', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUNDACION EVERET  (IDRD-CLUB-fundacion-everet-785)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fundacion-everet-785';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUNDACION EVERET',
      'Presidente: JAIRO OSWALDO MONROY GUTIERREZ. Deporte(s): Ciclismo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 785. Vigente hasta 2026-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3102371404',
      'aceciclismo@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fundacion-everet-785',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fundacion-everet-785', v_school_id, '{"resolucion_rd": "785", "resolucion_actualizacion": null, "fecha_inicio": "05-10-2021", "fecha_fin": "2026-10-05", "presidente": "JAIRO OSWALDO MONROY GUTIERREZ", "localidad": "Rafael Uribe Uribe", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIRO OSWALDO MONROY GUTIERREZ. Deporte(s): Ciclismo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 785. Vigente hasta 2026-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102371404', phone),
      email       = COALESCE('aceciclismo@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "785", "resolucion_actualizacion": null, "fecha_inicio": "05-10-2021", "fecha_fin": "2026-10-05", "presidente": "JAIRO OSWALDO MONROY GUTIERREZ", "localidad": "Rafael Uribe Uribe", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fundacion-everet-785';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3102371404', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FL CLAN FUTBOL CLUB  (IDRD-CLUB-club-deportivo-fl-clan-futbol-club-831)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fl-clan-futbol-club-831';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FL CLAN FUTBOL CLUB',
      'Presidente: VICTOR DANIEL MERLANO TAMARA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 831 / actualización Nº 831. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3123946477',
      'flclanofc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fl-clan-futbol-club-831',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fl-clan-futbol-club-831', v_school_id, '{"resolucion_rd": "831", "resolucion_actualizacion": "831", "fecha_inicio": "11-08-2025", "fecha_fin": "2030-08-11", "presidente": "VICTOR DANIEL MERLANO TAMARA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR DANIEL MERLANO TAMARA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 831 / actualización Nº 831. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123946477', phone),
      email       = COALESCE('flclanofc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "831", "resolucion_actualizacion": "831", "fecha_inicio": "11-08-2025", "fecha_fin": "2030-08-11", "presidente": "VICTOR DANIEL MERLANO TAMARA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fl-clan-futbol-club-831';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3123946477', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA FUNDACION SALUDCLUB  (IDRD-CLUB-de-la-fundacion-saludclub-676)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-fundacion-saludclub-676';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA FUNDACION SALUDCLUB',
      'Presidente: ANA CAROLINA NUNCIRA CRISTANCHO. Deporte(s): Voleibol, Fútbol, Patinaje, Natación, Baloncesto. Localidad: Engativá. Resolución R-D Nº 676. Vigente hasta 2026-09-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3124826513',
      NULL,
      ARRAY['Voleibol','Fútbol','Patinaje','Natación','Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-fundacion-saludclub-676',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-fundacion-saludclub-676', v_school_id, '{"resolucion_rd": "676", "resolucion_actualizacion": null, "fecha_inicio": "02-09-2021", "fecha_fin": "2026-09-02", "presidente": "ANA CAROLINA NUNCIRA CRISTANCHO", "localidad": "Engativá", "sports": ["Voleibol", "Fútbol", "Patinaje", "Natación", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA CAROLINA NUNCIRA CRISTANCHO. Deporte(s): Voleibol, Fútbol, Patinaje, Natación, Baloncesto. Localidad: Engativá. Resolución R-D Nº 676. Vigente hasta 2026-09-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124826513', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Voleibol','Fútbol','Patinaje','Natación','Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "676", "resolucion_actualizacion": null, "fecha_inicio": "02-09-2021", "fecha_fin": "2026-09-02", "presidente": "ANA CAROLINA NUNCIRA CRISTANCHO", "localidad": "Engativá", "sports": ["Voleibol", "Fútbol", "Patinaje", "Natación", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-fundacion-saludclub-676';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3124826513', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ASOCIACIÃN CRISTIANA DEPORTIVA DE COLOMBIA  (IDRD-CLUB-asociacian-cristiana-deportiva-de-colomb-674)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-asociacian-cristiana-deportiva-de-colomb-674';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ASOCIACIÃN CRISTIANA DEPORTIVA DE COLOMBIA',
      'Presidente: CHRISTIAN DAVID MARCELLA ROLDAN. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 674. Vigente hasta 2026-09-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '7270725',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'asociacian-cristiana-deportiva-de-colomb-674',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-asociacian-cristiana-deportiva-de-colomb-674', v_school_id, '{"resolucion_rd": "674", "resolucion_actualizacion": null, "fecha_inicio": "02-09-2021", "fecha_fin": "2026-09-02", "presidente": "CHRISTIAN DAVID MARCELLA ROLDAN", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CHRISTIAN DAVID MARCELLA ROLDAN. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 674. Vigente hasta 2026-09-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7270725', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "674", "resolucion_actualizacion": null, "fecha_inicio": "02-09-2021", "fecha_fin": "2026-09-02", "presidente": "CHRISTIAN DAVID MARCELLA ROLDAN", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-asociacian-cristiana-deportiva-de-colomb-674';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '7270725', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE ATLETISMO FUNDEFON  (IDRD-CLUB-club-de-atletismo-fundefon-725)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-atletismo-fundefon-725';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE ATLETISMO FUNDEFON',
      'Presidente: DANIEL IBARGUEN MOSQUERA. Deporte(s): Atletismo. Localidad: Fontibón. Resolución R-D Nº 725. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3138318798',
      'daniibarguen@hotmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-atletismo-fundefon-725',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-atletismo-fundefon-725', v_school_id, '{"resolucion_rd": "725", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "DANIEL IBARGUEN MOSQUERA", "localidad": "Fontibón", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL IBARGUEN MOSQUERA. Deporte(s): Atletismo. Localidad: Fontibón. Resolución R-D Nº 725. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138318798', phone),
      email       = COALESCE('daniibarguen@hotmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "725", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "DANIEL IBARGUEN MOSQUERA", "localidad": "Fontibón", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-atletismo-fundefon-725';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3138318798', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PARRANQUEROS CANYONING CLUB BOGOTA  (IDRD-CLUB-club-deportivo-parranqueros-canyoning-cl-407)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-parranqueros-canyoning-cl-407';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PARRANQUEROS CANYONING CLUB BOGOTA',
      'Presidente: HILDA CRISTINA MARIACA OROZCO. Deporte(s): Montaã±A Y Escalada. Localidad: Chapinero. Resolución R-D Nº 407. Vigente hasta 2029-04-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3138916177',
      'parranquerosclub@gmail.com',
      ARRAY['Montaã±A Y Escalada']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-parranqueros-canyoning-cl-407',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-parranqueros-canyoning-cl-407', v_school_id, '{"resolucion_rd": "407", "resolucion_actualizacion": null, "fecha_inicio": "05-04-2024", "fecha_fin": "2029-04-05", "presidente": "HILDA CRISTINA MARIACA OROZCO", "localidad": "Chapinero", "sports": ["Montaã±A Y Escalada"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HILDA CRISTINA MARIACA OROZCO. Deporte(s): Montaã±A Y Escalada. Localidad: Chapinero. Resolución R-D Nº 407. Vigente hasta 2029-04-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138916177', phone),
      email       = COALESCE('parranquerosclub@gmail.com', email),
      sports      = ARRAY['Montaã±A Y Escalada']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "407", "resolucion_actualizacion": null, "fecha_inicio": "05-04-2024", "fecha_fin": "2029-04-05", "presidente": "HILDA CRISTINA MARIACA OROZCO", "localidad": "Chapinero", "sports": ["Montaã±A Y Escalada"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-parranqueros-canyoning-cl-407';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3138916177', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTBOLMANIA  (IDRD-CLUB-futbolmania-723)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futbolmania-723';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTBOLMANIA',
      'Presidente: FABIO ALFONSO QUIJANO ESCOBAR. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 723. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3103499256',
      'rquijanog@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futbolmania-723',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futbolmania-723', v_school_id, '{"resolucion_rd": "723", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "FABIO ALFONSO QUIJANO ESCOBAR", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIO ALFONSO QUIJANO ESCOBAR. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 723. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103499256', phone),
      email       = COALESCE('rquijanog@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "723", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "FABIO ALFONSO QUIJANO ESCOBAR", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futbolmania-723';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3103499256', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTBOLZ1C0  (IDRD-CLUB-futbolz1c0-1187)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futbolz1c0-1187';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTBOLZ1C0',
      'Presidente: BAYRON GIOVANNY MAMBI CASTAÃâEDA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1187. Vigente hasta 2026-12-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3165088090',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futbolz1c0-1187',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futbolz1c0-1187', v_school_id, '{"resolucion_rd": "1187", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2021", "fecha_fin": "2026-12-27", "presidente": "BAYRON GIOVANNY MAMBI CASTAÃâEDA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BAYRON GIOVANNY MAMBI CASTAÃâEDA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1187. Vigente hasta 2026-12-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165088090', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1187", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2021", "fecha_fin": "2026-12-27", "presidente": "BAYRON GIOVANNY MAMBI CASTAÃâEDA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futbolz1c0-1187';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3165088090', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTURO COLOMBIA  (IDRD-CLUB-futuro-colombia-1299)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futuro-colombia-1299';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTURO COLOMBIA',
      'Presidente: CRISTIAN FELIPE PEDRAZA RUIZ,. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1299. Vigente hasta 2028-10-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3102060439',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futuro-colombia-1299',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futuro-colombia-1299', v_school_id, '{"resolucion_rd": "1299", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2023", "fecha_fin": "2028-10-24", "presidente": "CRISTIAN FELIPE PEDRAZA RUIZ,", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN FELIPE PEDRAZA RUIZ,. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1299. Vigente hasta 2028-10-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102060439', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1299", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2023", "fecha_fin": "2028-10-24", "presidente": "CRISTIAN FELIPE PEDRAZA RUIZ,", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futuro-colombia-1299';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3102060439', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTUROS TALENTOS  (IDRD-CLUB-futuros-talentos-083)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futuros-talentos-083';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTUROS TALENTOS',
      'Presidente: CESAR ANDRES VALLEJO BURGOS. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 083. Vigente hasta 2028-02-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3183838675',
      'futuros_talentos@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futuros-talentos-083',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futuros-talentos-083', v_school_id, '{"resolucion_rd": "083", "resolucion_actualizacion": null, "fecha_inicio": "13-02-2023", "fecha_fin": "2028-02-13", "presidente": "CESAR ANDRES VALLEJO BURGOS", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR ANDRES VALLEJO BURGOS. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 083. Vigente hasta 2028-02-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183838675', phone),
      email       = COALESCE('futuros_talentos@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "083", "resolucion_actualizacion": null, "fecha_inicio": "13-02-2023", "fecha_fin": "2028-02-13", "presidente": "CESAR ANDRES VALLEJO BURGOS", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futuros-talentos-083';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3183838675', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GACELAS KENNEDY  (IDRD-CLUB-gacelas-kennedy-1636)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gacelas-kennedy-1636';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GACELAS KENNEDY',
      'Presidente: DEISY YAMILE MARQUEZ. Deporte(s): Atletismo. Localidad: Bosa. Resolución R-D Nº 1636. Vigente hasta 2027-12-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3186094981',
      NULL,
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gacelas-kennedy-1636',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gacelas-kennedy-1636', v_school_id, '{"resolucion_rd": "1636", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2022", "fecha_fin": "2027-12-14", "presidente": "DEISY YAMILE MARQUEZ", "localidad": "Bosa", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DEISY YAMILE MARQUEZ. Deporte(s): Atletismo. Localidad: Bosa. Resolución R-D Nº 1636. Vigente hasta 2027-12-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3186094981', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1636", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2022", "fecha_fin": "2027-12-14", "presidente": "DEISY YAMILE MARQUEZ", "localidad": "Bosa", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gacelas-kennedy-1636';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3186094981', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GATO PEREZ FUTBOL CLUB  (IDRD-CLUB-gato-perez-futbol-club-356)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gato-perez-futbol-club-356';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GATO PEREZ FUTBOL CLUB',
      'Presidente: RICARDO PEREZ TAMAYO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 356. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3103499256',
      'rgatoperez@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gato-perez-futbol-club-356',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gato-perez-futbol-club-356', v_school_id, '{"resolucion_rd": "356", "resolucion_actualizacion": null, "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "RICARDO PEREZ TAMAYO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICARDO PEREZ TAMAYO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 356. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103499256', phone),
      email       = COALESCE('rgatoperez@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "356", "resolucion_actualizacion": null, "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "RICARDO PEREZ TAMAYO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gato-perez-futbol-club-356';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3103499256', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GENERACION G  (IDRD-CLUB-generacion-g-242)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-generacion-g-242';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GENERACION G',
      'Presidente: EDWIN ALFONSO GUEVARA CABANILLAS,. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 242. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3012931535',
      'edwinpatinguevara@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'generacion-g-242',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-generacion-g-242', v_school_id, '{"resolucion_rd": "242", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "EDWIN ALFONSO GUEVARA CABANILLAS,", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN ALFONSO GUEVARA CABANILLAS,. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 242. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012931535', phone),
      email       = COALESCE('edwinpatinguevara@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "242", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "EDWIN ALFONSO GUEVARA CABANILLAS,", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-generacion-g-242';
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
-- CLUB DEPORTIVO KADIMA F.C.  (IDRD-CLUB-club-deportivo-kadima-fc-661)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kadima-fc-661';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KADIMA F.C.',
      'Presidente: EYLAHIN ALEXANDER CAMACHO ARIZA. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 661 / actualización Nº 309. Vigente hasta 2028-06-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3204620473',
      'clubkadimafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kadima-fc-661',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kadima-fc-661', v_school_id, '{"resolucion_rd": "661", "resolucion_actualizacion": "309", "fecha_inicio": "26-06-2023", "fecha_fin": "2028-06-25", "presidente": "EYLAHIN ALEXANDER CAMACHO ARIZA", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EYLAHIN ALEXANDER CAMACHO ARIZA. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 661 / actualización Nº 309. Vigente hasta 2028-06-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204620473', phone),
      email       = COALESCE('clubkadimafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "661", "resolucion_actualizacion": "309", "fecha_inicio": "26-06-2023", "fecha_fin": "2028-06-25", "presidente": "EYLAHIN ALEXANDER CAMACHO ARIZA", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kadima-fc-661';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3204620473', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GIGANTES BASKETBALL CLUB  (IDRD-CLUB-club-deportivo-gigantes-basketball-club-420)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-gigantes-basketball-club-420';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GIGANTES BASKETBALL CLUB',
      'Presidente: SUSAN ANDREA HERRERA PARDO. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 420. Vigente hasta 2029-04-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3183917492',
      'gigantesbasketballclub@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-gigantes-basketball-club-420',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-gigantes-basketball-club-420', v_school_id, '{"resolucion_rd": "420", "resolucion_actualizacion": null, "fecha_inicio": "09-04-2024", "fecha_fin": "2029-04-09", "presidente": "SUSAN ANDREA HERRERA PARDO", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SUSAN ANDREA HERRERA PARDO. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 420. Vigente hasta 2029-04-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183917492', phone),
      email       = COALESCE('gigantesbasketballclub@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "420", "resolucion_actualizacion": null, "fecha_inicio": "09-04-2024", "fecha_fin": "2029-04-09", "presidente": "SUSAN ANDREA HERRERA PARDO", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-gigantes-basketball-club-420';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3183917492', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GIMNASIA NADIA  (IDRD-CLUB-gimnasia-nadia-168)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gimnasia-nadia-168';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GIMNASIA NADIA',
      'Presidente: MARIA CONSUELO GONZALEZ CUESTA,. Deporte(s): Gimnasia. Localidad: Suba. Resolución R-D Nº 168 / actualización Nº 985. Vigente hasta 2027-03-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3115832684',
      NULL,
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gimnasia-nadia-168',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gimnasia-nadia-168', v_school_id, '{"resolucion_rd": "168", "resolucion_actualizacion": "985", "fecha_inicio": "30-03-2022", "fecha_fin": "2027-03-30", "presidente": "MARIA CONSUELO GONZALEZ CUESTA,", "localidad": "Suba", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA CONSUELO GONZALEZ CUESTA,. Deporte(s): Gimnasia. Localidad: Suba. Resolución R-D Nº 168 / actualización Nº 985. Vigente hasta 2027-03-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115832684', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "168", "resolucion_actualizacion": "985", "fecha_inicio": "30-03-2022", "fecha_fin": "2027-03-30", "presidente": "MARIA CONSUELO GONZALEZ CUESTA,", "localidad": "Suba", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gimnasia-nadia-168';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3115832684', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GIMNASTICO UNIVERSITARIO  (IDRD-CLUB-gimnastico-universitario-296)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gimnastico-universitario-296';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GIMNASTICO UNIVERSITARIO',
      'Presidente: JOHANNA ALEXANDRA MONROY GARZON. Deporte(s): Gimnasia. Localidad: Kennedy. Resolución R-D Nº 296. Vigente hasta 2027-03-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3162698599',
      'sandramilenamm@gmail.com',
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gimnastico-universitario-296',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gimnastico-universitario-296', v_school_id, '{"resolucion_rd": "296", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2022", "fecha_fin": "2027-03-31", "presidente": "JOHANNA ALEXANDRA MONROY GARZON", "localidad": "Kennedy", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANNA ALEXANDRA MONROY GARZON. Deporte(s): Gimnasia. Localidad: Kennedy. Resolución R-D Nº 296. Vigente hasta 2027-03-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3162698599', phone),
      email       = COALESCE('sandramilenamm@gmail.com', email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "296", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2022", "fecha_fin": "2027-03-31", "presidente": "JOHANNA ALEXANDRA MONROY GARZON", "localidad": "Kennedy", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gimnastico-universitario-296';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3162698599', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BULLS TEAM  (IDRD-CLUB-club-deportivo-bulls-team-1041)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bulls-team-1041';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BULLS TEAM',
      'Presidente: CARLOS EDUARDO LADINO BARRIGA. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1041. Vigente hasta 2030-09-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3133099020',
      'bullsteambogota@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bulls-team-1041',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bulls-team-1041', v_school_id, '{"resolucion_rd": "1041", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2025", "fecha_fin": "2030-09-25", "presidente": "CARLOS EDUARDO LADINO BARRIGA", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS EDUARDO LADINO BARRIGA. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1041. Vigente hasta 2030-09-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133099020', phone),
      email       = COALESCE('bullsteambogota@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1041", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2025", "fecha_fin": "2030-09-25", "presidente": "CARLOS EDUARDO LADINO BARRIGA", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bulls-team-1041';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3133099020', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GOL STAR  (IDRD-CLUB-club-deportivo-gol-star-806)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-gol-star-806';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GOL STAR',
      'Presidente: JULIETH MARIA HERRERA MEZA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 806. Vigente hasta 2030-08-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3102083777',
      'golstar_08@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-gol-star-806',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-gol-star-806', v_school_id, '{"resolucion_rd": "806", "resolucion_actualizacion": null, "fecha_inicio": "04-08-2025", "fecha_fin": "2030-08-04", "presidente": "JULIETH MARIA HERRERA MEZA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIETH MARIA HERRERA MEZA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 806. Vigente hasta 2030-08-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102083777', phone),
      email       = COALESCE('golstar_08@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "806", "resolucion_actualizacion": null, "fecha_inicio": "04-08-2025", "fecha_fin": "2030-08-04", "presidente": "JULIETH MARIA HERRERA MEZA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-gol-star-806';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3102083777', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GOLDEN  (IDRD-CLUB-club-deportivo-golden-1532)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-golden-1532';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GOLDEN',
      'Presidente: LEONOR PAOLA QUEVEDO TORRES. Deporte(s): Porrismo. Localidad: Usaquén. Resolución R-D Nº 1532. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3174380405',
      'admon@goldendanceacademy.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-golden-1532',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-golden-1532', v_school_id, '{"resolucion_rd": "1532", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "LEONOR PAOLA QUEVEDO TORRES", "localidad": "Usaquén", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEONOR PAOLA QUEVEDO TORRES. Deporte(s): Porrismo. Localidad: Usaquén. Resolución R-D Nº 1532. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174380405', phone),
      email       = COALESCE('admon@goldendanceacademy.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1532", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "LEONOR PAOLA QUEVEDO TORRES", "localidad": "Usaquén", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-golden-1532';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3174380405', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NIK  (IDRD-CLUB-club-deportivo-nik-1533)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-nik-1533';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NIK',
      'Presidente: PEDRO JAVIER FIERRO BONILLA. Deporte(s): Tenis de mesa. Localidad: Engativá. Resolución R-D Nº 1533. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3142318038',
      'pjfierrob@hotmail.com',
      ARRAY['Tenis de mesa']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-nik-1533',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-nik-1533', v_school_id, '{"resolucion_rd": "1533", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "PEDRO JAVIER FIERRO BONILLA", "localidad": "Engativá", "sports": ["Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO JAVIER FIERRO BONILLA. Deporte(s): Tenis de mesa. Localidad: Engativá. Resolución R-D Nº 1533. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142318038', phone),
      email       = COALESCE('pjfierrob@hotmail.com', email),
      sports      = ARRAY['Tenis de mesa']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1533", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "PEDRO JAVIER FIERRO BONILLA", "localidad": "Engativá", "sports": ["Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-nik-1533';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3142318038', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GUERREROS DE BOGOTA  (IDRD-CLUB-club-deportivo-guerreros-de-bogota-051)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-guerreros-de-bogota-051';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GUERREROS DE BOGOTA',
      'Presidente: SAUL EDUARDO LEON NUÃâEZ. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 051 / actualización Nº 644. Vigente hasta 2027-02-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3504584455',
      'clubguerrerosdebogota@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-guerreros-de-bogota-051',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-guerreros-de-bogota-051', v_school_id, '{"resolucion_rd": "051", "resolucion_actualizacion": "644", "fecha_inicio": "04-02-2022", "fecha_fin": "2027-02-04", "presidente": "SAUL EDUARDO LEON NUÃâEZ", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SAUL EDUARDO LEON NUÃâEZ. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 051 / actualización Nº 644. Vigente hasta 2027-02-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3504584455', phone),
      email       = COALESCE('clubguerrerosdebogota@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "051", "resolucion_actualizacion": "644", "fecha_inicio": "04-02-2022", "fecha_fin": "2027-02-04", "presidente": "SAUL EDUARDO LEON NUÃâEZ", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-guerreros-de-bogota-051';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3504584455', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HALAL  (IDRD-CLUB-club-deportivo-halal-1968)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-halal-1968';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HALAL',
      'Presidente: NESTOR DARIO VALDERRAMA CASTIBLANCO. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 1968. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3178940956',
      'admonhalal@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-halal-1968',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-halal-1968', v_school_id, '{"resolucion_rd": "1968", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "NESTOR DARIO VALDERRAMA CASTIBLANCO", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR DARIO VALDERRAMA CASTIBLANCO. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 1968. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3178940956', phone),
      email       = COALESCE('admonhalal@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1968", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "NESTOR DARIO VALDERRAMA CASTIBLANCO", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-halal-1968';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3178940956', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- HALCONES BOLO CLUB  (IDRD-CLUB-halcones-bolo-club-003)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-halcones-bolo-club-003';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'HALCONES BOLO CLUB',
      'Presidente: IVONNE VICTORIA AVENDAÃÆÃ¢â¬ËO FORERO. Deporte(s): Bowling. Localidad: Engativá. Resolución R-D Nº 003 / actualización Nº 095. Vigente hasta 2028-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '25004003164678781',
      NULL,
      ARRAY['Bowling']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'halcones-bolo-club-003',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-halcones-bolo-club-003', v_school_id, '{"resolucion_rd": "003", "resolucion_actualizacion": "095", "fecha_inicio": "16-01-2023", "fecha_fin": "2028-01-16", "presidente": "IVONNE VICTORIA AVENDAÃÆÃ¢â¬ËO FORERO", "localidad": "Engativá", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVONNE VICTORIA AVENDAÃÆÃ¢â¬ËO FORERO. Deporte(s): Bowling. Localidad: Engativá. Resolución R-D Nº 003 / actualización Nº 095. Vigente hasta 2028-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('25004003164678781', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Bowling']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "003", "resolucion_actualizacion": "095", "fecha_inicio": "16-01-2023", "fecha_fin": "2028-01-16", "presidente": "IVONNE VICTORIA AVENDAÃÆÃ¢â¬ËO FORERO", "localidad": "Engativá", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-halcones-bolo-club-003';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '25004003164678781', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- HALCONES J.A.M  (IDRD-CLUB-halcones-jam-304)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-halcones-jam-304';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'HALCONES J.A.M',
      'Presidente: WILSON AUGUSTO MONTOYA GARZON. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 304. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3106966671',
      'montoya@fundacion-social.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'halcones-jam-304',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-halcones-jam-304', v_school_id, '{"resolucion_rd": "304", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "WILSON AUGUSTO MONTOYA GARZON", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON AUGUSTO MONTOYA GARZON. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 304. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106966671', phone),
      email       = COALESCE('montoya@fundacion-social.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "304", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "WILSON AUGUSTO MONTOYA GARZON", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-halcones-jam-304';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3106966671', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HANUMAN KAI MUAY  (IDRD-CLUB-club-deportivo-hanuman-kai-muay-723)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-hanuman-kai-muay-723';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HANUMAN KAI MUAY',
      'Presidente: ÃSCAR OSWALDO BENAVIDES JR VELÃSQUEZ. Deporte(s): Muay Thai. Localidad: Engativá. Resolución R-D Nº 723. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3002129861',
      'clubhanumankaimuay@gmail.com',
      ARRAY['Muay Thai']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-hanuman-kai-muay-723',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-hanuman-kai-muay-723', v_school_id, '{"resolucion_rd": "723", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "ÃSCAR OSWALDO BENAVIDES JR VELÃSQUEZ", "localidad": "Engativá", "sports": ["Muay Thai"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ÃSCAR OSWALDO BENAVIDES JR VELÃSQUEZ. Deporte(s): Muay Thai. Localidad: Engativá. Resolución R-D Nº 723. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002129861', phone),
      email       = COALESCE('clubhanumankaimuay@gmail.com', email),
      sports      = ARRAY['Muay Thai']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "723", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "ÃSCAR OSWALDO BENAVIDES JR VELÃSQUEZ", "localidad": "Engativá", "sports": ["Muay Thai"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-hanuman-kai-muay-723';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3002129861', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HATOGRANDE GOLF Y TENIS COUNTRY CLUB  (IDRD-CLUB-club-deportivo-hatogrande-golf-y-tenis-c-229)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-hatogrande-golf-y-tenis-c-229';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HATOGRANDE GOLF Y TENIS COUNTRY CLUB',
      'Presidente: JORGE ANDRÃâ°S HIGUERA IRIARTE. Deporte(s): Billar, Bowling, Fútbol, Golf, Natación, Squash, Tenis. Localidad: Usaquén. Resolución R-D Nº 229 / actualización Nº 276. Vigente hasta 2028-03-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '612035931389223533112022886',
      'presidencia1@hatogrande.com.co',
      ARRAY['Billar','Bowling','Fútbol','Golf','Natación','Squash','Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-hatogrande-golf-y-tenis-c-229',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-hatogrande-golf-y-tenis-c-229', v_school_id, '{"resolucion_rd": "229", "resolucion_actualizacion": "276", "fecha_inicio": "20-03-2023", "fecha_fin": "2028-03-19", "presidente": "JORGE ANDRÃâ°S HIGUERA IRIARTE", "localidad": "Usaquén", "sports": ["Billar", "Bowling", "Fútbol", "Golf", "Natación", "Squash", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE ANDRÃâ°S HIGUERA IRIARTE. Deporte(s): Billar, Bowling, Fútbol, Golf, Natación, Squash, Tenis. Localidad: Usaquén. Resolución R-D Nº 229 / actualización Nº 276. Vigente hasta 2028-03-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('612035931389223533112022886', phone),
      email       = COALESCE('presidencia1@hatogrande.com.co', email),
      sports      = ARRAY['Billar','Bowling','Fútbol','Golf','Natación','Squash','Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "229", "resolucion_actualizacion": "276", "fecha_inicio": "20-03-2023", "fecha_fin": "2028-03-19", "presidente": "JORGE ANDRÃâ°S HIGUERA IRIARTE", "localidad": "Usaquén", "sports": ["Billar", "Bowling", "Fútbol", "Golf", "Natación", "Squash", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-hatogrande-golf-y-tenis-c-229';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '612035931389223533112022886', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CDI INDEPENDIENTE  (IDRD-CLUB-club-deportivo-cdi-independiente-1977)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cdi-independiente-1977';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CDI INDEPENDIENTE',
      'Presidente: WILLIAM ANATOLIO RODRIGUEZ ORTEGA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1977. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3213060529',
      'cd.independiente@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cdi-independiente-1977',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cdi-independiente-1977', v_school_id, '{"resolucion_rd": "1977", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "WILLIAM ANATOLIO RODRIGUEZ ORTEGA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM ANATOLIO RODRIGUEZ ORTEGA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1977. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213060529', phone),
      email       = COALESCE('cd.independiente@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1977", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "WILLIAM ANATOLIO RODRIGUEZ ORTEGA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cdi-independiente-1977';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3213060529', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE WU-SHU HUAN LONG  (IDRD-CLUB-de-wu-shu-huan-long-642)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-wu-shu-huan-long-642';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE WU-SHU HUAN LONG',
      'Presidente: LEONARDO PRIETO ABELLO. Deporte(s): Wushu. Localidad: Fontibón. Resolución R-D Nº 642. Vigente hasta 2027-06-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '2956728',
      'esarcarvajalsalamanca@gmail.com',
      ARRAY['Wushu']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-wu-shu-huan-long-642',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-wu-shu-huan-long-642', v_school_id, '{"resolucion_rd": "642", "resolucion_actualizacion": null, "fecha_inicio": "17-06-2022", "fecha_fin": "2027-06-17", "presidente": "LEONARDO PRIETO ABELLO", "localidad": "Fontibón", "sports": ["Wushu"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEONARDO PRIETO ABELLO. Deporte(s): Wushu. Localidad: Fontibón. Resolución R-D Nº 642. Vigente hasta 2027-06-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2956728', phone),
      email       = COALESCE('esarcarvajalsalamanca@gmail.com', email),
      sports      = ARRAY['Wushu']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "642", "resolucion_actualizacion": null, "fecha_inicio": "17-06-2022", "fecha_fin": "2027-06-17", "presidente": "LEONARDO PRIETO ABELLO", "localidad": "Fontibón", "sports": ["Wushu"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-wu-shu-huan-long-642';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '2956728', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- HWARANG-DO  (IDRD-CLUB-hwarang-do-285)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-hwarang-do-285';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'HWARANG-DO',
      'Presidente: JACQUELINE RODRIGUEZ ALMECIGA. Deporte(s): Taekwondo. Localidad: Engativá. Resolución R-D Nº 285. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3059144315',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'hwarang-do-285',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-hwarang-do-285', v_school_id, '{"resolucion_rd": "285", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "JACQUELINE RODRIGUEZ ALMECIGA", "localidad": "Engativá", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JACQUELINE RODRIGUEZ ALMECIGA. Deporte(s): Taekwondo. Localidad: Engativá. Resolución R-D Nº 285. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3059144315', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "285", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "JACQUELINE RODRIGUEZ ALMECIGA", "localidad": "Engativá", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-hwarang-do-285';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3059144315', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ILYEO KWAN  (IDRD-CLUB-ilyeo-kwan-702)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ilyeo-kwan-702';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ILYEO KWAN',
      'Presidente: MARCO ANTONIO RAMIREZ VIUCHE. Deporte(s): Taekwondo. Localidad: Tunjuelito. Resolución R-D Nº 702. Vigente hasta 2027-06-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '7788689',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ilyeo-kwan-702',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ilyeo-kwan-702', v_school_id, '{"resolucion_rd": "702", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2022", "fecha_fin": "2027-06-29", "presidente": "MARCO ANTONIO RAMIREZ VIUCHE", "localidad": "Tunjuelito", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCO ANTONIO RAMIREZ VIUCHE. Deporte(s): Taekwondo. Localidad: Tunjuelito. Resolución R-D Nº 702. Vigente hasta 2027-06-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7788689', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "702", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2022", "fecha_fin": "2027-06-29", "presidente": "MARCO ANTONIO RAMIREZ VIUCHE", "localidad": "Tunjuelito", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ilyeo-kwan-702';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '7788689', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO ESPIRITU DEPORTIVO  (IDRD-CLUB-club-deportivo-taekwondo-espiritu-deport-1113)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-espiritu-deport-1113';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO ESPIRITU DEPORTIVO',
      'Presidente: GELMAN ALEXANDER BERMUDEZ MARTINEZ. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1113 / actualización Nº 1527. Vigente hasta 2028-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3133850800',
      'club.espiritudeportivo.tkd@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-espiritu-deport-1113',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-espiritu-deport-1113', v_school_id, '{"resolucion_rd": "1113", "resolucion_actualizacion": "1527", "fecha_inicio": "25-09-2023", "fecha_fin": "2028-09-24", "presidente": "GELMAN ALEXANDER BERMUDEZ MARTINEZ", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GELMAN ALEXANDER BERMUDEZ MARTINEZ. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1113 / actualización Nº 1527. Vigente hasta 2028-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133850800', phone),
      email       = COALESCE('club.espiritudeportivo.tkd@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1113", "resolucion_actualizacion": "1527", "fecha_inicio": "25-09-2023", "fecha_fin": "2028-09-24", "presidente": "GELMAN ALEXANDER BERMUDEZ MARTINEZ", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-espiritu-deport-1113';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3133850800', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO INDEPENDIENTE NACIONAL  (IDRD-CLUB-club-deportivo-independiente-nacional-1302)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-independiente-nacional-1302';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO INDEPENDIENTE NACIONAL',
      'Presidente: MARCELA RAMIREZ RUIZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1302 / actualización Nº 1645. Vigente hasta 2027-10-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3115706635',
      'independientenacional@yahoo.es.',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-independiente-nacional-1302',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-independiente-nacional-1302', v_school_id, '{"resolucion_rd": "1302", "resolucion_actualizacion": "1645", "fecha_inicio": "21-10-2022", "fecha_fin": "2027-10-21", "presidente": "MARCELA RAMIREZ RUIZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCELA RAMIREZ RUIZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1302 / actualización Nº 1645. Vigente hasta 2027-10-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115706635', phone),
      email       = COALESCE('independientenacional@yahoo.es.', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1302", "resolucion_actualizacion": "1645", "fecha_inicio": "21-10-2022", "fecha_fin": "2027-10-21", "presidente": "MARCELA RAMIREZ RUIZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-independiente-nacional-1302';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3115706635', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AURINEGRO SURORIENTE F.C  (IDRD-CLUB-club-deportivo-aurinegro-suroriente-fc-61.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-aurinegro-suroriente-fc-61.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AURINEGRO SURORIENTE F.C',
      'Presidente: LIDA NATALIE BOHORQUEZ MONTAÃO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 61.0 / actualización Nº N/A. Vigente hasta 2029-02-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3057837861',
      'aurinegrosurorientefc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-aurinegro-suroriente-fc-61.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-aurinegro-suroriente-fc-61.0', v_school_id, '{"resolucion_rd": "61.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-02", "fecha_fin": "2029-02-02", "presidente": "LIDA NATALIE BOHORQUEZ MONTAÃO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LIDA NATALIE BOHORQUEZ MONTAÃO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 61.0 / actualización Nº N/A. Vigente hasta 2029-02-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057837861', phone),
      email       = COALESCE('aurinegrosurorientefc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "61.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-02", "fecha_fin": "2029-02-02", "presidente": "LIDA NATALIE BOHORQUEZ MONTAÃO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-aurinegro-suroriente-fc-61.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3057837861', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INTER DE BOGOTA (Futuras Estrellas)  (IDRD-CLUB-inter-de-bogota-futuras-estrellas-444)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-inter-de-bogota-futuras-estrellas-444';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INTER DE BOGOTA (Futuras Estrellas)',
      'Presidente: GENARO GUTIERREZ GAMBASICA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 444. Vigente hasta 2028-05-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3204266284',
      'interdebogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'inter-de-bogota-futuras-estrellas-444',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-inter-de-bogota-futuras-estrellas-444', v_school_id, '{"resolucion_rd": "444", "resolucion_actualizacion": null, "fecha_inicio": "02-05-2023", "fecha_fin": "2028-05-01", "presidente": "GENARO GUTIERREZ GAMBASICA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GENARO GUTIERREZ GAMBASICA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 444. Vigente hasta 2028-05-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204266284', phone),
      email       = COALESCE('interdebogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "444", "resolucion_actualizacion": null, "fecha_inicio": "02-05-2023", "fecha_fin": "2028-05-01", "presidente": "GENARO GUTIERREZ GAMBASICA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-inter-de-bogota-futuras-estrellas-444';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3204266284', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INTER MILAN FUTBOL CLUB  (IDRD-CLUB-inter-milan-futbol-club-787)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-inter-milan-futbol-club-787';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INTER MILAN FUTBOL CLUB',
      'Presidente: ELIZABETH PEÃÆÃâÃÂ¢Ã¢âÂ¬ÃÅA PERDOMO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 787 / actualización Nº 109. Vigente hasta 2026-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '8937267',
      'jjaigood@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'inter-milan-futbol-club-787',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-inter-milan-futbol-club-787', v_school_id, '{"resolucion_rd": "787", "resolucion_actualizacion": "109", "fecha_inicio": "05-10-2021", "fecha_fin": "2026-10-05", "presidente": "ELIZABETH PEÃÆÃâÃÂ¢Ã¢âÂ¬ÃÅA PERDOMO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELIZABETH PEÃÆÃâÃÂ¢Ã¢âÂ¬ÃÅA PERDOMO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 787 / actualización Nº 109. Vigente hasta 2026-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('8937267', phone),
      email       = COALESCE('jjaigood@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "787", "resolucion_actualizacion": "109", "fecha_inicio": "05-10-2021", "fecha_fin": "2026-10-05", "presidente": "ELIZABETH PEÃÆÃâÃÂ¢Ã¢âÂ¬ÃÅA PERDOMO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-inter-milan-futbol-club-787';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '8937267', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INTERNACIONAL HOCKEY BOGOTA  (IDRD-CLUB-internacional-hockey-bogota-1185)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-internacional-hockey-bogota-1185';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INTERNACIONAL HOCKEY BOGOTA',
      'Presidente: GUSTAVO EDUARDO RAMIREZ BOHORQUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1185. Vigente hasta 2026-12-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3017450381',
      'interbogotahockeyclub@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'internacional-hockey-bogota-1185',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-internacional-hockey-bogota-1185', v_school_id, '{"resolucion_rd": "1185", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2021", "fecha_fin": "2026-12-27", "presidente": "GUSTAVO EDUARDO RAMIREZ BOHORQUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GUSTAVO EDUARDO RAMIREZ BOHORQUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1185. Vigente hasta 2026-12-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017450381', phone),
      email       = COALESCE('interbogotahockeyclub@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1185", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2021", "fecha_fin": "2026-12-27", "presidente": "GUSTAVO EDUARDO RAMIREZ BOHORQUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-internacional-hockey-bogota-1185';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3017450381', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO INTERPAREDES AGUILA FC  (IDRD-CLUB-club-deportivo-interparedes-aguila-fc-1457)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-interparedes-aguila-fc-1457';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO INTERPAREDES AGUILA FC',
      'Presidente: JEISON ARTURO OCAMPO BORRAY. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1457. Vigente hasta 2029-10-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3103050353',
      'interparedesaguila@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-interparedes-aguila-fc-1457',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-interparedes-aguila-fc-1457', v_school_id, '{"resolucion_rd": "1457", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2024", "fecha_fin": "2029-10-25", "presidente": "JEISON ARTURO OCAMPO BORRAY", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISON ARTURO OCAMPO BORRAY. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1457. Vigente hasta 2029-10-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103050353', phone),
      email       = COALESCE('interparedesaguila@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1457", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2024", "fecha_fin": "2029-10-25", "presidente": "JEISON ARTURO OCAMPO BORRAY", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-interparedes-aguila-fc-1457';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3103050353', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INVERSIONES CALDERON VILLA DEL RIO  (IDRD-CLUB-inversiones-calderon-villa-del-rio-1381)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-inversiones-calderon-villa-del-rio-1381';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INVERSIONES CALDERON VILLA DEL RIO',
      'Presidente: NICOLAS CALDERON ROJAS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1381. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3124457633',
      'colachoescueladefutbol@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'inversiones-calderon-villa-del-rio-1381',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-inversiones-calderon-villa-del-rio-1381', v_school_id, '{"resolucion_rd": "1381", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "NICOLAS CALDERON ROJAS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS CALDERON ROJAS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1381. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124457633', phone),
      email       = COALESCE('colachoescueladefutbol@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1381", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "NICOLAS CALDERON ROJAS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-inversiones-calderon-villa-del-rio-1381';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3124457633', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO IVAN RENÃ VALENCIANO RECOL F.C.  (IDRD-CLUB-club-deportivo-ivan-rena-valenciano-reco-682)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ivan-rena-valenciano-reco-682';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO IVAN RENÃ VALENCIANO RECOL F.C.',
      'Presidente: JHOSET DE JESUS GUERRA HERNANDEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 682. Vigente hasta 2029-06-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3214858581',
      'ivanrenevalencianorecol@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ivan-rena-valenciano-reco-682',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ivan-rena-valenciano-reco-682', v_school_id, '{"resolucion_rd": "682", "resolucion_actualizacion": null, "fecha_inicio": "06-06-2024", "fecha_fin": "2029-06-06", "presidente": "JHOSET DE JESUS GUERRA HERNANDEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHOSET DE JESUS GUERRA HERNANDEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 682. Vigente hasta 2029-06-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214858581', phone),
      email       = COALESCE('ivanrenevalencianorecol@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "682", "resolucion_actualizacion": null, "fecha_inicio": "06-06-2024", "fecha_fin": "2029-06-06", "presidente": "JHOSET DE JESUS GUERRA HERNANDEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ivan-rena-valenciano-reco-682';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3214858581', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- J.A.C. BARRIO LA BONZANZA  (IDRD-CLUB-jac-barrio-la-bonzanza-1680)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jac-barrio-la-bonzanza-1680';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'J.A.C. BARRIO LA BONZANZA',
      'Presidente: OMAR CHAVES MORA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1680. Vigente hasta 2028-12-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '43060824306058',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jac-barrio-la-bonzanza-1680',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jac-barrio-la-bonzanza-1680', v_school_id, '{"resolucion_rd": "1680", "resolucion_actualizacion": null, "fecha_inicio": "28-12-2023", "fecha_fin": "2028-12-27", "presidente": "OMAR CHAVES MORA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OMAR CHAVES MORA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1680. Vigente hasta 2028-12-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('43060824306058', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1680", "resolucion_actualizacion": null, "fecha_inicio": "28-12-2023", "fecha_fin": "2028-12-27", "presidente": "OMAR CHAVES MORA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jac-barrio-la-bonzanza-1680';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '43060824306058', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JAGUARES RUGBY CLUB  (IDRD-CLUB-jaguares-rugby-club-988)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jaguares-rugby-club-988';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JAGUARES RUGBY CLUB',
      'Presidente: CAMILO ANDRES BERMUDEZ TORO. Deporte(s): Rugby. Localidad: Kennedy. Resolución R-D Nº 988 / actualización Nº 101. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3046032016',
      'secretaria.jaguares@gmail.com',
      ARRAY['Rugby']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jaguares-rugby-club-988',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jaguares-rugby-club-988', v_school_id, '{"resolucion_rd": "988", "resolucion_actualizacion": "101", "fecha_inicio": "05-08-2022", "fecha_fin": "2027-08-05", "presidente": "CAMILO ANDRES BERMUDEZ TORO", "localidad": "Kennedy", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ANDRES BERMUDEZ TORO. Deporte(s): Rugby. Localidad: Kennedy. Resolución R-D Nº 988 / actualización Nº 101. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3046032016', phone),
      email       = COALESCE('secretaria.jaguares@gmail.com', email),
      sports      = ARRAY['Rugby']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "988", "resolucion_actualizacion": "101", "fecha_inicio": "05-08-2022", "fecha_fin": "2027-08-05", "presidente": "CAMILO ANDRES BERMUDEZ TORO", "localidad": "Kennedy", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jaguares-rugby-club-988';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3046032016', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JIMMY VARGAS F.C.  (IDRD-CLUB-club-deportivo-jimmy-vargas-fc-1201)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jimmy-vargas-fc-1201';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JIMMY VARGAS F.C.',
      'Presidente: JOHAN CAMILO VARGAS MORENO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1201. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '77656443195762936',
      'clubdeportivojimmyvargasf.c@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jimmy-vargas-fc-1201',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jimmy-vargas-fc-1201', v_school_id, '{"resolucion_rd": "1201", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "JOHAN CAMILO VARGAS MORENO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHAN CAMILO VARGAS MORENO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1201. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('77656443195762936', phone),
      email       = COALESCE('clubdeportivojimmyvargasf.c@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1201", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "JOHAN CAMILO VARGAS MORENO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jimmy-vargas-fc-1201';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '77656443195762936', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB JOMPIBE FUTSALON  (IDRD-CLUB-club-jompibe-futsalon-507)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-jompibe-futsalon-507';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB JOMPIBE FUTSALON',
      'Presidente: JORGE MAURIOCIO PINILLA BELTRAN. Deporte(s): Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 507. Vigente hasta 2027-05-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '7027250',
      NULL,
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-jompibe-futsalon-507',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-jompibe-futsalon-507', v_school_id, '{"resolucion_rd": "507", "resolucion_actualizacion": null, "fecha_inicio": "20-05-2022", "fecha_fin": "2027-05-20", "presidente": "JORGE MAURIOCIO PINILLA BELTRAN", "localidad": "Kennedy", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE MAURIOCIO PINILLA BELTRAN. Deporte(s): Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 507. Vigente hasta 2027-05-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7027250', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "507", "resolucion_actualizacion": null, "fecha_inicio": "20-05-2022", "fecha_fin": "2027-05-20", "presidente": "JORGE MAURIOCIO PINILLA BELTRAN", "localidad": "Kennedy", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-jompibe-futsalon-507';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '7027250', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUANITO MORENO  (IDRD-CLUB-juanito-moreno-373)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-juanito-moreno-373';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUANITO MORENO',
      'Presidente: JUAN SEBASTIÃÂN MORENO RAMIREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 373 / actualización Nº 219. Vigente hasta 2027-04-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '69487783108127332',
      'clubjuanitomoreno@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'juanito-moreno-373',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-juanito-moreno-373', v_school_id, '{"resolucion_rd": "373", "resolucion_actualizacion": "219", "fecha_inicio": "26-04-2022", "fecha_fin": "2027-04-26", "presidente": "JUAN SEBASTIÃÂN MORENO RAMIREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIÃÂN MORENO RAMIREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 373 / actualización Nº 219. Vigente hasta 2027-04-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('69487783108127332', phone),
      email       = COALESCE('clubjuanitomoreno@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "373", "resolucion_actualizacion": "219", "fecha_inicio": "26-04-2022", "fecha_fin": "2027-04-26", "presidente": "JUAN SEBASTIÃÂN MORENO RAMIREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-juanito-moreno-373';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '69487783108127332', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUDO MASTER  (IDRD-CLUB-judo-master-355)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-judo-master-355';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUDO MASTER',
      'Presidente: ADRIANA CAROLINA INFANTE SABOGAL. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 355 / actualización Nº 1759. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3175846223',
      'judomasterbogotaoficial@gmail.com',
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'judo-master-355',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-judo-master-355', v_school_id, '{"resolucion_rd": "355", "resolucion_actualizacion": "1759", "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "ADRIANA CAROLINA INFANTE SABOGAL", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ADRIANA CAROLINA INFANTE SABOGAL. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 355 / actualización Nº 1759. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3175846223', phone),
      email       = COALESCE('judomasterbogotaoficial@gmail.com', email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "355", "resolucion_actualizacion": "1759", "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "ADRIANA CAROLINA INFANTE SABOGAL", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-judo-master-355';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3175846223', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUDOKAS FELICES  (IDRD-CLUB-judokas-felices-290)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-judokas-felices-290';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUDOKAS FELICES',
      'Presidente: AIXA CELENE ROJAS ALFONSO. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 290. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3005976229',
      'judokasfelicesbogota@gmail.com',
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'judokas-felices-290',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-judokas-felices-290', v_school_id, '{"resolucion_rd": "290", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "AIXA CELENE ROJAS ALFONSO", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AIXA CELENE ROJAS ALFONSO. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 290. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005976229', phone),
      email       = COALESCE('judokasfelicesbogota@gmail.com', email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "290", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "AIXA CELENE ROJAS ALFONSO", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-judokas-felices-290';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3005976229', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUGAR FL  (IDRD-CLUB-jugar-fl-1008)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jugar-fl-1008';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUGAR FL',
      'Presidente: JUAN PAULO GARCÃÂA BAYONA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1008. Vigente hasta 2027-09-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3204775171',
      'jugarfl@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jugar-fl-1008',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jugar-fl-1008', v_school_id, '{"resolucion_rd": "1008", "resolucion_actualizacion": null, "fecha_inicio": "07-09-2022", "fecha_fin": "2027-09-07", "presidente": "JUAN PAULO GARCÃÂA BAYONA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PAULO GARCÃÂA BAYONA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1008. Vigente hasta 2027-09-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204775171', phone),
      email       = COALESCE('jugarfl@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1008", "resolucion_actualizacion": null, "fecha_inicio": "07-09-2022", "fecha_fin": "2027-09-07", "presidente": "JUAN PAULO GARCÃÂA BAYONA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jugar-fl-1008';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3204775171', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KAPITOL SHOOT  (IDRD-CLUB-kapitol-shoot-748)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kapitol-shoot-748';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KAPITOL SHOOT',
      'Presidente: CARLOS SANCHEZ SOTOMAYOR. Deporte(s): Tiro deportivo. Localidad: Barrios Unidos. Resolución R-D Nº 748. Vigente hasta 2028-07-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3105012614',
      'kapitolshoot@yahoo.es',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kapitol-shoot-748',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kapitol-shoot-748', v_school_id, '{"resolucion_rd": "748", "resolucion_actualizacion": null, "fecha_inicio": "10-07-2023", "fecha_fin": "2028-07-09", "presidente": "CARLOS SANCHEZ SOTOMAYOR", "localidad": "Barrios Unidos", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS SANCHEZ SOTOMAYOR. Deporte(s): Tiro deportivo. Localidad: Barrios Unidos. Resolución R-D Nº 748. Vigente hasta 2028-07-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105012614', phone),
      email       = COALESCE('kapitolshoot@yahoo.es', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "748", "resolucion_actualizacion": null, "fecha_inicio": "10-07-2023", "fecha_fin": "2028-07-09", "presidente": "CARLOS SANCHEZ SOTOMAYOR", "localidad": "Barrios Unidos", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kapitol-shoot-748';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3105012614', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KATASAN  (IDRD-CLUB-katasan-766)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-katasan-766';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KATASAN',
      'Presidente: MAURICIO PUENTES FORERO. Deporte(s): Taekwondo. Localidad: Engativá. Resolución R-D Nº 766. Vigente hasta 2026-09-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3144230705',
      'maypufor60@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'katasan-766',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-katasan-766', v_school_id, '{"resolucion_rd": "766", "resolucion_actualizacion": null, "fecha_inicio": "28-09-2021", "fecha_fin": "2026-09-28", "presidente": "MAURICIO PUENTES FORERO", "localidad": "Engativá", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAURICIO PUENTES FORERO. Deporte(s): Taekwondo. Localidad: Engativá. Resolución R-D Nº 766. Vigente hasta 2026-09-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144230705', phone),
      email       = COALESCE('maypufor60@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "766", "resolucion_actualizacion": null, "fecha_inicio": "28-09-2021", "fecha_fin": "2026-09-28", "presidente": "MAURICIO PUENTES FORERO", "localidad": "Engativá", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-katasan-766';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3144230705', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KATIOS HOCKEY CLUB  (IDRD-CLUB-katios-hockey-club-218)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-katios-hockey-club-218';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KATIOS HOCKEY CLUB',
      'Presidente: AMPARO DEL SOCORRO URREGO VALDERRAMA. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 218 / actualización Nº 041. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3007505633',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'katios-hockey-club-218',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-katios-hockey-club-218', v_school_id, '{"resolucion_rd": "218", "resolucion_actualizacion": "041", "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "AMPARO DEL SOCORRO URREGO VALDERRAMA", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AMPARO DEL SOCORRO URREGO VALDERRAMA. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 218 / actualización Nº 041. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007505633', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "218", "resolucion_actualizacion": "041", "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "AMPARO DEL SOCORRO URREGO VALDERRAMA", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-katios-hockey-club-218';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3007505633', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TAEKWONDO KIYAP  (IDRD-CLUB-taekwondo-kiyap-1113)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taekwondo-kiyap-1113';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEKWONDO KIYAP',
      'Presidente: JENNY VIVIANA MOLINA BAQUERO,. Deporte(s): Taekwondo. Localidad: San Cristóbal. Resolución R-D Nº 1113. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3115158550',
      'vivianita901104@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taekwondo-kiyap-1113',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taekwondo-kiyap-1113', v_school_id, '{"resolucion_rd": "1113", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "JENNY VIVIANA MOLINA BAQUERO,", "localidad": "San Cristóbal", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNY VIVIANA MOLINA BAQUERO,. Deporte(s): Taekwondo. Localidad: San Cristóbal. Resolución R-D Nº 1113. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115158550', phone),
      email       = COALESCE('vivianita901104@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1113", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "JENNY VIVIANA MOLINA BAQUERO,", "localidad": "San Cristóbal", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taekwondo-kiyap-1113';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3115158550', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO IMPERIO FUTBOL CLUB  (IDRD-CLUB-club-deportivo-imperio-futbol-club-446)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-imperio-futbol-club-446';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO IMPERIO FUTBOL CLUB',
      'Presidente: PEDRO ALEJANDRO CABALLERO BERMUDEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 446. Vigente hasta 2029-04-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3507647213',
      'nelsongt@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-imperio-futbol-club-446',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-imperio-futbol-club-446', v_school_id, '{"resolucion_rd": "446", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2024", "fecha_fin": "2029-04-12", "presidente": "PEDRO ALEJANDRO CABALLERO BERMUDEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO ALEJANDRO CABALLERO BERMUDEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 446. Vigente hasta 2029-04-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3507647213', phone),
      email       = COALESCE('nelsongt@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "446", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2024", "fecha_fin": "2029-04-12", "presidente": "PEDRO ALEJANDRO CABALLERO BERMUDEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-imperio-futbol-club-446';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3507647213', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ASOCIACIÃâN LA CIMA CLUB DE GOLF  (IDRD-CLUB-asociaciaan-la-cima-club-de-golf-751)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-asociaciaan-la-cima-club-de-golf-751';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ASOCIACIÃâN LA CIMA CLUB DE GOLF',
      'Presidente: LUIS GABRIEL NIETO GARCIA. Deporte(s): Golf. Resolución R-D Nº 751. Vigente hasta 2026-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '6294150',
      'lgnglonf@outlook.com',
      ARRAY['Golf']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'asociaciaan-la-cima-club-de-golf-751',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-asociaciaan-la-cima-club-de-golf-751', v_school_id, '{"resolucion_rd": "751", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2021", "fecha_fin": "2026-09-24", "presidente": "LUIS GABRIEL NIETO GARCIA", "localidad": null, "sports": ["Golf"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS GABRIEL NIETO GARCIA. Deporte(s): Golf. Resolución R-D Nº 751. Vigente hasta 2026-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6294150', phone),
      email       = COALESCE('lgnglonf@outlook.com', email),
      sports      = ARRAY['Golf']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "751", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2021", "fecha_fin": "2026-09-24", "presidente": "LUIS GABRIEL NIETO GARCIA", "localidad": null, "sports": ["Golf"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-asociaciaan-la-cima-club-de-golf-751';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LEICESTER BOGOTA CITY  (IDRD-CLUB-club-deportivo-leicester-bogota-city-447)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-leicester-bogota-city-447';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LEICESTER BOGOTA CITY',
      'Presidente: MARCO ALEXANDER GANTIVA CAICEDO. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 447. Vigente hasta 2029-04-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3133096597',
      'leicesterbogotacity@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-leicester-bogota-city-447',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-leicester-bogota-city-447', v_school_id, '{"resolucion_rd": "447", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2024", "fecha_fin": "2029-04-12", "presidente": "MARCO ALEXANDER GANTIVA CAICEDO", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCO ALEXANDER GANTIVA CAICEDO. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 447. Vigente hasta 2029-04-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133096597', phone),
      email       = COALESCE('leicesterbogotacity@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "447", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2024", "fecha_fin": "2029-04-12", "presidente": "MARCO ALEXANDER GANTIVA CAICEDO", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-leicester-bogota-city-447';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3133096597', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA COMETA FUTBOL CLUB  (IDRD-CLUB-la-cometa-futbol-club-421)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-cometa-futbol-club-421';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA COMETA FUTBOL CLUB',
      'Presidente: ANTONIO GEOVANNI BARRETO GARZON. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 421 / actualización Nº 764. Vigente hasta 2028-05-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3132429141',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-cometa-futbol-club-421',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-cometa-futbol-club-421', v_school_id, '{"resolucion_rd": "421", "resolucion_actualizacion": "764", "fecha_inicio": "09-05-2023", "fecha_fin": "2028-05-08", "presidente": "ANTONIO GEOVANNI BARRETO GARZON", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANTONIO GEOVANNI BARRETO GARZON. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 421 / actualización Nº 764. Vigente hasta 2028-05-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132429141', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "421", "resolucion_actualizacion": "764", "fecha_inicio": "09-05-2023", "fecha_fin": "2028-05-08", "presidente": "ANTONIO GEOVANNI BARRETO GARZON", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-cometa-futbol-club-421';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3132429141', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA MASIA  (IDRD-CLUB-la-masia-788)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-masia-788';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA MASIA',
      'Presidente: JANNER PUENTES BARON. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 788. Vigente hasta 2026-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3133305329',
      'jannerpuenba_93@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-masia-788',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-masia-788', v_school_id, '{"resolucion_rd": "788", "resolucion_actualizacion": null, "fecha_inicio": "05-10-2021", "fecha_fin": "2026-10-05", "presidente": "JANNER PUENTES BARON", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JANNER PUENTES BARON. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 788. Vigente hasta 2026-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133305329', phone),
      email       = COALESCE('jannerpuenba_93@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "788", "resolucion_actualizacion": null, "fecha_inicio": "05-10-2021", "fecha_fin": "2026-10-05", "presidente": "JANNER PUENTES BARON", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-masia-788';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3133305329', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA PAZ  (IDRD-CLUB-club-deportivo-la-paz-362)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-paz-362';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA PAZ',
      'Presidente: WILLIAM TALERO MORA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 362. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '5994472',
      'clublapaz@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-paz-362',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-paz-362', v_school_id, '{"resolucion_rd": "362", "resolucion_actualizacion": null, "fecha_inicio": "22-03-2024", "fecha_fin": "2029-03-22", "presidente": "WILLIAM TALERO MORA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM TALERO MORA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 362. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5994472', phone),
      email       = COALESCE('clublapaz@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "362", "resolucion_actualizacion": null, "fecha_inicio": "22-03-2024", "fecha_fin": "2029-03-22", "presidente": "WILLIAM TALERO MORA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-paz-362';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '5994472', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA PRADERA DE POTOSI CLUB RESIDENCIAL  (IDRD-CLUB-club-deportivo-la-pradera-de-potosi-club-1673)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-pradera-de-potosi-club-1673';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA PRADERA DE POTOSI CLUB RESIDENCIAL',
      'Presidente: ALEJANDRO CHARRIA MARTÃÂNEZ. Deporte(s): Ecuestre, Tenis, Golf, Esqui, Fútbol, Bowling, Natación, Squash. Localidad: Chapinero. Resolución R-D Nº 1673 / actualización Nº 1779. Vigente hasta 2027-12-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '8757777',
      'gerencia@clublapradera.com',
      ARRAY['Ecuestre','Tenis','Golf','Esqui','Fútbol','Bowling','Natación','Squash']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-pradera-de-potosi-club-1673',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-pradera-de-potosi-club-1673', v_school_id, '{"resolucion_rd": "1673", "resolucion_actualizacion": "1779", "fecha_inicio": "28-12-2022", "fecha_fin": "2027-12-28", "presidente": "ALEJANDRO CHARRIA MARTÃÂNEZ", "localidad": "Chapinero", "sports": ["Ecuestre", "Tenis", "Golf", "Esqui", "Fútbol", "Bowling", "Natación", "Squash"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEJANDRO CHARRIA MARTÃÂNEZ. Deporte(s): Ecuestre, Tenis, Golf, Esqui, Fútbol, Bowling, Natación, Squash. Localidad: Chapinero. Resolución R-D Nº 1673 / actualización Nº 1779. Vigente hasta 2027-12-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('8757777', phone),
      email       = COALESCE('gerencia@clublapradera.com', email),
      sports      = ARRAY['Ecuestre','Tenis','Golf','Esqui','Fútbol','Bowling','Natación','Squash']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1673", "resolucion_actualizacion": "1779", "fecha_inicio": "28-12-2022", "fecha_fin": "2027-12-28", "presidente": "ALEJANDRO CHARRIA MARTÃÂNEZ", "localidad": "Chapinero", "sports": ["Ecuestre", "Tenis", "Golf", "Esqui", "Fútbol", "Bowling", "Natación", "Squash"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-pradera-de-potosi-club-1673';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '8757777', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA TRICOLOR COLOMBIA  (IDRD-CLUB-la-tricolor-colombia-846)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-tricolor-colombia-846';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA TRICOLOR COLOMBIA',
      'Presidente: DANIEL SANTIAGO MONTAÃâO VELASQUEZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 846. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3137516502',
      'geslava@futurofutbol.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-tricolor-colombia-846',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-tricolor-colombia-846', v_school_id, '{"resolucion_rd": "846", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "DANIEL SANTIAGO MONTAÃâO VELASQUEZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL SANTIAGO MONTAÃâO VELASQUEZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 846. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3137516502', phone),
      email       = COALESCE('geslava@futurofutbol.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "846", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "DANIEL SANTIAGO MONTAÃâO VELASQUEZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-tricolor-colombia-846';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3137516502', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LEOPARDOS NEWELLÃÂ´S F.C.  (IDRD-CLUB-club-deportivo-leopardos-newellaa-s-fc-733)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-leopardos-newellaa-s-fc-733';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LEOPARDOS NEWELLÃÂ´S F.C.',
      'Presidente: JUAN DANIEL CARDENAS ORTIZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 733 / actualización Nº 1787. Vigente hasta 2026-10-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3195099278',
      'leopardosnewellsfs@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-leopardos-newellaa-s-fc-733',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-leopardos-newellaa-s-fc-733', v_school_id, '{"resolucion_rd": "733", "resolucion_actualizacion": "1787", "fecha_inicio": "08-10-2021", "fecha_fin": "2026-10-08", "presidente": "JUAN DANIEL CARDENAS ORTIZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN DANIEL CARDENAS ORTIZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 733 / actualización Nº 1787. Vigente hasta 2026-10-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195099278', phone),
      email       = COALESCE('leopardosnewellsfs@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "733", "resolucion_actualizacion": "1787", "fecha_inicio": "08-10-2021", "fecha_fin": "2026-10-08", "presidente": "JUAN DANIEL CARDENAS ORTIZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-leopardos-newellaa-s-fc-733';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3195099278', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LEVPESAS BOGOTÃ  (IDRD-CLUB-club-deportivo-levpesas-bogota-1036)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-levpesas-bogota-1036';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LEVPESAS BOGOTÃ',
      'Presidente: FREDY YAMIT PINILLA QUINCHIA. Deporte(s): Levantamiento De Pesas. Localidad: Kennedy. Resolución R-D Nº 1036. Vigente hasta 2029-08-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3185309504',
      'clublevpesasbogota@gmail.com',
      ARRAY['Levantamiento De Pesas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-levpesas-bogota-1036',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-levpesas-bogota-1036', v_school_id, '{"resolucion_rd": "1036", "resolucion_actualizacion": null, "fecha_inicio": "02-08-2024", "fecha_fin": "2029-08-02", "presidente": "FREDY YAMIT PINILLA QUINCHIA", "localidad": "Kennedy", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDY YAMIT PINILLA QUINCHIA. Deporte(s): Levantamiento De Pesas. Localidad: Kennedy. Resolución R-D Nº 1036. Vigente hasta 2029-08-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3185309504', phone),
      email       = COALESCE('clublevpesasbogota@gmail.com', email),
      sports      = ARRAY['Levantamiento De Pesas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1036", "resolucion_actualizacion": null, "fecha_inicio": "02-08-2024", "fecha_fin": "2029-08-02", "presidente": "FREDY YAMIT PINILLA QUINCHIA", "localidad": "Kennedy", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-levpesas-bogota-1036';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3185309504', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LINCE  (IDRD-CLUB-lince-243)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-lince-243';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LINCE',
      'Presidente: ASTRID VANESSA DAZA LONDOÃâO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 243. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3112013725',
      'clublincebogota@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'lince-243',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-lince-243', v_school_id, '{"resolucion_rd": "243", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "ASTRID VANESSA DAZA LONDOÃâO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ASTRID VANESSA DAZA LONDOÃâO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 243. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112013725', phone),
      email       = COALESCE('clublincebogota@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "243", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "ASTRID VANESSA DAZA LONDOÃâO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-lince-243';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3112013725', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOS AMIGOS  (IDRD-CLUB-club-deportivo-los-amigos-052)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-amigos-052';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOS AMIGOS',
      'Presidente: CARLOS AUGUSTO VALLEJO BAYONA. Deporte(s): Tiro deportivo. Localidad: Usaquén. Resolución R-D Nº 052 / actualización Nº 1320. Vigente hasta 2027-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3107913931',
      'secretaria@ckpconsultores.com',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-los-amigos-052',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-los-amigos-052', v_school_id, '{"resolucion_rd": "052", "resolucion_actualizacion": "1320", "fecha_inicio": "07-02-2022", "fecha_fin": "2027-02-07", "presidente": "CARLOS AUGUSTO VALLEJO BAYONA", "localidad": "Usaquén", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS AUGUSTO VALLEJO BAYONA. Deporte(s): Tiro deportivo. Localidad: Usaquén. Resolución R-D Nº 052 / actualización Nº 1320. Vigente hasta 2027-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107913931', phone),
      email       = COALESCE('secretaria@ckpconsultores.com', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "052", "resolucion_actualizacion": "1320", "fecha_inicio": "07-02-2022", "fecha_fin": "2027-02-07", "presidente": "CARLOS AUGUSTO VALLEJO BAYONA", "localidad": "Usaquén", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-amigos-052';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3107913931', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LOS LAGARTOS  (IDRD-CLUB-los-lagartos-1185)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-los-lagartos-1185';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LOS LAGARTOS',
      'Presidente: JAIME ANTONIO BAENA PALACIOS. Deporte(s): Bridge, Esqui, Fútbol, Golf, Natación, Squash, Tenis. Localidad: Suba. Resolución R-D Nº 1185. Vigente hasta 2027-09-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6438800',
      NULL,
      ARRAY['Bridge','Esqui','Fútbol','Golf','Natación','Squash','Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'los-lagartos-1185',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-los-lagartos-1185', v_school_id, '{"resolucion_rd": "1185", "resolucion_actualizacion": null, "fecha_inicio": "29-09-2022", "fecha_fin": "2027-09-29", "presidente": "JAIME ANTONIO BAENA PALACIOS", "localidad": "Suba", "sports": ["Bridge", "Esqui", "Fútbol", "Golf", "Natación", "Squash", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIME ANTONIO BAENA PALACIOS. Deporte(s): Bridge, Esqui, Fútbol, Golf, Natación, Squash, Tenis. Localidad: Suba. Resolución R-D Nº 1185. Vigente hasta 2027-09-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6438800', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Bridge','Esqui','Fútbol','Golf','Natación','Squash','Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1185", "resolucion_actualizacion": null, "fecha_inicio": "29-09-2022", "fecha_fin": "2027-09-29", "presidente": "JAIME ANTONIO BAENA PALACIOS", "localidad": "Suba", "sports": ["Bridge", "Esqui", "Fútbol", "Golf", "Natación", "Squash", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-los-lagartos-1185';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6438800', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LOS TRES DRAGONES  (IDRD-CLUB-los-tres-dragones-1822)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-los-tres-dragones-1822';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LOS TRES DRAGONES',
      'Presidente: CLAUDIA PATRICIA PILONIETA CAMACHO. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1822. Vigente hasta 2028-01-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6036228',
      'tresdragonesbogota@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'los-tres-dragones-1822',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-los-tres-dragones-1822', v_school_id, '{"resolucion_rd": "1822", "resolucion_actualizacion": null, "fecha_inicio": "05-01-2023", "fecha_fin": "2028-01-05", "presidente": "CLAUDIA PATRICIA PILONIETA CAMACHO", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA PATRICIA PILONIETA CAMACHO. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1822. Vigente hasta 2028-01-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6036228', phone),
      email       = COALESCE('tresdragonesbogota@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1822", "resolucion_actualizacion": null, "fecha_inicio": "05-01-2023", "fecha_fin": "2028-01-05", "presidente": "CLAUDIA PATRICIA PILONIETA CAMACHO", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-los-tres-dragones-1822';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6036228', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LOS VEINTE  (IDRD-CLUB-los-veinte-743)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-los-veinte-743';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LOS VEINTE',
      'Presidente: JOSÃÆÃ¢â¬Â° RAMÃÆÃ¢â¬ÅN CÃÆÃÂRDENAS VANEGAS. Deporte(s): Bowling. Localidad: Engativá. Resolución R-D Nº 743. Vigente hasta 2028-07-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3107695723',
      'clubdeboloslos20@yahoo.com',
      ARRAY['Bowling']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'los-veinte-743',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-los-veinte-743', v_school_id, '{"resolucion_rd": "743", "resolucion_actualizacion": null, "fecha_inicio": "10-07-2023", "fecha_fin": "2028-07-09", "presidente": "JOSÃÆÃ¢â¬Â° RAMÃÆÃ¢â¬ÅN CÃÆÃÂRDENAS VANEGAS", "localidad": "Engativá", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃÆÃ¢â¬Â° RAMÃÆÃ¢â¬ÅN CÃÆÃÂRDENAS VANEGAS. Deporte(s): Bowling. Localidad: Engativá. Resolución R-D Nº 743. Vigente hasta 2028-07-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107695723', phone),
      email       = COALESCE('clubdeboloslos20@yahoo.com', email),
      sports      = ARRAY['Bowling']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "743", "resolucion_actualizacion": null, "fecha_inicio": "10-07-2023", "fecha_fin": "2028-07-09", "presidente": "JOSÃÆÃ¢â¬Â° RAMÃÆÃ¢â¬ÅN CÃÆÃÂRDENAS VANEGAS", "localidad": "Engativá", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-los-veinte-743';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3107695723', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KART WORLD CHAMPIONSHIP COLOMBIA  (IDRD-CLUB-club-deportivo-kart-world-championship-c-982)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kart-world-championship-c-982';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KART WORLD CHAMPIONSHIP COLOMBIA',
      'Presidente: ANGELICA MARCELA RODRÃÂGUEZ MORALES. Deporte(s): Karts. Localidad: Engativá. Resolución R-D Nº 982. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3177762127',
      'kwc.colombia@gmail.com',
      ARRAY['Karts']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kart-world-championship-c-982',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kart-world-championship-c-982', v_school_id, '{"resolucion_rd": "982", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "ANGELICA MARCELA RODRÃÂGUEZ MORALES", "localidad": "Engativá", "sports": ["Karts"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELICA MARCELA RODRÃÂGUEZ MORALES. Deporte(s): Karts. Localidad: Engativá. Resolución R-D Nº 982. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3177762127', phone),
      email       = COALESCE('kwc.colombia@gmail.com', email),
      sports      = ARRAY['Karts']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "982", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "ANGELICA MARCELA RODRÃÂGUEZ MORALES", "localidad": "Engativá", "sports": ["Karts"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kart-world-championship-c-982';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3177762127', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FLORIDA SKATE  (IDRD-CLUB-club-deportivo-florida-skate-1361)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-florida-skate-1361';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FLORIDA SKATE',
      'Presidente: SANTIAGO ANDRES BENAVIDES RODRIGUEZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1361. Vigente hasta 2030-11-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3142168238',
      'proskflorida77@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-florida-skate-1361',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-florida-skate-1361', v_school_id, '{"resolucion_rd": "1361", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2025", "fecha_fin": "2030-11-24", "presidente": "SANTIAGO ANDRES BENAVIDES RODRIGUEZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO ANDRES BENAVIDES RODRIGUEZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1361. Vigente hasta 2030-11-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142168238', phone),
      email       = COALESCE('proskflorida77@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1361", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2025", "fecha_fin": "2030-11-24", "presidente": "SANTIAGO ANDRES BENAVIDES RODRIGUEZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-florida-skate-1361';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3142168238', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MAKAIRA  (IDRD-CLUB-makaira-291)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-makaira-291';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MAKAIRA',
      'Presidente: LAURA GARCÃÂA CHACÃâN. Deporte(s): Natación. Localidad: Kennedy. Resolución R-D Nº 291. Vigente hasta 2028-04-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '4541862',
      'clubdeportivomakaira@hotmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'makaira-291',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-makaira-291', v_school_id, '{"resolucion_rd": "291", "resolucion_actualizacion": null, "fecha_inicio": "06-04-2023", "fecha_fin": "2028-04-05", "presidente": "LAURA GARCÃÂA CHACÃâN", "localidad": "Kennedy", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LAURA GARCÃÂA CHACÃâN. Deporte(s): Natación. Localidad: Kennedy. Resolución R-D Nº 291. Vigente hasta 2028-04-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4541862', phone),
      email       = COALESCE('clubdeportivomakaira@hotmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "291", "resolucion_actualizacion": null, "fecha_inicio": "06-04-2023", "fecha_fin": "2028-04-05", "presidente": "LAURA GARCÃÂA CHACÃâN", "localidad": "Kennedy", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-makaira-291';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '4541862', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MAKAWUA  (IDRD-CLUB-club-deportivo-makawua-726)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-makawua-726';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MAKAWUA',
      'Presidente: ANDREA CAROLINA BUELVAS HERRERA. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 726 / actualización Nº 726. Vigente hasta 2029-04-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3013403573',
      'makawua@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-makawua-726',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-makawua-726', v_school_id, '{"resolucion_rd": "726", "resolucion_actualizacion": "726", "fecha_inicio": "24-04-2024", "fecha_fin": "2029-04-24", "presidente": "ANDREA CAROLINA BUELVAS HERRERA", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDREA CAROLINA BUELVAS HERRERA. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 726 / actualización Nº 726. Vigente hasta 2029-04-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013403573', phone),
      email       = COALESCE('makawua@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "726", "resolucion_actualizacion": "726", "fecha_inicio": "24-04-2024", "fecha_fin": "2029-04-24", "presidente": "ANDREA CAROLINA BUELVAS HERRERA", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-makawua-726';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3013403573', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ACISCLO CORDOBA FC  (IDRD-CLUB-acisclo-cordoba-fc-753)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-acisclo-cordoba-fc-753';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ACISCLO CORDOBA FC',
      'Presidente: WILLIAM GUTIERREZ SANCHEZ,. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 753. Vigente hasta 2028-07-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3124004109',
      'corporacionkennedy@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'acisclo-cordoba-fc-753',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-acisclo-cordoba-fc-753', v_school_id, '{"resolucion_rd": "753", "resolucion_actualizacion": null, "fecha_inicio": "13-07-2023", "fecha_fin": "2028-07-12", "presidente": "WILLIAM GUTIERREZ SANCHEZ,", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM GUTIERREZ SANCHEZ,. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 753. Vigente hasta 2028-07-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124004109', phone),
      email       = COALESCE('corporacionkennedy@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "753", "resolucion_actualizacion": null, "fecha_inicio": "13-07-2023", "fecha_fin": "2028-07-12", "presidente": "WILLIAM GUTIERREZ SANCHEZ,", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-acisclo-cordoba-fc-753';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3124004109', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TENIS COACH  (IDRD-CLUB-tenis-coach-763)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tenis-coach-763';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TENIS COACH',
      'Presidente: LILIANA SULAY PEÃA SUAZO. Deporte(s): Tenis. Localidad: Usaquén. Resolución R-D Nº 763. Vigente hasta 2028-07-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3113615077',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tenis-coach-763',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tenis-coach-763', v_school_id, '{"resolucion_rd": "763", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2023", "fecha_fin": "2028-07-18", "presidente": "LILIANA SULAY PEÃA SUAZO", "localidad": "Usaquén", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LILIANA SULAY PEÃA SUAZO. Deporte(s): Tenis. Localidad: Usaquén. Resolución R-D Nº 763. Vigente hasta 2028-07-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3113615077', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "763", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2023", "fecha_fin": "2028-07-18", "presidente": "LILIANA SULAY PEÃA SUAZO", "localidad": "Usaquén", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tenis-coach-763';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3113615077', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MATIZKAM KARATE DO  (IDRD-CLUB-matizkam-karate-do-103)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-matizkam-karate-do-103';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MATIZKAM KARATE DO',
      'Presidente: YANG LOUIS MATIZ GUTIERREZ,. Deporte(s): Karate. Localidad: Kennedy. Resolución R-D Nº 103. Vigente hasta 2027-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '73398893002196921',
      'alexarevalo_07@hotmail.com',
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'matizkam-karate-do-103',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-matizkam-karate-do-103', v_school_id, '{"resolucion_rd": "103", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2022", "fecha_fin": "2027-02-07", "presidente": "YANG LOUIS MATIZ GUTIERREZ,", "localidad": "Kennedy", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YANG LOUIS MATIZ GUTIERREZ,. Deporte(s): Karate. Localidad: Kennedy. Resolución R-D Nº 103. Vigente hasta 2027-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('73398893002196921', phone),
      email       = COALESCE('alexarevalo_07@hotmail.com', email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "103", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2022", "fecha_fin": "2027-02-07", "presidente": "YANG LOUIS MATIZ GUTIERREZ,", "localidad": "Kennedy", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-matizkam-karate-do-103';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '73398893002196921', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MC FUTSAL CITY  (IDRD-CLUB-mc-futsal-city-951)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-mc-futsal-city-951';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MC FUTSAL CITY',
      'Presidente: VICTOR MANUEL MORENO AVILA. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 951. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3203515483',
      'victormore44@hotmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'mc-futsal-city-951',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-mc-futsal-city-951', v_school_id, '{"resolucion_rd": "951", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "VICTOR MANUEL MORENO AVILA", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR MANUEL MORENO AVILA. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 951. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203515483', phone),
      email       = COALESCE('victormore44@hotmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "951", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "VICTOR MANUEL MORENO AVILA", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-mc-futsal-city-951';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3203515483', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CANDIRÃÅ¡  (IDRD-CLUB-club-deportivo-candiraa-763)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-candiraa-763';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CANDIRÃÅ¡',
      'Presidente: OSCAR MAURICIO SANCHEZ MARROQUIN. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 763 / actualización Nº 803. Vigente hasta 2026-10-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3006400653',
      'medusas.uwr@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-candiraa-763',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-candiraa-763', v_school_id, '{"resolucion_rd": "763", "resolucion_actualizacion": "803", "fecha_inicio": "15-10-2021", "fecha_fin": "2026-10-15", "presidente": "OSCAR MAURICIO SANCHEZ MARROQUIN", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR MAURICIO SANCHEZ MARROQUIN. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 763 / actualización Nº 803. Vigente hasta 2026-10-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006400653', phone),
      email       = COALESCE('medusas.uwr@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "763", "resolucion_actualizacion": "803", "fecha_inicio": "15-10-2021", "fecha_fin": "2026-10-15", "presidente": "OSCAR MAURICIO SANCHEZ MARROQUIN", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-candiraa-763';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3006400653', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MINOTAUROS U.M.N.G R.F.C  (IDRD-CLUB-minotauros-umng-rfc-720)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-minotauros-umng-rfc-720';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MINOTAUROS U.M.N.G R.F.C',
      'Presidente: OSCAR STEVEN FORERO FANDIÃâO. Deporte(s): Rugby. Localidad: Puente Aranda. Resolución R-D Nº 720. Vigente hasta 2027-07-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3014895985',
      'minotaurosrugby@gmail.com',
      ARRAY['Rugby']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'minotauros-umng-rfc-720',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-minotauros-umng-rfc-720', v_school_id, '{"resolucion_rd": "720", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2022", "fecha_fin": "2027-07-05", "presidente": "OSCAR STEVEN FORERO FANDIÃâO", "localidad": "Puente Aranda", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR STEVEN FORERO FANDIÃâO. Deporte(s): Rugby. Localidad: Puente Aranda. Resolución R-D Nº 720. Vigente hasta 2027-07-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3014895985', phone),
      email       = COALESCE('minotaurosrugby@gmail.com', email),
      sports      = ARRAY['Rugby']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "720", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2022", "fecha_fin": "2027-07-05", "presidente": "OSCAR STEVEN FORERO FANDIÃâO", "localidad": "Puente Aranda", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-minotauros-umng-rfc-720';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3014895985', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MONAGUILLOS DE SANTA FE CLUB DE FUTBOL  (IDRD-CLUB-monaguillos-de-santa-fe-club-de-futbol-847)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-monaguillos-de-santa-fe-club-de-futbol-847';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MONAGUILLOS DE SANTA FE CLUB DE FUTBOL',
      'Presidente: MAGDA YENITH ROMERO REYES. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 847. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '23659196106516',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'monaguillos-de-santa-fe-club-de-futbol-847',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-monaguillos-de-santa-fe-club-de-futbol-847', v_school_id, '{"resolucion_rd": "847", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "MAGDA YENITH ROMERO REYES", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAGDA YENITH ROMERO REYES. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 847. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('23659196106516', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "847", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "MAGDA YENITH ROMERO REYES", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-monaguillos-de-santa-fe-club-de-futbol-847';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '23659196106516', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MONSERRAT CLUB BAILE DPEORTIVO  (IDRD-CLUB-monserrat-club-baile-dpeortivo-1266)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-monserrat-club-baile-dpeortivo-1266';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MONSERRAT CLUB BAILE DPEORTIVO',
      'Presidente: MONICA ANDREA RICO CASTRO. Deporte(s): Baile Deportivo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1266 / actualización Nº 197. Vigente hasta 2028-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3203024297',
      'monserratclubdebailedeportivo@hotmail.com',
      ARRAY['Baile Deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'monserrat-club-baile-dpeortivo-1266',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-monserrat-club-baile-dpeortivo-1266', v_school_id, '{"resolucion_rd": "1266", "resolucion_actualizacion": "197", "fecha_inicio": "20-10-2023", "fecha_fin": "2028-10-19", "presidente": "MONICA ANDREA RICO CASTRO", "localidad": "Ciudad Bolívar", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MONICA ANDREA RICO CASTRO. Deporte(s): Baile Deportivo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1266 / actualización Nº 197. Vigente hasta 2028-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203024297', phone),
      email       = COALESCE('monserratclubdebailedeportivo@hotmail.com', email),
      sports      = ARRAY['Baile Deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1266", "resolucion_actualizacion": "197", "fecha_inicio": "20-10-2023", "fecha_fin": "2028-10-19", "presidente": "MONICA ANDREA RICO CASTRO", "localidad": "Ciudad Bolívar", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-monserrat-club-baile-dpeortivo-1266';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3203024297', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MONSERRATE CAR  (IDRD-CLUB-monserrate-car-1605)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-monserrate-car-1605';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MONSERRATE CAR',
      'Presidente: SANTIAGO ALEXANDER SUAREZ AMADO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1605. Vigente hasta 2027-12-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '54574473142224576',
      'carlosamado@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'monserrate-car-1605',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-monserrate-car-1605', v_school_id, '{"resolucion_rd": "1605", "resolucion_actualizacion": null, "fecha_inicio": "12-12-2022", "fecha_fin": "2027-12-12", "presidente": "SANTIAGO ALEXANDER SUAREZ AMADO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO ALEXANDER SUAREZ AMADO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1605. Vigente hasta 2027-12-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('54574473142224576', phone),
      email       = COALESCE('carlosamado@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1605", "resolucion_actualizacion": null, "fecha_inicio": "12-12-2022", "fecha_fin": "2027-12-12", "presidente": "SANTIAGO ALEXANDER SUAREZ AMADO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-monserrate-car-1605';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '54574473142224576', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MOSQUETEROS  (IDRD-CLUB-mosqueteros-898)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-mosqueteros-898';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MOSQUETEROS',
      'Presidente: JOSE ALEJANDRO ANZOLA ZAMUDIO. Deporte(s): Esgrima. Localidad: Kennedy. Resolución R-D Nº 898 / actualización Nº 355. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3102241443',
      'mosqueterosbogota@gmail.com',
      ARRAY['Esgrima']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'mosqueteros-898',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-mosqueteros-898', v_school_id, '{"resolucion_rd": "898", "resolucion_actualizacion": "355", "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "JOSE ALEJANDRO ANZOLA ZAMUDIO", "localidad": "Kennedy", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE ALEJANDRO ANZOLA ZAMUDIO. Deporte(s): Esgrima. Localidad: Kennedy. Resolución R-D Nº 898 / actualización Nº 355. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102241443', phone),
      email       = COALESCE('mosqueterosbogota@gmail.com', email),
      sports      = ARRAY['Esgrima']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "898", "resolucion_actualizacion": "355", "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "JOSE ALEJANDRO ANZOLA ZAMUDIO", "localidad": "Kennedy", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-mosqueteros-898';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3102241443', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MUISCAS HOCKEY CLUB  (IDRD-CLUB-muiscas-hockey-club-191)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-muiscas-hockey-club-191';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MUISCAS HOCKEY CLUB',
      'Presidente: DARIO ADOLFO AVILA BARBOSA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 191 / actualización Nº 268. Vigente hasta 2028-03-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '6014143453',
      'muiscashockey@msn.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'muiscas-hockey-club-191',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-muiscas-hockey-club-191', v_school_id, '{"resolucion_rd": "191", "resolucion_actualizacion": "268", "fecha_inicio": "08-03-2023", "fecha_fin": "2028-03-07", "presidente": "DARIO ADOLFO AVILA BARBOSA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DARIO ADOLFO AVILA BARBOSA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 191 / actualización Nº 268. Vigente hasta 2028-03-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6014143453', phone),
      email       = COALESCE('muiscashockey@msn.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "191", "resolucion_actualizacion": "268", "fecha_inicio": "08-03-2023", "fecha_fin": "2028-03-07", "presidente": "DARIO ADOLFO AVILA BARBOSA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-muiscas-hockey-club-191';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '6014143453', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NACIONAL DE ELECTRICOS  (IDRD-CLUB-club-deportivo-nacional-de-electricos-626)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-nacional-de-electricos-626';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NACIONAL DE ELECTRICOS',
      'Presidente: OSCAR HERNAN LUCENA LOZADA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 626 / actualización Nº 626. Vigente hasta 2029-05-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3105627694',
      'clubdeportivone@nalelectricos.com.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-nacional-de-electricos-626',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-nacional-de-electricos-626', v_school_id, '{"resolucion_rd": "626", "resolucion_actualizacion": "626", "fecha_inicio": "27-05-2024", "fecha_fin": "2029-05-27", "presidente": "OSCAR HERNAN LUCENA LOZADA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR HERNAN LUCENA LOZADA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 626 / actualización Nº 626. Vigente hasta 2029-05-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105627694', phone),
      email       = COALESCE('clubdeportivone@nalelectricos.com.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "626", "resolucion_actualizacion": "626", "fecha_inicio": "27-05-2024", "fecha_fin": "2029-05-27", "presidente": "OSCAR HERNAN LUCENA LOZADA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-nacional-de-electricos-626';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3105627694', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NARVALES CLUB DE NATACION  (IDRD-CLUB-narvales-club-de-natacion-1449)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-narvales-club-de-natacion-1449';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NARVALES CLUB DE NATACION',
      'Presidente: DIANA CAROLINA DIAZ LOPEZ. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 1449. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3132918997',
      'narvalescpdn@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'narvales-club-de-natacion-1449',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-narvales-club-de-natacion-1449', v_school_id, '{"resolucion_rd": "1449", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "DIANA CAROLINA DIAZ LOPEZ", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA CAROLINA DIAZ LOPEZ. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 1449. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132918997', phone),
      email       = COALESCE('narvalescpdn@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1449", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "DIANA CAROLINA DIAZ LOPEZ", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-narvales-club-de-natacion-1449';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3132918997', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NAUTICO MUÃA  (IDRD-CLUB-club-deportivo-nautico-muaa-981)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-nautico-muaa-981';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NAUTICO MUÃA',
      'Presidente: ALFREDO CARLO LAZARO AMORE PARDO. Deporte(s): Vela, Esqui. Localidad: Usaquén. Resolución R-D Nº 981 / actualización Nº 1275. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3112119443',
      'directoradministrativo@clubnauticomuna.org',
      ARRAY['Vela','Esqui']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-nautico-muaa-981',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-nautico-muaa-981', v_school_id, '{"resolucion_rd": "981", "resolucion_actualizacion": "1275", "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "ALFREDO CARLO LAZARO AMORE PARDO", "localidad": "Usaquén", "sports": ["Vela", "Esqui"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALFREDO CARLO LAZARO AMORE PARDO. Deporte(s): Vela, Esqui. Localidad: Usaquén. Resolución R-D Nº 981 / actualización Nº 1275. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112119443', phone),
      email       = COALESCE('directoradministrativo@clubnauticomuna.org', email),
      sports      = ARRAY['Vela','Esqui']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "981", "resolucion_actualizacion": "1275", "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "ALFREDO CARLO LAZARO AMORE PARDO", "localidad": "Usaquén", "sports": ["Vela", "Esqui"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-nautico-muaa-981';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3112119443', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NAUTILIUS  (IDRD-CLUB-nautilius-1706)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-nautilius-1706';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NAUTILIUS',
      'Presidente: CLAUDIA INES RAMIREZ RODRIGUEZ. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 1706. Vigente hasta 2027-12-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3157347264',
      'nautiliusclubdeportivo@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'nautilius-1706',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-nautilius-1706', v_school_id, '{"resolucion_rd": "1706", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2022", "fecha_fin": "2027-12-23", "presidente": "CLAUDIA INES RAMIREZ RODRIGUEZ", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA INES RAMIREZ RODRIGUEZ. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 1706. Vigente hasta 2027-12-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3157347264', phone),
      email       = COALESCE('nautiliusclubdeportivo@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1706", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2022", "fecha_fin": "2027-12-23", "presidente": "CLAUDIA INES RAMIREZ RODRIGUEZ", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-nautilius-1706';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3157347264', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NEW SOCCER  (IDRD-CLUB-club-deportivo-new-soccer-212)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-new-soccer-212';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NEW SOCCER',
      'Presidente: CARLOS ARTURO SANDOVAL ALVAREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 212 / actualización Nº 1958. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3173684578',
      'newsoccer2012@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-new-soccer-212',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-new-soccer-212', v_school_id, '{"resolucion_rd": "212", "resolucion_actualizacion": "1958", "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "CARLOS ARTURO SANDOVAL ALVAREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO SANDOVAL ALVAREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 212 / actualización Nº 1958. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173684578', phone),
      email       = COALESCE('newsoccer2012@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "212", "resolucion_actualizacion": "1958", "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "CARLOS ARTURO SANDOVAL ALVAREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-new-soccer-212';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3173684578', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NO LIMITS  (IDRD-CLUB-no-limits-1086)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-no-limits-1086';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NO LIMITS',
      'Presidente: WENDY JOHANNA GARZON BOHORQUEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1086. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3053319444',
      'joseto77@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'no-limits-1086',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-no-limits-1086', v_school_id, '{"resolucion_rd": "1086", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "WENDY JOHANNA GARZON BOHORQUEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WENDY JOHANNA GARZON BOHORQUEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1086. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3053319444', phone),
      email       = COALESCE('joseto77@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1086", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "WENDY JOHANNA GARZON BOHORQUEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-no-limits-1086';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3053319444', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NOTTINGHAM  (IDRD-CLUB-club-deportivo-nottingham-854)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-nottingham-854';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NOTTINGHAM',
      'Presidente: LIBARDO ARISTOBULO GARZÃN SAAVEDRA. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 854 / actualización Nº 1704. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3209013471',
      'nottinghamclubdeportivo@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-nottingham-854',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-nottingham-854', v_school_id, '{"resolucion_rd": "854", "resolucion_actualizacion": "1704", "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "LIBARDO ARISTOBULO GARZÃN SAAVEDRA", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LIBARDO ARISTOBULO GARZÃN SAAVEDRA. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 854 / actualización Nº 1704. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209013471', phone),
      email       = COALESCE('nottinghamclubdeportivo@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "854", "resolucion_actualizacion": "1704", "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "LIBARDO ARISTOBULO GARZÃN SAAVEDRA", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-nottingham-854';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3209013471', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NUEVA VIDA  (IDRD-CLUB-nueva-vida-807)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-nueva-vida-807';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NUEVA VIDA',
      'Presidente: RUBEN DARIO ROBLES SANDOVAL. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 807 / actualización Nº 1659. Vigente hasta 2026-10-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '6046665',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'nueva-vida-807',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-nueva-vida-807', v_school_id, '{"resolucion_rd": "807", "resolucion_actualizacion": "1659", "fecha_inicio": "08-10-2021", "fecha_fin": "2026-10-08", "presidente": "RUBEN DARIO ROBLES SANDOVAL", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RUBEN DARIO ROBLES SANDOVAL. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 807 / actualización Nº 1659. Vigente hasta 2026-10-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6046665', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "807", "resolucion_actualizacion": "1659", "fecha_inicio": "08-10-2021", "fecha_fin": "2026-10-08", "presidente": "RUBEN DARIO ROBLES SANDOVAL", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-nueva-vida-807';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '6046665', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- OCTAGONAL TABORA  (IDRD-CLUB-octagonal-tabora-1309)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-octagonal-tabora-1309';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'OCTAGONAL TABORA',
      'Presidente: HUMBERTO LÃâPEZ JIMÃâ°NEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1309 / actualización Nº 026. Vigente hasta 2027-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '25161716736369',
      'octagonaltabora@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'octagonal-tabora-1309',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-octagonal-tabora-1309', v_school_id, '{"resolucion_rd": "1309", "resolucion_actualizacion": "026", "fecha_inicio": "19-10-2022", "fecha_fin": "2027-10-19", "presidente": "HUMBERTO LÃâPEZ JIMÃâ°NEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HUMBERTO LÃâPEZ JIMÃâ°NEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1309 / actualización Nº 026. Vigente hasta 2027-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('25161716736369', phone),
      email       = COALESCE('octagonaltabora@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1309", "resolucion_actualizacion": "026", "fecha_inicio": "19-10-2022", "fecha_fin": "2027-10-19", "presidente": "HUMBERTO LÃâPEZ JIMÃâ°NEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-octagonal-tabora-1309';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '25161716736369', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- OLAYA HERRERA  (IDRD-CLUB-olaya-herrera-689)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-olaya-herrera-689';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'OLAYA HERRERA',
      'Presidente: JIMMY EDUARDO PARRA RODRIGUEZ. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 689 / actualización Nº 1000. Vigente hasta 2027-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '8063418',
      'jeparrar@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'olaya-herrera-689',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-olaya-herrera-689', v_school_id, '{"resolucion_rd": "689", "resolucion_actualizacion": "1000", "fecha_inicio": "28-06-2022", "fecha_fin": "2027-06-28", "presidente": "JIMMY EDUARDO PARRA RODRIGUEZ", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JIMMY EDUARDO PARRA RODRIGUEZ. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 689 / actualización Nº 1000. Vigente hasta 2027-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('8063418', phone),
      email       = COALESCE('jeparrar@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "689", "resolucion_actualizacion": "1000", "fecha_inicio": "28-06-2022", "fecha_fin": "2027-06-28", "presidente": "JIMMY EDUARDO PARRA RODRIGUEZ", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-olaya-herrera-689';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '8063418', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- OLD CAPITAL  (IDRD-CLUB-old-capital-842)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-old-capital-842';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'OLD CAPITAL',
      'Presidente: ÃÂLVARO CAMILO VANEGAS MARTÃÂNEZ. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 842. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3170679776',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'old-capital-842',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-old-capital-842', v_school_id, '{"resolucion_rd": "842", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "ÃÂLVARO CAMILO VANEGAS MARTÃÂNEZ", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ÃÂLVARO CAMILO VANEGAS MARTÃÂNEZ. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 842. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3170679776', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "842", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "ÃÂLVARO CAMILO VANEGAS MARTÃÂNEZ", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-old-capital-842';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3170679776', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ONE BMX  (IDRD-CLUB-club-deportivo-one-bmx-1599)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-one-bmx-1599';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ONE BMX',
      'Presidente: JESUS ALEXANDER GONZALEZ DIAZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1599. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3106989748',
      'alexgondi@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-one-bmx-1599',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-one-bmx-1599', v_school_id, '{"resolucion_rd": "1599", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "JESUS ALEXANDER GONZALEZ DIAZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JESUS ALEXANDER GONZALEZ DIAZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1599. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106989748', phone),
      email       = COALESCE('alexgondi@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1599", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "JESUS ALEXANDER GONZALEZ DIAZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-one-bmx-1599';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3106989748', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- OSO SANCHEZ  (IDRD-CLUB-oso-sanchez-113)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-oso-sanchez-113';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'OSO SANCHEZ',
      'Presidente: JESSICA MAYERLY ARIAS GUZMAN. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 113 / actualización Nº 1301. Vigente hasta 2028-02-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3144464526',
      'escuelaintegralrobertoososanchez@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'oso-sanchez-113',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-oso-sanchez-113', v_school_id, '{"resolucion_rd": "113", "resolucion_actualizacion": "1301", "fecha_inicio": "01-03-2023", "fecha_fin": "2028-02-29", "presidente": "JESSICA MAYERLY ARIAS GUZMAN", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JESSICA MAYERLY ARIAS GUZMAN. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 113 / actualización Nº 1301. Vigente hasta 2028-02-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144464526', phone),
      email       = COALESCE('escuelaintegralrobertoososanchez@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "113", "resolucion_actualizacion": "1301", "fecha_inicio": "01-03-2023", "fecha_fin": "2028-02-29", "presidente": "JESSICA MAYERLY ARIAS GUZMAN", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-oso-sanchez-113';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3144464526', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PADRE ALIRIO LOPEZ  (IDRD-CLUB-padre-alirio-lopez-946)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-padre-alirio-lopez-946';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PADRE ALIRIO LOPEZ',
      'Presidente: DOMINGO POVEDA RUIZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 946. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3115236950',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'padre-alirio-lopez-946',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-padre-alirio-lopez-946', v_school_id, '{"resolucion_rd": "946", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "DOMINGO POVEDA RUIZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DOMINGO POVEDA RUIZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 946. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115236950', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "946", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "DOMINGO POVEDA RUIZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-padre-alirio-lopez-946';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3115236950', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PALMEYRAS COLOMBIA FC  (IDRD-CLUB-club-deportivo-palmeyras-colombia-fc-813)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-palmeyras-colombia-fc-813';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PALMEYRAS COLOMBIA FC',
      'Presidente: KATERINE ESTEFANI MATOZA STEVENSON. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 813 / actualización Nº 1782. Vigente hasta 2026-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3205104298',
      'wilvana@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-palmeyras-colombia-fc-813',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-palmeyras-colombia-fc-813', v_school_id, '{"resolucion_rd": "813", "resolucion_actualizacion": "1782", "fecha_inicio": "28-10-2021", "fecha_fin": "2026-10-28", "presidente": "KATERINE ESTEFANI MATOZA STEVENSON", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KATERINE ESTEFANI MATOZA STEVENSON. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 813 / actualización Nº 1782. Vigente hasta 2026-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3205104298', phone),
      email       = COALESCE('wilvana@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "813", "resolucion_actualizacion": "1782", "fecha_inicio": "28-10-2021", "fecha_fin": "2026-10-28", "presidente": "KATERINE ESTEFANI MATOZA STEVENSON", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-palmeyras-colombia-fc-813';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3205104298', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PATIN 2000  (IDRD-CLUB-club-deportivo-patin-2000-1576)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-patin-2000-1576';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PATIN 2000',
      'Presidente: JUAN ESTEBAN NIÃâO PARRADO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1576 / actualización Nº 1183. Vigente hasta 2027-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3506225024',
      'clubpatin2000@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-patin-2000-1576',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-patin-2000-1576', v_school_id, '{"resolucion_rd": "1576", "resolucion_actualizacion": "1183", "fecha_inicio": "13-12-2022", "fecha_fin": "2027-12-13", "presidente": "JUAN ESTEBAN NIÃâO PARRADO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN ESTEBAN NIÃâO PARRADO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1576 / actualización Nº 1183. Vigente hasta 2027-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3506225024', phone),
      email       = COALESCE('clubpatin2000@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1576", "resolucion_actualizacion": "1183", "fecha_inicio": "13-12-2022", "fecha_fin": "2027-12-13", "presidente": "JUAN ESTEBAN NIÃâO PARRADO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-patin-2000-1576';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3506225024', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PATIN COL  (IDRD-CLUB-patin-col-165)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-patin-col-165';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PATIN COL',
      'Presidente: MYRIAM VARGAS BAUTISTA. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 165. Vigente hasta 2027-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '45128543164606174',
      'patincol@yahoo.es',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'patin-col-165',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-patin-col-165', v_school_id, '{"resolucion_rd": "165", "resolucion_actualizacion": null, "fecha_inicio": "22-02-2022", "fecha_fin": "2027-02-22", "presidente": "MYRIAM VARGAS BAUTISTA", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MYRIAM VARGAS BAUTISTA. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 165. Vigente hasta 2027-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('45128543164606174', phone),
      email       = COALESCE('patincol@yahoo.es', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "165", "resolucion_actualizacion": null, "fecha_inicio": "22-02-2022", "fecha_fin": "2027-02-22", "presidente": "MYRIAM VARGAS BAUTISTA", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-patin-col-165';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '45128543164606174', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PEGASO URF DE GIMNASIA  (IDRD-CLUB-pegaso-urf-de-gimnasia-314)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-pegaso-urf-de-gimnasia-314';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PEGASO URF DE GIMNASIA',
      'Presidente: JOHN LEONARDO SERNA ROJAS. Deporte(s): Gimnasia. Localidad: La Candelaria. Resolución R-D Nº 314. Vigente hasta 2027-04-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'La Candelaria',
      '2811481',
      'pegaso10033@hotmail.com',
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'pegaso-urf-de-gimnasia-314',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-pegaso-urf-de-gimnasia-314', v_school_id, '{"resolucion_rd": "314", "resolucion_actualizacion": null, "fecha_inicio": "06-04-2022", "fecha_fin": "2027-04-06", "presidente": "JOHN LEONARDO SERNA ROJAS", "localidad": "La Candelaria", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN LEONARDO SERNA ROJAS. Deporte(s): Gimnasia. Localidad: La Candelaria. Resolución R-D Nº 314. Vigente hasta 2027-04-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2811481', phone),
      email       = COALESCE('pegaso10033@hotmail.com', email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "314", "resolucion_actualizacion": null, "fecha_inicio": "06-04-2022", "fecha_fin": "2027-04-06", "presidente": "JOHN LEONARDO SERNA ROJAS", "localidad": "La Candelaria", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-pegaso-urf-de-gimnasia-314';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'La Candelaria', 'Bogotá', '2811481', 4.6843605, -74.0511562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PERFORMANCE  (IDRD-CLUB-performance-1099)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-performance-1099';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PERFORMANCE',
      'Presidente: DAVID ARTEAGA BERMUDEZ. Deporte(s): Triatlon. Localidad: Kennedy. Resolución R-D Nº 1099. Vigente hasta 2026-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3012168664',
      'david.arteaga.bermudez@hotmail.com',
      ARRAY['Triatlon']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'performance-1099',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-performance-1099', v_school_id, '{"resolucion_rd": "1099", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2021", "fecha_fin": "2026-12-13", "presidente": "DAVID ARTEAGA BERMUDEZ", "localidad": "Kennedy", "sports": ["Triatlon"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID ARTEAGA BERMUDEZ. Deporte(s): Triatlon. Localidad: Kennedy. Resolución R-D Nº 1099. Vigente hasta 2026-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012168664', phone),
      email       = COALESCE('david.arteaga.bermudez@hotmail.com', email),
      sports      = ARRAY['Triatlon']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1099", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2021", "fecha_fin": "2026-12-13", "presidente": "DAVID ARTEAGA BERMUDEZ", "localidad": "Kennedy", "sports": ["Triatlon"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-performance-1099';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3012168664', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PHANTOMS ALL STARS  (IDRD-CLUB-phantoms-all-stars-1272)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-phantoms-all-stars-1272';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PHANTOMS ALL STARS',
      'Presidente: KAREN VALENTINA MARTINEZ LIBERATO. Deporte(s): Porrismo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1272. Vigente hasta 2028-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3213980017',
      'phantomscheer@hotmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'phantoms-all-stars-1272',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-phantoms-all-stars-1272', v_school_id, '{"resolucion_rd": "1272", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2023", "fecha_fin": "2028-10-19", "presidente": "KAREN VALENTINA MARTINEZ LIBERATO", "localidad": "Rafael Uribe Uribe", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN VALENTINA MARTINEZ LIBERATO. Deporte(s): Porrismo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1272. Vigente hasta 2028-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213980017', phone),
      email       = COALESCE('phantomscheer@hotmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1272", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2023", "fecha_fin": "2028-10-19", "presidente": "KAREN VALENTINA MARTINEZ LIBERATO", "localidad": "Rafael Uribe Uribe", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-phantoms-all-stars-1272';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3213980017', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PIRATAS BASKETBALL CLUB  (IDRD-CLUB-piratas-basketball-club-1665)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-piratas-basketball-club-1665';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PIRATAS BASKETBALL CLUB',
      'Presidente: JOSE JAIME TAPIAS PATRON. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1665 / actualización Nº 1. Vigente hasta 2028-12-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3153187794',
      'piratasbogota@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'piratas-basketball-club-1665',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-piratas-basketball-club-1665', v_school_id, '{"resolucion_rd": "1665", "resolucion_actualizacion": "1", "fecha_inicio": "29-12-2023", "fecha_fin": "2028-12-28", "presidente": "JOSE JAIME TAPIAS PATRON", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE JAIME TAPIAS PATRON. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1665 / actualización Nº 1. Vigente hasta 2028-12-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153187794', phone),
      email       = COALESCE('piratasbogota@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1665", "resolucion_actualizacion": "1", "fecha_inicio": "29-12-2023", "fecha_fin": "2028-12-28", "presidente": "JOSE JAIME TAPIAS PATRON", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-piratas-basketball-club-1665';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3153187794', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- POPULAR LA FLORIDA  (IDRD-CLUB-popular-la-florida-1040)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-popular-la-florida-1040';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'POPULAR LA FLORIDA',
      'Presidente: LISCARDO ALFREDO LEMOS DIAZ. Deporte(s): Golf. Localidad: Engativá. Resolución R-D Nº 1040. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3164747206',
      'golflaflorida@gmail.com',
      ARRAY['Golf']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'popular-la-florida-1040',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-popular-la-florida-1040', v_school_id, '{"resolucion_rd": "1040", "resolucion_actualizacion": null, "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "LISCARDO ALFREDO LEMOS DIAZ", "localidad": "Engativá", "sports": ["Golf"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LISCARDO ALFREDO LEMOS DIAZ. Deporte(s): Golf. Localidad: Engativá. Resolución R-D Nº 1040. Vigente hasta 2027-09-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3164747206', phone),
      email       = COALESCE('golflaflorida@gmail.com', email),
      sports      = ARRAY['Golf']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1040", "resolucion_actualizacion": null, "fecha_inicio": "09-09-2022", "fecha_fin": "2027-09-09", "presidente": "LISCARDO ALFREDO LEMOS DIAZ", "localidad": "Engativá", "sports": ["Golf"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-popular-la-florida-1040';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3164747206', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- POTOSI LA ISLA  (IDRD-CLUB-potosi-la-isla-1245)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-potosi-la-isla-1245';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'POTOSI LA ISLA',
      'Presidente: DANIEL YOVANNY CASTRO PRIETO. Deporte(s): Atletismo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1245 / actualización Nº 1245. Vigente hasta 2028-09-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '7184182',
      'daniyova28@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'potosi-la-isla-1245',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-potosi-la-isla-1245', v_school_id, '{"resolucion_rd": "1245", "resolucion_actualizacion": "1245", "fecha_inicio": "29-09-2023", "fecha_fin": "2028-09-28", "presidente": "DANIEL YOVANNY CASTRO PRIETO", "localidad": "Ciudad Bolívar", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL YOVANNY CASTRO PRIETO. Deporte(s): Atletismo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1245 / actualización Nº 1245. Vigente hasta 2028-09-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7184182', phone),
      email       = COALESCE('daniyova28@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1245", "resolucion_actualizacion": "1245", "fecha_inicio": "29-09-2023", "fecha_fin": "2028-09-28", "presidente": "DANIEL YOVANNY CASTRO PRIETO", "localidad": "Ciudad Bolívar", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-potosi-la-isla-1245';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '7184182', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FÃâ°NIX TS  (IDRD-CLUB-club-deportivo-faanix-ts-200)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-faanix-ts-200';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FÃâ°NIX TS',
      'Presidente: KAREM DANIELA TORRES SANCHEZ. Localidad: Kennedy. Resolución R-D Nº 200. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3106258992',
      'fenixkatets@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-faanix-ts-200',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-faanix-ts-200', v_school_id, '{"resolucion_rd": "200", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "KAREM DANIELA TORRES SANCHEZ", "localidad": "Kennedy", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREM DANIELA TORRES SANCHEZ. Localidad: Kennedy. Resolución R-D Nº 200. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106258992', phone),
      email       = COALESCE('fenixkatets@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "200", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "KAREM DANIELA TORRES SANCHEZ", "localidad": "Kennedy", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-faanix-ts-200';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3106258992', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOCIAL DE PROFESORES DE LA UNIVERSIDAD NACIONAL DE COLOMBIA  (IDRD-CLUB-social-de-profesores-de-la-universidad-n-562)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-social-de-profesores-de-la-universidad-n-562';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOCIAL DE PROFESORES DE LA UNIVERSIDAD NACIONAL DE COLOMBIA',
      'Presidente: MAURICIO ENRIQUE DURÃÂN ZAMUDIO. Deporte(s): Bowling, Golf, Natación, Tenis. Localidad: Suba. Resolución R-D Nº 562. Vigente hasta 2027-06-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3153374508',
      NULL,
      ARRAY['Bowling','Golf','Natación','Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'social-de-profesores-de-la-universidad-n-562',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-social-de-profesores-de-la-universidad-n-562', v_school_id, '{"resolucion_rd": "562", "resolucion_actualizacion": null, "fecha_inicio": "02-06-2022", "fecha_fin": "2027-06-02", "presidente": "MAURICIO ENRIQUE DURÃÂN ZAMUDIO", "localidad": "Suba", "sports": ["Bowling", "Golf", "Natación", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAURICIO ENRIQUE DURÃÂN ZAMUDIO. Deporte(s): Bowling, Golf, Natación, Tenis. Localidad: Suba. Resolución R-D Nº 562. Vigente hasta 2027-06-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153374508', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Bowling','Golf','Natación','Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "562", "resolucion_actualizacion": null, "fecha_inicio": "02-06-2022", "fecha_fin": "2027-06-02", "presidente": "MAURICIO ENRIQUE DURÃÂN ZAMUDIO", "localidad": "Suba", "sports": ["Bowling", "Golf", "Natación", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-social-de-profesores-de-la-universidad-n-562';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3153374508', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PRONAT  (IDRD-CLUB-pronat-388)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-pronat-388';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PRONAT',
      'Presidente: CAMILO ALEJANDRO GAMBOA GÃâMEZ. Deporte(s): Actividades Subacuaticas. Resolución R-D Nº 388 / actualización Nº 585. Vigente hasta 2029-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      NULL,
      'pronat.bogota@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'pronat-388',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-pronat-388', v_school_id, '{"resolucion_rd": "388", "resolucion_actualizacion": "585", "fecha_inicio": "29-03-2024", "fecha_fin": "2029-03-29", "presidente": "CAMILO ALEJANDRO GAMBOA GÃâMEZ", "localidad": null, "sports": ["Actividades Subacuaticas"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ALEJANDRO GAMBOA GÃâMEZ. Deporte(s): Actividades Subacuaticas. Resolución R-D Nº 388 / actualización Nº 585. Vigente hasta 2029-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('pronat.bogota@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "388", "resolucion_actualizacion": "585", "fecha_inicio": "29-03-2024", "fecha_fin": "2029-03-29", "presidente": "CAMILO ALEJANDRO GAMBOA GÃâMEZ", "localidad": null, "sports": ["Actividades Subacuaticas"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-pronat-388';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PROYECTO PIES  (IDRD-CLUB-club-deportivo-proyecto-pies-1644)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-proyecto-pies-1644';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PROYECTO PIES',
      'Presidente: EDITH LUCÃA ORTEGA OSORIO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1644. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3132806400',
      'proyectopiesfc2204@yahoo.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-proyecto-pies-1644',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-proyecto-pies-1644', v_school_id, '{"resolucion_rd": "1644", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "EDITH LUCÃA ORTEGA OSORIO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDITH LUCÃA ORTEGA OSORIO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1644. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132806400', phone),
      email       = COALESCE('proyectopiesfc2204@yahoo.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1644", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "EDITH LUCÃA ORTEGA OSORIO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-proyecto-pies-1644';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3132806400', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO 20J  (IDRD-CLUB-club-deportivo-20j-1042)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-20j-1042';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO 20J',
      'Presidente: MIGUEL LEONARDO ROJAS. Deporte(s): Tejo. Localidad: Puente Aranda. Resolución R-D Nº 1042. Vigente hasta 2030-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3113166862',
      'jofremor@hotmail.com',
      ARRAY['Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-20j-1042',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-20j-1042', v_school_id, '{"resolucion_rd": "1042", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2025", "fecha_fin": "2030-09-24", "presidente": "MIGUEL LEONARDO ROJAS", "localidad": "Puente Aranda", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL LEONARDO ROJAS. Deporte(s): Tejo. Localidad: Puente Aranda. Resolución R-D Nº 1042. Vigente hasta 2030-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3113166862', phone),
      email       = COALESCE('jofremor@hotmail.com', email),
      sports      = ARRAY['Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1042", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2025", "fecha_fin": "2030-09-24", "presidente": "MIGUEL LEONARDO ROJAS", "localidad": "Puente Aranda", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-20j-1042';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3113166862', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PUMAS BASKETBALL CLUB  (IDRD-CLUB-pumas-basketball-club-213)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-pumas-basketball-club-213';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PUMAS BASKETBALL CLUB',
      'Presidente: YENNY MARCELA PINILLA GARCIA. Deporte(s): Baloncesto. Localidad: Chapinero. Resolución R-D Nº 213. Vigente hasta 2027-03-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '212284134912373158996867',
      'pumasbasketclub@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'pumas-basketball-club-213',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-pumas-basketball-club-213', v_school_id, '{"resolucion_rd": "213", "resolucion_actualizacion": null, "fecha_inicio": "09-03-2022", "fecha_fin": "2027-03-09", "presidente": "YENNY MARCELA PINILLA GARCIA", "localidad": "Chapinero", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YENNY MARCELA PINILLA GARCIA. Deporte(s): Baloncesto. Localidad: Chapinero. Resolución R-D Nº 213. Vigente hasta 2027-03-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('212284134912373158996867', phone),
      email       = COALESCE('pumasbasketclub@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "213", "resolucion_actualizacion": null, "fecha_inicio": "09-03-2022", "fecha_fin": "2027-03-09", "presidente": "YENNY MARCELA PINILLA GARCIA", "localidad": "Chapinero", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-pumas-basketball-club-213';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '212284134912373158996867', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO QUILMES.CRA.F.C.  (IDRD-CLUB-club-deportivo-quilmescrafc-1436)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-quilmescrafc-1436';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO QUILMES.CRA.F.C.',
      'Presidente: ELVIS ROJAS ARIZA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1436. Vigente hasta 2031-01-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3005067530',
      'quilmescrafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-quilmescrafc-1436',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-quilmescrafc-1436', v_school_id, '{"resolucion_rd": "1436", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2026", "fecha_fin": "2031-01-07", "presidente": "ELVIS ROJAS ARIZA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELVIS ROJAS ARIZA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1436. Vigente hasta 2031-01-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005067530', phone),
      email       = COALESCE('quilmescrafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1436", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2026", "fecha_fin": "2031-01-07", "presidente": "ELVIS ROJAS ARIZA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-quilmescrafc-1436';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3005067530', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RACING EG  (IDRD-CLUB-club-deportivo-racing-eg-942)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-racing-eg-942';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RACING EG',
      'Presidente: OSCAR JAVIER GUTIERREZ VARON. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 942. Vigente hasta 2030-09-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3046137631',
      '3112062209pau@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-racing-eg-942',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-racing-eg-942', v_school_id, '{"resolucion_rd": "942", "resolucion_actualizacion": null, "fecha_inicio": "15-09-2025", "fecha_fin": "2030-09-15", "presidente": "OSCAR JAVIER GUTIERREZ VARON", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR JAVIER GUTIERREZ VARON. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 942. Vigente hasta 2030-09-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3046137631', phone),
      email       = COALESCE('3112062209pau@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "942", "resolucion_actualizacion": null, "fecha_inicio": "15-09-2025", "fecha_fin": "2030-09-15", "presidente": "OSCAR JAVIER GUTIERREZ VARON", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-racing-eg-942';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3046137631', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RAICES  (IDRD-CLUB-raices-651)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-raices-651';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RAICES',
      'Presidente: FERNANDO OYOLA. Deporte(s): Discapacidad Visual. Localidad: Engativá. Resolución R-D Nº 651. Vigente hasta 2027-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3102431894',
      'fernandooyola56_01@live.com',
      ARRAY['Discapacidad Visual']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'raices-651',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-raices-651', v_school_id, '{"resolucion_rd": "651", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2022", "fecha_fin": "2027-06-21", "presidente": "FERNANDO OYOLA", "localidad": "Engativá", "sports": ["Discapacidad Visual"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FERNANDO OYOLA. Deporte(s): Discapacidad Visual. Localidad: Engativá. Resolución R-D Nº 651. Vigente hasta 2027-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102431894', phone),
      email       = COALESCE('fernandooyola56_01@live.com', email),
      sports      = ARRAY['Discapacidad Visual']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "651", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2022", "fecha_fin": "2027-06-21", "presidente": "FERNANDO OYOLA", "localidad": "Engativá", "sports": ["Discapacidad Visual"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-raices-651';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3102431894', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RAMAKIEN  (IDRD-CLUB-club-deportivo-ramakien-737)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ramakien-737';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RAMAKIEN',
      'Presidente: MANCER ANDRES BARRANCO LEON. Deporte(s): Muay Thai. Localidad: Engativá. Resolución R-D Nº 737. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3114743744',
      'clubramakien@gmail.com',
      ARRAY['Muay Thai']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ramakien-737',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ramakien-737', v_school_id, '{"resolucion_rd": "737", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "MANCER ANDRES BARRANCO LEON", "localidad": "Engativá", "sports": ["Muay Thai"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANCER ANDRES BARRANCO LEON. Deporte(s): Muay Thai. Localidad: Engativá. Resolución R-D Nº 737. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114743744', phone),
      email       = COALESCE('clubramakien@gmail.com', email),
      sports      = ARRAY['Muay Thai']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "737", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "MANCER ANDRES BARRANCO LEON", "localidad": "Engativá", "sports": ["Muay Thai"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ramakien-737';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3114743744', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL ACADEMIA COLOMBIANA DE FUTBOL  (IDRD-CLUB-real-academia-colombiana-de-futbol-833)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-academia-colombiana-de-futbol-833';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL ACADEMIA COLOMBIANA DE FUTBOL',
      'Presidente: ANA MARIA GORETTI ARENAS FRANCO. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 833 / actualización Nº 802. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3108561744',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-academia-colombiana-de-futbol-833',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-academia-colombiana-de-futbol-833', v_school_id, '{"resolucion_rd": "833", "resolucion_actualizacion": "802", "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "ANA MARIA GORETTI ARENAS FRANCO", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA MARIA GORETTI ARENAS FRANCO. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 833 / actualización Nº 802. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108561744', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "833", "resolucion_actualizacion": "802", "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "ANA MARIA GORETTI ARENAS FRANCO", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-academia-colombiana-de-futbol-833';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3108561744', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL ACADEMIA MARACANEIROS  (IDRD-CLUB-real-academia-maracaneiros-943)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-academia-maracaneiros-943';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL ACADEMIA MARACANEIROS',
      'Presidente: URIEL ALEJANDRO GUERRA URREGO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 943. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3132551071',
      'realacademiamaracaneiros@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-academia-maracaneiros-943',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-academia-maracaneiros-943', v_school_id, '{"resolucion_rd": "943", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "URIEL ALEJANDRO GUERRA URREGO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: URIEL ALEJANDRO GUERRA URREGO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 943. Vigente hasta 2027-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132551071', phone),
      email       = COALESCE('realacademiamaracaneiros@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "943", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2022", "fecha_fin": "2027-08-30", "presidente": "URIEL ALEJANDRO GUERRA URREGO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-academia-maracaneiros-943';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3132551071', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL CAPITAL  (IDRD-CLUB-real-capital-843)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-capital-843';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL CAPITAL',
      'Presidente: EDILSON JAVIER BUITRAGO MURILLO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 843. Vigente hasta 2027-08-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3125089527',
      'realcapital@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-capital-843',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-capital-843', v_school_id, '{"resolucion_rd": "843", "resolucion_actualizacion": null, "fecha_inicio": "12-08-2022", "fecha_fin": "2027-08-12", "presidente": "EDILSON JAVIER BUITRAGO MURILLO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDILSON JAVIER BUITRAGO MURILLO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 843. Vigente hasta 2027-08-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125089527', phone),
      email       = COALESCE('realcapital@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "843", "resolucion_actualizacion": null, "fecha_inicio": "12-08-2022", "fecha_fin": "2027-08-12", "presidente": "EDILSON JAVIER BUITRAGO MURILLO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-capital-843';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3125089527', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL MADRID BOGOTA COLOMBIA  (IDRD-CLUB-real-madrid-bogota-colombia-430)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-madrid-bogota-colombia-430';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL MADRID BOGOTA COLOMBIA',
      'Presidente: BERNARDO RINCON AMADOR. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 430. Vigente hasta 2027-05-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3204939321',
      'realmadridcol@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-madrid-bogota-colombia-430',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-madrid-bogota-colombia-430', v_school_id, '{"resolucion_rd": "430", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2022", "fecha_fin": "2027-05-09", "presidente": "BERNARDO RINCON AMADOR", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BERNARDO RINCON AMADOR. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 430. Vigente hasta 2027-05-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204939321', phone),
      email       = COALESCE('realmadridcol@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "430", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2022", "fecha_fin": "2027-05-09", "presidente": "BERNARDO RINCON AMADOR", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-madrid-bogota-colombia-430';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3204939321', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL PLAYERS F.C.  (IDRD-CLUB-club-deportivo-real-players-fc-1147)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-players-fc-1147';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL PLAYERS F.C.',
      'Presidente: MONICA LILIANA SANCHEZ GARCIA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1147. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3202582673',
      'realplayersfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-players-fc-1147',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-players-fc-1147', v_school_id, '{"resolucion_rd": "1147", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "MONICA LILIANA SANCHEZ GARCIA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MONICA LILIANA SANCHEZ GARCIA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1147. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202582673', phone),
      email       = COALESCE('realplayersfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1147", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "MONICA LILIANA SANCHEZ GARCIA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-players-fc-1147';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3202582673', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL SOCIEDAD COLOMBIA F.C  (IDRD-CLUB-real-sociedad-colombia-fc-1376)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-sociedad-colombia-fc-1376';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL SOCIEDAD COLOMBIA F.C',
      'Presidente: JOSUE GOMEZ RINCON. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1376. Vigente hasta 2028-10-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '60154968433123784251',
      'josuegomez7314@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-sociedad-colombia-fc-1376',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-sociedad-colombia-fc-1376', v_school_id, '{"resolucion_rd": "1376", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2023", "fecha_fin": "2028-10-24", "presidente": "JOSUE GOMEZ RINCON", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSUE GOMEZ RINCON. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1376. Vigente hasta 2028-10-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('60154968433123784251', phone),
      email       = COALESCE('josuegomez7314@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1376", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2023", "fecha_fin": "2028-10-24", "presidente": "JOSUE GOMEZ RINCON", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-sociedad-colombia-fc-1376';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '60154968433123784251', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL VALLADOLID  (IDRD-CLUB-club-deportivo-real-valladolid-357)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-valladolid-357';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL VALLADOLID',
      'Presidente: FABIAN DAVID MORALES MONTENEGRO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 357 / actualización Nº 365. Vigente hasta 2028-04-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3212000950',
      'rvalladolidcolombia@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-valladolid-357',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-valladolid-357', v_school_id, '{"resolucion_rd": "357", "resolucion_actualizacion": "365", "fecha_inicio": "27-04-2023", "fecha_fin": "2028-04-26", "presidente": "FABIAN DAVID MORALES MONTENEGRO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIAN DAVID MORALES MONTENEGRO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 357 / actualización Nº 365. Vigente hasta 2028-04-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212000950', phone),
      email       = COALESCE('rvalladolidcolombia@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "357", "resolucion_actualizacion": "365", "fecha_inicio": "27-04-2023", "fecha_fin": "2028-04-26", "presidente": "FABIAN DAVID MORALES MONTENEGRO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-valladolid-357';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3212000950', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RENACER  (IDRD-CLUB-renacer-261)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-renacer-261';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RENACER',
      'Presidente: TULIA AURORA MORENO JIMENEZ. Deporte(s): Discapacidad Cognitiva, Fútbol, Atletismo, Ciclismo, Natación. Localidad: Barrios Unidos. Resolución R-D Nº 261. Vigente hasta 2027-03-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '6405218',
      'clubdeportivorenacer@hotmail.com',
      ARRAY['Discapacidad Cognitiva','Fútbol','Atletismo','Ciclismo','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'renacer-261',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-renacer-261', v_school_id, '{"resolucion_rd": "261", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2022", "fecha_fin": "2027-03-16", "presidente": "TULIA AURORA MORENO JIMENEZ", "localidad": "Barrios Unidos", "sports": ["Discapacidad Cognitiva", "Fútbol", "Atletismo", "Ciclismo", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: TULIA AURORA MORENO JIMENEZ. Deporte(s): Discapacidad Cognitiva, Fútbol, Atletismo, Ciclismo, Natación. Localidad: Barrios Unidos. Resolución R-D Nº 261. Vigente hasta 2027-03-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6405218', phone),
      email       = COALESCE('clubdeportivorenacer@hotmail.com', email),
      sports      = ARRAY['Discapacidad Cognitiva','Fútbol','Atletismo','Ciclismo','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "261", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2022", "fecha_fin": "2027-03-16", "presidente": "TULIA AURORA MORENO JIMENEZ", "localidad": "Barrios Unidos", "sports": ["Discapacidad Cognitiva", "Fútbol", "Atletismo", "Ciclismo", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-renacer-261';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '6405218', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RENOVACION G.C.  (IDRD-CLUB-club-deportivo-renovacion-gc-99)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-renovacion-gc-99';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RENOVACION G.C.',
      'Presidente: JENNY JULIETH SUAREZ CUELLAR. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 99. Vigente hasta 2029-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '2006829',
      'clubdeportivorenovaciongc@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-renovacion-gc-99',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-renovacion-gc-99', v_school_id, '{"resolucion_rd": "99", "resolucion_actualizacion": null, "fecha_inicio": "12-02-2024", "fecha_fin": "2029-02-11", "presidente": "JENNY JULIETH SUAREZ CUELLAR", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNY JULIETH SUAREZ CUELLAR. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 99. Vigente hasta 2029-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2006829', phone),
      email       = COALESCE('clubdeportivorenovaciongc@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "99", "resolucion_actualizacion": null, "fecha_inicio": "12-02-2024", "fecha_fin": "2029-02-11", "presidente": "JENNY JULIETH SUAREZ CUELLAR", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-renovacion-gc-99';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '2006829', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RETO AL MUNDIAL  (IDRD-CLUB-reto-al-mundial-1112)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-reto-al-mundial-1112';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RETO AL MUNDIAL',
      'Presidente: JUAN PABLO MENDEZ TORRES.. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1112. Vigente hasta 2028-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3017063796',
      'jupamento@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'reto-al-mundial-1112',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-reto-al-mundial-1112', v_school_id, '{"resolucion_rd": "1112", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2023", "fecha_fin": "2028-09-24", "presidente": "JUAN PABLO MENDEZ TORRES.", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO MENDEZ TORRES.. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1112. Vigente hasta 2028-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017063796', phone),
      email       = COALESCE('jupamento@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1112", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2023", "fecha_fin": "2028-09-24", "presidente": "JUAN PABLO MENDEZ TORRES.", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-reto-al-mundial-1112';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3017063796', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ANDINOÃÂ´S ROAR ICE HOCKEY CLUB  (IDRD-CLUB-club-deportivo-andinoaa-s-roar-ice-hocke-837)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-andinoaa-s-roar-ice-hocke-837';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ANDINOÃÂ´S ROAR ICE HOCKEY CLUB',
      'Presidente: EMILIA JANETH TORRES RODRIGUEZ. Deporte(s): Hockey Sobre Hielo. Localidad: Usaquén. Resolución R-D Nº 837 / actualización Nº 250. Vigente hasta 2027-08-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3142203184',
      'andinosroaricehockey@gmail.com',
      ARRAY['Hockey Sobre Hielo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-andinoaa-s-roar-ice-hocke-837',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-andinoaa-s-roar-ice-hocke-837', v_school_id, '{"resolucion_rd": "837", "resolucion_actualizacion": "250", "fecha_inicio": "12-08-2022", "fecha_fin": "2027-08-12", "presidente": "EMILIA JANETH TORRES RODRIGUEZ", "localidad": "Usaquén", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EMILIA JANETH TORRES RODRIGUEZ. Deporte(s): Hockey Sobre Hielo. Localidad: Usaquén. Resolución R-D Nº 837 / actualización Nº 250. Vigente hasta 2027-08-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142203184', phone),
      email       = COALESCE('andinosroaricehockey@gmail.com', email),
      sports      = ARRAY['Hockey Sobre Hielo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "837", "resolucion_actualizacion": "250", "fecha_inicio": "12-08-2022", "fecha_fin": "2027-08-12", "presidente": "EMILIA JANETH TORRES RODRIGUEZ", "localidad": "Usaquén", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-andinoaa-s-roar-ice-hocke-837';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3142203184', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PATIN C.A.F.  (IDRD-CLUB-club-deportivo-patin-caf-037)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-patin-caf-037';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PATIN C.A.F.',
      'Presidente: JOSE LUIS REYES RODRIGUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 037. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3124556183',
      'joseres_10@msn.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-patin-caf-037',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-patin-caf-037', v_school_id, '{"resolucion_rd": "037", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JOSE LUIS REYES RODRIGUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS REYES RODRIGUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 037. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124556183', phone),
      email       = COALESCE('joseres_10@msn.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "037", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JOSE LUIS REYES RODRIGUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-patin-caf-037';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3124556183', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ROYAL SKATE  (IDRD-CLUB-royal-skate-765)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-royal-skate-765';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ROYAL SKATE',
      'Presidente: IRMA ISABEL CHARRY GONZALEZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 765 / actualización Nº 289. Vigente hasta 2026-09-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '29582293005563636',
      'alejoskate2003@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'royal-skate-765',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-royal-skate-765', v_school_id, '{"resolucion_rd": "765", "resolucion_actualizacion": "289", "fecha_inicio": "28-09-2021", "fecha_fin": "2026-09-28", "presidente": "IRMA ISABEL CHARRY GONZALEZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IRMA ISABEL CHARRY GONZALEZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 765 / actualización Nº 289. Vigente hasta 2026-09-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('29582293005563636', phone),
      email       = COALESCE('alejoskate2003@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "765", "resolucion_actualizacion": "289", "fecha_inicio": "28-09-2021", "fecha_fin": "2026-09-28", "presidente": "IRMA ISABEL CHARRY GONZALEZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-royal-skate-765';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '29582293005563636', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SABRE DÃâÃÂ´OR  (IDRD-CLUB-sabre-daaaa-or-890)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sabre-daaaa-or-890';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SABRE DÃâÃÂ´OR',
      'Presidente: LASKMI NATALIA LOZANO DUARTE. Deporte(s): Esgrima. Localidad: Fontibón. Resolución R-D Nº 890 / actualización Nº 1226. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '7598744',
      'lasknatcol@hotmail.com',
      ARRAY['Esgrima']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sabre-daaaa-or-890',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sabre-daaaa-or-890', v_school_id, '{"resolucion_rd": "890", "resolucion_actualizacion": "1226", "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "LASKMI NATALIA LOZANO DUARTE", "localidad": "Fontibón", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LASKMI NATALIA LOZANO DUARTE. Deporte(s): Esgrima. Localidad: Fontibón. Resolución R-D Nº 890 / actualización Nº 1226. Vigente hasta 2027-08-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7598744', phone),
      email       = COALESCE('lasknatcol@hotmail.com', email),
      sports      = ARRAY['Esgrima']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "890", "resolucion_actualizacion": "1226", "fecha_inicio": "16-08-2022", "fecha_fin": "2027-08-16", "presidente": "LASKMI NATALIA LOZANO DUARTE", "localidad": "Fontibón", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sabre-daaaa-or-890';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '7598744', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAETA  (IDRD-CLUB-club-deportivo-saeta-1018)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-saeta-1018';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAETA',
      'Presidente: SANDRA MILENA CARRERO TENJICA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1018. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '4200800',
      'contabilidad@saetasport.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-saeta-1018',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-saeta-1018', v_school_id, '{"resolucion_rd": "1018", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "SANDRA MILENA CARRERO TENJICA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA MILENA CARRERO TENJICA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1018. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4200800', phone),
      email       = COALESCE('contabilidad@saetasport.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1018", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "SANDRA MILENA CARRERO TENJICA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-saeta-1018';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '4200800', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SAFUCA  (IDRD-CLUB-safuca-1596)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-safuca-1596';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SAFUCA',
      'Presidente: RONALD STEVEN ZAMORA DIAZ. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1596. Vigente hasta 2027-12-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3017226494',
      'stevenzd_750@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'safuca-1596',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-safuca-1596', v_school_id, '{"resolucion_rd": "1596", "resolucion_actualizacion": null, "fecha_inicio": "07-12-2022", "fecha_fin": "2027-12-07", "presidente": "RONALD STEVEN ZAMORA DIAZ", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RONALD STEVEN ZAMORA DIAZ. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1596. Vigente hasta 2027-12-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017226494', phone),
      email       = COALESCE('stevenzd_750@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1596", "resolucion_actualizacion": null, "fecha_inicio": "07-12-2022", "fecha_fin": "2027-12-07", "presidente": "RONALD STEVEN ZAMORA DIAZ", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-safuca-1596';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3017226494', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SAKURA DE KARATE DO  (IDRD-CLUB-sakura-de-karate-do-1201)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sakura-de-karate-do-1201';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SAKURA DE KARATE DO',
      'Presidente: MARCO ANTONIO PACHÃâN SUAREZ. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 1201. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3143148000',
      'mpachons@gmail.com',
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sakura-de-karate-do-1201',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sakura-de-karate-do-1201', v_school_id, '{"resolucion_rd": "1201", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "MARCO ANTONIO PACHÃâN SUAREZ", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCO ANTONIO PACHÃâN SUAREZ. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 1201. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143148000', phone),
      email       = COALESCE('mpachons@gmail.com', email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1201", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "MARCO ANTONIO PACHÃâN SUAREZ", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sakura-de-karate-do-1201';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3143148000', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SALTAMONTES 4X4  (IDRD-CLUB-club-deportivo-saltamontes-4x4-661)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-saltamontes-4x4-661';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SALTAMONTES 4X4',
      'Presidente: LUIS FERNANDO MEDINA VELANDIA. Deporte(s): Automovilismo. Localidad: Barrios Unidos. Resolución R-D Nº 661. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '6016944647',
      'saltamontes4x4@gmail.com',
      ARRAY['Automovilismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-saltamontes-4x4-661',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-saltamontes-4x4-661', v_school_id, '{"resolucion_rd": "661", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "LUIS FERNANDO MEDINA VELANDIA", "localidad": "Barrios Unidos", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS FERNANDO MEDINA VELANDIA. Deporte(s): Automovilismo. Localidad: Barrios Unidos. Resolución R-D Nº 661. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6016944647', phone),
      email       = COALESCE('saltamontes4x4@gmail.com', email),
      sports      = ARRAY['Automovilismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "661", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "LUIS FERNANDO MEDINA VELANDIA", "localidad": "Barrios Unidos", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-saltamontes-4x4-661';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '6016944647', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SALTAMONTES BMX BOGOTA  (IDRD-CLUB-club-deportivo-saltamontes-bmx-bogota-696)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-saltamontes-bmx-bogota-696';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SALTAMONTES BMX BOGOTA',
      'Presidente: NELLY CASALLAS CAMELO. Deporte(s): Ciclismo. Localidad: Usaquén. Resolución R-D Nº 696 / actualización Nº 1329. Vigente hasta 2027-06-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3008485099',
      'saltamontesbmx@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-saltamontes-bmx-bogota-696',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-saltamontes-bmx-bogota-696', v_school_id, '{"resolucion_rd": "696", "resolucion_actualizacion": "1329", "fecha_inicio": "29-06-2022", "fecha_fin": "2027-06-29", "presidente": "NELLY CASALLAS CAMELO", "localidad": "Usaquén", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NELLY CASALLAS CAMELO. Deporte(s): Ciclismo. Localidad: Usaquén. Resolución R-D Nº 696 / actualización Nº 1329. Vigente hasta 2027-06-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008485099', phone),
      email       = COALESCE('saltamontesbmx@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "696", "resolucion_actualizacion": "1329", "fecha_inicio": "29-06-2022", "fecha_fin": "2027-06-29", "presidente": "NELLY CASALLAS CAMELO", "localidad": "Usaquén", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-saltamontes-bmx-bogota-696';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3008485099', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SAN CARLOS  (IDRD-CLUB-san-carlos-210)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-san-carlos-210';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SAN CARLOS',
      'Presidente: AUGUSTO HERNAN CALDERON REYES. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 210 / actualización Nº 1837. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3112977250',
      'javicard@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'san-carlos-210',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-san-carlos-210', v_school_id, '{"resolucion_rd": "210", "resolucion_actualizacion": "1837", "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "AUGUSTO HERNAN CALDERON REYES", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AUGUSTO HERNAN CALDERON REYES. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 210 / actualización Nº 1837. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112977250', phone),
      email       = COALESCE('javicard@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "210", "resolucion_actualizacion": "1837", "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "AUGUSTO HERNAN CALDERON REYES", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-san-carlos-210';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3112977250', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
