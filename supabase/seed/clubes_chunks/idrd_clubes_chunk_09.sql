-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 9/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SUPREME STRENGTH  (IDRD-CLUB-club-deportivo-supreme-strength-1268)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-supreme-strength-1268';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SUPREME STRENGTH',
      'Presidente: KELLY JOHANNA BARRERA MONROY. Deporte(s): Powerlifting. Localidad: Kennedy. Resolución R-D Nº 1268. Vigente hasta 2029-09-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3023627002',
      'supremstrength@gmail.com',
      ARRAY['Powerlifting']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-supreme-strength-1268',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-supreme-strength-1268', v_school_id, '{"resolucion_rd": "1268", "resolucion_actualizacion": null, "fecha_inicio": "18-09-2024", "fecha_fin": "2029-09-18", "presidente": "KELLY JOHANNA BARRERA MONROY", "localidad": "Kennedy", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KELLY JOHANNA BARRERA MONROY. Deporte(s): Powerlifting. Localidad: Kennedy. Resolución R-D Nº 1268. Vigente hasta 2029-09-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3023627002', phone),
      email       = COALESCE('supremstrength@gmail.com', email),
      sports      = ARRAY['Powerlifting']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1268", "resolucion_actualizacion": null, "fecha_inicio": "18-09-2024", "fecha_fin": "2029-09-18", "presidente": "KELLY JOHANNA BARRERA MONROY", "localidad": "Kennedy", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-supreme-strength-1268';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3023627002', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RPM  (IDRD-CLUB-club-deportivo-rpm-1278)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-rpm-1278';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RPM',
      'Presidente: JUAN SEBASTIAN PEÃA DAZA. Deporte(s): Ciclismo. Localidad: Barrios Unidos. Resolución R-D Nº 1278. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3219659535',
      'diego04p@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-rpm-1278',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-rpm-1278', v_school_id, '{"resolucion_rd": "1278", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "JUAN SEBASTIAN PEÃA DAZA", "localidad": "Barrios Unidos", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIAN PEÃA DAZA. Deporte(s): Ciclismo. Localidad: Barrios Unidos. Resolución R-D Nº 1278. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3219659535', phone),
      email       = COALESCE('diego04p@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1278", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "JUAN SEBASTIAN PEÃA DAZA", "localidad": "Barrios Unidos", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-rpm-1278';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3219659535', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TORO ROJO F.C.  (IDRD-CLUB-club-deportivo-toro-rojo-fc-1281)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-toro-rojo-fc-1281';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TORO ROJO F.C.',
      'Presidente: BRAYAN MARTÃNEZ MOLINA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1281. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3125492792',
      'redbullfc.bogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-toro-rojo-fc-1281',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-toro-rojo-fc-1281', v_school_id, '{"resolucion_rd": "1281", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "BRAYAN MARTÃNEZ MOLINA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BRAYAN MARTÃNEZ MOLINA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1281. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125492792', phone),
      email       = COALESCE('redbullfc.bogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1281", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "BRAYAN MARTÃNEZ MOLINA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-toro-rojo-fc-1281';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3125492792', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CIVIL UNITED S.C  (IDRD-CLUB-club-deportivo-civil-united-sc-1282)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-civil-united-sc-1282';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CIVIL UNITED S.C',
      'Presidente: JEISON ORLANDO DELGADO DUARTE. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1282. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3202798817',
      'civilunited.sc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-civil-united-sc-1282',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-civil-united-sc-1282', v_school_id, '{"resolucion_rd": "1282", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "JEISON ORLANDO DELGADO DUARTE", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISON ORLANDO DELGADO DUARTE. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1282. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202798817', phone),
      email       = COALESCE('civilunited.sc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1282", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "JEISON ORLANDO DELGADO DUARTE", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-civil-united-sc-1282';
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
-- CLUB DEPORTIVO SPORTS DREAMS FC  (IDRD-CLUB-club-deportivo-sports-dreams-fc-1283)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sports-dreams-fc-1283';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORTS DREAMS FC',
      'Presidente: ADRIAN ALBERTO SALAZAR ANTIA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1283. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3164145958',
      'sportsdreamsfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sports-dreams-fc-1283',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sports-dreams-fc-1283', v_school_id, '{"resolucion_rd": "1283", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "ADRIAN ALBERTO SALAZAR ANTIA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ADRIAN ALBERTO SALAZAR ANTIA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1283. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3164145958', phone),
      email       = COALESCE('sportsdreamsfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1283", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "ADRIAN ALBERTO SALAZAR ANTIA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sports-dreams-fc-1283';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3164145958', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CAPITAL PIONEROS FC  (IDRD-CLUB-club-deportivo-capital-pioneros-fc-1285)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-capital-pioneros-fc-1285';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CAPITAL PIONEROS FC',
      'Presidente: ANGIE JAZLEIDY MARROQUIN AYALA. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 1285. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3144291021',
      'pionerosfc950@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-capital-pioneros-fc-1285',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-capital-pioneros-fc-1285', v_school_id, '{"resolucion_rd": "1285", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "ANGIE JAZLEIDY MARROQUIN AYALA", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGIE JAZLEIDY MARROQUIN AYALA. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 1285. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144291021', phone),
      email       = COALESCE('pionerosfc950@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1285", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "ANGIE JAZLEIDY MARROQUIN AYALA", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-capital-pioneros-fc-1285';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3144291021', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VIKINGOS BOGOTÃ  (IDRD-CLUB-club-deportivo-vikingos-bogota-1300)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-vikingos-bogota-1300';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VIKINGOS BOGOTÃ',
      'Presidente: PABLO EMILIO LASSO GUERRERO. Deporte(s): Baloncesto. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1300. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3132318564',
      'clubbaloncestovikingos@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-vikingos-bogota-1300',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-vikingos-bogota-1300', v_school_id, '{"resolucion_rd": "1300", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "PABLO EMILIO LASSO GUERRERO", "localidad": "Rafael Uribe Uribe", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PABLO EMILIO LASSO GUERRERO. Deporte(s): Baloncesto. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1300. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132318564', phone),
      email       = COALESCE('clubbaloncestovikingos@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1300", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "PABLO EMILIO LASSO GUERRERO", "localidad": "Rafael Uribe Uribe", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-vikingos-bogota-1300';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3132318564', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EL DORADO  (IDRD-CLUB-club-deportivo-el-dorado-1301)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-dorado-1301';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EL DORADO',
      'Presidente: PEDRO JAVIER TOLOSA BUITRAGO. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 1301. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3125426534',
      'clubpatinajeeldorado@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-el-dorado-1301',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-el-dorado-1301', v_school_id, '{"resolucion_rd": "1301", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "PEDRO JAVIER TOLOSA BUITRAGO", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO JAVIER TOLOSA BUITRAGO. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 1301. Vigente hasta 2029-09-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125426534', phone),
      email       = COALESCE('clubpatinajeeldorado@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1301", "resolucion_actualizacion": null, "fecha_inicio": "20-09-2024", "fecha_fin": "2029-09-20", "presidente": "PEDRO JAVIER TOLOSA BUITRAGO", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-dorado-1301';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3125426534', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WOLVERINES SKATE  (IDRD-CLUB-club-deportivo-wolverines-skate-1273)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-wolverines-skate-1273';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WOLVERINES SKATE',
      'Presidente: CAMILA ANDREA GALINDO MOGOLLÃN. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1273. Vigente hasta 2029-09-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3118804008',
      'clubpatinajewolverines@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-wolverines-skate-1273',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-wolverines-skate-1273', v_school_id, '{"resolucion_rd": "1273", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2024", "fecha_fin": "2029-09-23", "presidente": "CAMILA ANDREA GALINDO MOGOLLÃN", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILA ANDREA GALINDO MOGOLLÃN. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 1273. Vigente hasta 2029-09-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118804008', phone),
      email       = COALESCE('clubpatinajewolverines@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1273", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2024", "fecha_fin": "2029-09-23", "presidente": "CAMILA ANDREA GALINDO MOGOLLÃN", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-wolverines-skate-1273';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3118804008', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AYK LA BARCA PATINAJE  (IDRD-CLUB-club-deportivo-ayk-la-barca-patinaje-1259)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ayk-la-barca-patinaje-1259';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AYK LA BARCA PATINAJE',
      'Presidente: KAREN JULIETH CELIS YARA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 1259. Vigente hasta 2029-09-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3142585306',
      'admnlabarca@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ayk-la-barca-patinaje-1259',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ayk-la-barca-patinaje-1259', v_school_id, '{"resolucion_rd": "1259", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2024", "fecha_fin": "2029-09-23", "presidente": "KAREN JULIETH CELIS YARA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN JULIETH CELIS YARA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 1259. Vigente hasta 2029-09-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142585306', phone),
      email       = COALESCE('admnlabarca@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1259", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2024", "fecha_fin": "2029-09-23", "presidente": "KAREN JULIETH CELIS YARA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ayk-la-barca-patinaje-1259';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3142585306', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EMBAJADORES BOGOTÃ F.C.  (IDRD-CLUB-club-deportivo-embajadores-bogota-fc-1319)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-embajadores-bogota-fc-1319';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EMBAJADORES BOGOTÃ F.C.',
      'Presidente: LUIS FERNANDO PARRA PEREZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1319. Vigente hasta 2029-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3104519357',
      'embajadoresbta@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-embajadores-bogota-fc-1319',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-embajadores-bogota-fc-1319', v_school_id, '{"resolucion_rd": "1319", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2024", "fecha_fin": "2029-09-24", "presidente": "LUIS FERNANDO PARRA PEREZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS FERNANDO PARRA PEREZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1319. Vigente hasta 2029-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3104519357', phone),
      email       = COALESCE('embajadoresbta@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1319", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2024", "fecha_fin": "2029-09-24", "presidente": "LUIS FERNANDO PARRA PEREZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-embajadores-bogota-fc-1319';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3104519357', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TOPIA  (IDRD-CLUB-club-deportivo-topia-1322)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-topia-1322';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TOPIA',
      'Presidente: JORGE ALBERTO TOPIA ALARCON. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 1322. Vigente hasta 2029-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3043980369',
      'topiaclubtenis@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-topia-1322',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-topia-1322', v_school_id, '{"resolucion_rd": "1322", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2024", "fecha_fin": "2029-09-24", "presidente": "JORGE ALBERTO TOPIA ALARCON", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE ALBERTO TOPIA ALARCON. Deporte(s): Tenis. Localidad: Engativá. Resolución R-D Nº 1322. Vigente hasta 2029-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043980369', phone),
      email       = COALESCE('topiaclubtenis@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1322", "resolucion_actualizacion": null, "fecha_inicio": "24-09-2024", "fecha_fin": "2029-09-24", "presidente": "JORGE ALBERTO TOPIA ALARCON", "localidad": "Engativá", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-topia-1322';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3043980369', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO COMANDO GALÃCTICO  (IDRD-CLUB-club-deportivo-comando-galactico-1335)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-comando-galactico-1335';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO COMANDO GALÃCTICO',
      'Presidente: CRISTIAN PUENTES VALDERRAMA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1335. Vigente hasta 2029-09-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3212530668',
      'cgalactico2@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-comando-galactico-1335',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-comando-galactico-1335', v_school_id, '{"resolucion_rd": "1335", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2024", "fecha_fin": "2029-09-25", "presidente": "CRISTIAN PUENTES VALDERRAMA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN PUENTES VALDERRAMA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1335. Vigente hasta 2029-09-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212530668', phone),
      email       = COALESCE('cgalactico2@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1335", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2024", "fecha_fin": "2029-09-25", "presidente": "CRISTIAN PUENTES VALDERRAMA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-comando-galactico-1335';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3212530668', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BIKEFRIEND  (IDRD-CLUB-club-deportivo-bikefriend-1337)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bikefriend-1337';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BIKEFRIEND',
      'Presidente: DAVID ENRIQUE NOVOA BERNAL. Deporte(s): Motociclismo. Localidad: Usaquén. Resolución R-D Nº 1337. Vigente hasta 2029-09-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3202799983',
      'club.bikefriend@gmail.com',
      ARRAY['Motociclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bikefriend-1337',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bikefriend-1337', v_school_id, '{"resolucion_rd": "1337", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2024", "fecha_fin": "2029-09-25", "presidente": "DAVID ENRIQUE NOVOA BERNAL", "localidad": "Usaquén", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID ENRIQUE NOVOA BERNAL. Deporte(s): Motociclismo. Localidad: Usaquén. Resolución R-D Nº 1337. Vigente hasta 2029-09-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202799983', phone),
      email       = COALESCE('club.bikefriend@gmail.com', email),
      sports      = ARRAY['Motociclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1337", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2024", "fecha_fin": "2029-09-25", "presidente": "DAVID ENRIQUE NOVOA BERNAL", "localidad": "Usaquén", "sports": ["Motociclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bikefriend-1337';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3202799983', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DYNASTY D.C.  (IDRD-CLUB-club-deportivo-dynasty-dc-286)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dynasty-dc-286';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DYNASTY D.C.',
      'Presidente: HECTOR GIOVANNI AVILA SALDAÃA. Deporte(s): Voleibol. Localidad: Kennedy. Resolución R-D Nº 286. Vigente hasta 2029-03-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3204298969',
      'administracion@dynastyvolleyclub.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dynasty-dc-286',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dynasty-dc-286', v_school_id, '{"resolucion_rd": "286", "resolucion_actualizacion": null, "fecha_inicio": "13-03-2024", "fecha_fin": "2029-03-13", "presidente": "HECTOR GIOVANNI AVILA SALDAÃA", "localidad": "Kennedy", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HECTOR GIOVANNI AVILA SALDAÃA. Deporte(s): Voleibol. Localidad: Kennedy. Resolución R-D Nº 286. Vigente hasta 2029-03-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204298969', phone),
      email       = COALESCE('administracion@dynastyvolleyclub.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "286", "resolucion_actualizacion": null, "fecha_inicio": "13-03-2024", "fecha_fin": "2029-03-13", "presidente": "HECTOR GIOVANNI AVILA SALDAÃA", "localidad": "Kennedy", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dynasty-dc-286';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3204298969', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ST FLEXX  (IDRD-CLUB-club-deportivo-st-flexx-1402)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-st-flexx-1402';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ST FLEXX',
      'Presidente: ANDRES ALEXANDER RODRÃÂGUEZ BARRETO. Deporte(s): Powerlifting. Localidad: Usaquén. Resolución R-D Nº 1402. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3197044159',
      'spinn2on@gmail.com',
      ARRAY['Powerlifting']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-st-flexx-1402',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-st-flexx-1402', v_school_id, '{"resolucion_rd": "1402", "resolucion_actualizacion": null, "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "ANDRES ALEXANDER RODRÃÂGUEZ BARRETO", "localidad": "Usaquén", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES ALEXANDER RODRÃÂGUEZ BARRETO. Deporte(s): Powerlifting. Localidad: Usaquén. Resolución R-D Nº 1402. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3197044159', phone),
      email       = COALESCE('spinn2on@gmail.com', email),
      sports      = ARRAY['Powerlifting']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1402", "resolucion_actualizacion": null, "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "ANDRES ALEXANDER RODRÃÂGUEZ BARRETO", "localidad": "Usaquén", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-st-flexx-1402';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3197044159', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ENIGMA VOLLEY CLUB  (IDRD-CLUB-club-deportivo-enigma-volley-club-1401)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-enigma-volley-club-1401';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ENIGMA VOLLEY CLUB',
      'Presidente: JUAN SEBASTIAN MAYORGA MONROY. Deporte(s): Voleibol. Localidad: Usme. Resolución R-D Nº 1401. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3114476752',
      'enigmavoley@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-enigma-volley-club-1401',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-enigma-volley-club-1401', v_school_id, '{"resolucion_rd": "1401", "resolucion_actualizacion": null, "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "JUAN SEBASTIAN MAYORGA MONROY", "localidad": "Usme", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN SEBASTIAN MAYORGA MONROY. Deporte(s): Voleibol. Localidad: Usme. Resolución R-D Nº 1401. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3114476752', phone),
      email       = COALESCE('enigmavoley@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1401", "resolucion_actualizacion": null, "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "JUAN SEBASTIAN MAYORGA MONROY", "localidad": "Usme", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-enigma-volley-club-1401';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3114476752', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO REPRESENT ACADEMY  (IDRD-CLUB-club-deportivo-represent-academy-1404)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-represent-academy-1404';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO REPRESENT ACADEMY',
      'Presidente: DIANA CAROLINA GONZALEZ TRIVIÃâO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1404 / actualización Nº 1962. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3003377131',
      'representforplayers@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-represent-academy-1404',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-represent-academy-1404', v_school_id, '{"resolucion_rd": "1404", "resolucion_actualizacion": "1962", "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "DIANA CAROLINA GONZALEZ TRIVIÃâO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA CAROLINA GONZALEZ TRIVIÃâO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1404 / actualización Nº 1962. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003377131', phone),
      email       = COALESCE('representforplayers@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1404", "resolucion_actualizacion": "1962", "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "DIANA CAROLINA GONZALEZ TRIVIÃâO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-represent-academy-1404';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3003377131', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO GAJOG  (IDRD-CLUB-club-deportivo-taekwondo-gajog-166.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-gajog-166.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO GAJOG',
      'Presidente: LUISA FERNANDA CARRILLO TINOCO. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 166.0 / actualización Nº N/A. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3123361859',
      'gajogcolombia@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-gajog-166.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-gajog-166.0', v_school_id, '{"resolucion_rd": "166.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-22", "fecha_fin": "2029-02-22", "presidente": "LUISA FERNANDA CARRILLO TINOCO", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUISA FERNANDA CARRILLO TINOCO. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 166.0 / actualización Nº N/A. Vigente hasta 2029-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123361859', phone),
      email       = COALESCE('gajogcolombia@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "166.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-02-22", "fecha_fin": "2029-02-22", "presidente": "LUISA FERNANDA CARRILLO TINOCO", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-gajog-166.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3123361859', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CHALAR F.C  (IDRD-CLUB-club-deportivo-chalar-fc-1400)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-chalar-fc-1400';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CHALAR F.C',
      'Presidente: FREDY ALEXANDER CHALAR BANGUERA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1400. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3203910625',
      'mcortes.navas@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-chalar-fc-1400',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-chalar-fc-1400', v_school_id, '{"resolucion_rd": "1400", "resolucion_actualizacion": null, "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "FREDY ALEXANDER CHALAR BANGUERA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDY ALEXANDER CHALAR BANGUERA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1400. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203910625', phone),
      email       = COALESCE('mcortes.navas@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1400", "resolucion_actualizacion": null, "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "FREDY ALEXANDER CHALAR BANGUERA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-chalar-fc-1400';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3203910625', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DISTRITO PADEL  (IDRD-CLUB-club-deportivo-distrito-padel-039)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-distrito-padel-039';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DISTRITO PADEL',
      'Presidente: MAURICIO BARBOSA CARVAJAL. Deporte(s): Tenis, Padel. Localidad: Suba. Resolución R-D Nº 039 / actualización Nº 1431. Vigente hasta 2029-02-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3165279015',
      'ricardo@tfcopen.co',
      ARRAY['Tenis','Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-distrito-padel-039',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-distrito-padel-039', v_school_id, '{"resolucion_rd": "039", "resolucion_actualizacion": "1431", "fecha_inicio": "02-02-2024", "fecha_fin": "2029-02-01", "presidente": "MAURICIO BARBOSA CARVAJAL", "localidad": "Suba", "sports": ["Tenis", "Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAURICIO BARBOSA CARVAJAL. Deporte(s): Tenis, Padel. Localidad: Suba. Resolución R-D Nº 039 / actualización Nº 1431. Vigente hasta 2029-02-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3165279015', phone),
      email       = COALESCE('ricardo@tfcopen.co', email),
      sports      = ARRAY['Tenis','Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "039", "resolucion_actualizacion": "1431", "fecha_inicio": "02-02-2024", "fecha_fin": "2029-02-01", "presidente": "MAURICIO BARBOSA CARVAJAL", "localidad": "Suba", "sports": ["Tenis", "Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-distrito-padel-039';
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
-- CLUB DEPORTIVO PADEL PLANET CO  (IDRD-CLUB-club-deportivo-padel-planet-co-253)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-padel-planet-co-253';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PADEL PLANET CO',
      'Presidente: MANUEL SALVADOR GONZALEZ OCHOA. Deporte(s): Tenis, Padel. Localidad: Suba. Resolución R-D Nº 253 / actualización Nº 1434. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3028433927',
      'deportivagroupccs@gmail.com',
      ARRAY['Tenis','Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-padel-planet-co-253',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-padel-planet-co-253', v_school_id, '{"resolucion_rd": "253", "resolucion_actualizacion": "1434", "fecha_inicio": "06-03-2024", "fecha_fin": "2029-03-06", "presidente": "MANUEL SALVADOR GONZALEZ OCHOA", "localidad": "Suba", "sports": ["Tenis", "Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL SALVADOR GONZALEZ OCHOA. Deporte(s): Tenis, Padel. Localidad: Suba. Resolución R-D Nº 253 / actualización Nº 1434. Vigente hasta 2029-03-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3028433927', phone),
      email       = COALESCE('deportivagroupccs@gmail.com', email),
      sports      = ARRAY['Tenis','Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "253", "resolucion_actualizacion": "1434", "fecha_inicio": "06-03-2024", "fecha_fin": "2029-03-06", "presidente": "MANUEL SALVADOR GONZALEZ OCHOA", "localidad": "Suba", "sports": ["Tenis", "Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-padel-planet-co-253';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3028433927', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EL JAGUAR  (IDRD-CLUB-club-deportivo-el-jaguar-1405)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-jaguar-1405';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EL JAGUAR',
      'Presidente: DEISY NATALIA MARTINEZ RODRIGUEZ. Deporte(s): Pentatlã³N Moderno. Localidad: Fontibón. Resolución R-D Nº 1405. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3232106486',
      'clubdeportivoeljaguar@gmail.com',
      ARRAY['Pentatlã³N Moderno']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-el-jaguar-1405',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-el-jaguar-1405', v_school_id, '{"resolucion_rd": "1405", "resolucion_actualizacion": null, "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "DEISY NATALIA MARTINEZ RODRIGUEZ", "localidad": "Fontibón", "sports": ["Pentatlã³N Moderno"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DEISY NATALIA MARTINEZ RODRIGUEZ. Deporte(s): Pentatlã³N Moderno. Localidad: Fontibón. Resolución R-D Nº 1405. Vigente hasta 2029-10-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3232106486', phone),
      email       = COALESCE('clubdeportivoeljaguar@gmail.com', email),
      sports      = ARRAY['Pentatlã³N Moderno']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1405", "resolucion_actualizacion": null, "fecha_inicio": "11-10-2024", "fecha_fin": "2029-10-11", "presidente": "DEISY NATALIA MARTINEZ RODRIGUEZ", "localidad": "Fontibón", "sports": ["Pentatlã³N Moderno"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-jaguar-1405';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3232106486', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORT COBOS BOGOTA  (IDRD-CLUB-club-deportivo-sport-cobos-bogota-1456)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-cobos-bogota-1456';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORT COBOS BOGOTA',
      'Presidente: JORGE ALFONSO ORGANISTA ORTIZ. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 1456. Vigente hasta 2029-10-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3043375099',
      'jorgeorganista92@hotmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sport-cobos-bogota-1456',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sport-cobos-bogota-1456', v_school_id, '{"resolucion_rd": "1456", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2024", "fecha_fin": "2029-10-25", "presidente": "JORGE ALFONSO ORGANISTA ORTIZ", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE ALFONSO ORGANISTA ORTIZ. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 1456. Vigente hasta 2029-10-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043375099', phone),
      email       = COALESCE('jorgeorganista92@hotmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1456", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2024", "fecha_fin": "2029-10-25", "presidente": "JORGE ALFONSO ORGANISTA ORTIZ", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sport-cobos-bogota-1456';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3043375099', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DREAMERS FC  (IDRD-CLUB-club-deportivo-dreamers-fc-1458)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dreamers-fc-1458';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DREAMERS FC',
      'Presidente: MATEO NICOLAS BAQUERO SIERRA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1458. Vigente hasta 2029-10-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3187238413',
      'dreamersfc10@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dreamers-fc-1458',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dreamers-fc-1458', v_school_id, '{"resolucion_rd": "1458", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2024", "fecha_fin": "2029-10-25", "presidente": "MATEO NICOLAS BAQUERO SIERRA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MATEO NICOLAS BAQUERO SIERRA. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 1458. Vigente hasta 2029-10-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187238413', phone),
      email       = COALESCE('dreamersfc10@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1458", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2024", "fecha_fin": "2029-10-25", "presidente": "MATEO NICOLAS BAQUERO SIERRA", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dreamers-fc-1458';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3187238413', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CHEER FACTORY COLOMBIA  (IDRD-CLUB-club-deportivo-cheer-factory-colombia-1491)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cheer-factory-colombia-1491';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CHEER FACTORY COLOMBIA',
      'Presidente: EDGAR LEONARDO BRIÃEZ GONZALEZ. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 1491. Vigente hasta 2029-10-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3138427155',
      'cheerfactorycolombia@hotmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cheer-factory-colombia-1491',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cheer-factory-colombia-1491', v_school_id, '{"resolucion_rd": "1491", "resolucion_actualizacion": null, "fecha_inicio": "30-10-2024", "fecha_fin": "2029-10-30", "presidente": "EDGAR LEONARDO BRIÃEZ GONZALEZ", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDGAR LEONARDO BRIÃEZ GONZALEZ. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 1491. Vigente hasta 2029-10-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138427155', phone),
      email       = COALESCE('cheerfactorycolombia@hotmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1491", "resolucion_actualizacion": null, "fecha_inicio": "30-10-2024", "fecha_fin": "2029-10-30", "presidente": "EDGAR LEONARDO BRIÃEZ GONZALEZ", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cheer-factory-colombia-1491';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3138427155', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO POWERLAFTING CLUB  (IDRD-CLUB-club-deportivo-powerlafting-club-1504)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-powerlafting-club-1504';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO POWERLAFTING CLUB',
      'Presidente: ERIKA GIOVANNA VELASQUEZ RAMIREZ. Deporte(s): Powerlifting. Localidad: Engativá. Resolución R-D Nº 1504. Vigente hasta 2029-11-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3144556784',
      'entrena.powerlafting@gmail.com',
      ARRAY['Powerlifting']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-powerlafting-club-1504',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-powerlafting-club-1504', v_school_id, '{"resolucion_rd": "1504", "resolucion_actualizacion": null, "fecha_inicio": "06-11-2024", "fecha_fin": "2029-11-06", "presidente": "ERIKA GIOVANNA VELASQUEZ RAMIREZ", "localidad": "Engativá", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ERIKA GIOVANNA VELASQUEZ RAMIREZ. Deporte(s): Powerlifting. Localidad: Engativá. Resolución R-D Nº 1504. Vigente hasta 2029-11-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144556784', phone),
      email       = COALESCE('entrena.powerlafting@gmail.com', email),
      sports      = ARRAY['Powerlifting']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1504", "resolucion_actualizacion": null, "fecha_inicio": "06-11-2024", "fecha_fin": "2029-11-06", "presidente": "ERIKA GIOVANNA VELASQUEZ RAMIREZ", "localidad": "Engativá", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-powerlafting-club-1504';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3144556784', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EL GLADIADOR  (IDRD-CLUB-club-deportivo-el-gladiador-1505)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-gladiador-1505';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EL GLADIADOR',
      'Presidente: DIANIBE CORTES FORERO. Deporte(s): Pentatlã³N Moderno. Localidad: Engativá. Resolución R-D Nº 1505. Vigente hasta 2029-11-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3213832965',
      'danco346@gmail.com',
      ARRAY['Pentatlã³N Moderno']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-el-gladiador-1505',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-el-gladiador-1505', v_school_id, '{"resolucion_rd": "1505", "resolucion_actualizacion": null, "fecha_inicio": "06-11-2024", "fecha_fin": "2029-11-06", "presidente": "DIANIBE CORTES FORERO", "localidad": "Engativá", "sports": ["Pentatlã³N Moderno"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANIBE CORTES FORERO. Deporte(s): Pentatlã³N Moderno. Localidad: Engativá. Resolución R-D Nº 1505. Vigente hasta 2029-11-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213832965', phone),
      email       = COALESCE('danco346@gmail.com', email),
      sports      = ARRAY['Pentatlã³N Moderno']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1505", "resolucion_actualizacion": null, "fecha_inicio": "06-11-2024", "fecha_fin": "2029-11-06", "presidente": "DIANIBE CORTES FORERO", "localidad": "Engativá", "sports": ["Pentatlã³N Moderno"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-gladiador-1505';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3213832965', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO VIKING WOLF  (IDRD-CLUB-club-deportivo-viking-wolf-1503)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-viking-wolf-1503';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO VIKING WOLF',
      'Presidente: CARLOS ARTURO ARIAS MARTÃNEZ. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1503. Vigente hasta 2029-11-06. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3192082491',
      'vikingwolf42@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-viking-wolf-1503',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-viking-wolf-1503', v_school_id, '{"resolucion_rd": "1503", "resolucion_actualizacion": null, "fecha_inicio": "06-11-2024", "fecha_fin": "2029-11-06", "presidente": "CARLOS ARTURO ARIAS MARTÃNEZ", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO ARIAS MARTÃNEZ. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1503. Vigente hasta 2029-11-06. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3192082491', phone),
      email       = COALESCE('vikingwolf42@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1503", "resolucion_actualizacion": null, "fecha_inicio": "06-11-2024", "fecha_fin": "2029-11-06", "presidente": "CARLOS ARTURO ARIAS MARTÃNEZ", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-viking-wolf-1503';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3192082491', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SALTAMONTES 4X4  (IDRD-CLUB-club-deportivo-saltamontes-4x4-661.0)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-saltamontes-4x4-661.0';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SALTAMONTES 4X4',
      'Presidente: LUIS FERNANDO MEDINA VELANDIA. Deporte(s): Automovilismo. Localidad: Barrios Unidos. Resolución R-D Nº 661.0 / actualización Nº N/A. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      NULL,
      NULL,
      ARRAY['Automovilismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-saltamontes-4x4-661.0',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-saltamontes-4x4-661.0', v_school_id, '{"resolucion_rd": "661.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-06-04", "fecha_fin": "2029-06-04", "presidente": "LUIS FERNANDO MEDINA VELANDIA", "localidad": "Barrios Unidos", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS FERNANDO MEDINA VELANDIA. Deporte(s): Automovilismo. Localidad: Barrios Unidos. Resolución R-D Nº 661.0 / actualización Nº N/A. Vigente hasta 2029-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Automovilismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "661.0", "resolucion_actualizacion": "N/A", "fecha_inicio": "2024-06-04", "fecha_fin": "2029-06-04", "presidente": "LUIS FERNANDO MEDINA VELANDIA", "localidad": "Barrios Unidos", "sports": ["Automovilismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-saltamontes-4x4-661.0';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', NULL, 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO DYNASTY  (IDRD-CLUB-club-deportivo-taekwondo-dynasty-1501)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-dynasty-1501';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO DYNASTY',
      'Presidente: PEDRO ANTONIO VELASQUEZ LEON. Deporte(s): Taekwondo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1501. Vigente hasta 2029-11-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3202541426',
      'taekwondodynasty01@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-dynasty-1501',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-dynasty-1501', v_school_id, '{"resolucion_rd": "1501", "resolucion_actualizacion": null, "fecha_inicio": "12-11-2024", "fecha_fin": "2029-11-12", "presidente": "PEDRO ANTONIO VELASQUEZ LEON", "localidad": "Rafael Uribe Uribe", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO ANTONIO VELASQUEZ LEON. Deporte(s): Taekwondo. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1501. Vigente hasta 2029-11-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202541426', phone),
      email       = COALESCE('taekwondodynasty01@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1501", "resolucion_actualizacion": null, "fecha_inicio": "12-11-2024", "fecha_fin": "2029-11-12", "presidente": "PEDRO ANTONIO VELASQUEZ LEON", "localidad": "Rafael Uribe Uribe", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-dynasty-1501';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3202541426', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO B&O LOS EMBAJADORES FC  (IDRD-CLUB-club-deportivo-bo-los-embajadores-fc-1525)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bo-los-embajadores-fc-1525';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO B&O LOS EMBAJADORES FC',
      'Presidente: BONNER AHMED MOSQUERA RAMÃREZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1525. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3118048742',
      'bonnerm6@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bo-los-embajadores-fc-1525',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bo-los-embajadores-fc-1525', v_school_id, '{"resolucion_rd": "1525", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "BONNER AHMED MOSQUERA RAMÃREZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BONNER AHMED MOSQUERA RAMÃREZ. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1525. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118048742', phone),
      email       = COALESCE('bonnerm6@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1525", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "BONNER AHMED MOSQUERA RAMÃREZ", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bo-los-embajadores-fc-1525';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3118048742', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ZERO LIFTING CLUB  (IDRD-CLUB-club-deportivo-zero-lifting-club-1528)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-zero-lifting-club-1528';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ZERO LIFTING CLUB',
      'Presidente: EMMA BEATRIZ MÃNDEZ MORENO. Deporte(s): Powerlifting. Localidad: Chapinero. Resolución R-D Nº 1528. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3222326700',
      'zero_powerlifting@outlook.com',
      ARRAY['Powerlifting']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-zero-lifting-club-1528',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-zero-lifting-club-1528', v_school_id, '{"resolucion_rd": "1528", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "EMMA BEATRIZ MÃNDEZ MORENO", "localidad": "Chapinero", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EMMA BEATRIZ MÃNDEZ MORENO. Deporte(s): Powerlifting. Localidad: Chapinero. Resolución R-D Nº 1528. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222326700', phone),
      email       = COALESCE('zero_powerlifting@outlook.com', email),
      sports      = ARRAY['Powerlifting']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1528", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "EMMA BEATRIZ MÃNDEZ MORENO", "localidad": "Chapinero", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-zero-lifting-club-1528';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3222326700', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AMIGOS ANAROD F.C.  (IDRD-CLUB-club-deportivo-amigos-anarod-fc-1534)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-amigos-anarod-fc-1534';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AMIGOS ANAROD F.C.',
      'Presidente: JESSICA PATRICIA RODRIGUEZ PERTUZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1534. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3162716722',
      'clubdeportivo10losamigosfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-amigos-anarod-fc-1534',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-amigos-anarod-fc-1534', v_school_id, '{"resolucion_rd": "1534", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "JESSICA PATRICIA RODRIGUEZ PERTUZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JESSICA PATRICIA RODRIGUEZ PERTUZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1534. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3162716722', phone),
      email       = COALESCE('clubdeportivo10losamigosfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1534", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "JESSICA PATRICIA RODRIGUEZ PERTUZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-amigos-anarod-fc-1534';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3162716722', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JAGUARS BASKETBALL CLUB  (IDRD-CLUB-club-deportivo-jaguars-basketball-club-1488)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jaguars-basketball-club-1488';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JAGUARS BASKETBALL CLUB',
      'Presidente: CRISTIAN DAVID TORRES GONZALEZ. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1488. Vigente hasta 2029-11-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3144281776',
      'jaguarsbasketballclubcol@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jaguars-basketball-club-1488',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jaguars-basketball-club-1488', v_school_id, '{"resolucion_rd": "1488", "resolucion_actualizacion": null, "fecha_inicio": "14-11-2024", "fecha_fin": "2029-11-14", "presidente": "CRISTIAN DAVID TORRES GONZALEZ", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN DAVID TORRES GONZALEZ. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1488. Vigente hasta 2029-11-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144281776', phone),
      email       = COALESCE('jaguarsbasketballclubcol@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1488", "resolucion_actualizacion": null, "fecha_inicio": "14-11-2024", "fecha_fin": "2029-11-14", "presidente": "CRISTIAN DAVID TORRES GONZALEZ", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jaguars-basketball-club-1488';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3144281776', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BADMINTON 316  (IDRD-CLUB-club-deportivo-badminton-316-1529)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-badminton-316-1529';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BADMINTON 316',
      'Presidente: EDUARD RAUL ACOSTA RIAÃO. Deporte(s): Badminton. Localidad: Ciudad Bolívar. Resolución R-D Nº 1529. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3138325134',
      'clubbad316@gmail.com',
      ARRAY['Badminton']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-badminton-316-1529',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-badminton-316-1529', v_school_id, '{"resolucion_rd": "1529", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "EDUARD RAUL ACOSTA RIAÃO", "localidad": "Ciudad Bolívar", "sports": ["Badminton"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDUARD RAUL ACOSTA RIAÃO. Deporte(s): Badminton. Localidad: Ciudad Bolívar. Resolución R-D Nº 1529. Vigente hasta 2029-11-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138325134', phone),
      email       = COALESCE('clubbad316@gmail.com', email),
      sports      = ARRAY['Badminton']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1529", "resolucion_actualizacion": null, "fecha_inicio": "13-11-2024", "fecha_fin": "2029-11-13", "presidente": "EDUARD RAUL ACOSTA RIAÃO", "localidad": "Ciudad Bolívar", "sports": ["Badminton"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-badminton-316-1529';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3138325134', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE LUCHA OLIMPICA KIMBOÂ´S WRESTLING CLUB  (IDRD-CLUB-club-deportivo-de-lucha-olimpica-kimboa--355)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-lucha-olimpica-kimboa--355';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE LUCHA OLIMPICA KIMBOÂ´S WRESTLING CLUB',
      'Presidente: CAMILO EDUARDO PRIETO RODRIGUEZ. Deporte(s): Lucha. Localidad: San Cristóbal. Resolución R-D Nº 355. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3044094995',
      'kimbosclub@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-lucha-olimpica-kimboa--355',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-lucha-olimpica-kimboa--355', v_school_id, '{"resolucion_rd": "355", "resolucion_actualizacion": null, "fecha_inicio": "22-03-2024", "fecha_fin": "2029-03-22", "presidente": "CAMILO EDUARDO PRIETO RODRIGUEZ", "localidad": "San Cristóbal", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO EDUARDO PRIETO RODRIGUEZ. Deporte(s): Lucha. Localidad: San Cristóbal. Resolución R-D Nº 355. Vigente hasta 2029-03-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3044094995', phone),
      email       = COALESCE('kimbosclub@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "355", "resolucion_actualizacion": null, "fecha_inicio": "22-03-2024", "fecha_fin": "2029-03-22", "presidente": "CAMILO EDUARDO PRIETO RODRIGUEZ", "localidad": "San Cristóbal", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-lucha-olimpica-kimboa--355';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3044094995', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RYUJIN COLOMBIA  (IDRD-CLUB-club-deportivo-ryujin-colombia-1339)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ryujin-colombia-1339';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RYUJIN COLOMBIA',
      'Presidente: RICHARD EDUARDO NAVARRO RECALDE. Deporte(s): Kick Boxing. Localidad: Puente Aranda. Resolución R-D Nº 1339. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3133698052',
      'ryujincolombia@gmail.com',
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ryujin-colombia-1339',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ryujin-colombia-1339', v_school_id, '{"resolucion_rd": "1339", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "RICHARD EDUARDO NAVARRO RECALDE", "localidad": "Puente Aranda", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICHARD EDUARDO NAVARRO RECALDE. Deporte(s): Kick Boxing. Localidad: Puente Aranda. Resolución R-D Nº 1339. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133698052', phone),
      email       = COALESCE('ryujincolombia@gmail.com', email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1339", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "RICHARD EDUARDO NAVARRO RECALDE", "localidad": "Puente Aranda", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ryujin-colombia-1339';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3133698052', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DREAM TEAM  (IDRD-CLUB-club-deportivo-dream-team-1574)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dream-team-1574';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DREAM TEAM',
      'Presidente: JORDY FREYCER MOSQUERA VALENCIA. Deporte(s): Fútbol. Localidad: Santa Fe. Resolución R-D Nº 1574. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Santa Fe',
      '3147196967',
      'clubdeportivodreamteam@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dream-team-1574',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dream-team-1574', v_school_id, '{"resolucion_rd": "1574", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "JORDY FREYCER MOSQUERA VALENCIA", "localidad": "Santa Fe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORDY FREYCER MOSQUERA VALENCIA. Deporte(s): Fútbol. Localidad: Santa Fe. Resolución R-D Nº 1574. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3147196967', phone),
      email       = COALESCE('clubdeportivodreamteam@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1574", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "JORDY FREYCER MOSQUERA VALENCIA", "localidad": "Santa Fe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dream-team-1574';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Santa Fe', 'Bogotá', '3147196967', 4.6017892, -74.0791799, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPARTANS BASKETBALL  (IDRD-CLUB-club-deportivo-spartans-basketball-1576)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-spartans-basketball-1576';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPARTANS BASKETBALL',
      'Presidente: OSCAR ANDRÃS VINASCO BERNAL. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 1576. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '316404044',
      'vinascoscar@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-spartans-basketball-1576',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-spartans-basketball-1576', v_school_id, '{"resolucion_rd": "1576", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "OSCAR ANDRÃS VINASCO BERNAL", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR ANDRÃS VINASCO BERNAL. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 1576. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('316404044', phone),
      email       = COALESCE('vinascoscar@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1576", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "OSCAR ANDRÃS VINASCO BERNAL", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-spartans-basketball-1576';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '316404044', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TOTTENHAM BOGOTÃ D.C.  (IDRD-CLUB-club-deportivo-tottenham-bogota-dc-1577)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-tottenham-bogota-dc-1577';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TOTTENHAM BOGOTÃ D.C.',
      'Presidente: IVAN DARIO MOYA LÃPEZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1577. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3208584837',
      'tottenhambogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-tottenham-bogota-dc-1577',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-tottenham-bogota-dc-1577', v_school_id, '{"resolucion_rd": "1577", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "IVAN DARIO MOYA LÃPEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVAN DARIO MOYA LÃPEZ. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1577. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208584837', phone),
      email       = COALESCE('tottenhambogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1577", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "IVAN DARIO MOYA LÃPEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-tottenham-bogota-dc-1577';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3208584837', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LION ÌS CLAWS  (IDRD-CLUB-club-deportivo-lion-is-claws-1578)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lion-is-claws-1578';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LION ÌS CLAWS',
      'Presidente: JOHN FREDY MEDINA JIMENEZ. Deporte(s): Fútbol de salón. Localidad: Puente Aranda. Resolución R-D Nº 1578. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3022106474',
      'lionsclawsfc@outlook.es',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lion-is-claws-1578',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lion-is-claws-1578', v_school_id, '{"resolucion_rd": "1578", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "JOHN FREDY MEDINA JIMENEZ", "localidad": "Puente Aranda", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN FREDY MEDINA JIMENEZ. Deporte(s): Fútbol de salón. Localidad: Puente Aranda. Resolución R-D Nº 1578. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3022106474', phone),
      email       = COALESCE('lionsclawsfc@outlook.es', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1578", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "JOHN FREDY MEDINA JIMENEZ", "localidad": "Puente Aranda", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lion-is-claws-1578';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3022106474', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SOUTH AMERICAN POWERS  (IDRD-CLUB-club-deportivo-south-american-powers-1579)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-south-american-powers-1579';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SOUTH AMERICAN POWERS',
      'Presidente: GRACE ALEJANDRA LOPEZ TORRES. Deporte(s): Powerlifting. Localidad: Barrios Unidos. Resolución R-D Nº 1579. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3112288094',
      'equipomayorbogota@gmail.com',
      ARRAY['Powerlifting']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-south-american-powers-1579',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-south-american-powers-1579', v_school_id, '{"resolucion_rd": "1579", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "GRACE ALEJANDRA LOPEZ TORRES", "localidad": "Barrios Unidos", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GRACE ALEJANDRA LOPEZ TORRES. Deporte(s): Powerlifting. Localidad: Barrios Unidos. Resolución R-D Nº 1579. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112288094', phone),
      email       = COALESCE('equipomayorbogota@gmail.com', email),
      sports      = ARRAY['Powerlifting']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1579", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "GRACE ALEJANDRA LOPEZ TORRES", "localidad": "Barrios Unidos", "sports": ["Powerlifting"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-south-american-powers-1579';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3112288094', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SOCCER ELITE  (IDRD-CLUB-club-deportivo-soccer-elite-1580)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-soccer-elite-1580';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SOCCER ELITE',
      'Presidente: JONATHAN ALEXANDER GONZÃLEZ ROBAYO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1580. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3208979550',
      'clubdeportivosoccerelitecdse@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-soccer-elite-1580',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-soccer-elite-1580', v_school_id, '{"resolucion_rd": "1580", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "JONATHAN ALEXANDER GONZÃLEZ ROBAYO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JONATHAN ALEXANDER GONZÃLEZ ROBAYO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1580. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208979550', phone),
      email       = COALESCE('clubdeportivosoccerelitecdse@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1580", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "JONATHAN ALEXANDER GONZÃLEZ ROBAYO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-soccer-elite-1580';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3208979550', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE FÃTBOL Y AMIGOS  (IDRD-CLUB-club-deportivo-de-fatbol-y-amigos-1645)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-fatbol-y-amigos-1645';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE FÃTBOL Y AMIGOS',
      'Presidente: EDWIN GIOVANY AMAYA GUTIERREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1645. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3115014295',
      'egamaya@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-fatbol-y-amigos-1645',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-fatbol-y-amigos-1645', v_school_id, '{"resolucion_rd": "1645", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "EDWIN GIOVANY AMAYA GUTIERREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDWIN GIOVANY AMAYA GUTIERREZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1645. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115014295', phone),
      email       = COALESCE('egamaya@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1645", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "EDWIN GIOVANY AMAYA GUTIERREZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-fatbol-y-amigos-1645';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3115014295', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CRACKS NEW VISION  (IDRD-CLUB-club-deportivo-cracks-new-vision-1582)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cracks-new-vision-1582';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CRACKS NEW VISION',
      'Presidente: MARIA DEL PILAR GONZALEZ ROBAYO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1582. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3115492414',
      'club.cracks.new.vision@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cracks-new-vision-1582',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cracks-new-vision-1582', v_school_id, '{"resolucion_rd": "1582", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "MARIA DEL PILAR GONZALEZ ROBAYO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA DEL PILAR GONZALEZ ROBAYO. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1582. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115492414', phone),
      email       = COALESCE('club.cracks.new.vision@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1582", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "MARIA DEL PILAR GONZALEZ ROBAYO", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cracks-new-vision-1582';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3115492414', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MAORIES VOLEY CLUB  (IDRD-CLUB-club-deportivo-maories-voley-club-1581)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-maories-voley-club-1581';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MAORIES VOLEY CLUB',
      'Presidente: ASHLY YOHARA BECERRA SALVADOR. Deporte(s): Voleibol. Localidad: San Cristóbal. Resolución R-D Nº 1581. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3002823519',
      'maoriesvoleyclub@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-maories-voley-club-1581',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-maories-voley-club-1581', v_school_id, '{"resolucion_rd": "1581", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "ASHLY YOHARA BECERRA SALVADOR", "localidad": "San Cristóbal", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ASHLY YOHARA BECERRA SALVADOR. Deporte(s): Voleibol. Localidad: San Cristóbal. Resolución R-D Nº 1581. Vigente hasta 2029-11-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002823519', phone),
      email       = COALESCE('maoriesvoleyclub@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1581", "resolucion_actualizacion": null, "fecha_inicio": "25-11-2024", "fecha_fin": "2029-11-25", "presidente": "ASHLY YOHARA BECERRA SALVADOR", "localidad": "San Cristóbal", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-maories-voley-club-1581';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3002823519', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SMC SPORTS ACADEMY  (IDRD-CLUB-club-deportivo-smc-sports-academy-1616)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-smc-sports-academy-1616';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SMC SPORTS ACADEMY',
      'Presidente: DIEGO MAURICIO URQUIJO MARTINEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1616. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3138851687',
      'johnfve@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-smc-sports-academy-1616',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-smc-sports-academy-1616', v_school_id, '{"resolucion_rd": "1616", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "DIEGO MAURICIO URQUIJO MARTINEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO MAURICIO URQUIJO MARTINEZ. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1616. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138851687', phone),
      email       = COALESCE('johnfve@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1616", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "DIEGO MAURICIO URQUIJO MARTINEZ", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-smc-sports-academy-1616';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3138851687', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PASIÃN SIN LIMITES  (IDRD-CLUB-club-deportivo-pasian-sin-limites-1643)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-pasian-sin-limites-1643';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PASIÃN SIN LIMITES',
      'Presidente: JHON FREDY OLAYA ESPINOSA. Deporte(s): Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 1643. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3229290025',
      'clubdeportivopasionsinlimites@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-pasian-sin-limites-1643',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-pasian-sin-limites-1643', v_school_id, '{"resolucion_rd": "1643", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "JHON FREDY OLAYA ESPINOSA", "localidad": "San Cristóbal", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHON FREDY OLAYA ESPINOSA. Deporte(s): Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 1643. Vigente hasta 2029-11-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3229290025', phone),
      email       = COALESCE('clubdeportivopasionsinlimites@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1643", "resolucion_actualizacion": null, "fecha_inicio": "26-11-2024", "fecha_fin": "2029-11-26", "presidente": "JHON FREDY OLAYA ESPINOSA", "localidad": "San Cristóbal", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-pasian-sin-limites-1643';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3229290025', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESL COBRAS  (IDRD-CLUB-club-deportivo-esl-cobras-1664)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-esl-cobras-1664';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESL COBRAS',
      'Presidente: VICTOR ALFONSO DÃAZ VARGAS. Deporte(s): Porrismo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1664. Vigente hasta 2029-11-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3008487753',
      'extremesportsleague@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-esl-cobras-1664',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-esl-cobras-1664', v_school_id, '{"resolucion_rd": "1664", "resolucion_actualizacion": null, "fecha_inicio": "28-11-2024", "fecha_fin": "2029-11-28", "presidente": "VICTOR ALFONSO DÃAZ VARGAS", "localidad": "Ciudad Bolívar", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR ALFONSO DÃAZ VARGAS. Deporte(s): Porrismo. Localidad: Ciudad Bolívar. Resolución R-D Nº 1664. Vigente hasta 2029-11-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008487753', phone),
      email       = COALESCE('extremesportsleague@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1664", "resolucion_actualizacion": null, "fecha_inicio": "28-11-2024", "fecha_fin": "2029-11-28", "presidente": "VICTOR ALFONSO DÃAZ VARGAS", "localidad": "Ciudad Bolívar", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-esl-cobras-1664';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3008487753', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NEIKING BOGOTA  (IDRD-CLUB-club-deportivo-neiking-bogota-087)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-neiking-bogota-087';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NEIKING BOGOTA',
      'Presidente: ALEXANDER MUÃOZ CICUA. Deporte(s): Kick Boxing. Localidad: Bosa. Resolución R-D Nº 087. Vigente hasta 2029-02-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3125862309',
      'neikingcenter@gmail.com',
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-neiking-bogota-087',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-neiking-bogota-087', v_school_id, '{"resolucion_rd": "087", "resolucion_actualizacion": null, "fecha_inicio": "12-02-2024", "fecha_fin": "2029-02-11", "presidente": "ALEXANDER MUÃOZ CICUA", "localidad": "Bosa", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEXANDER MUÃOZ CICUA. Deporte(s): Kick Boxing. Localidad: Bosa. Resolución R-D Nº 087. Vigente hasta 2029-02-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125862309', phone),
      email       = COALESCE('neikingcenter@gmail.com', email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "087", "resolucion_actualizacion": null, "fecha_inicio": "12-02-2024", "fecha_fin": "2029-02-11", "presidente": "ALEXANDER MUÃOZ CICUA", "localidad": "Bosa", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-neiking-bogota-087';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3125862309', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO POWER BASKETBALL  (IDRD-CLUB-club-deportivo-power-basketball-1685)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-power-basketball-1685';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO POWER BASKETBALL',
      'Presidente: SILVIA LORENA BEDOYA RAMIREZ. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1685. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3136273694',
      'powerbasketclub@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-power-basketball-1685',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-power-basketball-1685', v_school_id, '{"resolucion_rd": "1685", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "SILVIA LORENA BEDOYA RAMIREZ", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SILVIA LORENA BEDOYA RAMIREZ. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 1685. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3136273694', phone),
      email       = COALESCE('powerbasketclub@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1685", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "SILVIA LORENA BEDOYA RAMIREZ", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-power-basketball-1685';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3136273694', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE ATLETISMO TEAM IGLANDINI  (IDRD-CLUB-club-deportivo-de-atletismo-team-iglandi-1687)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-atletismo-team-iglandi-1687';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE ATLETISMO TEAM IGLANDINI',
      'Presidente: JOLIE DEL ROSARIO HERNÃNDEZ GONZÃLEZ. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1687. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3004142753',
      'clubdeportivoteamiglandini@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-atletismo-team-iglandi-1687',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-atletismo-team-iglandi-1687', v_school_id, '{"resolucion_rd": "1687", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "JOLIE DEL ROSARIO HERNÃNDEZ GONZÃLEZ", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOLIE DEL ROSARIO HERNÃNDEZ GONZÃLEZ. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1687. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3004142753', phone),
      email       = COALESCE('clubdeportivoteamiglandini@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1687", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "JOLIE DEL ROSARIO HERNÃNDEZ GONZÃLEZ", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-atletismo-team-iglandi-1687';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3004142753', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TITAN X  (IDRD-CLUB-club-deportivo-titan-x-1688)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-titan-x-1688';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TITAN X',
      'Presidente: CARLOS ALBERTO RAMOS ORTIZ. Deporte(s): Pentatlã³N Moderno. Localidad: Santa Fe. Resolución R-D Nº 1688. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Santa Fe',
      '3227933133',
      'clubdeportivotitank@gmail.com',
      ARRAY['Pentatlã³N Moderno']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-titan-x-1688',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-titan-x-1688', v_school_id, '{"resolucion_rd": "1688", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "CARLOS ALBERTO RAMOS ORTIZ", "localidad": "Santa Fe", "sports": ["Pentatlã³N Moderno"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALBERTO RAMOS ORTIZ. Deporte(s): Pentatlã³N Moderno. Localidad: Santa Fe. Resolución R-D Nº 1688. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3227933133', phone),
      email       = COALESCE('clubdeportivotitank@gmail.com', email),
      sports      = ARRAY['Pentatlã³N Moderno']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1688", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "CARLOS ALBERTO RAMOS ORTIZ", "localidad": "Santa Fe", "sports": ["Pentatlã³N Moderno"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-titan-x-1688';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Santa Fe', 'Bogotá', '3227933133', 4.6017892, -74.0791799, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TEAM BACATA SPORT  (IDRD-CLUB-club-deportivo-team-bacata-sport-1694)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-team-bacata-sport-1694';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TEAM BACATA SPORT',
      'Presidente: SANDRA MILENA CALDERON BAYONA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1694. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3158979933',
      'patriotasportbacata@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-team-bacata-sport-1694',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-team-bacata-sport-1694', v_school_id, '{"resolucion_rd": "1694", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "SANDRA MILENA CALDERON BAYONA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA MILENA CALDERON BAYONA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1694. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3158979933', phone),
      email       = COALESCE('patriotasportbacata@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1694", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "SANDRA MILENA CALDERON BAYONA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-team-bacata-sport-1694';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3158979933', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO NUEVOS TALENTOS  (IDRD-CLUB-club-deportivo-nuevos-talentos-1705)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-nuevos-talentos-1705';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO NUEVOS TALENTOS',
      'Presidente: HERNAN FELIPE BUSTOS VARGAS. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1705. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3197480375',
      'escueladeportivanuevostalentos@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-nuevos-talentos-1705',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-nuevos-talentos-1705', v_school_id, '{"resolucion_rd": "1705", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "HERNAN FELIPE BUSTOS VARGAS", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HERNAN FELIPE BUSTOS VARGAS. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1705. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3197480375', phone),
      email       = COALESCE('escueladeportivanuevostalentos@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1705", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "HERNAN FELIPE BUSTOS VARGAS", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-nuevos-talentos-1705';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3197480375', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WHITE OWLS Ì BASKETBALL  (IDRD-CLUB-club-deportivo-white-owls-i-basketball-1706)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-white-owls-i-basketball-1706';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WHITE OWLS Ì BASKETBALL',
      'Presidente: ANDRES FELIPE NIETO GAITAN. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 1706. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3208827415',
      'whiteowlsbasket@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-white-owls-i-basketball-1706',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-white-owls-i-basketball-1706', v_school_id, '{"resolucion_rd": "1706", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "ANDRES FELIPE NIETO GAITAN", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES FELIPE NIETO GAITAN. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 1706. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208827415', phone),
      email       = COALESCE('whiteowlsbasket@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1706", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "ANDRES FELIPE NIETO GAITAN", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-white-owls-i-basketball-1706';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3208827415', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SKATING G.D  (IDRD-CLUB-club-deportivo-skating-gd-1707)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-skating-gd-1707';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SKATING G.D',
      'Presidente: ANYI TATIANA LINARES SOLER. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 1707. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3508630432',
      'gabita.daza161@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-skating-gd-1707',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-skating-gd-1707', v_school_id, '{"resolucion_rd": "1707", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "ANYI TATIANA LINARES SOLER", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANYI TATIANA LINARES SOLER. Deporte(s): Patinaje. Localidad: Fontibón. Resolución R-D Nº 1707. Vigente hasta 2029-12-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3508630432', phone),
      email       = COALESCE('gabita.daza161@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1707", "resolucion_actualizacion": null, "fecha_inicio": "10-12-2024", "fecha_fin": "2029-12-10", "presidente": "ANYI TATIANA LINARES SOLER", "localidad": "Fontibón", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-skating-gd-1707';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3508630432', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO YUGEN CLUB VOLEY  (IDRD-CLUB-club-deportivo-yugen-club-voley-1736)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-yugen-club-voley-1736';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO YUGEN CLUB VOLEY',
      'Presidente: JEISSON SEBASTIAN CASALLAS BERNAL. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 1736. Vigente hasta 2029-12-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3002369564',
      'sebas321bernal@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-yugen-club-voley-1736',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-yugen-club-voley-1736', v_school_id, '{"resolucion_rd": "1736", "resolucion_actualizacion": null, "fecha_inicio": "11-12-2024", "fecha_fin": "2029-12-11", "presidente": "JEISSON SEBASTIAN CASALLAS BERNAL", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISSON SEBASTIAN CASALLAS BERNAL. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 1736. Vigente hasta 2029-12-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002369564', phone),
      email       = COALESCE('sebas321bernal@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1736", "resolucion_actualizacion": null, "fecha_inicio": "11-12-2024", "fecha_fin": "2029-12-11", "presidente": "JEISSON SEBASTIAN CASALLAS BERNAL", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-yugen-club-voley-1736';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3002369564', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PENTATLÃN MODERNO KAIZEN OCR  (IDRD-CLUB-club-deportivo-de-pentatlan-moderno-kaiz-1738)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-pentatlan-moderno-kaiz-1738';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PENTATLÃN MODERNO KAIZEN OCR',
      'Presidente: JEISSON JULIÃN CASTAÃEDA FAJARDO. Deporte(s): Pentatlã³N Moderno. Localidad: Engativá. Resolución R-D Nº 1738 / actualización Nº 027. Vigente hasta 2029-12-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3178575467',
      'clubdeportivokaizenocr@gmail.com',
      ARRAY['Pentatlã³N Moderno']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-pentatlan-moderno-kaiz-1738',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-pentatlan-moderno-kaiz-1738', v_school_id, '{"resolucion_rd": "1738", "resolucion_actualizacion": "027", "fecha_inicio": "11-12-2024", "fecha_fin": "2029-12-11", "presidente": "JEISSON JULIÃN CASTAÃEDA FAJARDO", "localidad": "Engativá", "sports": ["Pentatlã³N Moderno"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISSON JULIÃN CASTAÃEDA FAJARDO. Deporte(s): Pentatlã³N Moderno. Localidad: Engativá. Resolución R-D Nº 1738 / actualización Nº 027. Vigente hasta 2029-12-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3178575467', phone),
      email       = COALESCE('clubdeportivokaizenocr@gmail.com', email),
      sports      = ARRAY['Pentatlã³N Moderno']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1738", "resolucion_actualizacion": "027", "fecha_inicio": "11-12-2024", "fecha_fin": "2029-12-11", "presidente": "JEISSON JULIÃN CASTAÃEDA FAJARDO", "localidad": "Engativá", "sports": ["Pentatlã³N Moderno"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-pentatlan-moderno-kaiz-1738';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3178575467', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HORUS D.C,  (IDRD-CLUB-club-deportivo-horus-dc-1734)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-horus-dc-1734';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HORUS D.C,',
      'Presidente: LINA MARITZA GOMEZ SANDOVAL. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1734. Vigente hasta 2029-12-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3243873713',
      'clubdeportivohorus@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-horus-dc-1734',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-horus-dc-1734', v_school_id, '{"resolucion_rd": "1734", "resolucion_actualizacion": null, "fecha_inicio": "11-12-2024", "fecha_fin": "2029-12-11", "presidente": "LINA MARITZA GOMEZ SANDOVAL", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LINA MARITZA GOMEZ SANDOVAL. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1734. Vigente hasta 2029-12-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3243873713', phone),
      email       = COALESCE('clubdeportivohorus@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1734", "resolucion_actualizacion": null, "fecha_inicio": "11-12-2024", "fecha_fin": "2029-12-11", "presidente": "LINA MARITZA GOMEZ SANDOVAL", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-horus-dc-1734';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3243873713', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO MINOTAUROS  (IDRD-CLUB-club-deportivo-minotauros-1222)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-minotauros-1222';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO MINOTAUROS',
      'Presidente: YEISON ALEXANDER AVILA ESPAÃOL. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1222 / actualización Nº 134. Vigente hasta 2027-10-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3159287666',
      'minotauroscluboficial@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-minotauros-1222',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-minotauros-1222', v_school_id, '{"resolucion_rd": "1222", "resolucion_actualizacion": "134", "fecha_inicio": "10-10-2022", "fecha_fin": "2027-10-10", "presidente": "YEISON ALEXANDER AVILA ESPAÃOL", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YEISON ALEXANDER AVILA ESPAÃOL. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1222 / actualización Nº 134. Vigente hasta 2027-10-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3159287666', phone),
      email       = COALESCE('minotauroscluboficial@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1222", "resolucion_actualizacion": "134", "fecha_inicio": "10-10-2022", "fecha_fin": "2027-10-10", "presidente": "YEISON ALEXANDER AVILA ESPAÃOL", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-minotauros-1222';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3159287666', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TAEKWONDO KIHARTAU  (IDRD-CLUB-club-deportivo-taekwondo-kihartau-1758)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-kihartau-1758';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TAEKWONDO KIHARTAU',
      'Presidente: RICARDO CARRILLO CALDERON. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1758. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3202723423',
      'templokihartau@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-taekwondo-kihartau-1758',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-taekwondo-kihartau-1758', v_school_id, '{"resolucion_rd": "1758", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "RICARDO CARRILLO CALDERON", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICARDO CARRILLO CALDERON. Deporte(s): Taekwondo. Localidad: Kennedy. Resolución R-D Nº 1758. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202723423', phone),
      email       = COALESCE('templokihartau@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1758", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "RICARDO CARRILLO CALDERON", "localidad": "Kennedy", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-taekwondo-kihartau-1758';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3202723423', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WOLVES VOLLEY CLUB  (IDRD-CLUB-club-deportivo-wolves-volley-club-1759)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-wolves-volley-club-1759';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WOLVES VOLLEY CLUB',
      'Presidente: KAREN STEFANI CARRILLO TRIANA. Deporte(s): Voleibol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1759. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3223699977',
      'wolvesvolleyclub.bogota@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-wolves-volley-club-1759',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-wolves-volley-club-1759', v_school_id, '{"resolucion_rd": "1759", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "KAREN STEFANI CARRILLO TRIANA", "localidad": "Rafael Uribe Uribe", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KAREN STEFANI CARRILLO TRIANA. Deporte(s): Voleibol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1759. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3223699977', phone),
      email       = COALESCE('wolvesvolleyclub.bogota@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1759", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "KAREN STEFANI CARRILLO TRIANA", "localidad": "Rafael Uribe Uribe", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-wolves-volley-club-1759';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3223699977', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RB TALENTOS DE BOGOTA  (IDRD-CLUB-club-deportivo-rb-talentos-de-bogota-1763)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-rb-talentos-de-bogota-1763';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RB TALENTOS DE BOGOTA',
      'Presidente: JUAN ANDRÃS HERRERA CASTRO. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1763. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3006221035',
      'clubrbtalentos@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-rb-talentos-de-bogota-1763',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-rb-talentos-de-bogota-1763', v_school_id, '{"resolucion_rd": "1763", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "JUAN ANDRÃS HERRERA CASTRO", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN ANDRÃS HERRERA CASTRO. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1763. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006221035', phone),
      email       = COALESCE('clubrbtalentos@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1763", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "JUAN ANDRÃS HERRERA CASTRO", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-rb-talentos-de-bogota-1763';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3006221035', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO UNIÃN DORADA F.C.  (IDRD-CLUB-club-deportivo-unian-dorada-fc-1781)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-unian-dorada-fc-1781';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO UNIÃN DORADA F.C.',
      'Presidente: LEYDER BLANDON ARROYO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1781. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3123224737',
      'uniondorada2@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-unian-dorada-fc-1781',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-unian-dorada-fc-1781', v_school_id, '{"resolucion_rd": "1781", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "LEYDER BLANDON ARROYO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEYDER BLANDON ARROYO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1781. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123224737', phone),
      email       = COALESCE('uniondorada2@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1781", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "LEYDER BLANDON ARROYO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-unian-dorada-fc-1781';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3123224737', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ANFIELD FÃTBOL CLUB  (IDRD-CLUB-club-deportivo-anfield-fatbol-club-1761)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-anfield-fatbol-club-1761';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ANFIELD FÃTBOL CLUB',
      'Presidente: KELLY MELISSA RAMIREZ CAMACHO. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1761. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3102343103',
      'anfieldfutbolclub10@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-anfield-fatbol-club-1761',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-anfield-fatbol-club-1761', v_school_id, '{"resolucion_rd": "1761", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "KELLY MELISSA RAMIREZ CAMACHO", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: KELLY MELISSA RAMIREZ CAMACHO. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1761. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102343103', phone),
      email       = COALESCE('anfieldfutbolclub10@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1761", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "KELLY MELISSA RAMIREZ CAMACHO", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-anfield-fatbol-club-1761';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3102343103', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KRAKEN CLUB BMX  (IDRD-CLUB-club-deportivo-kraken-club-bmx-1778)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kraken-club-bmx-1778';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KRAKEN CLUB BMX',
      'Presidente: GABRIELA DUARTE IBAÃEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1778. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3214567769',
      'krakenbmxclub@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kraken-club-bmx-1778',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kraken-club-bmx-1778', v_school_id, '{"resolucion_rd": "1778", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "GABRIELA DUARTE IBAÃEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GABRIELA DUARTE IBAÃEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 1778. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214567769', phone),
      email       = COALESCE('krakenbmxclub@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1778", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "GABRIELA DUARTE IBAÃEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kraken-club-bmx-1778';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3214567769', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ELEMENTS  (IDRD-CLUB-club-deportivo-elements-1762)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-elements-1762';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ELEMENTS',
      'Presidente: JESSICA PAOLA MALDONADO CALDERÃN. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 1762. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3229033586',
      'clubdeportivoelements@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-elements-1762',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-elements-1762', v_school_id, '{"resolucion_rd": "1762", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "JESSICA PAOLA MALDONADO CALDERÃN", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JESSICA PAOLA MALDONADO CALDERÃN. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 1762. Vigente hasta 2029-12-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3229033586', phone),
      email       = COALESCE('clubdeportivoelements@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1762", "resolucion_actualizacion": null, "fecha_inicio": "19-12-2024", "fecha_fin": "2029-12-19", "presidente": "JESSICA PAOLA MALDONADO CALDERÃN", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-elements-1762';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3229033586', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPARTAN  (IDRD-CLUB-club-deportivo-spartan-1777)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-spartan-1777';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPARTAN',
      'Presidente: JORGE EDUARDO RAMIREZ MUÃOZ. Deporte(s): Levantamiento De Pesas. Localidad: Engativá. Resolución R-D Nº 1777. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3125309752',
      'clubdeportivospartan24@gmail.com',
      ARRAY['Levantamiento De Pesas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-spartan-1777',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-spartan-1777', v_school_id, '{"resolucion_rd": "1777", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "JORGE EDUARDO RAMIREZ MUÃOZ", "localidad": "Engativá", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE EDUARDO RAMIREZ MUÃOZ. Deporte(s): Levantamiento De Pesas. Localidad: Engativá. Resolución R-D Nº 1777. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3125309752', phone),
      email       = COALESCE('clubdeportivospartan24@gmail.com', email),
      sports      = ARRAY['Levantamiento De Pesas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1777", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "JORGE EDUARDO RAMIREZ MUÃOZ", "localidad": "Engativá", "sports": ["Levantamiento De Pesas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-spartan-1777';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3125309752', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FR KIDS  (IDRD-CLUB-club-deportivo-fr-kids-1776)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fr-kids-1776';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FR KIDS',
      'Presidente: WENDY JOHANNA MONCADA MARTINEZ. Deporte(s): Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 1776. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3118338643',
      'frkidsbogota@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fr-kids-1776',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fr-kids-1776', v_school_id, '{"resolucion_rd": "1776", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "WENDY JOHANNA MONCADA MARTINEZ", "localidad": "San Cristóbal", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WENDY JOHANNA MONCADA MARTINEZ. Deporte(s): Patinaje. Localidad: San Cristóbal. Resolución R-D Nº 1776. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118338643', phone),
      email       = COALESCE('frkidsbogota@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1776", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "WENDY JOHANNA MONCADA MARTINEZ", "localidad": "San Cristóbal", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fr-kids-1776';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3118338643', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JUVENTUD BOGOTÃ  (IDRD-CLUB-club-deportivo-juventud-bogota-1779)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-juventud-bogota-1779';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JUVENTUD BOGOTÃ',
      'Presidente: DIEGO ARMANDO VILLAMARIN SANCHEZ. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1779. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3156671138',
      'davs9404@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-juventud-bogota-1779',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-juventud-bogota-1779', v_school_id, '{"resolucion_rd": "1779", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "DIEGO ARMANDO VILLAMARIN SANCHEZ", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ARMANDO VILLAMARIN SANCHEZ. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1779. Vigente hasta 2029-12-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3156671138', phone),
      email       = COALESCE('davs9404@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1779", "resolucion_actualizacion": null, "fecha_inicio": "23-12-2024", "fecha_fin": "2029-12-23", "presidente": "DIEGO ARMANDO VILLAMARIN SANCHEZ", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-juventud-bogota-1779';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3156671138', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOCOS POR EL RACQUET CLUB  (IDRD-CLUB-club-deportivo-locos-por-el-racquet-club-664)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-locos-por-el-racquet-club-664';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOCOS POR EL RACQUET CLUB',
      'Presidente: MAURICIO ANGARITA GOMEZ. Deporte(s): Raquetball. Localidad: Usaquén. Resolución R-D Nº 664. Vigente hasta 2029-12-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3057086968',
      'oscar.pineros@gmail.com',
      ARRAY['Raquetball']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-locos-por-el-racquet-club-664',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-locos-por-el-racquet-club-664', v_school_id, '{"resolucion_rd": "664", "resolucion_actualizacion": null, "fecha_inicio": "26-12-2024", "fecha_fin": "2029-12-26", "presidente": "MAURICIO ANGARITA GOMEZ", "localidad": "Usaquén", "sports": ["Raquetball"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MAURICIO ANGARITA GOMEZ. Deporte(s): Raquetball. Localidad: Usaquén. Resolución R-D Nº 664. Vigente hasta 2029-12-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057086968', phone),
      email       = COALESCE('oscar.pineros@gmail.com', email),
      sports      = ARRAY['Raquetball']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "664", "resolucion_actualizacion": null, "fecha_inicio": "26-12-2024", "fecha_fin": "2029-12-26", "presidente": "MAURICIO ANGARITA GOMEZ", "localidad": "Usaquén", "sports": ["Raquetball"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-locos-por-el-racquet-club-664';
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
-- CLUB DEPORTIVO BENDITO PÃDEL  (IDRD-CLUB-club-deportivo-bendito-padel-1903)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bendito-padel-1903';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BENDITO PÃDEL',
      'Presidente: DANIEL FELIPE DIAZ PAEZ. Deporte(s): Padel. Localidad: Usaquén. Resolución R-D Nº 1903. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3208219224',
      'danieldiaz240795@gmail.com',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bendito-padel-1903',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bendito-padel-1903', v_school_id, '{"resolucion_rd": "1903", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "DANIEL FELIPE DIAZ PAEZ", "localidad": "Usaquén", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL FELIPE DIAZ PAEZ. Deporte(s): Padel. Localidad: Usaquén. Resolución R-D Nº 1903. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208219224', phone),
      email       = COALESCE('danieldiaz240795@gmail.com', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1903", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "DANIEL FELIPE DIAZ PAEZ", "localidad": "Usaquén", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bendito-padel-1903';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3208219224', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPEEDY RACING CLUB BMX  (IDRD-CLUB-club-deportivo-speedy-racing-club-bmx-1904)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-speedy-racing-club-bmx-1904';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPEEDY RACING CLUB BMX',
      'Presidente: LUIS GUILLERMO PAEZ BERNAL. Deporte(s): Ciclismo. Localidad: Fontibón. Resolución R-D Nº 1904. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3238004245',
      'speedyracing024@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-speedy-racing-club-bmx-1904',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-speedy-racing-club-bmx-1904', v_school_id, '{"resolucion_rd": "1904", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "LUIS GUILLERMO PAEZ BERNAL", "localidad": "Fontibón", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS GUILLERMO PAEZ BERNAL. Deporte(s): Ciclismo. Localidad: Fontibón. Resolución R-D Nº 1904. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3238004245', phone),
      email       = COALESCE('speedyracing024@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1904", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "LUIS GUILLERMO PAEZ BERNAL", "localidad": "Fontibón", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-speedy-racing-club-bmx-1904';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3238004245', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LITHIUM FUTSAL  (IDRD-CLUB-club-deportivo-lithium-futsal-1906)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lithium-futsal-1906';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LITHIUM FUTSAL',
      'Presidente: HOLLMAN DAVID AVENDAÃO PATIÃO. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 1906. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3115617747',
      'lithiumfutsal@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lithium-futsal-1906',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lithium-futsal-1906', v_school_id, '{"resolucion_rd": "1906", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "HOLLMAN DAVID AVENDAÃO PATIÃO", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HOLLMAN DAVID AVENDAÃO PATIÃO. Deporte(s): Fútbol de salón. Localidad: San Cristóbal. Resolución R-D Nº 1906. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115617747', phone),
      email       = COALESCE('lithiumfutsal@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1906", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "HOLLMAN DAVID AVENDAÃO PATIÃO", "localidad": "San Cristóbal", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lithium-futsal-1906';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3115617747', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUTURES SWIMMERS  (IDRD-CLUB-club-deportivo-futures-swimmers-1902)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-futures-swimmers-1902';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUTURES SWIMMERS',
      'Presidente: NICOLAS JOHAN GONZALEZ HERNANDEZ. Deporte(s): Natación. Localidad: Usme. Resolución R-D Nº 1902. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3153965743',
      'mahihepe1314@hotmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-futures-swimmers-1902',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-futures-swimmers-1902', v_school_id, '{"resolucion_rd": "1902", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "NICOLAS JOHAN GONZALEZ HERNANDEZ", "localidad": "Usme", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS JOHAN GONZALEZ HERNANDEZ. Deporte(s): Natación. Localidad: Usme. Resolución R-D Nº 1902. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153965743', phone),
      email       = COALESCE('mahihepe1314@hotmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1902", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "NICOLAS JOHAN GONZALEZ HERNANDEZ", "localidad": "Usme", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-futures-swimmers-1902';
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
-- CLUB DEPORTIVO INTERNACIONAL CAMPEONES  (IDRD-CLUB-club-deportivo-internacional-campeones-1912)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-internacional-campeones-1912';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO INTERNACIONAL CAMPEONES',
      'Presidente: INES VALDERRAMA LOZANO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1912. Vigente hasta 2030-01-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3112374768',
      'internacionalcampeones@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-internacional-campeones-1912',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-internacional-campeones-1912', v_school_id, '{"resolucion_rd": "1912", "resolucion_actualizacion": null, "fecha_inicio": "09-01-2025", "fecha_fin": "2030-01-09", "presidente": "INES VALDERRAMA LOZANO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: INES VALDERRAMA LOZANO. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1912. Vigente hasta 2030-01-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112374768', phone),
      email       = COALESCE('internacionalcampeones@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1912", "resolucion_actualizacion": null, "fecha_inicio": "09-01-2025", "fecha_fin": "2030-01-09", "presidente": "INES VALDERRAMA LOZANO", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-internacional-campeones-1912';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3112374768', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO 10.9  (IDRD-CLUB-club-deportivo-109-1905)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-109-1905';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO 10.9',
      'Presidente: IVAN CAMILO LOPEZ GASCA. Deporte(s): Tiro Para Deportivo. Localidad: Barrios Unidos. Resolución R-D Nº 1905. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3108166516',
      'clubdetiro10.9@gmail.com',
      ARRAY['Tiro Para Deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-109-1905',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-109-1905', v_school_id, '{"resolucion_rd": "1905", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "IVAN CAMILO LOPEZ GASCA", "localidad": "Barrios Unidos", "sports": ["Tiro Para Deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVAN CAMILO LOPEZ GASCA. Deporte(s): Tiro Para Deportivo. Localidad: Barrios Unidos. Resolución R-D Nº 1905. Vigente hasta 2030-01-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108166516', phone),
      email       = COALESCE('clubdetiro10.9@gmail.com', email),
      sports      = ARRAY['Tiro Para Deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1905", "resolucion_actualizacion": null, "fecha_inicio": "07-01-2025", "fecha_fin": "2030-01-07", "presidente": "IVAN CAMILO LOPEZ GASCA", "localidad": "Barrios Unidos", "sports": ["Tiro Para Deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-109-1905';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3108166516', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KAIZEN KARATE-DO  (IDRD-CLUB-club-deportivo-kaizen-karate-do-1959)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-kaizen-karate-do-1959';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KAIZEN KARATE-DO',
      'Presidente: HELVER JOHANY LUIS BARBOSA. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 1959. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3007390450',
      'clubkaizenkarate@gmail.com',
      ARRAY['Karate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-kaizen-karate-do-1959',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-kaizen-karate-do-1959', v_school_id, '{"resolucion_rd": "1959", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "HELVER JOHANY LUIS BARBOSA", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HELVER JOHANY LUIS BARBOSA. Deporte(s): Karate. Localidad: Engativá. Resolución R-D Nº 1959. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007390450', phone),
      email       = COALESCE('clubkaizenkarate@gmail.com', email),
      sports      = ARRAY['Karate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1959", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "HELVER JOHANY LUIS BARBOSA", "localidad": "Engativá", "sports": ["Karate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-kaizen-karate-do-1959';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3007390450', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EPIC PADEL  (IDRD-CLUB-club-deportivo-epic-padel-1960)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-epic-padel-1960';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EPIC PADEL',
      'Presidente: NICOLAS AYALA RODRÃGUEZ. Deporte(s): Padel. Localidad: Usaquén. Resolución R-D Nº 1960. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3186789422',
      'nicolasayalar6@hotmail.com',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-epic-padel-1960',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-epic-padel-1960', v_school_id, '{"resolucion_rd": "1960", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "NICOLAS AYALA RODRÃGUEZ", "localidad": "Usaquén", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS AYALA RODRÃGUEZ. Deporte(s): Padel. Localidad: Usaquén. Resolución R-D Nº 1960. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3186789422', phone),
      email       = COALESCE('nicolasayalar6@hotmail.com', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1960", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "NICOLAS AYALA RODRÃGUEZ", "localidad": "Usaquén", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-epic-padel-1960';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3186789422', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO THE EAGLE WRESTLING CLUB  (IDRD-CLUB-club-deportivo-the-eagle-wrestling-club-1971)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-the-eagle-wrestling-club-1971';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO THE EAGLE WRESTLING CLUB',
      'Presidente: MÃNICA PAOLA MORALES BARRIGA. Deporte(s): Lucha. Localidad: Kennedy. Resolución R-D Nº 1971. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3182568261',
      'elisa201322@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-the-eagle-wrestling-club-1971',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-the-eagle-wrestling-club-1971', v_school_id, '{"resolucion_rd": "1971", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MÃNICA PAOLA MORALES BARRIGA", "localidad": "Kennedy", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MÃNICA PAOLA MORALES BARRIGA. Deporte(s): Lucha. Localidad: Kennedy. Resolución R-D Nº 1971. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3182568261', phone),
      email       = COALESCE('elisa201322@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1971", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MÃNICA PAOLA MORALES BARRIGA", "localidad": "Kennedy", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-the-eagle-wrestling-club-1971';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3182568261', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LATIN SOCCER  (IDRD-CLUB-club-deportivo-latin-soccer-1972)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-latin-soccer-1972';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LATIN SOCCER',
      'Presidente: YULI ALEJANDRA MUÃOZ BRICEÃO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1972. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3203049604',
      'latinsoccercf@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-latin-soccer-1972',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-latin-soccer-1972', v_school_id, '{"resolucion_rd": "1972", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "YULI ALEJANDRA MUÃOZ BRICEÃO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YULI ALEJANDRA MUÃOZ BRICEÃO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1972. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203049604', phone),
      email       = COALESCE('latinsoccercf@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1972", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "YULI ALEJANDRA MUÃOZ BRICEÃO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-latin-soccer-1972';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3203049604', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CITIUS SWIMING  (IDRD-CLUB-club-deportivo-citius-swiming-1973)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-citius-swiming-1973';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CITIUS SWIMING',
      'Presidente: ORLANDO VERGARA VARGAS. Deporte(s): Para Nataciã³N. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1973. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3105574104',
      'clubcitiusswimming@gmail.com',
      ARRAY['Para Nataciã³N']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-citius-swiming-1973',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-citius-swiming-1973', v_school_id, '{"resolucion_rd": "1973", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "ORLANDO VERGARA VARGAS", "localidad": "Rafael Uribe Uribe", "sports": ["Para Nataciã³N"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ORLANDO VERGARA VARGAS. Deporte(s): Para Nataciã³N. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1973. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105574104', phone),
      email       = COALESCE('clubcitiusswimming@gmail.com', email),
      sports      = ARRAY['Para Nataciã³N']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1973", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "ORLANDO VERGARA VARGAS", "localidad": "Rafael Uribe Uribe", "sports": ["Para Nataciã³N"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-citius-swiming-1973';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3105574104', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DISTRITO BEACH TENNIS  (IDRD-CLUB-club-deportivo-distrito-beach-tennis-1975)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-distrito-beach-tennis-1975';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DISTRITO BEACH TENNIS',
      'Presidente: MARIO ANDRES INSUASTY NARVAEZ. Deporte(s): Tenis. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1975. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3004112605',
      'distritobeachtennis@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-distrito-beach-tennis-1975',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-distrito-beach-tennis-1975', v_school_id, '{"resolucion_rd": "1975", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MARIO ANDRES INSUASTY NARVAEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIO ANDRES INSUASTY NARVAEZ. Deporte(s): Tenis. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1975. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3004112605', phone),
      email       = COALESCE('distritobeachtennis@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1975", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MARIO ANDRES INSUASTY NARVAEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-distrito-beach-tennis-1975';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3004112605', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DIMAX F.M.  (IDRD-CLUB-club-deportivo-dimax-fm-1976)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dimax-fm-1976';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DIMAX F.M.',
      'Presidente: DIEGO ANDRÃS NUÃEZ PINZÃN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1976. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3028588267',
      'dimaxf.m@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dimax-fm-1976',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dimax-fm-1976', v_school_id, '{"resolucion_rd": "1976", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "DIEGO ANDRÃS NUÃEZ PINZÃN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ANDRÃS NUÃEZ PINZÃN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1976. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3028588267', phone),
      email       = COALESCE('dimaxf.m@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1976", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "DIEGO ANDRÃS NUÃEZ PINZÃN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dimax-fm-1976';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3028588267', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO JENISABIKE  (IDRD-CLUB-club-deportivo-jenisabike-1981)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-jenisabike-1981';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO JENISABIKE',
      'Presidente: INGRI PAOLA ORTIZ GONZALEZ. Deporte(s): Ciclismo. Localidad: Bosa. Resolución R-D Nº 1981. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3183880162',
      'equipojenisabike@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-jenisabike-1981',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-jenisabike-1981', v_school_id, '{"resolucion_rd": "1981", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "INGRI PAOLA ORTIZ GONZALEZ", "localidad": "Bosa", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: INGRI PAOLA ORTIZ GONZALEZ. Deporte(s): Ciclismo. Localidad: Bosa. Resolución R-D Nº 1981. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183880162', phone),
      email       = COALESCE('equipojenisabike@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1981", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "INGRI PAOLA ORTIZ GONZALEZ", "localidad": "Bosa", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-jenisabike-1981';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3183880162', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PRODIGIOS WRESTLING  (IDRD-CLUB-club-deportivo-prodigios-wrestling-1983)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-prodigios-wrestling-1983';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PRODIGIOS WRESTLING',
      'Presidente: MARLON EDUARDO MENDEZ LATORRE. Deporte(s): Lucha. Localidad: Engativá. Resolución R-D Nº 1983. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3003247342',
      'masterrojo7@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-prodigios-wrestling-1983',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-prodigios-wrestling-1983', v_school_id, '{"resolucion_rd": "1983", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MARLON EDUARDO MENDEZ LATORRE", "localidad": "Engativá", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARLON EDUARDO MENDEZ LATORRE. Deporte(s): Lucha. Localidad: Engativá. Resolución R-D Nº 1983. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3003247342', phone),
      email       = COALESCE('masterrojo7@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1983", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MARLON EDUARDO MENDEZ LATORRE", "localidad": "Engativá", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-prodigios-wrestling-1983';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3003247342', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO HERMON  (IDRD-CLUB-club-deportivo-hermon-1982)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-hermon-1982';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO HERMON',
      'Presidente: CLAUDIA PATRICIA LOPEZ GONZALEZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1982. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3012413479',
      'clubhermoncl@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-hermon-1982',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-hermon-1982', v_school_id, '{"resolucion_rd": "1982", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "CLAUDIA PATRICIA LOPEZ GONZALEZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CLAUDIA PATRICIA LOPEZ GONZALEZ. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1982. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012413479', phone),
      email       = COALESCE('clubhermoncl@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1982", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "CLAUDIA PATRICIA LOPEZ GONZALEZ", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-hermon-1982';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3012413479', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAMAY  (IDRD-CLUB-club-deportivo-samay-1984)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-samay-1984';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAMAY',
      'Presidente: MARIO ANDRES MALDONADO ROMERO. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 1984. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3214999742',
      'marioandres1028@outlook.es',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-samay-1984',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-samay-1984', v_school_id, '{"resolucion_rd": "1984", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MARIO ANDRES MALDONADO ROMERO", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIO ANDRES MALDONADO ROMERO. Deporte(s): Fútbol de salón. Localidad: Usme. Resolución R-D Nº 1984. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214999742', phone),
      email       = COALESCE('marioandres1028@outlook.es', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1984", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "MARIO ANDRES MALDONADO ROMERO", "localidad": "Usme", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-samay-1984';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3214999742', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO B.J.Q.  (IDRD-CLUB-club-deportivo-bjq-1987)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-bjq-1987';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO B.J.Q.',
      'Presidente: ALVARO ACUÃA TRASLAVIÃA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1987. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3223241974',
      'clubdeportivobjq@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-bjq-1987',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-bjq-1987', v_school_id, '{"resolucion_rd": "1987", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "ALVARO ACUÃA TRASLAVIÃA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALVARO ACUÃA TRASLAVIÃA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1987. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3223241974', phone),
      email       = COALESCE('clubdeportivobjq@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1987", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "ALVARO ACUÃA TRASLAVIÃA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-bjq-1987';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3223241974', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO COLOSAL  (IDRD-CLUB-club-deportivo-colosal-1988)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-colosal-1988';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO COLOSAL',
      'Presidente: JEAN PIER SMITH RUIZ NIETO. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1988. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3107726307',
      'colosalescueladeformacion@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-colosal-1988',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-colosal-1988', v_school_id, '{"resolucion_rd": "1988", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "JEAN PIER SMITH RUIZ NIETO", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEAN PIER SMITH RUIZ NIETO. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 1988. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107726307', phone),
      email       = COALESCE('colosalescueladeformacion@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1988", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "JEAN PIER SMITH RUIZ NIETO", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-colosal-1988';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3107726307', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ZONIC SPORT  (IDRD-CLUB-club-deportivo-zonic-sport-1978)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-zonic-sport-1978';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ZONIC SPORT',
      'Presidente: JUAN CAMILO ZUBIETA RAMIREZ. Deporte(s): Badminton, Fútbol de salón, Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1978. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3102968987',
      'zonicsport@gmail.com',
      ARRAY['Badminton','Fútbol de salón','Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-zonic-sport-1978',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-zonic-sport-1978', v_school_id, '{"resolucion_rd": "1978", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "JUAN CAMILO ZUBIETA RAMIREZ", "localidad": "Tunjuelito", "sports": ["Badminton", "Fútbol de salón", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CAMILO ZUBIETA RAMIREZ. Deporte(s): Badminton, Fútbol de salón, Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1978. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102968987', phone),
      email       = COALESCE('zonicsport@gmail.com', email),
      sports      = ARRAY['Badminton','Fútbol de salón','Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1978", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "JUAN CAMILO ZUBIETA RAMIREZ", "localidad": "Tunjuelito", "sports": ["Badminton", "Fútbol de salón", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-zonic-sport-1978';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3102968987', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DEER VOLLEY  (IDRD-CLUB-club-deportivo-deer-volley-1974)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-deer-volley-1974';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DEER VOLLEY',
      'Presidente: JERSON OVIEDO CORREA. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1974. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3218927742',
      'carlos.a.estrada.r@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-deer-volley-1974',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-deer-volley-1974', v_school_id, '{"resolucion_rd": "1974", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "JERSON OVIEDO CORREA", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JERSON OVIEDO CORREA. Deporte(s): Voleibol. Localidad: Engativá. Resolución R-D Nº 1974. Vigente hasta 2030-01-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3218927742', phone),
      email       = COALESCE('carlos.a.estrada.r@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1974", "resolucion_actualizacion": null, "fecha_inicio": "15-01-2025", "fecha_fin": "2030-01-15", "presidente": "JERSON OVIEDO CORREA", "localidad": "Engativá", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-deer-volley-1974';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3218927742', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ANGELES DE BOGOTÃ F.C  (IDRD-CLUB-club-deportivo-angeles-de-bogota-fc-086)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-angeles-de-bogota-fc-086';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ANGELES DE BOGOTÃ F.C',
      'Presidente: MIGUEL ANGEL BELTRAN REINA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 086 / actualización Nº 086. Vigente hasta 2029-01-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3142024292',
      'angelesdebogotafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-angeles-de-bogota-fc-086',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-angeles-de-bogota-fc-086', v_school_id, '{"resolucion_rd": "086", "resolucion_actualizacion": "086", "fecha_inicio": "29-01-2024", "fecha_fin": "2029-01-28", "presidente": "MIGUEL ANGEL BELTRAN REINA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL BELTRAN REINA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 086 / actualización Nº 086. Vigente hasta 2029-01-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142024292', phone),
      email       = COALESCE('angelesdebogotafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "086", "resolucion_actualizacion": "086", "fecha_inicio": "29-01-2024", "fecha_fin": "2029-01-28", "presidente": "MIGUEL ANGEL BELTRAN REINA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-angeles-de-bogota-fc-086';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3142024292', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO TITANES ELITE  (IDRD-CLUB-club-deportivo-titanes-elite-019)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-titanes-elite-019';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO TITANES ELITE',
      'Presidente: ERICK SLEIDER MOYA ENRIQUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 019. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3058689819',
      'titaneselite@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-titanes-elite-019',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-titanes-elite-019', v_school_id, '{"resolucion_rd": "019", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "ERICK SLEIDER MOYA ENRIQUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ERICK SLEIDER MOYA ENRIQUEZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 019. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3058689819', phone),
      email       = COALESCE('titaneselite@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "019", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "ERICK SLEIDER MOYA ENRIQUEZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-titanes-elite-019';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3058689819', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BARBATRIAN  (IDRD-CLUB-club-deportivo-barbatrian-018)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-barbatrian-018';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BARBATRIAN',
      'Presidente: MERY TRIANA RODRIGUEZ. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 018. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3203909886',
      'barbatriantkd@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-barbatrian-018',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-barbatrian-018', v_school_id, '{"resolucion_rd": "018", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "MERY TRIANA RODRIGUEZ", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MERY TRIANA RODRIGUEZ. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 018. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203909886', phone),
      email       = COALESCE('barbatriantkd@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "018", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "MERY TRIANA RODRIGUEZ", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-barbatrian-018';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3203909886', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUNDACIÃN DESCUBRIENDO Y APOYANDO TALENTOS DEPORTIVOS  (IDRD-CLUB-club-deportivo-fundacian-descubriendo-y--017)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fundacian-descubriendo-y--017';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUNDACIÃN DESCUBRIENDO Y APOYANDO TALENTOS DEPORTIVOS',
      'Presidente: GILBERTO CADENA AGUILAR. Deporte(s): Tenis, Baloncesto, Voleibol, Patinaje. Localidad: Kennedy. Resolución R-D Nº 017. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3108637416',
      'fundatade@gmail.com',
      ARRAY['Tenis','Baloncesto','Voleibol','Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fundacian-descubriendo-y--017',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fundacian-descubriendo-y--017', v_school_id, '{"resolucion_rd": "017", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "GILBERTO CADENA AGUILAR", "localidad": "Kennedy", "sports": ["Tenis", "Baloncesto", "Voleibol", "Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GILBERTO CADENA AGUILAR. Deporte(s): Tenis, Baloncesto, Voleibol, Patinaje. Localidad: Kennedy. Resolución R-D Nº 017. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108637416', phone),
      email       = COALESCE('fundatade@gmail.com', email),
      sports      = ARRAY['Tenis','Baloncesto','Voleibol','Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "017", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "GILBERTO CADENA AGUILAR", "localidad": "Kennedy", "sports": ["Tenis", "Baloncesto", "Voleibol", "Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fundacian-descubriendo-y--017';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3108637416', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUTBOLEROS F.C  (IDRD-CLUB-club-deportivo-futboleros-fc-021)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-futboleros-fc-021';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUTBOLEROS F.C',
      'Presidente: JOSE ESTEBAN PERDOMO MARTINEZ. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 021. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3102010512',
      'futbolclubfutbolero@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-futboleros-fc-021',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-futboleros-fc-021', v_school_id, '{"resolucion_rd": "021", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "JOSE ESTEBAN PERDOMO MARTINEZ", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE ESTEBAN PERDOMO MARTINEZ. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 021. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102010512', phone),
      email       = COALESCE('futbolclubfutbolero@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "021", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "JOSE ESTEBAN PERDOMO MARTINEZ", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-futboleros-fc-021';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3102010512', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PREDATORS BOGOTÃ  (IDRD-CLUB-club-deportivo-predators-bogota-22)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-predators-bogota-22';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PREDATORS BOGOTÃ',
      'Presidente: CARLOS ESTEBAN GONZALEZ VAHOS. Deporte(s): Lucha. Localidad: Kennedy. Resolución R-D Nº 22. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3227422210',
      'charly.vahos@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-predators-bogota-22',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-predators-bogota-22', v_school_id, '{"resolucion_rd": "22", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "CARLOS ESTEBAN GONZALEZ VAHOS", "localidad": "Kennedy", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ESTEBAN GONZALEZ VAHOS. Deporte(s): Lucha. Localidad: Kennedy. Resolución R-D Nº 22. Vigente hasta 2030-01-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3227422210', phone),
      email       = COALESCE('charly.vahos@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "22", "resolucion_actualizacion": null, "fecha_inicio": "29-01-2025", "fecha_fin": "2030-01-29", "presidente": "CARLOS ESTEBAN GONZALEZ VAHOS", "localidad": "Kennedy", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-predators-bogota-22';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3227422210', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE TAEKWONDO KEON-TAE  (IDRD-CLUB-club-deportivo-de-taekwondo-keon-tae-040)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-keon-tae-040';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE TAEKWONDO KEON-TAE',
      'Presidente: CELIA PATRICIA SANCHEZ GRANDE. Deporte(s): Taekwondo. Localidad: Bosa. Resolución R-D Nº 040. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3053444679',
      'clubkeontae@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-taekwondo-keon-tae-040',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-taekwondo-keon-tae-040', v_school_id, '{"resolucion_rd": "040", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "CELIA PATRICIA SANCHEZ GRANDE", "localidad": "Bosa", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CELIA PATRICIA SANCHEZ GRANDE. Deporte(s): Taekwondo. Localidad: Bosa. Resolución R-D Nº 040. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3053444679', phone),
      email       = COALESCE('clubkeontae@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "040", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "CELIA PATRICIA SANCHEZ GRANDE", "localidad": "Bosa", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-taekwondo-keon-tae-040';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3053444679', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO F.C. LOS COTORROS  (IDRD-CLUB-club-deportivo-fc-los-cotorros-041)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fc-los-cotorros-041';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO F.C. LOS COTORROS',
      'Presidente: DANIEL HUMBERTO DÃAZ VAQUIRO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 041. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3204299279',
      'fcloscotorros@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fc-los-cotorros-041',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fc-los-cotorros-041', v_school_id, '{"resolucion_rd": "041", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "DANIEL HUMBERTO DÃAZ VAQUIRO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DANIEL HUMBERTO DÃAZ VAQUIRO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 041. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204299279', phone),
      email       = COALESCE('fcloscotorros@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "041", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "DANIEL HUMBERTO DÃAZ VAQUIRO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fc-los-cotorros-041';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3204299279', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO STK BIKE CLUB  (IDRD-CLUB-club-deportivo-stk-bike-club-042)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-stk-bike-club-042';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO STK BIKE CLUB',
      'Presidente: HENRY HERNÃN FORIGUA GARCIA. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 042. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3018987134',
      'stkbikeclub@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-stk-bike-club-042',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-stk-bike-club-042', v_school_id, '{"resolucion_rd": "042", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "HENRY HERNÃN FORIGUA GARCIA", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HENRY HERNÃN FORIGUA GARCIA. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 042. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3018987134', phone),
      email       = COALESCE('stkbikeclub@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "042", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "HENRY HERNÃN FORIGUA GARCIA", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-stk-bike-club-042';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3018987134', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PÃDEL LOCOS POR PADEL  (IDRD-CLUB-club-deportivo-de-padel-locos-por-padel-045)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-padel-locos-por-padel-045';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PÃDEL LOCOS POR PADEL',
      'Presidente: CAMILO HOYOS OROZCO. Deporte(s): Padel. Localidad: Suba. Resolución R-D Nº 045. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3016929482',
      'contabilidad@locosporpadel.com',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-padel-locos-por-padel-045',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-padel-locos-por-padel-045', v_school_id, '{"resolucion_rd": "045", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "CAMILO HOYOS OROZCO", "localidad": "Suba", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO HOYOS OROZCO. Deporte(s): Padel. Localidad: Suba. Resolución R-D Nº 045. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3016929482', phone),
      email       = COALESCE('contabilidad@locosporpadel.com', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "045", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "CAMILO HOYOS OROZCO", "localidad": "Suba", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-padel-locos-por-padel-045';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3016929482', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EL PARCHE PADEL CLUB  (IDRD-CLUB-club-deportivo-el-parche-padel-club-020)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-parche-padel-club-020';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EL PARCHE PADEL CLUB',
      'Presidente: DAVID HORACIO DAZA BONILLA. Deporte(s): Padel. Localidad: Suba. Resolución R-D Nº 020. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3103436254',
      'elparchepadel@gmail.com',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-el-parche-padel-club-020',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-el-parche-padel-club-020', v_school_id, '{"resolucion_rd": "020", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "DAVID HORACIO DAZA BONILLA", "localidad": "Suba", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID HORACIO DAZA BONILLA. Deporte(s): Padel. Localidad: Suba. Resolución R-D Nº 020. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103436254', phone),
      email       = COALESCE('elparchepadel@gmail.com', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "020", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "DAVID HORACIO DAZA BONILLA", "localidad": "Suba", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-el-parche-padel-club-020';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3103436254', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CUERVOS VOLLEY CLUB  (IDRD-CLUB-club-deportivo-cuervos-volley-club-044)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cuervos-volley-club-044';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CUERVOS VOLLEY CLUB',
      'Presidente: ALEXANDER ORREGO NIETO. Deporte(s): Voleibol. Localidad: Fontibón. Resolución R-D Nº 044. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3222760834',
      'volleycuervosclub@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cuervos-volley-club-044',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cuervos-volley-club-044', v_school_id, '{"resolucion_rd": "044", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "ALEXANDER ORREGO NIETO", "localidad": "Fontibón", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEXANDER ORREGO NIETO. Deporte(s): Voleibol. Localidad: Fontibón. Resolución R-D Nº 044. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3222760834', phone),
      email       = COALESCE('volleycuervosclub@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "044", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "ALEXANDER ORREGO NIETO", "localidad": "Fontibón", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cuervos-volley-club-044';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3222760834', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO IMPERIUS  (IDRD-CLUB-club-deportivo-imperius-024)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-imperius-024';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO IMPERIUS',
      'Presidente: VIVIAN ANDREA BECERRA GUTIERREZ. Deporte(s): Lucha. Localidad: Engativá. Resolución R-D Nº 024. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3203247342',
      'imperiuswrestline@gmail.com',
      ARRAY['Lucha']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-imperius-024',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-imperius-024', v_school_id, '{"resolucion_rd": "024", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "VIVIAN ANDREA BECERRA GUTIERREZ", "localidad": "Engativá", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VIVIAN ANDREA BECERRA GUTIERREZ. Deporte(s): Lucha. Localidad: Engativá. Resolución R-D Nº 024. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203247342', phone),
      email       = COALESCE('imperiuswrestline@gmail.com', email),
      sports      = ARRAY['Lucha']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "024", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "VIVIAN ANDREA BECERRA GUTIERREZ", "localidad": "Engativá", "sports": ["Lucha"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-imperius-024';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3203247342', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE BALONCESTO LEONES DE LEVI  (IDRD-CLUB-club-deportivo-de-baloncesto-leones-de-l-061)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-leones-de-l-061';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE BALONCESTO LEONES DE LEVI',
      'Presidente: ESTEBAN MORALES SOLORZANO. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 061. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3242516220',
      'clubdeportivoleonesdelevi@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-baloncesto-leones-de-l-061',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-baloncesto-leones-de-l-061', v_school_id, '{"resolucion_rd": "061", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "ESTEBAN MORALES SOLORZANO", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ESTEBAN MORALES SOLORZANO. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 061. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3242516220', phone),
      email       = COALESCE('clubdeportivoleonesdelevi@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "061", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "ESTEBAN MORALES SOLORZANO", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-leones-de-l-061';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3242516220', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA RCS  (IDRD-CLUB-club-deportivo-academia-rcs-072)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-rcs-072';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA RCS',
      'Presidente: MIGUEL ANGEL CASTILLO ORTIZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 072. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3009916929',
      'agencyrcsfootball@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-rcs-072',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-rcs-072', v_school_id, '{"resolucion_rd": "072", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "MIGUEL ANGEL CASTILLO ORTIZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL CASTILLO ORTIZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 072. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3009916929', phone),
      email       = COALESCE('agencyrcsfootball@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "072", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "MIGUEL ANGEL CASTILLO ORTIZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-rcs-072';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3009916929', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO OHANA ULTIMATE CLUB  (IDRD-CLUB-club-deportivo-ohana-ultimate-club-079)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ohana-ultimate-club-079';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO OHANA ULTIMATE CLUB',
      'Presidente: STEVEN ORLANDO GUTIÃRREZ ARANZALES. Deporte(s): Disco Volador. Localidad: La Candelaria. Resolución R-D Nº 079. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'La Candelaria',
      '3213937502',
      'ohanaultimateclub@gmail.com',
      ARRAY['Disco Volador']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ohana-ultimate-club-079',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ohana-ultimate-club-079', v_school_id, '{"resolucion_rd": "079", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "STEVEN ORLANDO GUTIÃRREZ ARANZALES", "localidad": "La Candelaria", "sports": ["Disco Volador"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: STEVEN ORLANDO GUTIÃRREZ ARANZALES. Deporte(s): Disco Volador. Localidad: La Candelaria. Resolución R-D Nº 079. Vigente hasta 2030-02-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213937502', phone),
      email       = COALESCE('ohanaultimateclub@gmail.com', email),
      sports      = ARRAY['Disco Volador']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "079", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2025", "fecha_fin": "2030-02-03", "presidente": "STEVEN ORLANDO GUTIÃRREZ ARANZALES", "localidad": "La Candelaria", "sports": ["Disco Volador"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ohana-ultimate-club-079';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'La Candelaria', 'Bogotá', '3213937502', 4.6843605, -74.0511562, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FUNDACIÃN LOGROS DEPORTIVOS  (IDRD-CLUB-club-deportivo-fundacian-logros-deportiv-086)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-fundacian-logros-deportiv-086';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FUNDACIÃN LOGROS DEPORTIVOS',
      'Presidente: MARÃA FERNANDA BATISTA MORALES. Deporte(s): Béisbol, Softbol. Localidad: Chapinero. Resolución R-D Nº 086. Vigente hasta 2030-02-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3143756884',
      'fundacionlogrosdeportivos@gmail.com',
      ARRAY['Béisbol','Softbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-fundacian-logros-deportiv-086',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-fundacian-logros-deportiv-086', v_school_id, '{"resolucion_rd": "086", "resolucion_actualizacion": null, "fecha_inicio": "04-02-2025", "fecha_fin": "2030-02-04", "presidente": "MARÃA FERNANDA BATISTA MORALES", "localidad": "Chapinero", "sports": ["Béisbol", "Softbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARÃA FERNANDA BATISTA MORALES. Deporte(s): Béisbol, Softbol. Localidad: Chapinero. Resolución R-D Nº 086. Vigente hasta 2030-02-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3143756884', phone),
      email       = COALESCE('fundacionlogrosdeportivos@gmail.com', email),
      sports      = ARRAY['Béisbol','Softbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "086", "resolucion_actualizacion": null, "fecha_inicio": "04-02-2025", "fecha_fin": "2030-02-04", "presidente": "MARÃA FERNANDA BATISTA MORALES", "localidad": "Chapinero", "sports": ["Béisbol", "Softbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-fundacian-logros-deportiv-086';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3143756884', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DE FORMACION DEPORTIVO REAL CELTIC  (IDRD-CLUB-club-de-formacion-deportivo-real-celtic-095)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-de-formacion-deportivo-real-celtic-095';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DE FORMACION DEPORTIVO REAL CELTIC',
      'Presidente: IVAN DARIO PRIETO AGUACIA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 095. Vigente hasta 2030-02-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3118279992',
      'efdrealceltic@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-de-formacion-deportivo-real-celtic-095',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-de-formacion-deportivo-real-celtic-095', v_school_id, '{"resolucion_rd": "095", "resolucion_actualizacion": null, "fecha_inicio": "04-02-2025", "fecha_fin": "2030-02-04", "presidente": "IVAN DARIO PRIETO AGUACIA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IVAN DARIO PRIETO AGUACIA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 095. Vigente hasta 2030-02-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118279992', phone),
      email       = COALESCE('efdrealceltic@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "095", "resolucion_actualizacion": null, "fecha_inicio": "04-02-2025", "fecha_fin": "2030-02-04", "presidente": "IVAN DARIO PRIETO AGUACIA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-de-formacion-deportivo-real-celtic-095';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3118279992', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DO SANTOS FÃTBOL CLUB  (IDRD-CLUB-club-deportivo-do-santos-fatbol-club-046)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-do-santos-fatbol-club-046';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DO SANTOS FÃTBOL CLUB',
      'Presidente: DIEGO HERNAN MURILLO HERNÃNDEZ. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 046. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3173905562',
      'infodosantosfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-do-santos-fatbol-club-046',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-do-santos-fatbol-club-046', v_school_id, '{"resolucion_rd": "046", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "DIEGO HERNAN MURILLO HERNÃNDEZ", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO HERNAN MURILLO HERNÃNDEZ. Deporte(s): Fútbol. Localidad: Los Mártires. Resolución R-D Nº 046. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173905562', phone),
      email       = COALESCE('infodosantosfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "046", "resolucion_actualizacion": null, "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "DIEGO HERNAN MURILLO HERNÃNDEZ", "localidad": "Los Mártires", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-do-santos-fatbol-club-046';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3173905562', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO PROFESSIONAL FC  (IDRD-CLUB-club-deportivo-professional-fc-1336)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-professional-fc-1336';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO PROFESSIONAL FC',
      'Presidente: DIEGO ARMANDO BELLO SÃNCHEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1336. Vigente hasta 2029-09-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3187881511',
      'cdprofessionalfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-professional-fc-1336',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-professional-fc-1336', v_school_id, '{"resolucion_rd": "1336", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2024", "fecha_fin": "2029-09-25", "presidente": "DIEGO ARMANDO BELLO SÃNCHEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ARMANDO BELLO SÃNCHEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1336. Vigente hasta 2029-09-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3187881511', phone),
      email       = COALESCE('cdprofessionalfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1336", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2024", "fecha_fin": "2029-09-25", "presidente": "DIEGO ARMANDO BELLO SÃNCHEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-professional-fc-1336';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3187881511', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INLINE BOGOTA  (IDRD-CLUB-inline-bogota-208)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-inline-bogota-208';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INLINE BOGOTA',
      'Presidente: MARIA EUGENIA ROBELTO LOPEZ. Deporte(s): Patinaje. Localidad: Usme. Resolución R-D Nº 208. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3247715452',
      'clubinlinebogota@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'inline-bogota-208',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-inline-bogota-208', v_school_id, '{"resolucion_rd": "208", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "MARIA EUGENIA ROBELTO LOPEZ", "localidad": "Usme", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA EUGENIA ROBELTO LOPEZ. Deporte(s): Patinaje. Localidad: Usme. Resolución R-D Nº 208. Vigente hasta 2029-02-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3247715452', phone),
      email       = COALESCE('clubinlinebogota@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "208", "resolucion_actualizacion": null, "fecha_inicio": "27-02-2024", "fecha_fin": "2029-02-26", "presidente": "MARIA EUGENIA ROBELTO LOPEZ", "localidad": "Usme", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-inline-bogota-208';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3247715452', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FUSION SOCCER F.C  (IDRD-CLUB-fusion-soccer-fc-450)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fusion-soccer-fc-450';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FUSION SOCCER F.C',
      'Presidente: HENRY ORLANDO URREGO RINCON. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 450. Vigente hasta 2029-04-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3006528767',
      'urregorinconhenyorlando@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fusion-soccer-fc-450',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fusion-soccer-fc-450', v_school_id, '{"resolucion_rd": "450", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2024", "fecha_fin": "2029-04-12", "presidente": "HENRY ORLANDO URREGO RINCON", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HENRY ORLANDO URREGO RINCON. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 450. Vigente hasta 2029-04-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3006528767', phone),
      email       = COALESCE('urregorinconhenyorlando@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "450", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2024", "fecha_fin": "2029-04-12", "presidente": "HENRY ORLANDO URREGO RINCON", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fusion-soccer-fc-450';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3006528767', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO BALANCE BMX CLUB  (IDRD-CLUB-club-deportivo-balance-bmx-club-153)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-balance-bmx-club-153';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO BALANCE BMX CLUB',
      'Presidente: FREDY ARTURO ORTÃZ FONSECA. Deporte(s): Ciclismo. Localidad: Teusaquillo. Resolución R-D Nº 153. Vigente hasta 2030-02-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3112193585',
      'balancebmxclub@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-balance-bmx-club-153',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-balance-bmx-club-153', v_school_id, '{"resolucion_rd": "153", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2025", "fecha_fin": "2030-02-21", "presidente": "FREDY ARTURO ORTÃZ FONSECA", "localidad": "Teusaquillo", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREDY ARTURO ORTÃZ FONSECA. Deporte(s): Ciclismo. Localidad: Teusaquillo. Resolución R-D Nº 153. Vigente hasta 2030-02-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112193585', phone),
      email       = COALESCE('balancebmxclub@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "153", "resolucion_actualizacion": null, "fecha_inicio": "21-02-2025", "fecha_fin": "2030-02-21", "presidente": "FREDY ARTURO ORTÃZ FONSECA", "localidad": "Teusaquillo", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-balance-bmx-club-153';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3112193585', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO FEDERAL FC  (IDRD-CLUB-club-deportivo-federal-fc-164)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-federal-fc-164';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO FEDERAL FC',
      'Presidente: DAVID DAVID CONEO MERCADO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 164. Vigente hasta 2030-02-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3202581434',
      'clubfederalfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-federal-fc-164',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-federal-fc-164', v_school_id, '{"resolucion_rd": "164", "resolucion_actualizacion": null, "fecha_inicio": "25-02-2025", "fecha_fin": "2030-02-25", "presidente": "DAVID DAVID CONEO MERCADO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID DAVID CONEO MERCADO. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 164. Vigente hasta 2030-02-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202581434', phone),
      email       = COALESCE('clubfederalfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "164", "resolucion_actualizacion": null, "fecha_inicio": "25-02-2025", "fecha_fin": "2030-02-25", "presidente": "DAVID DAVID CONEO MERCADO", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-federal-fc-164';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3202581434', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PADEL LA PALA  (IDRD-CLUB-club-deportivo-de-padel-la-pala-168)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-padel-la-pala-168';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PADEL LA PALA',
      'Presidente: ANDRES FELIPE DIAZ GARCIA. Deporte(s): Padel. Localidad: Suba. Resolución R-D Nº 168. Vigente hasta 2030-02-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3208449041',
      'distritopadelclub1@gmail.com',
      ARRAY['Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-padel-la-pala-168',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-padel-la-pala-168', v_school_id, '{"resolucion_rd": "168", "resolucion_actualizacion": null, "fecha_inicio": "25-02-2025", "fecha_fin": "2030-02-25", "presidente": "ANDRES FELIPE DIAZ GARCIA", "localidad": "Suba", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES FELIPE DIAZ GARCIA. Deporte(s): Padel. Localidad: Suba. Resolución R-D Nº 168. Vigente hasta 2030-02-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3208449041', phone),
      email       = COALESCE('distritopadelclub1@gmail.com', email),
      sports      = ARRAY['Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "168", "resolucion_actualizacion": null, "fecha_inicio": "25-02-2025", "fecha_fin": "2030-02-25", "presidente": "ANDRES FELIPE DIAZ GARCIA", "localidad": "Suba", "sports": ["Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-padel-la-pala-168';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3208449041', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SANTOTO CLUB DEPORTIVO - BOGOTÃ  (IDRD-CLUB-club-deportivo-santoto-club-deportivo----193)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-santoto-club-deportivo----193';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SANTOTO CLUB DEPORTIVO - BOGOTÃ',
      'Presidente: FRAY ÃLVARO JOSÃ ARANGO RESTREPO. Deporte(s): Baloncesto, Voleibol, Ultimate, Natación, Atletismo, Fútbol, Rugby. Localidad: Suba. Resolución R-D Nº 193. Vigente hasta 2030-03-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '5878797',
      'dec.culturafisica@usta.edu.co',
      ARRAY['Baloncesto','Voleibol','Ultimate','Natación','Atletismo','Fútbol','Rugby']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-santoto-club-deportivo----193',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-santoto-club-deportivo----193', v_school_id, '{"resolucion_rd": "193", "resolucion_actualizacion": null, "fecha_inicio": "04-03-2025", "fecha_fin": "2030-03-04", "presidente": "FRAY ÃLVARO JOSÃ ARANGO RESTREPO", "localidad": "Suba", "sports": ["Baloncesto", "Voleibol", "Ultimate", "Natación", "Atletismo", "Fútbol", "Rugby"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FRAY ÃLVARO JOSÃ ARANGO RESTREPO. Deporte(s): Baloncesto, Voleibol, Ultimate, Natación, Atletismo, Fútbol, Rugby. Localidad: Suba. Resolución R-D Nº 193. Vigente hasta 2030-03-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('5878797', phone),
      email       = COALESCE('dec.culturafisica@usta.edu.co', email),
      sports      = ARRAY['Baloncesto','Voleibol','Ultimate','Natación','Atletismo','Fútbol','Rugby']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "193", "resolucion_actualizacion": null, "fecha_inicio": "04-03-2025", "fecha_fin": "2030-03-04", "presidente": "FRAY ÃLVARO JOSÃ ARANGO RESTREPO", "localidad": "Suba", "sports": ["Baloncesto", "Voleibol", "Ultimate", "Natación", "Atletismo", "Fútbol", "Rugby"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-santoto-club-deportivo----193';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '5878797', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SHOOTING MASTERS  (IDRD-CLUB-club-deportivo-shooting-masters-210)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-shooting-masters-210';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SHOOTING MASTERS',
      'Presidente: OSCAR MAURICIO SARMIENTO BECERRA. Deporte(s): Tiro deportivo. Localidad: Engativá. Resolución R-D Nº 210. Vigente hasta 2030-03-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3185863232',
      'shootingmasterclub@gmail.com',
      ARRAY['Tiro deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-shooting-masters-210',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-shooting-masters-210', v_school_id, '{"resolucion_rd": "210", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2025", "fecha_fin": "2030-03-10", "presidente": "OSCAR MAURICIO SARMIENTO BECERRA", "localidad": "Engativá", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR MAURICIO SARMIENTO BECERRA. Deporte(s): Tiro deportivo. Localidad: Engativá. Resolución R-D Nº 210. Vigente hasta 2030-03-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3185863232', phone),
      email       = COALESCE('shootingmasterclub@gmail.com', email),
      sports      = ARRAY['Tiro deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "210", "resolucion_actualizacion": null, "fecha_inicio": "10-03-2025", "fecha_fin": "2030-03-10", "presidente": "OSCAR MAURICIO SARMIENTO BECERRA", "localidad": "Engativá", "sports": ["Tiro deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-shooting-masters-210';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3185863232', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DRAGONES  (IDRD-CLUB-club-deportivo-dragones-219)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-dragones-219';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DRAGONES',
      'Presidente: AURA PAOLA GUINEA FAJARDO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 219. Vigente hasta 2030-03-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3213611969',
      'dragones.informacion@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-dragones-219',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-dragones-219', v_school_id, '{"resolucion_rd": "219", "resolucion_actualizacion": null, "fecha_inicio": "13-03-2025", "fecha_fin": "2030-03-13", "presidente": "AURA PAOLA GUINEA FAJARDO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AURA PAOLA GUINEA FAJARDO. Deporte(s): Patinaje. Localidad: Kennedy. Resolución R-D Nº 219. Vigente hasta 2030-03-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213611969', phone),
      email       = COALESCE('dragones.informacion@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "219", "resolucion_actualizacion": null, "fecha_inicio": "13-03-2025", "fecha_fin": "2030-03-13", "presidente": "AURA PAOLA GUINEA FAJARDO", "localidad": "Kennedy", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-dragones-219';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3213611969', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SAMPDORIA  (IDRD-CLUB-club-deportivo-sampdoria-220)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sampdoria-220';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SAMPDORIA',
      'Presidente: NORA LUZ BELTRÃN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 220. Vigente hasta 2030-03-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3145539263',
      'fundacionsampdoriasuba@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sampdoria-220',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sampdoria-220', v_school_id, '{"resolucion_rd": "220", "resolucion_actualizacion": null, "fecha_inicio": "13-03-2025", "fecha_fin": "2030-03-13", "presidente": "NORA LUZ BELTRÃN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NORA LUZ BELTRÃN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 220. Vigente hasta 2030-03-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3145539263', phone),
      email       = COALESCE('fundacionsampdoriasuba@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "220", "resolucion_actualizacion": null, "fecha_inicio": "13-03-2025", "fecha_fin": "2030-03-13", "presidente": "NORA LUZ BELTRÃN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sampdoria-220';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3145539263', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ARGENTINO BOGOTA F.C.  (IDRD-CLUB-club-deportivo-argentino-bogota-fc-244)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-argentino-bogota-fc-244';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ARGENTINO BOGOTA F.C.',
      'Presidente: JORGE ARNOLDO SANCHEZ CIFUENTES. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 244. Vigente hasta 2030-03-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3153138323',
      'argentinosjr10@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-argentino-bogota-fc-244',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-argentino-bogota-fc-244', v_school_id, '{"resolucion_rd": "244", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2025", "fecha_fin": "2030-03-17", "presidente": "JORGE ARNOLDO SANCHEZ CIFUENTES", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JORGE ARNOLDO SANCHEZ CIFUENTES. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 244. Vigente hasta 2030-03-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153138323', phone),
      email       = COALESCE('argentinosjr10@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "244", "resolucion_actualizacion": null, "fecha_inicio": "17-03-2025", "fecha_fin": "2030-03-17", "presidente": "JORGE ARNOLDO SANCHEZ CIFUENTES", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-argentino-bogota-fc-244';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3153138323', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB PRUEBA 002  (IDRD-CLUB-club-prueba-002-12341234)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-prueba-002-12341234';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB PRUEBA 002',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Localidad: Engativá. Resolución R-D Nº 12341234 / actualización Nº 12341234. Vigente hasta 2030-05-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3159283512',
      'escueladolphins@hotmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-prueba-002-12341234',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-prueba-002-12341234', v_school_id, '{"resolucion_rd": "12341234", "resolucion_actualizacion": "12341234", "fecha_inicio": "14-05-2025", "fecha_fin": "2030-05-14", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Engativá", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Localidad: Engativá. Resolución R-D Nº 12341234 / actualización Nº 12341234. Vigente hasta 2030-05-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3159283512', phone),
      email       = COALESCE('escueladolphins@hotmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "12341234", "resolucion_actualizacion": "12341234", "fecha_inicio": "14-05-2025", "fecha_fin": "2030-05-14", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Engativá", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-prueba-002-12341234';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3159283512', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- Yisel pruebas  (IDRD-CLUB-yisel-pruebas-1234)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-yisel-pruebas-1234';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Yisel pruebas',
      'Presidente: Yisel. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1234 / actualización Nº 13131. Vigente hasta 2030-05-29. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      NULL,
      'y@f.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'yisel-pruebas-1234',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-yisel-pruebas-1234', v_school_id, '{"resolucion_rd": "1234", "resolucion_actualizacion": "13131", "fecha_inicio": "29-05-2025", "fecha_fin": "2030-05-29", "presidente": "Yisel", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: Yisel. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 1234 / actualización Nº 13131. Vigente hasta 2030-05-29. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('y@f.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1234", "resolucion_actualizacion": "13131", "fecha_inicio": "29-05-2025", "fecha_fin": "2030-05-29", "presidente": "Yisel", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-yisel-pruebas-1234';
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
-- TEST CLUB  (IDRD-CLUB-test-club-84183)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-test-club-84183';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TEST CLUB',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Localidad: Usme. Resolución R-D Nº 84183 / actualización Nº 84138. Vigente hasta 2030-05-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3159283512',
      'example@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'test-club-84183',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-test-club-84183', v_school_id, '{"resolucion_rd": "84183", "resolucion_actualizacion": "84138", "fecha_inicio": "15-05-2025", "fecha_fin": "2030-05-15", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Usme", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Localidad: Usme. Resolución R-D Nº 84183 / actualización Nº 84138. Vigente hasta 2030-05-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3159283512', phone),
      email       = COALESCE('example@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "84183", "resolucion_actualizacion": "84138", "fecha_inicio": "15-05-2025", "fecha_fin": "2030-05-15", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Usme", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-test-club-84183';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3159283512', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB PRUEBA 001  (IDRD-CLUB-club-prueba-001-48138)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-prueba-001-48138';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB PRUEBA 001',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Localidad: Teusaquillo. Resolución R-D Nº 48138 / actualización Nº 491394. Vigente hasta 2030-05-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3159283512',
      'example@gmail.com',
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-prueba-001-48138',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-prueba-001-48138', v_school_id, '{"resolucion_rd": "48138", "resolucion_actualizacion": "491394", "fecha_inicio": "15-05-2025", "fecha_fin": "2030-05-15", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Teusaquillo", "sports": [], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Localidad: Teusaquillo. Resolución R-D Nº 48138 / actualización Nº 491394. Vigente hasta 2030-05-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3159283512', phone),
      email       = COALESCE('example@gmail.com', email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "48138", "resolucion_actualizacion": "491394", "fecha_inicio": "15-05-2025", "fecha_fin": "2030-05-15", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Teusaquillo", "sports": [], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-prueba-001-48138';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3159283512', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO POLAR ACADEMY  (IDRD-CLUB-club-deportivo-polar-academy-379)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-polar-academy-379';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO POLAR ACADEMY',
      'Presidente: ADOLFO RODRIGUEZ VARGAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 379 / actualización Nº 2222. Vigente hasta 2029-04-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3142638537',
      'polarstore7@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-polar-academy-379',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-polar-academy-379', v_school_id, '{"resolucion_rd": "379", "resolucion_actualizacion": "2222", "fecha_inicio": "01-04-2024", "fecha_fin": "2029-04-01", "presidente": "ADOLFO RODRIGUEZ VARGAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ADOLFO RODRIGUEZ VARGAS. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 379 / actualización Nº 2222. Vigente hasta 2029-04-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142638537', phone),
      email       = COALESCE('polarstore7@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "379", "resolucion_actualizacion": "2222", "fecha_inicio": "01-04-2024", "fecha_fin": "2029-04-01", "presidente": "ADOLFO RODRIGUEZ VARGAS", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-polar-academy-379';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3142638537', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PRUEBA JULIO  (IDRD-CLUB-prueba-julio-132813)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-prueba-julio-132813';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PRUEBA JULIO',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Badminton. Localidad: Suba. Resolución R-D Nº 132813 / actualización Nº 41832841. Vigente hasta 2030-07-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3159283512',
      'example@gmail.com',
      ARRAY['Badminton']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'prueba-julio-132813',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-prueba-julio-132813', v_school_id, '{"resolucion_rd": "132813", "resolucion_actualizacion": "41832841", "fecha_inicio": "10-07-2025", "fecha_fin": "2030-07-10", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Suba", "sports": ["Badminton"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Badminton. Localidad: Suba. Resolución R-D Nº 132813 / actualización Nº 41832841. Vigente hasta 2030-07-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3159283512', phone),
      email       = COALESCE('example@gmail.com', email),
      sports      = ARRAY['Badminton']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "132813", "resolucion_actualizacion": "41832841", "fecha_inicio": "10-07-2025", "fecha_fin": "2030-07-10", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Suba", "sports": ["Badminton"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-prueba-julio-132813';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3159283512', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PRUEBA CREACIÃN  (IDRD-CLUB-prueba-creacian-123123)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-prueba-creacian-123123';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PRUEBA CREACIÃN',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Atletismo Intelectual. Localidad: Engativá. Resolución R-D Nº 123123 / actualización Nº 123123. Vigente hasta 2030-07-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3159283512',
      'escueladolphins@hotmail.com',
      ARRAY['Atletismo Intelectual']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'prueba-creacian-123123',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-prueba-creacian-123123', v_school_id, '{"resolucion_rd": "123123", "resolucion_actualizacion": "123123", "fecha_inicio": "10-07-2025", "fecha_fin": "2030-07-10", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Engativá", "sports": ["Atletismo Intelectual"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Atletismo Intelectual. Localidad: Engativá. Resolución R-D Nº 123123 / actualización Nº 123123. Vigente hasta 2030-07-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3159283512', phone),
      email       = COALESCE('escueladolphins@hotmail.com', email),
      sports      = ARRAY['Atletismo Intelectual']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "123123", "resolucion_actualizacion": "123123", "fecha_inicio": "10-07-2025", "fecha_fin": "2030-07-10", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Engativá", "sports": ["Atletismo Intelectual"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-prueba-creacian-123123';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3159283512', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EUROSPORTS  (IDRD-CLUB-club-deportivo-eurosports-619)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-eurosports-619';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EUROSPORTS',
      'Presidente: JIMMY CAR CORREDOR DIAZ. Deporte(s): Remo. Localidad: Bosa. Resolución R-D Nº 619. Vigente hasta 2030-06-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3014878633',
      'euroeyrkayaks@gmail.com',
      ARRAY['Remo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-eurosports-619',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-eurosports-619', v_school_id, '{"resolucion_rd": "619", "resolucion_actualizacion": null, "fecha_inicio": "17-06-2025", "fecha_fin": "2030-06-17", "presidente": "JIMMY CAR CORREDOR DIAZ", "localidad": "Bosa", "sports": ["Remo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JIMMY CAR CORREDOR DIAZ. Deporte(s): Remo. Localidad: Bosa. Resolución R-D Nº 619. Vigente hasta 2030-06-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3014878633', phone),
      email       = COALESCE('euroeyrkayaks@gmail.com', email),
      sports      = ARRAY['Remo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "619", "resolucion_actualizacion": null, "fecha_inicio": "17-06-2025", "fecha_fin": "2030-06-17", "presidente": "JIMMY CAR CORREDOR DIAZ", "localidad": "Bosa", "sports": ["Remo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-eurosports-619';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3014878633', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB PRUEBA 001  (IDRD-CLUB-club-prueba-001-852485)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-prueba-001-852485';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB PRUEBA 001',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Badminton. Localidad: Fontibón. Resolución R-D Nº 852485 / actualización Nº 4818348. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3013088576',
      'escueladolphins@hotmail.com',
      ARRAY['Badminton']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-prueba-001-852485',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-prueba-001-852485', v_school_id, '{"resolucion_rd": "852485", "resolucion_actualizacion": "4818348", "fecha_inicio": "11-08-2025", "fecha_fin": "2030-08-11", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Fontibón", "sports": ["Badminton"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Badminton. Localidad: Fontibón. Resolución R-D Nº 852485 / actualización Nº 4818348. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013088576', phone),
      email       = COALESCE('escueladolphins@hotmail.com', email),
      sports      = ARRAY['Badminton']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "852485", "resolucion_actualizacion": "4818348", "fecha_inicio": "11-08-2025", "fecha_fin": "2030-08-11", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Fontibón", "sports": ["Badminton"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-prueba-001-852485';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3013088576', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB PRUEBA 001  (IDRD-CLUB-club-prueba-001-841832)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-prueba-001-841832';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB PRUEBA 001',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Actividades Subacuaticas. Localidad: Bosa. Resolución R-D Nº 841832 / actualización Nº 84183. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3013088576',
      'escueladolphins@hotmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-prueba-001-841832',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-prueba-001-841832', v_school_id, '{"resolucion_rd": "841832", "resolucion_actualizacion": "84183", "fecha_inicio": "11-08-2025", "fecha_fin": "2030-08-11", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Bosa", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Actividades Subacuaticas. Localidad: Bosa. Resolución R-D Nº 841832 / actualización Nº 84183. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013088576', phone),
      email       = COALESCE('escueladolphins@hotmail.com', email),
      sports      = ARRAY['Actividades Subacuaticas']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "841832", "resolucion_actualizacion": "84183", "fecha_inicio": "11-08-2025", "fecha_fin": "2030-08-11", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Bosa", "sports": ["Actividades Subacuaticas"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-prueba-001-841832';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3013088576', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PRUEBA AGOSTO  (IDRD-CLUB-prueba-agosto-8383)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-prueba-agosto-8383';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PRUEBA AGOSTO',
      'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Balonmano. Localidad: Engativá. Resolución R-D Nº 8383 / actualización Nº 8742734. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3013088576',
      'escueladolphins@hotmail.com',
      ARRAY['Balonmano']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'prueba-agosto-8383',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-prueba-agosto-8383', v_school_id, '{"resolucion_rd": "8383", "resolucion_actualizacion": "8742734", "fecha_inicio": "11-08-2025", "fecha_fin": "2030-08-11", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Engativá", "sports": ["Balonmano"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NESTOR VICENTE VILLAMIL DELGADILLO. Deporte(s): Balonmano. Localidad: Engativá. Resolución R-D Nº 8383 / actualización Nº 8742734. Vigente hasta 2030-08-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013088576', phone),
      email       = COALESCE('escueladolphins@hotmail.com', email),
      sports      = ARRAY['Balonmano']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "8383", "resolucion_actualizacion": "8742734", "fecha_inicio": "11-08-2025", "fecha_fin": "2030-08-11", "presidente": "NESTOR VICENTE VILLAMIL DELGADILLO", "localidad": "Engativá", "sports": ["Balonmano"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-prueba-agosto-8383';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3013088576', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SUEÃO FUTBOL GENESIS  (IDRD-CLUB-club-deportivo-sueao-futbol-genesis-746)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sueao-futbol-genesis-746';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SUEÃO FUTBOL GENESIS',
      'Presidente: ERIQ STEVE ROZO FORERO. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 746. Vigente hasta 2030-07-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3108830405',
      'sfgfutbolgenesis@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sueao-futbol-genesis-746',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sueao-futbol-genesis-746', v_school_id, '{"resolucion_rd": "746", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-21", "fecha_fin": "2030-07-21", "presidente": "ERIQ STEVE ROZO FORERO", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ERIQ STEVE ROZO FORERO. Deporte(s): Fútbol. Localidad: Antonio Nariño. Resolución R-D Nº 746. Vigente hasta 2030-07-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108830405', phone),
      email       = COALESCE('sfgfutbolgenesis@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "746", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-21", "fecha_fin": "2030-07-21", "presidente": "ERIQ STEVE ROZO FORERO", "localidad": "Antonio Nariño", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sueao-futbol-genesis-746';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3108830405', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE PATINAJE DE CARRERAS EF. SKATE  (IDRD-CLUB-club-deportivo-de-patinaje-de-carreras-e-745)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-de-carreras-e-745';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE PATINAJE DE CARRERAS EF. SKATE',
      'Presidente: JUAN MIGUEL CARRILLO MOGOLLON. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 745. Vigente hasta 2030-07-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3244291891',
      'fundacionelitefalcons@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-patinaje-de-carreras-e-745',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-patinaje-de-carreras-e-745', v_school_id, '{"resolucion_rd": "745", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-21", "fecha_fin": "2030-07-21", "presidente": "JUAN MIGUEL CARRILLO MOGOLLON", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN MIGUEL CARRILLO MOGOLLON. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 745. Vigente hasta 2030-07-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3244291891', phone),
      email       = COALESCE('fundacionelitefalcons@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "745", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-21", "fecha_fin": "2030-07-21", "presidente": "JUAN MIGUEL CARRILLO MOGOLLON", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-patinaje-de-carreras-e-745';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3244291891', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO RAIDERS SKATING  (IDRD-CLUB-club-deportivo-raiders-skating-744)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-raiders-skating-744';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO RAIDERS SKATING',
      'Presidente: CRISTIAN DAVID HUESO. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 744. Vigente hasta 2030-07-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3022607358',
      'raidersskating@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-raiders-skating-744',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-raiders-skating-744', v_school_id, '{"resolucion_rd": "744", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-21", "fecha_fin": "2030-07-21", "presidente": "CRISTIAN DAVID HUESO", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN DAVID HUESO. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 744. Vigente hasta 2030-07-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3022607358', phone),
      email       = COALESCE('raidersskating@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "744", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-21", "fecha_fin": "2030-07-21", "presidente": "CRISTIAN DAVID HUESO", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-raiders-skating-744';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3022607358', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CLUB DEPORTIVO EUROSPORTS  (IDRD-CLUB-club-deportivo-club-deportivo-eurosports-619)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-club-deportivo-eurosports-619';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CLUB DEPORTIVO EUROSPORTS',
      'Presidente: JIMMY CAR CORREDOR DIAZ. Deporte(s): Parapowerlifting, Remo, Natación, Ciclismo, Canotaje. Localidad: Bosa. Resolución R-D Nº 619. Vigente hasta 2030-06-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3014878633',
      'euroeyrkayaks@gmail.com',
      ARRAY['Parapowerlifting','Remo','Natación','Ciclismo','Canotaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-club-deportivo-eurosports-619',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-club-deportivo-eurosports-619', v_school_id, '{"resolucion_rd": "619", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-18", "fecha_fin": "2030-06-18", "presidente": "JIMMY CAR CORREDOR DIAZ", "localidad": "Bosa", "sports": ["Parapowerlifting", "Remo", "Natación", "Ciclismo", "Canotaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JIMMY CAR CORREDOR DIAZ. Deporte(s): Parapowerlifting, Remo, Natación, Ciclismo, Canotaje. Localidad: Bosa. Resolución R-D Nº 619. Vigente hasta 2030-06-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3014878633', phone),
      email       = COALESCE('euroeyrkayaks@gmail.com', email),
      sports      = ARRAY['Parapowerlifting','Remo','Natación','Ciclismo','Canotaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "619", "resolucion_actualizacion": null, "fecha_inicio": "2025-06-18", "fecha_fin": "2030-06-18", "presidente": "JIMMY CAR CORREDOR DIAZ", "localidad": "Bosa", "sports": ["Parapowerlifting", "Remo", "Natación", "Ciclismo", "Canotaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-club-deportivo-eurosports-619';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3014878633', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ELEVÃ POLE CLUB  (IDRD-CLUB-club-deportivo-eleva-pole-club-741)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-eleva-pole-club-741';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ELEVÃ POLE CLUB',
      'Presidente: LUZ DARY CHAPARRO CAMARGO. Deporte(s): Pole Sports. Localidad: Fontibón. Resolución R-D Nº 741. Vigente hasta 2030-07-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3167491769',
      'elevepoleclub@gmail.com',
      ARRAY['Pole Sports']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-eleva-pole-club-741',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-eleva-pole-club-741', v_school_id, '{"resolucion_rd": "741", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-17", "fecha_fin": "2030-07-17", "presidente": "LUZ DARY CHAPARRO CAMARGO", "localidad": "Fontibón", "sports": ["Pole Sports"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUZ DARY CHAPARRO CAMARGO. Deporte(s): Pole Sports. Localidad: Fontibón. Resolución R-D Nº 741. Vigente hasta 2030-07-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3167491769', phone),
      email       = COALESCE('elevepoleclub@gmail.com', email),
      sports      = ARRAY['Pole Sports']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "741", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-17", "fecha_fin": "2030-07-17", "presidente": "LUZ DARY CHAPARRO CAMARGO", "localidad": "Fontibón", "sports": ["Pole Sports"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-eleva-pole-club-741';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3167491769', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPORTS STARS BOGOTA  (IDRD-CLUB-club-deportivo-sports-stars-bogota-737)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-sports-stars-bogota-737';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPORTS STARS BOGOTA',
      'Presidente: LUISA FERNANDA VALCARCEL MARIN. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 737. Vigente hasta 2030-07-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3204786926',
      'sports.stars.012@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-sports-stars-bogota-737',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-sports-stars-bogota-737', v_school_id, '{"resolucion_rd": "737", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-17", "fecha_fin": "2030-07-17", "presidente": "LUISA FERNANDA VALCARCEL MARIN", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUISA FERNANDA VALCARCEL MARIN. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 737. Vigente hasta 2030-07-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204786926', phone),
      email       = COALESCE('sports.stars.012@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "737", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-17", "fecha_fin": "2030-07-17", "presidente": "LUISA FERNANDA VALCARCEL MARIN", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-sports-stars-bogota-737';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3204786926', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO KATIOS HOCKEY ICE  (IDRD-CLUB-club-deportivo-katios-hockey-ice-736)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-katios-hockey-ice-736';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO KATIOS HOCKEY ICE',
      'Presidente: FELIPE MENDEZ VARGAS. Deporte(s): Hockey Sobre Hielo. Localidad: Usaquén. Resolución R-D Nº 736. Vigente hasta 2030-07-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3013480079',
      'presidente@katios.net',
      ARRAY['Hockey Sobre Hielo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-katios-hockey-ice-736',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-katios-hockey-ice-736', v_school_id, '{"resolucion_rd": "736", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-17", "fecha_fin": "2030-07-17", "presidente": "FELIPE MENDEZ VARGAS", "localidad": "Usaquén", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FELIPE MENDEZ VARGAS. Deporte(s): Hockey Sobre Hielo. Localidad: Usaquén. Resolución R-D Nº 736. Vigente hasta 2030-07-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013480079', phone),
      email       = COALESCE('presidente@katios.net', email),
      sports      = ARRAY['Hockey Sobre Hielo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "736", "resolucion_actualizacion": null, "fecha_inicio": "2025-07-17", "fecha_fin": "2030-07-17", "presidente": "FELIPE MENDEZ VARGAS", "localidad": "Usaquén", "sports": ["Hockey Sobre Hielo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-katios-hockey-ice-736';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3013480079', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
