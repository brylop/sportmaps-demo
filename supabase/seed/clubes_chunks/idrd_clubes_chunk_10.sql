-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 10/10 (141 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO POLE SPORT BOGOTA  (IDRD-CLUB-club-deportivo-pole-sport-bogota-728)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pole-sport-bogota-728';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO POLE SPORT BOGOTA',
      'Presidente: GISET NATALIA MONTOYA MORENO. Deporte(s): Pole Sports. Localidad: Usaquén. Resolución R-D Nº 728. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3195847945',
      'empolepiso6@gmail.com',
      ARRAY['Pole Sports']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pole-sport-bogota-728',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pole-sport-bogota-728', v_school_id, '{"resolucion_rd": "728", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "GISET NATALIA MONTOYA MORENO", "localidad": "Usaquén", "sports": ["Pole Sports"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GISET NATALIA MONTOYA MORENO. Deporte(s): Pole Sports. Localidad: Usaquén. Resolución R-D Nº 728. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195847945', phone),
      email       = COALESCE('empolepiso6@gmail.com', email),
      sports      = ARRAY['Pole Sports']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "728", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "GISET NATALIA MONTOYA MORENO", "localidad": "Usaquén", "sports": ["Pole Sports"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pole-sport-bogota-728';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3195847945', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LIFEPOINT  (IDRD-CLUB-club-deportivo-lifepoint-727)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lifepoint-727';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LIFEPOINT',
      'Presidente: LUIS ALEJANDRO ARENAS CONTRERAS. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 727. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3017318601',
      'alejoarco@yahoo.com.mx',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lifepoint-727',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lifepoint-727', v_school_id, '{"resolucion_rd": "727", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "LUIS ALEJANDRO ARENAS CONTRERAS", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALEJANDRO ARENAS CONTRERAS. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 727. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017318601', phone),
      email       = COALESCE('alejoarco@yahoo.com.mx', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "727", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "LUIS ALEJANDRO ARENAS CONTRERAS", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lifepoint-727';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3017318601', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TRUST  (IDRD-CLUB-club-deportivo-trust-725)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-trust-725';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TRUST',
      'Presidente: YISETH PARIS CORRALES. Deporte(s): Patinaje, Fútbol, Baloncesto, Voleibol. Localidad: San Cristóbal. Resolución R-D Nº 725. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3134616626',
      'margaritasvioleta30@gmail.com',
      ARRAY['Patinaje','Fútbol','Baloncesto','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-trust-725',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-trust-725', v_school_id, '{"resolucion_rd": "725", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "YISETH PARIS CORRALES", "localidad": "San Cristóbal", "sports": ["Patinaje", "Fútbol", "Baloncesto", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YISETH PARIS CORRALES. Deporte(s): Patinaje, Fútbol, Baloncesto, Voleibol. Localidad: San Cristóbal. Resolución R-D Nº 725. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134616626', phone),
      email       = COALESCE('margaritasvioleta30@gmail.com', email),
      sports      = ARRAY['Patinaje','Fútbol','Baloncesto','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "725", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "YISETH PARIS CORRALES", "localidad": "San Cristóbal", "sports": ["Patinaje", "Fútbol", "Baloncesto", "Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-trust-725';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3134616626', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CODESAN COLOMBIA  (IDRD-CLUB-club-deportivo-codesan-colombia-723)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-codesan-colombia-723';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CODESAN COLOMBIA',
      'Presidente: LAURA MARIA HIGUERA ROJAS. Deporte(s): Fútbol de salón. Localidad: Usaquén. Resolución R-D Nº 723. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3102092080',
      'clubcodesancolombia@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-codesan-colombia-723',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-codesan-colombia-723', v_school_id, '{"resolucion_rd": "723", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "LAURA MARIA HIGUERA ROJAS", "localidad": "Usaquén", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LAURA MARIA HIGUERA ROJAS. Deporte(s): Fútbol de salón. Localidad: Usaquén. Resolución R-D Nº 723. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102092080', phone),
      email       = COALESCE('clubcodesancolombia@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "723", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "LAURA MARIA HIGUERA ROJAS", "localidad": "Usaquén", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-codesan-colombia-723';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3102092080', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SALAZ CS  (IDRD-CLUB-club-deportivo-salaz-cs-722)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-salaz-cs-722';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SALAZ CS',
      'Presidente: CRISTHIAN ALBERTO SALAZAR BLANCO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 722. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3022117270',
      'clubdeportivosalazcs@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-salaz-cs-722',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-salaz-cs-722', v_school_id, '{"resolucion_rd": "722", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "CRISTHIAN ALBERTO SALAZAR BLANCO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTHIAN ALBERTO SALAZAR BLANCO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 722. Vigente hasta 2030-07-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3022117270', phone),
      email       = COALESCE('clubdeportivosalazcs@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "722", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-14", "fecha_fin": "2030-07-14", "presidente": "CRISTHIAN ALBERTO SALAZAR BLANCO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-salaz-cs-722';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3022117270', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL ARCA  (IDRD-CLUB-club-deportivo-real-arca-721)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-arca-721';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL ARCA',
      'Presidente: SANDRA MOLINA ABRIL. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 721. Vigente hasta 2030-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3022290301',
      'jcamniao@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-arca-721',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-arca-721', v_school_id, '{"resolucion_rd": "721", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-11", "fecha_fin": "2030-07-11", "presidente": "SANDRA MOLINA ABRIL", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA MOLINA ABRIL. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 721. Vigente hasta 2030-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3022290301', phone),
      email       = COALESCE('jcamniao@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "721", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-11", "fecha_fin": "2030-07-11", "presidente": "SANDRA MOLINA ABRIL", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-arca-721';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3022290301', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PUMA' S  (IDRD-CLUB-club-deportivo-puma-s-763)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-puma-s-763';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PUMA'' S',
      'Presidente: JOSÃ LUIS RODRÃGUEZ TRIVIÃO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 763. Vigente hasta 2030-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3134534792',
      'dt.joseluis10@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-puma-s-763',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-puma-s-763', v_school_id, '{"resolucion_rd": "763", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-25", "fecha_fin": "2030-07-25", "presidente": "JOSÃ LUIS RODRÃGUEZ TRIVIÃO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ LUIS RODRÃGUEZ TRIVIÃO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 763. Vigente hasta 2030-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134534792', phone),
      email       = COALESCE('dt.joseluis10@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "763", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-25", "fecha_fin": "2030-07-25", "presidente": "JOSÃ LUIS RODRÃGUEZ TRIVIÃO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-puma-s-763';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3134534792', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LAS VEGAS  (IDRD-CLUB-club-deportivo-las-vegas-647)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-las-vegas-647';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LAS VEGAS',
      'Presidente: WILLIAM CAMILO VEGA CARDENAS. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 647. Vigente hasta 2030-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3053843055',
      'clublasvegasvoleibol@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-las-vegas-647',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-las-vegas-647', v_school_id, '{"resolucion_rd": "647", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-25", "fecha_fin": "2030-07-25", "presidente": "WILLIAM CAMILO VEGA CARDENAS", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM CAMILO VEGA CARDENAS. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 647. Vigente hasta 2030-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3053843055', phone),
      email       = COALESCE('clublasvegasvoleibol@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "647", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-25", "fecha_fin": "2030-07-25", "presidente": "WILLIAM CAMILO VEGA CARDENAS", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-las-vegas-647';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3053843055', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GALINDO HOMO NATURA  (IDRD-CLUB-club-deportivo-galindo-homo-natura-793)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-galindo-homo-natura-793';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GALINDO HOMO NATURA',
      'Presidente: CLAUDIA PATRICIA GALINDO RODRÃGUEZ. Deporte(s): Voleibol, Orientaciã³N, Hockey Sobre Cesped, Balonmano, Badminton, Surf. Localidad: Barrios Unidos. Resolución R-D Nº 793 / actualización Nº 793.0. Vigente hasta 2030-07-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3016657144',
      'homonaturacolombia@gmail.com',
      ARRAY['Voleibol','Orientaciã³N','Hockey Sobre Cesped','Balonmano','Badminton','Surf']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-galindo-homo-natura-793',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-galindo-homo-natura-793', v_school_id, '{"resolucion_rd": "793", "resolucion_actualizacion": "793.0", "fecha_inicio": "2025-07-30", "fecha_fin": "2030-07-30", "presidente": "CLAUDIA PATRICIA GALINDO RODRÃGUEZ", "localidad": "Barrios Unidos", "sports": ["Voleibol", "Orientaciã³N", "Hockey Sobre Cesped", "Balonmano", "Badminton", "Surf"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA PATRICIA GALINDO RODRÃGUEZ. Deporte(s): Voleibol, Orientaciã³N, Hockey Sobre Cesped, Balonmano, Badminton, Surf. Localidad: Barrios Unidos. Resolución R-D Nº 793 / actualización Nº 793.0. Vigente hasta 2030-07-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3016657144', phone),
      email       = COALESCE('homonaturacolombia@gmail.com', email),
      sports      = ARRAY['Voleibol','Orientaciã³N','Hockey Sobre Cesped','Balonmano','Badminton','Surf']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "793", "resolucion_actualizacion": "793.0", "fecha_inicio": "2025-07-30", "fecha_fin": "2030-07-30", "presidente": "CLAUDIA PATRICIA GALINDO RODRÃGUEZ", "localidad": "Barrios Unidos", "sports": ["Voleibol", "Orientaciã³N", "Hockey Sobre Cesped", "Balonmano", "Badminton", "Surf"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-galindo-homo-natura-793';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3016657144', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BERAKAH FC  (IDRD-CLUB-club-deportivo-berakah-fc-773)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-berakah-fc-773';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BERAKAH FC',
      'Presidente: OSCAR VLADIMIR GONZALEZ DIAZ. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 773. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3108701247',
      'berakahfc@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-berakah-fc-773',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-berakah-fc-773', v_school_id, '{"resolucion_rd": "773", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-11", "fecha_fin": "2030-08-11", "presidente": "OSCAR VLADIMIR GONZALEZ DIAZ", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR VLADIMIR GONZALEZ DIAZ. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 773. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108701247', phone),
      email       = COALESCE('berakahfc@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "773", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-11", "fecha_fin": "2030-08-11", "presidente": "OSCAR VLADIMIR GONZALEZ DIAZ", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-berakah-fc-773';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3108701247', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALL STAR REVOLUTION  (IDRD-CLUB-club-deportivo-all-star-revolution-771)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-all-star-revolution-771';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALL STAR REVOLUTION',
      'Presidente: OSCAR MAURICIO MUÃOZ RODRIGUEZ. Deporte(s): Porrismo. Localidad: Ciudad Bolívar. Resolución R-D Nº 771. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3224433213',
      'allstarrevolutionbogotacol@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-all-star-revolution-771',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-all-star-revolution-771', v_school_id, '{"resolucion_rd": "771", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-11", "fecha_fin": "2030-08-11", "presidente": "OSCAR MAURICIO MUÃOZ RODRIGUEZ", "localidad": "Ciudad Bolívar", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR MAURICIO MUÃOZ RODRIGUEZ. Deporte(s): Porrismo. Localidad: Ciudad Bolívar. Resolución R-D Nº 771. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3224433213', phone),
      email       = COALESCE('allstarrevolutionbogotacol@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "771", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-11", "fecha_fin": "2030-08-11", "presidente": "OSCAR MAURICIO MUÃOZ RODRIGUEZ", "localidad": "Ciudad Bolívar", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-all-star-revolution-771';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3224433213', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EMPIRE POKER  (IDRD-CLUB-club-deportivo-empire-poker-832)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-empire-poker-832';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EMPIRE POKER',
      'Presidente: EDGAR MAURICIO CASTRO TELLEZ. Deporte(s): Pã³Ker. Localidad: Kennedy. Resolución R-D Nº 832. Vigente hasta 2030-08-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3102400026',
      'pokerclubempire@gmail.com.',
      ARRAY['Pã³Ker']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-empire-poker-832',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-empire-poker-832', v_school_id, '{"resolucion_rd": "832", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-13", "fecha_fin": "2030-08-13", "presidente": "EDGAR MAURICIO CASTRO TELLEZ", "localidad": "Kennedy", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR MAURICIO CASTRO TELLEZ. Deporte(s): Pã³Ker. Localidad: Kennedy. Resolución R-D Nº 832. Vigente hasta 2030-08-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102400026', phone),
      email       = COALESCE('pokerclubempire@gmail.com.', email),
      sports      = ARRAY['Pã³Ker']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "832", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-13", "fecha_fin": "2030-08-13", "presidente": "EDGAR MAURICIO CASTRO TELLEZ", "localidad": "Kennedy", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-empire-poker-832';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3102400026', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MANATIES  (IDRD-CLUB-club-deportivo-manaties-854)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-manaties-854';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MANATIES',
      'Presidente: GABRIEL CAMERO RAMOS. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 854. Vigente hasta 2030-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '74609093102222902',
      'coord.csa@cruzrojabogota.org.co',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-manaties-854',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-manaties-854', v_school_id, '{"resolucion_rd": "854", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-15", "fecha_fin": "2030-08-15", "presidente": "GABRIEL CAMERO RAMOS", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GABRIEL CAMERO RAMOS. Deporte(s): Natación. Localidad: Barrios Unidos. Resolución R-D Nº 854. Vigente hasta 2030-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('74609093102222902', phone),
      email       = COALESCE('coord.csa@cruzrojabogota.org.co', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "854", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-15", "fecha_fin": "2030-08-15", "presidente": "GABRIEL CAMERO RAMOS", "localidad": "Barrios Unidos", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-manaties-854';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '74609093102222902', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GAZAP ELIANIS GARRIDO DANCE WORLD  (IDRD-CLUB-club-deportivo-gazap-elianis-garrido-dan-863)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-gazap-elianis-garrido-dan-863';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GAZAP ELIANIS GARRIDO DANCE WORLD',
      'Presidente: ELIANIS JULIETH GARRIDO ZAPATA. Deporte(s): Baile Deportivo. Localidad: Usaquén. Resolución R-D Nº 863. Vigente hasta 2030-08-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3054655576',
      'info@gazapsas.com',
      ARRAY['Baile Deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-gazap-elianis-garrido-dan-863',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-gazap-elianis-garrido-dan-863', v_school_id, '{"resolucion_rd": "863", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-19", "fecha_fin": "2030-08-19", "presidente": "ELIANIS JULIETH GARRIDO ZAPATA", "localidad": "Usaquén", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELIANIS JULIETH GARRIDO ZAPATA. Deporte(s): Baile Deportivo. Localidad: Usaquén. Resolución R-D Nº 863. Vigente hasta 2030-08-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3054655576', phone),
      email       = COALESCE('info@gazapsas.com', email),
      sports      = ARRAY['Baile Deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "863", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-19", "fecha_fin": "2030-08-19", "presidente": "ELIANIS JULIETH GARRIDO ZAPATA", "localidad": "Usaquén", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-gazap-elianis-garrido-dan-863';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3054655576', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DIAMANTE POKER  (IDRD-CLUB-club-deportivo-diamante-poker-864)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-diamante-poker-864';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DIAMANTE POKER',
      'Presidente: IVAN YESID QUINTERO QUINTERO. Deporte(s): Pã³Ker. Localidad: Kennedy. Resolución R-D Nº 864. Vigente hasta 2030-08-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3133693511',
      'clubpokerdiamante@gmail.com',
      ARRAY['Pã³Ker']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-diamante-poker-864',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-diamante-poker-864', v_school_id, '{"resolucion_rd": "864", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-19", "fecha_fin": "2030-08-19", "presidente": "IVAN YESID QUINTERO QUINTERO", "localidad": "Kennedy", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVAN YESID QUINTERO QUINTERO. Deporte(s): Pã³Ker. Localidad: Kennedy. Resolución R-D Nº 864. Vigente hasta 2030-08-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133693511', phone),
      email       = COALESCE('clubpokerdiamante@gmail.com', email),
      sports      = ARRAY['Pã³Ker']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "864", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-19", "fecha_fin": "2030-08-19", "presidente": "IVAN YESID QUINTERO QUINTERO", "localidad": "Kennedy", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-diamante-poker-864';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3133693511', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO THE FUTURE  (IDRD-CLUB-club-deportivo-the-future-772)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-the-future-772';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO THE FUTURE',
      'Presidente: JUAN GABRIEL BARRIOS JARA. Deporte(s): Pã³Ker. Localidad: Kennedy. Resolución R-D Nº 772. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3228064388',
      'clubdeportivothefuture@gmail.com.',
      ARRAY['Pã³Ker']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-the-future-772',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-the-future-772', v_school_id, '{"resolucion_rd": "772", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-11", "fecha_fin": "2030-08-11", "presidente": "JUAN GABRIEL BARRIOS JARA", "localidad": "Kennedy", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN GABRIEL BARRIOS JARA. Deporte(s): Pã³Ker. Localidad: Kennedy. Resolución R-D Nº 772. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3228064388', phone),
      email       = COALESCE('clubdeportivothefuture@gmail.com.', email),
      sports      = ARRAY['Pã³Ker']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "772", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-11", "fecha_fin": "2030-08-11", "presidente": "JUAN GABRIEL BARRIOS JARA", "localidad": "Kennedy", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-the-future-772';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3228064388', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAHARA  (IDRD-CLUB-club-deportivo-sahara-905)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sahara-905';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAHARA',
      'Presidente: LUCAS ARTURO MONTAÃEZ VALDERRAMA. Deporte(s): Pã³Ker. Localidad: Suba. Resolución R-D Nº 905. Vigente hasta 2030-08-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3118183753',
      'saharapokerclub@gmail.com.',
      ARRAY['Pã³Ker']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sahara-905',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sahara-905', v_school_id, '{"resolucion_rd": "905", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-28", "fecha_fin": "2030-08-28", "presidente": "LUCAS ARTURO MONTAÃEZ VALDERRAMA", "localidad": "Suba", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUCAS ARTURO MONTAÃEZ VALDERRAMA. Deporte(s): Pã³Ker. Localidad: Suba. Resolución R-D Nº 905. Vigente hasta 2030-08-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118183753', phone),
      email       = COALESCE('saharapokerclub@gmail.com.', email),
      sports      = ARRAY['Pã³Ker']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "905", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-28", "fecha_fin": "2030-08-28", "presidente": "LUCAS ARTURO MONTAÃEZ VALDERRAMA", "localidad": "Suba", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sahara-905';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3118183753', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TALENTOS F.A  (IDRD-CLUB-club-deportivo-talentos-fa-906)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-talentos-fa-906';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TALENTOS F.A',
      'Presidente: ARLEY ARTURO MURILLO FORERO. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 906. Vigente hasta 2030-08-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3134805865',
      'talentos.fa25@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-talentos-fa-906',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-talentos-fa-906', v_school_id, '{"resolucion_rd": "906", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-28", "fecha_fin": "2030-08-28", "presidente": "ARLEY ARTURO MURILLO FORERO", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ARLEY ARTURO MURILLO FORERO. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 906. Vigente hasta 2030-08-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134805865', phone),
      email       = COALESCE('talentos.fa25@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "906", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-28", "fecha_fin": "2030-08-28", "presidente": "ARLEY ARTURO MURILLO FORERO", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-talentos-fa-906';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3134805865', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KURASH LEONES  (IDRD-CLUB-club-deportivo-kurash-leones-904)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kurash-leones-904';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KURASH LEONES',
      'Presidente: DANIELA ALEJANDRA SANCHEZ GALVIS. Deporte(s): Kurash. Localidad: Kennedy. Resolución R-D Nº 904. Vigente hasta 2030-08-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3207901351',
      'kurashleones01@hotmail.com',
      ARRAY['Kurash']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kurash-leones-904',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kurash-leones-904', v_school_id, '{"resolucion_rd": "904", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-28", "fecha_fin": "2030-08-28", "presidente": "DANIELA ALEJANDRA SANCHEZ GALVIS", "localidad": "Kennedy", "sports": ["Kurash"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIELA ALEJANDRA SANCHEZ GALVIS. Deporte(s): Kurash. Localidad: Kennedy. Resolución R-D Nº 904. Vigente hasta 2030-08-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3207901351', phone),
      email       = COALESCE('kurashleones01@hotmail.com', email),
      sports      = ARRAY['Kurash']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "904", "resolucion_actualizacion": null, "fecha_inicio": "2025-08-28", "fecha_fin": "2030-08-28", "presidente": "DANIELA ALEJANDRA SANCHEZ GALVIS", "localidad": "Kennedy", "sports": ["Kurash"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kurash-leones-904';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3207901351', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO ELITE  (IDRD-CLUB-club-deportivo-taekwondo-elite-648)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-elite-648';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO ELITE',
      'Presidente: MARÃA CRISTINA ARIAS HERNÃNDEZ. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 648 / actualización Nº 677.0. Vigente hasta 2027-07-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3165512363',
      'eliteclubdetaekwondo@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-elite-648',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-elite-648', v_school_id, '{"resolucion_rd": "648", "resolucion_actualizacion": "677.0", "fecha_inicio": "2022-07-12", "fecha_fin": "2027-07-12", "presidente": "MARÃA CRISTINA ARIAS HERNÃNDEZ", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃA CRISTINA ARIAS HERNÃNDEZ. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 648 / actualización Nº 677.0. Vigente hasta 2027-07-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165512363', phone),
      email       = COALESCE('eliteclubdetaekwondo@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "648", "resolucion_actualizacion": "677.0", "fecha_inicio": "2022-07-12", "fecha_fin": "2027-07-12", "presidente": "MARÃA CRISTINA ARIAS HERNÃNDEZ", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-elite-648';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3165512363', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LAKE ROWING  (IDRD-CLUB-club-deportivo-lake-rowing-676)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lake-rowing-676';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LAKE ROWING',
      'Presidente: DEISY JOHANA MURCIA DÃAZ. Deporte(s): Canotaje. Localidad: Engativá. Resolución R-D Nº 676. Vigente hasta 2030-07-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3114452022',
      'clublakerowing@gmail.com',
      ARRAY['Canotaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lake-rowing-676',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lake-rowing-676', v_school_id, '{"resolucion_rd": "676", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-07", "fecha_fin": "2030-07-07", "presidente": "DEISY JOHANA MURCIA DÃAZ", "localidad": "Engativá", "sports": ["Canotaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DEISY JOHANA MURCIA DÃAZ. Deporte(s): Canotaje. Localidad: Engativá. Resolución R-D Nº 676. Vigente hasta 2030-07-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114452022', phone),
      email       = COALESCE('clublakerowing@gmail.com', email),
      sports      = ARRAY['Canotaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "676", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-07", "fecha_fin": "2030-07-07", "presidente": "DEISY JOHANA MURCIA DÃAZ", "localidad": "Engativá", "sports": ["Canotaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lake-rowing-676';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3114452022', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE CHALANERIA BRISAS DEL OLIMPO  (IDRD-CLUB-club-deportivo-de-chalaneria-brisas-del--675)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-chalaneria-brisas-del--675';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE CHALANERIA BRISAS DEL OLIMPO',
      'Presidente: JESSICA JULIANA VOTTELER LUQUE. Deporte(s): Chalanerã­A. Localidad: Usaquén. Resolución R-D Nº 675. Vigente hasta 2030-07-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3153437213',
      'oximetrixx@yahoo.es',
      ARRAY['Chalanerã­A']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-chalaneria-brisas-del--675',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-chalaneria-brisas-del--675', v_school_id, '{"resolucion_rd": "675", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-07", "fecha_fin": "2030-07-07", "presidente": "JESSICA JULIANA VOTTELER LUQUE", "localidad": "Usaquén", "sports": ["Chalanerã­A"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JESSICA JULIANA VOTTELER LUQUE. Deporte(s): Chalanerã­A. Localidad: Usaquén. Resolución R-D Nº 675. Vigente hasta 2030-07-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153437213', phone),
      email       = COALESCE('oximetrixx@yahoo.es', email),
      sports      = ARRAY['Chalanerã­A']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "675", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-07", "fecha_fin": "2030-07-07", "presidente": "JESSICA JULIANA VOTTELER LUQUE", "localidad": "Usaquén", "sports": ["Chalanerã­A"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-chalaneria-brisas-del--675';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3153437213', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WRESTLING FUTURE  (IDRD-CLUB-club-deportivo-wrestling-future-271)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-wrestling-future-271';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WRESTLING FUTURE',
      'Presidente: LEIDY CATERINE CIFUENTES CARRANZA. Deporte(s): Lucha. Localidad: Bosa. Resolución R-D Nº 271 / actualización Nº 674.0. Vigente hasta 2027-04-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3042168921',
      'clubwrestlingfuture@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-wrestling-future-271',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-wrestling-future-271', v_school_id, '{"resolucion_rd": "271", "resolucion_actualizacion": "674.0", "fecha_inicio": "2022-04-25", "fecha_fin": "2027-04-25", "presidente": "LEIDY CATERINE CIFUENTES CARRANZA", "localidad": "Bosa", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEIDY CATERINE CIFUENTES CARRANZA. Deporte(s): Lucha. Localidad: Bosa. Resolución R-D Nº 271 / actualización Nº 674.0. Vigente hasta 2027-04-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3042168921', phone),
      email       = COALESCE('clubwrestlingfuture@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "271", "resolucion_actualizacion": "674.0", "fecha_inicio": "2022-04-25", "fecha_fin": "2027-04-25", "presidente": "LEIDY CATERINE CIFUENTES CARRANZA", "localidad": "Bosa", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-wrestling-future-271';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3042168921', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ROJINEGRO SOY  (IDRD-CLUB-club-deportivo-rojinegro-soy-661)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-rojinegro-soy-661';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ROJINEGRO SOY',
      'Presidente: KAREN SOFIA TARAZONA CARDENAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 661 / actualización Nº 661.0. Vigente hasta 2030-07-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3108757487',
      'karentarazona33@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-rojinegro-soy-661',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-rojinegro-soy-661', v_school_id, '{"resolucion_rd": "661", "resolucion_actualizacion": "661.0", "fecha_inicio": "2025-07-01", "fecha_fin": "2030-07-01", "presidente": "KAREN SOFIA TARAZONA CARDENAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN SOFIA TARAZONA CARDENAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 661 / actualización Nº 661.0. Vigente hasta 2030-07-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108757487', phone),
      email       = COALESCE('karentarazona33@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "661", "resolucion_actualizacion": "661.0", "fecha_inicio": "2025-07-01", "fecha_fin": "2030-07-01", "presidente": "KAREN SOFIA TARAZONA CARDENAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-rojinegro-soy-661';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3108757487', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO C.D. HURAKAN MILTON GUERRERO  (IDRD-CLUB-club-deportivo-cd-hurakan-milton-guerrer-659)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cd-hurakan-milton-guerrer-659';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO C.D. HURAKAN MILTON GUERRERO',
      'Presidente: JENNY MARICELA MURILLO MESA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 659. Vigente hasta 2030-07-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3158557158',
      'escueladefutbolhuracan01@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cd-hurakan-milton-guerrer-659',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cd-hurakan-milton-guerrer-659', v_school_id, '{"resolucion_rd": "659", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-01", "fecha_fin": "2030-07-01", "presidente": "JENNY MARICELA MURILLO MESA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNY MARICELA MURILLO MESA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 659. Vigente hasta 2030-07-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158557158', phone),
      email       = COALESCE('escueladefutbolhuracan01@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "659", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-01", "fecha_fin": "2030-07-01", "presidente": "JENNY MARICELA MURILLO MESA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cd-hurakan-milton-guerrer-659';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3158557158', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SCRATCH  (IDRD-CLUB-club-deportivo-scratch-658)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-scratch-658';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SCRATCH',
      'Presidente: CRISTIAN CAMILO HUERTAS JIMENEZ. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 658. Vigente hasta 2030-07-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3142883763',
      'huertascristian54@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-scratch-658',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-scratch-658', v_school_id, '{"resolucion_rd": "658", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-01", "fecha_fin": "2030-07-01", "presidente": "CRISTIAN CAMILO HUERTAS JIMENEZ", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN CAMILO HUERTAS JIMENEZ. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 658. Vigente hasta 2030-07-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142883763', phone),
      email       = COALESCE('huertascristian54@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "658", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-01", "fecha_fin": "2030-07-01", "presidente": "CRISTIAN CAMILO HUERTAS JIMENEZ", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-scratch-658';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3142883763', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LIVE SPORT  (IDRD-CLUB-club-deportivo-live-sport-614)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-live-sport-614';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LIVE SPORT',
      'Presidente: SANTIAGO TORRES LONDOÃO. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 614. Vigente hasta 2030-06-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3177006696',
      'clublivesport@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-live-sport-614',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-live-sport-614', v_school_id, '{"resolucion_rd": "614", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-17", "fecha_fin": "2030-06-17", "presidente": "SANTIAGO TORRES LONDOÃO", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO TORRES LONDOÃO. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 614. Vigente hasta 2030-06-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3177006696', phone),
      email       = COALESCE('clublivesport@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "614", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-17", "fecha_fin": "2030-06-17", "presidente": "SANTIAGO TORRES LONDOÃO", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-live-sport-614';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3177006696', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO INTER 18 FC  (IDRD-CLUB-club-deportivo-inter-18-fc-586)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-inter-18-fc-586';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO INTER 18 FC',
      'Presidente: RODRIGO RIAÃO MELÃN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 586. Vigente hasta 2030-06-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3214387809',
      'sosiegofc@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-inter-18-fc-586',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-inter-18-fc-586', v_school_id, '{"resolucion_rd": "586", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-06", "fecha_fin": "2030-06-06", "presidente": "RODRIGO RIAÃO MELÃN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RODRIGO RIAÃO MELÃN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 586. Vigente hasta 2030-06-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214387809', phone),
      email       = COALESCE('sosiegofc@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "586", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-06", "fecha_fin": "2030-06-06", "presidente": "RODRIGO RIAÃO MELÃN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-inter-18-fc-586';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3214387809', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TIMING  (IDRD-CLUB-club-deportivo-timing-584)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-timing-584';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TIMING',
      'Presidente: FABIAN STEVEN ANDRADE VARGAS. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 584. Vigente hasta 2030-06-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3244291891',
      'clubdeportivotiming@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-timing-584',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-timing-584', v_school_id, '{"resolucion_rd": "584", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-06", "fecha_fin": "2030-06-06", "presidente": "FABIAN STEVEN ANDRADE VARGAS", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIAN STEVEN ANDRADE VARGAS. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 584. Vigente hasta 2030-06-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3244291891', phone),
      email       = COALESCE('clubdeportivotiming@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "584", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-06", "fecha_fin": "2030-06-06", "presidente": "FABIAN STEVEN ANDRADE VARGAS", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-timing-584';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3244291891', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TENNIS CLUB SA  (IDRD-CLUB-club-deportivo-tennis-club-sa-1646.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tennis-club-sa-1646.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TENNIS CLUB SA',
      'Presidente: SAUL AMAYA. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 1646.0 / actualización Nº N/A. Vigente hasta 2031-01-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3114627955',
      'tennisclubsa@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tennis-club-sa-1646.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tennis-club-sa-1646.0', v_school_id, '{"resolucion_rd": "1646.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-06", "fecha_fin": "2031-01-06", "presidente": "SAUL AMAYA", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SAUL AMAYA. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 1646.0 / actualización Nº N/A. Vigente hasta 2031-01-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114627955', phone),
      email       = COALESCE('tennisclubsa@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1646.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-06", "fecha_fin": "2031-01-06", "presidente": "SAUL AMAYA", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tennis-club-sa-1646.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3114627955', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WARRIORS BMX CLUB  (IDRD-CLUB-club-deportivo-warriors-bmx-club-546)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-warriors-bmx-club-546';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WARRIORS BMX CLUB',
      'Presidente: JOSE LUIS DIAZ MONTAÃA. Deporte(s): Ciclismo. Localidad: Teusaquillo. Resolución R-D Nº 546. Vigente hasta 2030-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3017865909',
      'asistenciawarriors@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-warriors-bmx-club-546',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-warriors-bmx-club-546', v_school_id, '{"resolucion_rd": "546", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-04", "fecha_fin": "2030-06-04", "presidente": "JOSE LUIS DIAZ MONTAÃA", "localidad": "Teusaquillo", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS DIAZ MONTAÃA. Deporte(s): Ciclismo. Localidad: Teusaquillo. Resolución R-D Nº 546. Vigente hasta 2030-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017865909', phone),
      email       = COALESCE('asistenciawarriors@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "546", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-04", "fecha_fin": "2030-06-04", "presidente": "JOSE LUIS DIAZ MONTAÃA", "localidad": "Teusaquillo", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-warriors-bmx-club-546';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3017865909', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SFC NAPOLI  (IDRD-CLUB-club-deportivo-sfc-napoli-534)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sfc-napoli-534';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SFC NAPOLI',
      'Presidente: JUAN BERNARDO CUERVO MOLINA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 534. Vigente hasta 2030-05-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3107667910',
      'sociedadfcnapoli@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sfc-napoli-534',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sfc-napoli-534', v_school_id, '{"resolucion_rd": "534", "resolucion_actualizacion": null, "fecha_inicio": "2025-05-30", "fecha_fin": "2030-05-30", "presidente": "JUAN BERNARDO CUERVO MOLINA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN BERNARDO CUERVO MOLINA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 534. Vigente hasta 2030-05-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107667910', phone),
      email       = COALESCE('sociedadfcnapoli@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "534", "resolucion_actualizacion": null, "fecha_inicio": "2025-05-30", "fecha_fin": "2030-05-30", "presidente": "JUAN BERNARDO CUERVO MOLINA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sfc-napoli-534';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3107667910', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FEDERICO VALENCIA  (IDRD-CLUB-club-deportivo-federico-valencia-506)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-federico-valencia-506';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FEDERICO VALENCIA',
      'Presidente: NANCY LILIANA RAMÃREZ JIMÃNEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 506. Vigente hasta 2030-05-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3153852004',
      'escuelafutbolfedericovalencia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-federico-valencia-506',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-federico-valencia-506', v_school_id, '{"resolucion_rd": "506", "resolucion_actualizacion": null, "fecha_inicio": "2025-05-26", "fecha_fin": "2030-05-26", "presidente": "NANCY LILIANA RAMÃREZ JIMÃNEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NANCY LILIANA RAMÃREZ JIMÃNEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 506. Vigente hasta 2030-05-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153852004', phone),
      email       = COALESCE('escuelafutbolfedericovalencia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "506", "resolucion_actualizacion": null, "fecha_inicio": "2025-05-26", "fecha_fin": "2030-05-26", "presidente": "NANCY LILIANA RAMÃREZ JIMÃNEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-federico-valencia-506';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3153852004', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL MADELENA F.C  (IDRD-CLUB-club-deportivo-real-madelena-fc-502)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-madelena-fc-502';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL MADELENA F.C',
      'Presidente: JHORDAN ANDRÃS CORTÃS SÃNCHEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 502. Vigente hasta 2030-05-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3192403690',
      'realmadelenafc@gmail.com.',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-madelena-fc-502',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-madelena-fc-502', v_school_id, '{"resolucion_rd": "502", "resolucion_actualizacion": null, "fecha_inicio": "2025-05-23", "fecha_fin": "2030-05-23", "presidente": "JHORDAN ANDRÃS CORTÃS SÃNCHEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHORDAN ANDRÃS CORTÃS SÃNCHEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 502. Vigente hasta 2030-05-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3192403690', phone),
      email       = COALESCE('realmadelenafc@gmail.com.', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "502", "resolucion_actualizacion": null, "fecha_inicio": "2025-05-23", "fecha_fin": "2030-05-23", "presidente": "JHORDAN ANDRÃS CORTÃS SÃNCHEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-madelena-fc-502';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3192403690', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DEPORTES BOGOTÃ F.C.  (IDRD-CLUB-club-deportivo-deportes-bogota-fc-493)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-deportes-bogota-fc-493';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DEPORTES BOGOTÃ F.C.',
      'Presidente: EDUARDO PACHECO PEDREROS. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 493. Vigente hasta 2030-05-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3012442208',
      'clubdeportivodbfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-deportes-bogota-fc-493',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-deportes-bogota-fc-493', v_school_id, '{"resolucion_rd": "493", "resolucion_actualizacion": null, "fecha_inicio": "2025-05-21", "fecha_fin": "2030-05-21", "presidente": "EDUARDO PACHECO PEDREROS", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDUARDO PACHECO PEDREROS. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 493. Vigente hasta 2030-05-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012442208', phone),
      email       = COALESCE('clubdeportivodbfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "493", "resolucion_actualizacion": null, "fecha_inicio": "2025-05-21", "fecha_fin": "2030-05-21", "presidente": "EDUARDO PACHECO PEDREROS", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-deportes-bogota-fc-493';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3012442208', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BULLET SHOOTING CLUB  (IDRD-CLUB-club-deportivo-bullet-shooting-club-472)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bullet-shooting-club-472';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BULLET SHOOTING CLUB',
      'Presidente: EDUARDO JARAMILLO CASTAÃEDA. Deporte(s): Tiro deportivo. Localidad: Suba. Resolución R-D Nº 472 / actualización Nº 484.0. Vigente hasta 2026-07-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3103249383',
      'comandoglock3@gmail.com',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bullet-shooting-club-472',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bullet-shooting-club-472', v_school_id, '{"resolucion_rd": "472", "resolucion_actualizacion": "484.0", "fecha_inicio": "2022-07-14", "fecha_fin": "2026-07-14", "presidente": "EDUARDO JARAMILLO CASTAÃEDA", "localidad": "Suba", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDUARDO JARAMILLO CASTAÃEDA. Deporte(s): Tiro deportivo. Localidad: Suba. Resolución R-D Nº 472 / actualización Nº 484.0. Vigente hasta 2026-07-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103249383', phone),
      email       = COALESCE('comandoglock3@gmail.com', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "472", "resolucion_actualizacion": "484.0", "fecha_inicio": "2022-07-14", "fecha_fin": "2026-07-14", "presidente": "EDUARDO JARAMILLO CASTAÃEDA", "localidad": "Suba", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bullet-shooting-club-472';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3103249383', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CEFRAN FUTBOL CLUB  (IDRD-CLUB-club-deportivo-cefran-futbol-club-307)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cefran-futbol-club-307';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CEFRAN FUTBOL CLUB',
      'Presidente: JOHAN SEBASTIÃN FRANCO PENAGOS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 307. Vigente hasta 2030-04-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3123938848',
      'cefradeportesfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cefran-futbol-club-307',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cefran-futbol-club-307', v_school_id, '{"resolucion_rd": "307", "resolucion_actualizacion": null, "fecha_inicio": "2025-04-04", "fecha_fin": "2030-04-04", "presidente": "JOHAN SEBASTIÃN FRANCO PENAGOS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHAN SEBASTIÃN FRANCO PENAGOS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 307. Vigente hasta 2030-04-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123938848', phone),
      email       = COALESCE('cefradeportesfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "307", "resolucion_actualizacion": null, "fecha_inicio": "2025-04-04", "fecha_fin": "2030-04-04", "presidente": "JOHAN SEBASTIÃN FRANCO PENAGOS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cefran-futbol-club-307';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3123938848', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAN MIGUEL  (IDRD-CLUB-club-deportivo-san-miguel-297)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-san-miguel-297';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAN MIGUEL',
      'Presidente: LUISA XIMENA MARTÃNEZ MORA. Deporte(s): Tejo. Localidad: Kennedy. Resolución R-D Nº 297. Vigente hasta 2030-04-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3213684804',
      'miguelviejotolima@hotmail.com',
      ARRAY['Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-san-miguel-297',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-san-miguel-297', v_school_id, '{"resolucion_rd": "297", "resolucion_actualizacion": null, "fecha_inicio": "2025-04-03", "fecha_fin": "2030-04-03", "presidente": "LUISA XIMENA MARTÃNEZ MORA", "localidad": "Kennedy", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUISA XIMENA MARTÃNEZ MORA. Deporte(s): Tejo. Localidad: Kennedy. Resolución R-D Nº 297. Vigente hasta 2030-04-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213684804', phone),
      email       = COALESCE('miguelviejotolima@hotmail.com', email),
      sports      = ARRAY['Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "297", "resolucion_actualizacion": null, "fecha_inicio": "2025-04-03", "fecha_fin": "2030-04-03", "presidente": "LUISA XIMENA MARTÃNEZ MORA", "localidad": "Kennedy", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-san-miguel-297';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3213684804', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BMX POWERBIKE  (IDRD-CLUB-club-deportivo-bmx-powerbike-283)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bmx-powerbike-283';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BMX POWERBIKE',
      'Presidente: YENNY MARGARITA HERNANDEZ CHAPARRO. Deporte(s): Ciclismo. Localidad: Kennedy. Resolución R-D Nº 283. Vigente hasta 2030-04-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3187884572',
      'bmx.powerbike@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bmx-powerbike-283',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bmx-powerbike-283', v_school_id, '{"resolucion_rd": "283", "resolucion_actualizacion": null, "fecha_inicio": "2025-04-03", "fecha_fin": "2030-04-03", "presidente": "YENNY MARGARITA HERNANDEZ CHAPARRO", "localidad": "Kennedy", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YENNY MARGARITA HERNANDEZ CHAPARRO. Deporte(s): Ciclismo. Localidad: Kennedy. Resolución R-D Nº 283. Vigente hasta 2030-04-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187884572', phone),
      email       = COALESCE('bmx.powerbike@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "283", "resolucion_actualizacion": null, "fecha_inicio": "2025-04-03", "fecha_fin": "2030-04-03", "presidente": "YENNY MARGARITA HERNANDEZ CHAPARRO", "localidad": "Kennedy", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bmx-powerbike-283';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3187884572', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VADID  (IDRD-CLUB-club-deportivo-vadid-1664)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-vadid-1664';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VADID',
      'Presidente: ANDRES DAVID VELASQUEZ VARGAS. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1664 / actualización Nº 281.0. Vigente hasta 2027-12-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3195810384',
      'cdvadid@yahoo.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-vadid-1664',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-vadid-1664', v_school_id, '{"resolucion_rd": "1664", "resolucion_actualizacion": "281.0", "fecha_inicio": "2022-12-26", "fecha_fin": "2027-12-26", "presidente": "ANDRES DAVID VELASQUEZ VARGAS", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES DAVID VELASQUEZ VARGAS. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1664 / actualización Nº 281.0. Vigente hasta 2027-12-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195810384', phone),
      email       = COALESCE('cdvadid@yahoo.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1664", "resolucion_actualizacion": "281.0", "fecha_inicio": "2022-12-26", "fecha_fin": "2027-12-26", "presidente": "ANDRES DAVID VELASQUEZ VARGAS", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-vadid-1664';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3195810384', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORT COLOMBIA  (IDRD-CLUB-club-deportivo-sport-colombia-1595)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-colombia-1595';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORT COLOMBIA',
      'Presidente: LUZ VIVIANA LOPEZ CAÃON. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1595 / actualización Nº 276.0. Vigente hasta 2027-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3187895981',
      'clubdeportivosportcolombia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sport-colombia-1595',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sport-colombia-1595', v_school_id, '{"resolucion_rd": "1595", "resolucion_actualizacion": "276.0", "fecha_inicio": "2022-12-13", "fecha_fin": "2027-12-13", "presidente": "LUZ VIVIANA LOPEZ CAÃON", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUZ VIVIANA LOPEZ CAÃON. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1595 / actualización Nº 276.0. Vigente hasta 2027-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187895981', phone),
      email       = COALESCE('clubdeportivosportcolombia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1595", "resolucion_actualizacion": "276.0", "fecha_inicio": "2022-12-13", "fecha_fin": "2027-12-13", "presidente": "LUZ VIVIANA LOPEZ CAÃON", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-colombia-1595';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3187895981', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ZENT VOLLEY  (IDRD-CLUB-club-deportivo-zent-volley-165)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-zent-volley-165';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ZENT VOLLEY',
      'Presidente: GABRIEL ADOLFO CUERVO BUSTOS. Deporte(s): Voleibol. Localidad: Kennedy. Resolución R-D Nº 165. Vigente hasta 2030-03-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3112573796',
      'zentvolley3105@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-zent-volley-165',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-zent-volley-165', v_school_id, '{"resolucion_rd": "165", "resolucion_actualizacion": null, "fecha_inicio": "2025-03-07", "fecha_fin": "2030-03-07", "presidente": "GABRIEL ADOLFO CUERVO BUSTOS", "localidad": "Kennedy", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GABRIEL ADOLFO CUERVO BUSTOS. Deporte(s): Voleibol. Localidad: Kennedy. Resolución R-D Nº 165. Vigente hasta 2030-03-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112573796', phone),
      email       = COALESCE('zentvolley3105@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "165", "resolucion_actualizacion": null, "fecha_inicio": "2025-03-07", "fecha_fin": "2030-03-07", "presidente": "GABRIEL ADOLFO CUERVO BUSTOS", "localidad": "Kennedy", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-zent-volley-165';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3112573796', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REY DEL TATAMI  (IDRD-CLUB-club-deportivo-rey-del-tatami-792)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-rey-del-tatami-792';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REY DEL TATAMI',
      'Presidente: JEFRY DAVID MELO MORALES. Deporte(s): Judo. Localidad: Ciudad Bolívar. Resolución R-D Nº 792 / actualización Nº 929.0. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3042168921',
      'judoreydeltatami@gmail.com',
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-rey-del-tatami-792',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-rey-del-tatami-792', v_school_id, '{"resolucion_rd": "792", "resolucion_actualizacion": "929.0", "fecha_inicio": "2022-08-05", "fecha_fin": "2027-08-05", "presidente": "JEFRY DAVID MELO MORALES", "localidad": "Ciudad Bolívar", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEFRY DAVID MELO MORALES. Deporte(s): Judo. Localidad: Ciudad Bolívar. Resolución R-D Nº 792 / actualización Nº 929.0. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3042168921', phone),
      email       = COALESCE('judoreydeltatami@gmail.com', email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "792", "resolucion_actualizacion": "929.0", "fecha_inicio": "2022-08-05", "fecha_fin": "2027-08-05", "presidente": "JEFRY DAVID MELO MORALES", "localidad": "Ciudad Bolívar", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-rey-del-tatami-792';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3042168921', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LEGIONARIOS FC  (IDRD-CLUB-club-deportivo-legionarios-fc-954)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-legionarios-fc-954';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LEGIONARIOS FC',
      'Presidente: JERSSON ANDRES GONZALEZ DELGADO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 954. Vigente hasta 2030-09-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3176250027',
      'legionariosfc2517@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-legionarios-fc-954',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-legionarios-fc-954', v_school_id, '{"resolucion_rd": "954", "resolucion_actualizacion": null, "fecha_inicio": "2025-09-12", "fecha_fin": "2030-09-12", "presidente": "JERSSON ANDRES GONZALEZ DELGADO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JERSSON ANDRES GONZALEZ DELGADO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 954. Vigente hasta 2030-09-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3176250027', phone),
      email       = COALESCE('legionariosfc2517@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "954", "resolucion_actualizacion": null, "fecha_inicio": "2025-09-12", "fecha_fin": "2030-09-12", "presidente": "JERSSON ANDRES GONZALEZ DELGADO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-legionarios-fc-954';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3176250027', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO UNDERGROUND PARK BMX CLUB  (IDRD-CLUB-club-deportivo-underground-park-bmx-club-953)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-underground-park-bmx-club-953';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO UNDERGROUND PARK BMX CLUB',
      'Presidente: HERNAN ALFONSO CORTÃS NAVARRO. Deporte(s): Ciclismo. Localidad: Usaquén. Resolución R-D Nº 953. Vigente hasta 2030-09-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3157622889',
      'undergroundparkco@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-underground-park-bmx-club-953',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-underground-park-bmx-club-953', v_school_id, '{"resolucion_rd": "953", "resolucion_actualizacion": null, "fecha_inicio": "2025-09-12", "fecha_fin": "2030-09-12", "presidente": "HERNAN ALFONSO CORTÃS NAVARRO", "localidad": "Usaquén", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HERNAN ALFONSO CORTÃS NAVARRO. Deporte(s): Ciclismo. Localidad: Usaquén. Resolución R-D Nº 953. Vigente hasta 2030-09-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3157622889', phone),
      email       = COALESCE('undergroundparkco@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "953", "resolucion_actualizacion": null, "fecha_inicio": "2025-09-12", "fecha_fin": "2030-09-12", "presidente": "HERNAN ALFONSO CORTÃS NAVARRO", "localidad": "Usaquén", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-underground-park-bmx-club-953';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3157622889', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTA SPEED SKATE  (IDRD-CLUB-club-deportivo-bogota-speed-skate-952)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-speed-skate-952';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTA SPEED SKATE',
      'Presidente: LISSETTE JOHANA FONSECA RODRÃGUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 952. Vigente hasta 2030-09-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3058176601',
      'bogota.speed.skate@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogota-speed-skate-952',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogota-speed-skate-952', v_school_id, '{"resolucion_rd": "952", "resolucion_actualizacion": null, "fecha_inicio": "2025-09-12", "fecha_fin": "2030-09-12", "presidente": "LISSETTE JOHANA FONSECA RODRÃGUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LISSETTE JOHANA FONSECA RODRÃGUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 952. Vigente hasta 2030-09-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3058176601', phone),
      email       = COALESCE('bogota.speed.skate@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "952", "resolucion_actualizacion": null, "fecha_inicio": "2025-09-12", "fecha_fin": "2030-09-12", "presidente": "LISSETTE JOHANA FONSECA RODRÃGUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-speed-skate-952';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3058176601', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TIRO CON ARCO LEGOLAS  (IDRD-CLUB-de-tiro-con-arco-legolas-478.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-tiro-con-arco-legolas-478.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TIRO CON ARCO LEGOLAS',
      'Presidente: LUZ MARINA PINZON ESPINOSA. Deporte(s): Tiro con arco. Localidad: Engativá. Resolución R-D Nº 478.0 / actualización Nº N/A. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3133632956',
      'luzmarinap19@hotmail.com',
      ARRAY['Tiro con arco']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-tiro-con-arco-legolas-478.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-tiro-con-arco-legolas-478.0', v_school_id, '{"resolucion_rd": "478.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2021-06-28", "fecha_fin": "2026-06-28", "presidente": "LUZ MARINA PINZON ESPINOSA", "localidad": "Engativá", "sports": ["Tiro con arco"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUZ MARINA PINZON ESPINOSA. Deporte(s): Tiro con arco. Localidad: Engativá. Resolución R-D Nº 478.0 / actualización Nº N/A. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133632956', phone),
      email       = COALESCE('luzmarinap19@hotmail.com', email),
      sports      = ARRAY['Tiro con arco']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "478.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2021-06-28", "fecha_fin": "2026-06-28", "presidente": "LUZ MARINA PINZON ESPINOSA", "localidad": "Engativá", "sports": ["Tiro con arco"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-tiro-con-arco-legolas-478.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3133632956', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NATACIÃâN CON ESTILO  (IDRD-CLUB-club-deportivo-nataciaan-con-estilo-1180)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-nataciaan-con-estilo-1180';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NATACIÃâN CON ESTILO',
      'Presidente: CARLOSARTURO BELLO PIRAQUIVE. Deporte(s): Natación. Localidad: Ciudad Bolívar. Resolución R-D Nº 1180. Vigente hasta 2030-10-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3115180060',
      'cabp1972@hotmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-nataciaan-con-estilo-1180',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-nataciaan-con-estilo-1180', v_school_id, '{"resolucion_rd": "1180", "resolucion_actualizacion": null, "fecha_inicio": "23-10-2025", "fecha_fin": "2030-10-23", "presidente": "CARLOSARTURO BELLO PIRAQUIVE", "localidad": "Ciudad Bolívar", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOSARTURO BELLO PIRAQUIVE. Deporte(s): Natación. Localidad: Ciudad Bolívar. Resolución R-D Nº 1180. Vigente hasta 2030-10-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115180060', phone),
      email       = COALESCE('cabp1972@hotmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1180", "resolucion_actualizacion": null, "fecha_inicio": "23-10-2025", "fecha_fin": "2030-10-23", "presidente": "CARLOSARTURO BELLO PIRAQUIVE", "localidad": "Ciudad Bolívar", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-nataciaan-con-estilo-1180';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3115180060', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EBRA SPORT POLE CLUB  (IDRD-CLUB-club-deportivo-ebra-sport-pole-club-1181)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ebra-sport-pole-club-1181';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EBRA SPORT POLE CLUB',
      'Presidente: YINELAQUESADA VELA. Deporte(s): Pole Sport. Localidad: Usaquén. Resolución R-D Nº 1181. Vigente hasta 2030-10-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3143996488',
      'espcbogota@gmail.com.',
      ARRAY['Pole Sport']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ebra-sport-pole-club-1181',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ebra-sport-pole-club-1181', v_school_id, '{"resolucion_rd": "1181", "resolucion_actualizacion": null, "fecha_inicio": "23-10-2025", "fecha_fin": "2030-10-23", "presidente": "YINELAQUESADA VELA", "localidad": "Usaquén", "sports": ["Pole Sport"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YINELAQUESADA VELA. Deporte(s): Pole Sport. Localidad: Usaquén. Resolución R-D Nº 1181. Vigente hasta 2030-10-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143996488', phone),
      email       = COALESCE('espcbogota@gmail.com.', email),
      sports      = ARRAY['Pole Sport']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1181", "resolucion_actualizacion": null, "fecha_inicio": "23-10-2025", "fecha_fin": "2030-10-23", "presidente": "YINELAQUESADA VELA", "localidad": "Usaquén", "sports": ["Pole Sport"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ebra-sport-pole-club-1181';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3143996488', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TIFONES  (IDRD-CLUB-club-deportivo-tifones-1182)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tifones-1182';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TIFONES',
      'Presidente: OSCARANDRES HERRERA BELTRAN. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1182. Vigente hasta 2030-10-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3107264460',
      'clubtifonesbaloncesto@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tifones-1182',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tifones-1182', v_school_id, '{"resolucion_rd": "1182", "resolucion_actualizacion": null, "fecha_inicio": "23-10-2025", "fecha_fin": "2030-10-23", "presidente": "OSCARANDRES HERRERA BELTRAN", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCARANDRES HERRERA BELTRAN. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1182. Vigente hasta 2030-10-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107264460', phone),
      email       = COALESCE('clubtifonesbaloncesto@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1182", "resolucion_actualizacion": null, "fecha_inicio": "23-10-2025", "fecha_fin": "2030-10-23", "presidente": "OSCARANDRES HERRERA BELTRAN", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tifones-1182';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3107264460', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TIRO CON ARCO ULISES ARCHERY  (IDRD-CLUB-de-tiro-con-arco-ulises-archery-1015.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-tiro-con-arco-ulises-archery-1015.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TIRO CON ARCO ULISES ARCHERY',
      'Presidente: MARÃA CAMILA TORRES MENDOZA. Localidad: Suba. Resolución R-D Nº 1015.0 / actualización Nº N/A. Vigente hasta 2027-09-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3107874818',
      'club.ulises.+archery@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-tiro-con-arco-ulises-archery-1015.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-tiro-con-arco-ulises-archery-1015.0', v_school_id, '{"resolucion_rd": "1015.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2022-09-07", "fecha_fin": "2027-09-07", "presidente": "MARÃA CAMILA TORRES MENDOZA", "localidad": "Suba", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃA CAMILA TORRES MENDOZA. Localidad: Suba. Resolución R-D Nº 1015.0 / actualización Nº N/A. Vigente hasta 2027-09-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107874818', phone),
      email       = COALESCE('club.ulises.+archery@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1015.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2022-09-07", "fecha_fin": "2027-09-07", "presidente": "MARÃA CAMILA TORRES MENDOZA", "localidad": "Suba", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-tiro-con-arco-ulises-archery-1015.0';
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
-- CLUB DEPORTIVO WINNERS VOLLEY CLUB  (IDRD-CLUB-club-deportivo-winners-volley-club-1192)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-winners-volley-club-1192';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WINNERS VOLLEY CLUB',
      'Presidente: JUAN PABLO GUZMAN URIBE. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 1192. Vigente hasta 2030-10-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3044431255',
      'winnersvoley@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-winners-volley-club-1192',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-winners-volley-club-1192', v_school_id, '{"resolucion_rd": "1192", "resolucion_actualizacion": null, "fecha_inicio": "27-10-2025", "fecha_fin": "2030-10-27", "presidente": "JUAN PABLO GUZMAN URIBE", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO GUZMAN URIBE. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 1192. Vigente hasta 2030-10-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3044431255', phone),
      email       = COALESCE('winnersvoley@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1192", "resolucion_actualizacion": null, "fecha_inicio": "27-10-2025", "fecha_fin": "2030-10-27", "presidente": "JUAN PABLO GUZMAN URIBE", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-winners-volley-club-1192';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3044431255', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TRION  (IDRD-CLUB-club-deportivo-trion-1154)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-trion-1154';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TRION',
      'Presidente: DANIEL CAMILO CASTELLANO TORRES. Deporte(s): Ciclismo, Natación. Localidad: Fontibón. Resolución R-D Nº 1154. Vigente hasta 2030-10-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3105597058',
      'fundacionelcastor@gmail.com',
      ARRAY['Ciclismo','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-trion-1154',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-trion-1154', v_school_id, '{"resolucion_rd": "1154", "resolucion_actualizacion": null, "fecha_inicio": "27-10-2025", "fecha_fin": "2030-10-27", "presidente": "DANIEL CAMILO CASTELLANO TORRES", "localidad": "Fontibón", "sports": ["Ciclismo", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL CAMILO CASTELLANO TORRES. Deporte(s): Ciclismo, Natación. Localidad: Fontibón. Resolución R-D Nº 1154. Vigente hasta 2030-10-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105597058', phone),
      email       = COALESCE('fundacionelcastor@gmail.com', email),
      sports      = ARRAY['Ciclismo','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1154", "resolucion_actualizacion": null, "fecha_inicio": "27-10-2025", "fecha_fin": "2030-10-27", "presidente": "DANIEL CAMILO CASTELLANO TORRES", "localidad": "Fontibón", "sports": ["Ciclismo", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-trion-1154';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3105597058', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTA MINAS BC  (IDRD-CLUB-club-deportivo-bogota-minas-bc-1198)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-minas-bc-1198';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTA MINAS BC',
      'Presidente: FERNANDO BELTRAN CASAS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1198. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3215578485',
      'bogotaminasbcfutsal@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogota-minas-bc-1198',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogota-minas-bc-1198', v_school_id, '{"resolucion_rd": "1198", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "FERNANDO BELTRAN CASAS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FERNANDO BELTRAN CASAS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1198. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3215578485', phone),
      email       = COALESCE('bogotaminasbcfutsal@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1198", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "FERNANDO BELTRAN CASAS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-minas-bc-1198';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3215578485', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLÃâ°TICO LEONAS FOOTBALL CLUB  (IDRD-CLUB-club-deportivo-atlaatico-leonas-football-1200)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlaatico-leonas-football-1200';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLÃâ°TICO LEONAS FOOTBALL CLUB',
      'Presidente: DIANA KARINA MORENO HERRERA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1200. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3138699410',
      'atleticoleonasfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlaatico-leonas-football-1200',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlaatico-leonas-football-1200', v_school_id, '{"resolucion_rd": "1200", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "DIANA KARINA MORENO HERRERA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA KARINA MORENO HERRERA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1200. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138699410', phone),
      email       = COALESCE('atleticoleonasfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1200", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "DIANA KARINA MORENO HERRERA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlaatico-leonas-football-1200';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3138699410', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTÃÂ CITY  (IDRD-CLUB-club-deportivo-bogotaa-city-1966)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogotaa-city-1966';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTÃÂ CITY',
      'Presidente: MAURICIO CAJICA MARTINEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1966. Vigente hasta 2030-01-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3213328962',
      'contacto@bogotacity.com.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogotaa-city-1966',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogotaa-city-1966', v_school_id, '{"resolucion_rd": "1966", "resolucion_actualizacion": null, "fecha_inicio": "13-01-2025", "fecha_fin": "2030-01-13", "presidente": "MAURICIO CAJICA MARTINEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAURICIO CAJICA MARTINEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1966. Vigente hasta 2030-01-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213328962', phone),
      email       = COALESCE('contacto@bogotacity.com.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1966", "resolucion_actualizacion": null, "fecha_inicio": "13-01-2025", "fecha_fin": "2030-01-13", "presidente": "MAURICIO CAJICA MARTINEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogotaa-city-1966';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3213328962', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KIMURA  (IDRD-CLUB-club-deportivo-kimura-578)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kimura-578';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KIMURA',
      'Presidente: DIANA MARCELA CASTILLO NAVARRETE. Deporte(s): Jiujitsu. Localidad: Ciudad Bolívar. Resolución R-D Nº 578. Vigente hasta 2030-06-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3212263807',
      'clubkimura@gmail.com',
      ARRAY['Jiujitsu']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kimura-578',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kimura-578', v_school_id, '{"resolucion_rd": "578", "resolucion_actualizacion": null, "fecha_inicio": "06-06-2025", "fecha_fin": "2030-06-06", "presidente": "DIANA MARCELA CASTILLO NAVARRETE", "localidad": "Ciudad Bolívar", "sports": ["Jiujitsu"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA MARCELA CASTILLO NAVARRETE. Deporte(s): Jiujitsu. Localidad: Ciudad Bolívar. Resolución R-D Nº 578. Vigente hasta 2030-06-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212263807', phone),
      email       = COALESCE('clubkimura@gmail.com', email),
      sports      = ARRAY['Jiujitsu']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "578", "resolucion_actualizacion": null, "fecha_inicio": "06-06-2025", "fecha_fin": "2030-06-06", "presidente": "DIANA MARCELA CASTILLO NAVARRETE", "localidad": "Ciudad Bolívar", "sports": ["Jiujitsu"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kimura-578';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3212263807', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GLOBAL GYMNASTICS  (IDRD-CLUB-club-deportivo-global-gymnastics-282)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-global-gymnastics-282';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GLOBAL GYMNASTICS',
      'Presidente: JOHAN SEBASTÃÂAN SARMIENTO LÃâPEZ. Deporte(s): Gimnasia. Localidad: Suba. Resolución R-D Nº 282. Vigente hasta 2030-03-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3507913327',
      'globalgymnasticscolombia@gmail.com',
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-global-gymnastics-282',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-global-gymnastics-282', v_school_id, '{"resolucion_rd": "282", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2025", "fecha_fin": "2030-03-31", "presidente": "JOHAN SEBASTÃÂAN SARMIENTO LÃâPEZ", "localidad": "Suba", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHAN SEBASTÃÂAN SARMIENTO LÃâPEZ. Deporte(s): Gimnasia. Localidad: Suba. Resolución R-D Nº 282. Vigente hasta 2030-03-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3507913327', phone),
      email       = COALESCE('globalgymnasticscolombia@gmail.com', email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "282", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2025", "fecha_fin": "2030-03-31", "presidente": "JOHAN SEBASTÃÂAN SARMIENTO LÃâPEZ", "localidad": "Suba", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-global-gymnastics-282';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3507913327', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VERDEAMARELLO FUTBOL CLUB  (IDRD-CLUB-verdeamarello-futbol-club-987)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-verdeamarello-futbol-club-987';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VERDEAMARELLO FUTBOL CLUB',
      'Presidente: STIVEN VARGAS REYES. Localidad: Chapinero. Resolución R-D Nº 987. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3232491701',
      'verdeamarellof.c31@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'verdeamarello-futbol-club-987',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-verdeamarello-futbol-club-987', v_school_id, '{"resolucion_rd": "987", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "STIVEN VARGAS REYES", "localidad": "Chapinero", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: STIVEN VARGAS REYES. Localidad: Chapinero. Resolución R-D Nº 987. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3232491701', phone),
      email       = COALESCE('verdeamarellof.c31@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "987", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "STIVEN VARGAS REYES", "localidad": "Chapinero", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-verdeamarello-futbol-club-987';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3232491701', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PEQUEÃâOS TITANES FC  (IDRD-CLUB-club-deportivo-pequeaaos-titanes-fc-1110)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pequeaaos-titanes-fc-1110';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PEQUEÃâOS TITANES FC',
      'Presidente: UBALDO JOSEÃÅÃÂ DIÃÅÃÂAZ RIVERA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1110. Vigente hasta 2030-10-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3118786778',
      'pequenostitanesfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pequeaaos-titanes-fc-1110',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pequeaaos-titanes-fc-1110', v_school_id, '{"resolucion_rd": "1110", "resolucion_actualizacion": null, "fecha_inicio": "09-10-2025", "fecha_fin": "2030-10-09", "presidente": "UBALDO JOSEÃÅÃÂ DIÃÅÃÂAZ RIVERA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: UBALDO JOSEÃÅÃÂ DIÃÅÃÂAZ RIVERA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1110. Vigente hasta 2030-10-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118786778', phone),
      email       = COALESCE('pequenostitanesfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1110", "resolucion_actualizacion": null, "fecha_inicio": "09-10-2025", "fecha_fin": "2030-10-09", "presidente": "UBALDO JOSEÃÅÃÂ DIÃÅÃÂAZ RIVERA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pequeaaos-titanes-fc-1110';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3118786778', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUTBOL CLUB FORTALEZA CAPITALINA  (IDRD-CLUB-club-deportivo-futbol-club-fortaleza-cap-507)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-futbol-club-fortaleza-cap-507';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUTBOL CLUB FORTALEZA CAPITALINA',
      'Presidente: DANILO ALFONSO GONZALEZ ALBA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 507. Vigente hasta 2030-05-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3015970669',
      'fortalezacapitalina@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-futbol-club-fortaleza-cap-507',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-futbol-club-fortaleza-cap-507', v_school_id, '{"resolucion_rd": "507", "resolucion_actualizacion": null, "fecha_inicio": "26-05-2025", "fecha_fin": "2030-05-26", "presidente": "DANILO ALFONSO GONZALEZ ALBA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANILO ALFONSO GONZALEZ ALBA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 507. Vigente hasta 2030-05-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3015970669', phone),
      email       = COALESCE('fortalezacapitalina@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "507", "resolucion_actualizacion": null, "fecha_inicio": "26-05-2025", "fecha_fin": "2030-05-26", "presidente": "DANILO ALFONSO GONZALEZ ALBA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-futbol-club-fortaleza-cap-507';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3015970669', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CAZUCA FUTBOL CLUB  (IDRD-CLUB-club-deportivo-cazuca-futbol-club-357)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cazuca-futbol-club-357';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CAZUCA FUTBOL CLUB',
      'Presidente: JOSE DAVID OSORIO CASTRO. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 357. Vigente hasta 2030-04-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3046670842',
      'david.osorio@tiempodejuego.org',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cazuca-futbol-club-357',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cazuca-futbol-club-357', v_school_id, '{"resolucion_rd": "357", "resolucion_actualizacion": null, "fecha_inicio": "22-04-2025", "fecha_fin": "2030-04-22", "presidente": "JOSE DAVID OSORIO CASTRO", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE DAVID OSORIO CASTRO. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 357. Vigente hasta 2030-04-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3046670842', phone),
      email       = COALESCE('david.osorio@tiempodejuego.org', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "357", "resolucion_actualizacion": null, "fecha_inicio": "22-04-2025", "fecha_fin": "2030-04-22", "presidente": "JOSE DAVID OSORIO CASTRO", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cazuca-futbol-club-357';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3046670842', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE TAEKWONDO KORYO  (IDRD-CLUB-club-de-taekwondo-koryo-1583)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-taekwondo-koryo-1583';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE TAEKWONDO KORYO',
      'Presidente: FABIO HERNANDO BUSTOS ALARCON. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1583. Vigente hasta 2030-01-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3134680960',
      'tkdkoryo17@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-taekwondo-koryo-1583',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-taekwondo-koryo-1583', v_school_id, '{"resolucion_rd": "1583", "resolucion_actualizacion": null, "fecha_inicio": "11-01-2025", "fecha_fin": "2030-01-11", "presidente": "FABIO HERNANDO BUSTOS ALARCON", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIO HERNANDO BUSTOS ALARCON. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1583. Vigente hasta 2030-01-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134680960', phone),
      email       = COALESCE('tkdkoryo17@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1583", "resolucion_actualizacion": null, "fecha_inicio": "11-01-2025", "fecha_fin": "2030-01-11", "presidente": "FABIO HERNANDO BUSTOS ALARCON", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-taekwondo-koryo-1583';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3134680960', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA ACADEMIA  (IDRD-CLUB-club-deportivo-la-academia-1172)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-academia-1172';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA ACADEMIA',
      'Presidente: LUIS ALBERTO GONZÃÂLEZ RODRÃÂGUEZ. Deporte(s): Tejo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1172. Vigente hasta 2030-10-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3112744296',
      'tejoalgon@hotmail.com',
      ARRAY['Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-academia-1172',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-academia-1172', v_school_id, '{"resolucion_rd": "1172", "resolucion_actualizacion": null, "fecha_inicio": "22-10-2025", "fecha_fin": "2030-10-22", "presidente": "LUIS ALBERTO GONZÃÂLEZ RODRÃÂGUEZ", "localidad": "Ciudad Bolívar", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALBERTO GONZÃÂLEZ RODRÃÂGUEZ. Deporte(s): Tejo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1172. Vigente hasta 2030-10-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112744296', phone),
      email       = COALESCE('tejoalgon@hotmail.com', email),
      sports      = ARRAY['Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1172", "resolucion_actualizacion": null, "fecha_inicio": "22-10-2025", "fecha_fin": "2030-10-22", "presidente": "LUIS ALBERTO GONZÃÂLEZ RODRÃÂGUEZ", "localidad": "Ciudad Bolívar", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-academia-1172';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3112744296', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SKATERS MOUNTAIN  (IDRD-CLUB-club-deportivo-skaters-mountain-1173)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-skaters-mountain-1173';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SKATERS MOUNTAIN',
      'Presidente: DIEGO ALEJANDRO BARON FRANCO. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1173. Vigente hasta 2030-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3247715452',
      'skatersbogota@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-skaters-mountain-1173',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-skaters-mountain-1173', v_school_id, '{"resolucion_rd": "1173", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2025", "fecha_fin": "2030-12-10", "presidente": "DIEGO ALEJANDRO BARON FRANCO", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ALEJANDRO BARON FRANCO. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1173. Vigente hasta 2030-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3247715452', phone),
      email       = COALESCE('skatersbogota@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1173", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2025", "fecha_fin": "2030-12-10", "presidente": "DIEGO ALEJANDRO BARON FRANCO", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-skaters-mountain-1173';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3247715452', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAVATE FENIX SOLAR  (IDRD-CLUB-club-deportivo-savate-fenix-solar-1764.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-savate-fenix-solar-1764.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAVATE FENIX SOLAR',
      'Presidente: CARLOS ANDRES CONTRERAS RENTERIA. Deporte(s): Savate. Localidad: Kennedy. Resolución R-D Nº 1764.0 / actualización Nº N/A. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3102224020',
      'escuelafenixsolar@gmail.com',
      ARRAY['Savate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-savate-fenix-solar-1764.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-savate-fenix-solar-1764.0', v_school_id, '{"resolucion_rd": "1764.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-18", "fecha_fin": "2029-01-17", "presidente": "CARLOS ANDRES CONTRERAS RENTERIA", "localidad": "Kennedy", "sports": ["Savate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRES CONTRERAS RENTERIA. Deporte(s): Savate. Localidad: Kennedy. Resolución R-D Nº 1764.0 / actualización Nº N/A. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102224020', phone),
      email       = COALESCE('escuelafenixsolar@gmail.com', email),
      sports      = ARRAY['Savate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1764.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-18", "fecha_fin": "2029-01-17", "presidente": "CARLOS ANDRES CONTRERAS RENTERIA", "localidad": "Kennedy", "sports": ["Savate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-savate-fenix-solar-1764.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3102224020', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TIRO CONASEGUR  (IDRD-CLUB-club-deportivo-de-tiro-conasegur-1193)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-tiro-conasegur-1193';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TIRO CONASEGUR',
      'Presidente: JOSÃâ° DE JESÃÅ¡S HERNÃÂNDEZ ROSILLO. Deporte(s): Tiro deportivo. Localidad: Barrios Unidos. Resolución R-D Nº 1193. Vigente hasta 2030-10-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3233204009',
      'clubclaraval@gmail.com',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-tiro-conasegur-1193',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-tiro-conasegur-1193', v_school_id, '{"resolucion_rd": "1193", "resolucion_actualizacion": null, "fecha_inicio": "27-10-2025", "fecha_fin": "2030-10-27", "presidente": "JOSÃâ° DE JESÃÅ¡S HERNÃÂNDEZ ROSILLO", "localidad": "Barrios Unidos", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃâ° DE JESÃÅ¡S HERNÃÂNDEZ ROSILLO. Deporte(s): Tiro deportivo. Localidad: Barrios Unidos. Resolución R-D Nº 1193. Vigente hasta 2030-10-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3233204009', phone),
      email       = COALESCE('clubclaraval@gmail.com', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1193", "resolucion_actualizacion": null, "fecha_inicio": "27-10-2025", "fecha_fin": "2030-10-27", "presidente": "JOSÃâ° DE JESÃÅ¡S HERNÃÂNDEZ ROSILLO", "localidad": "Barrios Unidos", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-tiro-conasegur-1193';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3233204009', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COLOMBO FRANCES SAVATE  (IDRD-CLUB-colombo-frances-savate-822.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-colombo-frances-savate-822.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COLOMBO FRANCES SAVATE',
      'Presidente: JOHANNA KATHERINE MERLO MUÃOZ. Deporte(s): Savate. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 822.0 / actualización Nº N/A. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3144454996',
      'johanna8507@gmail.com',
      ARRAY['Savate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'colombo-frances-savate-822.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-colombo-frances-savate-822.0', v_school_id, '{"resolucion_rd": "822.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2021-10-12", "fecha_fin": "2026-10-12", "presidente": "JOHANNA KATHERINE MERLO MUÃOZ", "localidad": "Rafael Uribe Uribe", "sports": ["Savate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANNA KATHERINE MERLO MUÃOZ. Deporte(s): Savate. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 822.0 / actualización Nº N/A. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144454996', phone),
      email       = COALESCE('johanna8507@gmail.com', email),
      sports      = ARRAY['Savate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "822.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2021-10-12", "fecha_fin": "2026-10-12", "presidente": "JOHANNA KATHERINE MERLO MUÃOZ", "localidad": "Rafael Uribe Uribe", "sports": ["Savate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-colombo-frances-savate-822.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3144454996', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GRANDES DE CORAZÃâN  (IDRD-CLUB-club-deportivo-grandes-de-corazaan-1197)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-grandes-de-corazaan-1197';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GRANDES DE CORAZÃâN',
      'Presidente: JULIO ERNESTO CLAVIJO MAPE. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 1197. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3112154028',
      'clubdeportivograndesdecorazon@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-grandes-de-corazaan-1197',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-grandes-de-corazaan-1197', v_school_id, '{"resolucion_rd": "1197", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "JULIO ERNESTO CLAVIJO MAPE", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIO ERNESTO CLAVIJO MAPE. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 1197. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112154028', phone),
      email       = COALESCE('clubdeportivograndesdecorazon@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1197", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "JULIO ERNESTO CLAVIJO MAPE", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-grandes-de-corazaan-1197';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3112154028', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA COLINA FC  (IDRD-CLUB-club-deportivo-la-colina-fc-1199)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-colina-fc-1199';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA COLINA FC',
      'Presidente: MARÃÂA CATALINA BAHAMON BAHAMON. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1199. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3044742403',
      'oscar17.rueda@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-colina-fc-1199',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-colina-fc-1199', v_school_id, '{"resolucion_rd": "1199", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "MARÃÂA CATALINA BAHAMON BAHAMON", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃÂA CATALINA BAHAMON BAHAMON. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1199. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3044742403', phone),
      email       = COALESCE('oscar17.rueda@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1199", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "MARÃÂA CATALINA BAHAMON BAHAMON", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-colina-fc-1199';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3044742403', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE CICLISMO ROBERTO Ã¢â¬ÅOSOÃ¢â¬Â SÃÂNCHEZ  (IDRD-CLUB-club-de-ciclismo-roberto-aaaosoaaa-saanc-1201)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-ciclismo-roberto-aaaosoaaa-saanc-1201';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE CICLISMO ROBERTO Ã¢â¬ÅOSOÃ¢â¬Â SÃÂNCHEZ',
      'Presidente: ROBERTO ANDRÃâ°S SÃÂNCHEZ LÃâPEZ. Deporte(s): Ciclismo. Localidad: Puente Aranda. Resolución R-D Nº 1201. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3123577412',
      'ososanchez54@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-ciclismo-roberto-aaaosoaaa-saanc-1201',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-ciclismo-roberto-aaaosoaaa-saanc-1201', v_school_id, '{"resolucion_rd": "1201", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "ROBERTO ANDRÃâ°S SÃÂNCHEZ LÃâPEZ", "localidad": "Puente Aranda", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROBERTO ANDRÃâ°S SÃÂNCHEZ LÃâPEZ. Deporte(s): Ciclismo. Localidad: Puente Aranda. Resolución R-D Nº 1201. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123577412', phone),
      email       = COALESCE('ososanchez54@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1201", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "ROBERTO ANDRÃâ°S SÃÂNCHEZ LÃâPEZ", "localidad": "Puente Aranda", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-ciclismo-roberto-aaaosoaaa-saanc-1201';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3123577412', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ARCANGELES  (IDRD-CLUB-club-deportivo-arcangeles-1024)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-arcangeles-1024';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ARCANGELES',
      'Presidente: CAMILO EDUARDO SALAZAR LOPEZ. Deporte(s): Tenis de mesa, Ciclismo, Tenis En Silla De Ruedas, Para Atletismo, Para Powerlifting, Para Nataciã³N, Rugby En Silla De Ruedas, Voleibol Sentado, Futbol 5, Judo Visuales, Goalball, Bowling, Ajedrez Visuales, Esgrima En Silla De Ruedas, Ajedrez Fã­Sicos, Billar Fã­Sicos. Localidad: Usaquén. Resolución R-D Nº 1024. Vigente hasta 2026-08-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3336025204',
      'clubdeportivo@arcangeles.org',
      ARRAY['Tenis de mesa','Ciclismo','Tenis En Silla De Ruedas','Para Atletismo','Para Powerlifting','Para Nataciã³N','Rugby En Silla De Ruedas','Voleibol Sentado','Futbol 5','Judo Visuales','Goalball','Bowling','Ajedrez Visuales','Esgrima En Silla De Ruedas','Ajedrez Fã­Sicos','Billar Fã­Sicos']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-arcangeles-1024',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-arcangeles-1024', v_school_id, '{"resolucion_rd": "1024", "resolucion_actualizacion": null, "fecha_inicio": "09-08-2021", "fecha_fin": "2026-08-09", "presidente": "CAMILO EDUARDO SALAZAR LOPEZ", "localidad": "Usaquén", "sports": ["Tenis de mesa", "Ciclismo", "Tenis En Silla De Ruedas", "Para Atletismo", "Para Powerlifting", "Para Nataciã³N", "Rugby En Silla De Ruedas", "Voleibol Sentado", "Futbol 5", "Judo Visuales", "Goalball", "Bowling", "Ajedrez Visuales", "Esgrima En Silla De Ruedas", "Ajedrez Fã­Sicos", "Billar Fã­Sicos"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO EDUARDO SALAZAR LOPEZ. Deporte(s): Tenis de mesa, Ciclismo, Tenis En Silla De Ruedas, Para Atletismo, Para Powerlifting, Para Nataciã³N, Rugby En Silla De Ruedas, Voleibol Sentado, Futbol 5, Judo Visuales, Goalball, Bowling, Ajedrez Visuales, Esgrima En Silla De Ruedas, Ajedrez Fã­Sicos, Billar Fã­Sicos. Localidad: Usaquén. Resolución R-D Nº 1024. Vigente hasta 2026-08-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3336025204', phone),
      email       = COALESCE('clubdeportivo@arcangeles.org', email),
      sports      = ARRAY['Tenis de mesa','Ciclismo','Tenis En Silla De Ruedas','Para Atletismo','Para Powerlifting','Para Nataciã³N','Rugby En Silla De Ruedas','Voleibol Sentado','Futbol 5','Judo Visuales','Goalball','Bowling','Ajedrez Visuales','Esgrima En Silla De Ruedas','Ajedrez Fã­Sicos','Billar Fã­Sicos']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1024", "resolucion_actualizacion": null, "fecha_inicio": "09-08-2021", "fecha_fin": "2026-08-09", "presidente": "CAMILO EDUARDO SALAZAR LOPEZ", "localidad": "Usaquén", "sports": ["Tenis de mesa", "Ciclismo", "Tenis En Silla De Ruedas", "Para Atletismo", "Para Powerlifting", "Para Nataciã³N", "Rugby En Silla De Ruedas", "Voleibol Sentado", "Futbol 5", "Judo Visuales", "Goalball", "Bowling", "Ajedrez Visuales", "Esgrima En Silla De Ruedas", "Ajedrez Fã­Sicos", "Billar Fã­Sicos"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-arcangeles-1024';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3336025204', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LAZIO GREEN F.C.  (IDRD-CLUB-club-deportivo-lazio-green-fc-32.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lazio-green-fc-32.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LAZIO GREEN F.C.',
      'Presidente: CARLOS ALBERTO RUIZ CARDOZO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 32.0 / actualización Nº N/A. Vigente hasta 2029-01-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3134709793',
      'mcortes.navas@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lazio-green-fc-32.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lazio-green-fc-32.0', v_school_id, '{"resolucion_rd": "32.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-26", "fecha_fin": "2029-01-26", "presidente": "CARLOS ALBERTO RUIZ CARDOZO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALBERTO RUIZ CARDOZO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 32.0 / actualización Nº N/A. Vigente hasta 2029-01-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134709793', phone),
      email       = COALESCE('mcortes.navas@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "32.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-26", "fecha_fin": "2029-01-26", "presidente": "CARLOS ALBERTO RUIZ CARDOZO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lazio-green-fc-32.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3134709793', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KUMA  (IDRD-CLUB-club-deportivo-kuma-60.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kuma-60.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KUMA',
      'Presidente: MAURICIO OROZCO SOTO. Deporte(s): Jiujitsu. Localidad: San Cristóbal. Resolución R-D Nº 60.0 / actualización Nº N/A. Vigente hasta 2029-02-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3124596598',
      'kumaimperio@gmail.com',
      ARRAY['Jiujitsu']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kuma-60.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kuma-60.0', v_school_id, '{"resolucion_rd": "60.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-02", "fecha_fin": "2029-02-02", "presidente": "MAURICIO OROZCO SOTO", "localidad": "San Cristóbal", "sports": ["Jiujitsu"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAURICIO OROZCO SOTO. Deporte(s): Jiujitsu. Localidad: San Cristóbal. Resolución R-D Nº 60.0 / actualización Nº N/A. Vigente hasta 2029-02-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124596598', phone),
      email       = COALESCE('kumaimperio@gmail.com', email),
      sports      = ARRAY['Jiujitsu']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "60.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-02", "fecha_fin": "2029-02-02", "presidente": "MAURICIO OROZCO SOTO", "localidad": "San Cristóbal", "sports": ["Jiujitsu"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kuma-60.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3124596598', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO BODY MIND  (IDRD-CLUB-club-deportivo-de-taekwondo-body-mind-747)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-body-mind-747';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO BODY MIND',
      'Presidente: FRANCI YINETH MORENO CONTRERAS. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 747. Vigente hasta 2027-02-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3013168635',
      'centrodeportivobodymind@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-body-mind-747',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-body-mind-747', v_school_id, '{"resolucion_rd": "747", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2022", "fecha_fin": "2027-02-28", "presidente": "FRANCI YINETH MORENO CONTRERAS", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FRANCI YINETH MORENO CONTRERAS. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 747. Vigente hasta 2027-02-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013168635', phone),
      email       = COALESCE('centrodeportivobodymind@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "747", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2022", "fecha_fin": "2027-02-28", "presidente": "FRANCI YINETH MORENO CONTRERAS", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-body-mind-747';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3013168635', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE KICK BOXING BODY MIND BOGOTA  (IDRD-CLUB-club-deportivo-de-kick-boxing-body-mind--13.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-kick-boxing-body-mind--13.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE KICK BOXING BODY MIND BOGOTA',
      'Presidente: SAMIRA ALEJANDRA VANEGAS LOPEZ. Deporte(s): Kick Boxing. Localidad: Kennedy. Resolución R-D Nº 13.0 / actualización Nº N/A. Vigente hasta 2029-01-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '5517012',
      'centrodeportivobodymind@hotmail.com',
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-kick-boxing-body-mind--13.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-kick-boxing-body-mind--13.0', v_school_id, '{"resolucion_rd": "13.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-24", "fecha_fin": "2029-01-24", "presidente": "SAMIRA ALEJANDRA VANEGAS LOPEZ", "localidad": "Kennedy", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SAMIRA ALEJANDRA VANEGAS LOPEZ. Deporte(s): Kick Boxing. Localidad: Kennedy. Resolución R-D Nº 13.0 / actualización Nº N/A. Vigente hasta 2029-01-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5517012', phone),
      email       = COALESCE('centrodeportivobodymind@hotmail.com', email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "13.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-24", "fecha_fin": "2029-01-24", "presidente": "SAMIRA ALEJANDRA VANEGAS LOPEZ", "localidad": "Kennedy", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-kick-boxing-body-mind--13.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '5517012', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KMINOS  (IDRD-CLUB-club-deportivo-kminos-27.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kminos-27.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KMINOS',
      'Presidente: ARMANDO ENRIQUE CORTÃS TRUJILLO. Localidad: San Cristóbal. Resolución R-D Nº 27.0 / actualización Nº N/A. Vigente hasta 2029-01-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3246316319',
      'kminosclubdeportivo@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kminos-27.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kminos-27.0', v_school_id, '{"resolucion_rd": "27.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-26", "fecha_fin": "2029-01-26", "presidente": "ARMANDO ENRIQUE CORTÃS TRUJILLO", "localidad": "San Cristóbal", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ARMANDO ENRIQUE CORTÃS TRUJILLO. Localidad: San Cristóbal. Resolución R-D Nº 27.0 / actualización Nº N/A. Vigente hasta 2029-01-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3246316319', phone),
      email       = COALESCE('kminosclubdeportivo@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "27.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-26", "fecha_fin": "2029-01-26", "presidente": "ARMANDO ENRIQUE CORTÃS TRUJILLO", "localidad": "San Cristóbal", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kminos-27.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3246316319', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO M&J CAZADORES DE SUEÃOS  (IDRD-CLUB-club-deportivo-mj-cazadores-de-sueaos-28.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-mj-cazadores-de-sueaos-28.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO M&J CAZADORES DE SUEÃOS',
      'Presidente: PAOLA ALEJANDRA GALVIS HERNANDEZ. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 28.0 / actualización Nº N/A. Vigente hasta 2029-01-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3118560562',
      'jhodrago96@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-mj-cazadores-de-sueaos-28.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-mj-cazadores-de-sueaos-28.0', v_school_id, '{"resolucion_rd": "28.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-26", "fecha_fin": "2029-01-26", "presidente": "PAOLA ALEJANDRA GALVIS HERNANDEZ", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAOLA ALEJANDRA GALVIS HERNANDEZ. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 28.0 / actualización Nº N/A. Vigente hasta 2029-01-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118560562', phone),
      email       = COALESCE('jhodrago96@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "28.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-26", "fecha_fin": "2029-01-26", "presidente": "PAOLA ALEJANDRA GALVIS HERNANDEZ", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-mj-cazadores-de-sueaos-28.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3118560562', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOS ORIENTALES  (IDRD-CLUB-club-deportivo-los-orientales-29.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-orientales-29.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOS ORIENTALES',
      'Presidente: DIANA PATRICIA FAJARDO CUBIDES. Localidad: San Cristóbal. Resolución R-D Nº 29.0 / actualización Nº N/A. Vigente hasta 2029-01-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3112776968',
      'losorientalesclubdeportivo@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-los-orientales-29.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-los-orientales-29.0', v_school_id, '{"resolucion_rd": "29.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-26", "fecha_fin": "2029-01-26", "presidente": "DIANA PATRICIA FAJARDO CUBIDES", "localidad": "San Cristóbal", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA PATRICIA FAJARDO CUBIDES. Localidad: San Cristóbal. Resolución R-D Nº 29.0 / actualización Nº N/A. Vigente hasta 2029-01-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112776968', phone),
      email       = COALESCE('losorientalesclubdeportivo@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "29.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-26", "fecha_fin": "2029-01-26", "presidente": "DIANA PATRICIA FAJARDO CUBIDES", "localidad": "San Cristóbal", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-orientales-29.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3112776968', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CITY CLUB UNITED  (IDRD-CLUB-club-deportivo-city-club-united-1766)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-city-club-united-1766';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CITY CLUB UNITED',
      'Presidente: RAUL ORLANDO DELGADO CABIATIVA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1766. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3202798817',
      'contacto@funsoliun.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-city-club-united-1766',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-city-club-united-1766', v_school_id, '{"resolucion_rd": "1766", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "RAUL ORLANDO DELGADO CABIATIVA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAUL ORLANDO DELGADO CABIATIVA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1766. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202798817', phone),
      email       = COALESCE('contacto@funsoliun.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1766", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "RAUL ORLANDO DELGADO CABIATIVA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-city-club-united-1766';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3202798817', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE POKER ALL IN BOGOTA  (IDRD-CLUB-club-deportivo-de-poker-all-in-bogota-1689.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-poker-all-in-bogota-1689.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE POKER ALL IN BOGOTA',
      'Presidente: NICOLAS ARTURO SEGURA ZAMBRANO. Deporte(s): Pã³Ker. Localidad: Engativá. Resolución R-D Nº 1689.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3057639364',
      'clubdeportivoallinbogota@gmail.com',
      ARRAY['Pã³Ker']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-poker-all-in-bogota-1689.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-poker-all-in-bogota-1689.0', v_school_id, '{"resolucion_rd": "1689.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "NICOLAS ARTURO SEGURA ZAMBRANO", "localidad": "Engativá", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS ARTURO SEGURA ZAMBRANO. Deporte(s): Pã³Ker. Localidad: Engativá. Resolución R-D Nº 1689.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057639364', phone),
      email       = COALESCE('clubdeportivoallinbogota@gmail.com', email),
      sports      = ARRAY['Pã³Ker']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1689.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "NICOLAS ARTURO SEGURA ZAMBRANO", "localidad": "Engativá", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-poker-all-in-bogota-1689.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3057639364', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL ACADEMIA BOGOTA  (IDRD-CLUB-club-deportivo-real-academia-bogota-1683.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-academia-bogota-1683.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL ACADEMIA BOGOTA',
      'Presidente: MIGUEL ANGEL NIETO ORTIZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1683.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3194981523',
      'ef.realacademiabogota@gmail.com.',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-academia-bogota-1683.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-academia-bogota-1683.0', v_school_id, '{"resolucion_rd": "1683.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "MIGUEL ANGEL NIETO ORTIZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL NIETO ORTIZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1683.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3194981523', phone),
      email       = COALESCE('ef.realacademiabogota@gmail.com.', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1683.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "MIGUEL ANGEL NIETO ORTIZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-academia-bogota-1683.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3194981523', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CHURTA F.C  (IDRD-CLUB-club-deportivo-churta-fc-1191)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-churta-fc-1191';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CHURTA F.C',
      'Presidente: LILIANA ANDREA ORTÃÂZ VALDERRAMA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1191. Vigente hasta 2029-11-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3012416813',
      'churtafutbolclub@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-churta-fc-1191',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-churta-fc-1191', v_school_id, '{"resolucion_rd": "1191", "resolucion_actualizacion": null, "fecha_inicio": "12-11-2024", "fecha_fin": "2029-11-12", "presidente": "LILIANA ANDREA ORTÃÂZ VALDERRAMA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LILIANA ANDREA ORTÃÂZ VALDERRAMA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1191. Vigente hasta 2029-11-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012416813', phone),
      email       = COALESCE('churtafutbolclub@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1191", "resolucion_actualizacion": null, "fecha_inicio": "12-11-2024", "fecha_fin": "2029-11-12", "presidente": "LILIANA ANDREA ORTÃÂZ VALDERRAMA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-churta-fc-1191';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3012416813', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALONSO HURTADO WRESTLING CLUB  (IDRD-CLUB-club-deportivo-alonso-hurtado-wrestling--583)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alonso-hurtado-wrestling--583';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALONSO HURTADO WRESTLING CLUB',
      'Presidente: SANDRA LILIANA HERNANDEZ BERNAL. Deporte(s): Lucha. Localidad: Suba. Resolución R-D Nº 583. Vigente hasta 2027-07-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3192430173',
      'alonsohurtadowrestlingclub@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alonso-hurtado-wrestling--583',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alonso-hurtado-wrestling--583', v_school_id, '{"resolucion_rd": "583", "resolucion_actualizacion": null, "fecha_inicio": "27-07-2022", "fecha_fin": "2027-07-27", "presidente": "SANDRA LILIANA HERNANDEZ BERNAL", "localidad": "Suba", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA LILIANA HERNANDEZ BERNAL. Deporte(s): Lucha. Localidad: Suba. Resolución R-D Nº 583. Vigente hasta 2027-07-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3192430173', phone),
      email       = COALESCE('alonsohurtadowrestlingclub@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "583", "resolucion_actualizacion": null, "fecha_inicio": "27-07-2022", "fecha_fin": "2027-07-27", "presidente": "SANDRA LILIANA HERNANDEZ BERNAL", "localidad": "Suba", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alonso-hurtado-wrestling--583';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3192430173', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE POKER SANTA FE  (IDRD-CLUB-club-deportivo-de-poker-santa-fe-1678.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-poker-santa-fe-1678.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE POKER SANTA FE',
      'Presidente: YULAINE KATALINA GOMEZ VARGAS. Deporte(s): Pã³Ker. Localidad: Fontibón. Resolución R-D Nº 1678.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3226119896',
      'santafepokerclub@hotmail.com',
      ARRAY['Pã³Ker']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-poker-santa-fe-1678.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-poker-santa-fe-1678.0', v_school_id, '{"resolucion_rd": "1678.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "YULAINE KATALINA GOMEZ VARGAS", "localidad": "Fontibón", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YULAINE KATALINA GOMEZ VARGAS. Deporte(s): Pã³Ker. Localidad: Fontibón. Resolución R-D Nº 1678.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3226119896', phone),
      email       = COALESCE('santafepokerclub@hotmail.com', email),
      sports      = ARRAY['Pã³Ker']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1678.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "YULAINE KATALINA GOMEZ VARGAS", "localidad": "Fontibón", "sports": ["Pã³Ker"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-poker-santa-fe-1678.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3226119896', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SLAM FUTSAL  (IDRD-CLUB-club-deportivo-slam-futsal-1679.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-slam-futsal-1679.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SLAM FUTSAL',
      'Presidente: KAREN DANIELA TORRES SANCHEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1679.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3015441870',
      'clubslamfutsal@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-slam-futsal-1679.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-slam-futsal-1679.0', v_school_id, '{"resolucion_rd": "1679.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "KAREN DANIELA TORRES SANCHEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN DANIELA TORRES SANCHEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1679.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3015441870', phone),
      email       = COALESCE('clubslamfutsal@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1679.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "KAREN DANIELA TORRES SANCHEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-slam-futsal-1679.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3015441870', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL SKATE COLOMBIA  (IDRD-CLUB-club-deportivo-real-skate-colombia-1752.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-skate-colombia-1752.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL SKATE COLOMBIA',
      'Presidente: XIMENA ALEXANDRA MARTINEZ SUAN. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1752.0 / actualización Nº N/A. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3142404677',
      'clubrealskate@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-skate-colombia-1752.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-skate-colombia-1752.0', v_school_id, '{"resolucion_rd": "1752.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-18", "fecha_fin": "2029-01-18", "presidente": "XIMENA ALEXANDRA MARTINEZ SUAN", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: XIMENA ALEXANDRA MARTINEZ SUAN. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1752.0 / actualización Nº N/A. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142404677', phone),
      email       = COALESCE('clubrealskate@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1752.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-18", "fecha_fin": "2029-01-18", "presidente": "XIMENA ALEXANDRA MARTINEZ SUAN", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-skate-colombia-1752.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3142404677', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO UNION BEST CLUB (UBC)  (IDRD-CLUB-club-deportivo-union-best-club-ubc-647.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-union-best-club-ubc-647.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO UNION BEST CLUB (UBC)',
      'Presidente: NANCY BIBIANA SANCHEZ ROJAS. Deporte(s): Baloncesto. Localidad: Teusaquillo. Resolución R-D Nº 647.0 / actualización Nº N/A. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      NULL,
      'unionbasketball@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-union-best-club-ubc-647.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-union-best-club-ubc-647.0', v_school_id, '{"resolucion_rd": "647.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-06-04", "fecha_fin": "2029-06-04", "presidente": "NANCY BIBIANA SANCHEZ ROJAS", "localidad": "Teusaquillo", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NANCY BIBIANA SANCHEZ ROJAS. Deporte(s): Baloncesto. Localidad: Teusaquillo. Resolución R-D Nº 647.0 / actualización Nº N/A. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('unionbasketball@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "647.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-06-04", "fecha_fin": "2029-06-04", "presidente": "NANCY BIBIANA SANCHEZ ROJAS", "localidad": "Teusaquillo", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-union-best-club-ubc-647.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', NULL, 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB GUERREROS DE BOGOTA  (IDRD-CLUB-club-guerreros-de-bogota-644.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-guerreros-de-bogota-644.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB GUERREROS DE BOGOTA',
      'Presidente: SAUL EDUARDO LEON NUÃEZ. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 644.0 / actualización Nº N/A. Vigente hasta 2027-02-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      NULL,
      'clubguerrerosdebogota@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-guerreros-de-bogota-644.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-guerreros-de-bogota-644.0', v_school_id, '{"resolucion_rd": "644.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2022-02-04", "fecha_fin": "2027-02-04", "presidente": "SAUL EDUARDO LEON NUÃEZ", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SAUL EDUARDO LEON NUÃEZ. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 644.0 / actualización Nº N/A. Vigente hasta 2027-02-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('clubguerrerosdebogota@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "644.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2022-02-04", "fecha_fin": "2027-02-04", "presidente": "SAUL EDUARDO LEON NUÃEZ", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-guerreros-de-bogota-644.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', NULL, 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EUFORIA  (IDRD-CLUB-club-deportivo-euforia-643.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-euforia-643.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EUFORIA',
      'Presidente: JUAN FELIPE DÃAZ HOYOS. Deporte(s): Disco Volador. Localidad: Usaquén. Resolución R-D Nº 643.0 / actualización Nº N/A. Vigente hasta 2026-10-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      NULL,
      'euforiaultimate@gmail.com',
      ARRAY['Disco Volador']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-euforia-643.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-euforia-643.0', v_school_id, '{"resolucion_rd": "643.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2021-10-04", "fecha_fin": "2026-10-04", "presidente": "JUAN FELIPE DÃAZ HOYOS", "localidad": "Usaquén", "sports": ["Disco Volador"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN FELIPE DÃAZ HOYOS. Deporte(s): Disco Volador. Localidad: Usaquén. Resolución R-D Nº 643.0 / actualización Nº N/A. Vigente hasta 2026-10-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('euforiaultimate@gmail.com', email),
      sports      = ARRAY['Disco Volador']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "643.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2021-10-04", "fecha_fin": "2026-10-04", "presidente": "JUAN FELIPE DÃAZ HOYOS", "localidad": "Usaquén", "sports": ["Disco Volador"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-euforia-643.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', NULL, 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CATERPILLAR MOTOR  (IDRD-CLUB-club-deportivo-caterpillar-motor-341.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-caterpillar-motor-341.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CATERPILLAR MOTOR',
      'Presidente: MARIA HELENA CHAPARRO ECHEVERRY. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 341.0 / actualización Nº N/A. Vigente hasta 2029-03-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      NULL,
      'talentohumano@clubcaterpillarmotor.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-caterpillar-motor-341.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-caterpillar-motor-341.0', v_school_id, '{"resolucion_rd": "341.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-21", "fecha_fin": "2029-03-21", "presidente": "MARIA HELENA CHAPARRO ECHEVERRY", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA HELENA CHAPARRO ECHEVERRY. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 341.0 / actualización Nº N/A. Vigente hasta 2029-03-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('talentohumano@clubcaterpillarmotor.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "341.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-21", "fecha_fin": "2029-03-21", "presidente": "MARIA HELENA CHAPARRO ECHEVERRY", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-caterpillar-motor-341.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', NULL, 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PRONAT  (IDRD-CLUB-pronat-388.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-pronat-388.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PRONAT',
      'Presidente: CAMILO ALEJANDRO GAMBOA GÃMEZ. Deporte(s): Actividades Subacuaticas. Localidad: Fontibón. Resolución R-D Nº 388.0 / actualización Nº N/A. Vigente hasta 2029-04-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      NULL,
      'pronat.bogota@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'pronat-388.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-pronat-388.0', v_school_id, '{"resolucion_rd": "388.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-04-03", "fecha_fin": "2029-04-03", "presidente": "CAMILO ALEJANDRO GAMBOA GÃMEZ", "localidad": "Fontibón", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ALEJANDRO GAMBOA GÃMEZ. Deporte(s): Actividades Subacuaticas. Localidad: Fontibón. Resolución R-D Nº 388.0 / actualización Nº N/A. Vigente hasta 2029-04-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('pronat.bogota@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "388.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-04-03", "fecha_fin": "2029-04-03", "presidente": "CAMILO ALEJANDRO GAMBOA GÃMEZ", "localidad": "Fontibón", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-pronat-388.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', NULL, 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTÃ TENNIS CLUB CAMPESTRE  (IDRD-CLUB-club-deportivo-bogota-tennis-club-campes-244.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-tennis-club-campes-244.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTÃ TENNIS CLUB CAMPESTRE',
      'Presidente: LUIS FELIPE BARRIOS CADENA. Deporte(s): Golf, Natación, Tenis, Squash, Fútbol. Localidad: Suba. Resolución R-D Nº 244.0 / actualización Nº N/A. Vigente hasta 2029-03-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      NULL,
      'bogotatennis@btcc.com.co',
      ARRAY['Golf','Natación','Tenis','Squash','Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogota-tennis-club-campes-244.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogota-tennis-club-campes-244.0', v_school_id, '{"resolucion_rd": "244.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-18", "fecha_fin": "2029-03-18", "presidente": "LUIS FELIPE BARRIOS CADENA", "localidad": "Suba", "sports": ["Golf", "Natación", "Tenis", "Squash", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS FELIPE BARRIOS CADENA. Deporte(s): Golf, Natación, Tenis, Squash, Fútbol. Localidad: Suba. Resolución R-D Nº 244.0 / actualización Nº N/A. Vigente hasta 2029-03-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('bogotatennis@btcc.com.co', email),
      sports      = ARRAY['Golf','Natación','Tenis','Squash','Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "244.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-18", "fecha_fin": "2029-03-18", "presidente": "LUIS FELIPE BARRIOS CADENA", "localidad": "Suba", "sports": ["Golf", "Natación", "Tenis", "Squash", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-tennis-club-campes-244.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', NULL, 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FÃNIX TS  (IDRD-CLUB-fanix-ts-200.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fanix-ts-200.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FÃNIX TS',
      'Presidente: KAREN DANIELA TORRES SANCHEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 200.0 / actualización Nº N/A. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      NULL,
      'fenixkatets@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fanix-ts-200.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fanix-ts-200.0', v_school_id, '{"resolucion_rd": "200.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-27", "fecha_fin": "2029-02-27", "presidente": "KAREN DANIELA TORRES SANCHEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN DANIELA TORRES SANCHEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 200.0 / actualización Nº N/A. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('fenixkatets@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "200.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-27", "fecha_fin": "2029-02-27", "presidente": "KAREN DANIELA TORRES SANCHEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fanix-ts-200.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', NULL, 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FURIA ALBIRROJA  (IDRD-CLUB-furia-albirroja-1772.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-furia-albirroja-1772.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FURIA ALBIRROJA',
      'Presidente: GIOVANNY ANDRES MORENO GRANADOS. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 1772.0 / actualización Nº N/A. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      NULL,
      'albirojacolombia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'furia-albirroja-1772.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-furia-albirroja-1772.0', v_school_id, '{"resolucion_rd": "1772.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-17", "fecha_fin": "2029-01-17", "presidente": "GIOVANNY ANDRES MORENO GRANADOS", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GIOVANNY ANDRES MORENO GRANADOS. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 1772.0 / actualización Nº N/A. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('albirojacolombia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1772.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-17", "fecha_fin": "2029-01-17", "presidente": "GIOVANNY ANDRES MORENO GRANADOS", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-furia-albirroja-1772.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', NULL, 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MASTERâS VOLLEY COLOMBIA  (IDRD-CLUB-masteras-volley-colombia-1786.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-masteras-volley-colombia-1786.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MASTERâS VOLLEY COLOMBIA',
      'Presidente: WILLINGTON BAEZ VELA. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 1786.0 / actualización Nº N/A. Vigente hasta 2029-01-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      NULL,
      'mastersvolleyclub2021@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'masteras-volley-colombia-1786.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-masteras-volley-colombia-1786.0', v_school_id, '{"resolucion_rd": "1786.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-19", "fecha_fin": "2029-01-19", "presidente": "WILLINGTON BAEZ VELA", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLINGTON BAEZ VELA. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 1786.0 / actualización Nº N/A. Vigente hasta 2029-01-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('mastersvolleyclub2021@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1786.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-19", "fecha_fin": "2029-01-19", "presidente": "WILLINGTON BAEZ VELA", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-masteras-volley-colombia-1786.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', NULL, 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SAVATE FÃNIX SOLAR  (IDRD-CLUB-savate-fanix-solar-1764.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-savate-fanix-solar-1764.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SAVATE FÃNIX SOLAR',
      'Presidente: CARLOS ANDRES CONTRERAS RENTERIA. Deporte(s): Savate. Localidad: Kennedy. Resolución R-D Nº 1764.0 / actualización Nº N/A. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      NULL,
      'escuelafenixsolar@gmail.com',
      ARRAY['Savate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'savate-fanix-solar-1764.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-savate-fanix-solar-1764.0', v_school_id, '{"resolucion_rd": "1764.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-18", "fecha_fin": "2029-01-18", "presidente": "CARLOS ANDRES CONTRERAS RENTERIA", "localidad": "Kennedy", "sports": ["Savate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRES CONTRERAS RENTERIA. Deporte(s): Savate. Localidad: Kennedy. Resolución R-D Nº 1764.0 / actualización Nº N/A. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('escuelafenixsolar@gmail.com', email),
      sports      = ARRAY['Savate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1764.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-01-18", "fecha_fin": "2029-01-18", "presidente": "CARLOS ANDRES CONTRERAS RENTERIA", "localidad": "Kennedy", "sports": ["Savate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-savate-fanix-solar-1764.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', NULL, 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PRONAT  (IDRD-CLUB-club-deportivo-pronat-388)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pronat-388';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PRONAT',
      'Presidente: DAVID FELIPE OSORIO ARENAS. Deporte(s): Actividades Subacuaticas. Localidad: Barrios Unidos. Resolución R-D Nº 388 / actualización Nº 1509.0. Vigente hasta 2029-04-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3222081087',
      'pronat.bogota@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pronat-388',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pronat-388', v_school_id, '{"resolucion_rd": "388", "resolucion_actualizacion": "1509.0", "fecha_inicio": "2024-04-03", "fecha_fin": "2029-04-03", "presidente": "DAVID FELIPE OSORIO ARENAS", "localidad": "Barrios Unidos", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID FELIPE OSORIO ARENAS. Deporte(s): Actividades Subacuaticas. Localidad: Barrios Unidos. Resolución R-D Nº 388 / actualización Nº 1509.0. Vigente hasta 2029-04-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222081087', phone),
      email       = COALESCE('pronat.bogota@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "388", "resolucion_actualizacion": "1509.0", "fecha_inicio": "2024-04-03", "fecha_fin": "2029-04-03", "presidente": "DAVID FELIPE OSORIO ARENAS", "localidad": "Barrios Unidos", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pronat-388';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3222081087', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUBDEPORTIVO D-CRASH ULTIMATE CLUB  (IDRD-CLUB-clubdeportivo-d-crash-ultimate-club-1315.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-clubdeportivo-d-crash-ultimate-club-1315.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUBDEPORTIVO D-CRASH ULTIMATE CLUB',
      'Presidente: JUAN GABRIEL HERNANDEZ AVILA. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 1315.0 / actualización Nº 1315.0. Vigente hasta 2027-06-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3214521269',
      'd.crashultimate@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'clubdeportivo-d-crash-ultimate-club-1315.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-clubdeportivo-d-crash-ultimate-club-1315.0', v_school_id, '{"resolucion_rd": "1315.0", "resolucion_actualizacion": "1315.0", "fecha_inicio": "2022-06-15", "fecha_fin": "2027-06-15", "presidente": "JUAN GABRIEL HERNANDEZ AVILA", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN GABRIEL HERNANDEZ AVILA. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 1315.0 / actualización Nº 1315.0. Vigente hasta 2027-06-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214521269', phone),
      email       = COALESCE('d.crashultimate@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1315.0", "resolucion_actualizacion": "1315.0", "fecha_inicio": "2022-06-15", "fecha_fin": "2027-06-15", "presidente": "JUAN GABRIEL HERNANDEZ AVILA", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-clubdeportivo-d-crash-ultimate-club-1315.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3214521269', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MARACANEIROS  (IDRD-CLUB-maracaneiros-164.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-maracaneiros-164.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MARACANEIROS',
      'Presidente: WILLIAM RAUL SALAMANCA CASTILLO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 164.0 / actualización Nº N/A. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '310478376',
      'maracaneirosoficial@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'maracaneiros-164.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-maracaneiros-164.0', v_school_id, '{"resolucion_rd": "164.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-22", "fecha_fin": "2029-02-22", "presidente": "WILLIAM RAUL SALAMANCA CASTILLO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM RAUL SALAMANCA CASTILLO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 164.0 / actualización Nº N/A. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('310478376', phone),
      email       = COALESCE('maracaneirosoficial@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "164.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-22", "fecha_fin": "2029-02-22", "presidente": "WILLIAM RAUL SALAMANCA CASTILLO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-maracaneiros-164.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '310478376', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ENERGY  (IDRD-CLUB-club-deportivo-energy-1681.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-energy-1681.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ENERGY',
      'Presidente: JENNIFFER VALLEJO MARTINEZ. Deporte(s): Tenis. Localidad: Barrios Unidos. Resolución R-D Nº 1681.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3227886363',
      'tenis@energytenis.com.co',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-energy-1681.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-energy-1681.0', v_school_id, '{"resolucion_rd": "1681.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "JENNIFFER VALLEJO MARTINEZ", "localidad": "Barrios Unidos", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNIFFER VALLEJO MARTINEZ. Deporte(s): Tenis. Localidad: Barrios Unidos. Resolución R-D Nº 1681.0 / actualización Nº N/A. Vigente hasta 2031-01-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3227886363', phone),
      email       = COALESCE('tenis@energytenis.com.co', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1681.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-08", "fecha_fin": "2031-01-08", "presidente": "JENNIFFER VALLEJO MARTINEZ", "localidad": "Barrios Unidos", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-energy-1681.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3227886363', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VIVE FUTBOL  (IDRD-CLUB-club-deportivo-vive-futbol-1453.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-vive-futbol-1453.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VIVE FUTBOL',
      'Presidente: ALVARO JAVIER GUEVARA CHITIVA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1453.0 / actualización Nº N/A. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3014247275',
      'vivefutbolbogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-vive-futbol-1453.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-vive-futbol-1453.0', v_school_id, '{"resolucion_rd": "1453.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-10", "fecha_fin": "2029-12-10", "presidente": "ALVARO JAVIER GUEVARA CHITIVA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALVARO JAVIER GUEVARA CHITIVA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1453.0 / actualización Nº N/A. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3014247275', phone),
      email       = COALESCE('vivefutbolbogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1453.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-10", "fecha_fin": "2029-12-10", "presidente": "ALVARO JAVIER GUEVARA CHITIVA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-vive-futbol-1453.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3014247275', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ANGELS ALL STAR  (IDRD-CLUB-club-deportivo-angels-all-star-411.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-angels-all-star-411.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ANGELS ALL STAR',
      'Presidente: ESTEFANIA ALVARADO ORTÃZ. Deporte(s): Porrismo. Localidad: Fontibón. Resolución R-D Nº 411.0 / actualización Nº N/A. Vigente hasta 2029-04-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3107415912',
      'angelsallstar2023@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-angels-all-star-411.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-angels-all-star-411.0', v_school_id, '{"resolucion_rd": "411.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-04-08", "fecha_fin": "2029-04-08", "presidente": "ESTEFANIA ALVARADO ORTÃZ", "localidad": "Fontibón", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ESTEFANIA ALVARADO ORTÃZ. Deporte(s): Porrismo. Localidad: Fontibón. Resolución R-D Nº 411.0 / actualización Nº N/A. Vigente hasta 2029-04-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107415912', phone),
      email       = COALESCE('angelsallstar2023@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "411.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-04-08", "fecha_fin": "2029-04-08", "presidente": "ESTEFANIA ALVARADO ORTÃZ", "localidad": "Fontibón", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-angels-all-star-411.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3107415912', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HAYUELOS F.C.  (IDRD-CLUB-club-deportivo-hayuelos-fc-406.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-hayuelos-fc-406.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HAYUELOS F.C.',
      'Presidente: JULIO CESAR RAMOS MONGUI. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 406.0 / actualización Nº N/A. Vigente hasta 2029-04-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3142804593',
      'hayuelosfutbolclub@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-hayuelos-fc-406.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-hayuelos-fc-406.0', v_school_id, '{"resolucion_rd": "406.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-04-05", "fecha_fin": "2029-04-05", "presidente": "JULIO CESAR RAMOS MONGUI", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIO CESAR RAMOS MONGUI. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 406.0 / actualización Nº N/A. Vigente hasta 2029-04-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142804593', phone),
      email       = COALESCE('hayuelosfutbolclub@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "406.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-04-05", "fecha_fin": "2029-04-05", "presidente": "JULIO CESAR RAMOS MONGUI", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-hayuelos-fc-406.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3142804593', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FENIX BLUE  (IDRD-CLUB-club-deportivo-fenix-blue-363.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fenix-blue-363.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FENIX BLUE',
      'Presidente: EHCER HAWEN ESPAÃA LOPEZ. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 363.0 / actualización Nº N/A. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3209343323',
      'canada3579@hotmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fenix-blue-363.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fenix-blue-363.0', v_school_id, '{"resolucion_rd": "363.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-22", "fecha_fin": "2029-03-22", "presidente": "EHCER HAWEN ESPAÃA LOPEZ", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EHCER HAWEN ESPAÃA LOPEZ. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 363.0 / actualización Nº N/A. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209343323', phone),
      email       = COALESCE('canada3579@hotmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "363.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-22", "fecha_fin": "2029-03-22", "presidente": "EHCER HAWEN ESPAÃA LOPEZ", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fenix-blue-363.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3209343323', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EXPRESO ROJO  (IDRD-CLUB-club-deportivo-expreso-rojo-1115.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-expreso-rojo-1115.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EXPRESO ROJO',
      'Presidente: CARLOS EDUARDO RIAÃO GONZALEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1115.0 / actualización Nº N/A. Vigente hasta 2026-12-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3052558298',
      'criano06@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-expreso-rojo-1115.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-expreso-rojo-1115.0', v_school_id, '{"resolucion_rd": "1115.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2021-12-29", "fecha_fin": "2026-12-29", "presidente": "CARLOS EDUARDO RIAÃO GONZALEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS EDUARDO RIAÃO GONZALEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1115.0 / actualización Nº N/A. Vigente hasta 2026-12-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3052558298', phone),
      email       = COALESCE('criano06@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1115.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2021-12-29", "fecha_fin": "2026-12-29", "presidente": "CARLOS EDUARDO RIAÃO GONZALEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-expreso-rojo-1115.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3052558298', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MILLAN FC  (IDRD-CLUB-club-deportivo-millan-fc-356.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-millan-fc-356.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MILLAN FC',
      'Presidente: JOHANY CARLOS MILLAN LOPEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 356.0 / actualización Nº N/A. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '6016349230',
      'johanymillan@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-millan-fc-356.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-millan-fc-356.0', v_school_id, '{"resolucion_rd": "356.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-22", "fecha_fin": "2029-03-22", "presidente": "JOHANY CARLOS MILLAN LOPEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANY CARLOS MILLAN LOPEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 356.0 / actualización Nº N/A. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6016349230', phone),
      email       = COALESCE('johanymillan@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "356.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-22", "fecha_fin": "2029-03-22", "presidente": "JOHANY CARLOS MILLAN LOPEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-millan-fc-356.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '6016349230', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VOLEY MASTER COLOMBIA  (IDRD-CLUB-club-deportivo-voley-master-colombia-354.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-voley-master-colombia-354.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VOLEY MASTER COLOMBIA',
      'Presidente: BRAYAN ALBERTO CABRERA VENEGAS. Deporte(s): Voleibol. Localidad: Barrios Unidos. Resolución R-D Nº 354.0 / actualización Nº N/A. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3045333437',
      'clubvoleymastercol1@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-voley-master-colombia-354.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-voley-master-colombia-354.0', v_school_id, '{"resolucion_rd": "354.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-22", "fecha_fin": "2029-03-22", "presidente": "BRAYAN ALBERTO CABRERA VENEGAS", "localidad": "Barrios Unidos", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BRAYAN ALBERTO CABRERA VENEGAS. Deporte(s): Voleibol. Localidad: Barrios Unidos. Resolución R-D Nº 354.0 / actualización Nº N/A. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3045333437', phone),
      email       = COALESCE('clubvoleymastercol1@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "354.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-22", "fecha_fin": "2029-03-22", "presidente": "BRAYAN ALBERTO CABRERA VENEGAS", "localidad": "Barrios Unidos", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-voley-master-colombia-354.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3045333437', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUNLASOB  (IDRD-CLUB-club-deportivo-funlasob-319.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-funlasob-319.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUNLASOB',
      'Presidente: JOSE OLIVIO COTTIN. Localidad: Ciudad Bolívar. Resolución R-D Nº 319.0 / actualización Nº N/A. Vigente hasta 2029-03-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3102494608',
      'funlasob2023@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-funlasob-319.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-funlasob-319.0', v_school_id, '{"resolucion_rd": "319.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-19", "fecha_fin": "2029-03-19", "presidente": "JOSE OLIVIO COTTIN", "localidad": "Ciudad Bolívar", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE OLIVIO COTTIN. Localidad: Ciudad Bolívar. Resolución R-D Nº 319.0 / actualización Nº N/A. Vigente hasta 2029-03-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102494608', phone),
      email       = COALESCE('funlasob2023@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "319.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-19", "fecha_fin": "2029-03-19", "presidente": "JOSE OLIVIO COTTIN", "localidad": "Ciudad Bolívar", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-funlasob-319.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3102494608', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BUCONOS  (IDRD-CLUB-club-deportivo-buconos-353.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-buconos-353.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BUCONOS',
      'Presidente: ADOLFO SALINAS SALAZAR. Deporte(s): Actividades Subacuaticas. Localidad: Chapinero. Resolución R-D Nº 353.0 / actualización Nº N/A. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3136309720',
      'buconos@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-buconos-353.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-buconos-353.0', v_school_id, '{"resolucion_rd": "353.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-22", "fecha_fin": "2029-03-22", "presidente": "ADOLFO SALINAS SALAZAR", "localidad": "Chapinero", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ADOLFO SALINAS SALAZAR. Deporte(s): Actividades Subacuaticas. Localidad: Chapinero. Resolución R-D Nº 353.0 / actualización Nº N/A. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3136309720', phone),
      email       = COALESCE('buconos@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "353.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-22", "fecha_fin": "2029-03-22", "presidente": "ADOLFO SALINAS SALAZAR", "localidad": "Chapinero", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-buconos-353.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3136309720', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB THE LIONÂ´S BOGOTA  (IDRD-CLUB-club-the-liona-s-bogota-316.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-the-liona-s-bogota-316.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB THE LIONÂ´S BOGOTA',
      'Presidente: JOSÃ HARVEY RIAÃO ESQUIVEL. Deporte(s): Baloncesto. Localidad: Bosa. Resolución R-D Nº 316.0 / actualización Nº N/A. Vigente hasta 2029-03-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3203751618',
      'clubthelionsbogota@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-the-liona-s-bogota-316.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-the-liona-s-bogota-316.0', v_school_id, '{"resolucion_rd": "316.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-19", "fecha_fin": "2029-03-19", "presidente": "JOSÃ HARVEY RIAÃO ESQUIVEL", "localidad": "Bosa", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ HARVEY RIAÃO ESQUIVEL. Deporte(s): Baloncesto. Localidad: Bosa. Resolución R-D Nº 316.0 / actualización Nº N/A. Vigente hasta 2029-03-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203751618', phone),
      email       = COALESCE('clubthelionsbogota@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "316.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-19", "fecha_fin": "2029-03-19", "presidente": "JOSÃ HARVEY RIAÃO ESQUIVEL", "localidad": "Bosa", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-the-liona-s-bogota-316.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3203751618', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DRAGONES D.C  (IDRD-CLUB-club-deportivo-dragones-dc-279.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dragones-dc-279.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DRAGONES D.C',
      'Presidente: LENSY NAYIVE CALDERÃN TRIANA. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 279.0 / actualización Nº N/A. Vigente hasta 2029-03-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3107979421',
      'dragonesdc2018@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dragones-dc-279.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dragones-dc-279.0', v_school_id, '{"resolucion_rd": "279.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-11", "fecha_fin": "2029-03-11", "presidente": "LENSY NAYIVE CALDERÃN TRIANA", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LENSY NAYIVE CALDERÃN TRIANA. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 279.0 / actualización Nº N/A. Vigente hasta 2029-03-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107979421', phone),
      email       = COALESCE('dragonesdc2018@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "279.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-11", "fecha_fin": "2029-03-11", "presidente": "LENSY NAYIVE CALDERÃN TRIANA", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dragones-dc-279.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3107979421', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALIANZA DEPORTIVA AURES II F.C.  (IDRD-CLUB-club-deportivo-alianza-deportiva-aures-i-254.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alianza-deportiva-aures-i-254.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALIANZA DEPORTIVA AURES II F.C.',
      'Presidente: EDGAR FONTECHA FONTECHA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 254.0 / actualización Nº N/A. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3107750145',
      'a.d.aures2@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alianza-deportiva-aures-i-254.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alianza-deportiva-aures-i-254.0', v_school_id, '{"resolucion_rd": "254.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-06", "fecha_fin": "2029-03-06", "presidente": "EDGAR FONTECHA FONTECHA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR FONTECHA FONTECHA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 254.0 / actualización Nº N/A. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107750145', phone),
      email       = COALESCE('a.d.aures2@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "254.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-06", "fecha_fin": "2029-03-06", "presidente": "EDGAR FONTECHA FONTECHA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alianza-deportiva-aures-i-254.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3107750145', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SLAYER  (IDRD-CLUB-club-deportivo-slayer-251.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-slayer-251.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SLAYER',
      'Presidente: LUZ ESTELA PÃREZ ÃVILA. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 251.0 / actualización Nº N/A. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3123390221',
      'luzslayer75@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-slayer-251.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-slayer-251.0', v_school_id, '{"resolucion_rd": "251.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-06", "fecha_fin": "2029-03-06", "presidente": "LUZ ESTELA PÃREZ ÃVILA", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUZ ESTELA PÃREZ ÃVILA. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 251.0 / actualización Nº N/A. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123390221', phone),
      email       = COALESCE('luzslayer75@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "251.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-06", "fecha_fin": "2029-03-06", "presidente": "LUZ ESTELA PÃREZ ÃVILA", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-slayer-251.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3123390221', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LIEBRES COLOMBIA  (IDRD-CLUB-club-deportivo-liebres-colombia-243.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-liebres-colombia-243.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LIEBRES COLOMBIA',
      'Presidente: YENNY YANNET SANÃN MÃNERA. Deporte(s): Atletismo. Localidad: Kennedy. Resolución R-D Nº 243.0 / actualización Nº N/A. Vigente hasta 2029-03-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3103031665',
      'liebrescolombia@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-liebres-colombia-243.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-liebres-colombia-243.0', v_school_id, '{"resolucion_rd": "243.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-05", "fecha_fin": "2029-03-05", "presidente": "YENNY YANNET SANÃN MÃNERA", "localidad": "Kennedy", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YENNY YANNET SANÃN MÃNERA. Deporte(s): Atletismo. Localidad: Kennedy. Resolución R-D Nº 243.0 / actualización Nº N/A. Vigente hasta 2029-03-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103031665', phone),
      email       = COALESCE('liebrescolombia@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "243.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-03-05", "fecha_fin": "2029-03-05", "presidente": "YENNY YANNET SANÃN MÃNERA", "localidad": "Kennedy", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-liebres-colombia-243.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3103031665', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORTING FC  (IDRD-CLUB-club-deportivo-sporting-fc-211.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sporting-fc-211.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORTING FC',
      'Presidente: FREDY ALBERTO CAICEDO PINEDA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 211.0 / actualización Nº N/A. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3106995028',
      'caicedopineda20@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sporting-fc-211.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sporting-fc-211.0', v_school_id, '{"resolucion_rd": "211.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-27", "fecha_fin": "2029-02-27", "presidente": "FREDY ALBERTO CAICEDO PINEDA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDY ALBERTO CAICEDO PINEDA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 211.0 / actualización Nº N/A. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106995028', phone),
      email       = COALESCE('caicedopineda20@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "211.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-27", "fecha_fin": "2029-02-27", "presidente": "FREDY ALBERTO CAICEDO PINEDA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sporting-fc-211.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3106995028', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FOUR WHEELS  (IDRD-CLUB-club-deportivo-four-wheels-204.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-four-wheels-204.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FOUR WHEELS',
      'Presidente: MARIA ALEJANDRA ORDOÃEZ CAMPO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 204.0 / actualización Nº N/A. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3057123723',
      'patinajefw@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-four-wheels-204.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-four-wheels-204.0', v_school_id, '{"resolucion_rd": "204.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-27", "fecha_fin": "2029-02-27", "presidente": "MARIA ALEJANDRA ORDOÃEZ CAMPO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA ALEJANDRA ORDOÃEZ CAMPO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 204.0 / actualización Nº N/A. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057123723', phone),
      email       = COALESCE('patinajefw@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "204.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-27", "fecha_fin": "2029-02-27", "presidente": "MARIA ALEJANDRA ORDOÃEZ CAMPO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-four-wheels-204.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3057123723', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BANCO DE SUEÃOS  (IDRD-CLUB-club-deportivo-banco-de-sueaos-210.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-banco-de-sueaos-210.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BANCO DE SUEÃOS',
      'Presidente: GLORIA INÃS MARÃN GARCÃA. Localidad: San Cristóbal. Resolución R-D Nº 210.0 / actualización Nº N/A. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3008429157',
      'bancodesuenosclubdeportivo@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-banco-de-sueaos-210.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-banco-de-sueaos-210.0', v_school_id, '{"resolucion_rd": "210.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-27", "fecha_fin": "2029-02-27", "presidente": "GLORIA INÃS MARÃN GARCÃA", "localidad": "San Cristóbal", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GLORIA INÃS MARÃN GARCÃA. Localidad: San Cristóbal. Resolución R-D Nº 210.0 / actualización Nº N/A. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008429157', phone),
      email       = COALESCE('bancodesuenosclubdeportivo@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "210.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-27", "fecha_fin": "2029-02-27", "presidente": "GLORIA INÃS MARÃN GARCÃA", "localidad": "San Cristóbal", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-banco-de-sueaos-210.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3008429157', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SKATE BOY BOGOTA  (IDRD-CLUB-club-deportivo-skate-boy-bogota-171.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-skate-boy-bogota-171.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SKATE BOY BOGOTA',
      'Presidente: JOSE HOLMES ALVIS POVEDA. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 171.0 / actualización Nº N/A. Vigente hasta 2029-02-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3504629400',
      'patiskate@hotmail.es',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-skate-boy-bogota-171.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-skate-boy-bogota-171.0', v_school_id, '{"resolucion_rd": "171.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-23", "fecha_fin": "2029-02-23", "presidente": "JOSE HOLMES ALVIS POVEDA", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE HOLMES ALVIS POVEDA. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 171.0 / actualización Nº N/A. Vigente hasta 2029-02-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3504629400', phone),
      email       = COALESCE('patiskate@hotmail.es', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "171.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-23", "fecha_fin": "2029-02-23", "presidente": "JOSE HOLMES ALVIS POVEDA", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-skate-boy-bogota-171.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3504629400', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLAS PT  (IDRD-CLUB-club-deportivo-atlas-pt-170.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlas-pt-170.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLAS PT',
      'Presidente: SAUL FERNANDO RINCON ZARATE. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 170.0 / actualización Nº N/A. Vigente hasta 2029-02-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3104772694',
      'saulf-1990@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlas-pt-170.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlas-pt-170.0', v_school_id, '{"resolucion_rd": "170.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-23", "fecha_fin": "2029-02-23", "presidente": "SAUL FERNANDO RINCON ZARATE", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SAUL FERNANDO RINCON ZARATE. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 170.0 / actualización Nº N/A. Vigente hasta 2029-02-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3104772694', phone),
      email       = COALESCE('saulf-1990@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "170.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-23", "fecha_fin": "2029-02-23", "presidente": "SAUL FERNANDO RINCON ZARATE", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlas-pt-170.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3104772694', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JC RUNNING TEAM  (IDRD-CLUB-club-deportivo-jc-running-team-169.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jc-running-team-169.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JC RUNNING TEAM',
      'Presidente: JAIRO MANUEL CRUZ PINZON. Deporte(s): Atletismo. Localidad: Usaquén. Resolución R-D Nº 169.0 / actualización Nº N/A. Vigente hasta 2029-02-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3174322066',
      'jcruningcolombia@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jc-running-team-169.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jc-running-team-169.0', v_school_id, '{"resolucion_rd": "169.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-23", "fecha_fin": "2029-02-23", "presidente": "JAIRO MANUEL CRUZ PINZON", "localidad": "Usaquén", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIRO MANUEL CRUZ PINZON. Deporte(s): Atletismo. Localidad: Usaquén. Resolución R-D Nº 169.0 / actualización Nº N/A. Vigente hasta 2029-02-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174322066', phone),
      email       = COALESCE('jcruningcolombia@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "169.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-23", "fecha_fin": "2029-02-23", "presidente": "JAIRO MANUEL CRUZ PINZON", "localidad": "Usaquén", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jc-running-team-169.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3174322066', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BUBAMARA MONSERRATE  (IDRD-CLUB-club-deportivo-bubamara-monserrate-1643.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bubamara-monserrate-1643.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BUBAMARA MONSERRATE',
      'Presidente: ALEJANDRO SANABRIA SALINAS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1643.0 / actualización Nº N/A. Vigente hasta 2031-01-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3174830371',
      'bubamaramonserrate@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bubamara-monserrate-1643.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bubamara-monserrate-1643.0', v_school_id, '{"resolucion_rd": "1643.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-06", "fecha_fin": "2031-01-06", "presidente": "ALEJANDRO SANABRIA SALINAS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEJANDRO SANABRIA SALINAS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1643.0 / actualización Nº N/A. Vigente hasta 2031-01-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174830371', phone),
      email       = COALESCE('bubamaramonserrate@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1643.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2026-01-06", "fecha_fin": "2031-01-06", "presidente": "ALEJANDRO SANABRIA SALINAS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bubamara-monserrate-1643.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3174830371', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO OPTIMA WILD DOGS  (IDRD-CLUB-club-deportivo-optima-wild-dogs-1627.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-optima-wild-dogs-1627.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO OPTIMA WILD DOGS',
      'Presidente: ALEJANDRO LUCIO CHAUSTRE. Deporte(s): Hockey Sobre Hielo. Localidad: Usaquén. Resolución R-D Nº 1627.0 / actualización Nº N/A. Vigente hasta 2030-12-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3123798450',
      'opwdhc@gmail.com',
      ARRAY['Hockey Sobre Hielo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-optima-wild-dogs-1627.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-optima-wild-dogs-1627.0', v_school_id, '{"resolucion_rd": "1627.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-29", "fecha_fin": "2030-12-29", "presidente": "ALEJANDRO LUCIO CHAUSTRE", "localidad": "Usaquén", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEJANDRO LUCIO CHAUSTRE. Deporte(s): Hockey Sobre Hielo. Localidad: Usaquén. Resolución R-D Nº 1627.0 / actualización Nº N/A. Vigente hasta 2030-12-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123798450', phone),
      email       = COALESCE('opwdhc@gmail.com', email),
      sports      = ARRAY['Hockey Sobre Hielo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1627.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-29", "fecha_fin": "2030-12-29", "presidente": "ALEJANDRO LUCIO CHAUSTRE", "localidad": "Usaquén", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-optima-wild-dogs-1627.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3123798450', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PIONERAS F.C.  (IDRD-CLUB-club-deportivo-pioneras-fc-1567.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pioneras-fc-1567.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PIONERAS F.C.',
      'Presidente: LINDA MADEXI OSORIO GÃMEZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1567.0 / actualización Nº N/A. Vigente hasta 2030-12-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3133869712',
      'futbolpioneras@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pioneras-fc-1567.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pioneras-fc-1567.0', v_school_id, '{"resolucion_rd": "1567.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-26", "fecha_fin": "2030-12-26", "presidente": "LINDA MADEXI OSORIO GÃMEZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LINDA MADEXI OSORIO GÃMEZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1567.0 / actualización Nº N/A. Vigente hasta 2030-12-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133869712', phone),
      email       = COALESCE('futbolpioneras@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1567.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-26", "fecha_fin": "2030-12-26", "presidente": "LINDA MADEXI OSORIO GÃMEZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pioneras-fc-1567.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3133869712', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VICTORY FENIX ALL STARS  (IDRD-CLUB-club-deportivo-victory-fenix-all-stars-1566.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-victory-fenix-all-stars-1566.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VICTORY FENIX ALL STARS',
      'Presidente: DAVIAN ORLANDO DIAZ VARGAS. Deporte(s): Porrismo. Localidad: Engativá. Resolución R-D Nº 1566.0 / actualización Nº N/A. Vigente hasta 2030-12-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3507520711',
      'victory.fenixas@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-victory-fenix-all-stars-1566.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-victory-fenix-all-stars-1566.0', v_school_id, '{"resolucion_rd": "1566.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-26", "fecha_fin": "2030-12-26", "presidente": "DAVIAN ORLANDO DIAZ VARGAS", "localidad": "Engativá", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVIAN ORLANDO DIAZ VARGAS. Deporte(s): Porrismo. Localidad: Engativá. Resolución R-D Nº 1566.0 / actualización Nº N/A. Vigente hasta 2030-12-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3507520711', phone),
      email       = COALESCE('victory.fenixas@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1566.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-26", "fecha_fin": "2030-12-26", "presidente": "DAVIAN ORLANDO DIAZ VARGAS", "localidad": "Engativá", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-victory-fenix-all-stars-1566.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3507520711', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SLAM PADEL EL CHICÃ  (IDRD-CLUB-club-deportivo-slam-padel-el-chica-1565.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-slam-padel-el-chica-1565.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SLAM PADEL EL CHICÃ',
      'Presidente: FRIDA SPIWAK DE ROTLEWICZ. Deporte(s): Padel. Localidad: Usaquén. Resolución R-D Nº 1565.0 / actualización Nº N/A. Vigente hasta 2030-12-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3227904201',
      'slam.direccion@gmail.com',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-slam-padel-el-chica-1565.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-slam-padel-el-chica-1565.0', v_school_id, '{"resolucion_rd": "1565.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-12", "fecha_fin": "2030-12-12", "presidente": "FRIDA SPIWAK DE ROTLEWICZ", "localidad": "Usaquén", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FRIDA SPIWAK DE ROTLEWICZ. Deporte(s): Padel. Localidad: Usaquén. Resolución R-D Nº 1565.0 / actualización Nº N/A. Vigente hasta 2030-12-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3227904201', phone),
      email       = COALESCE('slam.direccion@gmail.com', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1565.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-12", "fecha_fin": "2030-12-12", "presidente": "FRIDA SPIWAK DE ROTLEWICZ", "localidad": "Usaquén", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-slam-padel-el-chica-1565.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3227904201', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO STAR NOVA GYM  (IDRD-CLUB-club-deportivo-star-nova-gym-1560.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-star-nova-gym-1560.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO STAR NOVA GYM',
      'Presidente: YAZMIN LOPEZ OSPINO. Deporte(s): Porrismo. Localidad: Usaquén. Resolución R-D Nº 1560.0 / actualización Nº N/A. Vigente hasta 2030-12-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3134157910',
      'snova0925@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-star-nova-gym-1560.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-star-nova-gym-1560.0', v_school_id, '{"resolucion_rd": "1560.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-26", "fecha_fin": "2030-12-26", "presidente": "YAZMIN LOPEZ OSPINO", "localidad": "Usaquén", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YAZMIN LOPEZ OSPINO. Deporte(s): Porrismo. Localidad: Usaquén. Resolución R-D Nº 1560.0 / actualización Nº N/A. Vigente hasta 2030-12-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134157910', phone),
      email       = COALESCE('snova0925@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1560.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-26", "fecha_fin": "2030-12-26", "presidente": "YAZMIN LOPEZ OSPINO", "localidad": "Usaquén", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-star-nova-gym-1560.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3134157910', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PADEL POINT 134  (IDRD-CLUB-club-deportivo-padel-point-134-1538.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-padel-point-134-1538.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PADEL POINT 134',
      'Presidente: DIEGO ZAPATA FONNEGRA. Deporte(s): Padel. Localidad: Suba. Resolución R-D Nº 1538.0 / actualización Nº N/A. Vigente hasta 2030-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3107198827',
      'padelpoint134.col@gmail.com',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-padel-point-134-1538.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-padel-point-134-1538.0', v_school_id, '{"resolucion_rd": "1538.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-19", "fecha_fin": "2030-12-19", "presidente": "DIEGO ZAPATA FONNEGRA", "localidad": "Suba", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ZAPATA FONNEGRA. Deporte(s): Padel. Localidad: Suba. Resolución R-D Nº 1538.0 / actualización Nº N/A. Vigente hasta 2030-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107198827', phone),
      email       = COALESCE('padelpoint134.col@gmail.com', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1538.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-19", "fecha_fin": "2030-12-19", "presidente": "DIEGO ZAPATA FONNEGRA", "localidad": "Suba", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-padel-point-134-1538.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3107198827', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB  (IDRD-CLUB-club-1537.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-1537.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB',
      'Presidente: JUAN BAUTISTA FRANCO ARANDA. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1537.0 / actualización Nº N/A. Vigente hasta 2030-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3027143893',
      'treseisnuevemj@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-1537.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-1537.0', v_school_id, '{"resolucion_rd": "1537.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-19", "fecha_fin": "2030-12-19", "presidente": "JUAN BAUTISTA FRANCO ARANDA", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN BAUTISTA FRANCO ARANDA. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1537.0 / actualización Nº N/A. Vigente hasta 2030-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3027143893', phone),
      email       = COALESCE('treseisnuevemj@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1537.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-19", "fecha_fin": "2030-12-19", "presidente": "JUAN BAUTISTA FRANCO ARANDA", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-1537.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3027143893', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FIRE VOLLEY  (IDRD-CLUB-club-deportivo-fire-volley-1507.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fire-volley-1507.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FIRE VOLLEY',
      'Presidente: ALFONZO SANDOVAL LINARES. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 1507.0 / actualización Nº N/A. Vigente hasta 2030-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3044269599',
      'clubfirevolley@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fire-volley-1507.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fire-volley-1507.0', v_school_id, '{"resolucion_rd": "1507.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-19", "fecha_fin": "2030-12-19", "presidente": "ALFONZO SANDOVAL LINARES", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALFONZO SANDOVAL LINARES. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 1507.0 / actualización Nº N/A. Vigente hasta 2030-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3044269599', phone),
      email       = COALESCE('clubfirevolley@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1507.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-19", "fecha_fin": "2030-12-19", "presidente": "ALFONZO SANDOVAL LINARES", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fire-volley-1507.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3044269599', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WEIGHTLIFTING SAIYA-JIN CLUB  (IDRD-CLUB-club-deportivo-weightlifting-saiya-jin-c-1446.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-weightlifting-saiya-jin-c-1446.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WEIGHTLIFTING SAIYA-JIN CLUB',
      'Presidente: EDWIN DAVID CABEZAS MONDRAGON. Deporte(s): Levantamiento De Pesas. Localidad: Engativá. Resolución R-D Nº 1446.0 / actualización Nº N/A. Vigente hasta 2030-12-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3174365940',
      'weightliftingsaiyajinclub@gmail.com',
      ARRAY['Levantamiento De Pesas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-weightlifting-saiya-jin-c-1446.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-weightlifting-saiya-jin-c-1446.0', v_school_id, '{"resolucion_rd": "1446.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-09", "fecha_fin": "2030-12-09", "presidente": "EDWIN DAVID CABEZAS MONDRAGON", "localidad": "Engativá", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN DAVID CABEZAS MONDRAGON. Deporte(s): Levantamiento De Pesas. Localidad: Engativá. Resolución R-D Nº 1446.0 / actualización Nº N/A. Vigente hasta 2030-12-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174365940', phone),
      email       = COALESCE('weightliftingsaiyajinclub@gmail.com', email),
      sports      = ARRAY['Levantamiento De Pesas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1446.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-12-09", "fecha_fin": "2030-12-09", "presidente": "EDWIN DAVID CABEZAS MONDRAGON", "localidad": "Engativá", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-weightlifting-saiya-jin-c-1446.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3174365940', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOANERGES FC  (IDRD-CLUB-club-deportivo-boanerges-fc-1396.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-boanerges-fc-1396.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOANERGES FC',
      'Presidente: FERLEIN RODRÃGUEZ ARIZA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1396.0 / actualización Nº N/A. Vigente hasta 2030-11-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3224211020',
      'f.cboanerges2trueno@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-boanerges-fc-1396.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-boanerges-fc-1396.0', v_school_id, '{"resolucion_rd": "1396.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-28", "fecha_fin": "2030-11-28", "presidente": "FERLEIN RODRÃGUEZ ARIZA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FERLEIN RODRÃGUEZ ARIZA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1396.0 / actualización Nº N/A. Vigente hasta 2030-11-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3224211020', phone),
      email       = COALESCE('f.cboanerges2trueno@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1396.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-28", "fecha_fin": "2030-11-28", "presidente": "FERLEIN RODRÃGUEZ ARIZA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-boanerges-fc-1396.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3224211020', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESCUELA POPULAR DE AJEDREZ  (IDRD-CLUB-club-deportivo-escuela-popular-de-ajedre-1391.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-escuela-popular-de-ajedre-1391.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESCUELA POPULAR DE AJEDREZ',
      'Presidente: JHONNATAN JAMES PALACIOS SALAZAR. Deporte(s): Ajedrez. Localidad: Ciudad Bolívar. Resolución R-D Nº 1391.0 / actualización Nº N/A. Vigente hasta 2030-11-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3213949395',
      'jamesajedrezenfoque@gmail.com',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-escuela-popular-de-ajedre-1391.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-escuela-popular-de-ajedre-1391.0', v_school_id, '{"resolucion_rd": "1391.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-27", "fecha_fin": "2030-11-27", "presidente": "JHONNATAN JAMES PALACIOS SALAZAR", "localidad": "Ciudad Bolívar", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHONNATAN JAMES PALACIOS SALAZAR. Deporte(s): Ajedrez. Localidad: Ciudad Bolívar. Resolución R-D Nº 1391.0 / actualización Nº N/A. Vigente hasta 2030-11-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213949395', phone),
      email       = COALESCE('jamesajedrezenfoque@gmail.com', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1391.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-27", "fecha_fin": "2030-11-27", "presidente": "JHONNATAN JAMES PALACIOS SALAZAR", "localidad": "Ciudad Bolívar", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-escuela-popular-de-ajedre-1391.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3213949395', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HOLISTIC BALANCE  (IDRD-CLUB-club-deportivo-holistic-balance-1387.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-holistic-balance-1387.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HOLISTIC BALANCE',
      'Presidente: NUBIA DANIELA SÃNCHEZ HERNÃNDEZ. Deporte(s): Triatlon, Natación. Localidad: Teusaquillo. Resolución R-D Nº 1387.0 / actualización Nº N/A. Vigente hasta 2030-11-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3105729730',
      'holisticbalance3@gmail.com',
      ARRAY['Triatlon','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-holistic-balance-1387.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-holistic-balance-1387.0', v_school_id, '{"resolucion_rd": "1387.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-26", "fecha_fin": "2030-11-26", "presidente": "NUBIA DANIELA SÃNCHEZ HERNÃNDEZ", "localidad": "Teusaquillo", "sports": ["Triatlon", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NUBIA DANIELA SÃNCHEZ HERNÃNDEZ. Deporte(s): Triatlon, Natación. Localidad: Teusaquillo. Resolución R-D Nº 1387.0 / actualización Nº N/A. Vigente hasta 2030-11-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105729730', phone),
      email       = COALESCE('holisticbalance3@gmail.com', email),
      sports      = ARRAY['Triatlon','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1387.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-26", "fecha_fin": "2030-11-26", "presidente": "NUBIA DANIELA SÃNCHEZ HERNÃNDEZ", "localidad": "Teusaquillo", "sports": ["Triatlon", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-holistic-balance-1387.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3105729730', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CITYDELA F.C  (IDRD-CLUB-club-deportivo-citydela-fc-1386.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-citydela-fc-1386.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CITYDELA F.C',
      'Presidente: CONSUELO ZAMBRANO ORDOÃEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1386.0 / actualización Nº N/A. Vigente hasta 2030-11-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3503421818',
      'clubdeportivocitydela@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-citydela-fc-1386.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-citydela-fc-1386.0', v_school_id, '{"resolucion_rd": "1386.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-26", "fecha_fin": "2030-11-26", "presidente": "CONSUELO ZAMBRANO ORDOÃEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CONSUELO ZAMBRANO ORDOÃEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1386.0 / actualización Nº N/A. Vigente hasta 2030-11-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3503421818', phone),
      email       = COALESCE('clubdeportivocitydela@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1386.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-26", "fecha_fin": "2030-11-26", "presidente": "CONSUELO ZAMBRANO ORDOÃEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-citydela-fc-1386.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3503421818', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FILE AWAY F.C.  (IDRD-CLUB-club-deportivo-file-away-fc-1358.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-file-away-fc-1358.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FILE AWAY F.C.',
      'Presidente: ANDRÃS CAMILO TAMBO VARGAS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1358.0 / actualización Nº N/A. Vigente hasta 2030-11-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3233209054',
      'fileaway9@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-file-away-fc-1358.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-file-away-fc-1358.0', v_school_id, '{"resolucion_rd": "1358.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-24", "fecha_fin": "2030-11-24", "presidente": "ANDRÃS CAMILO TAMBO VARGAS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRÃS CAMILO TAMBO VARGAS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1358.0 / actualización Nº N/A. Vigente hasta 2030-11-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3233209054', phone),
      email       = COALESCE('fileaway9@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1358.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-24", "fecha_fin": "2030-11-24", "presidente": "ANDRÃS CAMILO TAMBO VARGAS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-file-away-fc-1358.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3233209054', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RAYO BOGOTANO  (IDRD-CLUB-club-deportivo-rayo-bogotano-1323.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-rayo-bogotano-1323.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RAYO BOGOTANO',
      'Presidente: VLADIMIR ALFONSO BALLESTEROS BALLESTEROS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1323.0 / actualización Nº N/A. Vigente hasta 2030-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3113834974',
      'rayobogotano2015@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-rayo-bogotano-1323.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-rayo-bogotano-1323.0', v_school_id, '{"resolucion_rd": "1323.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-13", "fecha_fin": "2030-11-13", "presidente": "VLADIMIR ALFONSO BALLESTEROS BALLESTEROS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VLADIMIR ALFONSO BALLESTEROS BALLESTEROS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1323.0 / actualización Nº N/A. Vigente hasta 2030-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3113834974', phone),
      email       = COALESCE('rayobogotano2015@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1323.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-13", "fecha_fin": "2030-11-13", "presidente": "VLADIMIR ALFONSO BALLESTEROS BALLESTEROS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-rayo-bogotano-1323.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3113834974', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RUSSA PÃDEL  (IDRD-CLUB-club-deportivo-russa-padel-1267.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-russa-padel-1267.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RUSSA PÃDEL',
      'Presidente: JUAN SEBASTIAN PEÃARANDA CACERES. Deporte(s): Padel. Localidad: Barrios Unidos. Resolución R-D Nº 1267.0 / actualización Nº N/A. Vigente hasta 2030-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3134504666',
      'gerencia@socialspacecol.com',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-russa-padel-1267.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-russa-padel-1267.0', v_school_id, '{"resolucion_rd": "1267.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-13", "fecha_fin": "2030-11-13", "presidente": "JUAN SEBASTIAN PEÃARANDA CACERES", "localidad": "Barrios Unidos", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIAN PEÃARANDA CACERES. Deporte(s): Padel. Localidad: Barrios Unidos. Resolución R-D Nº 1267.0 / actualización Nº N/A. Vigente hasta 2030-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134504666', phone),
      email       = COALESCE('gerencia@socialspacecol.com', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1267.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-13", "fecha_fin": "2030-11-13", "presidente": "JUAN SEBASTIAN PEÃARANDA CACERES", "localidad": "Barrios Unidos", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-russa-padel-1267.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3134504666', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLETICO CANARIOS BOGOTA  (IDRD-CLUB-club-deportivo-atletico-canarios-bogota-1299.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletico-canarios-bogota-1299.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLETICO CANARIOS BOGOTA',
      'Presidente: FAVIAN ESNEYDER DELGADO QUIROGA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1299.0 / actualización Nº N/A. Vigente hasta 2030-11-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3144892981',
      'monarcasbogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atletico-canarios-bogota-1299.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atletico-canarios-bogota-1299.0', v_school_id, '{"resolucion_rd": "1299.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-07", "fecha_fin": "2030-11-07", "presidente": "FAVIAN ESNEYDER DELGADO QUIROGA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FAVIAN ESNEYDER DELGADO QUIROGA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1299.0 / actualización Nº N/A. Vigente hasta 2030-11-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144892981', phone),
      email       = COALESCE('monarcasbogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1299.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-07", "fecha_fin": "2030-11-07", "presidente": "FAVIAN ESNEYDER DELGADO QUIROGA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletico-canarios-bogota-1299.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3144892981', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TIANO  (IDRD-CLUB-club-deportivo-tiano-1295.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tiano-1295.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TIANO',
      'Presidente: CRISTHIAN DAVID HURTADO SÃNCHEZ. Deporte(s): Fútbol de salón. Localidad: Fontibón. Resolución R-D Nº 1295.0 / actualización Nº N/A. Vigente hasta 2030-11-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3222860779',
      'tiano.futsala@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tiano-1295.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tiano-1295.0', v_school_id, '{"resolucion_rd": "1295.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-06", "fecha_fin": "2030-11-06", "presidente": "CRISTHIAN DAVID HURTADO SÃNCHEZ", "localidad": "Fontibón", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTHIAN DAVID HURTADO SÃNCHEZ. Deporte(s): Fútbol de salón. Localidad: Fontibón. Resolución R-D Nº 1295.0 / actualización Nº N/A. Vigente hasta 2030-11-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222860779', phone),
      email       = COALESCE('tiano.futsala@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1295.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-11-06", "fecha_fin": "2030-11-06", "presidente": "CRISTHIAN DAVID HURTADO SÃNCHEZ", "localidad": "Fontibón", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tiano-1295.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3222860779', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO S.M.  (IDRD-CLUB-club-deportivo-sm-1230.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sm-1230.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO S.M.',
      'Presidente: EDWIN YERMEY AREVALO CARRERO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1230.0 / actualización Nº N/A. Vigente hasta 2030-10-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3015255141',
      'edwinmillos984@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sm-1230.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sm-1230.0', v_school_id, '{"resolucion_rd": "1230.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-10-29", "fecha_fin": "2030-10-29", "presidente": "EDWIN YERMEY AREVALO CARRERO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN YERMEY AREVALO CARRERO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1230.0 / actualización Nº N/A. Vigente hasta 2030-10-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3015255141', phone),
      email       = COALESCE('edwinmillos984@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1230.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2025-10-29", "fecha_fin": "2030-10-29", "presidente": "EDWIN YERMEY AREVALO CARRERO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sm-1230.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3015255141', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
