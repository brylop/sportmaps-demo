-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 8/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- TANGO FUTBOL CLUB  (IDRD-CLUB-tango-futbol-club-1379)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tango-futbol-club-1379';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TANGO FUTBOL CLUB',
      'Presidente: JAIME ORLANDO MOLINA AGUILERA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1379. Vigente hasta 2028-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3022922235',
      'tangofc2021@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tango-futbol-club-1379',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tango-futbol-club-1379', v_school_id, '{"resolucion_rd": "1379", "resolucion_actualizacion": null, "fecha_inicio": "09-11-2023", "fecha_fin": "2028-11-08", "presidente": "JAIME ORLANDO MOLINA AGUILERA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIME ORLANDO MOLINA AGUILERA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1379. Vigente hasta 2028-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3022922235', phone),
      email       = COALESCE('tangofc2021@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1379", "resolucion_actualizacion": null, "fecha_inicio": "09-11-2023", "fecha_fin": "2028-11-08", "presidente": "JAIME ORLANDO MOLINA AGUILERA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tango-futbol-club-1379';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3022922235', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PRENS TENNIS CLUB  (IDRD-CLUB-prens-tennis-club-864)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-prens-tennis-club-864';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PRENS TENNIS CLUB',
      'Presidente: HUGO ALFONSO PRENS NIVIA. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 864. Vigente hasta 2026-10-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3156164205',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'prens-tennis-club-864',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-prens-tennis-club-864', v_school_id, '{"resolucion_rd": "864", "resolucion_actualizacion": null, "fecha_inicio": "22-10-2021", "fecha_fin": "2026-10-22", "presidente": "HUGO ALFONSO PRENS NIVIA", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HUGO ALFONSO PRENS NIVIA. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 864. Vigente hasta 2026-10-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3156164205', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "864", "resolucion_actualizacion": null, "fecha_inicio": "22-10-2021", "fecha_fin": "2026-10-22", "presidente": "HUGO ALFONSO PRENS NIVIA", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-prens-tennis-club-864';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3156164205', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SIN FRONTERAS  (IDRD-CLUB-sin-fronteras-1401)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sin-fronteras-1401';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SIN FRONTERAS',
      'Presidente: HERNANDO LUIS GARCIA BARCO. Deporte(s): Softbol. Localidad: Engativá. Resolución R-D Nº 1401. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3238165277',
      'lugarsal@hotmail.com',
      ARRAY['Softbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sin-fronteras-1401',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sin-fronteras-1401', v_school_id, '{"resolucion_rd": "1401", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "HERNANDO LUIS GARCIA BARCO", "localidad": "Engativá", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HERNANDO LUIS GARCIA BARCO. Deporte(s): Softbol. Localidad: Engativá. Resolución R-D Nº 1401. Vigente hasta 2028-11-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3238165277', phone),
      email       = COALESCE('lugarsal@hotmail.com', email),
      sports      = ARRAY['Softbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1401", "resolucion_actualizacion": null, "fecha_inicio": "24-11-2023", "fecha_fin": "2028-11-23", "presidente": "HERNANDO LUIS GARCIA BARCO", "localidad": "Engativá", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sin-fronteras-1401';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3238165277', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GIGANTES  (IDRD-CLUB-gigantes-1471)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gigantes-1471';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GIGANTES',
      'Presidente: ROGER ANTONIO PARADA RIAÃO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1471. Vigente hasta 2028-12-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3105897310',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gigantes-1471',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gigantes-1471', v_school_id, '{"resolucion_rd": "1471", "resolucion_actualizacion": null, "fecha_inicio": "05-12-2023", "fecha_fin": "2028-12-04", "presidente": "ROGER ANTONIO PARADA RIAÃO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROGER ANTONIO PARADA RIAÃO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1471. Vigente hasta 2028-12-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105897310', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1471", "resolucion_actualizacion": null, "fecha_inicio": "05-12-2023", "fecha_fin": "2028-12-04", "presidente": "ROGER ANTONIO PARADA RIAÃO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gigantes-1471';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3105897310', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FORZA ALIANTA BOGOTÃ  (IDRD-CLUB-forza-alianta-bogota-1479)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-forza-alianta-bogota-1479';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FORZA ALIANTA BOGOTÃ',
      'Presidente: WILLIAM STEAK VERA MARTINEZ. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1479. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3143720021',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'forza-alianta-bogota-1479',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-forza-alianta-bogota-1479', v_school_id, '{"resolucion_rd": "1479", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "WILLIAM STEAK VERA MARTINEZ", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM STEAK VERA MARTINEZ. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1479. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143720021', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1479", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "WILLIAM STEAK VERA MARTINEZ", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-forza-alianta-bogota-1479';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3143720021', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GENIOS DEL AJEDREZ  (IDRD-CLUB-genios-del-ajedrez-1473)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-genios-del-ajedrez-1473';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GENIOS DEL AJEDREZ',
      'Presidente: ROSMERY TORRES SAENZ. Deporte(s): Ajedrez. Localidad: Teusaquillo. Resolución R-D Nº 1473. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3228416297',
      'geniosdelajedrez@gmail.coom',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'genios-del-ajedrez-1473',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-genios-del-ajedrez-1473', v_school_id, '{"resolucion_rd": "1473", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "ROSMERY TORRES SAENZ", "localidad": "Teusaquillo", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROSMERY TORRES SAENZ. Deporte(s): Ajedrez. Localidad: Teusaquillo. Resolución R-D Nº 1473. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3228416297', phone),
      email       = COALESCE('geniosdelajedrez@gmail.coom', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1473", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "ROSMERY TORRES SAENZ", "localidad": "Teusaquillo", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-genios-del-ajedrez-1473';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3228416297', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BECYCLING  (IDRD-CLUB-becycling-1476)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-becycling-1476';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BECYCLING',
      'Presidente: CARLOS ANDRES JIMENEZ MUÃOZ. Deporte(s): Ciclismo. Localidad: Suba. Resolución R-D Nº 1476. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3112082119',
      'becylingteam@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'becycling-1476',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-becycling-1476', v_school_id, '{"resolucion_rd": "1476", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "CARLOS ANDRES JIMENEZ MUÃOZ", "localidad": "Suba", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRES JIMENEZ MUÃOZ. Deporte(s): Ciclismo. Localidad: Suba. Resolución R-D Nº 1476. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112082119', phone),
      email       = COALESCE('becylingteam@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1476", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "CARLOS ANDRES JIMENEZ MUÃOZ", "localidad": "Suba", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-becycling-1476';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3112082119', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- C.D. INSIDE  (IDRD-CLUB-cd-inside-1480)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cd-inside-1480';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'C.D. INSIDE',
      'Presidente: YEFFER ALEJANDRO PEÃA LEGUIZAMON. Deporte(s): Ultimate. Localidad: Engativá. Resolución R-D Nº 1480. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3195918542',
      'clubdeportivoinside@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cd-inside-1480',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cd-inside-1480', v_school_id, '{"resolucion_rd": "1480", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "YEFFER ALEJANDRO PEÃA LEGUIZAMON", "localidad": "Engativá", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YEFFER ALEJANDRO PEÃA LEGUIZAMON. Deporte(s): Ultimate. Localidad: Engativá. Resolución R-D Nº 1480. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195918542', phone),
      email       = COALESCE('clubdeportivoinside@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1480", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "YEFFER ALEJANDRO PEÃA LEGUIZAMON", "localidad": "Engativá", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cd-inside-1480';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3195918542', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PATINAJE ANDINOâ  (IDRD-CLUB-patinaje-andinoa-1474)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-patinaje-andinoa-1474';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PATINAJE ANDINOâ',
      'Presidente: LILYAM EMILCE MARÃN ARCE. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 1474. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3212954852',
      'bogota.andinopatinaje@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'patinaje-andinoa-1474',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-patinaje-andinoa-1474', v_school_id, '{"resolucion_rd": "1474", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "LILYAM EMILCE MARÃN ARCE", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LILYAM EMILCE MARÃN ARCE. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 1474. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212954852', phone),
      email       = COALESCE('bogota.andinopatinaje@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1474", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "LILYAM EMILCE MARÃN ARCE", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-patinaje-andinoa-1474';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3212954852', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REDENTORES F.C. BOGOTÃ  (IDRD-CLUB-redentores-fc-bogota-1472)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-redentores-fc-bogota-1472';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REDENTORES F.C. BOGOTÃ',
      'Presidente: GREGORIO ALEXANDER PRIETO AVENDAÃO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1472. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '60117688807',
      'redentores.bogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'redentores-fc-bogota-1472',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-redentores-fc-bogota-1472', v_school_id, '{"resolucion_rd": "1472", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "GREGORIO ALEXANDER PRIETO AVENDAÃO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GREGORIO ALEXANDER PRIETO AVENDAÃO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1472. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('60117688807', phone),
      email       = COALESCE('redentores.bogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1472", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "GREGORIO ALEXANDER PRIETO AVENDAÃO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-redentores-fc-bogota-1472';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '60117688807', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SANTA ANA VOLLEY  (IDRD-CLUB-santa-ana-volley-1521)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-santa-ana-volley-1521';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SANTA ANA VOLLEY',
      'Presidente: JERSSON DARIO LOPEZ SILVA. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 1521. Vigente hasta 2028-12-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3138620026',
      'santaanavolleyclub@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'santa-ana-volley-1521',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-santa-ana-volley-1521', v_school_id, '{"resolucion_rd": "1521", "resolucion_actualizacion": null, "fecha_inicio": "07-12-2023", "fecha_fin": "2028-12-06", "presidente": "JERSSON DARIO LOPEZ SILVA", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JERSSON DARIO LOPEZ SILVA. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 1521. Vigente hasta 2028-12-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138620026', phone),
      email       = COALESCE('santaanavolleyclub@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1521", "resolucion_actualizacion": null, "fecha_inicio": "07-12-2023", "fecha_fin": "2028-12-06", "presidente": "JERSSON DARIO LOPEZ SILVA", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-santa-ana-volley-1521';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3138620026', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TALENTOS COLOMBIA,  (IDRD-CLUB-talentos-colombia-1541)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-talentos-colombia-1541';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TALENTOS COLOMBIA,',
      'Presidente: HECTOR JAVIER PINILLA CASTILLO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1541. Vigente hasta 2028-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3212950843',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'talentos-colombia-1541',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-talentos-colombia-1541', v_school_id, '{"resolucion_rd": "1541", "resolucion_actualizacion": null, "fecha_inicio": "11-12-2023", "fecha_fin": "2028-12-10", "presidente": "HECTOR JAVIER PINILLA CASTILLO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HECTOR JAVIER PINILLA CASTILLO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1541. Vigente hasta 2028-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212950843', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1541", "resolucion_actualizacion": null, "fecha_inicio": "11-12-2023", "fecha_fin": "2028-12-10", "presidente": "HECTOR JAVIER PINILLA CASTILLO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-talentos-colombia-1541';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3212950843', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- AJEDREZ MENTES BRILLANTES  (IDRD-CLUB-ajedrez-mentes-brillantes-1572)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ajedrez-mentes-brillantes-1572';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'AJEDREZ MENTES BRILLANTES',
      'Presidente: GERMAN DARIO UNIVIO SANCHEZ. Deporte(s): Ajedrez. Localidad: Suba. Resolución R-D Nº 1572. Vigente hasta 2028-12-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3102595742',
      'clubdeajedrezmentesbrillantes@gmail.com',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ajedrez-mentes-brillantes-1572',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ajedrez-mentes-brillantes-1572', v_school_id, '{"resolucion_rd": "1572", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2023", "fecha_fin": "2028-12-14", "presidente": "GERMAN DARIO UNIVIO SANCHEZ", "localidad": "Suba", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GERMAN DARIO UNIVIO SANCHEZ. Deporte(s): Ajedrez. Localidad: Suba. Resolución R-D Nº 1572. Vigente hasta 2028-12-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102595742', phone),
      email       = COALESCE('clubdeajedrezmentesbrillantes@gmail.com', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1572", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2023", "fecha_fin": "2028-12-14", "presidente": "GERMAN DARIO UNIVIO SANCHEZ", "localidad": "Suba", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ajedrez-mentes-brillantes-1572';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3102595742', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CENTAUROS BOGOTÃ FC  (IDRD-CLUB-centauros-bogota-fc-1588)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-centauros-bogota-fc-1588';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CENTAUROS BOGOTÃ FC',
      'Presidente: JEISON DANIEL LÃPEZ FRAILE. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1588. Vigente hasta 2028-12-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3144352955',
      'info@centauros.com.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'centauros-bogota-fc-1588',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-centauros-bogota-fc-1588', v_school_id, '{"resolucion_rd": "1588", "resolucion_actualizacion": null, "fecha_inicio": "16-12-2023", "fecha_fin": "2028-12-15", "presidente": "JEISON DANIEL LÃPEZ FRAILE", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISON DANIEL LÃPEZ FRAILE. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1588. Vigente hasta 2028-12-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144352955', phone),
      email       = COALESCE('info@centauros.com.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1588", "resolucion_actualizacion": null, "fecha_inicio": "16-12-2023", "fecha_fin": "2028-12-15", "presidente": "JEISON DANIEL LÃPEZ FRAILE", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-centauros-bogota-fc-1588';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3144352955', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- WARRIORS CITY FC  (IDRD-CLUB-warriors-city-fc-1568)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-warriors-city-fc-1568';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'WARRIORS CITY FC',
      'Presidente: IVAN DARIO CPY FORERO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1568. Vigente hasta 2028-12-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3228820831',
      'icoyforero@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'warriors-city-fc-1568',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-warriors-city-fc-1568', v_school_id, '{"resolucion_rd": "1568", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2023", "fecha_fin": "2028-12-12", "presidente": "IVAN DARIO CPY FORERO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVAN DARIO CPY FORERO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1568. Vigente hasta 2028-12-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3228820831', phone),
      email       = COALESCE('icoyforero@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1568", "resolucion_actualizacion": null, "fecha_inicio": "13-12-2023", "fecha_fin": "2028-12-12", "presidente": "IVAN DARIO CPY FORERO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-warriors-city-fc-1568';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3228820831', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA CAPITAL  (IDRD-CLUB-la-capital-1608)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-capital-1608';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA CAPITAL',
      'Presidente: FABIO ANDRES ELIGIO PICO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1608. Vigente hasta 2028-12-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3212648420',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-capital-1608',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-capital-1608', v_school_id, '{"resolucion_rd": "1608", "resolucion_actualizacion": null, "fecha_inicio": "18-12-2023", "fecha_fin": "2028-12-17", "presidente": "FABIO ANDRES ELIGIO PICO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIO ANDRES ELIGIO PICO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1608. Vigente hasta 2028-12-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212648420', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1608", "resolucion_actualizacion": null, "fecha_inicio": "18-12-2023", "fecha_fin": "2028-12-17", "presidente": "FABIO ANDRES ELIGIO PICO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-capital-1608';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3212648420', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALIANZA SUR FC  (IDRD-CLUB-alianza-sur-fc-1611)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-alianza-sur-fc-1611';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALIANZA SUR FC',
      'Presidente: AUGUSTO ORTIZ RAMIREZ. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 1611. Vigente hasta 2028-12-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3208724559',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'alianza-sur-fc-1611',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-alianza-sur-fc-1611', v_school_id, '{"resolucion_rd": "1611", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2023", "fecha_fin": "2028-12-18", "presidente": "AUGUSTO ORTIZ RAMIREZ", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AUGUSTO ORTIZ RAMIREZ. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 1611. Vigente hasta 2028-12-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208724559', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1611", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2023", "fecha_fin": "2028-12-18", "presidente": "AUGUSTO ORTIZ RAMIREZ", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-alianza-sur-fc-1611';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3208724559', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO F&G  (IDRD-CLUB-club-deportivo-fg-1612)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fg-1612';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO F&G',
      'Presidente: YENNYFER ANGELICA GONZALEZ CORTES. Deporte(s): Tenis de mesa. Localidad: Kennedy. Resolución R-D Nº 1612. Vigente hasta 2028-12-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3183766131',
      'ttcenterfgclubdeportivo@gmail.com',
      ARRAY['Tenis de mesa']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fg-1612',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fg-1612', v_school_id, '{"resolucion_rd": "1612", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2023", "fecha_fin": "2028-12-18", "presidente": "YENNYFER ANGELICA GONZALEZ CORTES", "localidad": "Kennedy", "sports": ["Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YENNYFER ANGELICA GONZALEZ CORTES. Deporte(s): Tenis de mesa. Localidad: Kennedy. Resolución R-D Nº 1612. Vigente hasta 2028-12-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183766131', phone),
      email       = COALESCE('ttcenterfgclubdeportivo@gmail.com', email),
      sports      = ARRAY['Tenis de mesa']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1612", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2023", "fecha_fin": "2028-12-18", "presidente": "YENNYFER ANGELICA GONZALEZ CORTES", "localidad": "Kennedy", "sports": ["Tenis de mesa"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fg-1612';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3183766131', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTURE PLAY  (IDRD-CLUB-future-play-1636)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-future-play-1636';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTURE PLAY',
      'Presidente: EDGAR ALFONSO CRUZ. Deporte(s): Tenis. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1636. Vigente hasta 2029-01-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3053155632',
      'centrodeportivofutureplay@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'future-play-1636',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-future-play-1636', v_school_id, '{"resolucion_rd": "1636", "resolucion_actualizacion": null, "fecha_inicio": "02-01-2024", "fecha_fin": "2029-01-01", "presidente": "EDGAR ALFONSO CRUZ", "localidad": "Rafael Uribe Uribe", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR ALFONSO CRUZ. Deporte(s): Tenis. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1636. Vigente hasta 2029-01-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3053155632', phone),
      email       = COALESCE('centrodeportivofutureplay@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1636", "resolucion_actualizacion": null, "fecha_inicio": "02-01-2024", "fecha_fin": "2029-01-01", "presidente": "EDGAR ALFONSO CRUZ", "localidad": "Rafael Uribe Uribe", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-future-play-1636';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3053155632', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- WOLVES BTÃ FC  (IDRD-CLUB-wolves-bta-fc-1664)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-wolves-bta-fc-1664';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'WOLVES BTÃ FC',
      'Presidente: JOHN ALEXSANDER VARON RAMIREZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1664. Vigente hasta 2028-12-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3504342800',
      'clubdeportivowolvesbta@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'wolves-bta-fc-1664',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-wolves-bta-fc-1664', v_school_id, '{"resolucion_rd": "1664", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2023", "fecha_fin": "2028-12-26", "presidente": "JOHN ALEXSANDER VARON RAMIREZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN ALEXSANDER VARON RAMIREZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1664. Vigente hasta 2028-12-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3504342800', phone),
      email       = COALESCE('clubdeportivowolvesbta@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1664", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2023", "fecha_fin": "2028-12-26", "presidente": "JOHN ALEXSANDER VARON RAMIREZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-wolves-bta-fc-1664';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3504342800', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FREEROLLERS  (IDRD-CLUB-freerollers-1662)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-freerollers-1662';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FREEROLLERS',
      'Presidente: JENNY ALEJANDRA AMADOR CARDENAS. Deporte(s): Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 1662. Vigente hasta 2028-12-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3023178190',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'freerollers-1662',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-freerollers-1662', v_school_id, '{"resolucion_rd": "1662", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2023", "fecha_fin": "2028-12-26", "presidente": "JENNY ALEJANDRA AMADOR CARDENAS", "localidad": "San Cristóbal", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNY ALEJANDRA AMADOR CARDENAS. Deporte(s): Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 1662. Vigente hasta 2028-12-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3023178190', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1662", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2023", "fecha_fin": "2028-12-26", "presidente": "JENNY ALEJANDRA AMADOR CARDENAS", "localidad": "San Cristóbal", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-freerollers-1662';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3023178190', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INTERNACIONAL DE AMERICA F.C  (IDRD-CLUB-internacional-de-america-fc-1667)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-internacional-de-america-fc-1667';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INTERNACIONAL DE AMERICA F.C',
      'Presidente: OSCAR HUMBERTO CANTOR HERNANDEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1667. Vigente hasta 2028-12-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3118499827',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'internacional-de-america-fc-1667',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-internacional-de-america-fc-1667', v_school_id, '{"resolucion_rd": "1667", "resolucion_actualizacion": null, "fecha_inicio": "29-12-2023", "fecha_fin": "2028-12-28", "presidente": "OSCAR HUMBERTO CANTOR HERNANDEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR HUMBERTO CANTOR HERNANDEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1667. Vigente hasta 2028-12-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118499827', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1667", "resolucion_actualizacion": null, "fecha_inicio": "29-12-2023", "fecha_fin": "2028-12-28", "presidente": "OSCAR HUMBERTO CANTOR HERNANDEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-internacional-de-america-fc-1667';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3118499827', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO INVICTUS  (IDRD-CLUB-club-deportivo-invictus-227)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-invictus-227';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO INVICTUS',
      'Presidente: JAVIER JHUNIOR CUESTAS MANZO. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 227. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3204351872',
      'invictus93@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-invictus-227',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-invictus-227', v_school_id, '{"resolucion_rd": "227", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2024", "fecha_fin": "2029-02-27", "presidente": "JAVIER JHUNIOR CUESTAS MANZO", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAVIER JHUNIOR CUESTAS MANZO. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 227. Vigente hasta 2029-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204351872', phone),
      email       = COALESCE('invictus93@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "227", "resolucion_actualizacion": null, "fecha_inicio": "28-02-2024", "fecha_fin": "2029-02-27", "presidente": "JAVIER JHUNIOR CUESTAS MANZO", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-invictus-227';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3204351872', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ACADEMIA WEST HAM UNITED  (IDRD-CLUB-academia-west-ham-united-1661)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-academia-west-ham-united-1661';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ACADEMIA WEST HAM UNITED',
      'Presidente: GLORIA INES ROJAS PEREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1661. Vigente hasta 2028-12-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3007223303',
      'academiawhu@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'academia-west-ham-united-1661',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-academia-west-ham-united-1661', v_school_id, '{"resolucion_rd": "1661", "resolucion_actualizacion": null, "fecha_inicio": "26-12-2023", "fecha_fin": "2028-12-25", "presidente": "GLORIA INES ROJAS PEREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GLORIA INES ROJAS PEREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1661. Vigente hasta 2028-12-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007223303', phone),
      email       = COALESCE('academiawhu@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1661", "resolucion_actualizacion": null, "fecha_inicio": "26-12-2023", "fecha_fin": "2028-12-25", "presidente": "GLORIA INES ROJAS PEREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-academia-west-ham-united-1661';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3007223303', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RACQUET CLUB  (IDRD-CLUB-club-deportivo-racquet-club-1746)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-racquet-club-1746';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RACQUET CLUB',
      'Presidente: CARLOS EDUARDO NOVOA MOLINA. Deporte(s): Raquetball. Localidad: Usaquén. Resolución R-D Nº 1746. Vigente hasta 2029-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3057086968',
      'oscar.pineros@gmail.com',
      ARRAY['Raquetball']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-racquet-club-1746',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-racquet-club-1746', v_school_id, '{"resolucion_rd": "1746", "resolucion_actualizacion": null, "fecha_inicio": "16-01-2024", "fecha_fin": "2029-01-15", "presidente": "CARLOS EDUARDO NOVOA MOLINA", "localidad": "Usaquén", "sports": ["Raquetball"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS EDUARDO NOVOA MOLINA. Deporte(s): Raquetball. Localidad: Usaquén. Resolución R-D Nº 1746. Vigente hasta 2029-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057086968', phone),
      email       = COALESCE('oscar.pineros@gmail.com', email),
      sports      = ARRAY['Raquetball']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1746", "resolucion_actualizacion": null, "fecha_inicio": "16-01-2024", "fecha_fin": "2029-01-15", "presidente": "CARLOS EDUARDO NOVOA MOLINA", "localidad": "Usaquén", "sports": ["Raquetball"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-racquet-club-1746';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3057086968', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO KOREAN RYU  (IDRD-CLUB-club-deportivo-taekwondo-korean-ryu-1750)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-korean-ryu-1750';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO KOREAN RYU',
      'Presidente: EDILBERTO QUEVEDO VALENCIA. Deporte(s): Taekwondo. Localidad: Bosa. Resolución R-D Nº 1750. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3144837575',
      'koreanryu01@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-korean-ryu-1750',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-korean-ryu-1750', v_school_id, '{"resolucion_rd": "1750", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "EDILBERTO QUEVEDO VALENCIA", "localidad": "Bosa", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDILBERTO QUEVEDO VALENCIA. Deporte(s): Taekwondo. Localidad: Bosa. Resolución R-D Nº 1750. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144837575', phone),
      email       = COALESCE('koreanryu01@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1750", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "EDILBERTO QUEVEDO VALENCIA", "localidad": "Bosa", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-korean-ryu-1750';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3144837575', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SKATE COLOMBIA  (IDRD-CLUB-skate-colombia-1752)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-skate-colombia-1752';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SKATE COLOMBIA',
      'Presidente: XIMENA ALEXANDRA MARTINEZ SUAN. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1752. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3142404787',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'skate-colombia-1752',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-skate-colombia-1752', v_school_id, '{"resolucion_rd": "1752", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "XIMENA ALEXANDRA MARTINEZ SUAN", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: XIMENA ALEXANDRA MARTINEZ SUAN. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1752. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142404787', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1752", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "XIMENA ALEXANDRA MARTINEZ SUAN", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-skate-colombia-1752';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3142404787', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CAPITALINAS  (IDRD-CLUB-club-deportivo-capitalinas-1755)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-capitalinas-1755';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CAPITALINAS',
      'Presidente: WILLIAM MEZA FLOREZ. Deporte(s): Softbol. Localidad: Kennedy. Resolución R-D Nº 1755. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3156827588',
      'foderdde@gmail.com',
      ARRAY['Softbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-capitalinas-1755',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-capitalinas-1755', v_school_id, '{"resolucion_rd": "1755", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "WILLIAM MEZA FLOREZ", "localidad": "Kennedy", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM MEZA FLOREZ. Deporte(s): Softbol. Localidad: Kennedy. Resolución R-D Nº 1755. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3156827588', phone),
      email       = COALESCE('foderdde@gmail.com', email),
      sports      = ARRAY['Softbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1755", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "WILLIAM MEZA FLOREZ", "localidad": "Kennedy", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-capitalinas-1755';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3156827588', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FORZA CAPITAL F.C  (IDRD-CLUB-club-deportivo-forza-capital-fc-1758)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-forza-capital-fc-1758';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FORZA CAPITAL F.C',
      'Presidente: SERGIO ANDRES AVILA HERNÃÂNDEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1758. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3007487675',
      'sergioavila87@outlook.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-forza-capital-fc-1758',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-forza-capital-fc-1758', v_school_id, '{"resolucion_rd": "1758", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "SERGIO ANDRES AVILA HERNÃÂNDEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SERGIO ANDRES AVILA HERNÃÂNDEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1758. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007487675', phone),
      email       = COALESCE('sergioavila87@outlook.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1758", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "SERGIO ANDRES AVILA HERNÃÂNDEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-forza-capital-fc-1758';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3007487675', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CENTAUROS BOGOTÃÂ BASKETBALL  (IDRD-CLUB-club-deportivo-centauros-bogotaa-basketb-1761)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-centauros-bogotaa-basketb-1761';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CENTAUROS BOGOTÃÂ BASKETBALL',
      'Presidente: ANDRES FABIAN MARIN FAJARDO. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 1761. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3160552838',
      'centaurosbasquetbolclub@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-centauros-bogotaa-basketb-1761',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-centauros-bogotaa-basketb-1761', v_school_id, '{"resolucion_rd": "1761", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "ANDRES FABIAN MARIN FAJARDO", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES FABIAN MARIN FAJARDO. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 1761. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3160552838', phone),
      email       = COALESCE('centaurosbasquetbolclub@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1761", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "ANDRES FABIAN MARIN FAJARDO", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-centauros-bogotaa-basketb-1761';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3160552838', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FOOTBALL ACADEMY YOUNG BOYS  (IDRD-CLUB-club-deportivo-football-academy-young-bo-1763)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-football-academy-young-bo-1763';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FOOTBALL ACADEMY YOUNG BOYS',
      'Presidente: KEVIN BENAVIDES AVILA. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1763. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3212519962',
      'academyoungboys@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-football-academy-young-bo-1763',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-football-academy-young-bo-1763', v_school_id, '{"resolucion_rd": "1763", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "KEVIN BENAVIDES AVILA", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KEVIN BENAVIDES AVILA. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1763. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212519962', phone),
      email       = COALESCE('academyoungboys@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1763", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "KEVIN BENAVIDES AVILA", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-football-academy-young-bo-1763';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3212519962', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAVATE FENIX SOLAR  (IDRD-CLUB-club-deportivo-savate-fenix-solar-1764)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-savate-fenix-solar-1764';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAVATE FENIX SOLAR',
      'Presidente: CARLOS ANDRES CONTRERAS RENTERIA. Deporte(s): Hapkido, Savate. Localidad: Kennedy. Resolución R-D Nº 1764. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3102224020',
      'escuelafenixsolar@gmail.com',
      ARRAY['Hapkido','Savate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-savate-fenix-solar-1764',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-savate-fenix-solar-1764', v_school_id, '{"resolucion_rd": "1764", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "CARLOS ANDRES CONTRERAS RENTERIA", "localidad": "Kennedy", "sports": ["Hapkido", "Savate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRES CONTRERAS RENTERIA. Deporte(s): Hapkido, Savate. Localidad: Kennedy. Resolución R-D Nº 1764. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102224020', phone),
      email       = COALESCE('escuelafenixsolar@gmail.com', email),
      sports      = ARRAY['Hapkido','Savate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1764", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "CARLOS ANDRES CONTRERAS RENTERIA", "localidad": "Kennedy", "sports": ["Hapkido", "Savate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-savate-fenix-solar-1764';
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
-- CLUB DEPORTIVO ATLÃâ°TICO BILBAO  (IDRD-CLUB-club-deportivo-atlaatico-bilbao-1756)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlaatico-bilbao-1756';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLÃâ°TICO BILBAO',
      'Presidente: JUAN LUIS MERCADO ARROYO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1756. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3134948337',
      'atleticobilbao2021@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlaatico-bilbao-1756',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlaatico-bilbao-1756', v_school_id, '{"resolucion_rd": "1756", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "JUAN LUIS MERCADO ARROYO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN LUIS MERCADO ARROYO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1756. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134948337', phone),
      email       = COALESCE('atleticobilbao2021@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1756", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "JUAN LUIS MERCADO ARROYO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlaatico-bilbao-1756';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3134948337', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HUNTERS BASKETBALL CLUB  (IDRD-CLUB-club-deportivo-hunters-basketball-club-1769)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-hunters-basketball-club-1769';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HUNTERS BASKETBALL CLUB',
      'Presidente: JEIMMY PAOLA LOPEZ QUINTERO. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 1769. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3172190471',
      'hunterscyt25@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-hunters-basketball-club-1769',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-hunters-basketball-club-1769', v_school_id, '{"resolucion_rd": "1769", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "JEIMMY PAOLA LOPEZ QUINTERO", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEIMMY PAOLA LOPEZ QUINTERO. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 1769. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3172190471', phone),
      email       = COALESCE('hunterscyt25@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1769", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "JEIMMY PAOLA LOPEZ QUINTERO", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-hunters-basketball-club-1769';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3172190471', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VOLEYLUNA CLUB  (IDRD-CLUB-club-deportivo-voleyluna-club-1760)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-voleyluna-club-1760';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VOLEYLUNA CLUB',
      'Presidente: ANAXAGORAS DIOFANTO CORTES ARIAS. Deporte(s): Voleibol. Localidad: Fontibón. Resolución R-D Nº 1760. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3102450188',
      'voleyluna@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-voleyluna-club-1760',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-voleyluna-club-1760', v_school_id, '{"resolucion_rd": "1760", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "ANAXAGORAS DIOFANTO CORTES ARIAS", "localidad": "Fontibón", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANAXAGORAS DIOFANTO CORTES ARIAS. Deporte(s): Voleibol. Localidad: Fontibón. Resolución R-D Nº 1760. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102450188', phone),
      email       = COALESCE('voleyluna@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1760", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "ANAXAGORAS DIOFANTO CORTES ARIAS", "localidad": "Fontibón", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-voleyluna-club-1760';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3102450188', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FURIA ALBIRROJA  (IDRD-CLUB-furia-albirroja-1772)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-furia-albirroja-1772';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FURIA ALBIRROJA',
      'Presidente: GIOVANNY ANDRES MORENO GRANADOS. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 1772. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3166145527',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'furia-albirroja-1772',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-furia-albirroja-1772', v_school_id, '{"resolucion_rd": "1772", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "GIOVANNY ANDRES MORENO GRANADOS", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GIOVANNY ANDRES MORENO GRANADOS. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 1772. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3166145527', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1772", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "GIOVANNY ANDRES MORENO GRANADOS", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-furia-albirroja-1772';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3166145527', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ABADIA  (IDRD-CLUB-club-deportivo-abadia-1770)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-abadia-1770';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ABADIA',
      'Presidente: ANGELA ADRIANA PACHON CONTRERAS. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1770. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3103072797',
      'abadiaclub@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-abadia-1770',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-abadia-1770', v_school_id, '{"resolucion_rd": "1770", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "ANGELA ADRIANA PACHON CONTRERAS", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELA ADRIANA PACHON CONTRERAS. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1770. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103072797', phone),
      email       = COALESCE('abadiaclub@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1770", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "ANGELA ADRIANA PACHON CONTRERAS", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-abadia-1770';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3103072797', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SHALOM SOCCER F.C  (IDRD-CLUB-club-deportivo-shalom-soccer-fc-1780)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-shalom-soccer-fc-1780';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SHALOM SOCCER F.C',
      'Presidente: OMAR ALBERTO CELEITA CUELLAR. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1780. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3142288342',
      'efd.shalomsoccer@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-shalom-soccer-fc-1780',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-shalom-soccer-fc-1780', v_school_id, '{"resolucion_rd": "1780", "resolucion_actualizacion": null, "fecha_inicio": "19-01-2024", "fecha_fin": "2029-01-18", "presidente": "OMAR ALBERTO CELEITA CUELLAR", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OMAR ALBERTO CELEITA CUELLAR. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1780. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142288342', phone),
      email       = COALESCE('efd.shalomsoccer@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1780", "resolucion_actualizacion": null, "fecha_inicio": "19-01-2024", "fecha_fin": "2029-01-18", "presidente": "OMAR ALBERTO CELEITA CUELLAR", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-shalom-soccer-fc-1780';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3142288342', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MASTERÃ¢â¬â¢S VOLLEY COLOMBIA  (IDRD-CLUB-club-deportivo-masteraaas-volley-colombi-1786)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-masteraaas-volley-colombi-1786';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MASTERÃ¢â¬â¢S VOLLEY COLOMBIA',
      'Presidente: WILLINGTON BAEZ VELA. Localidad: Bosa. Resolución R-D Nº 1786. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      NULL,
      'mastersvolleyclub2021@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-masteraaas-volley-colombi-1786',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-masteraaas-volley-colombi-1786', v_school_id, '{"resolucion_rd": "1786", "resolucion_actualizacion": null, "fecha_inicio": "19-01-2024", "fecha_fin": "2029-01-18", "presidente": "WILLINGTON BAEZ VELA", "localidad": "Bosa", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLINGTON BAEZ VELA. Localidad: Bosa. Resolución R-D Nº 1786. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('mastersvolleyclub2021@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1786", "resolucion_actualizacion": null, "fecha_inicio": "19-01-2024", "fecha_fin": "2029-01-18", "presidente": "WILLINGTON BAEZ VELA", "localidad": "Bosa", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-masteraaas-volley-colombi-1786';
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
-- CLUB DEPORTIVO VISSEL VOLLEY CLUB  (IDRD-CLUB-club-deportivo-vissel-volley-club-001)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-vissel-volley-club-001';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VISSEL VOLLEY CLUB',
      'Presidente: GUSTAVO ALBERTO GOMEZ RAMIREZ. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 001. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3202181014',
      'visselvolleyclub@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-vissel-volley-club-001',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-vissel-volley-club-001', v_school_id, '{"resolucion_rd": "001", "resolucion_actualizacion": null, "fecha_inicio": "19-01-2024", "fecha_fin": "2029-01-18", "presidente": "GUSTAVO ALBERTO GOMEZ RAMIREZ", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GUSTAVO ALBERTO GOMEZ RAMIREZ. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 001. Vigente hasta 2029-01-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202181014', phone),
      email       = COALESCE('visselvolleyclub@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "001", "resolucion_actualizacion": null, "fecha_inicio": "19-01-2024", "fecha_fin": "2029-01-18", "presidente": "GUSTAVO ALBERTO GOMEZ RAMIREZ", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-vissel-volley-club-001';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3202181014', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DESTINO PARADISO  (IDRD-CLUB-club-deportivo-destino-paradiso-1751)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-destino-paradiso-1751';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DESTINO PARADISO',
      'Presidente: SONIA JACKELINE HERRERA URIBE. Deporte(s): Montanismo. Localidad: San Cristóbal. Resolución R-D Nº 1751. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3164906159',
      'destinoparadiso1@gmail.com',
      ARRAY['Montanismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-destino-paradiso-1751',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-destino-paradiso-1751', v_school_id, '{"resolucion_rd": "1751", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "SONIA JACKELINE HERRERA URIBE", "localidad": "San Cristóbal", "sports": ["Montanismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SONIA JACKELINE HERRERA URIBE. Deporte(s): Montanismo. Localidad: San Cristóbal. Resolución R-D Nº 1751. Vigente hasta 2029-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3164906159', phone),
      email       = COALESCE('destinoparadiso1@gmail.com', email),
      sports      = ARRAY['Montanismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1751", "resolucion_actualizacion": null, "fecha_inicio": "18-01-2024", "fecha_fin": "2029-01-17", "presidente": "SONIA JACKELINE HERRERA URIBE", "localidad": "San Cristóbal", "sports": ["Montanismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-destino-paradiso-1751';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3164906159', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTÃÂ BMX FREESTYLE CLUB  (IDRD-CLUB-club-deportivo-bogotaa-bmx-freestyle-clu-010)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogotaa-bmx-freestyle-clu-010';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTÃÂ BMX FREESTYLE CLUB',
      'Presidente: SEBASTIAN PALENCIA CONTRERAS. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 010. Vigente hasta 2029-01-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3182801920',
      'bogotabmxfreestyleclub@gmail.com.',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogotaa-bmx-freestyle-clu-010',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogotaa-bmx-freestyle-clu-010', v_school_id, '{"resolucion_rd": "010", "resolucion_actualizacion": null, "fecha_inicio": "23-01-2024", "fecha_fin": "2029-01-22", "presidente": "SEBASTIAN PALENCIA CONTRERAS", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SEBASTIAN PALENCIA CONTRERAS. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 010. Vigente hasta 2029-01-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3182801920', phone),
      email       = COALESCE('bogotabmxfreestyleclub@gmail.com.', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "010", "resolucion_actualizacion": null, "fecha_inicio": "23-01-2024", "fecha_fin": "2029-01-22", "presidente": "SEBASTIAN PALENCIA CONTRERAS", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogotaa-bmx-freestyle-clu-010';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3182801920', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DEPOR  (IDRD-CLUB-club-deportivo-depor-468)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-depor-468';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DEPOR',
      'Presidente: GINNA NATALIA JIMENEZ AUSAQUE. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 468 / actualización Nº 468. Vigente hasta 2029-04-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3114251484',
      'depordclunja@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-depor-468',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-depor-468', v_school_id, '{"resolucion_rd": "468", "resolucion_actualizacion": "468", "fecha_inicio": "15-04-2024", "fecha_fin": "2029-04-15", "presidente": "GINNA NATALIA JIMENEZ AUSAQUE", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GINNA NATALIA JIMENEZ AUSAQUE. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 468 / actualización Nº 468. Vigente hasta 2029-04-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114251484', phone),
      email       = COALESCE('depordclunja@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "468", "resolucion_actualizacion": "468", "fecha_inicio": "15-04-2024", "fecha_fin": "2029-04-15", "presidente": "GINNA NATALIA JIMENEZ AUSAQUE", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-depor-468';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3114251484', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SANTA INES  (IDRD-CLUB-club-deportivo-santa-ines-506)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-santa-ines-506';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SANTA INES',
      'Presidente: ANGELICA TATIANA CASTAÃâEDA APONTE. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 506. Vigente hasta 2029-04-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3138495341',
      'clubescuelasantaines@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-santa-ines-506',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-santa-ines-506', v_school_id, '{"resolucion_rd": "506", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2024", "fecha_fin": "2029-04-24", "presidente": "ANGELICA TATIANA CASTAÃâEDA APONTE", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELICA TATIANA CASTAÃâEDA APONTE. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 506. Vigente hasta 2029-04-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138495341', phone),
      email       = COALESCE('clubescuelasantaines@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "506", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2024", "fecha_fin": "2029-04-24", "presidente": "ANGELICA TATIANA CASTAÃâEDA APONTE", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-santa-ines-506';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3138495341', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ONCENO CAPITALINO FC  (IDRD-CLUB-club-deportivo-onceno-capitalino-fc-499)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-onceno-capitalino-fc-499';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ONCENO CAPITALINO FC',
      'Presidente: JUAN CAMILO POMBO ARENAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 499 / actualización Nº 499. Vigente hasta 2029-10-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3112364532',
      'oncenocapitalinofc@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-onceno-capitalino-fc-499',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-onceno-capitalino-fc-499', v_school_id, '{"resolucion_rd": "499", "resolucion_actualizacion": "499", "fecha_inicio": "25-10-2024", "fecha_fin": "2029-10-25", "presidente": "JUAN CAMILO POMBO ARENAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CAMILO POMBO ARENAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 499 / actualización Nº 499. Vigente hasta 2029-10-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112364532', phone),
      email       = COALESCE('oncenocapitalinofc@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "499", "resolucion_actualizacion": "499", "fecha_inicio": "25-10-2024", "fecha_fin": "2029-10-25", "presidente": "JUAN CAMILO POMBO ARENAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-onceno-capitalino-fc-499';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3112364532', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLÃTICO TEQUENDAMA F.C.  (IDRD-CLUB-club-deportivo-atlatico-tequendama-fc-625)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-tequendama-fc-625';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLÃTICO TEQUENDAMA F.C.',
      'Presidente: ROLANDL YAIRCIFHO TRUJILLO FLORIAN. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 625. Vigente hasta 2029-05-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3183270729',
      'atleticotequendama@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlatico-tequendama-fc-625',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlatico-tequendama-fc-625', v_school_id, '{"resolucion_rd": "625", "resolucion_actualizacion": null, "fecha_inicio": "25-05-2024", "fecha_fin": "2029-05-25", "presidente": "ROLANDL YAIRCIFHO TRUJILLO FLORIAN", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROLANDL YAIRCIFHO TRUJILLO FLORIAN. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 625. Vigente hasta 2029-05-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183270729', phone),
      email       = COALESCE('atleticotequendama@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "625", "resolucion_actualizacion": null, "fecha_inicio": "25-05-2024", "fecha_fin": "2029-05-25", "presidente": "ROLANDL YAIRCIFHO TRUJILLO FLORIAN", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-tequendama-fc-625';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3183270729', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NAZARIOS  (IDRD-CLUB-club-deportivo-nazarios-596)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-nazarios-596';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NAZARIOS',
      'Presidente: OSCAR GIHOVANY MEDINA CARROLL. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 596. Vigente hasta 2029-05-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3126795329',
      'escuelaformacionnazarios@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-nazarios-596',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-nazarios-596', v_school_id, '{"resolucion_rd": "596", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2024", "fecha_fin": "2029-05-24", "presidente": "OSCAR GIHOVANY MEDINA CARROLL", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR GIHOVANY MEDINA CARROLL. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 596. Vigente hasta 2029-05-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3126795329', phone),
      email       = COALESCE('escuelaformacionnazarios@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "596", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2024", "fecha_fin": "2029-05-24", "presidente": "OSCAR GIHOVANY MEDINA CARROLL", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-nazarios-596';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3126795329', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA JULIO DONA  (IDRD-CLUB-club-deportivo-academia-julio-dona-627)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-julio-dona-627';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA JULIO DONA',
      'Presidente: NICOLAS DONA DURAN. Deporte(s): Gimnasia. Localidad: Chapinero. Resolución R-D Nº 627. Vigente hasta 2029-05-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '2187497',
      'nicolas@academiajuliodona.com',
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-julio-dona-627',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-julio-dona-627', v_school_id, '{"resolucion_rd": "627", "resolucion_actualizacion": null, "fecha_inicio": "25-05-2024", "fecha_fin": "2029-05-25", "presidente": "NICOLAS DONA DURAN", "localidad": "Chapinero", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS DONA DURAN. Deporte(s): Gimnasia. Localidad: Chapinero. Resolución R-D Nº 627. Vigente hasta 2029-05-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2187497', phone),
      email       = COALESCE('nicolas@academiajuliodona.com', email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "627", "resolucion_actualizacion": null, "fecha_inicio": "25-05-2024", "fecha_fin": "2029-05-25", "presidente": "NICOLAS DONA DURAN", "localidad": "Chapinero", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-julio-dona-627';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '2187497', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CARVAJAL GIOVANNY BENÃTEZ  (IDRD-CLUB-club-deportivo-carvajal-giovanny-benatez-597)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-carvajal-giovanny-benatez-597';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CARVAJAL GIOVANNY BENÃTEZ',
      'Presidente: GIOVANNY BENÃTEZ MADROÃERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 597. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3108884723',
      'giobenmad@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-carvajal-giovanny-benatez-597',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-carvajal-giovanny-benatez-597', v_school_id, '{"resolucion_rd": "597", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "GIOVANNY BENÃTEZ MADROÃERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GIOVANNY BENÃTEZ MADROÃERO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 597. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108884723', phone),
      email       = COALESCE('giobenmad@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "597", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "GIOVANNY BENÃTEZ MADROÃERO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-carvajal-giovanny-benatez-597';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3108884723', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BEARS BASKETBALL  (IDRD-CLUB-club-deportivo-bears-basketball-600)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bears-basketball-600';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BEARS BASKETBALL',
      'Presidente: SEBASTIÃN RICARDO RAMÃREZ CAMARGO. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 600. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3017105969',
      'bearsbasketball09@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bears-basketball-600',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bears-basketball-600', v_school_id, '{"resolucion_rd": "600", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "SEBASTIÃN RICARDO RAMÃREZ CAMARGO", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SEBASTIÃN RICARDO RAMÃREZ CAMARGO. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 600. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017105969', phone),
      email       = COALESCE('bearsbasketball09@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "600", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "SEBASTIÃN RICARDO RAMÃREZ CAMARGO", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bears-basketball-600';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3017105969', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CLUB DE CICLISMO BODY SKILLS  (IDRD-CLUB-club-deportivo-club-de-ciclismo-body-ski-546)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-club-de-ciclismo-body-ski-546';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CLUB DE CICLISMO BODY SKILLS',
      'Presidente: JOSE ANDRES PEÃA GARCIA. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 546. Vigente hasta 2029-05-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3185512273',
      'bmxbodyskills@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-club-de-ciclismo-body-ski-546',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-club-de-ciclismo-body-ski-546', v_school_id, '{"resolucion_rd": "546", "resolucion_actualizacion": null, "fecha_inicio": "06-05-2024", "fecha_fin": "2029-05-06", "presidente": "JOSE ANDRES PEÃA GARCIA", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE ANDRES PEÃA GARCIA. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 546. Vigente hasta 2029-05-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3185512273', phone),
      email       = COALESCE('bmxbodyskills@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "546", "resolucion_actualizacion": null, "fecha_inicio": "06-05-2024", "fecha_fin": "2029-05-06", "presidente": "JOSE ANDRES PEÃA GARCIA", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-club-de-ciclismo-body-ski-546';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3185512273', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SKATE DREAMS  (IDRD-CLUB-club-deportivo-skate-dreams-595)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-skate-dreams-595';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SKATE DREAMS',
      'Presidente: MARIA FERNANDA RIVERA OROZCO. Deporte(s): Patinaje. Localidad: Teusaquillo. Resolución R-D Nº 595. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3142404677',
      'edfskatedreams@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-skate-dreams-595',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-skate-dreams-595', v_school_id, '{"resolucion_rd": "595", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "MARIA FERNANDA RIVERA OROZCO", "localidad": "Teusaquillo", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA FERNANDA RIVERA OROZCO. Deporte(s): Patinaje. Localidad: Teusaquillo. Resolución R-D Nº 595. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142404677', phone),
      email       = COALESCE('edfskatedreams@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "595", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "MARIA FERNANDA RIVERA OROZCO", "localidad": "Teusaquillo", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-skate-dreams-595';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3142404677', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JAGUARES BMX  (IDRD-CLUB-club-deportivo-jaguares-bmx-593)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jaguares-bmx-593';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JAGUARES BMX',
      'Presidente: EDWIN YAMIT MARTINEZ RODRIGUEZ. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 593. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3143760959',
      'clubdeportivojaguaresbmx@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jaguares-bmx-593',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jaguares-bmx-593', v_school_id, '{"resolucion_rd": "593", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "EDWIN YAMIT MARTINEZ RODRIGUEZ", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN YAMIT MARTINEZ RODRIGUEZ. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 593. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143760959', phone),
      email       = COALESCE('clubdeportivojaguaresbmx@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "593", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "EDWIN YAMIT MARTINEZ RODRIGUEZ", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jaguares-bmx-593';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3143760959', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO SAHN YOUNG HAN  (IDRD-CLUB-club-deportivo-de-taekwondo-sahn-young-h-590)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-sahn-young-h-590';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO SAHN YOUNG HAN',
      'Presidente: HÃCTOR ALFONSO APONTE CÃCERES,. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 590. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3213265047',
      'hectoral96@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-sahn-young-h-590',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-sahn-young-h-590', v_school_id, '{"resolucion_rd": "590", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "HÃCTOR ALFONSO APONTE CÃCERES,", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HÃCTOR ALFONSO APONTE CÃCERES,. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 590. Vigente hasta 2029-05-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213265047', phone),
      email       = COALESCE('hectoral96@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "590", "resolucion_actualizacion": null, "fecha_inicio": "22-05-2024", "fecha_fin": "2029-05-22", "presidente": "HÃCTOR ALFONSO APONTE CÃCERES,", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-sahn-young-h-590';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3213265047', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUSION BOGOTÃ  (IDRD-CLUB-club-deportivo-fusion-bogota-675)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fusion-bogota-675';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUSION BOGOTÃ',
      'Presidente: ALEXANDER HUDGSON GOMEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 675. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3214911245',
      'cdfusionbogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fusion-bogota-675',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fusion-bogota-675', v_school_id, '{"resolucion_rd": "675", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "ALEXANDER HUDGSON GOMEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEXANDER HUDGSON GOMEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 675. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214911245', phone),
      email       = COALESCE('cdfusionbogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "675", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "ALEXANDER HUDGSON GOMEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fusion-bogota-675';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3214911245', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE MUAY THAI TORNADO TEAM  (IDRD-CLUB-club-deportivo-de-muay-thai-tornado-team-673)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-muay-thai-tornado-team-673';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE MUAY THAI TORNADO TEAM',
      'Presidente: MIGUEL ANGEL ESCOBAR OTAVO. Deporte(s): Muay Thai. Localidad: Suba. Resolución R-D Nº 673. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3217869674',
      'clubtornadoteam@gmail.com',
      ARRAY['Muay Thai']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-muay-thai-tornado-team-673',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-muay-thai-tornado-team-673', v_school_id, '{"resolucion_rd": "673", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "MIGUEL ANGEL ESCOBAR OTAVO", "localidad": "Suba", "sports": ["Muay Thai"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL ESCOBAR OTAVO. Deporte(s): Muay Thai. Localidad: Suba. Resolución R-D Nº 673. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3217869674', phone),
      email       = COALESCE('clubtornadoteam@gmail.com', email),
      sports      = ARRAY['Muay Thai']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "673", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "MIGUEL ANGEL ESCOBAR OTAVO", "localidad": "Suba", "sports": ["Muay Thai"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-muay-thai-tornado-team-673';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3217869674', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CYCLING PROJECT TEAM  (IDRD-CLUB-club-deportivo-cycling-project-team-667)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cycling-project-team-667';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CYCLING PROJECT TEAM',
      'Presidente: ANDREA CATALINA PALACIOS HERNÃNDEZ. Deporte(s): Ciclismo. Localidad: Usme. Resolución R-D Nº 667. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3134384723',
      'cyclingprojectteam@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cycling-project-team-667',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cycling-project-team-667', v_school_id, '{"resolucion_rd": "667", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "ANDREA CATALINA PALACIOS HERNÃNDEZ", "localidad": "Usme", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDREA CATALINA PALACIOS HERNÃNDEZ. Deporte(s): Ciclismo. Localidad: Usme. Resolución R-D Nº 667. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134384723', phone),
      email       = COALESCE('cyclingprojectteam@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "667", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "ANDREA CATALINA PALACIOS HERNÃNDEZ", "localidad": "Usme", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cycling-project-team-667';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3134384723', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TOP ONE  (IDRD-CLUB-club-deportivo-top-one-665)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-top-one-665';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TOP ONE',
      'Presidente: JHONATAN ALEXANDER TOPIA CONDE. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 665. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3229459764',
      'clubdeportivotopone533@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-top-one-665',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-top-one-665', v_school_id, '{"resolucion_rd": "665", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "JHONATAN ALEXANDER TOPIA CONDE", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHONATAN ALEXANDER TOPIA CONDE. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 665. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3229459764', phone),
      email       = COALESCE('clubdeportivotopone533@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "665", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "JHONATAN ALEXANDER TOPIA CONDE", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-top-one-665';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3229459764', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOCCIA GIANTS CLUB  (IDRD-CLUB-club-deportivo-boccia-giants-club-666)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-boccia-giants-club-666';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOCCIA GIANTS CLUB',
      'Presidente: ANGELA GAONA NIETO. Deporte(s): Boccia. Localidad: Engativá. Resolución R-D Nº 666. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3105283851',
      'giantsbocciaclub2023@gmail.com',
      ARRAY['Boccia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-boccia-giants-club-666',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-boccia-giants-club-666', v_school_id, '{"resolucion_rd": "666", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "ANGELA GAONA NIETO", "localidad": "Engativá", "sports": ["Boccia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELA GAONA NIETO. Deporte(s): Boccia. Localidad: Engativá. Resolución R-D Nº 666. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105283851', phone),
      email       = COALESCE('giantsbocciaclub2023@gmail.com', email),
      sports      = ARRAY['Boccia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "666", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "ANGELA GAONA NIETO", "localidad": "Engativá", "sports": ["Boccia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-boccia-giants-club-666';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3105283851', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA GAITANA  (IDRD-CLUB-club-deportivo-la-gaitana-501)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-gaitana-501';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA GAITANA',
      'Presidente: MATEO FEDERICO POVEDA JIMENEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 501. Vigente hasta 2029-04-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3114494922',
      'gaitanafutbol@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-gaitana-501',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-gaitana-501', v_school_id, '{"resolucion_rd": "501", "resolucion_actualizacion": null, "fecha_inicio": "23-04-2024", "fecha_fin": "2029-04-23", "presidente": "MATEO FEDERICO POVEDA JIMENEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MATEO FEDERICO POVEDA JIMENEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 501. Vigente hasta 2029-04-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114494922', phone),
      email       = COALESCE('gaitanafutbol@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "501", "resolucion_actualizacion": null, "fecha_inicio": "23-04-2024", "fecha_fin": "2029-04-23", "presidente": "MATEO FEDERICO POVEDA JIMENEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-gaitana-501';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3114494922', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PROMESAS BASKETBALL CLUB  (IDRD-CLUB-club-deportivo-promesas-basketball-club-726)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-promesas-basketball-club-726';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PROMESAS BASKETBALL CLUB',
      'Presidente: JOVANNY VARGAS LANCHEROS. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 726. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3204599940',
      'promesasbasketball2017@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-promesas-basketball-club-726',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-promesas-basketball-club-726', v_school_id, '{"resolucion_rd": "726", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "JOVANNY VARGAS LANCHEROS", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOVANNY VARGAS LANCHEROS. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 726. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204599940', phone),
      email       = COALESCE('promesasbasketball2017@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "726", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "JOVANNY VARGAS LANCHEROS", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-promesas-basketball-club-726';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3204599940', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TENIS DE CAMPO GOLDEN SLAM  (IDRD-CLUB-club-deportivo-de-tenis-de-campo-golden--728)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-tenis-de-campo-golden--728';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TENIS DE CAMPO GOLDEN SLAM',
      'Presidente: JUAN CARLOS GONZALEZ VESGA. Deporte(s): Tenis. Localidad: Teusaquillo. Resolución R-D Nº 728. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3102546313',
      'clubdetenisgoldenslam@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-tenis-de-campo-golden--728',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-tenis-de-campo-golden--728', v_school_id, '{"resolucion_rd": "728", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "JUAN CARLOS GONZALEZ VESGA", "localidad": "Teusaquillo", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS GONZALEZ VESGA. Deporte(s): Tenis. Localidad: Teusaquillo. Resolución R-D Nº 728. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102546313', phone),
      email       = COALESCE('clubdetenisgoldenslam@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "728", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "JUAN CARLOS GONZALEZ VESGA", "localidad": "Teusaquillo", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-tenis-de-campo-golden--728';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3102546313', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CENTURIONES  (IDRD-CLUB-club-deportivo-centuriones-1128)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-centuriones-1128';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CENTURIONES',
      'Presidente: JOHN BAIRON MENA RAMOS. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1128. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3008932329',
      'centurionesbaloncesto@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-centuriones-1128',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-centuriones-1128', v_school_id, '{"resolucion_rd": "1128", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "JOHN BAIRON MENA RAMOS", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN BAIRON MENA RAMOS. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1128. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008932329', phone),
      email       = COALESCE('centurionesbaloncesto@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1128", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "JOHN BAIRON MENA RAMOS", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-centuriones-1128';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3008932329', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE TAEKWONDO COLOMBIA JMCS  (IDRD-CLUB-club-de-taekwondo-colombia-jmcs-738)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-taekwondo-colombia-jmcs-738';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE TAEKWONDO COLOMBIA JMCS',
      'Presidente: ALBA ROCIO MENDOZA VELANDIA. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 738. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3024877767',
      'juancasastkd@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-taekwondo-colombia-jmcs-738',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-taekwondo-colombia-jmcs-738', v_school_id, '{"resolucion_rd": "738", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "ALBA ROCIO MENDOZA VELANDIA", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALBA ROCIO MENDOZA VELANDIA. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 738. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3024877767', phone),
      email       = COALESCE('juancasastkd@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "738", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "ALBA ROCIO MENDOZA VELANDIA", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-taekwondo-colombia-jmcs-738';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3024877767', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE PATINAJE FUEGO DORADO  (IDRD-CLUB-club-de-patinaje-fuego-dorado-729)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-patinaje-fuego-dorado-729';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE PATINAJE FUEGO DORADO',
      'Presidente: KEVIN SEBASTIÃÂN SUAREZ REINA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 729. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3057220776',
      'clubfuegodorado@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-patinaje-fuego-dorado-729',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-patinaje-fuego-dorado-729', v_school_id, '{"resolucion_rd": "729", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "KEVIN SEBASTIÃÂN SUAREZ REINA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KEVIN SEBASTIÃÂN SUAREZ REINA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 729. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057220776', phone),
      email       = COALESCE('clubfuegodorado@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "729", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "KEVIN SEBASTIÃÂN SUAREZ REINA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-patinaje-fuego-dorado-729';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3057220776', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESCOFUTUPER  (IDRD-CLUB-club-deportivo-escofutuper-732)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-escofutuper-732';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESCOFUTUPER',
      'Presidente: TUCIDIDES PEREA RODRÃGUEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 732. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3112464108',
      'escueladefutbolescofutuper@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-escofutuper-732',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-escofutuper-732', v_school_id, '{"resolucion_rd": "732", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "TUCIDIDES PEREA RODRÃGUEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: TUCIDIDES PEREA RODRÃGUEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 732. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112464108', phone),
      email       = COALESCE('escueladefutbolescofutuper@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "732", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "TUCIDIDES PEREA RODRÃGUEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-escofutuper-732';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3112464108', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA MAX STEEL F.C.  (IDRD-CLUB-club-deportivo-academia-max-steel-fc-731)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-max-steel-fc-731';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA MAX STEEL F.C.',
      'Presidente: ANGELA LORENA PIÃEROS CASTAÃEDA. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 731. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '8147135',
      'maxsteelfutbol10@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-max-steel-fc-731',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-max-steel-fc-731', v_school_id, '{"resolucion_rd": "731", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "ANGELA LORENA PIÃEROS CASTAÃEDA", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELA LORENA PIÃEROS CASTAÃEDA. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 731. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('8147135', phone),
      email       = COALESCE('maxsteelfutbol10@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "731", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "ANGELA LORENA PIÃEROS CASTAÃEDA", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-max-steel-fc-731';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '8147135', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SKILLS BOGOTÃ  (IDRD-CLUB-club-deportivo-skills-bogota-730)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-skills-bogota-730';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SKILLS BOGOTÃ',
      'Presidente: MARLOM STUART RIVERA MARTÃNEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 730. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3178776591',
      'escueladepatinajeskills@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-skills-bogota-730',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-skills-bogota-730', v_school_id, '{"resolucion_rd": "730", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "MARLOM STUART RIVERA MARTÃNEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARLOM STUART RIVERA MARTÃNEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 730. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3178776591', phone),
      email       = COALESCE('escueladepatinajeskills@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "730", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "MARLOM STUART RIVERA MARTÃNEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-skills-bogota-730';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3178776591', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPEED MASTER  (IDRD-CLUB-club-deportivo-speed-master-727)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-speed-master-727';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPEED MASTER',
      'Presidente: LESLIE NATHALIA RICO ROJAS. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 727. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '302222107',
      'clubspeedmaster@outlook.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-speed-master-727',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-speed-master-727', v_school_id, '{"resolucion_rd": "727", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "LESLIE NATHALIA RICO ROJAS", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LESLIE NATHALIA RICO ROJAS. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 727. Vigente hasta 2029-06-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('302222107', phone),
      email       = COALESCE('clubspeedmaster@outlook.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "727", "resolucion_actualizacion": null, "fecha_inicio": "19-06-2024", "fecha_fin": "2029-06-19", "presidente": "LESLIE NATHALIA RICO ROJAS", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-speed-master-727';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '302222107', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLÃTICO MONUMENTAL  (IDRD-CLUB-club-deportivo-atlatico-monumental-750)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-monumental-750';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLÃTICO MONUMENTAL',
      'Presidente: SEBASTIÃN VILLAMIL BARÃN. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 750. Vigente hasta 2029-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3213456812',
      'c.d.atleticomonumental@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlatico-monumental-750',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlatico-monumental-750', v_school_id, '{"resolucion_rd": "750", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2024", "fecha_fin": "2029-06-21", "presidente": "SEBASTIÃN VILLAMIL BARÃN", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SEBASTIÃN VILLAMIL BARÃN. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 750. Vigente hasta 2029-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213456812', phone),
      email       = COALESCE('c.d.atleticomonumental@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "750", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2024", "fecha_fin": "2029-06-21", "presidente": "SEBASTIÃN VILLAMIL BARÃN", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-monumental-750';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3213456812', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MG SKATE  (IDRD-CLUB-club-deportivo-mg-skate-749)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-mg-skate-749';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MG SKATE',
      'Presidente: JOSÃ ANTONIO GUTIERREZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 749. Vigente hasta 2029-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3002155008',
      'mgskatebogota@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-mg-skate-749',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-mg-skate-749', v_school_id, '{"resolucion_rd": "749", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2024", "fecha_fin": "2029-06-21", "presidente": "JOSÃ ANTONIO GUTIERREZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ ANTONIO GUTIERREZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 749. Vigente hasta 2029-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002155008', phone),
      email       = COALESCE('mgskatebogota@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "749", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2024", "fecha_fin": "2029-06-21", "presidente": "JOSÃ ANTONIO GUTIERREZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-mg-skate-749';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3002155008', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JITA KYOEI  (IDRD-CLUB-club-deportivo-jita-kyoei-745)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jita-kyoei-745';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JITA KYOEI',
      'Presidente: JENNIFER ANDREA QUIROGA NIVIA. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 745. Vigente hasta 2029-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3044190982',
      'jitakioeijudoclub@gmail.com',
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jita-kyoei-745',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jita-kyoei-745', v_school_id, '{"resolucion_rd": "745", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2024", "fecha_fin": "2029-06-21", "presidente": "JENNIFER ANDREA QUIROGA NIVIA", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNIFER ANDREA QUIROGA NIVIA. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 745. Vigente hasta 2029-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3044190982', phone),
      email       = COALESCE('jitakioeijudoclub@gmail.com', email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "745", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2024", "fecha_fin": "2029-06-21", "presidente": "JENNIFER ANDREA QUIROGA NIVIA", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jita-kyoei-745';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3044190982', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JGB  (IDRD-CLUB-club-deportivo-jgb-796)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jgb-796';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JGB',
      'Presidente: JOHANNA MARCELA BONILLA TORO. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 796. Vigente hasta 2029-07-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3192025950',
      'corporacionjgb@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jgb-796',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jgb-796', v_school_id, '{"resolucion_rd": "796", "resolucion_actualizacion": null, "fecha_inicio": "18-07-2024", "fecha_fin": "2029-07-18", "presidente": "JOHANNA MARCELA BONILLA TORO", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANNA MARCELA BONILLA TORO. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 796. Vigente hasta 2029-07-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3192025950', phone),
      email       = COALESCE('corporacionjgb@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "796", "resolucion_actualizacion": null, "fecha_inicio": "18-07-2024", "fecha_fin": "2029-07-18", "presidente": "JOHANNA MARCELA BONILLA TORO", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jgb-796';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3192025950', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SOCRATES F.P.  (IDRD-CLUB-club-deportivo-socrates-fp-795)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-socrates-fp-795';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SOCRATES F.P.',
      'Presidente: WILLINGTON MORENO ARENAS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 795. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3113369394',
      'mcortes.navas@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-socrates-fp-795',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-socrates-fp-795', v_school_id, '{"resolucion_rd": "795", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "WILLINGTON MORENO ARENAS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLINGTON MORENO ARENAS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 795. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3113369394', phone),
      email       = COALESCE('mcortes.navas@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "795", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "WILLINGTON MORENO ARENAS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-socrates-fp-795';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3113369394', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO OS FUTSAL  (IDRD-CLUB-club-deportivo-os-futsal-794)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-os-futsal-794';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO OS FUTSAL',
      'Presidente: YESID FERNANDO RODRÃGUEZ HERNÃNDEZ. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 794. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3193150468',
      'clubdeportivoosfutsal@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-os-futsal-794',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-os-futsal-794', v_school_id, '{"resolucion_rd": "794", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "YESID FERNANDO RODRÃGUEZ HERNÃNDEZ", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YESID FERNANDO RODRÃGUEZ HERNÃNDEZ. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 794. Vigente hasta 2029-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193150468', phone),
      email       = COALESCE('clubdeportivoosfutsal@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "794", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2024", "fecha_fin": "2029-06-28", "presidente": "YESID FERNANDO RODRÃGUEZ HERNÃNDEZ", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-os-futsal-794';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3193150468', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATHLETIC DE MILAN  (IDRD-CLUB-club-deportivo-athletic-de-milan-209)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-athletic-de-milan-209';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATHLETIC DE MILAN',
      'Presidente: DILAN LEONARDO SANABRIA DIAZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 209. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3177422799',
      'dilanfutboldl77777@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-athletic-de-milan-209',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-athletic-de-milan-209', v_school_id, '{"resolucion_rd": "209", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "DILAN LEONARDO SANABRIA DIAZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DILAN LEONARDO SANABRIA DIAZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 209. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3177422799', phone),
      email       = COALESCE('dilanfutboldl77777@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "209", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "DILAN LEONARDO SANABRIA DIAZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-athletic-de-milan-209';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3177422799', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO EL TIGRE  (IDRD-CLUB-club-deportivo-de-taekwondo-el-tigre-788)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-el-tigre-788';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO EL TIGRE',
      'Presidente: WALTER MERCHAN GONZALEZ. Deporte(s): Taekwondo. Localidad: Antonio Nariño. Resolución R-D Nº 788. Vigente hasta 2029-07-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3177492399',
      'amayuet@yahoo.es',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-el-tigre-788',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-el-tigre-788', v_school_id, '{"resolucion_rd": "788", "resolucion_actualizacion": null, "fecha_inicio": "02-07-2024", "fecha_fin": "2029-07-02", "presidente": "WALTER MERCHAN GONZALEZ", "localidad": "Antonio Nariño", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WALTER MERCHAN GONZALEZ. Deporte(s): Taekwondo. Localidad: Antonio Nariño. Resolución R-D Nº 788. Vigente hasta 2029-07-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3177492399', phone),
      email       = COALESCE('amayuet@yahoo.es', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "788", "resolucion_actualizacion": null, "fecha_inicio": "02-07-2024", "fecha_fin": "2029-07-02", "presidente": "WALTER MERCHAN GONZALEZ", "localidad": "Antonio Nariño", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-el-tigre-788';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3177492399', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CHERMAR  (IDRD-CLUB-club-deportivo-chermar-790)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-chermar-790';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CHERMAR',
      'Presidente: JUAN GABRIEL MARTIN AUNTA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 790. Vigente hasta 2029-07-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3007402837',
      'clubdeportivo.chermar12@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-chermar-790',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-chermar-790', v_school_id, '{"resolucion_rd": "790", "resolucion_actualizacion": null, "fecha_inicio": "02-07-2024", "fecha_fin": "2029-07-02", "presidente": "JUAN GABRIEL MARTIN AUNTA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN GABRIEL MARTIN AUNTA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 790. Vigente hasta 2029-07-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007402837', phone),
      email       = COALESCE('clubdeportivo.chermar12@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "790", "resolucion_actualizacion": null, "fecha_inicio": "02-07-2024", "fecha_fin": "2029-07-02", "presidente": "JUAN GABRIEL MARTIN AUNTA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-chermar-790';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3007402837', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO INDEPENDIENTE S.A.J - CIDF COLOMBIA  (IDRD-CLUB-club-deportivo-independiente-saj---cidf--791)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-independiente-saj---cidf--791';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO INDEPENDIENTE S.A.J - CIDF COLOMBIA',
      'Presidente: JOAN SEBASTIAN ALDANA JIMENEZ. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 791. Vigente hasta 2029-07-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3124971348',
      'cidfcolombia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-independiente-saj---cidf--791',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-independiente-saj---cidf--791', v_school_id, '{"resolucion_rd": "791", "resolucion_actualizacion": null, "fecha_inicio": "02-07-2024", "fecha_fin": "2029-07-02", "presidente": "JOAN SEBASTIAN ALDANA JIMENEZ", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOAN SEBASTIAN ALDANA JIMENEZ. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 791. Vigente hasta 2029-07-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124971348', phone),
      email       = COALESCE('cidfcolombia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "791", "resolucion_actualizacion": null, "fecha_inicio": "02-07-2024", "fecha_fin": "2029-07-02", "presidente": "JOAN SEBASTIAN ALDANA JIMENEZ", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-independiente-saj---cidf--791';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3124971348', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VIDA SPORT  (IDRD-CLUB-club-deportivo-vida-sport-850)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-vida-sport-850';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VIDA SPORT',
      'Presidente: LOREN MILENA AREVALO GULUMA. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 850. Vigente hasta 2029-06-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3112839315',
      'vydaep@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-vida-sport-850',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-vida-sport-850', v_school_id, '{"resolucion_rd": "850", "resolucion_actualizacion": null, "fecha_inicio": "24-06-2024", "fecha_fin": "2029-06-24", "presidente": "LOREN MILENA AREVALO GULUMA", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LOREN MILENA AREVALO GULUMA. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 850. Vigente hasta 2029-06-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112839315', phone),
      email       = COALESCE('vydaep@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "850", "resolucion_actualizacion": null, "fecha_inicio": "24-06-2024", "fecha_fin": "2029-06-24", "presidente": "LOREN MILENA AREVALO GULUMA", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-vida-sport-850';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3112839315', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE TENIS DE CAMPO EL DIABLO  (IDRD-CLUB-club-de-tenis-de-campo-el-diablo-808)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-tenis-de-campo-el-diablo-808';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE TENIS DE CAMPO EL DIABLO',
      'Presidente: YARENIS ANDREA OJEDA GONZALEZ. Deporte(s): Tenis. Localidad: Tunjuelito. Resolución R-D Nº 808. Vigente hasta 2029-06-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '2488663',
      'clubdeteniseldiablo@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-tenis-de-campo-el-diablo-808',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-tenis-de-campo-el-diablo-808', v_school_id, '{"resolucion_rd": "808", "resolucion_actualizacion": null, "fecha_inicio": "24-06-2024", "fecha_fin": "2029-06-24", "presidente": "YARENIS ANDREA OJEDA GONZALEZ", "localidad": "Tunjuelito", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YARENIS ANDREA OJEDA GONZALEZ. Deporte(s): Tenis. Localidad: Tunjuelito. Resolución R-D Nº 808. Vigente hasta 2029-06-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2488663', phone),
      email       = COALESCE('clubdeteniseldiablo@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "808", "resolucion_actualizacion": null, "fecha_inicio": "24-06-2024", "fecha_fin": "2029-06-24", "presidente": "YARENIS ANDREA OJEDA GONZALEZ", "localidad": "Tunjuelito", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-tenis-de-campo-el-diablo-808';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '2488663', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTA UNITED FC  (IDRD-CLUB-club-deportivo-bogota-united-fc-504)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-united-fc-504';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTA UNITED FC',
      'Presidente: JUAN DAVID JÃMENEZ PORRAS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 504. Vigente hasta 2029-04-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3115636279',
      'bufc.secretariageneral@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogota-united-fc-504',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogota-united-fc-504', v_school_id, '{"resolucion_rd": "504", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2024", "fecha_fin": "2029-04-24", "presidente": "JUAN DAVID JÃMENEZ PORRAS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN DAVID JÃMENEZ PORRAS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 504. Vigente hasta 2029-04-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115636279', phone),
      email       = COALESCE('bufc.secretariageneral@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "504", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2024", "fecha_fin": "2029-04-24", "presidente": "JUAN DAVID JÃMENEZ PORRAS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-united-fc-504';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3115636279', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AJAX AIMARA  (IDRD-CLUB-club-deportivo-ajax-aimara-797)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ajax-aimara-797';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AJAX AIMARA',
      'Presidente: ORMINSON DAVID BUSTOS OCAMPO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 797. Vigente hasta 2029-07-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3017978748',
      'ajaxaimara@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ajax-aimara-797',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ajax-aimara-797', v_school_id, '{"resolucion_rd": "797", "resolucion_actualizacion": null, "fecha_inicio": "09-07-2024", "fecha_fin": "2029-07-09", "presidente": "ORMINSON DAVID BUSTOS OCAMPO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ORMINSON DAVID BUSTOS OCAMPO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 797. Vigente hasta 2029-07-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017978748', phone),
      email       = COALESCE('ajaxaimara@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "797", "resolucion_actualizacion": null, "fecha_inicio": "09-07-2024", "fecha_fin": "2029-07-09", "presidente": "ORMINSON DAVID BUSTOS OCAMPO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ajax-aimara-797';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3017978748', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ON WHEELS  (IDRD-CLUB-club-deportivo-on-wheels-860)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-on-wheels-860';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ON WHEELS',
      'Presidente: STEFANY ACOSTA RODRÃGUEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 860. Vigente hasta 2029-07-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3133158022',
      'speedonwheels1518@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-on-wheels-860',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-on-wheels-860', v_school_id, '{"resolucion_rd": "860", "resolucion_actualizacion": null, "fecha_inicio": "09-07-2024", "fecha_fin": "2029-07-09", "presidente": "STEFANY ACOSTA RODRÃGUEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: STEFANY ACOSTA RODRÃGUEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 860. Vigente hasta 2029-07-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133158022', phone),
      email       = COALESCE('speedonwheels1518@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "860", "resolucion_actualizacion": null, "fecha_inicio": "09-07-2024", "fecha_fin": "2029-07-09", "presidente": "STEFANY ACOSTA RODRÃGUEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-on-wheels-860';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3133158022', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PANTERAS CAPITALINAS  (IDRD-CLUB-club-deportivo-panteras-capitalinas-891)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-panteras-capitalinas-891';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PANTERAS CAPITALINAS',
      'Presidente: HEINER ADALBERTO NOVA OCHOA. Deporte(s): Fútbol, Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 891. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3017364728',
      'clubpanterascapitalinas@gmail.com',
      ARRAY['Fútbol','Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-panteras-capitalinas-891',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-panteras-capitalinas-891', v_school_id, '{"resolucion_rd": "891", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "HEINER ADALBERTO NOVA OCHOA", "localidad": "Bosa", "sports": ["Fútbol", "Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HEINER ADALBERTO NOVA OCHOA. Deporte(s): Fútbol, Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 891. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017364728', phone),
      email       = COALESCE('clubpanterascapitalinas@gmail.com', email),
      sports      = ARRAY['Fútbol','Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "891", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "HEINER ADALBERTO NOVA OCHOA", "localidad": "Bosa", "sports": ["Fútbol", "Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-panteras-capitalinas-891';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3017364728', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GANDIVA ARCHERY CLUB  (IDRD-CLUB-club-deportivo-gandiva-archery-club-877)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-gandiva-archery-club-877';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GANDIVA ARCHERY CLUB',
      'Presidente: INGRY CAROLINA ZAMBRANO DOMINGUEZ. Localidad: Barrios Unidos. Resolución R-D Nº 877. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3107151570',
      'gandivaarcheryclub@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-gandiva-archery-club-877',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-gandiva-archery-club-877', v_school_id, '{"resolucion_rd": "877", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "INGRY CAROLINA ZAMBRANO DOMINGUEZ", "localidad": "Barrios Unidos", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: INGRY CAROLINA ZAMBRANO DOMINGUEZ. Localidad: Barrios Unidos. Resolución R-D Nº 877. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107151570', phone),
      email       = COALESCE('gandivaarcheryclub@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "877", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "INGRY CAROLINA ZAMBRANO DOMINGUEZ", "localidad": "Barrios Unidos", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-gandiva-archery-club-877';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3107151570', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SANAR ACADEMIA FC  (IDRD-CLUB-club-deportivo-sanar-academia-fc-876)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sanar-academia-fc-876';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SANAR ACADEMIA FC',
      'Presidente: WILMAR RODRIGO GONZALEZ GALINDO. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 876. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3204893813',
      'clubdeportivosanaracademiafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sanar-academia-fc-876',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sanar-academia-fc-876', v_school_id, '{"resolucion_rd": "876", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "WILMAR RODRIGO GONZALEZ GALINDO", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILMAR RODRIGO GONZALEZ GALINDO. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 876. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204893813', phone),
      email       = COALESCE('clubdeportivosanaracademiafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "876", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "WILMAR RODRIGO GONZALEZ GALINDO", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sanar-academia-fc-876';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3204893813', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MELAOS F.C.  (IDRD-CLUB-club-deportivo-melaos-fc-874)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-melaos-fc-874';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MELAOS F.C.',
      'Presidente: JERSON HARVEY VEGA NUÃEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 874. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3163819234',
      'jherson_vega@hotmail.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-melaos-fc-874',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-melaos-fc-874', v_school_id, '{"resolucion_rd": "874", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "JERSON HARVEY VEGA NUÃEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JERSON HARVEY VEGA NUÃEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 874. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3163819234', phone),
      email       = COALESCE('jherson_vega@hotmail.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "874", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "JERSON HARVEY VEGA NUÃEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-melaos-fc-874';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3163819234', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATHLETIC BOGOTÃ F.C.  (IDRD-CLUB-club-deportivo-athletic-bogota-fc-851)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-athletic-bogota-fc-851';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATHLETIC BOGOTÃ F.C.',
      'Presidente: ANDRÃS FERNANDO PARADA BUITRAGO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 851. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3187719952',
      'athleticbogotafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-athletic-bogota-fc-851',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-athletic-bogota-fc-851', v_school_id, '{"resolucion_rd": "851", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "ANDRÃS FERNANDO PARADA BUITRAGO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRÃS FERNANDO PARADA BUITRAGO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 851. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187719952', phone),
      email       = COALESCE('athleticbogotafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "851", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "ANDRÃS FERNANDO PARADA BUITRAGO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-athletic-bogota-fc-851';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3187719952', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KOPULSO  (IDRD-CLUB-club-deportivo-kopulso-894)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kopulso-894';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KOPULSO',
      'Presidente: JHON JAIRO AVILA SIERRA. Deporte(s): Taekwondo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 894. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3132694132',
      'kopulsotaekwondoclub@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kopulso-894',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kopulso-894', v_school_id, '{"resolucion_rd": "894", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "JHON JAIRO AVILA SIERRA", "localidad": "Rafael Uribe Uribe", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON JAIRO AVILA SIERRA. Deporte(s): Taekwondo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 894. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132694132', phone),
      email       = COALESCE('kopulsotaekwondoclub@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "894", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "JHON JAIRO AVILA SIERRA", "localidad": "Rafael Uribe Uribe", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kopulso-894';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3132694132', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO SUNG DO  (IDRD-CLUB-club-deportivo-taekwondo-sung-do-895)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-sung-do-895';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO SUNG DO',
      'Presidente: CARLOS EDUARDO VANEGAS BRIÃEZ. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 895. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3057471184',
      'clubdeportivosungdo@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-sung-do-895',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-sung-do-895', v_school_id, '{"resolucion_rd": "895", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "CARLOS EDUARDO VANEGAS BRIÃEZ", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS EDUARDO VANEGAS BRIÃEZ. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 895. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057471184', phone),
      email       = COALESCE('clubdeportivosungdo@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "895", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "CARLOS EDUARDO VANEGAS BRIÃEZ", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-sung-do-895';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3057471184', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FEDINTER  (IDRD-CLUB-club-deportivo-fedinter-896)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fedinter-896';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FEDINTER',
      'Presidente: LUIS ALBERTO VARGAS ROMERO. Deporte(s): Taekwondo. Localidad: Usme. Resolución R-D Nº 896. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3115659434',
      'luchoafedinter@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fedinter-896',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fedinter-896', v_school_id, '{"resolucion_rd": "896", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "LUIS ALBERTO VARGAS ROMERO", "localidad": "Usme", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALBERTO VARGAS ROMERO. Deporte(s): Taekwondo. Localidad: Usme. Resolución R-D Nº 896. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115659434', phone),
      email       = COALESCE('luchoafedinter@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "896", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "LUIS ALBERTO VARGAS ROMERO", "localidad": "Usme", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fedinter-896';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3115659434', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FAMILIA F.C.  (IDRD-CLUB-club-deportivo-familia-fc-897)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-familia-fc-897';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FAMILIA F.C.',
      'Presidente: LORSY PATRICIA CORTES VALENCIA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 897. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3202385532',
      'familiafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-familia-fc-897',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-familia-fc-897', v_school_id, '{"resolucion_rd": "897", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "LORSY PATRICIA CORTES VALENCIA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LORSY PATRICIA CORTES VALENCIA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 897. Vigente hasta 2029-07-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202385532', phone),
      email       = COALESCE('familiafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "897", "resolucion_actualizacion": null, "fecha_inicio": "11-07-2024", "fecha_fin": "2029-07-11", "presidente": "LORSY PATRICIA CORTES VALENCIA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-familia-fc-897';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3202385532', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SHELTER â SHELTER F.C.  (IDRD-CLUB-club-deportivo-shelter-a-shelter-fc-957)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-shelter-a-shelter-fc-957';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SHELTER â SHELTER F.C.',
      'Presidente: JOHANN SEBASTIAN PARDO BARRETO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 957. Vigente hasta 2029-07-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3132678378',
      'livingadreamfoundation@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-shelter-a-shelter-fc-957',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-shelter-a-shelter-fc-957', v_school_id, '{"resolucion_rd": "957", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2024", "fecha_fin": "2029-07-22", "presidente": "JOHANN SEBASTIAN PARDO BARRETO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANN SEBASTIAN PARDO BARRETO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 957. Vigente hasta 2029-07-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132678378', phone),
      email       = COALESCE('livingadreamfoundation@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "957", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2024", "fecha_fin": "2029-07-22", "presidente": "JOHANN SEBASTIAN PARDO BARRETO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-shelter-a-shelter-fc-957';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3132678378', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ASSONYER  (IDRD-CLUB-club-deportivo-assonyer-960)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-assonyer-960';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ASSONYER',
      'Presidente: ANDREA YUBEY MENDEZ GARZON. Deporte(s): Natación. Localidad: Ciudad Bolívar. Resolución R-D Nº 960. Vigente hasta 2029-07-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3107927500',
      'reydaniel-84@hotmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-assonyer-960',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-assonyer-960', v_school_id, '{"resolucion_rd": "960", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2024", "fecha_fin": "2029-07-22", "presidente": "ANDREA YUBEY MENDEZ GARZON", "localidad": "Ciudad Bolívar", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDREA YUBEY MENDEZ GARZON. Deporte(s): Natación. Localidad: Ciudad Bolívar. Resolución R-D Nº 960. Vigente hasta 2029-07-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107927500', phone),
      email       = COALESCE('reydaniel-84@hotmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "960", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2024", "fecha_fin": "2029-07-22", "presidente": "ANDREA YUBEY MENDEZ GARZON", "localidad": "Ciudad Bolívar", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-assonyer-960';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3107927500', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FOOTBALL CLUB PRAINCE  (IDRD-CLUB-club-deportivo-football-club-praince-985)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-football-club-praince-985';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FOOTBALL CLUB PRAINCE',
      'Presidente: JULIÃN DAVID SERRATO PERDOMO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 985. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3843395',
      'football.club.praince@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-football-club-praince-985',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-football-club-praince-985', v_school_id, '{"resolucion_rd": "985", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "JULIÃN DAVID SERRATO PERDOMO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIÃN DAVID SERRATO PERDOMO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 985. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3843395', phone),
      email       = COALESCE('football.club.praince@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "985", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "JULIÃN DAVID SERRATO PERDOMO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-football-club-praince-985';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3843395', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BLUMONTE FUTBOL CLUB  (IDRD-CLUB-club-deportivo-blumonte-futbol-club-354)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-blumonte-futbol-club-354';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BLUMONTE FUTBOL CLUB',
      'Presidente: JULIAN ENRIQUE BETANCOURT ORTIZ. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 354 / actualización Nº 1963. Vigente hasta 2028-04-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3158639124',
      'blumontefc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-blumonte-futbol-club-354',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-blumonte-futbol-club-354', v_school_id, '{"resolucion_rd": "354", "resolucion_actualizacion": "1963", "fecha_inicio": "28-04-2023", "fecha_fin": "2028-04-27", "presidente": "JULIAN ENRIQUE BETANCOURT ORTIZ", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIAN ENRIQUE BETANCOURT ORTIZ. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 354 / actualización Nº 1963. Vigente hasta 2028-04-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158639124', phone),
      email       = COALESCE('blumontefc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "354", "resolucion_actualizacion": "1963", "fecha_inicio": "28-04-2023", "fecha_fin": "2028-04-27", "presidente": "JULIAN ENRIQUE BETANCOURT ORTIZ", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-blumonte-futbol-club-354';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3158639124', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SOLEIL ET LUNE  (IDRD-CLUB-club-deportivo-soleil-et-lune-977)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-soleil-et-lune-977';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SOLEIL ET LUNE',
      'Presidente: LINA PAOLA BERNAL LOAIZA. Deporte(s): Patinaje. Localidad: Antonio Nariño. Resolución R-D Nº 977. Vigente hasta 2029-07-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3106898274',
      'clyesc.sylpatinartistico@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-soleil-et-lune-977',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-soleil-et-lune-977', v_school_id, '{"resolucion_rd": "977", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2024", "fecha_fin": "2029-07-24", "presidente": "LINA PAOLA BERNAL LOAIZA", "localidad": "Antonio Nariño", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LINA PAOLA BERNAL LOAIZA. Deporte(s): Patinaje. Localidad: Antonio Nariño. Resolución R-D Nº 977. Vigente hasta 2029-07-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106898274', phone),
      email       = COALESCE('clyesc.sylpatinartistico@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "977", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2024", "fecha_fin": "2029-07-24", "presidente": "LINA PAOLA BERNAL LOAIZA", "localidad": "Antonio Nariño", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-soleil-et-lune-977';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3106898274', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TIGRES DE BACATÃ  (IDRD-CLUB-club-deportivo-tigres-de-bacata-975)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tigres-de-bacata-975';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TIGRES DE BACATÃ',
      'Presidente: GISELLE ZORANGE AMARILLO GÃMEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 975. Vigente hasta 2029-07-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3125700503',
      'tigresdebacatafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tigres-de-bacata-975',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tigres-de-bacata-975', v_school_id, '{"resolucion_rd": "975", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2024", "fecha_fin": "2029-07-24", "presidente": "GISELLE ZORANGE AMARILLO GÃMEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GISELLE ZORANGE AMARILLO GÃMEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 975. Vigente hasta 2029-07-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125700503', phone),
      email       = COALESCE('tigresdebacatafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "975", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2024", "fecha_fin": "2029-07-24", "presidente": "GISELLE ZORANGE AMARILLO GÃMEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tigres-de-bacata-975';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3125700503', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DRAKKAR  (IDRD-CLUB-club-deportivo-drakkar-996)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-drakkar-996';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DRAKKAR',
      'Presidente: ROBERT DAVID REYES VARGAS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 996. Vigente hasta 2029-07-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3183065086',
      'clubdeportivodrakkarum@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-drakkar-996',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-drakkar-996', v_school_id, '{"resolucion_rd": "996", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2024", "fecha_fin": "2029-07-29", "presidente": "ROBERT DAVID REYES VARGAS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROBERT DAVID REYES VARGAS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 996. Vigente hasta 2029-07-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183065086', phone),
      email       = COALESCE('clubdeportivodrakkarum@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "996", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2024", "fecha_fin": "2029-07-29", "presidente": "ROBERT DAVID REYES VARGAS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-drakkar-996';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3183065086', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LYNX ULTIMATE CLUB  (IDRD-CLUB-club-deportivo-lynx-ultimate-club-999)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lynx-ultimate-club-999';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LYNX ULTIMATE CLUB',
      'Presidente: WILLIAM ANDRÃS SILVA SUÃREZ. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 999. Vigente hasta 2029-07-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3048240260',
      'lynxmirandela@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lynx-ultimate-club-999',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lynx-ultimate-club-999', v_school_id, '{"resolucion_rd": "999", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2024", "fecha_fin": "2029-07-29", "presidente": "WILLIAM ANDRÃS SILVA SUÃREZ", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM ANDRÃS SILVA SUÃREZ. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 999. Vigente hasta 2029-07-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3048240260', phone),
      email       = COALESCE('lynxmirandela@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "999", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2024", "fecha_fin": "2029-07-29", "presidente": "WILLIAM ANDRÃS SILVA SUÃREZ", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lynx-ultimate-club-999';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3048240260', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO IMPERIUM  (IDRD-CLUB-club-deportivo-imperium-1003)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-imperium-1003';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO IMPERIUM',
      'Presidente: MARÃA CRISTINA TORRES OJEDA. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 1003. Vigente hasta 2029-07-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3232333778',
      'clubimperiumbaloncesto@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-imperium-1003',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-imperium-1003', v_school_id, '{"resolucion_rd": "1003", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2024", "fecha_fin": "2029-07-29", "presidente": "MARÃA CRISTINA TORRES OJEDA", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃA CRISTINA TORRES OJEDA. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 1003. Vigente hasta 2029-07-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3232333778', phone),
      email       = COALESCE('clubimperiumbaloncesto@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1003", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2024", "fecha_fin": "2029-07-29", "presidente": "MARÃA CRISTINA TORRES OJEDA", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-imperium-1003';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3232333778', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PRESEAS FC  (IDRD-CLUB-club-deportivo-preseas-fc-024)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-preseas-fc-024';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PRESEAS FC',
      'Presidente: WILLIAM GUILLERMO CAMARGO CHAPARRO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 024. Vigente hasta 2029-01-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3142911692',
      'preseasfutbol@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-preseas-fc-024',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-preseas-fc-024', v_school_id, '{"resolucion_rd": "024", "resolucion_actualizacion": null, "fecha_inicio": "26-01-2024", "fecha_fin": "2029-01-25", "presidente": "WILLIAM GUILLERMO CAMARGO CHAPARRO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM GUILLERMO CAMARGO CHAPARRO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 024. Vigente hasta 2029-01-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142911692', phone),
      email       = COALESCE('preseasfutbol@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "024", "resolucion_actualizacion": null, "fecha_inicio": "26-01-2024", "fecha_fin": "2029-01-25", "presidente": "WILLIAM GUILLERMO CAMARGO CHAPARRO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-preseas-fc-024';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3142911692', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BISON BASKET CLUB BOGOTA  (IDRD-CLUB-club-deportivo-bison-basket-club-bogota-1012)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bison-basket-club-bogota-1012';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BISON BASKET CLUB BOGOTA',
      'Presidente: EDITH JOHANA BARRAGÃN ALFONSO. Deporte(s): Baloncesto. Localidad: Usaquén. Resolución R-D Nº 1012. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3044701740',
      'bisonbasketballbogota@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bison-basket-club-bogota-1012',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bison-basket-club-bogota-1012', v_school_id, '{"resolucion_rd": "1012", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "EDITH JOHANA BARRAGÃN ALFONSO", "localidad": "Usaquén", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDITH JOHANA BARRAGÃN ALFONSO. Deporte(s): Baloncesto. Localidad: Usaquén. Resolución R-D Nº 1012. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3044701740', phone),
      email       = COALESCE('bisonbasketballbogota@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1012", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "EDITH JOHANA BARRAGÃN ALFONSO", "localidad": "Usaquén", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bison-basket-club-bogota-1012';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3044701740', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ROLOS POWERLIFTING D.C.  (IDRD-CLUB-club-deportivo-rolos-powerlifting-dc-1013)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-rolos-powerlifting-dc-1013';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ROLOS POWERLIFTING D.C.',
      'Presidente: CAMILA ANDREA AGUDELO LINARES. Deporte(s): Powerlifting. Localidad: Tunjuelito. Resolución R-D Nº 1013. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3174326231',
      'rolospowerliftingdc@gmail.com',
      ARRAY['Powerlifting']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-rolos-powerlifting-dc-1013',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-rolos-powerlifting-dc-1013', v_school_id, '{"resolucion_rd": "1013", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "CAMILA ANDREA AGUDELO LINARES", "localidad": "Tunjuelito", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILA ANDREA AGUDELO LINARES. Deporte(s): Powerlifting. Localidad: Tunjuelito. Resolución R-D Nº 1013. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174326231', phone),
      email       = COALESCE('rolospowerliftingdc@gmail.com', email),
      sports      = ARRAY['Powerlifting']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1013", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "CAMILA ANDREA AGUDELO LINARES", "localidad": "Tunjuelito", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-rolos-powerlifting-dc-1013';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3174326231', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ANGELS GYMNASTICS  (IDRD-CLUB-club-deportivo-angels-gymnastics-1015)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-angels-gymnastics-1015';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ANGELS GYMNASTICS',
      'Presidente: PEDRO ALEJANDRO LÃPEZ CORREDOR. Deporte(s): Gimnasia. Localidad: Engativá. Resolución R-D Nº 1015. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3106071974',
      'clubdarkangels01@gmail.com',
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-angels-gymnastics-1015',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-angels-gymnastics-1015', v_school_id, '{"resolucion_rd": "1015", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "PEDRO ALEJANDRO LÃPEZ CORREDOR", "localidad": "Engativá", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO ALEJANDRO LÃPEZ CORREDOR. Deporte(s): Gimnasia. Localidad: Engativá. Resolución R-D Nº 1015. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106071974', phone),
      email       = COALESCE('clubdarkangels01@gmail.com', email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1015", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "PEDRO ALEJANDRO LÃPEZ CORREDOR", "localidad": "Engativá", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-angels-gymnastics-1015';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3106071974', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CUERVOS FÃTBOL CLUB  (IDRD-CLUB-club-deportivo-cuervos-fatbol-club-1010)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cuervos-fatbol-club-1010';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CUERVOS FÃTBOL CLUB',
      'Presidente: JENNIFFER ADRIANA PÃEZ MURCIA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1010. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3170824953',
      'cuervosfutbolclub2018@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cuervos-fatbol-club-1010',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cuervos-fatbol-club-1010', v_school_id, '{"resolucion_rd": "1010", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "JENNIFFER ADRIANA PÃEZ MURCIA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNIFFER ADRIANA PÃEZ MURCIA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1010. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3170824953', phone),
      email       = COALESCE('cuervosfutbolclub2018@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1010", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "JENNIFFER ADRIANA PÃEZ MURCIA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cuervos-fatbol-club-1010';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3170824953', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE BALONCESTO CABAL  (IDRD-CLUB-club-deportivo-de-baloncesto-cabal-1016)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-cabal-1016';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE BALONCESTO CABAL',
      'Presidente: DIANA ÃNGELICA QUINTERO CAPERA. Deporte(s): Baloncesto. Localidad: Antonio Nariño. Resolución R-D Nº 1016. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3105506800',
      'escuelacabal@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-baloncesto-cabal-1016',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-baloncesto-cabal-1016', v_school_id, '{"resolucion_rd": "1016", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "DIANA ÃNGELICA QUINTERO CAPERA", "localidad": "Antonio Nariño", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA ÃNGELICA QUINTERO CAPERA. Deporte(s): Baloncesto. Localidad: Antonio Nariño. Resolución R-D Nº 1016. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105506800', phone),
      email       = COALESCE('escuelacabal@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1016", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "DIANA ÃNGELICA QUINTERO CAPERA", "localidad": "Antonio Nariño", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-cabal-1016';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3105506800', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GATOX  (IDRD-CLUB-club-deportivo-gatox-1042)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-gatox-1042';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GATOX',
      'Presidente: PAOLA ANDREA OSORIO ROZO. Deporte(s): Baloncesto. Localidad: Usaquén. Resolución R-D Nº 1042. Vigente hasta 2029-08-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3103012359',
      'clubgatox@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-gatox-1042',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-gatox-1042', v_school_id, '{"resolucion_rd": "1042", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2024", "fecha_fin": "2029-08-05", "presidente": "PAOLA ANDREA OSORIO ROZO", "localidad": "Usaquén", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAOLA ANDREA OSORIO ROZO. Deporte(s): Baloncesto. Localidad: Usaquén. Resolución R-D Nº 1042. Vigente hasta 2029-08-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103012359', phone),
      email       = COALESCE('clubgatox@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1042", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2024", "fecha_fin": "2029-08-05", "presidente": "PAOLA ANDREA OSORIO ROZO", "localidad": "Usaquén", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-gatox-1042';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3103012359', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REDENTORES Ãâ°LITE BOGOTÃÂ  (IDRD-CLUB-club-deportivo-redentores-aalite-bogotaa-1041)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-redentores-aalite-bogotaa-1041';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REDENTORES Ãâ°LITE BOGOTÃÂ',
      'Presidente: MIGUEL ÃÂNGEL ROMERO IBÃÂÃâEZ. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1041. Vigente hasta 2029-08-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3114830298',
      'redentoreselite@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-redentores-aalite-bogotaa-1041',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-redentores-aalite-bogotaa-1041', v_school_id, '{"resolucion_rd": "1041", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2024", "fecha_fin": "2029-08-05", "presidente": "MIGUEL ÃÂNGEL ROMERO IBÃÂÃâEZ", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ÃÂNGEL ROMERO IBÃÂÃâEZ. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1041. Vigente hasta 2029-08-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114830298', phone),
      email       = COALESCE('redentoreselite@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1041", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2024", "fecha_fin": "2029-08-05", "presidente": "MIGUEL ÃÂNGEL ROMERO IBÃÂÃâEZ", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-redentores-aalite-bogotaa-1041';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3114830298', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TENISLAND  (IDRD-CLUB-club-deportivo-tenisland-629)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tenisland-629';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TENISLAND',
      'Presidente: CRISANTO TORO ROJAS. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 629. Vigente hasta 2029-08-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3115065742',
      'tenislandclubdeportivo@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tenisland-629',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tenisland-629', v_school_id, '{"resolucion_rd": "629", "resolucion_actualizacion": null, "fecha_inicio": "06-08-2024", "fecha_fin": "2029-08-06", "presidente": "CRISANTO TORO ROJAS", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISANTO TORO ROJAS. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 629. Vigente hasta 2029-08-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115065742', phone),
      email       = COALESCE('tenislandclubdeportivo@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "629", "resolucion_actualizacion": null, "fecha_inicio": "06-08-2024", "fecha_fin": "2029-08-06", "presidente": "CRISANTO TORO ROJAS", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tenisland-629';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3115065742', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO GAMAN - DO  (IDRD-CLUB-club-deportivo-de-taekwondo-gaman---do-1066)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-gaman---do-1066';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO GAMAN - DO',
      'Presidente: SANTIAGO ALBERTO BUITRAGO GAMEZ. Deporte(s): Taekwondo. Localidad: Bosa. Resolución R-D Nº 1066. Vigente hasta 2029-08-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3134848269',
      'clubdetaekwondogaman.do@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-gaman---do-1066',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-gaman---do-1066', v_school_id, '{"resolucion_rd": "1066", "resolucion_actualizacion": null, "fecha_inicio": "06-08-2024", "fecha_fin": "2029-08-06", "presidente": "SANTIAGO ALBERTO BUITRAGO GAMEZ", "localidad": "Bosa", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO ALBERTO BUITRAGO GAMEZ. Deporte(s): Taekwondo. Localidad: Bosa. Resolución R-D Nº 1066. Vigente hasta 2029-08-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134848269', phone),
      email       = COALESCE('clubdetaekwondogaman.do@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1066", "resolucion_actualizacion": null, "fecha_inicio": "06-08-2024", "fecha_fin": "2029-08-06", "presidente": "SANTIAGO ALBERTO BUITRAGO GAMEZ", "localidad": "Bosa", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-gaman---do-1066';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3134848269', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FSL RACING  (IDRD-CLUB-club-deportivo-fsl-racing-662)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fsl-racing-662';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FSL RACING',
      'Presidente: CARLOS ARTURO ARRIETA DÃAZ. Deporte(s): Automovilismo. Localidad: Usaquén. Resolución R-D Nº 662. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3206079558',
      'fslracingco@gmail.com',
      ARRAY['Automovilismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fsl-racing-662',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fsl-racing-662', v_school_id, '{"resolucion_rd": "662", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "CARLOS ARTURO ARRIETA DÃAZ", "localidad": "Usaquén", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO ARRIETA DÃAZ. Deporte(s): Automovilismo. Localidad: Usaquén. Resolución R-D Nº 662. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3206079558', phone),
      email       = COALESCE('fslracingco@gmail.com', email),
      sports      = ARRAY['Automovilismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "662", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "CARLOS ARTURO ARRIETA DÃAZ", "localidad": "Usaquén", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fsl-racing-662';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3206079558', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PREMIER ATHLETICS ALL STAR  (IDRD-CLUB-club-deportivo-premier-athletics-all-sta-1115)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-premier-athletics-all-sta-1115';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PREMIER ATHLETICS ALL STAR',
      'Presidente: ANGEL ANDRES TRIANA RAMIREZ. Deporte(s): Porrismo. Localidad: Chapinero. Resolución R-D Nº 1115. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3144553389',
      'premierathletics.allstars@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-premier-athletics-all-sta-1115',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-premier-athletics-all-sta-1115', v_school_id, '{"resolucion_rd": "1115", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "ANGEL ANDRES TRIANA RAMIREZ", "localidad": "Chapinero", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGEL ANDRES TRIANA RAMIREZ. Deporte(s): Porrismo. Localidad: Chapinero. Resolución R-D Nº 1115. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144553389', phone),
      email       = COALESCE('premierathletics.allstars@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1115", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "ANGEL ANDRES TRIANA RAMIREZ", "localidad": "Chapinero", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-premier-athletics-all-sta-1115';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3144553389', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ELITE FENCING ACADEMY  (IDRD-CLUB-club-deportivo-elite-fencing-academy-1121)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-elite-fencing-academy-1121';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ELITE FENCING ACADEMY',
      'Presidente: MELISSA BRAVO BUSTAMANTE. Deporte(s): Esgrima. Localidad: Engativá. Resolución R-D Nº 1121. Vigente hasta 2029-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3102274490',
      'melissabravo630@gmail.com',
      ARRAY['Esgrima']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-elite-fencing-academy-1121',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-elite-fencing-academy-1121', v_school_id, '{"resolucion_rd": "1121", "resolucion_actualizacion": null, "fecha_inicio": "20-08-2024", "fecha_fin": "2029-08-20", "presidente": "MELISSA BRAVO BUSTAMANTE", "localidad": "Engativá", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MELISSA BRAVO BUSTAMANTE. Deporte(s): Esgrima. Localidad: Engativá. Resolución R-D Nº 1121. Vigente hasta 2029-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102274490', phone),
      email       = COALESCE('melissabravo630@gmail.com', email),
      sports      = ARRAY['Esgrima']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1121", "resolucion_actualizacion": null, "fecha_inicio": "20-08-2024", "fecha_fin": "2029-08-20", "presidente": "MELISSA BRAVO BUSTAMANTE", "localidad": "Engativá", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-elite-fencing-academy-1121';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3102274490', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DK VOLEY SPORTS  (IDRD-CLUB-club-deportivo-dk-voley-sports-1122)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dk-voley-sports-1122';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DK VOLEY SPORTS',
      'Presidente: MARLY YULEY CARDENAS CASTELLANOS. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1122. Vigente hasta 2029-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3165777655',
      'dkvoleyclub2020@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dk-voley-sports-1122',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dk-voley-sports-1122', v_school_id, '{"resolucion_rd": "1122", "resolucion_actualizacion": null, "fecha_inicio": "20-08-2024", "fecha_fin": "2029-08-20", "presidente": "MARLY YULEY CARDENAS CASTELLANOS", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARLY YULEY CARDENAS CASTELLANOS. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1122. Vigente hasta 2029-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165777655', phone),
      email       = COALESCE('dkvoleyclub2020@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1122", "resolucion_actualizacion": null, "fecha_inicio": "20-08-2024", "fecha_fin": "2029-08-20", "presidente": "MARLY YULEY CARDENAS CASTELLANOS", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dk-voley-sports-1122';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3165777655', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA JHON FREDY MENA  (IDRD-CLUB-club-deportivo-academia-jhon-fredy-mena-1127)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-jhon-fredy-mena-1127';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA JHON FREDY MENA',
      'Presidente: JONATHAN ARMANDO ACOSTA DIAZ. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1127. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3053946032',
      'clubdeportivoacademiajhonfredy@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-jhon-fredy-mena-1127',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-jhon-fredy-mena-1127', v_school_id, '{"resolucion_rd": "1127", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "JONATHAN ARMANDO ACOSTA DIAZ", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JONATHAN ARMANDO ACOSTA DIAZ. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1127. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3053946032', phone),
      email       = COALESCE('clubdeportivoacademiajhonfredy@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1127", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "JONATHAN ARMANDO ACOSTA DIAZ", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-jhon-fredy-mena-1127';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3053946032', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AUTOSTOK TEAM  (IDRD-CLUB-club-deportivo-autostok-team-1132)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-autostok-team-1132';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AUTOSTOK TEAM',
      'Presidente: WILSON ALIRIO ALARCON VELASQUEZ. Deporte(s): Automovilismo. Localidad: Suba. Resolución R-D Nº 1132. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '7423838',
      'equipocarreras@autostok.com.co',
      ARRAY['Automovilismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-autostok-team-1132',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-autostok-team-1132', v_school_id, '{"resolucion_rd": "1132", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "WILSON ALIRIO ALARCON VELASQUEZ", "localidad": "Suba", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON ALIRIO ALARCON VELASQUEZ. Deporte(s): Automovilismo. Localidad: Suba. Resolución R-D Nº 1132. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7423838', phone),
      email       = COALESCE('equipocarreras@autostok.com.co', email),
      sports      = ARRAY['Automovilismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1132", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "WILSON ALIRIO ALARCON VELASQUEZ", "localidad": "Suba", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-autostok-team-1132';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '7423838', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TARTÃN COLOMBIA  (IDRD-CLUB-club-deportivo-tartan-colombia-1133)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tartan-colombia-1133';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TARTÃN COLOMBIA',
      'Presidente: CLAUDIA MARCELA GARCÃA VILLEGAS. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1133. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3113095303',
      'tartancolombia@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tartan-colombia-1133',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tartan-colombia-1133', v_school_id, '{"resolucion_rd": "1133", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "CLAUDIA MARCELA GARCÃA VILLEGAS", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA MARCELA GARCÃA VILLEGAS. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1133. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3113095303', phone),
      email       = COALESCE('tartancolombia@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1133", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "CLAUDIA MARCELA GARCÃA VILLEGAS", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tartan-colombia-1133';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3113095303', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PATINAJE DREAM TEAM  (IDRD-CLUB-club-deportivo-de-patinaje-dream-team-1135)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-dream-team-1135';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PATINAJE DREAM TEAM',
      'Presidente: FELIX ALBERTO ALVARADO LOPEZ. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1135. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3168771000',
      'felixnikealvarado20@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-patinaje-dream-team-1135',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-patinaje-dream-team-1135', v_school_id, '{"resolucion_rd": "1135", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "FELIX ALBERTO ALVARADO LOPEZ", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FELIX ALBERTO ALVARADO LOPEZ. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1135. Vigente hasta 2029-08-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3168771000', phone),
      email       = COALESCE('felixnikealvarado20@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1135", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2024", "fecha_fin": "2029-08-21", "presidente": "FELIX ALBERTO ALVARADO LOPEZ", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-dream-team-1135';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3168771000', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUTSALCEDO  (IDRD-CLUB-club-deportivo-futsalcedo-1139)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-futsalcedo-1139';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUTSALCEDO',
      'Presidente: CLAUDIA YENITZA BOCANEGRA LOPEZ. Deporte(s): Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 1139. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3209455727',
      'clubdeportivoluis@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-futsalcedo-1139',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-futsalcedo-1139', v_school_id, '{"resolucion_rd": "1139", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "CLAUDIA YENITZA BOCANEGRA LOPEZ", "localidad": "Kennedy", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA YENITZA BOCANEGRA LOPEZ. Deporte(s): Fútbol de salón. Localidad: Kennedy. Resolución R-D Nº 1139. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209455727', phone),
      email       = COALESCE('clubdeportivoluis@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1139", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "CLAUDIA YENITZA BOCANEGRA LOPEZ", "localidad": "Kennedy", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-futsalcedo-1139';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3209455727', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PREMA FÃTBOL CLUB  (IDRD-CLUB-club-deportivo-prema-fatbol-club-1145)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-prema-fatbol-club-1145';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PREMA FÃTBOL CLUB',
      'Presidente: DARIO ANDRES LEÃN PEÃA. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 1145. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3014888807',
      'premafutbolclub@outlook.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-prema-fatbol-club-1145',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-prema-fatbol-club-1145', v_school_id, '{"resolucion_rd": "1145", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "DARIO ANDRES LEÃN PEÃA", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DARIO ANDRES LEÃN PEÃA. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 1145. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3014888807', phone),
      email       = COALESCE('premafutbolclub@outlook.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1145", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "DARIO ANDRES LEÃN PEÃA", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-prema-fatbol-club-1145';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3014888807', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA ÃLITE DE FÃTBOL CAPITAL  (IDRD-CLUB-club-deportivo-academia-alite-de-fatbol--1156)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-alite-de-fatbol--1156';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA ÃLITE DE FÃTBOL CAPITAL',
      'Presidente: JUAN CARLOS QUINTERO ANDRADE. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1156. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3004498013',
      'g.deportiva@grupoelitecapital.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-alite-de-fatbol--1156',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-alite-de-fatbol--1156', v_school_id, '{"resolucion_rd": "1156", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "JUAN CARLOS QUINTERO ANDRADE", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS QUINTERO ANDRADE. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1156. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3004498013', phone),
      email       = COALESCE('g.deportiva@grupoelitecapital.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1156", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "JUAN CARLOS QUINTERO ANDRADE", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-alite-de-fatbol--1156';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3004498013', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DEEDS NOT WORDS  (IDRD-CLUB-club-deportivo-deeds-not-words-1157)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-deeds-not-words-1157';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DEEDS NOT WORDS',
      'Presidente: LUIS ALEJANDRO SARMIENTO SOCHA. Deporte(s): Voleibol. Localidad: Suba. Resolución R-D Nº 1157. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3152169379',
      'deedsnwords@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-deeds-not-words-1157',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-deeds-not-words-1157', v_school_id, '{"resolucion_rd": "1157", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "LUIS ALEJANDRO SARMIENTO SOCHA", "localidad": "Suba", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALEJANDRO SARMIENTO SOCHA. Deporte(s): Voleibol. Localidad: Suba. Resolución R-D Nº 1157. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3152169379', phone),
      email       = COALESCE('deedsnwords@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1157", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "LUIS ALEJANDRO SARMIENTO SOCHA", "localidad": "Suba", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-deeds-not-words-1157';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3152169379', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TIGRES MTB  (IDRD-CLUB-club-deportivo-tigres-mtb-1159)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tigres-mtb-1159';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TIGRES MTB',
      'Presidente: MARIA NERCY PABÃN SASTRE. Deporte(s): Ciclismo. Localidad: Suba. Resolución R-D Nº 1159. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3106996300',
      'ciclismotigres@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tigres-mtb-1159',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tigres-mtb-1159', v_school_id, '{"resolucion_rd": "1159", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "MARIA NERCY PABÃN SASTRE", "localidad": "Suba", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA NERCY PABÃN SASTRE. Deporte(s): Ciclismo. Localidad: Suba. Resolución R-D Nº 1159. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106996300', phone),
      email       = COALESCE('ciclismotigres@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1159", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "MARIA NERCY PABÃN SASTRE", "localidad": "Suba", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tigres-mtb-1159';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3106996300', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LAPONTE  (IDRD-CLUB-club-deportivo-laponte-1161)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-laponte-1161';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LAPONTE',
      'Presidente: DANIEL ESTEBAN ZABALETA ESPINOSA. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1161. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3158285408',
      'info.laponte@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-laponte-1161',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-laponte-1161', v_school_id, '{"resolucion_rd": "1161", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "DANIEL ESTEBAN ZABALETA ESPINOSA", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL ESTEBAN ZABALETA ESPINOSA. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1161. Vigente hasta 2029-08-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158285408', phone),
      email       = COALESCE('info.laponte@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1161", "resolucion_actualizacion": null, "fecha_inicio": "26-08-2024", "fecha_fin": "2029-08-26", "presidente": "DANIEL ESTEBAN ZABALETA ESPINOSA", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-laponte-1161';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3158285408', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BERSERKERS BASKETBALL BOGOTÃ  (IDRD-CLUB-club-deportivo-berserkers-basketball-bog-1167)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-berserkers-basketball-bog-1167';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BERSERKERS BASKETBALL BOGOTÃ',
      'Presidente: JOSÃ LUIS ORJUELA LÃPEZ. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 1167. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3014134510',
      'jorjuela85@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-berserkers-basketball-bog-1167',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-berserkers-basketball-bog-1167', v_school_id, '{"resolucion_rd": "1167", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "JOSÃ LUIS ORJUELA LÃPEZ", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ LUIS ORJUELA LÃPEZ. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 1167. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3014134510', phone),
      email       = COALESCE('jorjuela85@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1167", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "JOSÃ LUIS ORJUELA LÃPEZ", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-berserkers-basketball-bog-1167';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3014134510', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LEGENDS ALL STAR  (IDRD-CLUB-club-deportivo-legends-all-star-1169)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-legends-all-star-1169';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LEGENDS ALL STAR',
      'Presidente: RHONAL FERNEY SAAVEDRA ZARAZA. Deporte(s): Porrismo. Localidad: Suba. Resolución R-D Nº 1169. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3138822425',
      'bogotalegendsallstars@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-legends-all-star-1169',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-legends-all-star-1169', v_school_id, '{"resolucion_rd": "1169", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "RHONAL FERNEY SAAVEDRA ZARAZA", "localidad": "Suba", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RHONAL FERNEY SAAVEDRA ZARAZA. Deporte(s): Porrismo. Localidad: Suba. Resolución R-D Nº 1169. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138822425', phone),
      email       = COALESCE('bogotalegendsallstars@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1169", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "RHONAL FERNEY SAAVEDRA ZARAZA", "localidad": "Suba", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-legends-all-star-1169';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3138822425', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO NAREUSYA  (IDRD-CLUB-club-deportivo-de-taekwondo-nareusya-1170)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-nareusya-1170';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO NAREUSYA',
      'Presidente: CAMILA ISABEL FRANCO RODRIGUEZ. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1170. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3213601640',
      'camila.franco62@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-nareusya-1170',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-nareusya-1170', v_school_id, '{"resolucion_rd": "1170", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "CAMILA ISABEL FRANCO RODRIGUEZ", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILA ISABEL FRANCO RODRIGUEZ. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1170. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213601640', phone),
      email       = COALESCE('camila.franco62@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1170", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "CAMILA ISABEL FRANCO RODRIGUEZ", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-nareusya-1170';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3213601640', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TIERRAVENTURA  (IDRD-CLUB-club-deportivo-tierraventura-1173)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tierraventura-1173';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TIERRAVENTURA',
      'Presidente: JUAN DIEGO NICHOLLS STANGL. Deporte(s): Fútbol, Patinaje. Localidad: Usaquén. Resolución R-D Nº 1173. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3102289459',
      'dgtierraventura@gmail.com',
      ARRAY['Fútbol','Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tierraventura-1173',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tierraventura-1173', v_school_id, '{"resolucion_rd": "1173", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "JUAN DIEGO NICHOLLS STANGL", "localidad": "Usaquén", "sports": ["Fútbol", "Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN DIEGO NICHOLLS STANGL. Deporte(s): Fútbol, Patinaje. Localidad: Usaquén. Resolución R-D Nº 1173. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102289459', phone),
      email       = COALESCE('dgtierraventura@gmail.com', email),
      sports      = ARRAY['Fútbol','Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1173", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "JUAN DIEGO NICHOLLS STANGL", "localidad": "Usaquén", "sports": ["Fútbol", "Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tierraventura-1173';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3102289459', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO HOSHIDO  (IDRD-CLUB-club-deportivo-taekwondo-hoshido-1197)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-hoshido-1197';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO HOSHIDO',
      'Presidente: CLAUDIA XIMENA GÃMEZ MARMOLEJO. Deporte(s): Taekwondo. Localidad: Engativá. Resolución R-D Nº 1197. Vigente hasta 2029-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3193059416',
      'hoshidoclub@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-hoshido-1197',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-hoshido-1197', v_school_id, '{"resolucion_rd": "1197", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2024", "fecha_fin": "2029-08-30", "presidente": "CLAUDIA XIMENA GÃMEZ MARMOLEJO", "localidad": "Engativá", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA XIMENA GÃMEZ MARMOLEJO. Deporte(s): Taekwondo. Localidad: Engativá. Resolución R-D Nº 1197. Vigente hasta 2029-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193059416', phone),
      email       = COALESCE('hoshidoclub@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1197", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2024", "fecha_fin": "2029-08-30", "presidente": "CLAUDIA XIMENA GÃMEZ MARMOLEJO", "localidad": "Engativá", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-hoshido-1197';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3193059416', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE ESGRIMA VALHALLA  (IDRD-CLUB-club-deportivo-de-esgrima-valhalla-1174)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-esgrima-valhalla-1174';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE ESGRIMA VALHALLA',
      'Presidente: JOHN ALEXANDER GONZÃLEZ GÃMEZ. Deporte(s): Esgrima. Localidad: Kennedy. Resolución R-D Nº 1174. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3043778677',
      'clubdeesgrimavalhalla@gmail.com',
      ARRAY['Esgrima']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-esgrima-valhalla-1174',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-esgrima-valhalla-1174', v_school_id, '{"resolucion_rd": "1174", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "JOHN ALEXANDER GONZÃLEZ GÃMEZ", "localidad": "Kennedy", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN ALEXANDER GONZÃLEZ GÃMEZ. Deporte(s): Esgrima. Localidad: Kennedy. Resolución R-D Nº 1174. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043778677', phone),
      email       = COALESCE('clubdeesgrimavalhalla@gmail.com', email),
      sports      = ARRAY['Esgrima']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1174", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "JOHN ALEXANDER GONZÃLEZ GÃMEZ", "localidad": "Kennedy", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-esgrima-valhalla-1174';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3043778677', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB RE-CREAR EN LINEA  (IDRD-CLUB-club-re-crear-en-linea-1199)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-re-crear-en-linea-1199';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB RE-CREAR EN LINEA',
      'Presidente: PAULA ANDREA PARRA QUEVEDO. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1199. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3176784690',
      're.crearenlinea@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-re-crear-en-linea-1199',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-re-crear-en-linea-1199', v_school_id, '{"resolucion_rd": "1199", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "PAULA ANDREA PARRA QUEVEDO", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAULA ANDREA PARRA QUEVEDO. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1199. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3176784690', phone),
      email       = COALESCE('re.crearenlinea@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1199", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "PAULA ANDREA PARRA QUEVEDO", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-re-crear-en-linea-1199';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3176784690', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO OLYMPUS  (IDRD-CLUB-club-deportivo-olympus-1260)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-olympus-1260';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO OLYMPUS',
      'Presidente: VICTOR ALFONSO ROMERO ACUÃA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 1260. Vigente hasta 2029-09-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3118276929',
      'vialroac26@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-olympus-1260',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-olympus-1260', v_school_id, '{"resolucion_rd": "1260", "resolucion_actualizacion": null, "fecha_inicio": "17-09-2024", "fecha_fin": "2029-09-17", "presidente": "VICTOR ALFONSO ROMERO ACUÃA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR ALFONSO ROMERO ACUÃA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 1260. Vigente hasta 2029-09-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118276929', phone),
      email       = COALESCE('vialroac26@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1260", "resolucion_actualizacion": null, "fecha_inicio": "17-09-2024", "fecha_fin": "2029-09-17", "presidente": "VICTOR ALFONSO ROMERO ACUÃA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-olympus-1260';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3118276929', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MEDUSAS  (IDRD-CLUB-club-deportivo-medusas-1206)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-medusas-1206';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MEDUSAS',
      'Presidente: PEDRO FERMIN PEREZ OTERO. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 1206. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '22106223006400653',
      'fundacion.medusas@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-medusas-1206',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-medusas-1206', v_school_id, '{"resolucion_rd": "1206", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "PEDRO FERMIN PEREZ OTERO", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO FERMIN PEREZ OTERO. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 1206. Vigente hasta 2029-09-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('22106223006400653', phone),
      email       = COALESCE('fundacion.medusas@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1206", "resolucion_actualizacion": null, "fecha_inicio": "03-09-2024", "fecha_fin": "2029-09-03", "presidente": "PEDRO FERMIN PEREZ OTERO", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-medusas-1206';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '22106223006400653', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO COLÃN TUTO SPORT  (IDRD-CLUB-club-deportivo-colan-tuto-sport-984)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-colan-tuto-sport-984';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO COLÃN TUTO SPORT',
      'Presidente: LUIS ALFREDO PEÃA GARCÃA. Deporte(s): Fútbol de salón. Localidad: Puente Aranda. Resolución R-D Nº 984. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3112587466',
      'pgalfredo610@hotmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-colan-tuto-sport-984',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-colan-tuto-sport-984', v_school_id, '{"resolucion_rd": "984", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "LUIS ALFREDO PEÃA GARCÃA", "localidad": "Puente Aranda", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALFREDO PEÃA GARCÃA. Deporte(s): Fútbol de salón. Localidad: Puente Aranda. Resolución R-D Nº 984. Vigente hasta 2029-07-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112587466', phone),
      email       = COALESCE('pgalfredo610@hotmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "984", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2024", "fecha_fin": "2029-07-25", "presidente": "LUIS ALFREDO PEÃA GARCÃA", "localidad": "Puente Aranda", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-colan-tuto-sport-984';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3112587466', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA DE BALONCESTO VERITAS COLOMBIA  (IDRD-CLUB-club-deportivo-academia-de-baloncesto-ve-1228)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-de-baloncesto-ve-1228';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA DE BALONCESTO VERITAS COLOMBIA',
      'Presidente: RUBEN GILBERTO ROJAS FONSECA. Deporte(s): Baloncesto. Localidad: Ciudad Bolívar. Resolución R-D Nº 1228. Vigente hasta 2029-09-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3214819467',
      'veritascolombia@veritascolombia.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-de-baloncesto-ve-1228',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-de-baloncesto-ve-1228', v_school_id, '{"resolucion_rd": "1228", "resolucion_actualizacion": null, "fecha_inicio": "05-09-2024", "fecha_fin": "2029-09-05", "presidente": "RUBEN GILBERTO ROJAS FONSECA", "localidad": "Ciudad Bolívar", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RUBEN GILBERTO ROJAS FONSECA. Deporte(s): Baloncesto. Localidad: Ciudad Bolívar. Resolución R-D Nº 1228. Vigente hasta 2029-09-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214819467', phone),
      email       = COALESCE('veritascolombia@veritascolombia.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1228", "resolucion_actualizacion": null, "fecha_inicio": "05-09-2024", "fecha_fin": "2029-09-05", "presidente": "RUBEN GILBERTO ROJAS FONSECA", "localidad": "Ciudad Bolívar", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-de-baloncesto-ve-1228';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3214819467', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SKATE RUNNING  (IDRD-CLUB-club-deportivo-skate-running-1229)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-skate-running-1229';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SKATE RUNNING',
      'Presidente: ANGIE ALEJANDRA GERENA GARCIA. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 1229. Vigente hasta 2029-09-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3212169307',
      'skaterunning2016@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-skate-running-1229',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-skate-running-1229', v_school_id, '{"resolucion_rd": "1229", "resolucion_actualizacion": null, "fecha_inicio": "05-09-2024", "fecha_fin": "2029-09-05", "presidente": "ANGIE ALEJANDRA GERENA GARCIA", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGIE ALEJANDRA GERENA GARCIA. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 1229. Vigente hasta 2029-09-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212169307', phone),
      email       = COALESCE('skaterunning2016@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1229", "resolucion_actualizacion": null, "fecha_inicio": "05-09-2024", "fecha_fin": "2029-09-05", "presidente": "ANGIE ALEJANDRA GERENA GARCIA", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-skate-running-1229';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3212169307', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FORTIUS HC  (IDRD-CLUB-club-deportivo-fortius-hc-1262)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fortius-hc-1262';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FORTIUS HC',
      'Presidente: JHON ESTIVEN ORJUELA LÃPEZ. Deporte(s): Balonmano. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1262. Vigente hasta 2029-09-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3168602715',
      'clubfortiusbal@gmail.com',
      ARRAY['Balonmano']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fortius-hc-1262',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fortius-hc-1262', v_school_id, '{"resolucion_rd": "1262", "resolucion_actualizacion": null, "fecha_inicio": "17-09-2024", "fecha_fin": "2029-09-17", "presidente": "JHON ESTIVEN ORJUELA LÃPEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Balonmano"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON ESTIVEN ORJUELA LÃPEZ. Deporte(s): Balonmano. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1262. Vigente hasta 2029-09-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3168602715', phone),
      email       = COALESCE('clubfortiusbal@gmail.com', email),
      sports      = ARRAY['Balonmano']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1262", "resolucion_actualizacion": null, "fecha_inicio": "17-09-2024", "fecha_fin": "2029-09-17", "presidente": "JHON ESTIVEN ORJUELA LÃPEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Balonmano"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fortius-hc-1262';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3168602715', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CAPITAL PADEL CLUB  (IDRD-CLUB-club-deportivo-capital-padel-club-1321)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-capital-padel-club-1321';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CAPITAL PADEL CLUB',
      'Presidente: CAROLINA PATRICIA RODRIGUEZ CHACIN. Deporte(s): Padel. Localidad: Usaquén. Resolución R-D Nº 1321. Vigente hasta 2029-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3183271432',
      'administracion@capitalpadelclub.co',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-capital-padel-club-1321',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-capital-padel-club-1321', v_school_id, '{"resolucion_rd": "1321", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2024", "fecha_fin": "2029-09-24", "presidente": "CAROLINA PATRICIA RODRIGUEZ CHACIN", "localidad": "Usaquén", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAROLINA PATRICIA RODRIGUEZ CHACIN. Deporte(s): Padel. Localidad: Usaquén. Resolución R-D Nº 1321. Vigente hasta 2029-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183271432', phone),
      email       = COALESCE('administracion@capitalpadelclub.co', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1321", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2024", "fecha_fin": "2029-09-24", "presidente": "CAROLINA PATRICIA RODRIGUEZ CHACIN", "localidad": "Usaquén", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-capital-padel-club-1321';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3183271432', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HOCKEY CESPED THUNDER  (IDRD-CLUB-club-deportivo-hockey-cesped-thunder-1263)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-hockey-cesped-thunder-1263';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HOCKEY CESPED THUNDER',
      'Presidente: PABLO ARMANDO LUNA RICO. Deporte(s): Hockey Sobre Cesped. Localidad: Engativá. Resolución R-D Nº 1263. Vigente hasta 2029-09-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3116107340',
      'clubhockeycespedthunder@gmail.com',
      ARRAY['Hockey Sobre Cesped']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-hockey-cesped-thunder-1263',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-hockey-cesped-thunder-1263', v_school_id, '{"resolucion_rd": "1263", "resolucion_actualizacion": null, "fecha_inicio": "17-09-2024", "fecha_fin": "2029-09-17", "presidente": "PABLO ARMANDO LUNA RICO", "localidad": "Engativá", "sports": ["Hockey Sobre Cesped"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PABLO ARMANDO LUNA RICO. Deporte(s): Hockey Sobre Cesped. Localidad: Engativá. Resolución R-D Nº 1263. Vigente hasta 2029-09-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3116107340', phone),
      email       = COALESCE('clubhockeycespedthunder@gmail.com', email),
      sports      = ARRAY['Hockey Sobre Cesped']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1263", "resolucion_actualizacion": null, "fecha_inicio": "17-09-2024", "fecha_fin": "2029-09-17", "presidente": "PABLO ARMANDO LUNA RICO", "localidad": "Engativá", "sports": ["Hockey Sobre Cesped"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-hockey-cesped-thunder-1263';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3116107340', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO SPORTCENTER  (IDRD-CLUB-club-deportivo-de-taekwondo-sportcenter-1266)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-sportcenter-1266';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO SPORTCENTER',
      'Presidente: OMAR FERNANDO GARZÃN CHAPARRO. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1266. Vigente hasta 2029-09-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3108076004',
      'omargarzon075@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-sportcenter-1266',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-sportcenter-1266', v_school_id, '{"resolucion_rd": "1266", "resolucion_actualizacion": null, "fecha_inicio": "18-09-2024", "fecha_fin": "2029-09-18", "presidente": "OMAR FERNANDO GARZÃN CHAPARRO", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OMAR FERNANDO GARZÃN CHAPARRO. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1266. Vigente hasta 2029-09-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108076004', phone),
      email       = COALESCE('omargarzon075@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1266", "resolucion_actualizacion": null, "fecha_inicio": "18-09-2024", "fecha_fin": "2029-09-18", "presidente": "OMAR FERNANDO GARZÃN CHAPARRO", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-sportcenter-1266';
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

COMMIT;
