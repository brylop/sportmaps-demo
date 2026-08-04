-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 5/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAN MARTIN  (IDRD-CLUB-club-deportivo-san-martin-63.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-san-martin-63.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAN MARTIN',
      'Presidente: MARIO ANDRES TORRES FONSECA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 63.0 / actualización Nº N/A. Vigente hasta 2029-02-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3103053598',
      'clubdeportivosanmartin823@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-san-martin-63.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-san-martin-63.0', v_school_id, '{"resolucion_rd": "63.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-02", "fecha_fin": "2029-02-02", "presidente": "MARIO ANDRES TORRES FONSECA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIO ANDRES TORRES FONSECA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 63.0 / actualización Nº N/A. Vigente hasta 2029-02-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103053598', phone),
      email       = COALESCE('clubdeportivosanmartin823@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "63.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-02", "fecha_fin": "2029-02-02", "presidente": "MARIO ANDRES TORRES FONSECA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-san-martin-63.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3103053598', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESFORTRIC 90  (IDRD-CLUB-club-deportivo-esfortric-90-550)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-esfortric-90-550';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESFORTRIC 90',
      'Presidente: MARIA HILDE HERNANDEZ PEREZ. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 550. Vigente hasta 2029-05-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3153965743',
      'mahihepe1314@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-esfortric-90-550',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-esfortric-90-550', v_school_id, '{"resolucion_rd": "550", "resolucion_actualizacion": null, "fecha_inicio": "08-05-2024", "fecha_fin": "2029-05-08", "presidente": "MARIA HILDE HERNANDEZ PEREZ", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA HILDE HERNANDEZ PEREZ. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 550. Vigente hasta 2029-05-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153965743', phone),
      email       = COALESCE('mahihepe1314@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "550", "resolucion_actualizacion": null, "fecha_inicio": "08-05-2024", "fecha_fin": "2029-05-08", "presidente": "MARIA HILDE HERNANDEZ PEREZ", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-esfortric-90-550';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3153965743', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA FALCONÃÂ´S  (IDRD-CLUB-club-deportivo-academia-falconaa-s-466)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-falconaa-s-466';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA FALCONÃÂ´S',
      'Presidente: JOSE RICARDO HERNANDEZ ARIAS. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 466. Vigente hasta 2029-04-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3503452277',
      'academiafutbolfalcons@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-falconaa-s-466',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-falconaa-s-466', v_school_id, '{"resolucion_rd": "466", "resolucion_actualizacion": null, "fecha_inicio": "15-04-2024", "fecha_fin": "2029-04-15", "presidente": "JOSE RICARDO HERNANDEZ ARIAS", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE RICARDO HERNANDEZ ARIAS. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 466. Vigente hasta 2029-04-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3503452277', phone),
      email       = COALESCE('academiafutbolfalcons@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "466", "resolucion_actualizacion": null, "fecha_inicio": "15-04-2024", "fecha_fin": "2029-04-15", "presidente": "JOSE RICARDO HERNANDEZ ARIAS", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-falconaa-s-466';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3503452277', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLETICO GRANADA FC  (IDRD-CLUB-club-deportivo-atletico-granada-fc-907)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletico-granada-fc-907';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLETICO GRANADA FC',
      'Presidente: JULIAN ANDRES APARICIO AYALA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 907. Vigente hasta 2030-08-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3144148330',
      'gfcfutbol@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atletico-granada-fc-907',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atletico-granada-fc-907', v_school_id, '{"resolucion_rd": "907", "resolucion_actualizacion": null, "fecha_inicio": "28-08-2025", "fecha_fin": "2030-08-28", "presidente": "JULIAN ANDRES APARICIO AYALA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIAN ANDRES APARICIO AYALA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 907. Vigente hasta 2030-08-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144148330', phone),
      email       = COALESCE('gfcfutbol@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "907", "resolucion_actualizacion": null, "fecha_inicio": "28-08-2025", "fecha_fin": "2030-08-28", "presidente": "JULIAN ANDRES APARICIO AYALA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletico-granada-fc-907';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3144148330', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AGREMYO  (IDRD-CLUB-club-deportivo-agremyo-036)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-agremyo-036';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AGREMYO',
      'Presidente: OMAR OLIMPO MORALES MORALES. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 036. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3176825806',
      'administracion@clubgremyo.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-agremyo-036',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-agremyo-036', v_school_id, '{"resolucion_rd": "036", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "OMAR OLIMPO MORALES MORALES", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OMAR OLIMPO MORALES MORALES. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 036. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3176825806', phone),
      email       = COALESCE('administracion@clubgremyo.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "036", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "OMAR OLIMPO MORALES MORALES", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-agremyo-036';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3176825806', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BDC  (IDRD-CLUB-club-deportivo-bdc-1617)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bdc-1617';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BDC',
      'Presidente: KAREN YOHANA SOLER MESA. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 1617. Vigente hasta 2028-12-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '24981333008074812',
      'barcelonabdc11@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bdc-1617',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bdc-1617', v_school_id, '{"resolucion_rd": "1617", "resolucion_actualizacion": null, "fecha_inicio": "01-01-2024", "fecha_fin": "2028-12-31", "presidente": "KAREN YOHANA SOLER MESA", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN YOHANA SOLER MESA. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 1617. Vigente hasta 2028-12-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('24981333008074812', phone),
      email       = COALESCE('barcelonabdc11@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1617", "resolucion_actualizacion": null, "fecha_inicio": "01-01-2024", "fecha_fin": "2028-12-31", "presidente": "KAREN YOHANA SOLER MESA", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bdc-1617';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '24981333008074812', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MANAOS F.C,  (IDRD-CLUB-club-deportivo-manaos-fc-1172)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-manaos-fc-1172';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MANAOS F.C,',
      'Presidente: DANNY ERNESTO QUIROGA GARZÃN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1172. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3202421932',
      'manaosfc10@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-manaos-fc-1172',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-manaos-fc-1172', v_school_id, '{"resolucion_rd": "1172", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "DANNY ERNESTO QUIROGA GARZÃN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANNY ERNESTO QUIROGA GARZÃN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1172. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202421932', phone),
      email       = COALESCE('manaosfc10@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1172", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "DANNY ERNESTO QUIROGA GARZÃN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-manaos-fc-1172';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3202421932', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB ACADEMIA DE FUTBOL SOCCER DREAMS  (IDRD-CLUB-club-academia-de-futbol-soccer-dreams-953)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-academia-de-futbol-soccer-dreams-953';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB ACADEMIA DE FUTBOL SOCCER DREAMS',
      'Presidente: ANYELA PATRICIA DIAZ VALDERRAMA. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 953. Vigente hasta 2029-07-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3003105106',
      'soccerdreamsacademia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-academia-de-futbol-soccer-dreams-953',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-academia-de-futbol-soccer-dreams-953', v_school_id, '{"resolucion_rd": "953", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2024", "fecha_fin": "2029-07-22", "presidente": "ANYELA PATRICIA DIAZ VALDERRAMA", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANYELA PATRICIA DIAZ VALDERRAMA. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 953. Vigente hasta 2029-07-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003105106', phone),
      email       = COALESCE('soccerdreamsacademia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "953", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2024", "fecha_fin": "2029-07-22", "presidente": "ANYELA PATRICIA DIAZ VALDERRAMA", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-academia-de-futbol-soccer-dreams-953';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3003105106', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PRIDE LINE  (IDRD-CLUB-club-deportivo-pride-line-1840)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pride-line-1840';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PRIDE LINE',
      'Presidente: JONATHAN ALEXANDER BAUTISTA ZAMUDIO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1840. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3232289862',
      'escuelapride@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pride-line-1840',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pride-line-1840', v_school_id, '{"resolucion_rd": "1840", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "JONATHAN ALEXANDER BAUTISTA ZAMUDIO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JONATHAN ALEXANDER BAUTISTA ZAMUDIO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1840. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3232289862', phone),
      email       = COALESCE('escuelapride@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1840", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "JONATHAN ALEXANDER BAUTISTA ZAMUDIO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pride-line-1840';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3232289862', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BRIO FUTBOL CLUB  (IDRD-CLUB-club-deportivo-brio-futbol-club-1277)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-brio-futbol-club-1277';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BRIO FUTBOL CLUB',
      'Presidente: GLORIA LILIANA RODRIGUEZ PACHÃâN. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1277. Vigente hasta 2029-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '7614213',
      'briofutbolclubinternacional10@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-brio-futbol-club-1277',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-brio-futbol-club-1277', v_school_id, '{"resolucion_rd": "1277", "resolucion_actualizacion": null, "fecha_inicio": "21-09-2024", "fecha_fin": "2029-09-21", "presidente": "GLORIA LILIANA RODRIGUEZ PACHÃâN", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GLORIA LILIANA RODRIGUEZ PACHÃâN. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1277. Vigente hasta 2029-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7614213', phone),
      email       = COALESCE('briofutbolclubinternacional10@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1277", "resolucion_actualizacion": null, "fecha_inicio": "21-09-2024", "fecha_fin": "2029-09-21", "presidente": "GLORIA LILIANA RODRIGUEZ PACHÃâN", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-brio-futbol-club-1277';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '7614213', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KUPPA VOLEI CLUB  (IDRD-CLUB-kuppa-volei-club-863)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kuppa-volei-club-863';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KUPPA VOLEI CLUB',
      'Presidente: JOHN MANUEL QUIROGA BAEZ. Deporte(s): Voleibol. Localidad: Suba. Resolución R-D Nº 863. Vigente hasta 2026-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '7572370',
      'jmqb25@hotmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kuppa-volei-club-863',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kuppa-volei-club-863', v_school_id, '{"resolucion_rd": "863", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2021", "fecha_fin": "2026-10-20", "presidente": "JOHN MANUEL QUIROGA BAEZ", "localidad": "Suba", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN MANUEL QUIROGA BAEZ. Deporte(s): Voleibol. Localidad: Suba. Resolución R-D Nº 863. Vigente hasta 2026-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7572370', phone),
      email       = COALESCE('jmqb25@hotmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "863", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2021", "fecha_fin": "2026-10-20", "presidente": "JOHN MANUEL QUIROGA BAEZ", "localidad": "Suba", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kuppa-volei-club-863';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '7572370', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ALEXANDER BRAND  (IDRD-CLUB-club-deportivo-alexander-brand-005)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-alexander-brand-005';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ALEXANDER BRAND',
      'Presidente: ALEXANDER BRAND MONSALVE. Deporte(s): Boxeo. Localidad: Engativá. Resolución R-D Nº 005. Vigente hasta 2031-01-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3208507899',
      'abrandmonsalve@gmail.com',
      ARRAY['Boxeo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-alexander-brand-005',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-alexander-brand-005', v_school_id, '{"resolucion_rd": "005", "resolucion_actualizacion": null, "fecha_inicio": "21-01-2026", "fecha_fin": "2031-01-21", "presidente": "ALEXANDER BRAND MONSALVE", "localidad": "Engativá", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEXANDER BRAND MONSALVE. Deporte(s): Boxeo. Localidad: Engativá. Resolución R-D Nº 005. Vigente hasta 2031-01-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208507899', phone),
      email       = COALESCE('abrandmonsalve@gmail.com', email),
      sports      = ARRAY['Boxeo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "005", "resolucion_actualizacion": null, "fecha_inicio": "21-01-2026", "fecha_fin": "2031-01-21", "presidente": "ALEXANDER BRAND MONSALVE", "localidad": "Engativá", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-alexander-brand-005';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3208507899', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA SEPTIMA  (IDRD-CLUB-club-deportivo-la-septima-469)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-septima-469';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA SEPTIMA',
      'Presidente: MARIA FERNANDA GALINDO PALENCIA. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 469. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3107627272',
      'maryfergalindop@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-septima-469',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-septima-469', v_school_id, '{"resolucion_rd": "469", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "MARIA FERNANDA GALINDO PALENCIA", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA FERNANDA GALINDO PALENCIA. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 469. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107627272', phone),
      email       = COALESCE('maryfergalindop@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "469", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "MARIA FERNANDA GALINDO PALENCIA", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-septima-469';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3107627272', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NATIVOS  (IDRD-CLUB-club-deportivo-nativos-031)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-nativos-031';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NATIVOS',
      'Presidente: KAREN ANDREA OJEDA CASTAÃâO. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 031 / actualización Nº 1354. Vigente hasta 2031-02-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3204994827',
      'nativosapalapajawaa@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-nativos-031',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-nativos-031', v_school_id, '{"resolucion_rd": "031", "resolucion_actualizacion": "1354", "fecha_inicio": "27-02-2026", "fecha_fin": "2031-02-27", "presidente": "KAREN ANDREA OJEDA CASTAÃâO", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN ANDREA OJEDA CASTAÃâO. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 031 / actualización Nº 1354. Vigente hasta 2031-02-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204994827', phone),
      email       = COALESCE('nativosapalapajawaa@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "031", "resolucion_actualizacion": "1354", "fecha_inicio": "27-02-2026", "fecha_fin": "2031-02-27", "presidente": "KAREN ANDREA OJEDA CASTAÃâO", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-nativos-031';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3204994827', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KINGS BASKETBALL CLUB  (IDRD-CLUB-club-deportivo-kings-basketball-club-677)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kings-basketball-club-677';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KINGS BASKETBALL CLUB',
      'Presidente: CRISTIAN CAMILO ORJUELA MORALES. Deporte(s): Baloncesto. Localidad: Barrios Unidos. Resolución R-D Nº 677. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3222182106',
      'clubkingsbasketball@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kings-basketball-club-677',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kings-basketball-club-677', v_school_id, '{"resolucion_rd": "677", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "CRISTIAN CAMILO ORJUELA MORALES", "localidad": "Barrios Unidos", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN CAMILO ORJUELA MORALES. Deporte(s): Baloncesto. Localidad: Barrios Unidos. Resolución R-D Nº 677. Vigente hasta 2029-06-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222182106', phone),
      email       = COALESCE('clubkingsbasketball@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "677", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2024", "fecha_fin": "2029-06-05", "presidente": "CRISTIAN CAMILO ORJUELA MORALES", "localidad": "Barrios Unidos", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kings-basketball-club-677';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3222182106', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB FUNDACIÃâN DEPORTIVA INTERNACIONALE F.C.  (IDRD-CLUB-club-fundaciaan-deportiva-internacionale-1642)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-fundaciaan-deportiva-internacionale-1642';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB FUNDACIÃâN DEPORTIVA INTERNACIONALE F.C.',
      'Presidente: EDGAR SULEY ORDUZ TAVERA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1642. Vigente hasta 2030-11-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3132974183',
      'internacionalefc2011@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-fundaciaan-deportiva-internacionale-1642',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-fundaciaan-deportiva-internacionale-1642', v_school_id, '{"resolucion_rd": "1642", "resolucion_actualizacion": null, "fecha_inicio": "21-11-2025", "fecha_fin": "2030-11-21", "presidente": "EDGAR SULEY ORDUZ TAVERA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR SULEY ORDUZ TAVERA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1642. Vigente hasta 2030-11-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132974183', phone),
      email       = COALESCE('internacionalefc2011@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1642", "resolucion_actualizacion": null, "fecha_inicio": "21-11-2025", "fecha_fin": "2030-11-21", "presidente": "EDGAR SULEY ORDUZ TAVERA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-fundaciaan-deportiva-internacionale-1642';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3132974183', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VILLAREAL FC  (IDRD-CLUB-club-deportivo-villareal-fc-1454)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-villareal-fc-1454';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VILLAREAL FC',
      'Presidente: ANGELICA JAZMIN SIMBAQUEBA DIAZ. Deporte(s): Fútbol. Localidad: La Candelaria. Resolución R-D Nº 1454. Vigente hasta 2030-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'La Candelaria',
      '3214109382',
      'efdvillarrealfc@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-villareal-fc-1454',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-villareal-fc-1454', v_school_id, '{"resolucion_rd": "1454", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2025", "fecha_fin": "2030-12-10", "presidente": "ANGELICA JAZMIN SIMBAQUEBA DIAZ", "localidad": "La Candelaria", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELICA JAZMIN SIMBAQUEBA DIAZ. Deporte(s): Fútbol. Localidad: La Candelaria. Resolución R-D Nº 1454. Vigente hasta 2030-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214109382', phone),
      email       = COALESCE('efdvillarrealfc@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1454", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2025", "fecha_fin": "2030-12-10", "presidente": "ANGELICA JAZMIN SIMBAQUEBA DIAZ", "localidad": "La Candelaria", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-villareal-fc-1454';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'La Candelaria', 'Bogotá', '3214109382', 4.6843605, -74.0511562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- UNIÃN MAGDALENA BOGOTA  (IDRD-CLUB-unian-magdalena-bogota-1110)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-unian-magdalena-bogota-1110';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'UNIÃN MAGDALENA BOGOTA',
      'Presidente: FERNANDO ARDILA VELANDIA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1110. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3928880313',
      'fernandoardila496@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'unian-magdalena-bogota-1110',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-unian-magdalena-bogota-1110', v_school_id, '{"resolucion_rd": "1110", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "FERNANDO ARDILA VELANDIA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FERNANDO ARDILA VELANDIA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1110. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3928880313', phone),
      email       = COALESCE('fernandoardila496@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1110", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "FERNANDO ARDILA VELANDIA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-unian-magdalena-bogota-1110';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3928880313', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CAIMANES  (IDRD-CLUB-club-deportivo-caimanes-724)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-caimanes-724';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CAIMANES',
      'Presidente: MARIA CLAUDIA SANCHEZ BLANCO. Deporte(s): Softbol. Localidad: Kennedy. Resolución R-D Nº 724 / actualización Nº 724. Vigente hasta 2026-06-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3143453922',
      'foderde@gmail.com',
      ARRAY['Softbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-caimanes-724',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-caimanes-724', v_school_id, '{"resolucion_rd": "724", "resolucion_actualizacion": "724", "fecha_inicio": "21-06-2021", "fecha_fin": "2026-06-21", "presidente": "MARIA CLAUDIA SANCHEZ BLANCO", "localidad": "Kennedy", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA CLAUDIA SANCHEZ BLANCO. Deporte(s): Softbol. Localidad: Kennedy. Resolución R-D Nº 724 / actualización Nº 724. Vigente hasta 2026-06-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143453922', phone),
      email       = COALESCE('foderde@gmail.com', email),
      sports      = ARRAY['Softbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "724", "resolucion_actualizacion": "724", "fecha_inicio": "21-06-2021", "fecha_fin": "2026-06-21", "presidente": "MARIA CLAUDIA SANCHEZ BLANCO", "localidad": "Kennedy", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-caimanes-724';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3143453922', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO URBAN INLINE SKATE  (IDRD-CLUB-club-deportivo-urban-inline-skate-1229)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-urban-inline-skate-1229';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO URBAN INLINE SKATE',
      'Presidente: DANIEL ALEJANDRO PELAYO ROBELTO. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1229. Vigente hasta 2030-10-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3193620324',
      'urbaninlineskate@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-urban-inline-skate-1229',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-urban-inline-skate-1229', v_school_id, '{"resolucion_rd": "1229", "resolucion_actualizacion": null, "fecha_inicio": "29-10-2025", "fecha_fin": "2030-10-29", "presidente": "DANIEL ALEJANDRO PELAYO ROBELTO", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL ALEJANDRO PELAYO ROBELTO. Deporte(s): Patinaje. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1229. Vigente hasta 2030-10-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193620324', phone),
      email       = COALESCE('urbaninlineskate@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1229", "resolucion_actualizacion": null, "fecha_inicio": "29-10-2025", "fecha_fin": "2030-10-29", "presidente": "DANIEL ALEJANDRO PELAYO ROBELTO", "localidad": "Rafael Uribe Uribe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-urban-inline-skate-1229';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3193620324', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LOWENFELD  (IDRD-CLUB-lowenfeld-064)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-lowenfeld-064';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LOWENFELD',
      'Presidente: JUAN FELIPE RAMOS GOMEZ. Deporte(s): Fútbol, Patinaje, Ultimate. Localidad: Engativá. Resolución R-D Nº 064 / actualización Nº 073. Vigente hasta 2027-02-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3023747010',
      'clubdeportivolowenfeld@gmail.com',
      ARRAY['Fútbol','Patinaje','Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'lowenfeld-064',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-lowenfeld-064', v_school_id, '{"resolucion_rd": "064", "resolucion_actualizacion": "073", "fecha_inicio": "09-02-2022", "fecha_fin": "2027-02-09", "presidente": "JUAN FELIPE RAMOS GOMEZ", "localidad": "Engativá", "sports": ["Fútbol", "Patinaje", "Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN FELIPE RAMOS GOMEZ. Deporte(s): Fútbol, Patinaje, Ultimate. Localidad: Engativá. Resolución R-D Nº 064 / actualización Nº 073. Vigente hasta 2027-02-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3023747010', phone),
      email       = COALESCE('clubdeportivolowenfeld@gmail.com', email),
      sports      = ARRAY['Fútbol','Patinaje','Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "064", "resolucion_actualizacion": "073", "fecha_inicio": "09-02-2022", "fecha_fin": "2027-02-09", "presidente": "JUAN FELIPE RAMOS GOMEZ", "localidad": "Engativá", "sports": ["Fútbol", "Patinaje", "Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-lowenfeld-064';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3023747010', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLÃTICO AQUA LIVÃN  (IDRD-CLUB-club-deportivo-atlatico-aqua-livan-521)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-aqua-livan-521';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLÃTICO AQUA LIVÃN',
      'Presidente: LINA MARÃA ROJAS PINILLA. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 521. Vigente hasta 2026-06-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3203623989',
      'clubatleticolivan@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlatico-aqua-livan-521',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlatico-aqua-livan-521', v_school_id, '{"resolucion_rd": "521", "resolucion_actualizacion": null, "fecha_inicio": "01-08-2019", "fecha_fin": "2026-06-22", "presidente": "LINA MARÃA ROJAS PINILLA", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LINA MARÃA ROJAS PINILLA. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 521. Vigente hasta 2026-06-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203623989', phone),
      email       = COALESCE('clubatleticolivan@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "521", "resolucion_actualizacion": null, "fecha_inicio": "01-08-2019", "fecha_fin": "2026-06-22", "presidente": "LINA MARÃA ROJAS PINILLA", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-aqua-livan-521';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3203623989', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESEI FC  (IDRD-CLUB-club-deportivo-esei-fc-470)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-esei-fc-470';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESEI FC',
      'Presidente: OMAR ENRIQUE BERNAL ROJAS,. Deporte(s): Tenis, Voleibol, Baloncesto, Atletismo. Localidad: Fontibón. Resolución R-D Nº 470. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3124480055',
      'omariny100@gmail.com',
      ARRAY['Tenis','Voleibol','Baloncesto','Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-esei-fc-470',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-esei-fc-470', v_school_id, '{"resolucion_rd": "470", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "OMAR ENRIQUE BERNAL ROJAS,", "localidad": "Fontibón", "sports": ["Tenis", "Voleibol", "Baloncesto", "Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OMAR ENRIQUE BERNAL ROJAS,. Deporte(s): Tenis, Voleibol, Baloncesto, Atletismo. Localidad: Fontibón. Resolución R-D Nº 470. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124480055', phone),
      email       = COALESCE('omariny100@gmail.com', email),
      sports      = ARRAY['Tenis','Voleibol','Baloncesto','Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "470", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "OMAR ENRIQUE BERNAL ROJAS,", "localidad": "Fontibón", "sports": ["Tenis", "Voleibol", "Baloncesto", "Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-esei-fc-470';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3124480055', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SL  (IDRD-CLUB-club-deportivo-sl-477)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sl-477';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SL',
      'Presidente: FERNEY MOSQUERA MOSQUERA,. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 477. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3108863693',
      'asdcoo3@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sl-477',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sl-477', v_school_id, '{"resolucion_rd": "477", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "FERNEY MOSQUERA MOSQUERA,", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FERNEY MOSQUERA MOSQUERA,. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 477. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108863693', phone),
      email       = COALESCE('asdcoo3@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "477", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "FERNEY MOSQUERA MOSQUERA,", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sl-477';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3108863693', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SIKAS SKATE  (IDRD-CLUB-sikas-skate-471)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sikas-skate-471';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SIKAS SKATE',
      'Presidente: SANDRA MARIA ALBA PACAVITA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 471. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3175189951',
      'samaalpa@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sikas-skate-471',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sikas-skate-471', v_school_id, '{"resolucion_rd": "471", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "SANDRA MARIA ALBA PACAVITA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA MARIA ALBA PACAVITA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 471. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3175189951', phone),
      email       = COALESCE('samaalpa@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "471", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "SANDRA MARIA ALBA PACAVITA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sikas-skate-471';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3175189951', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PATINAJE FRENESI  (IDRD-CLUB-club-deportivo-de-patinaje-frenesi-487)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-frenesi-487';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PATINAJE FRENESI',
      'Presidente: NIDIA YUBELY AVILA GRIJALBA. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 487. Vigente hasta 2026-06-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3138422727',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-patinaje-frenesi-487',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-patinaje-frenesi-487', v_school_id, '{"resolucion_rd": "487", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2021", "fecha_fin": "2026-06-29", "presidente": "NIDIA YUBELY AVILA GRIJALBA", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NIDIA YUBELY AVILA GRIJALBA. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 487. Vigente hasta 2026-06-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138422727', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "487", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2021", "fecha_fin": "2026-06-29", "presidente": "NIDIA YUBELY AVILA GRIJALBA", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-frenesi-487';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3138422727', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MARANTHA FUTBOL CLUB  (IDRD-CLUB-marantha-futbol-club-474)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-marantha-futbol-club-474';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MARANTHA FUTBOL CLUB',
      'Presidente: DIEGO FERNEY GONZALEZ FLORES. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 474. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3133885696',
      'diego_910610@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'marantha-futbol-club-474',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-marantha-futbol-club-474', v_school_id, '{"resolucion_rd": "474", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "DIEGO FERNEY GONZALEZ FLORES", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO FERNEY GONZALEZ FLORES. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 474. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133885696', phone),
      email       = COALESCE('diego_910610@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "474", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "DIEGO FERNEY GONZALEZ FLORES", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-marantha-futbol-club-474';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3133885696', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- UNIÃN CENTRAL EC  (IDRD-CLUB-unian-central-ec-513)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-unian-central-ec-513';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'UNIÃN CENTRAL EC',
      'Presidente: LUIS EDER CAÃON RIAÃO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 513. Vigente hasta 2026-07-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '7807491',
      'luiscanon56@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'unian-central-ec-513',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-unian-central-ec-513', v_school_id, '{"resolucion_rd": "513", "resolucion_actualizacion": null, "fecha_inicio": "09-07-2021", "fecha_fin": "2026-07-09", "presidente": "LUIS EDER CAÃON RIAÃO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS EDER CAÃON RIAÃO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 513. Vigente hasta 2026-07-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7807491', phone),
      email       = COALESCE('luiscanon56@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "513", "resolucion_actualizacion": null, "fecha_inicio": "09-07-2021", "fecha_fin": "2026-07-09", "presidente": "LUIS EDER CAÃON RIAÃO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-unian-central-ec-513';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '7807491', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALEMAN FC  (IDRD-CLUB-aleman-fc-510)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-aleman-fc-510';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALEMAN FC',
      'Presidente: EDILSON ROMERO BERNAL. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 510. Vigente hasta 2026-07-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3124738333',
      'alemanefd@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'aleman-fc-510',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-aleman-fc-510', v_school_id, '{"resolucion_rd": "510", "resolucion_actualizacion": null, "fecha_inicio": "12-07-2021", "fecha_fin": "2026-07-12", "presidente": "EDILSON ROMERO BERNAL", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDILSON ROMERO BERNAL. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 510. Vigente hasta 2026-07-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124738333', phone),
      email       = COALESCE('alemanefd@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "510", "resolucion_actualizacion": null, "fecha_inicio": "12-07-2021", "fecha_fin": "2026-07-12", "presidente": "EDILSON ROMERO BERNAL", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-aleman-fc-510';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3124738333', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MUSTANGS  (IDRD-CLUB-mustangs-551)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-mustangs-551';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MUSTANGS',
      'Presidente: MAURICIO AMADOR OSES. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 551. Vigente hasta 2026-07-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '314826363',
      'mao_amador@yahoo.es',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'mustangs-551',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-mustangs-551', v_school_id, '{"resolucion_rd": "551", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2021", "fecha_fin": "2026-07-19", "presidente": "MAURICIO AMADOR OSES", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAURICIO AMADOR OSES. Deporte(s): Voleibol. Localidad: Usaquén. Resolución R-D Nº 551. Vigente hasta 2026-07-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('314826363', phone),
      email       = COALESCE('mao_amador@yahoo.es', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "551", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2021", "fecha_fin": "2026-07-19", "presidente": "MAURICIO AMADOR OSES", "localidad": "Usaquén", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-mustangs-551';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '314826363', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL PUENTE ARANDA F.G.F.  (IDRD-CLUB-club-deportivo-real-puente-aranda-fgf-535)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-puente-aranda-fgf-535';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL PUENTE ARANDA F.G.F.',
      'Presidente: ANDRES SANTIAGO GAMBA ROA. Deporte(s): Discapacidad Visual. Localidad: Puente Aranda. Resolución R-D Nº 535 / actualización Nº 089. Vigente hasta 2026-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3134619299',
      'clubrealpuentearanda@gmail.com',
      ARRAY['Discapacidad Visual']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-puente-aranda-fgf-535',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-puente-aranda-fgf-535', v_school_id, '{"resolucion_rd": "535", "resolucion_actualizacion": "089", "fecha_inicio": "11-08-2021", "fecha_fin": "2026-08-11", "presidente": "ANDRES SANTIAGO GAMBA ROA", "localidad": "Puente Aranda", "sports": ["Discapacidad Visual"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES SANTIAGO GAMBA ROA. Deporte(s): Discapacidad Visual. Localidad: Puente Aranda. Resolución R-D Nº 535 / actualización Nº 089. Vigente hasta 2026-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134619299', phone),
      email       = COALESCE('clubrealpuentearanda@gmail.com', email),
      sports      = ARRAY['Discapacidad Visual']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "535", "resolucion_actualizacion": "089", "fecha_inicio": "11-08-2021", "fecha_fin": "2026-08-11", "presidente": "ANDRES SANTIAGO GAMBA ROA", "localidad": "Puente Aranda", "sports": ["Discapacidad Visual"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-puente-aranda-fgf-535';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3134619299', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CHAMPIONS TEAM BMX  (IDRD-CLUB-club-deportivo-champions-team-bmx-572)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-champions-team-bmx-572';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CHAMPIONS TEAM BMX',
      'Presidente: OSCAR GERARDO FRANCO GOMEZ. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 572. Vigente hasta 2026-07-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3142969028',
      'gerardofranco@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-champions-team-bmx-572',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-champions-team-bmx-572', v_school_id, '{"resolucion_rd": "572", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2021", "fecha_fin": "2026-07-26", "presidente": "OSCAR GERARDO FRANCO GOMEZ", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR GERARDO FRANCO GOMEZ. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 572. Vigente hasta 2026-07-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142969028', phone),
      email       = COALESCE('gerardofranco@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "572", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2021", "fecha_fin": "2026-07-26", "presidente": "OSCAR GERARDO FRANCO GOMEZ", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-champions-team-bmx-572';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3142969028', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TALADRO F.C.  (IDRD-CLUB-club-deportivo-taladro-fc-579)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taladro-fc-579';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TALADRO F.C.',
      'Presidente: WILMAR ANDRES LOPEZ GARZON. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 579 / actualización Nº 1684. Vigente hasta 2026-07-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3214814060',
      'clubdeportivotaladro@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taladro-fc-579',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taladro-fc-579', v_school_id, '{"resolucion_rd": "579", "resolucion_actualizacion": "1684", "fecha_inicio": "27-07-2021", "fecha_fin": "2026-07-27", "presidente": "WILMAR ANDRES LOPEZ GARZON", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILMAR ANDRES LOPEZ GARZON. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 579 / actualización Nº 1684. Vigente hasta 2026-07-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214814060', phone),
      email       = COALESCE('clubdeportivotaladro@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "579", "resolucion_actualizacion": "1684", "fecha_inicio": "27-07-2021", "fecha_fin": "2026-07-27", "presidente": "WILMAR ANDRES LOPEZ GARZON", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taladro-fc-579';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3214814060', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO OIKOS  (IDRD-CLUB-club-deportivo-oikos-571)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-oikos-571';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO OIKOS',
      'Presidente: JUANA VALENTINA DELGADO MIRANDA. Deporte(s): Patinaje, Fútbol. Localidad: Bosa. Resolución R-D Nº 571. Vigente hasta 2026-07-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3215221758',
      'delgadojuana1234@gmail.com',
      ARRAY['Patinaje','Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-oikos-571',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-oikos-571', v_school_id, '{"resolucion_rd": "571", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2021", "fecha_fin": "2026-07-26", "presidente": "JUANA VALENTINA DELGADO MIRANDA", "localidad": "Bosa", "sports": ["Patinaje", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUANA VALENTINA DELGADO MIRANDA. Deporte(s): Patinaje, Fútbol. Localidad: Bosa. Resolución R-D Nº 571. Vigente hasta 2026-07-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3215221758', phone),
      email       = COALESCE('delgadojuana1234@gmail.com', email),
      sports      = ARRAY['Patinaje','Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "571", "resolucion_actualizacion": null, "fecha_inicio": "26-07-2021", "fecha_fin": "2026-07-26", "presidente": "JUANA VALENTINA DELGADO MIRANDA", "localidad": "Bosa", "sports": ["Patinaje", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-oikos-571';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3215221758', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CARIBE SOY  (IDRD-CLUB-caribe-soy-563)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-caribe-soy-563';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CARIBE SOY',
      'Presidente: HERNANDO LUIS GARCÃA BARCO. Deporte(s): Softbol. Localidad: Engativá. Resolución R-D Nº 563. Vigente hasta 2026-07-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '4835802',
      'lugarsal@hotmail.com',
      ARRAY['Softbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'caribe-soy-563',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-caribe-soy-563', v_school_id, '{"resolucion_rd": "563", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2021", "fecha_fin": "2026-07-22", "presidente": "HERNANDO LUIS GARCÃA BARCO", "localidad": "Engativá", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HERNANDO LUIS GARCÃA BARCO. Deporte(s): Softbol. Localidad: Engativá. Resolución R-D Nº 563. Vigente hasta 2026-07-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4835802', phone),
      email       = COALESCE('lugarsal@hotmail.com', email),
      sports      = ARRAY['Softbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "563", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2021", "fecha_fin": "2026-07-22", "presidente": "HERNANDO LUIS GARCÃA BARCO", "localidad": "Engativá", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-caribe-soy-563';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '4835802', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BLACK RIVERS  (IDRD-CLUB-club-deportivo-black-rivers-654)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-black-rivers-654';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BLACK RIVERS',
      'Presidente: JAIME ANDRES ZIPAMOCHA RUBIO. Deporte(s): Fútbol de salón. Localidad: Barrios Unidos. Resolución R-D Nº 654. Vigente hasta 2026-08-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3058795933',
      'blclubdeportivo@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-black-rivers-654',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-black-rivers-654', v_school_id, '{"resolucion_rd": "654", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2021", "fecha_fin": "2026-08-27", "presidente": "JAIME ANDRES ZIPAMOCHA RUBIO", "localidad": "Barrios Unidos", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIME ANDRES ZIPAMOCHA RUBIO. Deporte(s): Fútbol de salón. Localidad: Barrios Unidos. Resolución R-D Nº 654. Vigente hasta 2026-08-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3058795933', phone),
      email       = COALESCE('blclubdeportivo@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "654", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2021", "fecha_fin": "2026-08-27", "presidente": "JAIME ANDRES ZIPAMOCHA RUBIO", "localidad": "Barrios Unidos", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-black-rivers-654';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3058795933', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL ACADEMIA FÃTBOL CAPITAL  (IDRD-CLUB-real-academia-fatbol-capital-644)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-academia-fatbol-capital-644';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL ACADEMIA FÃTBOL CAPITAL',
      'Presidente: JAVIER JESUS ORTIZ NAUFFAL. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 644. Vigente hasta 2026-08-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3204155552',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-academia-fatbol-capital-644',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-academia-fatbol-capital-644', v_school_id, '{"resolucion_rd": "644", "resolucion_actualizacion": null, "fecha_inicio": "23-08-2021", "fecha_fin": "2026-08-23", "presidente": "JAVIER JESUS ORTIZ NAUFFAL", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAVIER JESUS ORTIZ NAUFFAL. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 644. Vigente hasta 2026-08-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204155552', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "644", "resolucion_actualizacion": null, "fecha_inicio": "23-08-2021", "fecha_fin": "2026-08-23", "presidente": "JAVIER JESUS ORTIZ NAUFFAL", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-academia-fatbol-capital-644';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3204155552', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FENIX RACING BMX  (IDRD-CLUB-fenix-racing-bmx-589)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fenix-racing-bmx-589';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FENIX RACING BMX',
      'Presidente: JACOBO ISACC MAYORGA DURAN. Deporte(s): Ciclismo. Localidad: Puente Aranda. Resolución R-D Nº 589. Vigente hasta 2026-08-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3182161860',
      'jaisaac@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fenix-racing-bmx-589',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fenix-racing-bmx-589', v_school_id, '{"resolucion_rd": "589", "resolucion_actualizacion": null, "fecha_inicio": "02-08-2021", "fecha_fin": "2026-08-02", "presidente": "JACOBO ISACC MAYORGA DURAN", "localidad": "Puente Aranda", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JACOBO ISACC MAYORGA DURAN. Deporte(s): Ciclismo. Localidad: Puente Aranda. Resolución R-D Nº 589. Vigente hasta 2026-08-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3182161860', phone),
      email       = COALESCE('jaisaac@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "589", "resolucion_actualizacion": null, "fecha_inicio": "02-08-2021", "fecha_fin": "2026-08-02", "presidente": "JACOBO ISACC MAYORGA DURAN", "localidad": "Puente Aranda", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fenix-racing-bmx-589';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3182161860', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PATINAJE ARTISTICO HELMAN SKATE  (IDRD-CLUB-club-deportivo-de-patinaje-artistico-hel-1439)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-artistico-hel-1439';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PATINAJE ARTISTICO HELMAN SKATE',
      'Presidente: WILSON GILBERTO GONZALEZ BALLI. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1439. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3144066930',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-patinaje-artistico-hel-1439',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-patinaje-artistico-hel-1439', v_school_id, '{"resolucion_rd": "1439", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "WILSON GILBERTO GONZALEZ BALLI", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON GILBERTO GONZALEZ BALLI. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1439. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144066930', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1439", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "WILSON GILBERTO GONZALEZ BALLI", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-artistico-hel-1439';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3144066930', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPEED RIDER BOGOTA  (IDRD-CLUB-club-deportivo-speed-rider-bogota-661)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-speed-rider-bogota-661';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPEED RIDER BOGOTA',
      'Presidente: YEISON ANDRES BUSTOS OCHOA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 661. Vigente hasta 2026-08-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3142393432',
      'yeisonskate@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-speed-rider-bogota-661',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-speed-rider-bogota-661', v_school_id, '{"resolucion_rd": "661", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2021", "fecha_fin": "2026-08-30", "presidente": "YEISON ANDRES BUSTOS OCHOA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YEISON ANDRES BUSTOS OCHOA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 661. Vigente hasta 2026-08-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142393432', phone),
      email       = COALESCE('yeisonskate@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "661", "resolucion_actualizacion": null, "fecha_inicio": "30-08-2021", "fecha_fin": "2026-08-30", "presidente": "YEISON ANDRES BUSTOS OCHOA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-speed-rider-bogota-661';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3142393432', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RAMIREZ GACHA FC  (IDRD-CLUB-ramirez-gacha-fc-675)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ramirez-gacha-fc-675';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RAMIREZ GACHA FC',
      'Presidente: JAIR RAMIREZ GACHA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 675. Vigente hasta 2026-09-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3045647504',
      'jairramirez0@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ramirez-gacha-fc-675',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ramirez-gacha-fc-675', v_school_id, '{"resolucion_rd": "675", "resolucion_actualizacion": null, "fecha_inicio": "02-09-2021", "fecha_fin": "2026-09-02", "presidente": "JAIR RAMIREZ GACHA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIR RAMIREZ GACHA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 675. Vigente hasta 2026-09-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3045647504', phone),
      email       = COALESCE('jairramirez0@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "675", "resolucion_actualizacion": null, "fecha_inicio": "02-09-2021", "fecha_fin": "2026-09-02", "presidente": "JAIR RAMIREZ GACHA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ramirez-gacha-fc-675';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3045647504', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE LA EMPRESA VELOGROUP S.A.S.  (IDRD-CLUB-club-deportivo-de-la-empresa-velogroup-s-659)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-la-empresa-velogroup-s-659';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE LA EMPRESA VELOGROUP S.A.S.',
      'Presidente: JENNY BALLESTEROS BARACALDO. Deporte(s): Ciclismo. Localidad: Los Mártires. Resolución R-D Nº 659. Vigente hasta 2026-08-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3006511848',
      'vlelegroup75@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-la-empresa-velogroup-s-659',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-la-empresa-velogroup-s-659', v_school_id, '{"resolucion_rd": "659", "resolucion_actualizacion": null, "fecha_inicio": "03-08-2021", "fecha_fin": "2026-08-03", "presidente": "JENNY BALLESTEROS BARACALDO", "localidad": "Los Mártires", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNY BALLESTEROS BARACALDO. Deporte(s): Ciclismo. Localidad: Los Mártires. Resolución R-D Nº 659. Vigente hasta 2026-08-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006511848', phone),
      email       = COALESCE('vlelegroup75@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "659", "resolucion_actualizacion": null, "fecha_inicio": "03-08-2021", "fecha_fin": "2026-08-03", "presidente": "JENNY BALLESTEROS BARACALDO", "localidad": "Los Mártires", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-la-empresa-velogroup-s-659';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3006511848', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUERZA NATURAL ULTIMATE CLUB  (IDRD-CLUB-fuerza-natural-ultimate-club-750)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fuerza-natural-ultimate-club-750';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUERZA NATURAL ULTIMATE CLUB',
      'Presidente: ANA MARIA CARREÃO PINEDA. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 750 / actualización Nº 1551. Vigente hasta 2026-10-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3112953792',
      NULL,
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fuerza-natural-ultimate-club-750',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fuerza-natural-ultimate-club-750', v_school_id, '{"resolucion_rd": "750", "resolucion_actualizacion": "1551", "fecha_inicio": "08-10-2021", "fecha_fin": "2026-10-08", "presidente": "ANA MARIA CARREÃO PINEDA", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA MARIA CARREÃO PINEDA. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 750 / actualización Nº 1551. Vigente hasta 2026-10-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112953792', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "750", "resolucion_actualizacion": "1551", "fecha_inicio": "08-10-2021", "fecha_fin": "2026-10-08", "presidente": "ANA MARIA CARREÃO PINEDA", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fuerza-natural-ultimate-club-750';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3112953792', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LUC  (IDRD-CLUB-club-deportivo-luc-774)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-luc-774';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LUC',
      'Presidente: JAIME EDUARDO TRIANA SANCHEZ. Deporte(s): Ultimate. Localidad: Teusaquillo. Resolución R-D Nº 774. Vigente hasta 2026-09-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3186909309',
      'jaime.trian@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-luc-774',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-luc-774', v_school_id, '{"resolucion_rd": "774", "resolucion_actualizacion": null, "fecha_inicio": "30-09-2021", "fecha_fin": "2026-09-30", "presidente": "JAIME EDUARDO TRIANA SANCHEZ", "localidad": "Teusaquillo", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIME EDUARDO TRIANA SANCHEZ. Deporte(s): Ultimate. Localidad: Teusaquillo. Resolución R-D Nº 774. Vigente hasta 2026-09-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3186909309', phone),
      email       = COALESCE('jaime.trian@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "774", "resolucion_actualizacion": null, "fecha_inicio": "30-09-2021", "fecha_fin": "2026-09-30", "presidente": "JAIME EDUARDO TRIANA SANCHEZ", "localidad": "Teusaquillo", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-luc-774';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3186909309', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE TENIS ORDUZ  (IDRD-CLUB-club-de-tenis-orduz-752)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-tenis-orduz-752';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE TENIS ORDUZ',
      'Presidente: BLEYBER ALEJANDRO ORDUZ GARCÃA. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 752. Vigente hasta 2026-09-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3185411885',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-tenis-orduz-752',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-tenis-orduz-752', v_school_id, '{"resolucion_rd": "752", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2021", "fecha_fin": "2026-09-27", "presidente": "BLEYBER ALEJANDRO ORDUZ GARCÃA", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BLEYBER ALEJANDRO ORDUZ GARCÃA. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 752. Vigente hasta 2026-09-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3185411885', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "752", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2021", "fecha_fin": "2026-09-27", "presidente": "BLEYBER ALEJANDRO ORDUZ GARCÃA", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-tenis-orduz-752';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3185411885', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUUB DEPOTIVO TORINO  (IDRD-CLUB-cluub-depotivo-torino-988)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cluub-depotivo-torino-988';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUUB DEPOTIVO TORINO',
      'Presidente: JUAN ANDRÃâ°S SÃÂNCHEZ BARINAS. Deporte(s): Voleibol. Localidad: Fontibón. Resolución R-D Nº 988. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3186228934',
      'club.torino2025@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cluub-depotivo-torino-988',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cluub-depotivo-torino-988', v_school_id, '{"resolucion_rd": "988", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "JUAN ANDRÃâ°S SÃÂNCHEZ BARINAS", "localidad": "Fontibón", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN ANDRÃâ°S SÃÂNCHEZ BARINAS. Deporte(s): Voleibol. Localidad: Fontibón. Resolución R-D Nº 988. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3186228934', phone),
      email       = COALESCE('club.torino2025@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "988", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "JUAN ANDRÃâ°S SÃÂNCHEZ BARINAS", "localidad": "Fontibón", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cluub-depotivo-torino-988';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3186228934', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLETICO LEONES FOOTBALL CLUB  (IDRD-CLUB-club-deportivo-atletico-leones-football--1435)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletico-leones-football--1435';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLETICO LEONES FOOTBALL CLUB',
      'Presidente: CHRISTIAN LEONARDO LEON FAJARDO. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1435. Vigente hasta 2029-11-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3197041388',
      'leonesfcclubdeportivo@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atletico-leones-football--1435',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atletico-leones-football--1435', v_school_id, '{"resolucion_rd": "1435", "resolucion_actualizacion": null, "fecha_inicio": "07-11-2024", "fecha_fin": "2029-11-07", "presidente": "CHRISTIAN LEONARDO LEON FAJARDO", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CHRISTIAN LEONARDO LEON FAJARDO. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1435. Vigente hasta 2029-11-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3197041388', phone),
      email       = COALESCE('leonesfcclubdeportivo@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1435", "resolucion_actualizacion": null, "fecha_inicio": "07-11-2024", "fecha_fin": "2029-11-07", "presidente": "CHRISTIAN LEONARDO LEON FAJARDO", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletico-leones-football--1435';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3197041388', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FALCON  (IDRD-CLUB-club-deportivo-falcon-1508)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-falcon-1508';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FALCON',
      'Presidente: ANDRES MATEO GÃMEZ RAMOS. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1508. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3105671338',
      'falconfc1@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-falcon-1508',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-falcon-1508', v_school_id, '{"resolucion_rd": "1508", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "ANDRES MATEO GÃMEZ RAMOS", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES MATEO GÃMEZ RAMOS. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1508. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105671338', phone),
      email       = COALESCE('falconfc1@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1508", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "ANDRES MATEO GÃMEZ RAMOS", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-falcon-1508';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3105671338', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA BARCA  (IDRD-CLUB-club-deportivo-la-barca-1735)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-barca-1735';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA BARCA',
      'Presidente: CARLOS ANDRES CAJAMARCA MEDINA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1735. Vigente hasta 2029-12-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3208814227',
      'escueladeportivalabarca@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-barca-1735',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-barca-1735', v_school_id, '{"resolucion_rd": "1735", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2024", "fecha_fin": "2029-12-27", "presidente": "CARLOS ANDRES CAJAMARCA MEDINA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRES CAJAMARCA MEDINA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1735. Vigente hasta 2029-12-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208814227', phone),
      email       = COALESCE('escueladeportivalabarca@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1735", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2024", "fecha_fin": "2029-12-27", "presidente": "CARLOS ANDRES CAJAMARCA MEDINA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-barca-1735';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3208814227', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CELTIP FC  (IDRD-CLUB-club-deportivo-celtip-fc-986)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-celtip-fc-986';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CELTIP FC',
      'Presidente: EDISON FABIAN PEDRAZA CETINA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 986. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3204199699',
      'celtipfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-celtip-fc-986',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-celtip-fc-986', v_school_id, '{"resolucion_rd": "986", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "EDISON FABIAN PEDRAZA CETINA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDISON FABIAN PEDRAZA CETINA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 986. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204199699', phone),
      email       = COALESCE('celtipfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "986", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "EDISON FABIAN PEDRAZA CETINA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-celtip-fc-986';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3204199699', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- IMPETU PATINAJE ARTISTICO  (IDRD-CLUB-impetu-patinaje-artistico-181)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-impetu-patinaje-artistico-181';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'IMPETU PATINAJE ARTISTICO',
      'Presidente: JUAN SEBASTIAN OSPINA DIAZ. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 181 / actualización Nº 968. Vigente hasta 2028-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3195643427',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'impetu-patinaje-artistico-181',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-impetu-patinaje-artistico-181', v_school_id, '{"resolucion_rd": "181", "resolucion_actualizacion": "968", "fecha_inicio": "03-03-2023", "fecha_fin": "2028-03-02", "presidente": "JUAN SEBASTIAN OSPINA DIAZ", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIAN OSPINA DIAZ. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 181 / actualización Nº 968. Vigente hasta 2028-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195643427', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "181", "resolucion_actualizacion": "968", "fecha_inicio": "03-03-2023", "fecha_fin": "2028-03-02", "presidente": "JUAN SEBASTIAN OSPINA DIAZ", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-impetu-patinaje-artistico-181';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3195643427', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DYNASTY SKATERS  (IDRD-CLUB-club-deportivo-dynasty-skaters-1264)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dynasty-skaters-1264';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DYNASTY SKATERS',
      'Presidente: JOSÃ ALEJANDRO VELASCO GARCIA. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1264. Vigente hasta 2029-09-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3002614272',
      'dynastyskatersclub@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dynasty-skaters-1264',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dynasty-skaters-1264', v_school_id, '{"resolucion_rd": "1264", "resolucion_actualizacion": null, "fecha_inicio": "17-09-2024", "fecha_fin": "2029-09-17", "presidente": "JOSÃ ALEJANDRO VELASCO GARCIA", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ ALEJANDRO VELASCO GARCIA. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1264. Vigente hasta 2029-09-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002614272', phone),
      email       = COALESCE('dynastyskatersclub@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1264", "resolucion_actualizacion": null, "fecha_inicio": "17-09-2024", "fecha_fin": "2029-09-17", "presidente": "JOSÃ ALEJANDRO VELASCO GARCIA", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dynasty-skaters-1264';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3002614272', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EMPRESARIAL DOLPHINS GYM  (IDRD-CLUB-club-deportivo-empresarial-dolphins-gym-275)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-empresarial-dolphins-gym-275';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EMPRESARIAL DOLPHINS GYM',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Tenis, Taekwondo, Patinaje, Fútbol, Natación. Localidad: Fontibón. Resolución R-D Nº 275. Vigente hasta 2030-03-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3159283512',
      'dolphinsgymclub@gmail.com',
      ARRAY['Tenis','Taekwondo','Patinaje','Fútbol','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-empresarial-dolphins-gym-275',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-empresarial-dolphins-gym-275', v_school_id, '{"resolucion_rd": "275", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2025", "fecha_fin": "2030-03-31", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Fontibón", "sports": ["Tenis", "Taekwondo", "Patinaje", "Fútbol", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Tenis, Taekwondo, Patinaje, Fútbol, Natación. Localidad: Fontibón. Resolución R-D Nº 275. Vigente hasta 2030-03-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3159283512', phone),
      email       = COALESCE('dolphinsgymclub@gmail.com', email),
      sports      = ARRAY['Tenis','Taekwondo','Patinaje','Fútbol','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "275", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2025", "fecha_fin": "2030-03-31", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Fontibón", "sports": ["Tenis", "Taekwondo", "Patinaje", "Fútbol", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-empresarial-dolphins-gym-275';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3159283512', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DAN DE KARATE DO  (IDRD-CLUB-club-deportivo-dan-de-karate-do-1216)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dan-de-karate-do-1216';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DAN DE KARATE DO',
      'Presidente: YANED QUINTANA DUCÃN. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 1216. Vigente hasta 2029-09-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3045231587',
      'clubdan@gmail.com',
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dan-de-karate-do-1216',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dan-de-karate-do-1216', v_school_id, '{"resolucion_rd": "1216", "resolucion_actualizacion": null, "fecha_inicio": "04-09-2024", "fecha_fin": "2029-09-04", "presidente": "YANED QUINTANA DUCÃN", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YANED QUINTANA DUCÃN. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 1216. Vigente hasta 2029-09-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3045231587', phone),
      email       = COALESCE('clubdan@gmail.com', email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1216", "resolucion_actualizacion": null, "fecha_inicio": "04-09-2024", "fecha_fin": "2029-09-04", "presidente": "YANED QUINTANA DUCÃN", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dan-de-karate-do-1216';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3045231587', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BEGINNERS JOSEPH  (IDRD-CLUB-club-deportivo-beginners-joseph-057)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-beginners-joseph-057';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BEGINNERS JOSEPH',
      'Presidente: JHON JAIRO ARROYAVE PINEDA. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 057. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3154658945',
      'beginnersjoseph@hotmmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-beginners-joseph-057',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-beginners-joseph-057', v_school_id, '{"resolucion_rd": "057", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JHON JAIRO ARROYAVE PINEDA", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON JAIRO ARROYAVE PINEDA. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 057. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3154658945', phone),
      email       = COALESCE('beginnersjoseph@hotmmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "057", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JHON JAIRO ARROYAVE PINEDA", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-beginners-joseph-057';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3154658945', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PATIN C.A.F.  (IDRD-CLUB-club-deportivo-patin-caf-037-2)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-patin-caf-037-2';
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
      'josereyes_10@msn.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-patin-caf-037',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-patin-caf-037-2', v_school_id, '{"resolucion_rd": "037", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JOSE LUIS REYES RODRIGUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS REYES RODRIGUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 037. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124556183', phone),
      email       = COALESCE('josereyes_10@msn.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "037", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JOSE LUIS REYES RODRIGUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-patin-caf-037-2';
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
-- CLUB DEPORTIVO AGUAS & VELOCIDAD  (IDRD-CLUB-club-deportivo-aguas-velocidad-355)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-aguas-velocidad-355';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AGUAS & VELOCIDAD',
      'Presidente: JEISSON RAMIREZ ROZO. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 355. Vigente hasta 2030-04-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3134360072',
      'clubdeportivoaguasyvelocidadra@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-aguas-velocidad-355',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-aguas-velocidad-355', v_school_id, '{"resolucion_rd": "355", "resolucion_actualizacion": null, "fecha_inicio": "22-04-2025", "fecha_fin": "2030-04-22", "presidente": "JEISSON RAMIREZ ROZO", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISSON RAMIREZ ROZO. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 355. Vigente hasta 2030-04-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134360072', phone),
      email       = COALESCE('clubdeportivoaguasyvelocidadra@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "355", "resolucion_actualizacion": null, "fecha_inicio": "22-04-2025", "fecha_fin": "2030-04-22", "presidente": "JEISSON RAMIREZ ROZO", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-aguas-velocidad-355';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3134360072', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KELLY MARTINEZ  (IDRD-CLUB-club-deportivo-kelly-martinez-059)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kelly-martinez-059';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KELLY MARTINEZ',
      'Presidente: ALEX ALFREDO GUZMÃN MARTÃNEZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 059. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3092237311',
      'xime743@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kelly-martinez-059',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kelly-martinez-059', v_school_id, '{"resolucion_rd": "059", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "ALEX ALFREDO GUZMÃN MARTÃNEZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEX ALFREDO GUZMÃN MARTÃNEZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 059. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3092237311', phone),
      email       = COALESCE('xime743@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "059", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "ALEX ALFREDO GUZMÃN MARTÃNEZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kelly-martinez-059';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3092237311', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CREATUS  (IDRD-CLUB-club-deportivo-creatus-1146)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-creatus-1146';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CREATUS',
      'Presidente: DUVAN FELIPE ACOSTA CORREDOR. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 1146. Vigente hasta 2029-08-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '47439253208459350',
      'creatus.sport@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-creatus-1146',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-creatus-1146', v_school_id, '{"resolucion_rd": "1146", "resolucion_actualizacion": null, "fecha_inicio": "09-08-2024", "fecha_fin": "2029-08-09", "presidente": "DUVAN FELIPE ACOSTA CORREDOR", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DUVAN FELIPE ACOSTA CORREDOR. Deporte(s): Ultimate. Localidad: Suba. Resolución R-D Nº 1146. Vigente hasta 2029-08-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('47439253208459350', phone),
      email       = COALESCE('creatus.sport@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1146", "resolucion_actualizacion": null, "fecha_inicio": "09-08-2024", "fecha_fin": "2029-08-09", "presidente": "DUVAN FELIPE ACOSTA CORREDOR", "localidad": "Suba", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-creatus-1146';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '47439253208459350', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FOX SOCCER  (IDRD-CLUB-club-deportivo-fox-soccer-78.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fox-soccer-78.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FOX SOCCER',
      'Presidente: JOSÃ DAVID SANCHEZ VARGAS. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 78.0 / actualización Nº N/A. Vigente hasta 2029-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3124583888',
      'foxfc23@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fox-soccer-78.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fox-soccer-78.0', v_school_id, '{"resolucion_rd": "78.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-07", "fecha_fin": "2029-02-07", "presidente": "JOSÃ DAVID SANCHEZ VARGAS", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ DAVID SANCHEZ VARGAS. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 78.0 / actualización Nº N/A. Vigente hasta 2029-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124583888', phone),
      email       = COALESCE('foxfc23@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "78.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-07", "fecha_fin": "2029-02-07", "presidente": "JOSÃ DAVID SANCHEZ VARGAS", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fox-soccer-78.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3124583888', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SOUTH WINGS BOGOTÃ  (IDRD-CLUB-club-deportivo-south-wings-bogota-79.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-south-wings-bogota-79.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SOUTH WINGS BOGOTÃ',
      'Presidente: LUIS ALBERTO SALGADO CARVAJAL. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 79.0 / actualización Nº N/A. Vigente hasta 2029-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '6018007845',
      'lucho_9307@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-south-wings-bogota-79.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-south-wings-bogota-79.0', v_school_id, '{"resolucion_rd": "79.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-07", "fecha_fin": "2029-02-07", "presidente": "LUIS ALBERTO SALGADO CARVAJAL", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALBERTO SALGADO CARVAJAL. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 79.0 / actualización Nº N/A. Vigente hasta 2029-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6018007845', phone),
      email       = COALESCE('lucho_9307@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "79.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-07", "fecha_fin": "2029-02-07", "presidente": "LUIS ALBERTO SALGADO CARVAJAL", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-south-wings-bogota-79.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '6018007845', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TOTAL FOOTBALL  (IDRD-CLUB-club-deportivo-total-football-1106)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-total-football-1106';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TOTAL FOOTBALL',
      'Presidente: JIMY ALEXANDER VARGAS ALARCON. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1106. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3102685201',
      'jimmyvargas30@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-total-football-1106',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-total-football-1106', v_school_id, '{"resolucion_rd": "1106", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "JIMY ALEXANDER VARGAS ALARCON", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JIMY ALEXANDER VARGAS ALARCON. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1106. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102685201', phone),
      email       = COALESCE('jimmyvargas30@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1106", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "JIMY ALEXANDER VARGAS ALARCON", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-total-football-1106';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3102685201', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FORJANDO FUTURO BOGOTÃ F.C.  (IDRD-CLUB-club-deportivo-forjando-futuro-bogota-fc-1261)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-forjando-futuro-bogota-fc-1261';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FORJANDO FUTURO BOGOTÃ F.C.',
      'Presidente: VICTOR HUGO PERALTA MORALES. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1261. Vigente hasta 2029-11-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3142743515',
      'forjandofuturobogotafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-forjando-futuro-bogota-fc-1261',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-forjando-futuro-bogota-fc-1261', v_school_id, '{"resolucion_rd": "1261", "resolucion_actualizacion": null, "fecha_inicio": "19-11-2024", "fecha_fin": "2029-11-19", "presidente": "VICTOR HUGO PERALTA MORALES", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR HUGO PERALTA MORALES. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1261. Vigente hasta 2029-11-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142743515', phone),
      email       = COALESCE('forjandofuturobogotafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1261", "resolucion_actualizacion": null, "fecha_inicio": "19-11-2024", "fecha_fin": "2029-11-19", "presidente": "VICTOR HUGO PERALTA MORALES", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-forjando-futuro-bogota-fc-1261';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3142743515', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLETICK FORCE  (IDRD-CLUB-club-deportivo-atletick-force-1477)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletick-force-1477';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLETICK FORCE',
      'Presidente: CRISTHIAN CAMILO RUBIO RODRÃGUEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1477. Vigente hasta 2029-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3174362586',
      'cristhianrubio07@hotmail.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atletick-force-1477',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atletick-force-1477', v_school_id, '{"resolucion_rd": "1477", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2024", "fecha_fin": "2029-10-28", "presidente": "CRISTHIAN CAMILO RUBIO RODRÃGUEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTHIAN CAMILO RUBIO RODRÃGUEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1477. Vigente hasta 2029-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174362586', phone),
      email       = COALESCE('cristhianrubio07@hotmail.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1477", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2024", "fecha_fin": "2029-10-28", "presidente": "CRISTHIAN CAMILO RUBIO RODRÃGUEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletick-force-1477';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3174362586', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KURASH LEOPARDO  (IDRD-CLUB-club-deportivo-kurash-leopardo-1146)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kurash-leopardo-1146';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KURASH LEOPARDO',
      'Presidente: CESAR AUGUSTO ROZO BRICEÃâO. Deporte(s): Kurash. Localidad: Engativá. Resolución R-D Nº 1146. Vigente hasta 2030-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3112182707',
      'kurashleopardo1958@hotmail.com',
      ARRAY['Kurash']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kurash-leopardo-1146',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kurash-leopardo-1146', v_school_id, '{"resolucion_rd": "1146", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2025", "fecha_fin": "2030-10-20", "presidente": "CESAR AUGUSTO ROZO BRICEÃâO", "localidad": "Engativá", "sports": ["Kurash"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR AUGUSTO ROZO BRICEÃâO. Deporte(s): Kurash. Localidad: Engativá. Resolución R-D Nº 1146. Vigente hasta 2030-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112182707', phone),
      email       = COALESCE('kurashleopardo1958@hotmail.com', email),
      sports      = ARRAY['Kurash']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1146", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2025", "fecha_fin": "2030-10-20", "presidente": "CESAR AUGUSTO ROZO BRICEÃâO", "localidad": "Engativá", "sports": ["Kurash"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kurash-leopardo-1146';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3112182707', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PRADO FC SAS  (IDRD-CLUB-club-deportivo-prado-fc-sas-1144)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-prado-fc-sas-1144';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PRADO FC SAS',
      'Presidente: JOHN WILMAR ABRIL ABRIL. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1144. Vigente hasta 2030-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3208500095',
      'pradofc8@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-prado-fc-sas-1144',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-prado-fc-sas-1144', v_school_id, '{"resolucion_rd": "1144", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2025", "fecha_fin": "2030-10-20", "presidente": "JOHN WILMAR ABRIL ABRIL", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN WILMAR ABRIL ABRIL. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1144. Vigente hasta 2030-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208500095', phone),
      email       = COALESCE('pradofc8@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1144", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2025", "fecha_fin": "2030-10-20", "presidente": "JOHN WILMAR ABRIL ABRIL", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-prado-fc-sas-1144';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3208500095', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE SOFTBALL DE LOS EMPLEADOS DEL CONGRESO DE LA REPUBLICA  (IDRD-CLUB-club-de-softball-de-los-empleados-del-co-308)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-softball-de-los-empleados-del-co-308';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE SOFTBALL DE LOS EMPLEADOS DEL CONGRESO DE LA REPUBLICA',
      'Presidente: EDWIN CARREAZO GOMEZ. Deporte(s): Softbol. Localidad: La Candelaria. Resolución R-D Nº 308. Vigente hasta 2028-04-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'La Candelaria',
      '3114748686',
      'donado@hotmail.com',
      ARRAY['Softbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-softball-de-los-empleados-del-co-308',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-softball-de-los-empleados-del-co-308', v_school_id, '{"resolucion_rd": "308", "resolucion_actualizacion": null, "fecha_inicio": "11-04-2023", "fecha_fin": "2028-04-10", "presidente": "EDWIN CARREAZO GOMEZ", "localidad": "La Candelaria", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN CARREAZO GOMEZ. Deporte(s): Softbol. Localidad: La Candelaria. Resolución R-D Nº 308. Vigente hasta 2028-04-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114748686', phone),
      email       = COALESCE('donado@hotmail.com', email),
      sports      = ARRAY['Softbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "308", "resolucion_actualizacion": null, "fecha_inicio": "11-04-2023", "fecha_fin": "2028-04-10", "presidente": "EDWIN CARREAZO GOMEZ", "localidad": "La Candelaria", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-softball-de-los-empleados-del-co-308';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'La Candelaria', 'Bogotá', '3114748686', 4.6843605, -74.0511562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CMB CHECHY BAENA  (IDRD-CLUB-club-deportivo-cmb-chechy-baena-1490)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cmb-chechy-baena-1490';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CMB CHECHY BAENA',
      'Presidente: YORLENI NIÃO GONZALEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1490. Vigente hasta 2029-10-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3224596426',
      'clubcmbchechybaena@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cmb-chechy-baena-1490',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cmb-chechy-baena-1490', v_school_id, '{"resolucion_rd": "1490", "resolucion_actualizacion": null, "fecha_inicio": "30-10-2024", "fecha_fin": "2029-10-30", "presidente": "YORLENI NIÃO GONZALEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YORLENI NIÃO GONZALEZ. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1490. Vigente hasta 2029-10-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3224596426', phone),
      email       = COALESCE('clubcmbchechybaena@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1490", "resolucion_actualizacion": null, "fecha_inicio": "30-10-2024", "fecha_fin": "2029-10-30", "presidente": "YORLENI NIÃO GONZALEZ", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cmb-chechy-baena-1490';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3224596426', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CIREC  (IDRD-CLUB-club-deportivo-cirec-032)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cirec-032';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CIREC',
      'Presidente: DANIEL ANDRES GOMEZ PERICO RAMIREZ. Deporte(s): Badminton, Discapacidad Fã­Sica, Voleibol Sentado, Tenis de mesa, Goalball, Judo Visuales, Billar Fã­Sicos, Ajedrez Fã­Sicos, Esgrima En Silla De Ruedas, Tenis, Para Atletismo, Paranataciã³N, Rugby En Silla De Ruedas, Baloncesto En Silla De Ruedas, Triatlon, Para Powerlifting, Ciclismo, Bowling, Ajedrez Visuales, Futbol 5. Localidad: Barrios Unidos. Resolución R-D Nº 032. Vigente hasta 2031-01-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '6017953600',
      'clubdeportivo@cirec.org',
      ARRAY['Badminton','Discapacidad Fã­Sica','Voleibol Sentado','Tenis de mesa','Goalball','Judo Visuales','Billar Fã­Sicos','Ajedrez Fã­Sicos','Esgrima En Silla De Ruedas','Tenis','Para Atletismo','Paranataciã³N','Rugby En Silla De Ruedas','Baloncesto En Silla De Ruedas','Triatlon','Para Powerlifting','Ciclismo','Bowling','Ajedrez Visuales','Futbol 5']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cirec-032',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cirec-032', v_school_id, '{"resolucion_rd": "032", "resolucion_actualizacion": null, "fecha_inicio": "23-01-2026", "fecha_fin": "2031-01-23", "presidente": "DANIEL ANDRES GOMEZ PERICO RAMIREZ", "localidad": "Barrios Unidos", "sports": ["Badminton", "Discapacidad Fã­Sica", "Voleibol Sentado", "Tenis de mesa", "Goalball", "Judo Visuales", "Billar Fã­Sicos", "Ajedrez Fã­Sicos", "Esgrima En Silla De Ruedas", "Tenis", "Para Atletismo", "Paranataciã³N", "Rugby En Silla De Ruedas", "Baloncesto En Silla De Ruedas", "Triatlon", "Para Powerlifting", "Ciclismo", "Bowling", "Ajedrez Visuales", "Futbol 5"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL ANDRES GOMEZ PERICO RAMIREZ. Deporte(s): Badminton, Discapacidad Fã­Sica, Voleibol Sentado, Tenis de mesa, Goalball, Judo Visuales, Billar Fã­Sicos, Ajedrez Fã­Sicos, Esgrima En Silla De Ruedas, Tenis, Para Atletismo, Paranataciã³N, Rugby En Silla De Ruedas, Baloncesto En Silla De Ruedas, Triatlon, Para Powerlifting, Ciclismo, Bowling, Ajedrez Visuales, Futbol 5. Localidad: Barrios Unidos. Resolución R-D Nº 032. Vigente hasta 2031-01-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6017953600', phone),
      email       = COALESCE('clubdeportivo@cirec.org', email),
      sports      = ARRAY['Badminton','Discapacidad Fã­Sica','Voleibol Sentado','Tenis de mesa','Goalball','Judo Visuales','Billar Fã­Sicos','Ajedrez Fã­Sicos','Esgrima En Silla De Ruedas','Tenis','Para Atletismo','Paranataciã³N','Rugby En Silla De Ruedas','Baloncesto En Silla De Ruedas','Triatlon','Para Powerlifting','Ciclismo','Bowling','Ajedrez Visuales','Futbol 5']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "032", "resolucion_actualizacion": null, "fecha_inicio": "23-01-2026", "fecha_fin": "2031-01-23", "presidente": "DANIEL ANDRES GOMEZ PERICO RAMIREZ", "localidad": "Barrios Unidos", "sports": ["Badminton", "Discapacidad Fã­Sica", "Voleibol Sentado", "Tenis de mesa", "Goalball", "Judo Visuales", "Billar Fã­Sicos", "Ajedrez Fã­Sicos", "Esgrima En Silla De Ruedas", "Tenis", "Para Atletismo", "Paranataciã³N", "Rugby En Silla De Ruedas", "Baloncesto En Silla De Ruedas", "Triatlon", "Para Powerlifting", "Ciclismo", "Bowling", "Ajedrez Visuales", "Futbol 5"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cirec-032';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '6017953600', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TALENTO SPORT  (IDRD-CLUB-club-deportivo-talento-sport-861)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-talento-sport-861';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TALENTO SPORT',
      'Presidente: GEOVANNI PONTON GOMEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 861. Vigente hasta 2026-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '4936590',
      'cdtalentosportbogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-talento-sport-861',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-talento-sport-861', v_school_id, '{"resolucion_rd": "861", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2021", "fecha_fin": "2026-10-20", "presidente": "GEOVANNI PONTON GOMEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GEOVANNI PONTON GOMEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 861. Vigente hasta 2026-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4936590', phone),
      email       = COALESCE('cdtalentosportbogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "861", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2021", "fecha_fin": "2026-10-20", "presidente": "GEOVANNI PONTON GOMEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-talento-sport-861';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '4936590', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EN ZONA  (IDRD-CLUB-club-deportivo-en-zona-798)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-en-zona-798';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EN ZONA',
      'Presidente: LUIS ALBERTO SOSA GARCIA. Deporte(s): Voleibol. Resolución R-D Nº 798. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3043275369',
      'clubenzona@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-en-zona-798',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-en-zona-798', v_school_id, '{"resolucion_rd": "798", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "LUIS ALBERTO SOSA GARCIA", "localidad": null, "sports": ["Voleibol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALBERTO SOSA GARCIA. Deporte(s): Voleibol. Resolución R-D Nº 798. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043275369', phone),
      email       = COALESCE('clubenzona@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "798", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "LUIS ALBERTO SOSA GARCIA", "localidad": null, "sports": ["Voleibol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-en-zona-798';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- SPORT BACATA  (IDRD-CLUB-sport-bacata-797)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sport-bacata-797';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPORT BACATA',
      'Presidente: LEIDY CAROLINA ORDOÃEZ MEDINA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 797. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '9027688',
      'anilorac1896@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sport-bacata-797',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sport-bacata-797', v_school_id, '{"resolucion_rd": "797", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "LEIDY CAROLINA ORDOÃEZ MEDINA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEIDY CAROLINA ORDOÃEZ MEDINA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 797. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('9027688', phone),
      email       = COALESCE('anilorac1896@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "797", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "LEIDY CAROLINA ORDOÃEZ MEDINA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sport-bacata-797';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '9027688', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- QUETZAL VOLLEY CLUB  (IDRD-CLUB-quetzal-volley-club-799)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-quetzal-volley-club-799';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'QUETZAL VOLLEY CLUB',
      'Presidente: ROGER ALEXIS GUTIERREZ OSORIO. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 799. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3013884788',
      'rogervoley25@hotmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'quetzal-volley-club-799',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-quetzal-volley-club-799', v_school_id, '{"resolucion_rd": "799", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "ROGER ALEXIS GUTIERREZ OSORIO", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROGER ALEXIS GUTIERREZ OSORIO. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 799. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013884788', phone),
      email       = COALESCE('rogervoley25@hotmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "799", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "ROGER ALEXIS GUTIERREZ OSORIO", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-quetzal-volley-club-799';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3013884788', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COLOMBO FRANCES SAVATE  (IDRD-CLUB-colombo-frances-savate-822)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-colombo-frances-savate-822';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COLOMBO FRANCES SAVATE',
      'Presidente: JOHANNA KATHERINE MERLO MUÃOZ. Deporte(s): Savate. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 822. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3144454996',
      'johanna8507@gmail.com',
      ARRAY['Savate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'colombo-frances-savate-822',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-colombo-frances-savate-822', v_school_id, '{"resolucion_rd": "822", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "JOHANNA KATHERINE MERLO MUÃOZ", "localidad": "Rafael Uribe Uribe", "sports": ["Savate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANNA KATHERINE MERLO MUÃOZ. Deporte(s): Savate. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 822. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144454996', phone),
      email       = COALESCE('johanna8507@gmail.com', email),
      sports      = ARRAY['Savate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "822", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "JOHANNA KATHERINE MERLO MUÃOZ", "localidad": "Rafael Uribe Uribe", "sports": ["Savate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-colombo-frances-savate-822';
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
-- CLUB DEPORTIVO IRIS  (IDRD-CLUB-club-deportivo-iris-828)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-iris-828';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO IRIS',
      'Presidente: WILDER ANDRES GUERRERO HURTADO. Deporte(s): Orientaciã³N. Localidad: Fontibón. Resolución R-D Nº 828. Vigente hasta 2026-10-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '4409352',
      NULL,
      ARRAY['Orientaciã³N']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-iris-828',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-iris-828', v_school_id, '{"resolucion_rd": "828", "resolucion_actualizacion": null, "fecha_inicio": "13-10-2021", "fecha_fin": "2026-10-13", "presidente": "WILDER ANDRES GUERRERO HURTADO", "localidad": "Fontibón", "sports": ["Orientaciã³N"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILDER ANDRES GUERRERO HURTADO. Deporte(s): Orientaciã³N. Localidad: Fontibón. Resolución R-D Nº 828. Vigente hasta 2026-10-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4409352', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Orientaciã³N']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "828", "resolucion_actualizacion": null, "fecha_inicio": "13-10-2021", "fecha_fin": "2026-10-13", "presidente": "WILDER ANDRES GUERRERO HURTADO", "localidad": "Fontibón", "sports": ["Orientaciã³N"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-iris-828';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '4409352', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- EAGLES FS  (IDRD-CLUB-eagles-fs-820)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-eagles-fs-820';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'EAGLES FS',
      'Presidente: CARLOS ALBERTO RESTREPO GOMEZ. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 820. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3215696774',
      'eaglesformaciondeportiva@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'eagles-fs-820',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-eagles-fs-820', v_school_id, '{"resolucion_rd": "820", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "CARLOS ALBERTO RESTREPO GOMEZ", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALBERTO RESTREPO GOMEZ. Deporte(s): Fútbol de salón. Localidad: Suba. Resolución R-D Nº 820. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3215696774', phone),
      email       = COALESCE('eaglesformaciondeportiva@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "820", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "CARLOS ALBERTO RESTREPO GOMEZ", "localidad": "Suba", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-eagles-fs-820';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3215696774', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL COLINA  (IDRD-CLUB-real-colina-800)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-colina-800';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL COLINA',
      'Presidente: JOHAN YEZID PAEZ SANCHEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 800. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '9347363',
      'yohanyesid-10@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-colina-800',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-colina-800', v_school_id, '{"resolucion_rd": "800", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "JOHAN YEZID PAEZ SANCHEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHAN YEZID PAEZ SANCHEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 800. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('9347363', phone),
      email       = COALESCE('yohanyesid-10@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "800", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "JOHAN YEZID PAEZ SANCHEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-colina-800';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '9347363', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CRT BOGOTA  (IDRD-CLUB-crt-bogota-821)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-crt-bogota-821';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CRT BOGOTA',
      'Presidente: JEFERSON SANTOS ALFONSO. Deporte(s): Natación. Localidad: Engativá. Resolución R-D Nº 821. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3112168935',
      'crtdeportes@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'crt-bogota-821',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-crt-bogota-821', v_school_id, '{"resolucion_rd": "821", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "JEFERSON SANTOS ALFONSO", "localidad": "Engativá", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEFERSON SANTOS ALFONSO. Deporte(s): Natación. Localidad: Engativá. Resolución R-D Nº 821. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112168935', phone),
      email       = COALESCE('crtdeportes@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "821", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "JEFERSON SANTOS ALFONSO", "localidad": "Engativá", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-crt-bogota-821';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3112168935', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BACATA TAEKWONDO CLUB  (IDRD-CLUB-bacata-taekwondo-club-824)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bacata-taekwondo-club-824';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BACATA TAEKWONDO CLUB',
      'Presidente: JANNIE LEON. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 824. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3187957153',
      'jannie801103@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bacata-taekwondo-club-824',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bacata-taekwondo-club-824', v_school_id, '{"resolucion_rd": "824", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "JANNIE LEON", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JANNIE LEON. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 824. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187957153', phone),
      email       = COALESCE('jannie801103@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "824", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "JANNIE LEON", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bacata-taekwondo-club-824';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3187957153', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JHONATEX FUTSAL CLUB  (IDRD-CLUB-jhonatex-futsal-club-806)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jhonatex-futsal-club-806';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JHONATEX FUTSAL CLUB',
      'Presidente: CESAR GIOVANNY RUEDA. Deporte(s): Fútbol de salón. Localidad: Engativá. Resolución R-D Nº 806. Vigente hasta 2026-10-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3012535647',
      'jhonatex1011@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jhonatex-futsal-club-806',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jhonatex-futsal-club-806', v_school_id, '{"resolucion_rd": "806", "resolucion_actualizacion": null, "fecha_inicio": "08-10-2021", "fecha_fin": "2026-10-08", "presidente": "CESAR GIOVANNY RUEDA", "localidad": "Engativá", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR GIOVANNY RUEDA. Deporte(s): Fútbol de salón. Localidad: Engativá. Resolución R-D Nº 806. Vigente hasta 2026-10-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012535647', phone),
      email       = COALESCE('jhonatex1011@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "806", "resolucion_actualizacion": null, "fecha_inicio": "08-10-2021", "fecha_fin": "2026-10-08", "presidente": "CESAR GIOVANNY RUEDA", "localidad": "Engativá", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jhonatex-futsal-club-806';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3012535647', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COLOSO  (IDRD-CLUB-coloso-823)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-coloso-823';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COLOSO',
      'Presidente: OSWALDO RAMIRO KARO AMAYA. Deporte(s): Softbol. Localidad: Fontibón. Resolución R-D Nº 823. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3136134773',
      'oswaldokaroamaya@gmail.com',
      ARRAY['Softbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'coloso-823',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-coloso-823', v_school_id, '{"resolucion_rd": "823", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "OSWALDO RAMIRO KARO AMAYA", "localidad": "Fontibón", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSWALDO RAMIRO KARO AMAYA. Deporte(s): Softbol. Localidad: Fontibón. Resolución R-D Nº 823. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3136134773', phone),
      email       = COALESCE('oswaldokaroamaya@gmail.com', email),
      sports      = ARRAY['Softbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "823", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "OSWALDO RAMIRO KARO AMAYA", "localidad": "Fontibón", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-coloso-823';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3136134773', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ACADEMIA BOGOTANA FC  (IDRD-CLUB-academia-bogotana-fc-855)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-academia-bogotana-fc-855';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ACADEMIA BOGOTANA FC',
      'Presidente: ENZO ALEXIS PRADA SALGADO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 855. Vigente hasta 2026-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3224332509',
      'alexis1565@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'academia-bogotana-fc-855',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-academia-bogotana-fc-855', v_school_id, '{"resolucion_rd": "855", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2021", "fecha_fin": "2026-10-19", "presidente": "ENZO ALEXIS PRADA SALGADO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ENZO ALEXIS PRADA SALGADO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 855. Vigente hasta 2026-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3224332509', phone),
      email       = COALESCE('alexis1565@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "855", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2021", "fecha_fin": "2026-10-19", "presidente": "ENZO ALEXIS PRADA SALGADO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-academia-bogotana-fc-855';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3224332509', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FORTALEZA CEIF  (IDRD-CLUB-fortaleza-ceif-853)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fortaleza-ceif-853';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FORTALEZA CEIF',
      'Presidente: CARLOS EDUARDO CUERVO MENDEZ. Deporte(s): Fútbol. Resolución R-D Nº 853. Vigente hasta 2026-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '7569445',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fortaleza-ceif-853',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fortaleza-ceif-853', v_school_id, '{"resolucion_rd": "853", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2021", "fecha_fin": "2026-10-19", "presidente": "CARLOS EDUARDO CUERVO MENDEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS EDUARDO CUERVO MENDEZ. Deporte(s): Fútbol. Resolución R-D Nº 853. Vigente hasta 2026-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7569445', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "853", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2021", "fecha_fin": "2026-10-19", "presidente": "CARLOS EDUARDO CUERVO MENDEZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fortaleza-ceif-853';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE BALONCESTO ADAPTADO "SIRU SAN CRISTOBAL"  (IDRD-CLUB-club-deportivo-de-baloncesto-adaptado-si-837)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-adaptado-si-837';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE BALONCESTO ADAPTADO "SIRU SAN CRISTOBAL"',
      'Presidente: RAUL MARTIN AVILA SILVA. Deporte(s): Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 837 / actualización Nº 1163. Vigente hasta 2026-10-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3135310500',
      'rauldeportes53@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-baloncesto-adaptado-si-837',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-baloncesto-adaptado-si-837', v_school_id, '{"resolucion_rd": "837", "resolucion_actualizacion": "1163", "fecha_inicio": "29-10-2021", "fecha_fin": "2026-10-29", "presidente": "RAUL MARTIN AVILA SILVA", "localidad": "San Cristóbal", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAUL MARTIN AVILA SILVA. Deporte(s): Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 837 / actualización Nº 1163. Vigente hasta 2026-10-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3135310500', phone),
      email       = COALESCE('rauldeportes53@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "837", "resolucion_actualizacion": "1163", "fecha_inicio": "29-10-2021", "fecha_fin": "2026-10-29", "presidente": "RAUL MARTIN AVILA SILVA", "localidad": "San Cristóbal", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-adaptado-si-837';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3135310500', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LA ACADEMIA F.C.  (IDRD-CLUB-club-deportivo-la-academia-fc-862)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-academia-fc-862';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LA ACADEMIA F.C.',
      'Presidente: EDUARDO CAÃON CUBILLOS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 862 / actualización Nº 733. Vigente hasta 2026-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3057679094',
      'eduardofutbol06@yahoo.com.ar',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-la-academia-fc-862',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-la-academia-fc-862', v_school_id, '{"resolucion_rd": "862", "resolucion_actualizacion": "733", "fecha_inicio": "08-11-2021", "fecha_fin": "2026-11-08", "presidente": "EDUARDO CAÃON CUBILLOS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDUARDO CAÃON CUBILLOS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 862 / actualización Nº 733. Vigente hasta 2026-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057679094', phone),
      email       = COALESCE('eduardofutbol06@yahoo.com.ar', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "862", "resolucion_actualizacion": "733", "fecha_inicio": "08-11-2021", "fecha_fin": "2026-11-08", "presidente": "EDUARDO CAÃON CUBILLOS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-la-academia-fc-862';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3057679094', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GPD BOGOTA  (IDRD-CLUB-gpd-bogota-818)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gpd-bogota-818';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GPD BOGOTA',
      'Presidente: JORGE STIVEN QUIÃONES GONZALEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 818. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '9273955',
      'quinonesjorge2016@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gpd-bogota-818',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gpd-bogota-818', v_school_id, '{"resolucion_rd": "818", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "JORGE STIVEN QUIÃONES GONZALEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE STIVEN QUIÃONES GONZALEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 818. Vigente hasta 2026-10-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('9273955', phone),
      email       = COALESCE('quinonesjorge2016@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "818", "resolucion_actualizacion": null, "fecha_inicio": "12-10-2021", "fecha_fin": "2026-10-12", "presidente": "JORGE STIVEN QUIÃONES GONZALEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gpd-bogota-818';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '9273955', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DIMITRY S.C. F.S  (IDRD-CLUB-dimitry-sc-fs-775)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dimitry-sc-fs-775';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DIMITRY S.C. F.S',
      'Presidente: JUAN DAVID GONZALEZ GRAJALES. Deporte(s): Fútbol de salón. Localidad: Ciudad Bolívar. Resolución R-D Nº 775 / actualización Nº 844. Vigente hasta 2026-10-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3235775042',
      'dimitry-sc@hotmall.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dimitry-sc-fs-775',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dimitry-sc-fs-775', v_school_id, '{"resolucion_rd": "775", "resolucion_actualizacion": "844", "fecha_inicio": "18-10-2021", "fecha_fin": "2026-10-18", "presidente": "JUAN DAVID GONZALEZ GRAJALES", "localidad": "Ciudad Bolívar", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN DAVID GONZALEZ GRAJALES. Deporte(s): Fútbol de salón. Localidad: Ciudad Bolívar. Resolución R-D Nº 775 / actualización Nº 844. Vigente hasta 2026-10-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3235775042', phone),
      email       = COALESCE('dimitry-sc@hotmall.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "775", "resolucion_actualizacion": "844", "fecha_inicio": "18-10-2021", "fecha_fin": "2026-10-18", "presidente": "JUAN DAVID GONZALEZ GRAJALES", "localidad": "Ciudad Bolívar", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dimitry-sc-fs-775';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3235775042', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LEUROBASKET  (IDRD-CLUB-leurobasket-791)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-leurobasket-791';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEUROBASKET',
      'Presidente: JUAN PABLO LEURO GIRALDO. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 791. Vigente hasta 2026-10-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '4630406',
      'jpleurobal@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'leurobasket-791',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-leurobasket-791', v_school_id, '{"resolucion_rd": "791", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2021", "fecha_fin": "2026-10-06", "presidente": "JUAN PABLO LEURO GIRALDO", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO LEURO GIRALDO. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 791. Vigente hasta 2026-10-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4630406', phone),
      email       = COALESCE('jpleurobal@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "791", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2021", "fecha_fin": "2026-10-06", "presidente": "JUAN PABLO LEURO GIRALDO", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-leurobasket-791';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '4630406', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTUDIANTES F.S  (IDRD-CLUB-estudiantes-fs-793)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-estudiantes-fs-793';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTUDIANTES F.S',
      'Presidente: YEISON ESNEIDER ORTIZ ROSSO. Deporte(s): Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 793. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3133198641',
      'yeison220101@outlook.es',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'estudiantes-fs-793',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-estudiantes-fs-793', v_school_id, '{"resolucion_rd": "793", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "YEISON ESNEIDER ORTIZ ROSSO", "localidad": "Bosa", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YEISON ESNEIDER ORTIZ ROSSO. Deporte(s): Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 793. Vigente hasta 2026-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133198641', phone),
      email       = COALESCE('yeison220101@outlook.es', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "793", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2021", "fecha_fin": "2026-10-07", "presidente": "YEISON ESNEIDER ORTIZ ROSSO", "localidad": "Bosa", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-estudiantes-fs-793';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3133198641', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPITAL HANDBALL CLUB  (IDRD-CLUB-capital-handball-club-753)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capital-handball-club-753';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPITAL HANDBALL CLUB',
      'Presidente: HUGO SIN TRIANA. Deporte(s): Balonmano. Resolución R-D Nº 753. Vigente hasta 2026-09-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3053988352',
      NULL,
      ARRAY['Balonmano']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capital-handball-club-753',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capital-handball-club-753', v_school_id, '{"resolucion_rd": "753", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2021", "fecha_fin": "2026-09-27", "presidente": "HUGO SIN TRIANA", "localidad": null, "sports": ["Balonmano"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HUGO SIN TRIANA. Deporte(s): Balonmano. Resolución R-D Nº 753. Vigente hasta 2026-09-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3053988352', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Balonmano']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "753", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2021", "fecha_fin": "2026-09-27", "presidente": "HUGO SIN TRIANA", "localidad": null, "sports": ["Balonmano"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capital-handball-club-753';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTÃ  (IDRD-CLUB-club-deportivo-bogota-583)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-583';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTÃ',
      'Presidente: RUBEN DARIO LÃPEZ GUTIERREZ. Deporte(s): Fútbol. Resolución R-D Nº 583. Vigente hasta 2026-07-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3115840673',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogota-583',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogota-583', v_school_id, '{"resolucion_rd": "583", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2021", "fecha_fin": "2026-07-29", "presidente": "RUBEN DARIO LÃPEZ GUTIERREZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RUBEN DARIO LÃPEZ GUTIERREZ. Deporte(s): Fútbol. Resolución R-D Nº 583. Vigente hasta 2026-07-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115840673', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "583", "resolucion_actualizacion": null, "fecha_inicio": "29-07-2021", "fecha_fin": "2026-07-29", "presidente": "RUBEN DARIO LÃPEZ GUTIERREZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-583';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB ACADEMIA ÃGUILAS DE BOGOTA  (IDRD-CLUB-club-academia-aguilas-de-bogota-1004)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-academia-aguilas-de-bogota-1004';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB ACADEMIA ÃGUILAS DE BOGOTA',
      'Presidente: JOSE RICARDO ROJAS VELASQUEZ. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1004. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3058170503',
      'ricardo.rojas.velasquez@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-academia-aguilas-de-bogota-1004',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-academia-aguilas-de-bogota-1004', v_school_id, '{"resolucion_rd": "1004", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "JOSE RICARDO ROJAS VELASQUEZ", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE RICARDO ROJAS VELASQUEZ. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1004. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3058170503', phone),
      email       = COALESCE('ricardo.rojas.velasquez@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1004", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "JOSE RICARDO ROJAS VELASQUEZ", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-academia-aguilas-de-bogota-1004';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3058170503', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VISION SPORTS  (IDRD-CLUB-club-deportivo-vision-sports-1003)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-vision-sports-1003';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VISION SPORTS',
      'Presidente: WILLIAN LIBARDO LEON VELASCO. Deporte(s): Voleibol. Localidad: Puente Aranda. Resolución R-D Nº 1003. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3005681739',
      'williamleonv@hotmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-vision-sports-1003',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-vision-sports-1003', v_school_id, '{"resolucion_rd": "1003", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "WILLIAN LIBARDO LEON VELASCO", "localidad": "Puente Aranda", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAN LIBARDO LEON VELASCO. Deporte(s): Voleibol. Localidad: Puente Aranda. Resolución R-D Nº 1003. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005681739', phone),
      email       = COALESCE('williamleonv@hotmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1003", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "WILLIAN LIBARDO LEON VELASCO", "localidad": "Puente Aranda", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-vision-sports-1003';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3005681739', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO METROPOLITANO  (IDRD-CLUB-club-deportivo-metropolitano-1006)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-metropolitano-1006';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO METROPOLITANO',
      'Presidente: GINISBERTO RAMIREZ BARRERA. Deporte(s): Patinaje. Resolución R-D Nº 1006. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '5728527',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-metropolitano-1006',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-metropolitano-1006', v_school_id, '{"resolucion_rd": "1006", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "GINISBERTO RAMIREZ BARRERA", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GINISBERTO RAMIREZ BARRERA. Deporte(s): Patinaje. Resolución R-D Nº 1006. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5728527', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1006", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "GINISBERTO RAMIREZ BARRERA", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-metropolitano-1006';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOS TOROS  (IDRD-CLUB-club-deportivo-los-toros-1007)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-toros-1007';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOS TOROS',
      'Presidente: TANIA BERMUDEZ WITT. Deporte(s): Softbol. Localidad: Kennedy. Resolución R-D Nº 1007. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3046547484',
      NULL,
      ARRAY['Softbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-los-toros-1007',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-los-toros-1007', v_school_id, '{"resolucion_rd": "1007", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "TANIA BERMUDEZ WITT", "localidad": "Kennedy", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: TANIA BERMUDEZ WITT. Deporte(s): Softbol. Localidad: Kennedy. Resolución R-D Nº 1007. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3046547484', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Softbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1007", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "TANIA BERMUDEZ WITT", "localidad": "Kennedy", "sports": ["Softbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-los-toros-1007';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3046547484', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORT TEAM CLUB  (IDRD-CLUB-club-deportivo-sport-team-club-1103)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-team-club-1103';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORT TEAM CLUB',
      'Presidente: ANDRES ANÃBAL PARRA GUEVARA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1103 / actualización Nº 1403. Vigente hasta 2026-12-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3114559822',
      'sportteamclub@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sport-team-club-1103',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sport-team-club-1103', v_school_id, '{"resolucion_rd": "1103", "resolucion_actualizacion": "1403", "fecha_inicio": "30-12-2021", "fecha_fin": "2026-12-30", "presidente": "ANDRES ANÃBAL PARRA GUEVARA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES ANÃBAL PARRA GUEVARA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1103 / actualización Nº 1403. Vigente hasta 2026-12-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114559822', phone),
      email       = COALESCE('sportteamclub@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1103", "resolucion_actualizacion": "1403", "fecha_inicio": "30-12-2021", "fecha_fin": "2026-12-30", "presidente": "ANDRES ANÃBAL PARRA GUEVARA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-team-club-1103';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3114559822', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ARANA  (IDRD-CLUB-club-deportivo-arana-1102)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-arana-1102';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ARANA',
      'Presidente: JORGE ALBERTO LONDOÃO LUGO. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1102. Vigente hasta 2026-10-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3015855294',
      'aranaitf@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-arana-1102',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-arana-1102', v_school_id, '{"resolucion_rd": "1102", "resolucion_actualizacion": null, "fecha_inicio": "13-10-2021", "fecha_fin": "2026-10-13", "presidente": "JORGE ALBERTO LONDOÃO LUGO", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE ALBERTO LONDOÃO LUGO. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1102. Vigente hasta 2026-10-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3015855294', phone),
      email       = COALESCE('aranaitf@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1102", "resolucion_actualizacion": null, "fecha_inicio": "13-10-2021", "fecha_fin": "2026-10-13", "presidente": "JORGE ALBERTO LONDOÃO LUGO", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-arana-1102';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3015855294', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA RACING FILIAL BOGOTA  (IDRD-CLUB-club-deportivo-academia-racing-filial-bo-1109)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-racing-filial-bo-1109';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA RACING FILIAL BOGOTA',
      'Presidente: ANDRES FELIPE ALVAREZ GONZALEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1109. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3122377671',
      'racingfelipealvarez@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-racing-filial-bo-1109',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-racing-filial-bo-1109', v_school_id, '{"resolucion_rd": "1109", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "ANDRES FELIPE ALVAREZ GONZALEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES FELIPE ALVAREZ GONZALEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1109. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3122377671', phone),
      email       = COALESCE('racingfelipealvarez@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1109", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "ANDRES FELIPE ALVAREZ GONZALEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-racing-filial-bo-1109';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3122377671', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO D.P  (IDRD-CLUB-club-deportivo-dp-1114)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dp-1114';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO D.P',
      'Presidente: MIGUEL ANGEL PELAYO ROBELTO. Deporte(s): Patinaje. Resolución R-D Nº 1114. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3006345096',
      'mapelayor@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dp-1114',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dp-1114', v_school_id, '{"resolucion_rd": "1114", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "MIGUEL ANGEL PELAYO ROBELTO", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL PELAYO ROBELTO. Deporte(s): Patinaje. Resolución R-D Nº 1114. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006345096', phone),
      email       = COALESCE('mapelayor@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1114", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "MIGUEL ANGEL PELAYO ROBELTO", "localidad": null, "sports": ["Patinaje"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dp-1114';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE TIRO DEPORTIVO ELITE COLOMBIA CTEC  (IDRD-CLUB-club-de-tiro-deportivo-elite-colombia-ct-1108)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-tiro-deportivo-elite-colombia-ct-1108';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE TIRO DEPORTIVO ELITE COLOMBIA CTEC',
      'Presidente: CESAR ESTEBAN PARDO SARMIENTO. Deporte(s): Tiro deportivo. Localidad: Puente Aranda. Resolución R-D Nº 1108. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3106197084',
      'pardo.esteban@gmail.com',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-tiro-deportivo-elite-colombia-ct-1108',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-tiro-deportivo-elite-colombia-ct-1108', v_school_id, '{"resolucion_rd": "1108", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "CESAR ESTEBAN PARDO SARMIENTO", "localidad": "Puente Aranda", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR ESTEBAN PARDO SARMIENTO. Deporte(s): Tiro deportivo. Localidad: Puente Aranda. Resolución R-D Nº 1108. Vigente hasta 2026-12-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106197084', phone),
      email       = COALESCE('pardo.esteban@gmail.com', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1108", "resolucion_actualizacion": null, "fecha_inicio": "14-12-2021", "fecha_fin": "2026-12-14", "presidente": "CESAR ESTEBAN PARDO SARMIENTO", "localidad": "Puente Aranda", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-tiro-deportivo-elite-colombia-ct-1108';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3106197084', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORTING CAPITAL  (IDRD-CLUB-club-deportivo-sporting-capital-012)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sporting-capital-012';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORTING CAPITAL',
      'Presidente: JUAN CARLOS DIAZ BUITRAGO. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 012. Vigente hasta 2027-01-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3222345168',
      'sporting.capital17@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sporting-capital-012',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sporting-capital-012', v_school_id, '{"resolucion_rd": "012", "resolucion_actualizacion": null, "fecha_inicio": "11-01-2022", "fecha_fin": "2027-01-11", "presidente": "JUAN CARLOS DIAZ BUITRAGO", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS DIAZ BUITRAGO. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 012. Vigente hasta 2027-01-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222345168', phone),
      email       = COALESCE('sporting.capital17@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "012", "resolucion_actualizacion": null, "fecha_inicio": "11-01-2022", "fecha_fin": "2027-01-11", "presidente": "JUAN CARLOS DIAZ BUITRAGO", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sporting-capital-012';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3222345168', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPARTA FS  (IDRD-CLUB-club-deportivo-sparta-fs-013)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sparta-fs-013';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPARTA FS',
      'Presidente: LYDA MARCELA BARRERO TRUJILLO. Deporte(s): Fútbol de salón. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 013. Vigente hasta 2027-01-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3193330622',
      'clubdeportivospartafs@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sparta-fs-013',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sparta-fs-013', v_school_id, '{"resolucion_rd": "013", "resolucion_actualizacion": null, "fecha_inicio": "11-01-2022", "fecha_fin": "2027-01-11", "presidente": "LYDA MARCELA BARRERO TRUJILLO", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LYDA MARCELA BARRERO TRUJILLO. Deporte(s): Fútbol de salón. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 013. Vigente hasta 2027-01-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193330622', phone),
      email       = COALESCE('clubdeportivospartafs@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "013", "resolucion_actualizacion": null, "fecha_inicio": "11-01-2022", "fecha_fin": "2027-01-11", "presidente": "LYDA MARCELA BARRERO TRUJILLO", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sparta-fs-013';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3193330622', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALARCOGOL FC  (IDRD-CLUB-alarcogol-fc-002)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-alarcogol-fc-002';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALARCOGOL FC',
      'Presidente: JOSE DAVID ARIAS PAEZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 002. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3123202495',
      'davidariaspaez@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'alarcogol-fc-002',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-alarcogol-fc-002', v_school_id, '{"resolucion_rd": "002", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "JOSE DAVID ARIAS PAEZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE DAVID ARIAS PAEZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 002. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123202495', phone),
      email       = COALESCE('davidariaspaez@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "002", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "JOSE DAVID ARIAS PAEZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-alarcogol-fc-002';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3123202495', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOCCER INDUSTRY  (IDRD-CLUB-soccer-industry-005)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-soccer-industry-005';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOCCER INDUSTRY',
      'Presidente: JUAN PABLO BEJARANO LAVERDE. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 005. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3007875127',
      'juanpablobl@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'soccer-industry-005',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-soccer-industry-005', v_school_id, '{"resolucion_rd": "005", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "JUAN PABLO BEJARANO LAVERDE", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO BEJARANO LAVERDE. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 005. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007875127', phone),
      email       = COALESCE('juanpablobl@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "005", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "JUAN PABLO BEJARANO LAVERDE", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-soccer-industry-005';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3007875127', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KILMES DEPORTES  (IDRD-CLUB-kilmes-deportes-001)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kilmes-deportes-001';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KILMES DEPORTES',
      'Presidente: JEFERSON ARLEY PENAGOS CARDENAS. Deporte(s): Fútbol de salón. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 001. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '5100657',
      'jeffersonpenagos1930@hmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kilmes-deportes-001',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kilmes-deportes-001', v_school_id, '{"resolucion_rd": "001", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "JEFERSON ARLEY PENAGOS CARDENAS", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEFERSON ARLEY PENAGOS CARDENAS. Deporte(s): Fútbol de salón. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 001. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5100657', phone),
      email       = COALESCE('jeffersonpenagos1930@hmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "001", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "JEFERSON ARLEY PENAGOS CARDENAS", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kilmes-deportes-001';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '5100657', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE ATLETISMO ATHLETIC SPORT  (IDRD-CLUB-club-de-atletismo-athletic-sport-1186)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-atletismo-athletic-sport-1186';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE ATLETISMO ATHLETIC SPORT',
      'Presidente: NASSLY CAROLINA CUELLAR OSORIO. Deporte(s): Atletismo. Resolución R-D Nº 1186. Vigente hasta 2026-12-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3134130242',
      'info@clubatletismobogota.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-atletismo-athletic-sport-1186',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-atletismo-athletic-sport-1186', v_school_id, '{"resolucion_rd": "1186", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2021", "fecha_fin": "2026-12-27", "presidente": "NASSLY CAROLINA CUELLAR OSORIO", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NASSLY CAROLINA CUELLAR OSORIO. Deporte(s): Atletismo. Resolución R-D Nº 1186. Vigente hasta 2026-12-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134130242', phone),
      email       = COALESCE('info@clubatletismobogota.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1186", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2021", "fecha_fin": "2026-12-27", "presidente": "NASSLY CAROLINA CUELLAR OSORIO", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-atletismo-athletic-sport-1186';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE TENIS DE BOGOTÃ  (IDRD-CLUB-club-de-tenis-de-bogota-754)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-tenis-de-bogota-754';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE TENIS DE BOGOTÃ',
      'Presidente: ANGELA MARCELA ARENAS CONTRERAS. Deporte(s): Tenis. Localidad: Kennedy. Resolución R-D Nº 754. Vigente hasta 2026-09-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3123089280',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-tenis-de-bogota-754',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-tenis-de-bogota-754', v_school_id, '{"resolucion_rd": "754", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2021", "fecha_fin": "2026-09-27", "presidente": "ANGELA MARCELA ARENAS CONTRERAS", "localidad": "Kennedy", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELA MARCELA ARENAS CONTRERAS. Deporte(s): Tenis. Localidad: Kennedy. Resolución R-D Nº 754. Vigente hasta 2026-09-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123089280', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "754", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2021", "fecha_fin": "2026-09-27", "presidente": "ANGELA MARCELA ARENAS CONTRERAS", "localidad": "Kennedy", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-tenis-de-bogota-754';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3123089280', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUTBOL CLUB REY  (IDRD-CLUB-futbol-club-rey-059)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-futbol-club-rey-059';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUTBOL CLUB REY',
      'Presidente: JULIO ALBERTO NEIRA DIAZ. Deporte(s): Fútbol. Resolución R-D Nº 059. Vigente hasta 2027-01-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3112450728',
      '13jneira@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'futbol-club-rey-059',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-futbol-club-rey-059', v_school_id, '{"resolucion_rd": "059", "resolucion_actualizacion": null, "fecha_inicio": "25-01-2022", "fecha_fin": "2027-01-25", "presidente": "JULIO ALBERTO NEIRA DIAZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIO ALBERTO NEIRA DIAZ. Deporte(s): Fútbol. Resolución R-D Nº 059. Vigente hasta 2027-01-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112450728', phone),
      email       = COALESCE('13jneira@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "059", "resolucion_actualizacion": null, "fecha_inicio": "25-01-2022", "fecha_fin": "2027-01-25", "presidente": "JULIO ALBERTO NEIRA DIAZ", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-futbol-club-rey-059';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- JAEN FC  (IDRD-CLUB-jaen-fc-079)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jaen-fc-079';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JAEN FC',
      'Presidente: HUGO ALEXANDER BELTRAN CABALLERO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 079. Vigente hasta 2027-01-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3118572551',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jaen-fc-079',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jaen-fc-079', v_school_id, '{"resolucion_rd": "079", "resolucion_actualizacion": null, "fecha_inicio": "28-01-2022", "fecha_fin": "2027-01-28", "presidente": "HUGO ALEXANDER BELTRAN CABALLERO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HUGO ALEXANDER BELTRAN CABALLERO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 079. Vigente hasta 2027-01-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118572551', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "079", "resolucion_actualizacion": null, "fecha_inicio": "28-01-2022", "fecha_fin": "2027-01-28", "presidente": "HUGO ALEXANDER BELTRAN CABALLERO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jaen-fc-079';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3118572551', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPATELI FUTBOL CLUB  (IDRD-CLUB-capateli-futbol-club-095)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capateli-futbol-club-095';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPATELI FUTBOL CLUB',
      'Presidente: EDNA MILENA RODRIGUEZ MOLANO. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 095. Vigente hasta 2027-02-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3175911985',
      'edna_rodriguez82@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capateli-futbol-club-095',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capateli-futbol-club-095', v_school_id, '{"resolucion_rd": "095", "resolucion_actualizacion": null, "fecha_inicio": "02-02-2022", "fecha_fin": "2027-02-02", "presidente": "EDNA MILENA RODRIGUEZ MOLANO", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDNA MILENA RODRIGUEZ MOLANO. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 095. Vigente hasta 2027-02-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3175911985', phone),
      email       = COALESCE('edna_rodriguez82@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "095", "resolucion_actualizacion": null, "fecha_inicio": "02-02-2022", "fecha_fin": "2027-02-02", "presidente": "EDNA MILENA RODRIGUEZ MOLANO", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capateli-futbol-club-095';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3175911985', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NUEVA ALIANZA  (IDRD-CLUB-nueva-alianza-091)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-nueva-alianza-091';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NUEVA ALIANZA',
      'Presidente: ALDRICH JAVIER INFANTE RIOS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 091. Vigente hasta 2027-02-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3134673737',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'nueva-alianza-091',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-nueva-alianza-091', v_school_id, '{"resolucion_rd": "091", "resolucion_actualizacion": null, "fecha_inicio": "01-02-2022", "fecha_fin": "2027-02-01", "presidente": "ALDRICH JAVIER INFANTE RIOS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALDRICH JAVIER INFANTE RIOS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 091. Vigente hasta 2027-02-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134673737', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "091", "resolucion_actualizacion": null, "fecha_inicio": "01-02-2022", "fecha_fin": "2027-02-01", "presidente": "ALDRICH JAVIER INFANTE RIOS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-nueva-alianza-091';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3134673737', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO BODY MIND  (IDRD-CLUB-club-deportivo-de-taekwondo-body-mind-006)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-body-mind-006';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO BODY MIND',
      'Presidente: ANDRES SAEED CAMILO VANEGAS LOPEZ. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 006. Vigente hasta 2027-01-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3013168635',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-body-mind-006',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-body-mind-006', v_school_id, '{"resolucion_rd": "006", "resolucion_actualizacion": null, "fecha_inicio": "05-01-2022", "fecha_fin": "2027-01-05", "presidente": "ANDRES SAEED CAMILO VANEGAS LOPEZ", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES SAEED CAMILO VANEGAS LOPEZ. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 006. Vigente hasta 2027-01-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013168635', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "006", "resolucion_actualizacion": null, "fecha_inicio": "05-01-2022", "fecha_fin": "2027-01-05", "presidente": "ANDRES SAEED CAMILO VANEGAS LOPEZ", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-body-mind-006';
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
-- HUNTERS SPORT CLUB S.A.S.  (IDRD-CLUB-hunters-sport-club-sas-288)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-hunters-sport-club-sas-288';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'HUNTERS SPORT CLUB S.A.S.',
      'Presidente: BRAYAN DANILO AMADO PEREZ. Deporte(s): Balonmano, Fútbol, Natación. Resolución R-D Nº 288. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3212096799',
      'hunterssportclub@gmail.com',
      ARRAY['Balonmano','Fútbol','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'hunters-sport-club-sas-288',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-hunters-sport-club-sas-288', v_school_id, '{"resolucion_rd": "288", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "BRAYAN DANILO AMADO PEREZ", "localidad": null, "sports": ["Balonmano", "Fútbol", "Natación"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BRAYAN DANILO AMADO PEREZ. Deporte(s): Balonmano, Fútbol, Natación. Resolución R-D Nº 288. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212096799', phone),
      email       = COALESCE('hunterssportclub@gmail.com', email),
      sports      = ARRAY['Balonmano','Fútbol','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "288", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "BRAYAN DANILO AMADO PEREZ", "localidad": null, "sports": ["Balonmano", "Fútbol", "Natación"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-hunters-sport-club-sas-288';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- SOUTH AMERICAN ROLLERS  (IDRD-CLUB-south-american-rollers-004)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-south-american-rollers-004';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOUTH AMERICAN ROLLERS',
      'Presidente: VLADIMIR FERNANDO TUTA CASALLAS. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 004. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3212443202',
      'southamericanrollers@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'south-american-rollers-004',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-south-american-rollers-004', v_school_id, '{"resolucion_rd": "004", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "VLADIMIR FERNANDO TUTA CASALLAS", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VLADIMIR FERNANDO TUTA CASALLAS. Deporte(s): Patinaje. Localidad: Barrios Unidos. Resolución R-D Nº 004. Vigente hasta 2027-01-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212443202', phone),
      email       = COALESCE('southamericanrollers@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "004", "resolucion_actualizacion": null, "fecha_inicio": "04-01-2022", "fecha_fin": "2027-01-04", "presidente": "VLADIMIR FERNANDO TUTA CASALLAS", "localidad": "Barrios Unidos", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-south-american-rollers-004';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3212443202', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOWLING CAPITAL  (IDRD-CLUB-club-deportivo-bowling-capital-105)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bowling-capital-105';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOWLING CAPITAL',
      'Presidente: FABIO EDUARDO BERNAL BARRANTES. Deporte(s): Bowling. Localidad: Usaquén. Resolución R-D Nº 105 / actualización Nº 1767. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3118808030',
      'bowlingcapital@gmail.com',
      ARRAY['Bowling']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bowling-capital-105',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bowling-capital-105', v_school_id, '{"resolucion_rd": "105", "resolucion_actualizacion": "1767", "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "FABIO EDUARDO BERNAL BARRANTES", "localidad": "Usaquén", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABIO EDUARDO BERNAL BARRANTES. Deporte(s): Bowling. Localidad: Usaquén. Resolución R-D Nº 105 / actualización Nº 1767. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118808030', phone),
      email       = COALESCE('bowlingcapital@gmail.com', email),
      sports      = ARRAY['Bowling']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "105", "resolucion_actualizacion": "1767", "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "FABIO EDUARDO BERNAL BARRANTES", "localidad": "Usaquén", "sports": ["Bowling"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bowling-capital-105';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3118808030', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CITY CLUB UNITED  (IDRD-CLUB-club-deportivo-city-club-united-106)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-city-club-united-106';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CITY CLUB UNITED',
      'Presidente: RAUL ORLANDO DELGADO CABIATIVA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 106 / actualización Nº 1667. Vigente hasta 2027-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3202798817',
      'contacto@funsoliun.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-city-club-united-106',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-city-club-united-106', v_school_id, '{"resolucion_rd": "106", "resolucion_actualizacion": "1667", "fecha_inicio": "07-02-2022", "fecha_fin": "2027-02-07", "presidente": "RAUL ORLANDO DELGADO CABIATIVA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAUL ORLANDO DELGADO CABIATIVA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 106 / actualización Nº 1667. Vigente hasta 2027-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202798817', phone),
      email       = COALESCE('contacto@funsoliun.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "106", "resolucion_actualizacion": "1667", "fecha_inicio": "07-02-2022", "fecha_fin": "2027-02-07", "presidente": "RAUL ORLANDO DELGADO CABIATIVA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-city-club-united-106';
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
-- CLUB DEPORTIVO ESBALCA  (IDRD-CLUB-club-deportivo-esbalca-130)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-esbalca-130';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESBALCA',
      'Presidente: JOHAN ARLEY RODRIGUEZ GALLEGO. Deporte(s): Baloncesto. Localidad: Ciudad Bolívar. Resolución R-D Nº 130. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3157076655',
      NULL,
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-esbalca-130',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-esbalca-130', v_school_id, '{"resolucion_rd": "130", "resolucion_actualizacion": null, "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "JOHAN ARLEY RODRIGUEZ GALLEGO", "localidad": "Ciudad Bolívar", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHAN ARLEY RODRIGUEZ GALLEGO. Deporte(s): Baloncesto. Localidad: Ciudad Bolívar. Resolución R-D Nº 130. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3157076655', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "130", "resolucion_actualizacion": null, "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "JOHAN ARLEY RODRIGUEZ GALLEGO", "localidad": "Ciudad Bolívar", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-esbalca-130';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3157076655', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BOGOTÃ BSR  (IDRD-CLUB-club-deportivo-bogota-bsr-228)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-bsr-228';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BOGOTÃ BSR',
      'Presidente: CARLOS ALFONSO LONDOÃO CUERVO. Deporte(s): Baloncesto. Resolución R-D Nº 228. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3195201451',
      'bogota.bsr@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bogota-bsr-228',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bogota-bsr-228', v_school_id, '{"resolucion_rd": "228", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "CARLOS ALFONSO LONDOÃO CUERVO", "localidad": null, "sports": ["Baloncesto"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALFONSO LONDOÃO CUERVO. Deporte(s): Baloncesto. Resolución R-D Nº 228. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195201451', phone),
      email       = COALESCE('bogota.bsr@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "228", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "CARLOS ALFONSO LONDOÃO CUERVO", "localidad": null, "sports": ["Baloncesto"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bogota-bsr-228';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- WALTINHO FUTBOL CLUB  (IDRD-CLUB-waltinho-futbol-club-134)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-waltinho-futbol-club-134';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'WALTINHO FUTBOL CLUB',
      'Presidente: JUAN CARLOS MORAES SAAVEDRA. Deporte(s): Fútbol. Resolución R-D Nº 134. Vigente hasta 2027-02-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3017378585',
      'waltinhofutbolclub@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'waltinho-futbol-club-134',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-waltinho-futbol-club-134', v_school_id, '{"resolucion_rd": "134", "resolucion_actualizacion": null, "fecha_inicio": "14-02-2022", "fecha_fin": "2027-02-14", "presidente": "JUAN CARLOS MORAES SAAVEDRA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS MORAES SAAVEDRA. Deporte(s): Fútbol. Resolución R-D Nº 134. Vigente hasta 2027-02-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017378585', phone),
      email       = COALESCE('waltinhofutbolclub@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "134", "resolucion_actualizacion": null, "fecha_inicio": "14-02-2022", "fecha_fin": "2027-02-14", "presidente": "JUAN CARLOS MORAES SAAVEDRA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-waltinho-futbol-club-134';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- FALCON D.C.  (IDRD-CLUB-falcon-dc-126)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-falcon-dc-126';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FALCON D.C.',
      'Presidente: ANDRES DAVID FLORIAN PIRAJAN. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 126. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3219898935',
      'adflorian@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'falcon-dc-126',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-falcon-dc-126', v_school_id, '{"resolucion_rd": "126", "resolucion_actualizacion": null, "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "ANDRES DAVID FLORIAN PIRAJAN", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES DAVID FLORIAN PIRAJAN. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 126. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219898935', phone),
      email       = COALESCE('adflorian@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "126", "resolucion_actualizacion": null, "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "ANDRES DAVID FLORIAN PIRAJAN", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-falcon-dc-126';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3219898935', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE CICLISMO LMC BOGOTA  (IDRD-CLUB-club-deportivo-de-ciclismo-lmc-bogota-145)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-ciclismo-lmc-bogota-145';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE CICLISMO LMC BOGOTA',
      'Presidente: LUIS MIGUEL CAVIEDES REINOSO. Deporte(s): Ciclismo. Resolución R-D Nº 145. Vigente hasta 2027-02-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3142693877',
      'clublmcbogota@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-ciclismo-lmc-bogota-145',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-ciclismo-lmc-bogota-145', v_school_id, '{"resolucion_rd": "145", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2022", "fecha_fin": "2027-02-16", "presidente": "LUIS MIGUEL CAVIEDES REINOSO", "localidad": null, "sports": ["Ciclismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS MIGUEL CAVIEDES REINOSO. Deporte(s): Ciclismo. Resolución R-D Nº 145. Vigente hasta 2027-02-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142693877', phone),
      email       = COALESCE('clublmcbogota@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "145", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2022", "fecha_fin": "2027-02-16", "presidente": "LUIS MIGUEL CAVIEDES REINOSO", "localidad": null, "sports": ["Ciclismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-ciclismo-lmc-bogota-145';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTUDIANTES ACADEMY F.C.  (IDRD-CLUB-estudiantes-academy-fc-127)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-estudiantes-academy-fc-127';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTUDIANTES ACADEMY F.C.',
      'Presidente: MIGUEL ANGEL BELTRAN REINA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 127. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3133198641',
      'academyestudiantes@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'estudiantes-academy-fc-127',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-estudiantes-academy-fc-127', v_school_id, '{"resolucion_rd": "127", "resolucion_actualizacion": null, "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "MIGUEL ANGEL BELTRAN REINA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL BELTRAN REINA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 127. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133198641', phone),
      email       = COALESCE('academyestudiantes@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "127", "resolucion_actualizacion": null, "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "MIGUEL ANGEL BELTRAN REINA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-estudiantes-academy-fc-127';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3133198641', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- THUNDERLITE  (IDRD-CLUB-thunderlite-156)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-thunderlite-156';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'THUNDERLITE',
      'Presidente: GERMAN ENRIQUE DIAZ RODRIGUEZ. Deporte(s): Ciclismo. Localidad: Usaquén. Resolución R-D Nº 156. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3168009910',
      'germandaysbmx@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'thunderlite-156',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-thunderlite-156', v_school_id, '{"resolucion_rd": "156", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "GERMAN ENRIQUE DIAZ RODRIGUEZ", "localidad": "Usaquén", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GERMAN ENRIQUE DIAZ RODRIGUEZ. Deporte(s): Ciclismo. Localidad: Usaquén. Resolución R-D Nº 156. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3168009910', phone),
      email       = COALESCE('germandaysbmx@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "156", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "GERMAN ENRIQUE DIAZ RODRIGUEZ", "localidad": "Usaquén", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-thunderlite-156';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3168009910', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- STUDIO ABBA DANCE & CHEERS  (IDRD-CLUB-studio-abba-dance-cheers-159)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-studio-abba-dance-cheers-159';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'STUDIO ABBA DANCE & CHEERS',
      'Presidente: LUISA FERNANDA CUEVAS ESPINOSA. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 159. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      NULL,
      NULL,
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'studio-abba-dance-cheers-159',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-studio-abba-dance-cheers-159', v_school_id, '{"resolucion_rd": "159", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "LUISA FERNANDA CUEVAS ESPINOSA", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUISA FERNANDA CUEVAS ESPINOSA. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 159. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "159", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "LUISA FERNANDA CUEVAS ESPINOSA", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-studio-abba-dance-cheers-159';
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
-- KOMANDOS ELITE TAEKWONDO COLOMBIA  (IDRD-CLUB-komandos-elite-taekwondo-colombia-157)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-komandos-elite-taekwondo-colombia-157';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KOMANDOS ELITE TAEKWONDO COLOMBIA',
      'Presidente: LIHER YOJHANNA RODRIGUEZ OVALLE. Deporte(s): Taekwondo. Resolución R-D Nº 157. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3214874681',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'komandos-elite-taekwondo-colombia-157',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-komandos-elite-taekwondo-colombia-157', v_school_id, '{"resolucion_rd": "157", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "LIHER YOJHANNA RODRIGUEZ OVALLE", "localidad": null, "sports": ["Taekwondo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LIHER YOJHANNA RODRIGUEZ OVALLE. Deporte(s): Taekwondo. Resolución R-D Nº 157. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214874681', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "157", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "LIHER YOJHANNA RODRIGUEZ OVALLE", "localidad": null, "sports": ["Taekwondo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-komandos-elite-taekwondo-colombia-157';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AC TENIS CLUB  (IDRD-CLUB-club-deportivo-ac-tenis-club-161)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ac-tenis-club-161';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AC TENIS CLUB',
      'Presidente: ANDRES FELIPE CUELLAR MORENO. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 161. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3057454353',
      'felipecumo@hotmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ac-tenis-club-161',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ac-tenis-club-161', v_school_id, '{"resolucion_rd": "161", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "ANDRES FELIPE CUELLAR MORENO", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES FELIPE CUELLAR MORENO. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 161. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057454353', phone),
      email       = COALESCE('felipecumo@hotmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "161", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "ANDRES FELIPE CUELLAR MORENO", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ac-tenis-club-161';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3057454353', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE SAMBO JUNGLA  (IDRD-CLUB-club-deportivo-de-sambo-jungla-164)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-jungla-164';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE SAMBO JUNGLA',
      'Presidente: JEIMY VANNESA BUITRAGO CASTELLANOS. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 164. Vigente hasta 2027-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3185512273',
      'junglasambo@gmail.com',
      ARRAY['Sambo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-sambo-jungla-164',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-sambo-jungla-164', v_school_id, '{"resolucion_rd": "164", "resolucion_actualizacion": null, "fecha_inicio": "22-02-2022", "fecha_fin": "2027-02-22", "presidente": "JEIMY VANNESA BUITRAGO CASTELLANOS", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEIMY VANNESA BUITRAGO CASTELLANOS. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 164. Vigente hasta 2027-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3185512273', phone),
      email       = COALESCE('junglasambo@gmail.com', email),
      sports      = ARRAY['Sambo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "164", "resolucion_actualizacion": null, "fecha_inicio": "22-02-2022", "fecha_fin": "2027-02-22", "presidente": "JEIMY VANNESA BUITRAGO CASTELLANOS", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-jungla-164';
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
-- KAIROS FL perteneciente a la entidad no deportiva PLAY SPORTS TRAVEL S  (IDRD-CLUB-kairos-fl-perteneciente-a-la-entidad-no--178)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kairos-fl-perteneciente-a-la-entidad-no--178';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KAIROS FL perteneciente a la entidad no deportiva PLAY SPORTS TRAVEL S',
      'Presidente: FABER DANIEL LOPEZ VARGAS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 178. Vigente hasta 2027-02-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3184224244',
      'kairosfl@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kairos-fl-perteneciente-a-la-entidad-no--178',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kairos-fl-perteneciente-a-la-entidad-no--178', v_school_id, '{"resolucion_rd": "178", "resolucion_actualizacion": null, "fecha_inicio": "25-02-2022", "fecha_fin": "2027-02-25", "presidente": "FABER DANIEL LOPEZ VARGAS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FABER DANIEL LOPEZ VARGAS. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 178. Vigente hasta 2027-02-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3184224244', phone),
      email       = COALESCE('kairosfl@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "178", "resolucion_actualizacion": null, "fecha_inicio": "25-02-2022", "fecha_fin": "2027-02-25", "presidente": "FABER DANIEL LOPEZ VARGAS", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kairos-fl-perteneciente-a-la-entidad-no--178';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3184224244', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ROLLER RACER  (IDRD-CLUB-roller-racer-173)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-roller-racer-173';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ROLLER RACER',
      'Presidente: ALEYDA NATALY SÃNCHEZ ZULUAGA. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 173. Vigente hasta 2027-02-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3157207546',
      'natis_499@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'roller-racer-173',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-roller-racer-173', v_school_id, '{"resolucion_rd": "173", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2022", "fecha_fin": "2027-02-24", "presidente": "ALEYDA NATALY SÃNCHEZ ZULUAGA", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEYDA NATALY SÃNCHEZ ZULUAGA. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 173. Vigente hasta 2027-02-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3157207546', phone),
      email       = COALESCE('natis_499@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "173", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2022", "fecha_fin": "2027-02-24", "presidente": "ALEYDA NATALY SÃNCHEZ ZULUAGA", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-roller-racer-173';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3157207546', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SPARTANS AMERICAN FOOTBALL  (IDRD-CLUB-spartans-american-football-169)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-spartans-american-football-169';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPARTANS AMERICAN FOOTBALL',
      'Presidente: CRISTIAN DAVID BALLESTEROS LASSO. Deporte(s): Football Americano. Localidad: Usaquén. Resolución R-D Nº 169. Vigente hasta 2027-02-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '6197920',
      'gerencia.bogota.spartans@gmail.com',
      ARRAY['Football Americano']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'spartans-american-football-169',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-spartans-american-football-169', v_school_id, '{"resolucion_rd": "169", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2022", "fecha_fin": "2027-02-23", "presidente": "CRISTIAN DAVID BALLESTEROS LASSO", "localidad": "Usaquén", "sports": ["Football Americano"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN DAVID BALLESTEROS LASSO. Deporte(s): Football Americano. Localidad: Usaquén. Resolución R-D Nº 169. Vigente hasta 2027-02-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6197920', phone),
      email       = COALESCE('gerencia.bogota.spartans@gmail.com', email),
      sports      = ARRAY['Football Americano']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "169", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2022", "fecha_fin": "2027-02-23", "presidente": "CRISTIAN DAVID BALLESTEROS LASSO", "localidad": "Usaquén", "sports": ["Football Americano"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-spartans-american-football-169';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '6197920', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CORDEBOGOTA C.R.D perteneciente a la entidad no deportiva CORPORACION  (IDRD-CLUB-cordebogota-crd-perteneciente-a-la-entid-184)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cordebogota-crd-perteneciente-a-la-entid-184';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CORDEBOGOTA C.R.D perteneciente a la entidad no deportiva CORPORACION',
      'Presidente: JOHN CARLOS CAIPA CARDENAS. Deporte(s): Baloncesto, Taekwondo, Patinaje, Fútbol de salón, Fútbol, Voleibol. Resolución R-D Nº 184. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3219700849',
      'cordebogota29crd@hotmail.com',
      ARRAY['Baloncesto','Taekwondo','Patinaje','Fútbol de salón','Fútbol','Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cordebogota-crd-perteneciente-a-la-entid-184',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cordebogota-crd-perteneciente-a-la-entid-184', v_school_id, '{"resolucion_rd": "184", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "JOHN CARLOS CAIPA CARDENAS", "localidad": null, "sports": ["Baloncesto", "Taekwondo", "Patinaje", "Fútbol de salón", "Fútbol", "Voleibol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN CARLOS CAIPA CARDENAS. Deporte(s): Baloncesto, Taekwondo, Patinaje, Fútbol de salón, Fútbol, Voleibol. Resolución R-D Nº 184. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219700849', phone),
      email       = COALESCE('cordebogota29crd@hotmail.com', email),
      sports      = ARRAY['Baloncesto','Taekwondo','Patinaje','Fútbol de salón','Fútbol','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "184", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "JOHN CARLOS CAIPA CARDENAS", "localidad": null, "sports": ["Baloncesto", "Taekwondo", "Patinaje", "Fútbol de salón", "Fútbol", "Voleibol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cordebogota-crd-perteneciente-a-la-entid-184';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ZION VOLLEY CLUB  (IDRD-CLUB-zion-volley-club-185)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-zion-volley-club-185';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ZION VOLLEY CLUB',
      'Presidente: CAMILO ANDRES SUAREZ BARRERA. Deporte(s): Voleibol. Resolución R-D Nº 185. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3108878940',
      NULL,
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'zion-volley-club-185',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-zion-volley-club-185', v_school_id, '{"resolucion_rd": "185", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "CAMILO ANDRES SUAREZ BARRERA", "localidad": null, "sports": ["Voleibol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ANDRES SUAREZ BARRERA. Deporte(s): Voleibol. Resolución R-D Nº 185. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108878940', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "185", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "CAMILO ANDRES SUAREZ BARRERA", "localidad": null, "sports": ["Voleibol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-zion-volley-club-185';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- SKATE AGILITY  (IDRD-CLUB-skate-agility-201)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-skate-agility-201';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SKATE AGILITY',
      'Presidente: HAROLD EDUARDO ROJAS LEGUIZAMON. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 201. Vigente hasta 2027-03-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3155447843',
      'skateagility@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'skate-agility-201',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-skate-agility-201', v_school_id, '{"resolucion_rd": "201", "resolucion_actualizacion": null, "fecha_inicio": "07-03-2022", "fecha_fin": "2027-03-07", "presidente": "HAROLD EDUARDO ROJAS LEGUIZAMON", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HAROLD EDUARDO ROJAS LEGUIZAMON. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 201. Vigente hasta 2027-03-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3155447843', phone),
      email       = COALESCE('skateagility@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "201", "resolucion_actualizacion": null, "fecha_inicio": "07-03-2022", "fecha_fin": "2027-03-07", "presidente": "HAROLD EDUARDO ROJAS LEGUIZAMON", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-skate-agility-201';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3155447843', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB CICLISTICO 20 DE JULIO  (IDRD-CLUB-club-ciclistico-20-de-julio-203)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-ciclistico-20-de-julio-203';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB CICLISTICO 20 DE JULIO',
      'Presidente: LUIS GIOVANNI ROJAS CARDENAS. Deporte(s): Ciclismo. Resolución R-D Nº 203. Vigente hasta 2027-03-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3102184639',
      'luigiro1908@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-ciclistico-20-de-julio-203',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-ciclistico-20-de-julio-203', v_school_id, '{"resolucion_rd": "203", "resolucion_actualizacion": null, "fecha_inicio": "07-03-2022", "fecha_fin": "2027-03-07", "presidente": "LUIS GIOVANNI ROJAS CARDENAS", "localidad": null, "sports": ["Ciclismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS GIOVANNI ROJAS CARDENAS. Deporte(s): Ciclismo. Resolución R-D Nº 203. Vigente hasta 2027-03-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102184639', phone),
      email       = COALESCE('luigiro1908@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "203", "resolucion_actualizacion": null, "fecha_inicio": "07-03-2022", "fecha_fin": "2027-03-07", "presidente": "LUIS GIOVANNI ROJAS CARDENAS", "localidad": null, "sports": ["Ciclismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-ciclistico-20-de-julio-203';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EXPRESO FC perteneciente a la entidad no deportiva FUND  (IDRD-CLUB-club-deportivo-expreso-fc-perteneciente--207)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-expreso-fc-perteneciente--207';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EXPRESO FC perteneciente a la entidad no deportiva FUND',
      'Presidente: CLARA INES OROZCO ESTUPIÃAN. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 207. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3114803446',
      'claraino@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-expreso-fc-perteneciente--207',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-expreso-fc-perteneciente--207', v_school_id, '{"resolucion_rd": "207", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "CLARA INES OROZCO ESTUPIÃAN", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLARA INES OROZCO ESTUPIÃAN. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 207. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114803446', phone),
      email       = COALESCE('claraino@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "207", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "CLARA INES OROZCO ESTUPIÃAN", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-expreso-fc-perteneciente--207';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3114803446', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE SAMBO APOLO  (IDRD-CLUB-club-deportivo-de-sambo-apolo-188)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-apolo-188';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE SAMBO APOLO',
      'Presidente: JANNETH ESPERANZA MORA GIRALDO. Deporte(s): Sambo. Localidad: Suba. Resolución R-D Nº 188. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3138922400',
      'apolosambo@gmail.com',
      ARRAY['Sambo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-sambo-apolo-188',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-sambo-apolo-188', v_school_id, '{"resolucion_rd": "188", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "JANNETH ESPERANZA MORA GIRALDO", "localidad": "Suba", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JANNETH ESPERANZA MORA GIRALDO. Deporte(s): Sambo. Localidad: Suba. Resolución R-D Nº 188. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138922400', phone),
      email       = COALESCE('apolosambo@gmail.com', email),
      sports      = ARRAY['Sambo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "188", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "JANNETH ESPERANZA MORA GIRALDO", "localidad": "Suba", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-apolo-188';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3138922400', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO C.D. INDEPENDIENTE  (IDRD-CLUB-club-deportivo-cd-independiente-224)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cd-independiente-224';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO C.D. INDEPENDIENTE',
      'Presidente: ANA MARIA COLLAZOS ZORRILLA. Deporte(s): Fútbol, Fútbol de salón, Natación, Patinaje, Atletismo, Baile Deportivo, Taekwondo, Voleibol, Tenis. Localidad: Puente Aranda. Resolución R-D Nº 224. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3208166021',
      'presidenciacdindependiente@gmail.com.',
      ARRAY['Fútbol','Fútbol de salón','Natación','Patinaje','Atletismo','Baile Deportivo','Taekwondo','Voleibol','Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cd-independiente-224',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cd-independiente-224', v_school_id, '{"resolucion_rd": "224", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "ANA MARIA COLLAZOS ZORRILLA", "localidad": "Puente Aranda", "sports": ["Fútbol", "Fútbol de salón", "Natación", "Patinaje", "Atletismo", "Baile Deportivo", "Taekwondo", "Voleibol", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA MARIA COLLAZOS ZORRILLA. Deporte(s): Fútbol, Fútbol de salón, Natación, Patinaje, Atletismo, Baile Deportivo, Taekwondo, Voleibol, Tenis. Localidad: Puente Aranda. Resolución R-D Nº 224. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208166021', phone),
      email       = COALESCE('presidenciacdindependiente@gmail.com.', email),
      sports      = ARRAY['Fútbol','Fútbol de salón','Natación','Patinaje','Atletismo','Baile Deportivo','Taekwondo','Voleibol','Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "224", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "ANA MARIA COLLAZOS ZORRILLA", "localidad": "Puente Aranda", "sports": ["Fútbol", "Fútbol de salón", "Natación", "Patinaje", "Atletismo", "Baile Deportivo", "Taekwondo", "Voleibol", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cd-independiente-224';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3208166021', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE SAMBO PANTHERHOUSE  (IDRD-CLUB-club-deportivo-de-sambo-pantherhouse-208)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-pantherhouse-208';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE SAMBO PANTHERHOUSE',
      'Presidente: JOSE EDUARDO MORA ANSOLA. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 208. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3104825329',
      'joed070808@gmail.com',
      ARRAY['Sambo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-sambo-pantherhouse-208',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-sambo-pantherhouse-208', v_school_id, '{"resolucion_rd": "208", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "JOSE EDUARDO MORA ANSOLA", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE EDUARDO MORA ANSOLA. Deporte(s): Sambo. Localidad: Engativá. Resolución R-D Nº 208. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3104825329', phone),
      email       = COALESCE('joed070808@gmail.com', email),
      sports      = ARRAY['Sambo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "208", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "JOSE EDUARDO MORA ANSOLA", "localidad": "Engativá", "sports": ["Sambo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-sambo-pantherhouse-208';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3104825329', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LOS INDEPENDIENTES FA  (IDRD-CLUB-los-independientes-fa-NA)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-los-independientes-fa-NA';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LOS INDEPENDIENTES FA',
      'Presidente: OLGA LUCIA ZAWADZKY CASTILLO. Deporte(s): Fútbol. Localidad: San Cristóbal. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '47597723193825120',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'los-independientes-fa-club',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-los-independientes-fa-NA', v_school_id, '{"resolucion_rd": null, "resolucion_actualizacion": null, "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "OLGA LUCIA ZAWADZKY CASTILLO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OLGA LUCIA ZAWADZKY CASTILLO. Deporte(s): Fútbol. Localidad: San Cristóbal. Vigente hasta 2027-03-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('47597723193825120', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": null, "resolucion_actualizacion": null, "fecha_inicio": "08-03-2022", "fecha_fin": "2027-03-08", "presidente": "OLGA LUCIA ZAWADZKY CASTILLO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-los-independientes-fa-NA';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '47597723193825120', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RAYO F.C.  (IDRD-CLUB-rayo-fc-189)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-rayo-fc-189';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RAYO F.C.',
      'Presidente: LUIS ALBERTO CUESTA MENA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 189. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '5291902',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'rayo-fc-189',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-rayo-fc-189', v_school_id, '{"resolucion_rd": "189", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "LUIS ALBERTO CUESTA MENA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALBERTO CUESTA MENA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 189. Vigente hasta 2027-03-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5291902', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "189", "resolucion_actualizacion": null, "fecha_inicio": "02-03-2022", "fecha_fin": "2027-03-02", "presidente": "LUIS ALBERTO CUESTA MENA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-rayo-fc-189';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '5291902', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ACADEMIA COLOMBIA REAL  (IDRD-CLUB-academia-colombia-real-220)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-academia-colombia-real-220';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ACADEMIA COLOMBIA REAL',
      'Presidente: JUAN FRANCISCO VARGAS CAMPOS. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 220. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3124602182',
      'academiacolombiareal@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'academia-colombia-real-220',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-academia-colombia-real-220', v_school_id, '{"resolucion_rd": "220", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "JUAN FRANCISCO VARGAS CAMPOS", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN FRANCISCO VARGAS CAMPOS. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 220. Vigente hasta 2027-03-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124602182', phone),
      email       = COALESCE('academiacolombiareal@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "220", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2022", "fecha_fin": "2027-03-10", "presidente": "JUAN FRANCISCO VARGAS CAMPOS", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-academia-colombia-real-220';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3124602182', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BAYERN FUTBOL COLOMBIA  (IDRD-CLUB-bayern-futbol-colombia-214)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bayern-futbol-colombia-214';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BAYERN FUTBOL COLOMBIA',
      'Presidente: MANUEL JULIAN ESCOBAR CARO. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 214. Vigente hasta 2027-03-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3103128503',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bayern-futbol-colombia-214',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bayern-futbol-colombia-214', v_school_id, '{"resolucion_rd": "214", "resolucion_actualizacion": null, "fecha_inicio": "09-03-2022", "fecha_fin": "2027-03-09", "presidente": "MANUEL JULIAN ESCOBAR CARO", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL JULIAN ESCOBAR CARO. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 214. Vigente hasta 2027-03-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103128503', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "214", "resolucion_actualizacion": null, "fecha_inicio": "09-03-2022", "fecha_fin": "2027-03-09", "presidente": "MANUEL JULIAN ESCOBAR CARO", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bayern-futbol-colombia-214';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3103128503', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
