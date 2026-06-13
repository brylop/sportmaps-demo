-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 3/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SHARK VOLLEY CLUB  (IDRD-CLUB-club-deportivo-shark-volley-club-494)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-shark-volley-club-494';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SHARK VOLLEY CLUB',
      'Presidente: SANTIAGO EMIRO FAJARDO CANO. Deporte(s): Voleibol. Localidad: Kennedy. Resolución R-D Nº 494. Vigente hasta 2030-05-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3133432129',
      'sharkvolleyclub@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-shark-volley-club-494',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-shark-volley-club-494', v_school_id, '{"resolucion_rd": "494", "resolucion_actualizacion": null, "fecha_inicio": "21-05-2025", "fecha_fin": "2030-05-21", "presidente": "SANTIAGO EMIRO FAJARDO CANO", "localidad": "Kennedy", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO EMIRO FAJARDO CANO. Deporte(s): Voleibol. Localidad: Kennedy. Resolución R-D Nº 494. Vigente hasta 2030-05-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133432129', phone),
      email       = COALESCE('sharkvolleyclub@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "494", "resolucion_actualizacion": null, "fecha_inicio": "21-05-2025", "fecha_fin": "2030-05-21", "presidente": "SANTIAGO EMIRO FAJARDO CANO", "localidad": "Kennedy", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-shark-volley-club-494';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3133432129', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SANTOS VOLLEYBALL CLUB  (IDRD-CLUB-santos-volleyball-club-947)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-santos-volleyball-club-947';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SANTOS VOLLEYBALL CLUB',
      'Presidente: ANGELA ANDREA PEÃâA HERREÃâO. Deporte(s): Voleibol. Localidad: Puente Aranda. Resolución R-D Nº 947. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3194536677',
      'angela8463@hotmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'santos-volleyball-club-947',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-santos-volleyball-club-947', v_school_id, '{"resolucion_rd": "947", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "ANGELA ANDREA PEÃâA HERREÃâO", "localidad": "Puente Aranda", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGELA ANDREA PEÃâA HERREÃâO. Deporte(s): Voleibol. Localidad: Puente Aranda. Resolución R-D Nº 947. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3194536677', phone),
      email       = COALESCE('angela8463@hotmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "947", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "ANGELA ANDREA PEÃâA HERREÃâO", "localidad": "Puente Aranda", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-santos-volleyball-club-947';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3194536677', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE ESCALADA DESNIVEL  (IDRD-CLUB-club-deportivo-de-escalada-desnivel-319)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-escalada-desnivel-319';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE ESCALADA DESNIVEL',
      'Presidente: ABRAHAM EDILBERTO HIDALGO MENDOZA. Deporte(s): Escalada Deportiva. Localidad: Barrios Unidos. Resolución R-D Nº 319. Vigente hasta 2030-04-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3013956684',
      'clubescaladadesnivel@gmail.com',
      ARRAY['Escalada Deportiva']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-escalada-desnivel-319',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-escalada-desnivel-319', v_school_id, '{"resolucion_rd": "319", "resolucion_actualizacion": null, "fecha_inicio": "08-04-2025", "fecha_fin": "2030-04-08", "presidente": "ABRAHAM EDILBERTO HIDALGO MENDOZA", "localidad": "Barrios Unidos", "sports": ["Escalada Deportiva"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ABRAHAM EDILBERTO HIDALGO MENDOZA. Deporte(s): Escalada Deportiva. Localidad: Barrios Unidos. Resolución R-D Nº 319. Vigente hasta 2030-04-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013956684', phone),
      email       = COALESCE('clubescaladadesnivel@gmail.com', email),
      sports      = ARRAY['Escalada Deportiva']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "319", "resolucion_actualizacion": null, "fecha_inicio": "08-04-2025", "fecha_fin": "2030-04-08", "presidente": "ABRAHAM EDILBERTO HIDALGO MENDOZA", "localidad": "Barrios Unidos", "sports": ["Escalada Deportiva"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-escalada-desnivel-319';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3013956684', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SHERFIELD F.C.  (IDRD-CLUB-sherfield-fc-501)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sherfield-fc-501';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SHERFIELD F.C.',
      'Presidente: YESID MOYANO MORALES. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 501. Vigente hasta 2026-07-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '4062933',
      'sherfieldf.c@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sherfield-fc-501',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sherfield-fc-501', v_school_id, '{"resolucion_rd": "501", "resolucion_actualizacion": null, "fecha_inicio": "07-07-2021", "fecha_fin": "2026-07-07", "presidente": "YESID MOYANO MORALES", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YESID MOYANO MORALES. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 501. Vigente hasta 2026-07-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4062933', phone),
      email       = COALESCE('sherfieldf.c@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "501", "resolucion_actualizacion": null, "fecha_inicio": "07-07-2021", "fecha_fin": "2026-07-07", "presidente": "YESID MOYANO MORALES", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sherfield-fc-501';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '4062933', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SHIN JIN YU  (IDRD-CLUB-shin-jin-yu-053)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-shin-jin-yu-053';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SHIN JIN YU',
      'Presidente: EUDALDO AGUILAR LINARES. Deporte(s): Taekwondo. Localidad: Usme. Resolución R-D Nº 053. Vigente hasta 2027-01-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3202346860',
      NULL,
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'shin-jin-yu-053',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-shin-jin-yu-053', v_school_id, '{"resolucion_rd": "053", "resolucion_actualizacion": null, "fecha_inicio": "19-01-2022", "fecha_fin": "2027-01-19", "presidente": "EUDALDO AGUILAR LINARES", "localidad": "Usme", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EUDALDO AGUILAR LINARES. Deporte(s): Taekwondo. Localidad: Usme. Resolución R-D Nº 053. Vigente hasta 2027-01-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202346860', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "053", "resolucion_actualizacion": null, "fecha_inicio": "19-01-2022", "fecha_fin": "2027-01-19", "presidente": "EUDALDO AGUILAR LINARES", "localidad": "Usme", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-shin-jin-yu-053';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3202346860', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SINCROCLUB ONDINAS  (IDRD-CLUB-club-deportivo-sincroclub-ondinas-253)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sincroclub-ondinas-253';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SINCROCLUB ONDINAS',
      'Presidente: HERLY RAMSES QUIMBAYO MORENO. Deporte(s): Natación. Localidad: Teusaquillo. Resolución R-D Nº 253 / actualización Nº 410. Vigente hasta 2028-04-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3161542839',
      'sincro.ondinas@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sincroclub-ondinas-253',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sincroclub-ondinas-253', v_school_id, '{"resolucion_rd": "253", "resolucion_actualizacion": "410", "fecha_inicio": "11-04-2023", "fecha_fin": "2028-04-10", "presidente": "HERLY RAMSES QUIMBAYO MORENO", "localidad": "Teusaquillo", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HERLY RAMSES QUIMBAYO MORENO. Deporte(s): Natación. Localidad: Teusaquillo. Resolución R-D Nº 253 / actualización Nº 410. Vigente hasta 2028-04-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3161542839', phone),
      email       = COALESCE('sincro.ondinas@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "253", "resolucion_actualizacion": "410", "fecha_inicio": "11-04-2023", "fecha_fin": "2028-04-10", "presidente": "HERLY RAMSES QUIMBAYO MORENO", "localidad": "Teusaquillo", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sincroclub-ondinas-253';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3161542839', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SLIDERS  (IDRD-CLUB-club-deportivo-sliders-1771)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sliders-1771';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SLIDERS',
      'Presidente: ANA PATRICIA SUESCA ROMERO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1771 / actualización Nº 219. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '7963133',
      'fenix090972@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sliders-1771',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sliders-1771', v_school_id, '{"resolucion_rd": "1771", "resolucion_actualizacion": "219", "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "ANA PATRICIA SUESCA ROMERO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA PATRICIA SUESCA ROMERO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1771 / actualización Nº 219. Vigente hasta 2029-01-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7963133', phone),
      email       = COALESCE('fenix090972@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1771", "resolucion_actualizacion": "219", "fecha_inicio": "17-01-2024", "fecha_fin": "2029-01-16", "presidente": "ANA PATRICIA SUESCA ROMERO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sliders-1771';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '7963133', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOBRE RUEDAS BOGOTA  (IDRD-CLUB-sobre-ruedas-bogota-071)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sobre-ruedas-bogota-071';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOBRE RUEDAS BOGOTA',
      'Presidente: HIRLEZA VIZCANO VELEZ. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 071. Vigente hasta 2028-02-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '81240563016189482',
      'clubsobreruedasbogota@yahoo.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sobre-ruedas-bogota-071',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sobre-ruedas-bogota-071', v_school_id, '{"resolucion_rd": "071", "resolucion_actualizacion": null, "fecha_inicio": "08-02-2023", "fecha_fin": "2028-02-08", "presidente": "HIRLEZA VIZCANO VELEZ", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HIRLEZA VIZCANO VELEZ. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 071. Vigente hasta 2028-02-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('81240563016189482', phone),
      email       = COALESCE('clubsobreruedasbogota@yahoo.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "071", "resolucion_actualizacion": null, "fecha_inicio": "08-02-2023", "fecha_fin": "2028-02-08", "presidente": "HIRLEZA VIZCANO VELEZ", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sobre-ruedas-bogota-071';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '81240563016189482', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SOCCERS CRACKS  (IDRD-CLUB-club-deportivo-soccers-cracks-649)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-soccers-cracks-649';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SOCCERS CRACKS',
      'Presidente: CARLOS ARTURO LEON PRIETO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 649. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '4667572',
      'clubsoccerscracks@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-soccers-cracks-649',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-soccers-cracks-649', v_school_id, '{"resolucion_rd": "649", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "CARLOS ARTURO LEON PRIETO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO LEON PRIETO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 649. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4667572', phone),
      email       = COALESCE('clubsoccerscracks@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "649", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "CARLOS ARTURO LEON PRIETO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-soccers-cracks-649';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '4667572', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOCIAL ESTUDIANTES CIUDAD KENNEDY  (IDRD-CLUB-social-estudiantes-ciudad-kennedy-058)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-social-estudiantes-ciudad-kennedy-058';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOCIAL ESTUDIANTES CIUDAD KENNEDY',
      'Presidente: TITO ALEXANDER MALDONADO GOMEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 058 / actualización Nº 628. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3204325541',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'social-estudiantes-ciudad-kennedy-058',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-social-estudiantes-ciudad-kennedy-058', v_school_id, '{"resolucion_rd": "058", "resolucion_actualizacion": "628", "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "TITO ALEXANDER MALDONADO GOMEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: TITO ALEXANDER MALDONADO GOMEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 058 / actualización Nº 628. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204325541', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "058", "resolucion_actualizacion": "628", "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "TITO ALEXANDER MALDONADO GOMEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-social-estudiantes-ciudad-kennedy-058';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3204325541', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SOL Y LUNA  (IDRD-CLUB-sol-y-luna-388)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sol-y-luna-388';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SOL Y LUNA',
      'Presidente: ERIKA DEL PILAR MENDEZ MORENO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 388. Vigente hasta 2028-05-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3175122055',
      'patinajeartisticoclubsolyluna@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sol-y-luna-388',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sol-y-luna-388', v_school_id, '{"resolucion_rd": "388", "resolucion_actualizacion": null, "fecha_inicio": "02-05-2023", "fecha_fin": "2028-05-01", "presidente": "ERIKA DEL PILAR MENDEZ MORENO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ERIKA DEL PILAR MENDEZ MORENO. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 388. Vigente hasta 2028-05-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3175122055', phone),
      email       = COALESCE('patinajeartisticoclubsolyluna@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "388", "resolucion_actualizacion": null, "fecha_inicio": "02-05-2023", "fecha_fin": "2028-05-01", "presidente": "ERIKA DEL PILAR MENDEZ MORENO", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sol-y-luna-388';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3175122055', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SPARTA FC  (IDRD-CLUB-sparta-fc-1096)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sparta-fc-1096';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPARTA FC',
      'Presidente: CRISTIAN CAMILO PLAZAS PEDREROS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1096. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3204977484',
      'club.deportivosparta@htmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sparta-fc-1096',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sparta-fc-1096', v_school_id, '{"resolucion_rd": "1096", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "CRISTIAN CAMILO PLAZAS PEDREROS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN CAMILO PLAZAS PEDREROS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1096. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204977484', phone),
      email       = COALESCE('club.deportivosparta@htmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1096", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "CRISTIAN CAMILO PLAZAS PEDREROS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sparta-fc-1096';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3204977484', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ADN FAMILIA  (IDRD-CLUB-club-deportivo-adn-familia-1040)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-adn-familia-1040';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ADN FAMILIA',
      'Presidente: OSCAR DAVID RAMIREZ CASALLAS. Deporte(s): Tejo. Localidad: Puente Aranda. Resolución R-D Nº 1040. Vigente hasta 2030-09-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3138797463',
      'adnfamilia10@gmail.com',
      ARRAY['Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-adn-familia-1040',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-adn-familia-1040', v_school_id, '{"resolucion_rd": "1040", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2025", "fecha_fin": "2030-09-25", "presidente": "OSCAR DAVID RAMIREZ CASALLAS", "localidad": "Puente Aranda", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR DAVID RAMIREZ CASALLAS. Deporte(s): Tejo. Localidad: Puente Aranda. Resolución R-D Nº 1040. Vigente hasta 2030-09-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138797463', phone),
      email       = COALESCE('adnfamilia10@gmail.com', email),
      sports      = ARRAY['Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1040", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2025", "fecha_fin": "2030-09-25", "presidente": "OSCAR DAVID RAMIREZ CASALLAS", "localidad": "Puente Aranda", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-adn-familia-1040';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3138797463', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SPORTING CRISTAL CSDSC  (IDRD-CLUB-sporting-cristal-csdsc-1270)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sporting-cristal-csdsc-1270';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPORTING CRISTAL CSDSC',
      'Presidente: MARTHA ISABEL LESMES ESCUDERO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1270. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '6017816016',
      'cristal914@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sporting-cristal-csdsc-1270',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sporting-cristal-csdsc-1270', v_school_id, '{"resolucion_rd": "1270", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "MARTHA ISABEL LESMES ESCUDERO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTHA ISABEL LESMES ESCUDERO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1270. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6017816016', phone),
      email       = COALESCE('cristal914@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1270", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "MARTHA ISABEL LESMES ESCUDERO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sporting-cristal-csdsc-1270';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '6017816016', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MOTILONES FUTBOL CLUB  (IDRD-CLUB-club-deportivo-motilones-futbol-club-653)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-motilones-futbol-club-653';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MOTILONES FUTBOL CLUB',
      'Presidente: MIGUEL ALFONSO HERNANDEZ PEREZ. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 653. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3015864137',
      'futbolclubmotilones@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-motilones-futbol-club-653',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-motilones-futbol-club-653', v_school_id, '{"resolucion_rd": "653", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "MIGUEL ALFONSO HERNANDEZ PEREZ", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ALFONSO HERNANDEZ PEREZ. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 653. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3015864137', phone),
      email       = COALESCE('futbolclubmotilones@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "653", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "MIGUEL ALFONSO HERNANDEZ PEREZ", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-motilones-futbol-club-653';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3015864137', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SUBACUATIC BOGOTA CLUB  (IDRD-CLUB-subacuatic-bogota-club-1478)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-subacuatic-bogota-club-1478';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SUBACUATIC BOGOTA CLUB',
      'Presidente: CATALINA GOMEZ HURTADO. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 1478 / actualización Nº 679. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3004305219',
      'clubsubacuaticaletas2021@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'subacuatic-bogota-club-1478',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-subacuatic-bogota-club-1478', v_school_id, '{"resolucion_rd": "1478", "resolucion_actualizacion": "679", "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "CATALINA GOMEZ HURTADO", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CATALINA GOMEZ HURTADO. Deporte(s): Actividades Subacuaticas. Localidad: Teusaquillo. Resolución R-D Nº 1478 / actualización Nº 679. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3004305219', phone),
      email       = COALESCE('clubsubacuaticaletas2021@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1478", "resolucion_actualizacion": "679", "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "CATALINA GOMEZ HURTADO", "localidad": "Teusaquillo", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-subacuatic-bogota-club-1478';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3004305219', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TADAHIRO NOMURA  (IDRD-CLUB-tadahiro-nomura-1384)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tadahiro-nomura-1384';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TADAHIRO NOMURA',
      'Presidente: KAREN JOHANA MARTÃÂNEZ SEPULVEDA. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 1384. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3016159041',
      'clubtadahironomura@gmail.com',
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tadahiro-nomura-1384',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tadahiro-nomura-1384', v_school_id, '{"resolucion_rd": "1384", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "KAREN JOHANA MARTÃÂNEZ SEPULVEDA", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN JOHANA MARTÃÂNEZ SEPULVEDA. Deporte(s): Judo. Localidad: Engativá. Resolución R-D Nº 1384. Vigente hasta 2027-11-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3016159041', phone),
      email       = COALESCE('clubtadahironomura@gmail.com', email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1384", "resolucion_actualizacion": null, "fecha_inicio": "04-11-2022", "fecha_fin": "2027-11-04", "presidente": "KAREN JOHANA MARTÃÂNEZ SEPULVEDA", "localidad": "Engativá", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tadahiro-nomura-1384';
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
-- TAEBEK  (IDRD-CLUB-taebek-505)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taebek-505';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEBEK',
      'Presidente: AGUEDA JANETH SARMIENTO ESPINEL. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 505. Vigente hasta 2027-05-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '49668886594928',
      'janethtkd@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taebek-505',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taebek-505', v_school_id, '{"resolucion_rd": "505", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2022", "fecha_fin": "2027-05-19", "presidente": "AGUEDA JANETH SARMIENTO ESPINEL", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AGUEDA JANETH SARMIENTO ESPINEL. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 505. Vigente hasta 2027-05-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('49668886594928', phone),
      email       = COALESCE('janethtkd@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "505", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2022", "fecha_fin": "2027-05-19", "presidente": "AGUEDA JANETH SARMIENTO ESPINEL", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taebek-505';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '49668886594928', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TAEKWONDO SILA  (IDRD-CLUB-taekwondo-sila-082)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taekwondo-sila-082';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEKWONDO SILA',
      'Presidente: CAROLINA ARIAS. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 082. Vigente hasta 2027-01-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6907040',
      'carito1237@msm.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taekwondo-sila-082',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taekwondo-sila-082', v_school_id, '{"resolucion_rd": "082", "resolucion_actualizacion": null, "fecha_inicio": "28-01-2022", "fecha_fin": "2027-01-28", "presidente": "CAROLINA ARIAS", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAROLINA ARIAS. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 082. Vigente hasta 2027-01-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6907040', phone),
      email       = COALESCE('carito1237@msm.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "082", "resolucion_actualizacion": null, "fecha_inicio": "28-01-2022", "fecha_fin": "2027-01-28", "presidente": "CAROLINA ARIAS", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taekwondo-sila-082';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6907040', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TAEKWONDO ZEN  (IDRD-CLUB-taekwondo-zen-1170)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taekwondo-zen-1170';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEKWONDO ZEN',
      'Presidente: JUAN MANUEL SANTOS MORENO. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 1170 / actualización Nº 1273. Vigente hasta 2027-09-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '2772940',
      'juanmanuelsantosmoreno@tutopia.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taekwondo-zen-1170',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taekwondo-zen-1170', v_school_id, '{"resolucion_rd": "1170", "resolucion_actualizacion": "1273", "fecha_inicio": "26-09-2022", "fecha_fin": "2027-09-26", "presidente": "JUAN MANUEL SANTOS MORENO", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN MANUEL SANTOS MORENO. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 1170 / actualización Nº 1273. Vigente hasta 2027-09-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2772940', phone),
      email       = COALESCE('juanmanuelsantosmoreno@tutopia.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1170", "resolucion_actualizacion": "1273", "fecha_inicio": "26-09-2022", "fecha_fin": "2027-09-26", "presidente": "JUAN MANUEL SANTOS MORENO", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taekwondo-zen-1170';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '2772940', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TALENTO EN LINEA BOGOTA  (IDRD-CLUB-club-deportivo-talento-en-linea-bogota-853)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-talento-en-linea-bogota-853';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TALENTO EN LINEA BOGOTA',
      'Presidente: MARIA XIMENA BLANCO ROJAS. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 853. Vigente hasta 2030-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3112580309',
      'talentoenlineaok@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-talento-en-linea-bogota-853',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-talento-en-linea-bogota-853', v_school_id, '{"resolucion_rd": "853", "resolucion_actualizacion": null, "fecha_inicio": "14-08-2025", "fecha_fin": "2030-08-14", "presidente": "MARIA XIMENA BLANCO ROJAS", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA XIMENA BLANCO ROJAS. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 853. Vigente hasta 2030-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112580309', phone),
      email       = COALESCE('talentoenlineaok@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "853", "resolucion_actualizacion": null, "fecha_inicio": "14-08-2025", "fecha_fin": "2030-08-14", "presidente": "MARIA XIMENA BLANCO ROJAS", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-talento-en-linea-bogota-853';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3112580309', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TALENTOS DE BOGOTÃ  (IDRD-CLUB-club-deportivo-talentos-de-bogota-645)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-talentos-de-bogota-645';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TALENTOS DE BOGOTÃ',
      'Presidente: PEDRO DANIEL REY NOSSA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 645 / actualización Nº 1547. Vigente hasta 2027-07-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3219847054',
      'talentosdebogotaclubdeportivo@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-talentos-de-bogota-645',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-talentos-de-bogota-645', v_school_id, '{"resolucion_rd": "645", "resolucion_actualizacion": "1547", "fecha_inicio": "12-07-2022", "fecha_fin": "2027-07-12", "presidente": "PEDRO DANIEL REY NOSSA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO DANIEL REY NOSSA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 645 / actualización Nº 1547. Vigente hasta 2027-07-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219847054', phone),
      email       = COALESCE('talentosdebogotaclubdeportivo@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "645", "resolucion_actualizacion": "1547", "fecha_inicio": "12-07-2022", "fecha_fin": "2027-07-12", "presidente": "PEDRO DANIEL REY NOSSA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-talentos-de-bogota-645';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3219847054', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TALENTOS DE ORO  (IDRD-CLUB-club-deportivo-talentos-de-oro-959)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-talentos-de-oro-959';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TALENTOS DE ORO',
      'Presidente: LEYDI MILENA OLARTE GONZALEZ. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 959. Vigente hasta 2029-08-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3208678646',
      'talentosdeoro@outlook.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-talentos-de-oro-959',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-talentos-de-oro-959', v_school_id, '{"resolucion_rd": "959", "resolucion_actualizacion": null, "fecha_inicio": "23-08-2024", "fecha_fin": "2029-08-23", "presidente": "LEYDI MILENA OLARTE GONZALEZ", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEYDI MILENA OLARTE GONZALEZ. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 959. Vigente hasta 2029-08-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208678646', phone),
      email       = COALESCE('talentosdeoro@outlook.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "959", "resolucion_actualizacion": null, "fecha_inicio": "23-08-2024", "fecha_fin": "2029-08-23", "presidente": "LEYDI MILENA OLARTE GONZALEZ", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-talentos-de-oro-959';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3208678646', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TC 2.000 COLOMBIA  (IDRD-CLUB-club-deportivo-tc-2000-colombia-1202)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tc-2000-colombia-1202';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TC 2.000 COLOMBIA',
      'Presidente: AMANDA PAOLA OLIVEROS. Deporte(s): Automovilismo. Localidad: Suba. Resolución R-D Nº 1202. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3123927034',
      'administrativo@tc2000colombia.com.co',
      ARRAY['Automovilismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tc-2000-colombia-1202',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tc-2000-colombia-1202', v_school_id, '{"resolucion_rd": "1202", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "AMANDA PAOLA OLIVEROS", "localidad": "Suba", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AMANDA PAOLA OLIVEROS. Deporte(s): Automovilismo. Localidad: Suba. Resolución R-D Nº 1202. Vigente hasta 2030-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123927034', phone),
      email       = COALESCE('administrativo@tc2000colombia.com.co', email),
      sports      = ARRAY['Automovilismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1202", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2025", "fecha_fin": "2030-10-28", "presidente": "AMANDA PAOLA OLIVEROS", "localidad": "Suba", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tc-2000-colombia-1202';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3123927034', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ELIZALDE F.C  (IDRD-CLUB-elizalde-fc-097)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-elizalde-fc-097';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ELIZALDE F.C',
      'Presidente: WILBER ANDERSON ELISALDE JAIMES. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 097. Vigente hasta 2027-02-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3167819659',
      'wlber06@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'elizalde-fc-097',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-elizalde-fc-097', v_school_id, '{"resolucion_rd": "097", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2022", "fecha_fin": "2027-02-03", "presidente": "WILBER ANDERSON ELISALDE JAIMES", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILBER ANDERSON ELISALDE JAIMES. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 097. Vigente hasta 2027-02-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3167819659', phone),
      email       = COALESCE('wlber06@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "097", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2022", "fecha_fin": "2027-02-03", "presidente": "WILBER ANDERSON ELISALDE JAIMES", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-elizalde-fc-097';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3167819659', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TEQUENDAMA AC  (IDRD-CLUB-tequendama-ac-024)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tequendama-ac-024';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TEQUENDAMA AC',
      'Presidente: ANWAR FRANCISCO CARDENAS ROZO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 024. Vigente hasta 2027-01-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '80483283112545731',
      'anwarfcr@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tequendama-ac-024',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tequendama-ac-024', v_school_id, '{"resolucion_rd": "024", "resolucion_actualizacion": null, "fecha_inicio": "13-01-2022", "fecha_fin": "2027-01-13", "presidente": "ANWAR FRANCISCO CARDENAS ROZO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANWAR FRANCISCO CARDENAS ROZO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 024. Vigente hasta 2027-01-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('80483283112545731', phone),
      email       = COALESCE('anwarfcr@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "024", "resolucion_actualizacion": null, "fecha_inicio": "13-01-2022", "fecha_fin": "2027-01-13", "presidente": "ANWAR FRANCISCO CARDENAS ROZO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tequendama-ac-024';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '80483283112545731', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO THE PADDLER  (IDRD-CLUB-club-deportivo-the-paddler-1530)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-the-paddler-1530';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO THE PADDLER',
      'Presidente: YHORELY PATRICIA CARDENAS MOYA. Deporte(s): Canotaje. Localidad: Engativá. Resolución R-D Nº 1530. Vigente hasta 2030-01-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3229324709',
      'clubthepaddlerbogota@gmail.com',
      ARRAY['Canotaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-the-paddler-1530',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-the-paddler-1530', v_school_id, '{"resolucion_rd": "1530", "resolucion_actualizacion": null, "fecha_inicio": "10-01-2025", "fecha_fin": "2030-01-10", "presidente": "YHORELY PATRICIA CARDENAS MOYA", "localidad": "Engativá", "sports": ["Canotaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YHORELY PATRICIA CARDENAS MOYA. Deporte(s): Canotaje. Localidad: Engativá. Resolución R-D Nº 1530. Vigente hasta 2030-01-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3229324709', phone),
      email       = COALESCE('clubthepaddlerbogota@gmail.com', email),
      sports      = ARRAY['Canotaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1530", "resolucion_actualizacion": null, "fecha_inicio": "10-01-2025", "fecha_fin": "2030-01-10", "presidente": "YHORELY PATRICIA CARDENAS MOYA", "localidad": "Engativá", "sports": ["Canotaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-the-paddler-1530';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3229324709', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TITANES SUB  (IDRD-CLUB-titanes-sub-1308)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-titanes-sub-1308';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TITANES SUB',
      'Presidente: PAOLA ANDREA SERNA CRISTANCHO. Deporte(s): Actividades Subacuaticas. Localidad: Suba. Resolución R-D Nº 1308. Vigente hasta 2027-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6012105054',
      'titanes.uwh@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'titanes-sub-1308',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-titanes-sub-1308', v_school_id, '{"resolucion_rd": "1308", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2022", "fecha_fin": "2027-10-19", "presidente": "PAOLA ANDREA SERNA CRISTANCHO", "localidad": "Suba", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAOLA ANDREA SERNA CRISTANCHO. Deporte(s): Actividades Subacuaticas. Localidad: Suba. Resolución R-D Nº 1308. Vigente hasta 2027-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6012105054', phone),
      email       = COALESCE('titanes.uwh@gmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1308", "resolucion_actualizacion": null, "fecha_inicio": "19-10-2022", "fecha_fin": "2027-10-19", "presidente": "PAOLA ANDREA SERNA CRISTANCHO", "localidad": "Suba", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-titanes-sub-1308';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6012105054', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TODO TERRENO TRACK  (IDRD-CLUB-todo-terreno-track-1193)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-todo-terreno-track-1193';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TODO TERRENO TRACK',
      'Presidente: ANDRES ROBERTO MEJIA AZUERO. Deporte(s): Motociclismo. Localidad: Usaquén. Resolución R-D Nº 1193. Vigente hasta 2027-09-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3102035184',
      'todoterrenotrack@hotmail.com',
      ARRAY['Motociclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'todo-terreno-track-1193',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-todo-terreno-track-1193', v_school_id, '{"resolucion_rd": "1193", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2022", "fecha_fin": "2027-09-19", "presidente": "ANDRES ROBERTO MEJIA AZUERO", "localidad": "Usaquén", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES ROBERTO MEJIA AZUERO. Deporte(s): Motociclismo. Localidad: Usaquén. Resolución R-D Nº 1193. Vigente hasta 2027-09-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102035184', phone),
      email       = COALESCE('todoterrenotrack@hotmail.com', email),
      sports      = ARRAY['Motociclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1193", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2022", "fecha_fin": "2027-09-19", "presidente": "ANDRES ROBERTO MEJIA AZUERO", "localidad": "Usaquén", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-todo-terreno-track-1193';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3102035184', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TORREFUERTE  (IDRD-CLUB-club-deportivo-torrefuerte-7)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-torrefuerte-7';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TORREFUERTE',
      'Presidente: DIEGO ALEJANDRO SANDOVAL NARANJO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 7. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '75652273203865879',
      'club_torre_fuerte@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-torrefuerte-7',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-torrefuerte-7', v_school_id, '{"resolucion_rd": "7", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "DIEGO ALEJANDRO SANDOVAL NARANJO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ALEJANDRO SANDOVAL NARANJO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 7. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('75652273203865879', phone),
      email       = COALESCE('club_torre_fuerte@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "7", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "DIEGO ALEJANDRO SANDOVAL NARANJO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-torrefuerte-7';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '75652273203865879', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TRITON BOGOTA  (IDRD-CLUB-triton-bogota-1663)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-triton-bogota-1663';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TRITON BOGOTA',
      'Presidente: SANDRA XIMENA CARMONA GRANADOS. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 1663. Vigente hasta 2028-12-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3158816151',
      'clubtritonbogota@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'triton-bogota-1663',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-triton-bogota-1663', v_school_id, '{"resolucion_rd": "1663", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2023", "fecha_fin": "2028-12-26", "presidente": "SANDRA XIMENA CARMONA GRANADOS", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA XIMENA CARMONA GRANADOS. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 1663. Vigente hasta 2028-12-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158816151', phone),
      email       = COALESCE('clubtritonbogota@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1663", "resolucion_actualizacion": null, "fecha_inicio": "27-12-2023", "fecha_fin": "2028-12-26", "presidente": "SANDRA XIMENA CARMONA GRANADOS", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-triton-bogota-1663';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3158816151', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MTB SAN BENITO  (IDRD-CLUB-club-deportivo-mtb-san-benito-063)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-mtb-san-benito-063';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MTB SAN BENITO',
      'Presidente: MARCO TULIO BUSTAMANTE MARIN. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 063. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3102237178',
      'marctbustamante@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-mtb-san-benito-063',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-mtb-san-benito-063', v_school_id, '{"resolucion_rd": "063", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "MARCO TULIO BUSTAMANTE MARIN", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCO TULIO BUSTAMANTE MARIN. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 063. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102237178', phone),
      email       = COALESCE('marctbustamante@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "063", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "MARCO TULIO BUSTAMANTE MARIN", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-mtb-san-benito-063';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3102237178', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- UNION BOSA  (IDRD-CLUB-union-bosa-1698)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-union-bosa-1698';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'UNION BOSA',
      'Presidente: LIDA ZULUAGA CARDONA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1698. Vigente hasta 2027-12-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3165785009',
      'club.unionbosa@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'union-bosa-1698',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-union-bosa-1698', v_school_id, '{"resolucion_rd": "1698", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2022", "fecha_fin": "2027-12-23", "presidente": "LIDA ZULUAGA CARDONA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LIDA ZULUAGA CARDONA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1698. Vigente hasta 2027-12-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165785009', phone),
      email       = COALESCE('club.unionbosa@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1698", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2022", "fecha_fin": "2027-12-23", "presidente": "LIDA ZULUAGA CARDONA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-union-bosa-1698';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3165785009', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- UNION CAPITAL TUNAL  (IDRD-CLUB-union-capital-tunal-1432)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-union-capital-tunal-1432';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'UNION CAPITAL TUNAL',
      'Presidente: DINA MARCELA GONZALEZ ACOSTA. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1432. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3006169589',
      'dimagoac@yahoo.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'union-capital-tunal-1432',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-union-capital-tunal-1432', v_school_id, '{"resolucion_rd": "1432", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "DINA MARCELA GONZALEZ ACOSTA", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DINA MARCELA GONZALEZ ACOSTA. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1432. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006169589', phone),
      email       = COALESCE('dimagoac@yahoo.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1432", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "DINA MARCELA GONZALEZ ACOSTA", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-union-capital-tunal-1432';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3006169589', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO V.B. FENERBAHCE  (IDRD-CLUB-club-deportivo-vb-fenerbahce-249)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-vb-fenerbahce-249';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO V.B. FENERBAHCE',
      'Presidente: IVONNE ADRIANA GOMEZ COLORADO. Deporte(s): Voleibol. Localidad: Suba. Resolución R-D Nº 249 / actualización Nº 258. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '60192086773219887524',
      'fenerbahcecoleyclub@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-vb-fenerbahce-249',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-vb-fenerbahce-249', v_school_id, '{"resolucion_rd": "249", "resolucion_actualizacion": "258", "fecha_inicio": "06-03-2024", "fecha_fin": "2029-03-06", "presidente": "IVONNE ADRIANA GOMEZ COLORADO", "localidad": "Suba", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVONNE ADRIANA GOMEZ COLORADO. Deporte(s): Voleibol. Localidad: Suba. Resolución R-D Nº 249 / actualización Nº 258. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('60192086773219887524', phone),
      email       = COALESCE('fenerbahcecoleyclub@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "249", "resolucion_actualizacion": "258", "fecha_inicio": "06-03-2024", "fecha_fin": "2029-03-06", "presidente": "IVONNE ADRIANA GOMEZ COLORADO", "localidad": "Suba", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-vb-fenerbahce-249';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '60192086773219887524', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA ÃÂNGELES BOGOTÃÂ T7  (IDRD-CLUB-club-deportivo-academia-aangeles-bogotaa-1057)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-aangeles-bogotaa-1057';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA ÃÂNGELES BOGOTÃÂ T7',
      'Presidente: YULI ANDREA MUÃâOZ TRUJILLO. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 1057. Vigente hasta 2030-10-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3053483812',
      'angelesbogotadcacademia@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-aangeles-bogotaa-1057',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-aangeles-bogotaa-1057', v_school_id, '{"resolucion_rd": "1057", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2025", "fecha_fin": "2030-10-07", "presidente": "YULI ANDREA MUÃâOZ TRUJILLO", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YULI ANDREA MUÃâOZ TRUJILLO. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 1057. Vigente hasta 2030-10-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3053483812', phone),
      email       = COALESCE('angelesbogotadcacademia@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1057", "resolucion_actualizacion": null, "fecha_inicio": "07-10-2025", "fecha_fin": "2030-10-07", "presidente": "YULI ANDREA MUÃâOZ TRUJILLO", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-aangeles-bogotaa-1057';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3053483812', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VALMOS BOGOTA  (IDRD-CLUB-valmos-bogota-148)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-valmos-bogota-148';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VALMOS BOGOTA',
      'Presidente: JOSE LUIS VALENCIA MOSQUERA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 148. Vigente hasta 2027-02-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '59494592041105',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'valmos-bogota-148',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-valmos-bogota-148', v_school_id, '{"resolucion_rd": "148", "resolucion_actualizacion": null, "fecha_inicio": "17-02-2022", "fecha_fin": "2027-02-17", "presidente": "JOSE LUIS VALENCIA MOSQUERA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS VALENCIA MOSQUERA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 148. Vigente hasta 2027-02-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('59494592041105', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "148", "resolucion_actualizacion": null, "fecha_inicio": "17-02-2022", "fecha_fin": "2027-02-17", "presidente": "JOSE LUIS VALENCIA MOSQUERA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-valmos-bogota-148';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '59494592041105', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VERONA FC  (IDRD-CLUB-verona-fc-1522)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-verona-fc-1522';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VERONA FC',
      'Presidente: MARIA VICTORIA RODRIGUEZ MARTINEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1522. Vigente hasta 2028-12-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3154507053',
      'erixanteliz@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'verona-fc-1522',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-verona-fc-1522', v_school_id, '{"resolucion_rd": "1522", "resolucion_actualizacion": null, "fecha_inicio": "07-12-2023", "fecha_fin": "2028-12-06", "presidente": "MARIA VICTORIA RODRIGUEZ MARTINEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA VICTORIA RODRIGUEZ MARTINEZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1522. Vigente hasta 2028-12-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3154507053', phone),
      email       = COALESCE('erixanteliz@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1522", "resolucion_actualizacion": null, "fecha_inicio": "07-12-2023", "fecha_fin": "2028-12-06", "presidente": "MARIA VICTORIA RODRIGUEZ MARTINEZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-verona-fc-1522';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3154507053', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VILLA MAYOR  (IDRD-CLUB-villa-mayor-300)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-villa-mayor-300';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VILLA MAYOR',
      'Presidente: LUIS EDUARDO ARANDA POVEDA. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 300. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '20271752035511',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'villa-mayor-300',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-villa-mayor-300', v_school_id, '{"resolucion_rd": "300", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "LUIS EDUARDO ARANDA POVEDA", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS EDUARDO ARANDA POVEDA. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 300. Vigente hasta 2027-04-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('20271752035511', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "300", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2022", "fecha_fin": "2027-04-01", "presidente": "LUIS EDUARDO ARANDA POVEDA", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-villa-mayor-300';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '20271752035511', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TOUT C.D.  (IDRD-CLUB-club-deportivo-tout-cd-313)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tout-cd-313';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TOUT C.D.',
      'Presidente: JUAN SEBASTIAN PULIDO PINZON. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 313. Vigente hasta 2030-04-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '60180017183138850072',
      'jpulidopinzon@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tout-cd-313',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tout-cd-313', v_school_id, '{"resolucion_rd": "313", "resolucion_actualizacion": null, "fecha_inicio": "08-04-2025", "fecha_fin": "2030-04-08", "presidente": "JUAN SEBASTIAN PULIDO PINZON", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIAN PULIDO PINZON. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 313. Vigente hasta 2030-04-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('60180017183138850072', phone),
      email       = COALESCE('jpulidopinzon@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "313", "resolucion_actualizacion": null, "fecha_inicio": "08-04-2025", "fecha_fin": "2030-04-08", "presidente": "JUAN SEBASTIAN PULIDO PINZON", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tout-cd-313';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '60180017183138850072', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WEMBLEY  (IDRD-CLUB-club-deportivo-wembley-1980)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-wembley-1980';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WEMBLEY',
      'Presidente: ROBINSON RODRIGO TORRES TORRES. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1980. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3163398593',
      'futbolwembley@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-wembley-1980',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-wembley-1980', v_school_id, '{"resolucion_rd": "1980", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "ROBINSON RODRIGO TORRES TORRES", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROBINSON RODRIGO TORRES TORRES. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1980. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3163398593', phone),
      email       = COALESCE('futbolwembley@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1980", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "ROBINSON RODRIGO TORRES TORRES", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-wembley-1980';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3163398593', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO XSPEED RACING CLUB  (IDRD-CLUB-club-deportivo-xspeed-racing-club-495)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-xspeed-racing-club-495';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO XSPEED RACING CLUB',
      'Presidente: JORGE VLADIMIR PULIDO TOVAR. Deporte(s): Motociclismo. Localidad: Suba. Resolución R-D Nº 495. Vigente hasta 2029-04-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '2539857',
      'xspeedracingclub@gmail.com',
      ARRAY['Motociclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-xspeed-racing-club-495',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-xspeed-racing-club-495', v_school_id, '{"resolucion_rd": "495", "resolucion_actualizacion": null, "fecha_inicio": "22-04-2024", "fecha_fin": "2029-04-22", "presidente": "JORGE VLADIMIR PULIDO TOVAR", "localidad": "Suba", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE VLADIMIR PULIDO TOVAR. Deporte(s): Motociclismo. Localidad: Suba. Resolución R-D Nº 495. Vigente hasta 2029-04-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2539857', phone),
      email       = COALESCE('xspeedracingclub@gmail.com', email),
      sports      = ARRAY['Motociclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "495", "resolucion_actualizacion": null, "fecha_inicio": "22-04-2024", "fecha_fin": "2029-04-22", "presidente": "JORGE VLADIMIR PULIDO TOVAR", "localidad": "Suba", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-xspeed-racing-club-495';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '2539857', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ZAGGA VOLLEY  (IDRD-CLUB-zagga-volley-1104)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-zagga-volley-1104';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ZAGGA VOLLEY',
      'Presidente: SALVADOR MENDOZA CASTILLO. Deporte(s): Voleibol. Localidad: Puente Aranda. Resolución R-D Nº 1104 / actualización Nº 411. Vigente hasta 2026-12-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3103482722',
      'zaggavoley@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'zagga-volley-1104',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-zagga-volley-1104', v_school_id, '{"resolucion_rd": "1104", "resolucion_actualizacion": "411", "fecha_inicio": "13-12-2021", "fecha_fin": "2026-12-13", "presidente": "SALVADOR MENDOZA CASTILLO", "localidad": "Puente Aranda", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SALVADOR MENDOZA CASTILLO. Deporte(s): Voleibol. Localidad: Puente Aranda. Resolución R-D Nº 1104 / actualización Nº 411. Vigente hasta 2026-12-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103482722', phone),
      email       = COALESCE('zaggavoley@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1104", "resolucion_actualizacion": "411", "fecha_inicio": "13-12-2021", "fecha_fin": "2026-12-13", "presidente": "SALVADOR MENDOZA CASTILLO", "localidad": "Puente Aranda", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-zagga-volley-1104';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3103482722', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ZEN DUK KWAN  (IDRD-CLUB-club-deportivo-zen-duk-kwan-1168)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-zen-duk-kwan-1168';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ZEN DUK KWAN',
      'Presidente: JOSÃ ALFREDO BERNAL PINILLA. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 1168. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3015758585',
      'alfredobernalp@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-zen-duk-kwan-1168',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-zen-duk-kwan-1168', v_school_id, '{"resolucion_rd": "1168", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "JOSÃ ALFREDO BERNAL PINILLA", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃ ALFREDO BERNAL PINILLA. Deporte(s): Taekwondo. Localidad: Puente Aranda. Resolución R-D Nº 1168. Vigente hasta 2029-08-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3015758585', phone),
      email       = COALESCE('alfredobernalp@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1168", "resolucion_actualizacion": null, "fecha_inicio": "27-08-2024", "fecha_fin": "2029-08-27", "presidente": "JOSÃ ALFREDO BERNAL PINILLA", "localidad": "Puente Aranda", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-zen-duk-kwan-1168';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3015758585', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ZEPPELIN RUGBY CLUB Ã¢â¬â ZRC  (IDRD-CLUB-zeppelin-rugby-club-aaa-zrc-414)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-zeppelin-rugby-club-aaa-zrc-414';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ZEPPELIN RUGBY CLUB Ã¢â¬â ZRC',
      'Presidente: SANTIAGO FRANCISCO DE ASIS JIMENEZ QUIJANO. Deporte(s): Rugby. Localidad: Puente Aranda. Resolución R-D Nº 414. Vigente hasta 2027-05-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3700220',
      'zeppelinrc@gmail.com',
      ARRAY['Rugby']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'zeppelin-rugby-club-aaa-zrc-414',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-zeppelin-rugby-club-aaa-zrc-414', v_school_id, '{"resolucion_rd": "414", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2022", "fecha_fin": "2027-05-04", "presidente": "SANTIAGO FRANCISCO DE ASIS JIMENEZ QUIJANO", "localidad": "Puente Aranda", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO FRANCISCO DE ASIS JIMENEZ QUIJANO. Deporte(s): Rugby. Localidad: Puente Aranda. Resolución R-D Nº 414. Vigente hasta 2027-05-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3700220', phone),
      email       = COALESCE('zeppelinrc@gmail.com', email),
      sports      = ARRAY['Rugby']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "414", "resolucion_actualizacion": null, "fecha_inicio": "04-05-2022", "fecha_fin": "2027-05-04", "presidente": "SANTIAGO FRANCISCO DE ASIS JIMENEZ QUIJANO", "localidad": "Puente Aranda", "sports": ["Rugby"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-zeppelin-rugby-club-aaa-zrc-414';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3700220', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE ESCALADA DEPORTIVA ZONA DE BLOQUE  (IDRD-CLUB-club-de-escalada-deportiva-zona-de-bloqu-498)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-escalada-deportiva-zona-de-bloqu-498';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE ESCALADA DEPORTIVA ZONA DE BLOQUE',
      'Presidente: JUAN SEBASTIAN ARBOLEDA HENAO. Deporte(s): Escalada Deportiva. Localidad: Teusaquillo. Resolución R-D Nº 498 / actualización Nº 498. Vigente hasta 2027-09-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '6268875',
      'zonadebloque@yahoo.com',
      ARRAY['Escalada Deportiva']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-escalada-deportiva-zona-de-bloqu-498',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-escalada-deportiva-zona-de-bloqu-498', v_school_id, '{"resolucion_rd": "498", "resolucion_actualizacion": "498", "fecha_inicio": "28-09-2022", "fecha_fin": "2027-09-28", "presidente": "JUAN SEBASTIAN ARBOLEDA HENAO", "localidad": "Teusaquillo", "sports": ["Escalada Deportiva"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIAN ARBOLEDA HENAO. Deporte(s): Escalada Deportiva. Localidad: Teusaquillo. Resolución R-D Nº 498 / actualización Nº 498. Vigente hasta 2027-09-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6268875', phone),
      email       = COALESCE('zonadebloque@yahoo.com', email),
      sports      = ARRAY['Escalada Deportiva']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "498", "resolucion_actualizacion": "498", "fecha_inicio": "28-09-2022", "fecha_fin": "2027-09-28", "presidente": "JUAN SEBASTIAN ARBOLEDA HENAO", "localidad": "Teusaquillo", "sports": ["Escalada Deportiva"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-escalada-deportiva-zona-de-bloqu-498';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '6268875', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- C.S.D. COPAVI  (IDRD-CLUB-csd-copavi-550)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-csd-copavi-550';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'C.S.D. COPAVI',
      'Presidente: VICTOR MANUEL PARAMO PEREZ. Deporte(s): Fútbol, Patinaje, Natación. Localidad: San Cristóbal. Resolución R-D Nº 550. Vigente hasta 2027-06-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3643150',
      NULL,
      ARRAY['Fútbol','Patinaje','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'csd-copavi-550',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-csd-copavi-550', v_school_id, '{"resolucion_rd": "550", "resolucion_actualizacion": null, "fecha_inicio": "01-06-2022", "fecha_fin": "2027-06-01", "presidente": "VICTOR MANUEL PARAMO PEREZ", "localidad": "San Cristóbal", "sports": ["Fútbol", "Patinaje", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR MANUEL PARAMO PEREZ. Deporte(s): Fútbol, Patinaje, Natación. Localidad: San Cristóbal. Resolución R-D Nº 550. Vigente hasta 2027-06-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3643150', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol','Patinaje','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "550", "resolucion_actualizacion": null, "fecha_inicio": "01-06-2022", "fecha_fin": "2027-06-01", "presidente": "VICTOR MANUEL PARAMO PEREZ", "localidad": "San Cristóbal", "sports": ["Fútbol", "Patinaje", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-csd-copavi-550';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3643150', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FORZA METROFUTBOL  (IDRD-CLUB-club-deportivo-forza-metrofutbol-618)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-forza-metrofutbol-618';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FORZA METROFUTBOL',
      'Presidente: ERNESTO HERNANDEZ POVEDA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 618 / actualización Nº 1437. Vigente hasta 2026-08-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3123253334',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-forza-metrofutbol-618',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-forza-metrofutbol-618', v_school_id, '{"resolucion_rd": "618", "resolucion_actualizacion": "1437", "fecha_inicio": "17-08-2021", "fecha_fin": "2026-08-17", "presidente": "ERNESTO HERNANDEZ POVEDA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ERNESTO HERNANDEZ POVEDA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 618 / actualización Nº 1437. Vigente hasta 2026-08-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123253334', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "618", "resolucion_actualizacion": "1437", "fecha_inicio": "17-08-2021", "fecha_fin": "2026-08-17", "presidente": "ERNESTO HERNANDEZ POVEDA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-forza-metrofutbol-618';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3123253334', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ALBERTO ZAMORA F.C.  (IDRD-CLUB-alberto-zamora-fc-175)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-alberto-zamora-fc-175';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ALBERTO ZAMORA F.C.',
      'Presidente: MARIA DEL PILAR HERNANDEZ LOZANO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 175. Vigente hasta 2027-02-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3167908165',
      'mhariamhl@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'alberto-zamora-fc-175',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-alberto-zamora-fc-175', v_school_id, '{"resolucion_rd": "175", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2022", "fecha_fin": "2027-02-24", "presidente": "MARIA DEL PILAR HERNANDEZ LOZANO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA DEL PILAR HERNANDEZ LOZANO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 175. Vigente hasta 2027-02-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3167908165', phone),
      email       = COALESCE('mhariamhl@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "175", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2022", "fecha_fin": "2027-02-24", "presidente": "MARIA DEL PILAR HERNANDEZ LOZANO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-alberto-zamora-fc-175';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3167908165', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE TIRO PCB  (IDRD-CLUB-club-de-tiro-pcb-063)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-tiro-pcb-063';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE TIRO PCB',
      'Presidente: GUIDO LASTRA GONZALEZ. Deporte(s): Tiro deportivo. Localidad: Barrios Unidos. Resolución R-D Nº 063. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3142185222',
      'clubdetiropcb@gmail.com',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-tiro-pcb-063',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-tiro-pcb-063', v_school_id, '{"resolucion_rd": "063", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "GUIDO LASTRA GONZALEZ", "localidad": "Barrios Unidos", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GUIDO LASTRA GONZALEZ. Deporte(s): Tiro deportivo. Localidad: Barrios Unidos. Resolución R-D Nº 063. Vigente hasta 2028-02-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142185222', phone),
      email       = COALESCE('clubdetiropcb@gmail.com', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "063", "resolucion_actualizacion": null, "fecha_inicio": "07-02-2023", "fecha_fin": "2028-02-07", "presidente": "GUIDO LASTRA GONZALEZ", "localidad": "Barrios Unidos", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-tiro-pcb-063';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3142185222', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KYUNGKWAN II BOGOTÃÆÃÂ  (IDRD-CLUB-kyungkwan-ii-bogotaaa-336)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kyungkwan-ii-bogotaaa-336';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KYUNGKWAN II BOGOTÃÆÃÂ',
      'Presidente: RAUL BELLO MENDIVELSO. Deporte(s): Hapkido. Localidad: Suba. Resolución R-D Nº 336. Vigente hasta 2028-04-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3162561131',
      'raubello@hotmail.com',
      ARRAY['Hapkido']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kyungkwan-ii-bogotaaa-336',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kyungkwan-ii-bogotaaa-336', v_school_id, '{"resolucion_rd": "336", "resolucion_actualizacion": null, "fecha_inicio": "17-04-2023", "fecha_fin": "2028-04-16", "presidente": "RAUL BELLO MENDIVELSO", "localidad": "Suba", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RAUL BELLO MENDIVELSO. Deporte(s): Hapkido. Localidad: Suba. Resolución R-D Nº 336. Vigente hasta 2028-04-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3162561131', phone),
      email       = COALESCE('raubello@hotmail.com', email),
      sports      = ARRAY['Hapkido']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "336", "resolucion_actualizacion": null, "fecha_inicio": "17-04-2023", "fecha_fin": "2028-04-16", "presidente": "RAUL BELLO MENDIVELSO", "localidad": "Suba", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kyungkwan-ii-bogotaaa-336';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3162561131', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORT BOGOTA FC  (IDRD-CLUB-club-deportivo-sport-bogota-fc-660)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-bogota-fc-660';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORT BOGOTA FC',
      'Presidente: WILLIAM MORENO CUTA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 660 / actualización Nº 1970. Vigente hasta 2026-09-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3212001505',
      'sportbogotafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sport-bogota-fc-660',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sport-bogota-fc-660', v_school_id, '{"resolucion_rd": "660", "resolucion_actualizacion": "1970", "fecha_inicio": "15-09-2021", "fecha_fin": "2026-09-15", "presidente": "WILLIAM MORENO CUTA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM MORENO CUTA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 660 / actualización Nº 1970. Vigente hasta 2026-09-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212001505', phone),
      email       = COALESCE('sportbogotafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "660", "resolucion_actualizacion": "1970", "fecha_inicio": "15-09-2021", "fecha_fin": "2026-09-15", "presidente": "WILLIAM MORENO CUTA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-bogota-fc-660';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3212001505', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COMPARTIR BOGOTA  (IDRD-CLUB-compartir-bogota-1002)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-compartir-bogota-1002';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COMPARTIR BOGOTA',
      'Presidente: HUGO FERNANDO JIMENEZ JIMENEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1002. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3192885958',
      'compartir_escueladeformacion@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'compartir-bogota-1002',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-compartir-bogota-1002', v_school_id, '{"resolucion_rd": "1002", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "HUGO FERNANDO JIMENEZ JIMENEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HUGO FERNANDO JIMENEZ JIMENEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1002. Vigente hasta 2026-11-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3192885958', phone),
      email       = COALESCE('compartir_escueladeformacion@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1002", "resolucion_actualizacion": null, "fecha_inicio": "29-11-2021", "fecha_fin": "2026-11-29", "presidente": "HUGO FERNANDO JIMENEZ JIMENEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-compartir-bogota-1002';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3192885958', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE BALONMANO TIGRES  (IDRD-CLUB-de-balonmano-tigres-553)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-balonmano-tigres-553';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE BALONMANO TIGRES',
      'Presidente: RICARDO GONZALEZ TORRES. Deporte(s): Balonmano. Localidad: Suba. Resolución R-D Nº 553. Vigente hasta 2026-07-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6702860',
      'rigoto1@hotmail.com',
      ARRAY['Balonmano']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-balonmano-tigres-553',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-balonmano-tigres-553', v_school_id, '{"resolucion_rd": "553", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2021", "fecha_fin": "2026-07-19", "presidente": "RICARDO GONZALEZ TORRES", "localidad": "Suba", "sports": ["Balonmano"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICARDO GONZALEZ TORRES. Deporte(s): Balonmano. Localidad: Suba. Resolución R-D Nº 553. Vigente hasta 2026-07-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6702860', phone),
      email       = COALESCE('rigoto1@hotmail.com', email),
      sports      = ARRAY['Balonmano']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "553", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2021", "fecha_fin": "2026-07-19", "presidente": "RICARDO GONZALEZ TORRES", "localidad": "Suba", "sports": ["Balonmano"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-balonmano-tigres-553';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6702860', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GRAVEDAD 9.8.  (IDRD-CLUB-gravedad-98-1374)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gravedad-98-1374';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GRAVEDAD 9.8.',
      'Presidente: LUIS ALBERTO MATIZ AGUDELO. Deporte(s): Escalada Deportiva. Localidad: Barrios Unidos. Resolución R-D Nº 1374. Vigente hasta 2028-11-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3187228711',
      'cdgravedad9.8@gmail.com',
      ARRAY['Escalada Deportiva']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gravedad-98-1374',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gravedad-98-1374', v_school_id, '{"resolucion_rd": "1374", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2023", "fecha_fin": "2028-11-07", "presidente": "LUIS ALBERTO MATIZ AGUDELO", "localidad": "Barrios Unidos", "sports": ["Escalada Deportiva"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALBERTO MATIZ AGUDELO. Deporte(s): Escalada Deportiva. Localidad: Barrios Unidos. Resolución R-D Nº 1374. Vigente hasta 2028-11-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187228711', phone),
      email       = COALESCE('cdgravedad9.8@gmail.com', email),
      sports      = ARRAY['Escalada Deportiva']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1374", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2023", "fecha_fin": "2028-11-07", "presidente": "LUIS ALBERTO MATIZ AGUDELO", "localidad": "Barrios Unidos", "sports": ["Escalada Deportiva"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gravedad-98-1374';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3187228711', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FENIX OILERS  (IDRD-CLUB-fenix-oilers-656)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fenix-oilers-656';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FENIX OILERS',
      'Presidente: DANIEL RICARDO TEJADA RUBIO. Deporte(s): Baloncesto. Localidad: Ciudad Bolívar. Resolución R-D Nº 656. Vigente hasta 2028-06-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '81140443124994059',
      'danielricardotejada@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fenix-oilers-656',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fenix-oilers-656', v_school_id, '{"resolucion_rd": "656", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2023", "fecha_fin": "2028-06-20", "presidente": "DANIEL RICARDO TEJADA RUBIO", "localidad": "Ciudad Bolívar", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL RICARDO TEJADA RUBIO. Deporte(s): Baloncesto. Localidad: Ciudad Bolívar. Resolución R-D Nº 656. Vigente hasta 2028-06-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('81140443124994059', phone),
      email       = COALESCE('danielricardotejada@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "656", "resolucion_actualizacion": null, "fecha_inicio": "21-06-2023", "fecha_fin": "2028-06-20", "presidente": "DANIEL RICARDO TEJADA RUBIO", "localidad": "Ciudad Bolívar", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fenix-oilers-656';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '81140443124994059', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- EMPRENDEDORES  (IDRD-CLUB-emprendedores-809)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-emprendedores-809';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'EMPRENDEDORES',
      'Presidente: OMAR CASTRO MAHECHA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 809. Vigente hasta 2027-08-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '4025266',
      'omarcastromaecha@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'emprendedores-809',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-emprendedores-809', v_school_id, '{"resolucion_rd": "809", "resolucion_actualizacion": null, "fecha_inicio": "08-08-2022", "fecha_fin": "2027-08-08", "presidente": "OMAR CASTRO MAHECHA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OMAR CASTRO MAHECHA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 809. Vigente hasta 2027-08-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4025266', phone),
      email       = COALESCE('omarcastromaecha@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "809", "resolucion_actualizacion": null, "fecha_inicio": "08-08-2022", "fecha_fin": "2027-08-08", "presidente": "OMAR CASTRO MAHECHA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-emprendedores-809';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '4025266', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FALCONS BASKETBALL CLUB  (IDRD-CLUB-falcons-basketball-club-486)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-falcons-basketball-club-486';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FALCONS BASKETBALL CLUB',
      'Presidente: ANTONIO STEVEN VIVAS SANCHEZ. Deporte(s): Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 486. Vigente hasta 2026-06-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3614185301',
      'edufisicocund_94@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'falcons-basketball-club-486',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-falcons-basketball-club-486', v_school_id, '{"resolucion_rd": "486", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2021", "fecha_fin": "2026-06-29", "presidente": "ANTONIO STEVEN VIVAS SANCHEZ", "localidad": "San Cristóbal", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANTONIO STEVEN VIVAS SANCHEZ. Deporte(s): Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 486. Vigente hasta 2026-06-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3614185301', phone),
      email       = COALESCE('edufisicocund_94@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "486", "resolucion_actualizacion": null, "fecha_inicio": "29-06-2021", "fecha_fin": "2026-06-29", "presidente": "ANTONIO STEVEN VIVAS SANCHEZ", "localidad": "San Cristóbal", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-falcons-basketball-club-486';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3614185301', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLÃTICO RENOVADORES  (IDRD-CLUB-club-deportivo-atlatico-renovadores-1482)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-renovadores-1482';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLÃTICO RENOVADORES',
      'Presidente: EDGAR ANDRES RINCON ZULUAGA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1482. Vigente hasta 2029-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3108706736',
      'carenovadores@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlatico-renovadores-1482',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlatico-renovadores-1482', v_school_id, '{"resolucion_rd": "1482", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2024", "fecha_fin": "2029-10-28", "presidente": "EDGAR ANDRES RINCON ZULUAGA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR ANDRES RINCON ZULUAGA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1482. Vigente hasta 2029-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108706736', phone),
      email       = COALESCE('carenovadores@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1482", "resolucion_actualizacion": null, "fecha_inicio": "28-10-2024", "fecha_fin": "2029-10-28", "presidente": "EDGAR ANDRES RINCON ZULUAGA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlatico-renovadores-1482';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3108706736', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VELOCIRAPTOR  (IDRD-CLUB-club-deportivo-velociraptor-168)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-velociraptor-168';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VELOCIRAPTOR',
      'Presidente: WILLIAM RUIZ GUERRERO. Deporte(s): Hockey Sobre Hielo. Localidad: Suba. Resolución R-D Nº 168. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '4727932',
      'velociraptorsicehockey@gmail.com',
      ARRAY['Hockey Sobre Hielo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-velociraptor-168',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-velociraptor-168', v_school_id, '{"resolucion_rd": "168", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2024", "fecha_fin": "2029-02-22", "presidente": "WILLIAM RUIZ GUERRERO", "localidad": "Suba", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM RUIZ GUERRERO. Deporte(s): Hockey Sobre Hielo. Localidad: Suba. Resolución R-D Nº 168. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4727932', phone),
      email       = COALESCE('velociraptorsicehockey@gmail.com', email),
      sports      = ARRAY['Hockey Sobre Hielo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "168", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2024", "fecha_fin": "2029-02-22", "presidente": "WILLIAM RUIZ GUERRERO", "localidad": "Suba", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-velociraptor-168';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '4727932', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CMK HAPKIDO  (IDRD-CLUB-cmk-hapkido-625)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cmk-hapkido-625';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CMK HAPKIDO',
      'Presidente: CESAR QUINTERO JIMENEZ. Deporte(s): Hapkido. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 625 / actualización Nº 586. Vigente hasta 2027-06-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3134598803',
      'cesarinkht@hotmail.com',
      ARRAY['Hapkido']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cmk-hapkido-625',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cmk-hapkido-625', v_school_id, '{"resolucion_rd": "625", "resolucion_actualizacion": "586", "fecha_inicio": "29-06-2022", "fecha_fin": "2027-06-29", "presidente": "CESAR QUINTERO JIMENEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR QUINTERO JIMENEZ. Deporte(s): Hapkido. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 625 / actualización Nº 586. Vigente hasta 2027-06-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134598803', phone),
      email       = COALESCE('cesarinkht@hotmail.com', email),
      sports      = ARRAY['Hapkido']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "625", "resolucion_actualizacion": "586", "fecha_inicio": "29-06-2022", "fecha_fin": "2027-06-29", "presidente": "CESAR QUINTERO JIMENEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cmk-hapkido-625';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3134598803', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SANTOFIMIO FSB  (IDRD-CLUB-santofimio-fsb-1434)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-santofimio-fsb-1434';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SANTOFIMIO FSB',
      'Presidente: KEVIN ALEJANDRO SANTOFIMIO ORJUELA. Deporte(s): Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 1434. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3138706100',
      'santosfsb@hotmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'santofimio-fsb-1434',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-santofimio-fsb-1434', v_school_id, '{"resolucion_rd": "1434", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "KEVIN ALEJANDRO SANTOFIMIO ORJUELA", "localidad": "Bosa", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KEVIN ALEJANDRO SANTOFIMIO ORJUELA. Deporte(s): Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 1434. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138706100', phone),
      email       = COALESCE('santosfsb@hotmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1434", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "KEVIN ALEJANDRO SANTOFIMIO ORJUELA", "localidad": "Bosa", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-santofimio-fsb-1434';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3138706100', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA CORPORACION SOCIEDAD F.C.  (IDRD-CLUB-de-la-corporacion-sociedad-fc-1246)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-corporacion-sociedad-fc-1246';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA CORPORACION SOCIEDAD F.C.',
      'Presidente: JOSE LUIS ABELLA SALAZAR. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1246. Vigente hasta 2027-10-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3202442059',
      'sociedadfc07@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-corporacion-sociedad-fc-1246',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-corporacion-sociedad-fc-1246', v_school_id, '{"resolucion_rd": "1246", "resolucion_actualizacion": null, "fecha_inicio": "17-10-2022", "fecha_fin": "2027-10-17", "presidente": "JOSE LUIS ABELLA SALAZAR", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS ABELLA SALAZAR. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1246. Vigente hasta 2027-10-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202442059', phone),
      email       = COALESCE('sociedadfc07@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1246", "resolucion_actualizacion": null, "fecha_inicio": "17-10-2022", "fecha_fin": "2027-10-17", "presidente": "JOSE LUIS ABELLA SALAZAR", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-corporacion-sociedad-fc-1246';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3202442059', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BURBUJAS DE CARLOS NIÃÆÃ¢â¬ËO E HIJOS SAS  (IDRD-CLUB-club-deportivo-burbujas-de-carlos-niaaae-003)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-burbujas-de-carlos-niaaae-003';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BURBUJAS DE CARLOS NIÃÆÃ¢â¬ËO E HIJOS SAS',
      'Presidente: CARLOS ALFONSO NIÃÆÃ¢â¬ËO FORERO. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 003. Vigente hasta 2031-01-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3005284385',
      'burbujas1a@yahoo.es',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-burbujas-de-carlos-niaaae-003',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-burbujas-de-carlos-niaaae-003', v_school_id, '{"resolucion_rd": "003", "resolucion_actualizacion": null, "fecha_inicio": "21-01-2026", "fecha_fin": "2031-01-21", "presidente": "CARLOS ALFONSO NIÃÆÃ¢â¬ËO FORERO", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALFONSO NIÃÆÃ¢â¬ËO FORERO. Deporte(s): Natación. Localidad: Suba. Resolución R-D Nº 003. Vigente hasta 2031-01-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3005284385', phone),
      email       = COALESCE('burbujas1a@yahoo.es', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "003", "resolucion_actualizacion": null, "fecha_inicio": "21-01-2026", "fecha_fin": "2031-01-21", "presidente": "CARLOS ALFONSO NIÃÆÃ¢â¬ËO FORERO", "localidad": "Suba", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-burbujas-de-carlos-niaaae-003';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3005284385', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FIRE ULTIMATE  (IDRD-CLUB-fire-ultimate-1054)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fire-ultimate-1054';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FIRE ULTIMATE',
      'Presidente: NICOLÃÂS GUERRERO SIERRA. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 1054. Vigente hasta 2027-09-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3208842293',
      'javieryato@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fire-ultimate-1054',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fire-ultimate-1054', v_school_id, '{"resolucion_rd": "1054", "resolucion_actualizacion": null, "fecha_inicio": "12-09-2022", "fecha_fin": "2027-09-12", "presidente": "NICOLÃÂS GUERRERO SIERRA", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLÃÂS GUERRERO SIERRA. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 1054. Vigente hasta 2027-09-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208842293', phone),
      email       = COALESCE('javieryato@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1054", "resolucion_actualizacion": null, "fecha_inicio": "12-09-2022", "fecha_fin": "2027-09-12", "presidente": "NICOLÃÂS GUERRERO SIERRA", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fire-ultimate-1054';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3208842293', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KANTERANOS F.C.  (IDRD-CLUB-kanteranos-fc-476)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kanteranos-fc-476';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KANTERANOS F.C.',
      'Presidente: OSCAR ARGUELLO OLARTE. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 476. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '5406943',
      'oscar.arguello@integralmilenium.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kanteranos-fc-476',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kanteranos-fc-476', v_school_id, '{"resolucion_rd": "476", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "OSCAR ARGUELLO OLARTE", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR ARGUELLO OLARTE. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 476. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5406943', phone),
      email       = COALESCE('oscar.arguello@integralmilenium.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "476", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "OSCAR ARGUELLO OLARTE", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kanteranos-fc-476';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '5406943', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLETICO BELGRANO  (IDRD-CLUB-club-deportivo-atletico-belgrano-400)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletico-belgrano-400';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLETICO BELGRANO',
      'Presidente: JAVIER RONCANCIO CONTRERAS. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 400 / actualización Nº 1503. Vigente hasta 2028-05-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3164145958',
      'fcatleticobelgranocolombia@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atletico-belgrano-400',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atletico-belgrano-400', v_school_id, '{"resolucion_rd": "400", "resolucion_actualizacion": "1503", "fecha_inicio": "04-05-2023", "fecha_fin": "2028-05-03", "presidente": "JAVIER RONCANCIO CONTRERAS", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAVIER RONCANCIO CONTRERAS. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 400 / actualización Nº 1503. Vigente hasta 2028-05-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3164145958', phone),
      email       = COALESCE('fcatleticobelgranocolombia@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "400", "resolucion_actualizacion": "1503", "fecha_inicio": "04-05-2023", "fecha_fin": "2028-05-03", "presidente": "JAVIER RONCANCIO CONTRERAS", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atletico-belgrano-400';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3164145958', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ENRIQUE OLAYA HERRERA I.E.D.  (IDRD-CLUB-enrique-olaya-herrera-ied-240)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-enrique-olaya-herrera-ied-240';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ENRIQUE OLAYA HERRERA I.E.D.',
      'Presidente: EDGAR RIVEROS LEAL. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 240. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '46123253614146',
      'futbolbaseolayaherrera@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'enrique-olaya-herrera-ied-240',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-enrique-olaya-herrera-ied-240', v_school_id, '{"resolucion_rd": "240", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "EDGAR RIVEROS LEAL", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR RIVEROS LEAL. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 240. Vigente hasta 2027-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('46123253614146', phone),
      email       = COALESCE('futbolbaseolayaherrera@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "240", "resolucion_actualizacion": null, "fecha_inicio": "14-03-2022", "fecha_fin": "2027-03-14", "presidente": "EDGAR RIVEROS LEAL", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-enrique-olaya-herrera-ied-240';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '46123253614146', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RHINOÃÂ´S CAPITAL HOCKEY  (IDRD-CLUB-club-deportivo-rhinoaa-s-capital-hockey-103)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-rhinoaa-s-capital-hockey-103';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RHINOÃÂ´S CAPITAL HOCKEY',
      'Presidente: MANUEL ALEJANDRO VARGAS RODRIGUEZ. Deporte(s): Patinaje. Localidad: Santa Fe. Resolución R-D Nº 103. Vigente hasta 2029-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Santa Fe',
      '28515713118564799',
      'rhino.hockey@yahoo.com.co',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-rhinoaa-s-capital-hockey-103',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-rhinoaa-s-capital-hockey-103', v_school_id, '{"resolucion_rd": "103", "resolucion_actualizacion": null, "fecha_inicio": "12-02-2024", "fecha_fin": "2029-02-11", "presidente": "MANUEL ALEJANDRO VARGAS RODRIGUEZ", "localidad": "Santa Fe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL ALEJANDRO VARGAS RODRIGUEZ. Deporte(s): Patinaje. Localidad: Santa Fe. Resolución R-D Nº 103. Vigente hasta 2029-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('28515713118564799', phone),
      email       = COALESCE('rhino.hockey@yahoo.com.co', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "103", "resolucion_actualizacion": null, "fecha_inicio": "12-02-2024", "fecha_fin": "2029-02-11", "presidente": "MANUEL ALEJANDRO VARGAS RODRIGUEZ", "localidad": "Santa Fe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-rhinoaa-s-capital-hockey-103';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Santa Fe', 'Bogotá', '28515713118564799', 4.6017892, -74.0791799, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REAL SEMILLAS  (IDRD-CLUB-club-deportivo-real-semillas-280)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-semillas-280';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REAL SEMILLAS',
      'Presidente: OSCAR EDUARDO CERQUERA ASCENCIO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 280. Vigente hasta 2030-03-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3007199767',
      'realsemillafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-real-semillas-280',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-real-semillas-280', v_school_id, '{"resolucion_rd": "280", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2025", "fecha_fin": "2030-03-31", "presidente": "OSCAR EDUARDO CERQUERA ASCENCIO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR EDUARDO CERQUERA ASCENCIO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 280. Vigente hasta 2030-03-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007199767', phone),
      email       = COALESCE('realsemillafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "280", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2025", "fecha_fin": "2030-03-31", "presidente": "OSCAR EDUARDO CERQUERA ASCENCIO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-real-semillas-280';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3007199767', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ATLAS BOGOTA S.A.S  (IDRD-CLUB-club-deportivo-atlas-bogota-sas-350)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlas-bogota-sas-350';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ATLAS BOGOTA S.A.S',
      'Presidente: MARTHA CECILIA LOZANO DE CASTRO. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 350 / actualización Nº 373. Vigente hasta 2028-04-27. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3506786193',
      'ceo@atlasbogota.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-atlas-bogota-sas-350',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-atlas-bogota-sas-350', v_school_id, '{"resolucion_rd": "350", "resolucion_actualizacion": "373", "fecha_inicio": "28-04-2023", "fecha_fin": "2028-04-27", "presidente": "MARTHA CECILIA LOZANO DE CASTRO", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTHA CECILIA LOZANO DE CASTRO. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 350 / actualización Nº 373. Vigente hasta 2028-04-27. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3506786193', phone),
      email       = COALESCE('ceo@atlasbogota.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "350", "resolucion_actualizacion": "373", "fecha_inicio": "28-04-2023", "fecha_fin": "2028-04-27", "presidente": "MARTHA CECILIA LOZANO DE CASTRO", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-atlas-bogota-sas-350';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3506786193', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SANTOS BOGOTA  (IDRD-CLUB-santos-bogota-903)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-santos-bogota-903';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SANTOS BOGOTA',
      'Presidente: JUAN ESTEBAN LLANO RIVEROS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 903. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3230200731',
      'rapgesta10@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'santos-bogota-903',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-santos-bogota-903', v_school_id, '{"resolucion_rd": "903", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "JUAN ESTEBAN LLANO RIVEROS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN ESTEBAN LLANO RIVEROS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 903. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3230200731', phone),
      email       = COALESCE('rapgesta10@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "903", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "JUAN ESTEBAN LLANO RIVEROS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-santos-bogota-903';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3230200731', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ECOPATIN  (IDRD-CLUB-ecopatin-1477)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ecopatin-1477';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ECOPATIN',
      'Presidente: LUZ AMANDA ACERO SALAZAR. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1477. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3142870754',
      'ecopatin@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ecopatin-1477',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ecopatin-1477', v_school_id, '{"resolucion_rd": "1477", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "LUZ AMANDA ACERO SALAZAR", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUZ AMANDA ACERO SALAZAR. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1477. Vigente hasta 2028-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142870754', phone),
      email       = COALESCE('ecopatin@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1477", "resolucion_actualizacion": null, "fecha_inicio": "04-12-2023", "fecha_fin": "2028-12-03", "presidente": "LUZ AMANDA ACERO SALAZAR", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ecopatin-1477';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3142870754', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RIVER PLATE BOGOTA  (IDRD-CLUB-river-plate-bogota-293)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-river-plate-bogota-293';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RIVER PLATE BOGOTA',
      'Presidente: INGRITH ALEJANDRA CICACHA RODRIGUEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 293 / actualización Nº 769. Vigente hasta 2028-04-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3138831701',
      'riverplatebogota@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'river-plate-bogota-293',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-river-plate-bogota-293', v_school_id, '{"resolucion_rd": "293", "resolucion_actualizacion": "769", "fecha_inicio": "05-04-2023", "fecha_fin": "2028-04-04", "presidente": "INGRITH ALEJANDRA CICACHA RODRIGUEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: INGRITH ALEJANDRA CICACHA RODRIGUEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 293 / actualización Nº 769. Vigente hasta 2028-04-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138831701', phone),
      email       = COALESCE('riverplatebogota@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "293", "resolucion_actualizacion": "769", "fecha_inicio": "05-04-2023", "fecha_fin": "2028-04-04", "presidente": "INGRITH ALEJANDRA CICACHA RODRIGUEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-river-plate-bogota-293';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3138831701', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BOGOTANO DE NATACIÃâN  (IDRD-CLUB-bogotano-de-nataciaan-1838)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bogotano-de-nataciaan-1838';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOGOTANO DE NATACIÃâN',
      'Presidente: MARÃÂA CAMILA FRANKY HERNÃÂNDEZ. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 1838. Vigente hasta 2028-01-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3164002016',
      'clubbogotano@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bogotano-de-nataciaan-1838',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bogotano-de-nataciaan-1838', v_school_id, '{"resolucion_rd": "1838", "resolucion_actualizacion": null, "fecha_inicio": "06-01-2023", "fecha_fin": "2028-01-06", "presidente": "MARÃÂA CAMILA FRANKY HERNÃÂNDEZ", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃÂA CAMILA FRANKY HERNÃÂNDEZ. Deporte(s): Natación. Localidad: Usaquén. Resolución R-D Nº 1838. Vigente hasta 2028-01-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3164002016', phone),
      email       = COALESCE('clubbogotano@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1838", "resolucion_actualizacion": null, "fecha_inicio": "06-01-2023", "fecha_fin": "2028-01-06", "presidente": "MARÃÂA CAMILA FRANKY HERNÃÂNDEZ", "localidad": "Usaquén", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bogotano-de-nataciaan-1838';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3164002016', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TENIS CHAMPION SHIP  (IDRD-CLUB-tenis-champion-ship-541)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tenis-champion-ship-541';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TENIS CHAMPION SHIP',
      'Presidente: MANUEL ALBERTO RACHEZ RUIZ. Deporte(s): Tenis. Localidad: Kennedy. Resolución R-D Nº 541. Vigente hasta 2026-07-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3144571656',
      'albertorachez1959@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tenis-champion-ship-541',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tenis-champion-ship-541', v_school_id, '{"resolucion_rd": "541", "resolucion_actualizacion": null, "fecha_inicio": "16-07-2021", "fecha_fin": "2026-07-16", "presidente": "MANUEL ALBERTO RACHEZ RUIZ", "localidad": "Kennedy", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL ALBERTO RACHEZ RUIZ. Deporte(s): Tenis. Localidad: Kennedy. Resolución R-D Nº 541. Vigente hasta 2026-07-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144571656', phone),
      email       = COALESCE('albertorachez1959@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "541", "resolucion_actualizacion": null, "fecha_inicio": "16-07-2021", "fecha_fin": "2026-07-16", "presidente": "MANUEL ALBERTO RACHEZ RUIZ", "localidad": "Kennedy", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tenis-champion-ship-541';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3144571656', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CALCIO SUIZO ITALIANO F.C.  (IDRD-CLUB-calcio-suizo-italiano-fc-589)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-calcio-suizo-italiano-fc-589';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CALCIO SUIZO ITALIANO F.C.',
      'Presidente: MARIA FERNANDA RAMIREZ VARGAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 589. Vigente hasta 2027-06-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3202306280',
      'maferv1107@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'calcio-suizo-italiano-fc-589',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-calcio-suizo-italiano-fc-589', v_school_id, '{"resolucion_rd": "589", "resolucion_actualizacion": null, "fecha_inicio": "10-06-2022", "fecha_fin": "2027-06-10", "presidente": "MARIA FERNANDA RAMIREZ VARGAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA FERNANDA RAMIREZ VARGAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 589. Vigente hasta 2027-06-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202306280', phone),
      email       = COALESCE('maferv1107@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "589", "resolucion_actualizacion": null, "fecha_inicio": "10-06-2022", "fecha_fin": "2027-06-10", "presidente": "MARIA FERNANDA RAMIREZ VARGAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-calcio-suizo-italiano-fc-589';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3202306280', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE ESGRIMA ARES  (IDRD-CLUB-club-deportivo-de-esgrima-ares-580)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-esgrima-ares-580';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE ESGRIMA ARES',
      'Presidente: HUGO ALEXANDER SANTAMARIA RODRIGUEZ. Deporte(s): Esgrima. Localidad: Engativá. Resolución R-D Nº 580. Vigente hasta 2027-06-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3155897270',
      'husanta13@yahoo.com',
      ARRAY['Esgrima']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-esgrima-ares-580',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-esgrima-ares-580', v_school_id, '{"resolucion_rd": "580", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2022", "fecha_fin": "2027-06-09", "presidente": "HUGO ALEXANDER SANTAMARIA RODRIGUEZ", "localidad": "Engativá", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HUGO ALEXANDER SANTAMARIA RODRIGUEZ. Deporte(s): Esgrima. Localidad: Engativá. Resolución R-D Nº 580. Vigente hasta 2027-06-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3155897270', phone),
      email       = COALESCE('husanta13@yahoo.com', email),
      sports      = ARRAY['Esgrima']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "580", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2022", "fecha_fin": "2027-06-09", "presidente": "HUGO ALEXANDER SANTAMARIA RODRIGUEZ", "localidad": "Engativá", "sports": ["Esgrima"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-esgrima-ares-580';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3155897270', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VFC UNITED  (IDRD-CLUB-vfc-united-698)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-vfc-united-698';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VFC UNITED',
      'Presidente: ANDRÃâ°S FELIPE ARIAS TAMAYO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 698. Vigente hasta 2026-09-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3106953612',
      'felipe030409@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'vfc-united-698',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-vfc-united-698', v_school_id, '{"resolucion_rd": "698", "resolucion_actualizacion": null, "fecha_inicio": "13-09-2021", "fecha_fin": "2026-09-13", "presidente": "ANDRÃâ°S FELIPE ARIAS TAMAYO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRÃâ°S FELIPE ARIAS TAMAYO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 698. Vigente hasta 2026-09-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106953612', phone),
      email       = COALESCE('felipe030409@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "698", "resolucion_actualizacion": null, "fecha_inicio": "13-09-2021", "fecha_fin": "2026-09-13", "presidente": "ANDRÃâ°S FELIPE ARIAS TAMAYO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-vfc-united-698';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3106953612', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE KARATE DO AZUMI GOMEZ RYUÃ¢â¬Â  (IDRD-CLUB-club-deportivo-de-karate-do-azumi-gomez--511)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-karate-do-azumi-gomez--511';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE KARATE DO AZUMI GOMEZ RYUÃ¢â¬Â',
      'Presidente: HECTOR JULIO GOMEZ PEREZ. Deporte(s): Karate. Localidad: Chapinero. Resolución R-D Nº 511. Vigente hasta 2026-07-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '8032647',
      'hejugo12@yahoo.com',
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-karate-do-azumi-gomez--511',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-karate-do-azumi-gomez--511', v_school_id, '{"resolucion_rd": "511", "resolucion_actualizacion": null, "fecha_inicio": "12-07-2021", "fecha_fin": "2026-07-12", "presidente": "HECTOR JULIO GOMEZ PEREZ", "localidad": "Chapinero", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HECTOR JULIO GOMEZ PEREZ. Deporte(s): Karate. Localidad: Chapinero. Resolución R-D Nº 511. Vigente hasta 2026-07-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('8032647', phone),
      email       = COALESCE('hejugo12@yahoo.com', email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "511", "resolucion_actualizacion": null, "fecha_inicio": "12-07-2021", "fecha_fin": "2026-07-12", "presidente": "HECTOR JULIO GOMEZ PEREZ", "localidad": "Chapinero", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-karate-do-azumi-gomez--511';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '8032647', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VARUNA  (IDRD-CLUB-club-deportivo-varuna-552)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-varuna-552';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VARUNA',
      'Presidente: MANUEL ALEJANDRO CASTELLANOS. Deporte(s): Natación. Localidad: Kennedy. Resolución R-D Nº 552. Vigente hasta 2026-07-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3107904123',
      'alejobasket@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-varuna-552',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-varuna-552', v_school_id, '{"resolucion_rd": "552", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2021", "fecha_fin": "2026-07-19", "presidente": "MANUEL ALEJANDRO CASTELLANOS", "localidad": "Kennedy", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL ALEJANDRO CASTELLANOS. Deporte(s): Natación. Localidad: Kennedy. Resolución R-D Nº 552. Vigente hasta 2026-07-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107904123', phone),
      email       = COALESCE('alejobasket@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "552", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2021", "fecha_fin": "2026-07-19", "presidente": "MANUEL ALEJANDRO CASTELLANOS", "localidad": "Kennedy", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-varuna-552';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3107904123', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DAÃâÃÂ´SILVA TENIS CLUB  (IDRD-CLUB-daaaaa-silva-tenis-club-640)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-daaaaa-silva-tenis-club-640';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DAÃâÃÂ´SILVA TENIS CLUB',
      'Presidente: NICK SAMET DA SILVA REYES. Deporte(s): Tenis. Localidad: Barrios Unidos. Resolución R-D Nº 640. Vigente hasta 2026-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3108580591',
      'dasilvatenisclub@hotmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'daaaaa-silva-tenis-club-640',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-daaaaa-silva-tenis-club-640', v_school_id, '{"resolucion_rd": "640", "resolucion_actualizacion": null, "fecha_inicio": "20-08-2021", "fecha_fin": "2026-08-20", "presidente": "NICK SAMET DA SILVA REYES", "localidad": "Barrios Unidos", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICK SAMET DA SILVA REYES. Deporte(s): Tenis. Localidad: Barrios Unidos. Resolución R-D Nº 640. Vigente hasta 2026-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108580591', phone),
      email       = COALESCE('dasilvatenisclub@hotmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "640", "resolucion_actualizacion": null, "fecha_inicio": "20-08-2021", "fecha_fin": "2026-08-20", "presidente": "NICK SAMET DA SILVA REYES", "localidad": "Barrios Unidos", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-daaaaa-silva-tenis-club-640';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3108580591', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE TIRO CON ARCO LEGOLAS  (IDRD-CLUB-de-tiro-con-arco-legolas-478)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-tiro-con-arco-legolas-478';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE TIRO CON ARCO LEGOLAS',
      'Presidente: LUZ MARINA PINZON ESPINOSA. Deporte(s): Tiro con arco. Localidad: Engativá. Resolución R-D Nº 478. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3133632956',
      'luzmarinap19@hotmail.com',
      ARRAY['Tiro con arco']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-tiro-con-arco-legolas-478',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-tiro-con-arco-legolas-478', v_school_id, '{"resolucion_rd": "478", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "LUZ MARINA PINZON ESPINOSA", "localidad": "Engativá", "sports": ["Tiro con arco"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUZ MARINA PINZON ESPINOSA. Deporte(s): Tiro con arco. Localidad: Engativá. Resolución R-D Nº 478. Vigente hasta 2026-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133632956', phone),
      email       = COALESCE('luzmarinap19@hotmail.com', email),
      sports      = ARRAY['Tiro con arco']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "478", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2021", "fecha_fin": "2026-06-28", "presidente": "LUZ MARINA PINZON ESPINOSA", "localidad": "Engativá", "sports": ["Tiro con arco"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-tiro-con-arco-legolas-478';
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
-- CLUB DE NATACION AQUA ROLOS  (IDRD-CLUB-club-de-natacion-aqua-rolos-278)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-natacion-aqua-rolos-278';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE NATACION AQUA ROLOS',
      'Presidente: CARLOS ANDRES FONSECA ELZE. Deporte(s): Natación. Localidad: Chapinero. Resolución R-D Nº 278. Vigente hasta 2028-03-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '6227234',
      'acollazosv@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-natacion-aqua-rolos-278',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-natacion-aqua-rolos-278', v_school_id, '{"resolucion_rd": "278", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2023", "fecha_fin": "2028-03-28", "presidente": "CARLOS ANDRES FONSECA ELZE", "localidad": "Chapinero", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ANDRES FONSECA ELZE. Deporte(s): Natación. Localidad: Chapinero. Resolución R-D Nº 278. Vigente hasta 2028-03-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6227234', phone),
      email       = COALESCE('acollazosv@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "278", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2023", "fecha_fin": "2028-03-28", "presidente": "CARLOS ANDRES FONSECA ELZE", "localidad": "Chapinero", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-natacion-aqua-rolos-278';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '6227234', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- AGUILA DE ORO  (IDRD-CLUB-aguila-de-oro-1688)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-aguila-de-oro-1688';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'AGUILA DE ORO',
      'Presidente: KEVIN STICK QUINTERO SANCHEZ. Deporte(s): Hapkido. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1688 / actualización Nº 439. Vigente hasta 2027-12-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '71463903008544276',
      'ksrubiks@gmail.com',
      ARRAY['Hapkido']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'aguila-de-oro-1688',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-aguila-de-oro-1688', v_school_id, '{"resolucion_rd": "1688", "resolucion_actualizacion": "439", "fecha_inicio": "21-12-2022", "fecha_fin": "2027-12-21", "presidente": "KEVIN STICK QUINTERO SANCHEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KEVIN STICK QUINTERO SANCHEZ. Deporte(s): Hapkido. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1688 / actualización Nº 439. Vigente hasta 2027-12-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('71463903008544276', phone),
      email       = COALESCE('ksrubiks@gmail.com', email),
      sports      = ARRAY['Hapkido']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1688", "resolucion_actualizacion": "439", "fecha_inicio": "21-12-2022", "fecha_fin": "2027-12-21", "presidente": "KEVIN STICK QUINTERO SANCHEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-aguila-de-oro-1688';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '71463903008544276', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LIVESQUASH  (IDRD-CLUB-livesquash-596)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-livesquash-596';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LIVESQUASH',
      'Presidente: ALFONSO MARROQUIN PARRA. Deporte(s): Squash. Localidad: Usaquén. Resolución R-D Nº 596. Vigente hasta 2026-08-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3102674750',
      'alfonsomarroquin1@hotmail.com',
      ARRAY['Squash']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'livesquash-596',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-livesquash-596', v_school_id, '{"resolucion_rd": "596", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2021", "fecha_fin": "2026-08-05", "presidente": "ALFONSO MARROQUIN PARRA", "localidad": "Usaquén", "sports": ["Squash"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALFONSO MARROQUIN PARRA. Deporte(s): Squash. Localidad: Usaquén. Resolución R-D Nº 596. Vigente hasta 2026-08-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102674750', phone),
      email       = COALESCE('alfonsomarroquin1@hotmail.com', email),
      sports      = ARRAY['Squash']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "596", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2021", "fecha_fin": "2026-08-05", "presidente": "ALFONSO MARROQUIN PARRA", "localidad": "Usaquén", "sports": ["Squash"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-livesquash-596';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3102674750', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- OFFICIAL TENNIS  (IDRD-CLUB-official-tennis-616)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-official-tennis-616';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'OFFICIAL TENNIS',
      'Presidente: FREDY SEBASTIAN CAMELO OSORIO. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 616. Vigente hasta 2026-08-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3165608268',
      'fredy.sebastian@hotmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'official-tennis-616',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-official-tennis-616', v_school_id, '{"resolucion_rd": "616", "resolucion_actualizacion": null, "fecha_inicio": "17-08-2021", "fecha_fin": "2026-08-17", "presidente": "FREDY SEBASTIAN CAMELO OSORIO", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDY SEBASTIAN CAMELO OSORIO. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 616. Vigente hasta 2026-08-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165608268', phone),
      email       = COALESCE('fredy.sebastian@hotmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "616", "resolucion_actualizacion": null, "fecha_inicio": "17-08-2021", "fecha_fin": "2026-08-17", "presidente": "FREDY SEBASTIAN CAMELO OSORIO", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-official-tennis-616';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3165608268', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NORMANDIA FC  (IDRD-CLUB-normandia-fc-797)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-normandia-fc-797';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NORMANDIA FC',
      'Presidente: SANDRA GARCIA ORTIZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 797. Vigente hasta 2027-07-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3174418369',
      'jefesandqgarcia@yahoo.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'normandia-fc-797',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-normandia-fc-797', v_school_id, '{"resolucion_rd": "797", "resolucion_actualizacion": null, "fecha_inicio": "18-07-2022", "fecha_fin": "2027-07-18", "presidente": "SANDRA GARCIA ORTIZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA GARCIA ORTIZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 797. Vigente hasta 2027-07-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3174418369', phone),
      email       = COALESCE('jefesandqgarcia@yahoo.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "797", "resolucion_actualizacion": null, "fecha_inicio": "18-07-2022", "fecha_fin": "2027-07-18", "presidente": "SANDRA GARCIA ORTIZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-normandia-fc-797';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3174418369', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ASODEPORTES DE LEVANTAMIENTO DE PESAS Ã¢â¬ÅASODEPORTESÃ¢â¬Â  (IDRD-CLUB-asodeportes-de-levantamiento-de-pesas-aa-158)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-asodeportes-de-levantamiento-de-pesas-aa-158';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ASODEPORTES DE LEVANTAMIENTO DE PESAS Ã¢â¬ÅASODEPORTESÃ¢â¬Â',
      'Presidente: CARMEN ISABEL TRIVIÃâO DÃÂAZ. Deporte(s): Levantamiento De Pesas. Localidad: Santa Fe. Resolución R-D Nº 158. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Santa Fe',
      '3008036264',
      'klia24@gmail.com',
      ARRAY['Levantamiento De Pesas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'asodeportes-de-levantamiento-de-pesas-aa-158',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-asodeportes-de-levantamiento-de-pesas-aa-158', v_school_id, '{"resolucion_rd": "158", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "CARMEN ISABEL TRIVIÃâO DÃÂAZ", "localidad": "Santa Fe", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARMEN ISABEL TRIVIÃâO DÃÂAZ. Deporte(s): Levantamiento De Pesas. Localidad: Santa Fe. Resolución R-D Nº 158. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008036264', phone),
      email       = COALESCE('klia24@gmail.com', email),
      sports      = ARRAY['Levantamiento De Pesas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "158", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "CARMEN ISABEL TRIVIÃâO DÃÂAZ", "localidad": "Santa Fe", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-asodeportes-de-levantamiento-de-pesas-aa-158';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Santa Fe', 'Bogotá', '3008036264', 4.6017892, -74.0791799, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- HOCKEY DORADO  (IDRD-CLUB-hockey-dorado-162)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-hockey-dorado-162';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'HOCKEY DORADO',
      'Presidente: MARTHA MORALES POSADA. Deporte(s): Patinaje. Localidad: La Candelaria. Resolución R-D Nº 162 / actualización Nº 326. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'La Candelaria',
      '3178569027',
      'mmorales107@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'hockey-dorado-162',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-hockey-dorado-162', v_school_id, '{"resolucion_rd": "162", "resolucion_actualizacion": "326", "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "MARTHA MORALES POSADA", "localidad": "La Candelaria", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTHA MORALES POSADA. Deporte(s): Patinaje. Localidad: La Candelaria. Resolución R-D Nº 162 / actualización Nº 326. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3178569027', phone),
      email       = COALESCE('mmorales107@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "162", "resolucion_actualizacion": "326", "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "MARTHA MORALES POSADA", "localidad": "La Candelaria", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-hockey-dorado-162';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'La Candelaria', 'Bogotá', '3178569027', 4.6843605, -74.0511562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CRUSEIRO COLOMBIA,  (IDRD-CLUB-club-deportivo-cruseiro-colombia-063)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cruseiro-colombia-063';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CRUSEIRO COLOMBIA,',
      'Presidente: DANIEL MATEO TRUJILLO PEREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 063 / actualización Nº 592. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3460649',
      'clubdeportcruzeiro.col@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cruseiro-colombia-063',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cruseiro-colombia-063', v_school_id, '{"resolucion_rd": "063", "resolucion_actualizacion": "592", "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "DANIEL MATEO TRUJILLO PEREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL MATEO TRUJILLO PEREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 063 / actualización Nº 592. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3460649', phone),
      email       = COALESCE('clubdeportcruzeiro.col@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "063", "resolucion_actualizacion": "592", "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "DANIEL MATEO TRUJILLO PEREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cruseiro-colombia-063';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3460649', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- Atletismo los Leones  (IDRD-CLUB-atletismo-los-leones-279)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletismo-los-leones-279';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Atletismo los Leones',
      'Presidente: JULY ANDREA ALARCON PAEZ. Deporte(s): Atletismo. Resolución R-D Nº 279. Vigente hasta 2028-03-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '2892925',
      'leonegom@hotmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletismo-los-leones-279',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletismo-los-leones-279', v_school_id, '{"resolucion_rd": "279", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2023", "fecha_fin": "2028-03-28", "presidente": "JULY ANDREA ALARCON PAEZ", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULY ANDREA ALARCON PAEZ. Deporte(s): Atletismo. Resolución R-D Nº 279. Vigente hasta 2028-03-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2892925', phone),
      email       = COALESCE('leonegom@hotmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "279", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2023", "fecha_fin": "2028-03-28", "presidente": "JULY ANDREA ALARCON PAEZ", "localidad": null, "sports": ["Atletismo"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletismo-los-leones-279';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FANIA STAR  (IDRD-CLUB-club-deportivo-fania-star-226)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fania-star-226';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FANIA STAR',
      'Presidente: EDWIN FERNANDO WALTEROS JOANIAS. Deporte(s): Futbol 5. Localidad: Ciudad Bolívar. Resolución R-D Nº 226 / actualización Nº 1196. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3017194927',
      'faniastarfutbol5@gmail.com',
      ARRAY['Futbol 5']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fania-star-226',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fania-star-226', v_school_id, '{"resolucion_rd": "226", "resolucion_actualizacion": "1196", "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "EDWIN FERNANDO WALTEROS JOANIAS", "localidad": "Ciudad Bolívar", "sports": ["Futbol 5"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN FERNANDO WALTEROS JOANIAS. Deporte(s): Futbol 5. Localidad: Ciudad Bolívar. Resolución R-D Nº 226 / actualización Nº 1196. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017194927', phone),
      email       = COALESCE('faniastarfutbol5@gmail.com', email),
      sports      = ARRAY['Futbol 5']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "226", "resolucion_actualizacion": "1196", "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "EDWIN FERNANDO WALTEROS JOANIAS", "localidad": "Ciudad Bolívar", "sports": ["Futbol 5"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fania-star-226';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3017194927', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- STRONGER BASKETBALL CLUB  (IDRD-CLUB-stronger-basketball-club-015)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-stronger-basketball-club-015';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'STRONGER BASKETBALL CLUB',
      'Presidente: SILVANA LEDESMA BUITRAGO. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 015. Vigente hasta 2028-01-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3123789951',
      'silvanaledesmabuitrafo@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'stronger-basketball-club-015',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-stronger-basketball-club-015', v_school_id, '{"resolucion_rd": "015", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2023", "fecha_fin": "2028-01-24", "presidente": "SILVANA LEDESMA BUITRAGO", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SILVANA LEDESMA BUITRAGO. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 015. Vigente hasta 2028-01-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123789951', phone),
      email       = COALESCE('silvanaledesmabuitrafo@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "015", "resolucion_actualizacion": null, "fecha_inicio": "24-01-2023", "fecha_fin": "2028-01-24", "presidente": "SILVANA LEDESMA BUITRAGO", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-stronger-basketball-club-015';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3123789951', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE LA FUNDACIÃâN SPORTS BOGOTÃÂ  (IDRD-CLUB-de-la-fundaciaan-sports-bogotaa-160)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-la-fundaciaan-sports-bogotaa-160';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE LA FUNDACIÃâN SPORTS BOGOTÃÂ',
      'Presidente: LEONARDO DIAZ CALDERON. Deporte(s): Fútbol, Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 160. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3133849778',
      'sportsbogota@hotmail.com',
      ARRAY['Fútbol','Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-la-fundaciaan-sports-bogotaa-160',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-la-fundaciaan-sports-bogotaa-160', v_school_id, '{"resolucion_rd": "160", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "LEONARDO DIAZ CALDERON", "localidad": "San Cristóbal", "sports": ["Fútbol", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEONARDO DIAZ CALDERON. Deporte(s): Fútbol, Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 160. Vigente hasta 2027-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133849778', phone),
      email       = COALESCE('sportsbogota@hotmail.com', email),
      sports      = ARRAY['Fútbol','Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "160", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2022", "fecha_fin": "2027-02-21", "presidente": "LEONARDO DIAZ CALDERON", "localidad": "San Cristóbal", "sports": ["Fútbol", "Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-la-fundaciaan-sports-bogotaa-160';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3133849778', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE TIRO DEPORTIVO FIELD TARGET COLOMBIA  (IDRD-CLUB-club-de-tiro-deportivo-field-target-colo-007)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-tiro-deportivo-field-target-colo-007';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE TIRO DEPORTIVO FIELD TARGET COLOMBIA',
      'Presidente: CESAR ANDRÃâ°S ORTIZ GUERRA. Deporte(s): Tiro deportivo. Localidad: Fontibón. Resolución R-D Nº 007. Vigente hasta 2027-01-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '41042043162798803',
      'andrezitro@hotmail.com',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-tiro-deportivo-field-target-colo-007',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-tiro-deportivo-field-target-colo-007', v_school_id, '{"resolucion_rd": "007", "resolucion_actualizacion": null, "fecha_inicio": "06-01-2022", "fecha_fin": "2027-01-06", "presidente": "CESAR ANDRÃâ°S ORTIZ GUERRA", "localidad": "Fontibón", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR ANDRÃâ°S ORTIZ GUERRA. Deporte(s): Tiro deportivo. Localidad: Fontibón. Resolución R-D Nº 007. Vigente hasta 2027-01-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('41042043162798803', phone),
      email       = COALESCE('andrezitro@hotmail.com', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "007", "resolucion_actualizacion": null, "fecha_inicio": "06-01-2022", "fecha_fin": "2027-01-06", "presidente": "CESAR ANDRÃâ°S ORTIZ GUERRA", "localidad": "Fontibón", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-tiro-deportivo-field-target-colo-007';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '41042043162798803', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- UNIDOS POR LATINOAMERICA.  (IDRD-CLUB-unidos-por-latinoamerica-1272)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-unidos-por-latinoamerica-1272';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'UNIDOS POR LATINOAMERICA.',
      'Presidente: JULIÃÂN ALBERTO GALINDO SÃÂNCHEZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1272. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3103083891',
      'clubdeportivomilan2013@yahoo.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'unidos-por-latinoamerica-1272',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-unidos-por-latinoamerica-1272', v_school_id, '{"resolucion_rd": "1272", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "JULIÃÂN ALBERTO GALINDO SÃÂNCHEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIÃÂN ALBERTO GALINDO SÃÂNCHEZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1272. Vigente hasta 2027-10-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103083891', phone),
      email       = COALESCE('clubdeportivomilan2013@yahoo.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1272", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2022", "fecha_fin": "2027-10-20", "presidente": "JULIÃÂN ALBERTO GALINDO SÃÂNCHEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-unidos-por-latinoamerica-1272';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3103083891', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DEPORTES CALDAS FC  (IDRD-CLUB-deportes-caldas-fc-834)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-deportes-caldas-fc-834';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DEPORTES CALDAS FC',
      'Presidente: CARLOS HERNANDO QUIJANO PERDOMO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 834. Vigente hasta 2027-07-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3115093020',
      'carlos@deportescaldas.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'deportes-caldas-fc-834',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-deportes-caldas-fc-834', v_school_id, '{"resolucion_rd": "834", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2022", "fecha_fin": "2027-07-22", "presidente": "CARLOS HERNANDO QUIJANO PERDOMO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS HERNANDO QUIJANO PERDOMO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 834. Vigente hasta 2027-07-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115093020', phone),
      email       = COALESCE('carlos@deportescaldas.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "834", "resolucion_actualizacion": null, "fecha_inicio": "22-07-2022", "fecha_fin": "2027-07-22", "presidente": "CARLOS HERNANDO QUIJANO PERDOMO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-deportes-caldas-fc-834';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3115093020', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KARMA  (IDRD-CLUB-karma-1518)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-karma-1518';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KARMA',
      'Presidente: CHRYSTIAN CAMILO OVIEDO DELGADO. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1518. Vigente hasta 2028-12-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3586417',
      NULL,
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'karma-1518',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-karma-1518', v_school_id, '{"resolucion_rd": "1518", "resolucion_actualizacion": null, "fecha_inicio": "06-12-2023", "fecha_fin": "2028-12-05", "presidente": "CHRYSTIAN CAMILO OVIEDO DELGADO", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CHRYSTIAN CAMILO OVIEDO DELGADO. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1518. Vigente hasta 2028-12-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3586417', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1518", "resolucion_actualizacion": null, "fecha_inicio": "06-12-2023", "fecha_fin": "2028-12-05", "presidente": "CHRYSTIAN CAMILO OVIEDO DELGADO", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-karma-1518';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3586417', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE GOLF DEL CENTRO SOCIAL DE OFICIALES DE LA POLICÃÂA NACIONAL  (IDRD-CLUB-club-de-golf-del-centro-social-de-oficia-1846)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-golf-del-centro-social-de-oficia-1846';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE GOLF DEL CENTRO SOCIAL DE OFICIALES DE LA POLICÃÂA NACIONAL',
      'Presidente: PABLO ELBERT ROJAS FLOREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1846. Vigente hasta 2028-01-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3106132967',
      'cesof.jefat@policia.gov.co',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-golf-del-centro-social-de-oficia-1846',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-golf-del-centro-social-de-oficia-1846', v_school_id, '{"resolucion_rd": "1846", "resolucion_actualizacion": null, "fecha_inicio": "09-01-2023", "fecha_fin": "2028-01-09", "presidente": "PABLO ELBERT ROJAS FLOREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PABLO ELBERT ROJAS FLOREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1846. Vigente hasta 2028-01-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106132967', phone),
      email       = COALESCE('cesof.jefat@policia.gov.co', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1846", "resolucion_actualizacion": null, "fecha_inicio": "09-01-2023", "fecha_fin": "2028-01-09", "presidente": "PABLO ELBERT ROJAS FLOREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-golf-del-centro-social-de-oficia-1846';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3106132967', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ONG FUNSOCIAL CRECER COLOMBIA  (IDRD-CLUB-ong-funsocial-crecer-colombia-678)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ong-funsocial-crecer-colombia-678';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ONG FUNSOCIAL CRECER COLOMBIA',
      'Presidente: CESAR AUGUSTO GAMA CANCELADO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 678. Vigente hasta 2027-06-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3108817691',
      'ongfusocial@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ong-funsocial-crecer-colombia-678',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ong-funsocial-crecer-colombia-678', v_school_id, '{"resolucion_rd": "678", "resolucion_actualizacion": null, "fecha_inicio": "23-06-2022", "fecha_fin": "2027-06-23", "presidente": "CESAR AUGUSTO GAMA CANCELADO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR AUGUSTO GAMA CANCELADO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 678. Vigente hasta 2027-06-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108817691', phone),
      email       = COALESCE('ongfusocial@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "678", "resolucion_actualizacion": null, "fecha_inicio": "23-06-2022", "fecha_fin": "2027-06-23", "presidente": "CESAR AUGUSTO GAMA CANCELADO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ong-funsocial-crecer-colombia-678';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3108817691', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESLAVIGOL AHORA CLUB DEPORTIVO LIBERTAD  (IDRD-CLUB-eslavigol-ahora-club-deportivo-libertad-1335)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-eslavigol-ahora-club-deportivo-libertad-1335';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESLAVIGOL AHORA CLUB DEPORTIVO LIBERTAD',
      'Presidente: JAIRO ANDRÃÆÃ¢â¬Â°S AVILA BARBOSA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1335 / actualización Nº 008. Vigente hasta 2027-10-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3204503020',
      'clubdeportivoeslavigol@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'eslavigol-ahora-club-deportivo-libertad-1335',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-eslavigol-ahora-club-deportivo-libertad-1335', v_school_id, '{"resolucion_rd": "1335", "resolucion_actualizacion": "008", "fecha_inicio": "28-10-2022", "fecha_fin": "2027-10-28", "presidente": "JAIRO ANDRÃÆÃ¢â¬Â°S AVILA BARBOSA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIRO ANDRÃÆÃ¢â¬Â°S AVILA BARBOSA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1335 / actualización Nº 008. Vigente hasta 2027-10-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204503020', phone),
      email       = COALESCE('clubdeportivoeslavigol@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1335", "resolucion_actualizacion": "008", "fecha_inicio": "28-10-2022", "fecha_fin": "2027-10-28", "presidente": "JAIRO ANDRÃÆÃ¢â¬Â°S AVILA BARBOSA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-eslavigol-ahora-club-deportivo-libertad-1335';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3204503020', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COLOMBIAN ALL STARS  (IDRD-CLUB-colombian-all-stars-450)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-colombian-all-stars-450';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COLOMBIAN ALL STARS',
      'Presidente: LUIS ALBERTO CASTANEDA DELGADO. Deporte(s): Porrismo. Localidad: Barrios Unidos. Resolución R-D Nº 450. Vigente hasta 2027-05-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3102911658',
      'lucasde2000@hotmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'colombian-all-stars-450',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-colombian-all-stars-450', v_school_id, '{"resolucion_rd": "450", "resolucion_actualizacion": null, "fecha_inicio": "11-05-2022", "fecha_fin": "2027-05-11", "presidente": "LUIS ALBERTO CASTANEDA DELGADO", "localidad": "Barrios Unidos", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALBERTO CASTANEDA DELGADO. Deporte(s): Porrismo. Localidad: Barrios Unidos. Resolución R-D Nº 450. Vigente hasta 2027-05-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102911658', phone),
      email       = COALESCE('lucasde2000@hotmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "450", "resolucion_actualizacion": null, "fecha_inicio": "11-05-2022", "fecha_fin": "2027-05-11", "presidente": "LUIS ALBERTO CASTANEDA DELGADO", "localidad": "Barrios Unidos", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-colombian-all-stars-450';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3102911658', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE FÃÅ¡TBOL Y SUS MODALIDADES REAL CARACOLI FC  (IDRD-CLUB-de-faatbol-y-sus-modalidades-real-caraco-586)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-faatbol-y-sus-modalidades-real-caraco-586';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE FÃÅ¡TBOL Y SUS MODALIDADES REAL CARACOLI FC',
      'Presidente: GIOVANNY ANDRÃâ°S BETANCOURT SILVA. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 586. Vigente hasta 2026-08-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '6332259',
      'realcaracolifc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-faatbol-y-sus-modalidades-real-caraco-586',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-faatbol-y-sus-modalidades-real-caraco-586', v_school_id, '{"resolucion_rd": "586", "resolucion_actualizacion": null, "fecha_inicio": "02-08-2021", "fecha_fin": "2026-08-02", "presidente": "GIOVANNY ANDRÃâ°S BETANCOURT SILVA", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GIOVANNY ANDRÃâ°S BETANCOURT SILVA. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 586. Vigente hasta 2026-08-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6332259', phone),
      email       = COALESCE('realcaracolifc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "586", "resolucion_actualizacion": null, "fecha_inicio": "02-08-2021", "fecha_fin": "2026-08-02", "presidente": "GIOVANNY ANDRÃâ°S BETANCOURT SILVA", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-faatbol-y-sus-modalidades-real-caraco-586';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '6332259', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PATIN LATINO  (IDRD-CLUB-club-deportivo-patin-latino-178)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-patin-latino-178';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PATIN LATINO',
      'Presidente: JULIAN GOMEZ CHAVES. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 178. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '81081313002943541',
      'patinlatino9@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-patin-latino-178',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-patin-latino-178', v_school_id, '{"resolucion_rd": "178", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2024", "fecha_fin": "2029-02-22", "presidente": "JULIAN GOMEZ CHAVES", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIAN GOMEZ CHAVES. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 178. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('81081313002943541', phone),
      email       = COALESCE('patinlatino9@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "178", "resolucion_actualizacion": null, "fecha_inicio": "23-02-2024", "fecha_fin": "2029-02-22", "presidente": "JULIAN GOMEZ CHAVES", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-patin-latino-178';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '81081313002943541', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TAEWKONDO TAO TE KING  (IDRD-CLUB-taewkondo-tao-te-king-730)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taewkondo-tao-te-king-730';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEWKONDO TAO TE KING',
      'Presidente: JHOJAN STIVEN BARACALDO RODRIGUEZ. Deporte(s): Taekwondo. Localidad: Bosa. Resolución R-D Nº 730. Vigente hasta 2026-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3004044758',
      'hiogamon_93@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taewkondo-tao-te-king-730',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taewkondo-tao-te-king-730', v_school_id, '{"resolucion_rd": "730", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2021", "fecha_fin": "2026-09-20", "presidente": "JHOJAN STIVEN BARACALDO RODRIGUEZ", "localidad": "Bosa", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHOJAN STIVEN BARACALDO RODRIGUEZ. Deporte(s): Taekwondo. Localidad: Bosa. Resolución R-D Nº 730. Vigente hasta 2026-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3004044758', phone),
      email       = COALESCE('hiogamon_93@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "730", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2021", "fecha_fin": "2026-09-20", "presidente": "JHOJAN STIVEN BARACALDO RODRIGUEZ", "localidad": "Bosa", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taewkondo-tao-te-king-730';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3004044758', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUNDACIÃâN CLUB FOOTBALL AMERICANO PUMAS D.C  (IDRD-CLUB-fundaciaan-club-football-americano-pumas-743)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fundaciaan-club-football-americano-pumas-743';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUNDACIÃâN CLUB FOOTBALL AMERICANO PUMAS D.C',
      'Presidente: WILLIAM DARIO ATEHORTUA TORRES. Deporte(s): Fútbol, Football Americano. Localidad: Teusaquillo. Resolución R-D Nº 743. Vigente hasta 2027-07-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3185023389',
      'presidencia@pumasdc.com.co',
      ARRAY['Fútbol','Football Americano']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fundaciaan-club-football-americano-pumas-743',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fundaciaan-club-football-americano-pumas-743', v_school_id, '{"resolucion_rd": "743", "resolucion_actualizacion": null, "fecha_inicio": "07-07-2022", "fecha_fin": "2027-07-07", "presidente": "WILLIAM DARIO ATEHORTUA TORRES", "localidad": "Teusaquillo", "sports": ["Fútbol", "Football Americano"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILLIAM DARIO ATEHORTUA TORRES. Deporte(s): Fútbol, Football Americano. Localidad: Teusaquillo. Resolución R-D Nº 743. Vigente hasta 2027-07-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3185023389', phone),
      email       = COALESCE('presidencia@pumasdc.com.co', email),
      sports      = ARRAY['Fútbol','Football Americano']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "743", "resolucion_actualizacion": null, "fecha_inicio": "07-07-2022", "fecha_fin": "2027-07-07", "presidente": "WILLIAM DARIO ATEHORTUA TORRES", "localidad": "Teusaquillo", "sports": ["Fútbol", "Football Americano"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fundaciaan-club-football-americano-pumas-743';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3185023389', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO OPEN SLAM  (IDRD-CLUB-club-deportivo-open-slam-870)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-open-slam-870';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO OPEN SLAM',
      'Presidente: JAIRO LEANDRO AMAYA. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 870. Vigente hasta 2028-08-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3114896628',
      'clubopenslam12@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-open-slam-870',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-open-slam-870', v_school_id, '{"resolucion_rd": "870", "resolucion_actualizacion": null, "fecha_inicio": "04-08-2023", "fecha_fin": "2028-08-03", "presidente": "JAIRO LEANDRO AMAYA", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIRO LEANDRO AMAYA. Deporte(s): Tenis. Localidad: Suba. Resolución R-D Nº 870. Vigente hasta 2028-08-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114896628', phone),
      email       = COALESCE('clubopenslam12@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "870", "resolucion_actualizacion": null, "fecha_inicio": "04-08-2023", "fecha_fin": "2028-08-03", "presidente": "JAIRO LEANDRO AMAYA", "localidad": "Suba", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-open-slam-870';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3114896628', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DISTRITAL DE FORMACIÃâN CICLISTICA CAPITAL BIKE  (IDRD-CLUB-club-distrital-de-formaciaan-ciclistica--1433)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-distrital-de-formaciaan-ciclistica--1433';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DISTRITAL DE FORMACIÃâN CICLISTICA CAPITAL BIKE',
      'Presidente: EDWIN RAUL ROA PRADA. Deporte(s): Ciclismo. Localidad: Barrios Unidos. Resolución R-D Nº 1433. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3118593679',
      'clubcapitalbike@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-distrital-de-formaciaan-ciclistica--1433',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-distrital-de-formaciaan-ciclistica--1433', v_school_id, '{"resolucion_rd": "1433", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "EDWIN RAUL ROA PRADA", "localidad": "Barrios Unidos", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN RAUL ROA PRADA. Deporte(s): Ciclismo. Localidad: Barrios Unidos. Resolución R-D Nº 1433. Vigente hasta 2027-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118593679', phone),
      email       = COALESCE('clubcapitalbike@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1433", "resolucion_actualizacion": null, "fecha_inicio": "08-11-2022", "fecha_fin": "2027-11-08", "presidente": "EDWIN RAUL ROA PRADA", "localidad": "Barrios Unidos", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-distrital-de-formaciaan-ciclistica--1433';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3118593679', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA CENTRAL ESTUDIANTES JR  (IDRD-CLUB-club-deportivo-academia-central-estudian-776)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-central-estudian-776';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA CENTRAL ESTUDIANTES JR',
      'Presidente: ESTEFFANIA RAMIREZ GARZÃâN. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 776 / actualización Nº 1171. Vigente hasta 2026-10-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3204745144',
      'acestudiantesjr@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-central-estudian-776',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-central-estudian-776', v_school_id, '{"resolucion_rd": "776", "resolucion_actualizacion": "1171", "fecha_inicio": "21-10-2021", "fecha_fin": "2026-10-21", "presidente": "ESTEFFANIA RAMIREZ GARZÃâN", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ESTEFFANIA RAMIREZ GARZÃâN. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 776 / actualización Nº 1171. Vigente hasta 2026-10-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204745144', phone),
      email       = COALESCE('acestudiantesjr@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "776", "resolucion_actualizacion": "1171", "fecha_inicio": "21-10-2021", "fecha_fin": "2026-10-21", "presidente": "ESTEFFANIA RAMIREZ GARZÃâN", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-central-estudian-776';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3204745144', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DEPORTE MENTAL  (IDRD-CLUB-club-deportivo-deporte-mental-865)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-deporte-mental-865';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DEPORTE MENTAL',
      'Presidente: JIMENA CATERINE ANCHIQUE CARDOZO. Deporte(s): Ajedrez. Localidad: Suba. Resolución R-D Nº 865 / actualización Nº 865. Vigente hasta 2027-05-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3023496684',
      'deportementalcv@gmail.com',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-deporte-mental-865',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-deporte-mental-865', v_school_id, '{"resolucion_rd": "865", "resolucion_actualizacion": "865", "fecha_inicio": "19-05-2022", "fecha_fin": "2027-05-19", "presidente": "JIMENA CATERINE ANCHIQUE CARDOZO", "localidad": "Suba", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JIMENA CATERINE ANCHIQUE CARDOZO. Deporte(s): Ajedrez. Localidad: Suba. Resolución R-D Nº 865 / actualización Nº 865. Vigente hasta 2027-05-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3023496684', phone),
      email       = COALESCE('deportementalcv@gmail.com', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "865", "resolucion_actualizacion": "865", "fecha_inicio": "19-05-2022", "fecha_fin": "2027-05-19", "presidente": "JIMENA CATERINE ANCHIQUE CARDOZO", "localidad": "Suba", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-deporte-mental-865';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3023496684', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INDEPENDIENTE POPULAR FC MIAMI NACIONAL SC  (IDRD-CLUB-independiente-popular-fc-miami-nacional--099)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-independiente-popular-fc-miami-nacional--099';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INDEPENDIENTE POPULAR FC MIAMI NACIONAL SC',
      'Presidente: MARTÃÂN FUENTES MARTÃÂNEZ. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 099. Vigente hasta 2027-02-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3124570791',
      'fuentesk_@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'independiente-popular-fc-miami-nacional--099',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-independiente-popular-fc-miami-nacional--099', v_school_id, '{"resolucion_rd": "099", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2022", "fecha_fin": "2027-02-16", "presidente": "MARTÃÂN FUENTES MARTÃÂNEZ", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTÃÂN FUENTES MARTÃÂNEZ. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 099. Vigente hasta 2027-02-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124570791', phone),
      email       = COALESCE('fuentesk_@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "099", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2022", "fecha_fin": "2027-02-16", "presidente": "MARTÃÂN FUENTES MARTÃÂNEZ", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-independiente-popular-fc-miami-nacional--099';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3124570791', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE BALONCESTO LINCES  (IDRD-CLUB-club-de-baloncesto-linces-217)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-baloncesto-linces-217';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE BALONCESTO LINCES',
      'Presidente: DIEGO ANDRES CRUZ COCUNUBO. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 217. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3132106025',
      'clublincesbogota@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-baloncesto-linces-217',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-baloncesto-linces-217', v_school_id, '{"resolucion_rd": "217", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "DIEGO ANDRES CRUZ COCUNUBO", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ANDRES CRUZ COCUNUBO. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 217. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132106025', phone),
      email       = COALESCE('clublincesbogota@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "217", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "DIEGO ANDRES CRUZ COCUNUBO", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-baloncesto-linces-217';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3132106025', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COMBAT SPORT  (IDRD-CLUB-combat-sport-894)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-combat-sport-894';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COMBAT SPORT',
      'Presidente: ANDRES GIOVANNY TABORDA TORRES. Deporte(s): Lucha. Localidad: Kennedy. Resolución R-D Nº 894. Vigente hasta 2026-10-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3167573041',
      'leogars19@hotmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'combat-sport-894',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-combat-sport-894', v_school_id, '{"resolucion_rd": "894", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2021", "fecha_fin": "2026-10-25", "presidente": "ANDRES GIOVANNY TABORDA TORRES", "localidad": "Kennedy", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES GIOVANNY TABORDA TORRES. Deporte(s): Lucha. Localidad: Kennedy. Resolución R-D Nº 894. Vigente hasta 2026-10-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3167573041', phone),
      email       = COALESCE('leogars19@hotmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "894", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2021", "fecha_fin": "2026-10-25", "presidente": "ANDRES GIOVANNY TABORDA TORRES", "localidad": "Kennedy", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-combat-sport-894';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3167573041', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SIERRA FUTBOL CLUB  (IDRD-CLUB-sierra-futbol-club-239)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sierra-futbol-club-239';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SIERRA FUTBOL CLUB',
      'Presidente: seÃÂ±ora EDGAR MAURICIO SUAREZ REYES. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 239. Vigente hasta 2027-03-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3118544151',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sierra-futbol-club-239',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sierra-futbol-club-239', v_school_id, '{"resolucion_rd": "239", "resolucion_actualizacion": null, "fecha_inicio": "28-03-2022", "fecha_fin": "2027-03-28", "presidente": "seÃÂ±ora EDGAR MAURICIO SUAREZ REYES", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: seÃÂ±ora EDGAR MAURICIO SUAREZ REYES. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 239. Vigente hasta 2027-03-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118544151', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "239", "resolucion_actualizacion": null, "fecha_inicio": "28-03-2022", "fecha_fin": "2027-03-28", "presidente": "seÃÂ±ora EDGAR MAURICIO SUAREZ REYES", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sierra-futbol-club-239';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3118544151', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CHAMPION TEAM  (IDRD-CLUB-champion-team-1099)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-champion-team-1099';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CHAMPION TEAM',
      'Presidente: CARLOS FERNANDO TUIRAN ARDILA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1099. Vigente hasta 2027-09-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3160466957',
      'carlosf.tuiran@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'champion-team-1099',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-champion-team-1099', v_school_id, '{"resolucion_rd": "1099", "resolucion_actualizacion": null, "fecha_inicio": "16-09-2022", "fecha_fin": "2027-09-16", "presidente": "CARLOS FERNANDO TUIRAN ARDILA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS FERNANDO TUIRAN ARDILA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1099. Vigente hasta 2027-09-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3160466957', phone),
      email       = COALESCE('carlosf.tuiran@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1099", "resolucion_actualizacion": null, "fecha_inicio": "16-09-2022", "fecha_fin": "2027-09-16", "presidente": "CARLOS FERNANDO TUIRAN ARDILA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-champion-team-1099';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3160466957', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB WATERPOLO BADIA DEL VALLÃâ°S  (IDRD-CLUB-club-waterpolo-badia-del-vallaas-211)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-waterpolo-badia-del-vallaas-211';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB WATERPOLO BADIA DEL VALLÃâ°S',
      'Presidente: ANDRES CAMILO PERALTA CHAPARRO. Deporte(s): Natación. Localidad: Teusaquillo. Resolución R-D Nº 211. Vigente hasta 2027-03-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3112114770',
      'ing.andresperalta@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-waterpolo-badia-del-vallaas-211',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-waterpolo-badia-del-vallaas-211', v_school_id, '{"resolucion_rd": "211", "resolucion_actualizacion": null, "fecha_inicio": "09-03-2022", "fecha_fin": "2027-03-09", "presidente": "ANDRES CAMILO PERALTA CHAPARRO", "localidad": "Teusaquillo", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES CAMILO PERALTA CHAPARRO. Deporte(s): Natación. Localidad: Teusaquillo. Resolución R-D Nº 211. Vigente hasta 2027-03-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112114770', phone),
      email       = COALESCE('ing.andresperalta@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "211", "resolucion_actualizacion": null, "fecha_inicio": "09-03-2022", "fecha_fin": "2027-03-09", "presidente": "ANDRES CAMILO PERALTA CHAPARRO", "localidad": "Teusaquillo", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-waterpolo-badia-del-vallaas-211';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3112114770', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JDA  (IDRD-CLUB-club-deportivo-jda-1440)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jda-1440';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JDA',
      'Presidente: JOSÃâ° DAVID RODRIGUEZ LEON. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1440. Vigente hasta 2030-12-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3222395449',
      'clubdeportivojda.@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jda-1440',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jda-1440', v_school_id, '{"resolucion_rd": "1440", "resolucion_actualizacion": null, "fecha_inicio": "03-12-2025", "fecha_fin": "2030-12-03", "presidente": "JOSÃâ° DAVID RODRIGUEZ LEON", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSÃâ° DAVID RODRIGUEZ LEON. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1440. Vigente hasta 2030-12-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222395449', phone),
      email       = COALESCE('clubdeportivojda.@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1440", "resolucion_actualizacion": null, "fecha_inicio": "03-12-2025", "fecha_fin": "2030-12-03", "presidente": "JOSÃâ° DAVID RODRIGUEZ LEON", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jda-1440';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3222395449', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BARACK  (IDRD-CLUB-barack-118)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-barack-118';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BARACK',
      'Presidente: DANIEL FABIAN MORENO RODRIGUEZ. Deporte(s): Tenis. Localidad: Puente Aranda. Resolución R-D Nº 118. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3003020509',
      'danyel.ten@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'barack-118',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-barack-118', v_school_id, '{"resolucion_rd": "118", "resolucion_actualizacion": null, "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "DANIEL FABIAN MORENO RODRIGUEZ", "localidad": "Puente Aranda", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL FABIAN MORENO RODRIGUEZ. Deporte(s): Tenis. Localidad: Puente Aranda. Resolución R-D Nº 118. Vigente hasta 2027-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003020509', phone),
      email       = COALESCE('danyel.ten@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "118", "resolucion_actualizacion": null, "fecha_inicio": "11-02-2022", "fecha_fin": "2027-02-11", "presidente": "DANIEL FABIAN MORENO RODRIGUEZ", "localidad": "Puente Aranda", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-barack-118';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3003020509', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PRO CONCEPT BMX CLUB  (IDRD-CLUB-club-deportivo-pro-concept-bmx-club-172)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pro-concept-bmx-club-172';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PRO CONCEPT BMX CLUB',
      'Presidente: ANDRES ENRIQUE PEÃâA RODRIGUEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 172 / actualización Nº 1767. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3118986660',
      'proconceptbmxclub@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pro-concept-bmx-club-172',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pro-concept-bmx-club-172', v_school_id, '{"resolucion_rd": "172", "resolucion_actualizacion": "1767", "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "ANDRES ENRIQUE PEÃâA RODRIGUEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES ENRIQUE PEÃâA RODRIGUEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 172 / actualización Nº 1767. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118986660', phone),
      email       = COALESCE('proconceptbmxclub@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "172", "resolucion_actualizacion": "1767", "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "ANDRES ENRIQUE PEÃâA RODRIGUEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pro-concept-bmx-club-172';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3118986660', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PATINAJE SKY BOGOTÃÆÃÂ  (IDRD-CLUB-patinaje-sky-bogotaaa-1228)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-patinaje-sky-bogotaaa-1228';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PATINAJE SKY BOGOTÃÆÃÂ',
      'Presidente: JOSE ALEXANDER PARRA GELVES. Deporte(s): Patinaje. Localidad: Tunjuelito. Resolución R-D Nº 1228. Vigente hasta 2027-10-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '71112483002531973',
      'japyanes21@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'patinaje-sky-bogotaaa-1228',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-patinaje-sky-bogotaaa-1228', v_school_id, '{"resolucion_rd": "1228", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2022", "fecha_fin": "2027-10-06", "presidente": "JOSE ALEXANDER PARRA GELVES", "localidad": "Tunjuelito", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE ALEXANDER PARRA GELVES. Deporte(s): Patinaje. Localidad: Tunjuelito. Resolución R-D Nº 1228. Vigente hasta 2027-10-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('71112483002531973', phone),
      email       = COALESCE('japyanes21@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1228", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2022", "fecha_fin": "2027-10-06", "presidente": "JOSE ALEXANDER PARRA GELVES", "localidad": "Tunjuelito", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-patinaje-sky-bogotaaa-1228';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '71112483002531973', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BATALLA DE CAMPEONES 4340  (IDRD-CLUB-club-deportivo-batalla-de-campeones-4340-1112)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-batalla-de-campeones-4340-1112';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BATALLA DE CAMPEONES 4340',
      'Presidente: PEDRO JOSÃâ° ROJAS MENDOZA. Deporte(s): Tejo. Localidad: Kennedy. Resolución R-D Nº 1112. Vigente hasta 2030-10-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3212348537',
      'clubbatalladecampeones4340@gmail.com',
      ARRAY['Tejo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-batalla-de-campeones-4340-1112',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-batalla-de-campeones-4340-1112', v_school_id, '{"resolucion_rd": "1112", "resolucion_actualizacion": null, "fecha_inicio": "09-10-2025", "fecha_fin": "2030-10-09", "presidente": "PEDRO JOSÃâ° ROJAS MENDOZA", "localidad": "Kennedy", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO JOSÃâ° ROJAS MENDOZA. Deporte(s): Tejo. Localidad: Kennedy. Resolución R-D Nº 1112. Vigente hasta 2030-10-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212348537', phone),
      email       = COALESCE('clubbatalladecampeones4340@gmail.com', email),
      sports      = ARRAY['Tejo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1112", "resolucion_actualizacion": null, "fecha_inicio": "09-10-2025", "fecha_fin": "2030-10-09", "presidente": "PEDRO JOSÃâ° ROJAS MENDOZA", "localidad": "Kennedy", "sports": ["Tejo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-batalla-de-campeones-4340-1112';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3212348537', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- UNIÃâN CAPITALINOS  (IDRD-CLUB-uniaan-capitalinos-999)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-uniaan-capitalinos-999';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'UNIÃâN CAPITALINOS',
      'Presidente: HENRY MAURICIO MESA BORDA. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 999. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3114644893',
      'efutbolcapitalinos@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'uniaan-capitalinos-999',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-uniaan-capitalinos-999', v_school_id, '{"resolucion_rd": "999", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2022", "fecha_fin": "2027-08-05", "presidente": "HENRY MAURICIO MESA BORDA", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HENRY MAURICIO MESA BORDA. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 999. Vigente hasta 2027-08-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114644893', phone),
      email       = COALESCE('efutbolcapitalinos@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "999", "resolucion_actualizacion": null, "fecha_inicio": "05-08-2022", "fecha_fin": "2027-08-05", "presidente": "HENRY MAURICIO MESA BORDA", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-uniaan-capitalinos-999';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3114644893', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DINASTY WARRIORS  (IDRD-CLUB-dinasty-warriors-770)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dinasty-warriors-770';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DINASTY WARRIORS',
      'Presidente: OLGA MARIA ANZOLA GALVIS. Deporte(s): Lucha. Localidad: Antonio Nariño. Resolución R-D Nº 770. Vigente hasta 2028-07-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3138234868',
      'rigowrestling@hotmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dinasty-warriors-770',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dinasty-warriors-770', v_school_id, '{"resolucion_rd": "770", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2023", "fecha_fin": "2028-07-18", "presidente": "OLGA MARIA ANZOLA GALVIS", "localidad": "Antonio Nariño", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OLGA MARIA ANZOLA GALVIS. Deporte(s): Lucha. Localidad: Antonio Nariño. Resolución R-D Nº 770. Vigente hasta 2028-07-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138234868', phone),
      email       = COALESCE('rigowrestling@hotmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "770", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2023", "fecha_fin": "2028-07-18", "presidente": "OLGA MARIA ANZOLA GALVIS", "localidad": "Antonio Nariño", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dinasty-warriors-770';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3138234868', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- A.SKY BOGOTA FUTBOL CLUB  (IDRD-CLUB-asky-bogota-futbol-club-848)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-asky-bogota-futbol-club-848';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'A.SKY BOGOTA FUTBOL CLUB',
      'Presidente: NIDIA STELLA GELVES CARDENAS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 848. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3125059863',
      'nillo14@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'asky-bogota-futbol-club-848',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-asky-bogota-futbol-club-848', v_school_id, '{"resolucion_rd": "848", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "NIDIA STELLA GELVES CARDENAS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NIDIA STELLA GELVES CARDENAS. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 848. Vigente hasta 2027-08-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125059863', phone),
      email       = COALESCE('nillo14@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "848", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2022", "fecha_fin": "2027-08-10", "presidente": "NIDIA STELLA GELVES CARDENAS", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-asky-bogota-futbol-club-848';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3125059863', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA DE FUTBOL NUEVA ERA  (IDRD-CLUB-club-deportivo-academia-de-futbol-nueva--028)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-de-futbol-nueva--028';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA DE FUTBOL NUEVA ERA',
      'Presidente: RUSBER IVÃN HINCAPIÃ URREA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 028. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3105813461',
      'acanuevaera@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-de-futbol-nueva--028',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-de-futbol-nueva--028', v_school_id, '{"resolucion_rd": "028", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "RUSBER IVÃN HINCAPIÃ URREA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RUSBER IVÃN HINCAPIÃ URREA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 028. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105813461', phone),
      email       = COALESCE('acanuevaera@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "028", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "RUSBER IVÃN HINCAPIÃ URREA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-de-futbol-nueva--028';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3105813461', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RIDE MACHINES  (IDRD-CLUB-ride-machines-1304)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ride-machines-1304';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RIDE MACHINES',
      'Presidente: ALEXANDER GUERRERO MUSUSUE. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1304. Vigente hasta 2027-10-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3202928130',
      'escuelabmxridemachines@gmai.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ride-machines-1304',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ride-machines-1304', v_school_id, '{"resolucion_rd": "1304", "resolucion_actualizacion": null, "fecha_inicio": "18-10-2022", "fecha_fin": "2027-10-18", "presidente": "ALEXANDER GUERRERO MUSUSUE", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEXANDER GUERRERO MUSUSUE. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1304. Vigente hasta 2027-10-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202928130', phone),
      email       = COALESCE('escuelabmxridemachines@gmai.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1304", "resolucion_actualizacion": null, "fecha_inicio": "18-10-2022", "fecha_fin": "2027-10-18", "presidente": "ALEXANDER GUERRERO MUSUSUE", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ride-machines-1304';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3202928130', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RENOVACION INTERNACIONAL  (IDRD-CLUB-renovacion-internacional-563)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-renovacion-internacional-563';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RENOVACION INTERNACIONAL',
      'Presidente: DIEGO FERNANDO GUERRA RICO. Localidad: Antonio Nariño. Resolución R-D Nº 563. Vigente hasta 2027-06-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '46840153133571568',
      'renovaciondeportiva@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'renovacion-internacional-563',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-renovacion-internacional-563', v_school_id, '{"resolucion_rd": "563", "resolucion_actualizacion": null, "fecha_inicio": "02-06-2022", "fecha_fin": "2027-06-02", "presidente": "DIEGO FERNANDO GUERRA RICO", "localidad": "Antonio Nariño", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO FERNANDO GUERRA RICO. Localidad: Antonio Nariño. Resolución R-D Nº 563. Vigente hasta 2027-06-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('46840153133571568', phone),
      email       = COALESCE('renovaciondeportiva@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "563", "resolucion_actualizacion": null, "fecha_inicio": "02-06-2022", "fecha_fin": "2027-06-02", "presidente": "DIEGO FERNANDO GUERRA RICO", "localidad": "Antonio Nariño", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-renovacion-internacional-563';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '46840153133571568', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KYODAI  (IDRD-CLUB-club-deportivo-kyodai-1132)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kyodai-1132';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KYODAI',
      'Presidente: CESAR ANDRES GARCIA DOMINGUEZ. Deporte(s): Fútbol, Gimnasia, Jiu Jit Su, Judo, Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 1132. Vigente hasta 2030-10-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3177437707',
      'clubdeportivokyodai@gmail.com',
      ARRAY['Fútbol','Gimnasia','Jiu Jit Su','Judo','Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kyodai-1132',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kyodai-1132', v_school_id, '{"resolucion_rd": "1132", "resolucion_actualizacion": null, "fecha_inicio": "10-10-2025", "fecha_fin": "2030-10-10", "presidente": "CESAR ANDRES GARCIA DOMINGUEZ", "localidad": "San Cristóbal", "sports": ["Fútbol", "Gimnasia", "Jiu Jit Su", "Judo", "Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CESAR ANDRES GARCIA DOMINGUEZ. Deporte(s): Fútbol, Gimnasia, Jiu Jit Su, Judo, Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 1132. Vigente hasta 2030-10-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3177437707', phone),
      email       = COALESCE('clubdeportivokyodai@gmail.com', email),
      sports      = ARRAY['Fútbol','Gimnasia','Jiu Jit Su','Judo','Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1132", "resolucion_actualizacion": null, "fecha_inicio": "10-10-2025", "fecha_fin": "2030-10-10", "presidente": "CESAR ANDRES GARCIA DOMINGUEZ", "localidad": "San Cristóbal", "sports": ["Fútbol", "Gimnasia", "Jiu Jit Su", "Judo", "Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kyodai-1132';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3177437707', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESTRELLAS ELITE FUTBOL CLUB  (IDRD-CLUB-estrellas-elite-futbol-club-1033)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-estrellas-elite-futbol-club-1033';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESTRELLAS ELITE FUTBOL CLUB',
      'Presidente: DIEGO FERNANDO RUIZ RAMÃÂREZ,. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1033. Vigente hasta 2028-09-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3177084885',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'estrellas-elite-futbol-club-1033',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-estrellas-elite-futbol-club-1033', v_school_id, '{"resolucion_rd": "1033", "resolucion_actualizacion": null, "fecha_inicio": "08-09-2023", "fecha_fin": "2028-09-07", "presidente": "DIEGO FERNANDO RUIZ RAMÃÂREZ,", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO FERNANDO RUIZ RAMÃÂREZ,. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1033. Vigente hasta 2028-09-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3177084885', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1033", "resolucion_actualizacion": null, "fecha_inicio": "08-09-2023", "fecha_fin": "2028-09-07", "presidente": "DIEGO FERNANDO RUIZ RAMÃÂREZ,", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-estrellas-elite-futbol-club-1033';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3177084885', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HARUKI  (IDRD-CLUB-club-deportivo-haruki-663)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-haruki-663';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HARUKI',
      'Presidente: EDUARD GABRIEL GUTIERREZ MUÃâOZ. Deporte(s): Judo. Localidad: Usme. Resolución R-D Nº 663. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3212263807',
      'clubdeportivodejudoharuki@gmail.com',
      ARRAY['Judo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-haruki-663',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-haruki-663', v_school_id, '{"resolucion_rd": "663", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "EDUARD GABRIEL GUTIERREZ MUÃâOZ", "localidad": "Usme", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDUARD GABRIEL GUTIERREZ MUÃâOZ. Deporte(s): Judo. Localidad: Usme. Resolución R-D Nº 663. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212263807', phone),
      email       = COALESCE('clubdeportivodejudoharuki@gmail.com', email),
      sports      = ARRAY['Judo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "663", "resolucion_actualizacion": null, "fecha_inicio": "04-06-2024", "fecha_fin": "2029-06-04", "presidente": "EDUARD GABRIEL GUTIERREZ MUÃâOZ", "localidad": "Usme", "sports": ["Judo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-haruki-663';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3212263807', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL ESCUELA  (IDRD-CLUB-real-escuela-061)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-escuela-061';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL ESCUELA',
      'Presidente: JOHN HENRY MONTENEGRO. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 061. Vigente hasta 2027-01-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3214446996',
      'carolinavelasquezq@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-escuela-061',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-escuela-061', v_school_id, '{"resolucion_rd": "061", "resolucion_actualizacion": null, "fecha_inicio": "25-01-2022", "fecha_fin": "2027-01-25", "presidente": "JOHN HENRY MONTENEGRO", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN HENRY MONTENEGRO. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 061. Vigente hasta 2027-01-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214446996', phone),
      email       = COALESCE('carolinavelasquezq@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "061", "resolucion_actualizacion": null, "fecha_inicio": "25-01-2022", "fecha_fin": "2027-01-25", "presidente": "JOHN HENRY MONTENEGRO", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-escuela-061';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3214446996', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLAS BOGOTÃÆÃÂ F.C.  (IDRD-CLUB-atlas-bogotaaa-fc-041)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atlas-bogotaaa-fc-041';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLAS BOGOTÃÆÃÂ F.C.',
      'Presidente: JHON ANDERSON VASQUEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 041. Vigente hasta 2027-01-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3043282518',
      'jhon.a09@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atlas-bogotaaa-fc-041',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atlas-bogotaaa-fc-041', v_school_id, '{"resolucion_rd": "041", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2022", "fecha_fin": "2027-01-17", "presidente": "JHON ANDERSON VASQUEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON ANDERSON VASQUEZ. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 041. Vigente hasta 2027-01-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043282518', phone),
      email       = COALESCE('jhon.a09@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "041", "resolucion_actualizacion": null, "fecha_inicio": "17-01-2022", "fecha_fin": "2027-01-17", "presidente": "JHON ANDERSON VASQUEZ", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atlas-bogotaaa-fc-041';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3043282518', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOURDES TAEKWONDO  (IDRD-CLUB-club-deportivo-lourdes-taekwondo-1017)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lourdes-taekwondo-1017';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOURDES TAEKWONDO',
      'Presidente: JOSE JOAQUIN MARTÃNEZ RUIZ. Deporte(s): Taekwondo. Localidad: Los Mártires. Resolución R-D Nº 1017. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3162257758',
      'taekwondo_lourdes@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lourdes-taekwondo-1017',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lourdes-taekwondo-1017', v_school_id, '{"resolucion_rd": "1017", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "JOSE JOAQUIN MARTÃNEZ RUIZ", "localidad": "Los Mártires", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE JOAQUIN MARTÃNEZ RUIZ. Deporte(s): Taekwondo. Localidad: Los Mártires. Resolución R-D Nº 1017. Vigente hasta 2029-07-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3162257758', phone),
      email       = COALESCE('taekwondo_lourdes@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1017", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2024", "fecha_fin": "2029-07-31", "presidente": "JOSE JOAQUIN MARTÃNEZ RUIZ", "localidad": "Los Mártires", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lourdes-taekwondo-1017';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3162257758', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO GUERREROS DORADOS FUTBOL CLUB  (IDRD-CLUB-club-deportivo-guerreros-dorados-futbol--249)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-guerreros-dorados-futbol--249';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO GUERREROS DORADOS FUTBOL CLUB',
      'Presidente: MARÃÂA ISABEL HERNÃÂNDEZ SIERRA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 249 / actualización Nº 030. Vigente hasta 2027-03-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3142949463',
      'guerrerosdoradofc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-guerreros-dorados-futbol--249',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-guerreros-dorados-futbol--249', v_school_id, '{"resolucion_rd": "249", "resolucion_actualizacion": "030", "fecha_inicio": "15-03-2022", "fecha_fin": "2027-03-15", "presidente": "MARÃÂA ISABEL HERNÃÂNDEZ SIERRA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃÂA ISABEL HERNÃÂNDEZ SIERRA. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 249 / actualización Nº 030. Vigente hasta 2027-03-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142949463', phone),
      email       = COALESCE('guerrerosdoradofc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "249", "resolucion_actualizacion": "030", "fecha_inicio": "15-03-2022", "fecha_fin": "2027-03-15", "presidente": "MARÃÂA ISABEL HERNÃÂNDEZ SIERRA", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-guerreros-dorados-futbol--249';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3142949463', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB CAMPESTRE EL RANCHO  (IDRD-CLUB-club-campestre-el-rancho-287)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-campestre-el-rancho-287';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB CAMPESTRE EL RANCHO',
      'Presidente: JAIRO MEDINA VERGARA. Deporte(s): Bowling, Fútbol, Ecuestre, Natación, Golf, Squash, Billar, Tenis, Tiro deportivo. Localidad: Suba. Resolución R-D Nº 287. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '6684600',
      'precidencia@clubelrancho.com',
      ARRAY['Bowling','Fútbol','Ecuestre','Natación','Golf','Squash','Billar','Tenis','Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-campestre-el-rancho-287',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-campestre-el-rancho-287', v_school_id, '{"resolucion_rd": "287", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "JAIRO MEDINA VERGARA", "localidad": "Suba", "sports": ["Bowling", "Fútbol", "Ecuestre", "Natación", "Golf", "Squash", "Billar", "Tenis", "Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIRO MEDINA VERGARA. Deporte(s): Bowling, Fútbol, Ecuestre, Natación, Golf, Squash, Billar, Tenis, Tiro deportivo. Localidad: Suba. Resolución R-D Nº 287. Vigente hasta 2027-03-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6684600', phone),
      email       = COALESCE('precidencia@clubelrancho.com', email),
      sports      = ARRAY['Bowling','Fútbol','Ecuestre','Natación','Golf','Squash','Billar','Tenis','Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "287", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2022", "fecha_fin": "2027-03-29", "presidente": "JAIRO MEDINA VERGARA", "localidad": "Suba", "sports": ["Bowling", "Fútbol", "Ecuestre", "Natación", "Golf", "Squash", "Billar", "Tenis", "Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-campestre-el-rancho-287';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '6684600', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DE PATINAJE BACATA D.C_  (IDRD-CLUB-de-patinaje-bacata-dc-1654)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-de-patinaje-bacata-dc-1654';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DE PATINAJE BACATA D.C_',
      'Presidente: MARÃÂA FERNANDA ALONSO TABORDA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1654. Vigente hasta 2027-12-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3148116144',
      'janavas@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'de-patinaje-bacata-dc-1654',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-de-patinaje-bacata-dc-1654', v_school_id, '{"resolucion_rd": "1654", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2022", "fecha_fin": "2027-12-15", "presidente": "MARÃÂA FERNANDA ALONSO TABORDA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃÂA FERNANDA ALONSO TABORDA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1654. Vigente hasta 2027-12-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3148116144', phone),
      email       = COALESCE('janavas@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1654", "resolucion_actualizacion": null, "fecha_inicio": "15-12-2022", "fecha_fin": "2027-12-15", "presidente": "MARÃÂA FERNANDA ALONSO TABORDA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-de-patinaje-bacata-dc-1654';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3148116144', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FRANCISCO JOSE DE CALDAS F.S  (IDRD-CLUB-francisco-jose-de-caldas-fs-354)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-francisco-jose-de-caldas-fs-354';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FRANCISCO JOSE DE CALDAS F.S',
      'Presidente: OLGA LUCIA ROJAS URREGO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 354. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3112669789',
      'escueladeportivafjc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'francisco-jose-de-caldas-fs-354',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-francisco-jose-de-caldas-fs-354', v_school_id, '{"resolucion_rd": "354", "resolucion_actualizacion": null, "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "OLGA LUCIA ROJAS URREGO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OLGA LUCIA ROJAS URREGO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 354. Vigente hasta 2027-04-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112669789', phone),
      email       = COALESCE('escueladeportivafjc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "354", "resolucion_actualizacion": null, "fecha_inicio": "20-04-2022", "fecha_fin": "2027-04-20", "presidente": "OLGA LUCIA ROJAS URREGO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-francisco-jose-de-caldas-fs-354';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3112669789', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VERDEAMARELLO FUTBOL CLUB  (IDRD-CLUB-club-deportivo-verdeamarello-futbol-club-987)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-verdeamarello-futbol-club-987';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VERDEAMARELLO FUTBOL CLUB',
      'Presidente: STIVEN VARGAS REYES. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 987. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3232491701',
      'verdeamarellof.c31@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-verdeamarello-futbol-club-987',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-verdeamarello-futbol-club-987', v_school_id, '{"resolucion_rd": "987", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "STIVEN VARGAS REYES", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: STIVEN VARGAS REYES. Deporte(s): Fútbol. Localidad: Chapinero. Resolución R-D Nº 987. Vigente hasta 2030-09-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3232491701', phone),
      email       = COALESCE('verdeamarellof.c31@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "987", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2025", "fecha_fin": "2030-09-19", "presidente": "STIVEN VARGAS REYES", "localidad": "Chapinero", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-verdeamarello-futbol-club-987';
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
-- BSA  (IDRD-CLUB-bsa-262)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bsa-262';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BSA',
      'Presidente: ISAY DAVID DELGADO RESTAN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 262 / actualización Nº 620. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3202325665',
      'isaytrainer@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bsa-262',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bsa-262', v_school_id, '{"resolucion_rd": "262", "resolucion_actualizacion": "620", "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "ISAY DAVID DELGADO RESTAN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ISAY DAVID DELGADO RESTAN. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 262 / actualización Nº 620. Vigente hasta 2027-03-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202325665', phone),
      email       = COALESCE('isaytrainer@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "262", "resolucion_actualizacion": "620", "fecha_inicio": "17-03-2022", "fecha_fin": "2027-03-17", "presidente": "ISAY DAVID DELGADO RESTAN", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bsa-262';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3202325665', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LEIDERS F.C  (IDRD-CLUB-leiders-fc-692)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-leiders-fc-692';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEIDERS F.C',
      'Presidente: EDISON DAVID CADENA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 692. Vigente hasta 2027-06-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3195685724',
      'leidersfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'leiders-fc-692',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-leiders-fc-692', v_school_id, '{"resolucion_rd": "692", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2022", "fecha_fin": "2027-06-28", "presidente": "EDISON DAVID CADENA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDISON DAVID CADENA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 692. Vigente hasta 2027-06-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195685724', phone),
      email       = COALESCE('leidersfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "692", "resolucion_actualizacion": null, "fecha_inicio": "28-06-2022", "fecha_fin": "2027-06-28", "presidente": "EDISON DAVID CADENA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-leiders-fc-692';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3195685724', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETICO ALIANZA INTERNACIONAL  (IDRD-CLUB-atletico-alianza-internacional-1209)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletico-alianza-internacional-1209';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETICO ALIANZA INTERNACIONAL',
      'Presidente: ALFONSO BARRERA VARGAS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1209 / actualización Nº 02. Vigente hasta 2026-12-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '4118049311534503831088501443014576286',
      'ca.alianzainternacional@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletico-alianza-internacional-1209',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletico-alianza-internacional-1209', v_school_id, '{"resolucion_rd": "1209", "resolucion_actualizacion": "02", "fecha_inicio": "30-12-2021", "fecha_fin": "2026-12-30", "presidente": "ALFONSO BARRERA VARGAS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALFONSO BARRERA VARGAS. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1209 / actualización Nº 02. Vigente hasta 2026-12-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4118049311534503831088501443014576286', phone),
      email       = COALESCE('ca.alianzainternacional@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1209", "resolucion_actualizacion": "02", "fecha_inicio": "30-12-2021", "fecha_fin": "2026-12-30", "presidente": "ALFONSO BARRERA VARGAS", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletico-alianza-internacional-1209';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '4118049311534503831088501443014576286', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
