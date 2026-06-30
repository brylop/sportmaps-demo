-- ============================================================
-- SPORTMAPS — Clubes IDRD Bogota — Chunk 7/10 (142 clubes)
-- Aplicar en orden. Idempotente (external_ref UNIQUE).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- MUSHUDO  (IDRD-CLUB-mushudo-072)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-mushudo-072';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MUSHUDO',
      'Presidente: JAMES EDWIN VENEGAS JIMENEZ. Deporte(s): Taekwondo. Localidad: San Cristóbal. Resolución R-D Nº 072. Vigente hasta 2028-02-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3188004974',
      'clubdeportivomushudo@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'mushudo-072',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-mushudo-072', v_school_id, '{"resolucion_rd": "072", "resolucion_actualizacion": null, "fecha_inicio": "08-02-2023", "fecha_fin": "2028-02-08", "presidente": "JAMES EDWIN VENEGAS JIMENEZ", "localidad": "San Cristóbal", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAMES EDWIN VENEGAS JIMENEZ. Deporte(s): Taekwondo. Localidad: San Cristóbal. Resolución R-D Nº 072. Vigente hasta 2028-02-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3188004974', phone),
      email       = COALESCE('clubdeportivomushudo@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "072", "resolucion_actualizacion": null, "fecha_inicio": "08-02-2023", "fecha_fin": "2028-02-08", "presidente": "JAMES EDWIN VENEGAS JIMENEZ", "localidad": "San Cristóbal", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-mushudo-072';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3188004974', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE LA FUNDACIÃN DEPORTE CON VALORES perteneciente a la  (IDRD-CLUB-club-deportivo-de-la-fundacian-deporte-c-051)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-la-fundacian-deporte-c-051';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE LA FUNDACIÃN DEPORTE CON VALORES perteneciente a la',
      'Presidente: seÃ±or FERNANDO VELASQUEZ RUEDA. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 051. Vigente hasta 2028-02-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3173394107',
      'fundaciondeporteconvalores@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-la-fundacian-deporte-c-051',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-la-fundacian-deporte-c-051', v_school_id, '{"resolucion_rd": "051", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2023", "fecha_fin": "2028-02-03", "presidente": "seÃ±or FERNANDO VELASQUEZ RUEDA", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: seÃ±or FERNANDO VELASQUEZ RUEDA. Deporte(s): Fútbol. Localidad: Teusaquillo. Resolución R-D Nº 051. Vigente hasta 2028-02-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173394107', phone),
      email       = COALESCE('fundaciondeporteconvalores@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "051", "resolucion_actualizacion": null, "fecha_inicio": "03-02-2023", "fecha_fin": "2028-02-03", "presidente": "seÃ±or FERNANDO VELASQUEZ RUEDA", "localidad": "Teusaquillo", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-la-fundacian-deporte-c-051';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3173394107', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CERRO AZUL PRENDER Y CRECER JUGANDO  (IDRD-CLUB-cerro-azul-prender-y-crecer-jugando-081)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cerro-azul-prender-y-crecer-jugando-081';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CERRO AZUL PRENDER Y CRECER JUGANDO',
      'Presidente: RENE ALEJANDRO GUTIERREZ BORDA. Deporte(s): Fútbol. Localidad: Santa Fe. Resolución R-D Nº 081. Vigente hasta 2028-02-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Santa Fe',
      '3016883273',
      'escueladeportivacerroazul@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cerro-azul-prender-y-crecer-jugando-081',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cerro-azul-prender-y-crecer-jugando-081', v_school_id, '{"resolucion_rd": "081", "resolucion_actualizacion": null, "fecha_inicio": "13-02-2023", "fecha_fin": "2028-02-13", "presidente": "RENE ALEJANDRO GUTIERREZ BORDA", "localidad": "Santa Fe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RENE ALEJANDRO GUTIERREZ BORDA. Deporte(s): Fútbol. Localidad: Santa Fe. Resolución R-D Nº 081. Vigente hasta 2028-02-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3016883273', phone),
      email       = COALESCE('escueladeportivacerroazul@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "081", "resolucion_actualizacion": null, "fecha_inicio": "13-02-2023", "fecha_fin": "2028-02-13", "presidente": "RENE ALEJANDRO GUTIERREZ BORDA", "localidad": "Santa Fe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cerro-azul-prender-y-crecer-jugando-081';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Santa Fe', 'Bogotá', '3016883273', 4.6017892, -74.0791799, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FAST KIDS  (IDRD-CLUB-fast-kids-043)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fast-kids-043';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FAST KIDS',
      'Presidente: YUBELY ANDREA SANCHEZ VERGARA. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 043. Vigente hasta 2028-02-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3212141665',
      'clubdeportivofastkids@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fast-kids-043',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fast-kids-043', v_school_id, '{"resolucion_rd": "043", "resolucion_actualizacion": null, "fecha_inicio": "02-02-2023", "fecha_fin": "2028-02-02", "presidente": "YUBELY ANDREA SANCHEZ VERGARA", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YUBELY ANDREA SANCHEZ VERGARA. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 043. Vigente hasta 2028-02-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212141665', phone),
      email       = COALESCE('clubdeportivofastkids@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "043", "resolucion_actualizacion": null, "fecha_inicio": "02-02-2023", "fecha_fin": "2028-02-02", "presidente": "YUBELY ANDREA SANCHEZ VERGARA", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fast-kids-043';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3212141665', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BEACH TENNIS BOGOTA  (IDRD-CLUB-beach-tennis-bogota-042)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-beach-tennis-bogota-042';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BEACH TENNIS BOGOTA',
      'Presidente: PAULA ANDREA PEREZ MACHADO. Deporte(s): Tenis. Localidad: Usaquén. Resolución R-D Nº 042. Vigente hasta 2028-02-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3243875240',
      'beachtennisbogota@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'beach-tennis-bogota-042',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-beach-tennis-bogota-042', v_school_id, '{"resolucion_rd": "042", "resolucion_actualizacion": null, "fecha_inicio": "10-02-2023", "fecha_fin": "2028-02-10", "presidente": "PAULA ANDREA PEREZ MACHADO", "localidad": "Usaquén", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAULA ANDREA PEREZ MACHADO. Deporte(s): Tenis. Localidad: Usaquén. Resolución R-D Nº 042. Vigente hasta 2028-02-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3243875240', phone),
      email       = COALESCE('beachtennisbogota@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "042", "resolucion_actualizacion": null, "fecha_inicio": "10-02-2023", "fecha_fin": "2028-02-10", "presidente": "PAULA ANDREA PEREZ MACHADO", "localidad": "Usaquén", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-beach-tennis-bogota-042';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3243875240', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GM-SKATEN  (IDRD-CLUB-gm-skaten-097)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gm-skaten-097';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GM-SKATEN',
      'Presidente: DEISSY ALEXANDRA MONTOYA CASTRO. Deporte(s): Patinaje. Localidad: Tunjuelito. Resolución R-D Nº 097. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3202546099',
      'gmskaten.gmskaten@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gm-skaten-097',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gm-skaten-097', v_school_id, '{"resolucion_rd": "097", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "DEISSY ALEXANDRA MONTOYA CASTRO", "localidad": "Tunjuelito", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DEISSY ALEXANDRA MONTOYA CASTRO. Deporte(s): Patinaje. Localidad: Tunjuelito. Resolución R-D Nº 097. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202546099', phone),
      email       = COALESCE('gmskaten.gmskaten@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "097", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "DEISSY ALEXANDRA MONTOYA CASTRO", "localidad": "Tunjuelito", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gm-skaten-097';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3202546099', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BADMINTON EL NOGAL  (IDRD-CLUB-badminton-el-nogal-098)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-badminton-el-nogal-098';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BADMINTON EL NOGAL',
      'Presidente: ANA PAOLA GAMBA BENAVIDES. Deporte(s): Badminton. Localidad: Engativá. Resolución R-D Nº 098. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3013301702',
      'elnogalbogota@gmail.com',
      ARRAY['Badminton']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'badminton-el-nogal-098',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-badminton-el-nogal-098', v_school_id, '{"resolucion_rd": "098", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "ANA PAOLA GAMBA BENAVIDES", "localidad": "Engativá", "sports": ["Badminton"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA PAOLA GAMBA BENAVIDES. Deporte(s): Badminton. Localidad: Engativá. Resolución R-D Nº 098. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013301702', phone),
      email       = COALESCE('elnogalbogota@gmail.com', email),
      sports      = ARRAY['Badminton']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "098", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "ANA PAOLA GAMBA BENAVIDES", "localidad": "Engativá", "sports": ["Badminton"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-badminton-el-nogal-098';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3013301702', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ESCUELA COLOMBIANA DE TRIATLÃN  (IDRD-CLUB-club-deportivo-escuela-colombiana-de-tri-102)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-escuela-colombiana-de-tri-102';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ESCUELA COLOMBIANA DE TRIATLÃN',
      'Presidente: MANUEL IVAN HERNÃNDEZ BENÃTEZ. Deporte(s): Triatlon. Localidad: Engativá. Resolución R-D Nº 102. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3017227842',
      'escuelacoltri@gmail.com',
      ARRAY['Triatlon']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-escuela-colombiana-de-tri-102',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-escuela-colombiana-de-tri-102', v_school_id, '{"resolucion_rd": "102", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "MANUEL IVAN HERNÃNDEZ BENÃTEZ", "localidad": "Engativá", "sports": ["Triatlon"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL IVAN HERNÃNDEZ BENÃTEZ. Deporte(s): Triatlon. Localidad: Engativá. Resolución R-D Nº 102. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3017227842', phone),
      email       = COALESCE('escuelacoltri@gmail.com', email),
      sports      = ARRAY['Triatlon']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "102", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "MANUEL IVAN HERNÃNDEZ BENÃTEZ", "localidad": "Engativá", "sports": ["Triatlon"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-escuela-colombiana-de-tri-102';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3017227842', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO UNIÃN COLOMBIA F.C. perteneciente a la Entidad no Depor  (IDRD-CLUB-club-deportivo-unian-colombia-fc-pertene-104)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-unian-colombia-fc-pertene-104';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO UNIÃN COLOMBIA F.C. perteneciente a la Entidad no Depor',
      'Presidente: WISTON ANDRES IBARGUEN MORENO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 104. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3134918787',
      'union_colombiafc_@yahoo.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-unian-colombia-fc-pertene-104',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-unian-colombia-fc-pertene-104', v_school_id, '{"resolucion_rd": "104", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "WISTON ANDRES IBARGUEN MORENO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WISTON ANDRES IBARGUEN MORENO. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 104. Vigente hasta 2028-02-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134918787', phone),
      email       = COALESCE('union_colombiafc_@yahoo.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "104", "resolucion_actualizacion": null, "fecha_inicio": "16-02-2023", "fecha_fin": "2028-02-16", "presidente": "WISTON ANDRES IBARGUEN MORENO", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-unian-colombia-fc-pertene-104';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3134918787', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- al CLUB DEPORTIVO DE PATINAJE ARTISTICO NEXT GENERATION  (IDRD-CLUB-al-club-deportivo-de-patinaje-artistico--090)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-al-club-deportivo-de-patinaje-artistico--090';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'al CLUB DEPORTIVO DE PATINAJE ARTISTICO NEXT GENERATION',
      'Presidente: MARIA EUGENIA SANABRIA AREVALO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 090. Vigente hasta 2028-02-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3112311559',
      'nextg218@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'al-club-deportivo-de-patinaje-artistico--090',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-al-club-deportivo-de-patinaje-artistico--090', v_school_id, '{"resolucion_rd": "090", "resolucion_actualizacion": null, "fecha_inicio": "13-02-2023", "fecha_fin": "2028-02-13", "presidente": "MARIA EUGENIA SANABRIA AREVALO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA EUGENIA SANABRIA AREVALO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 090. Vigente hasta 2028-02-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112311559', phone),
      email       = COALESCE('nextg218@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "090", "resolucion_actualizacion": null, "fecha_inicio": "13-02-2023", "fecha_fin": "2028-02-13", "presidente": "MARIA EUGENIA SANABRIA AREVALO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-al-club-deportivo-de-patinaje-artistico--090';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3112311559', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ELEPHANTS BASKETBALL CLUB  (IDRD-CLUB-elephants-basketball-club-115)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-elephants-basketball-club-115';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ELEPHANTS BASKETBALL CLUB',
      'Presidente: BILLY ELVIS PEREZ BARRERA. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 115. Vigente hasta 2028-02-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3004603931',
      NULL,
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'elephants-basketball-club-115',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-elephants-basketball-club-115', v_school_id, '{"resolucion_rd": "115", "resolucion_actualizacion": null, "fecha_inicio": "20-02-2023", "fecha_fin": "2028-02-20", "presidente": "BILLY ELVIS PEREZ BARRERA", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BILLY ELVIS PEREZ BARRERA. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 115. Vigente hasta 2028-02-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3004603931', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "115", "resolucion_actualizacion": null, "fecha_inicio": "20-02-2023", "fecha_fin": "2028-02-20", "presidente": "BILLY ELVIS PEREZ BARRERA", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-elephants-basketball-club-115';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3004603931', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA ONDA  (IDRD-CLUB-la-onda-132)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-onda-132';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA ONDA',
      'Presidente: CAMILO ANDRES MATALLANA RUBIO. Deporte(s): Ultimate. Localidad: Los Mártires. Resolución R-D Nº 132. Vigente hasta 2028-02-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Los Mártires',
      '3135605023',
      'camilomatallana@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-onda-132',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-onda-132', v_school_id, '{"resolucion_rd": "132", "resolucion_actualizacion": null, "fecha_inicio": "22-02-2023", "fecha_fin": "2028-02-22", "presidente": "CAMILO ANDRES MATALLANA RUBIO", "localidad": "Los Mártires", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ANDRES MATALLANA RUBIO. Deporte(s): Ultimate. Localidad: Los Mártires. Resolución R-D Nº 132. Vigente hasta 2028-02-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3135605023', phone),
      email       = COALESCE('camilomatallana@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "132", "resolucion_actualizacion": null, "fecha_inicio": "22-02-2023", "fecha_fin": "2028-02-22", "presidente": "CAMILO ANDRES MATALLANA RUBIO", "localidad": "Los Mártires", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-onda-132';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Los Mártires', 'Bogotá', '3135605023', 4.6024664, -74.0846098, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- POWER CYCLING  (IDRD-CLUB-power-cycling-142)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-power-cycling-142';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'POWER CYCLING',
      'Presidente: WILSON ALEXANDER GAITAN ALARCON. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 142. Vigente hasta 2028-02-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3123552630',
      NULL,
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'power-cycling-142',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-power-cycling-142', v_school_id, '{"resolucion_rd": "142", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2023", "fecha_fin": "2028-02-24", "presidente": "WILSON ALEXANDER GAITAN ALARCON", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILSON ALEXANDER GAITAN ALARCON. Deporte(s): Ciclismo. Localidad: Tunjuelito. Resolución R-D Nº 142. Vigente hasta 2028-02-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123552630', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "142", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2023", "fecha_fin": "2028-02-24", "presidente": "WILSON ALEXANDER GAITAN ALARCON", "localidad": "Tunjuelito", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-power-cycling-142';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3123552630', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MISHA BOWLING CLUB BOGOTÃ  (IDRD-CLUB-misha-bowling-club-bogota-150)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-misha-bowling-club-bogota-150';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MISHA BOWLING CLUB BOGOTÃ',
      'Presidente: GUSTAVO ADOLFO SANCHEZ SANDOVAL. Deporte(s): Bowling. Resolución R-D Nº 150. Vigente hasta 2028-02-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3002165210',
      'mishabowlingclubbogota@gmail.com',
      ARRAY['Bowling']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'misha-bowling-club-bogota-150',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-misha-bowling-club-bogota-150', v_school_id, '{"resolucion_rd": "150", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2023", "fecha_fin": "2028-02-24", "presidente": "GUSTAVO ADOLFO SANCHEZ SANDOVAL", "localidad": null, "sports": ["Bowling"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GUSTAVO ADOLFO SANCHEZ SANDOVAL. Deporte(s): Bowling. Resolución R-D Nº 150. Vigente hasta 2028-02-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002165210', phone),
      email       = COALESCE('mishabowlingclubbogota@gmail.com', email),
      sports      = ARRAY['Bowling']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "150", "resolucion_actualizacion": null, "fecha_inicio": "24-02-2023", "fecha_fin": "2028-02-24", "presidente": "GUSTAVO ADOLFO SANCHEZ SANDOVAL", "localidad": null, "sports": ["Bowling"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-misha-bowling-club-bogota-150';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO WASHINGTON BASKETBAL CLUB  (IDRD-CLUB-club-deportivo-washington-basketbal-club-377)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-washington-basketbal-club-377';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO WASHINGTON BASKETBAL CLUB',
      'Presidente: ARCY ARLY PINEDA ORTIZ. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 377. Vigente hasta 2029-04-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '60147518193014603804',
      'baloncestowashintonv@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-washington-basketbal-club-377',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-washington-basketbal-club-377', v_school_id, '{"resolucion_rd": "377", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2024", "fecha_fin": "2029-04-01", "presidente": "ARCY ARLY PINEDA ORTIZ", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ARCY ARLY PINEDA ORTIZ. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 377. Vigente hasta 2029-04-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('60147518193014603804', phone),
      email       = COALESCE('baloncestowashintonv@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "377", "resolucion_actualizacion": null, "fecha_inicio": "01-04-2024", "fecha_fin": "2029-04-01", "presidente": "ARCY ARLY PINEDA ORTIZ", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-washington-basketbal-club-377';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '60147518193014603804', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO IKAROS VOLEYBALL CLUB  (IDRD-CLUB-club-deportivo-ikaros-voleyball-club-189)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ikaros-voleyball-club-189';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO IKAROS VOLEYBALL CLUB',
      'Presidente: ENNY ALEXANDRA DÃAZ LOZANO. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 189. Vigente hasta 2028-03-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3108161585',
      'clubdevoleibolikaros@gmail.com',
      ARRAY['Voleibol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ikaros-voleyball-club-189',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ikaros-voleyball-club-189', v_school_id, '{"resolucion_rd": "189", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2023", "fecha_fin": "2028-03-07", "presidente": "ENNY ALEXANDRA DÃAZ LOZANO", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ENNY ALEXANDRA DÃAZ LOZANO. Deporte(s): Voleibol. Localidad: Bosa. Resolución R-D Nº 189. Vigente hasta 2028-03-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108161585', phone),
      email       = COALESCE('clubdevoleibolikaros@gmail.com', email),
      sports      = ARRAY['Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "189", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2023", "fecha_fin": "2028-03-07", "presidente": "ENNY ALEXANDRA DÃAZ LOZANO", "localidad": "Bosa", "sports": ["Voleibol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ikaros-voleyball-club-189';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3108161585', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA DE TALENTOS FÃTBOL CLUB perteneciente a la ent  (IDRD-CLUB-club-deportivo-academia-de-talentos-fatb-190)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-de-talentos-fatb-190';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA DE TALENTOS FÃTBOL CLUB perteneciente a la ent',
      'Presidente: MIGUEL ANGEL DAZA WILCHES. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 190. Vigente hasta 2028-03-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '2188785',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-de-talentos-fatb-190',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-de-talentos-fatb-190', v_school_id, '{"resolucion_rd": "190", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2023", "fecha_fin": "2028-03-07", "presidente": "MIGUEL ANGEL DAZA WILCHES", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL DAZA WILCHES. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 190. Vigente hasta 2028-03-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2188785', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "190", "resolucion_actualizacion": null, "fecha_inicio": "08-03-2023", "fecha_fin": "2028-03-07", "presidente": "MIGUEL ANGEL DAZA WILCHES", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-de-talentos-fatb-190';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '2188785', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ISADEC CLUB DEPORTIVO Y ARTISTICO perteneciente a la entidad no deport  (IDRD-CLUB-isadec-club-deportivo-y-artistico-perten-119)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-isadec-club-deportivo-y-artistico-perten-119';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ISADEC CLUB DEPORTIVO Y ARTISTICO perteneciente a la entidad no deport',
      'Presidente: AXEL DARLEY LONDOÃO RIAÃO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 119. Vigente hasta 2028-02-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3212058895',
      'informacion@insadec.org',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'isadec-club-deportivo-y-artistico-perten-119',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-isadec-club-deportivo-y-artistico-perten-119', v_school_id, '{"resolucion_rd": "119", "resolucion_actualizacion": null, "fecha_inicio": "20-02-2023", "fecha_fin": "2028-02-20", "presidente": "AXEL DARLEY LONDOÃO RIAÃO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: AXEL DARLEY LONDOÃO RIAÃO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 119. Vigente hasta 2028-02-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212058895', phone),
      email       = COALESCE('informacion@insadec.org', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "119", "resolucion_actualizacion": null, "fecha_inicio": "20-02-2023", "fecha_fin": "2028-02-20", "presidente": "AXEL DARLEY LONDOÃO RIAÃO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-isadec-club-deportivo-y-artistico-perten-119';
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
-- COLUSA CLUB DE FÃTBOL INTERNACIONAL  (IDRD-CLUB-colusa-club-de-fatbol-internacional-201)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-colusa-club-de-fatbol-internacional-201';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COLUSA CLUB DE FÃTBOL INTERNACIONAL',
      'Presidente: LUZ HELENA GONZALEZ MUÃOZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 201. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3118518843',
      'internacionalcolusa@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'colusa-club-de-fatbol-internacional-201',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-colusa-club-de-fatbol-internacional-201', v_school_id, '{"resolucion_rd": "201", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "LUZ HELENA GONZALEZ MUÃOZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUZ HELENA GONZALEZ MUÃOZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 201. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118518843', phone),
      email       = COALESCE('internacionalcolusa@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "201", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "LUZ HELENA GONZALEZ MUÃOZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-colusa-club-de-fatbol-internacional-201';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3118518843', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SUPERCAMPEONES F.C  (IDRD-CLUB-supercampeones-fc-202)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-supercampeones-fc-202';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SUPERCAMPEONES F.C',
      'Presidente: JENNY SUSANA BECERRA MELO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 202. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '2163937',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'supercampeones-fc-202',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-supercampeones-fc-202', v_school_id, '{"resolucion_rd": "202", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "JENNY SUSANA BECERRA MELO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JENNY SUSANA BECERRA MELO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 202. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2163937', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "202", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "JENNY SUSANA BECERRA MELO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-supercampeones-fc-202';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '2163937', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE BALONCESTO LA SAGA  (IDRD-CLUB-club-deportivo-de-baloncesto-la-saga-204)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-la-saga-204';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE BALONCESTO LA SAGA',
      'Presidente: JOHANA LEONOR RODRIGUEZ GONGORA. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 204. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3209845871',
      'jhonvalero@yahoo.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-baloncesto-la-saga-204',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-baloncesto-la-saga-204', v_school_id, '{"resolucion_rd": "204", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "JOHANA LEONOR RODRIGUEZ GONGORA", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHANA LEONOR RODRIGUEZ GONGORA. Deporte(s): Baloncesto. Localidad: Kennedy. Resolución R-D Nº 204. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209845871', phone),
      email       = COALESCE('jhonvalero@yahoo.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "204", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "JOHANA LEONOR RODRIGUEZ GONGORA", "localidad": "Kennedy", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-baloncesto-la-saga-204';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3209845871', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO K-10  (IDRD-CLUB-club-deportivo-k-10-206)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-k-10-206';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO K-10',
      'Presidente: ENRIQUE JOSE MARQUEZ DURAN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 206. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3162786086',
      'barranqui23@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-k-10-206',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-k-10-206', v_school_id, '{"resolucion_rd": "206", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "ENRIQUE JOSE MARQUEZ DURAN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ENRIQUE JOSE MARQUEZ DURAN. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 206. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3162786086', phone),
      email       = COALESCE('barranqui23@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "206", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "ENRIQUE JOSE MARQUEZ DURAN", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-k-10-206';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3162786086', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE AJEDREZ EL CAMINO perteneciente a la Entidad no Depo  (IDRD-CLUB-club-deportivo-de-ajedrez-el-camino-pert-207)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-ajedrez-el-camino-pert-207';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE AJEDREZ EL CAMINO perteneciente a la Entidad no Depo',
      'Presidente: DAVID EDUARDO MORENO GONZALEZ. Deporte(s): Ajedrez. Localidad: Bosa. Resolución R-D Nº 207. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3013930719',
      'entrenadorchess@hotmail.com',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-ajedrez-el-camino-pert-207',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-ajedrez-el-camino-pert-207', v_school_id, '{"resolucion_rd": "207", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "DAVID EDUARDO MORENO GONZALEZ", "localidad": "Bosa", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DAVID EDUARDO MORENO GONZALEZ. Deporte(s): Ajedrez. Localidad: Bosa. Resolución R-D Nº 207. Vigente hasta 2028-03-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3013930719', phone),
      email       = COALESCE('entrenadorchess@hotmail.com', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "207", "resolucion_actualizacion": null, "fecha_inicio": "15-03-2023", "fecha_fin": "2028-03-14", "presidente": "DAVID EDUARDO MORENO GONZALEZ", "localidad": "Bosa", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-ajedrez-el-camino-pert-207';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3013930719', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA UNIÃN FÃTBOL CLUB  (IDRD-CLUB-la-unian-fatbol-club-215)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-unian-fatbol-club-215';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA UNIÃN FÃTBOL CLUB',
      'Presidente: JESUS RODOLFO MORA GUERRERO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 215. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3142039093',
      'unionfutbolclub.col@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-unian-fatbol-club-215',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-unian-fatbol-club-215', v_school_id, '{"resolucion_rd": "215", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "JESUS RODOLFO MORA GUERRERO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JESUS RODOLFO MORA GUERRERO. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 215. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142039093', phone),
      email       = COALESCE('unionfutbolclub.col@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "215", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "JESUS RODOLFO MORA GUERRERO", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-unian-fatbol-club-215';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3142039093', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MAS INFANCIA  (IDRD-CLUB-mas-infancia-216)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-mas-infancia-216';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MAS INFANCIA',
      'Presidente: LIZETH VALENTINA GONZALEZ SANDOVAL. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 216. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3016373132',
      'disof_00@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'mas-infancia-216',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-mas-infancia-216', v_school_id, '{"resolucion_rd": "216", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "LIZETH VALENTINA GONZALEZ SANDOVAL", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LIZETH VALENTINA GONZALEZ SANDOVAL. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 216. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3016373132', phone),
      email       = COALESCE('disof_00@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "216", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "LIZETH VALENTINA GONZALEZ SANDOVAL", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-mas-infancia-216';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3016373132', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- POTROS DORADOS 04 FUTBOL CLUB  (IDRD-CLUB-potros-dorados-04-futbol-club-222)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-potros-dorados-04-futbol-club-222';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'POTROS DORADOS 04 FUTBOL CLUB',
      'Presidente: TOMAS ANTONIO ANDAETA GUTIERREZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 222. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3023972854',
      'potrosdorados04ofocial@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'potros-dorados-04-futbol-club-222',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-potros-dorados-04-futbol-club-222', v_school_id, '{"resolucion_rd": "222", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "TOMAS ANTONIO ANDAETA GUTIERREZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: TOMAS ANTONIO ANDAETA GUTIERREZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 222. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3023972854', phone),
      email       = COALESCE('potrosdorados04ofocial@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "222", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "TOMAS ANTONIO ANDAETA GUTIERREZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-potros-dorados-04-futbol-club-222';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3023972854', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TERRY FOX  (IDRD-CLUB-terry-fox-223)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-terry-fox-223';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TERRY FOX',
      'Presidente: LUIS ANTONIO RINCON ROSAS. Deporte(s): Atletismo. Localidad: Tunjuelito. Resolución R-D Nº 223. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3204528112',
      'culfisalucho611@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'terry-fox-223',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-terry-fox-223', v_school_id, '{"resolucion_rd": "223", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "LUIS ANTONIO RINCON ROSAS", "localidad": "Tunjuelito", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ANTONIO RINCON ROSAS. Deporte(s): Atletismo. Localidad: Tunjuelito. Resolución R-D Nº 223. Vigente hasta 2028-03-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204528112', phone),
      email       = COALESCE('culfisalucho611@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "223", "resolucion_actualizacion": null, "fecha_inicio": "16-03-2023", "fecha_fin": "2028-03-15", "presidente": "LUIS ANTONIO RINCON ROSAS", "localidad": "Tunjuelito", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-terry-fox-223';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3204528112', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SPLENDOR CLUB TENIS DE MESA BOGOTA  (IDRD-CLUB-splendor-club-tenis-de-mesa-bogota-677)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-splendor-club-tenis-de-mesa-bogota-677';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPLENDOR CLUB TENIS DE MESA BOGOTA',
      'Presidente: JULIAN ANDRES CRUZ APONTE. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 677. Vigente hasta 2028-06-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3115140209',
      'splendorclubbogota@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'splendor-club-tenis-de-mesa-bogota-677',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-splendor-club-tenis-de-mesa-bogota-677', v_school_id, '{"resolucion_rd": "677", "resolucion_actualizacion": null, "fecha_inicio": "23-06-2023", "fecha_fin": "2028-06-22", "presidente": "JULIAN ANDRES CRUZ APONTE", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JULIAN ANDRES CRUZ APONTE. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 677. Vigente hasta 2028-06-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115140209', phone),
      email       = COALESCE('splendorclubbogota@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "677", "resolucion_actualizacion": null, "fecha_inicio": "23-06-2023", "fecha_fin": "2028-06-22", "presidente": "JULIAN ANDRES CRUZ APONTE", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-splendor-club-tenis-de-mesa-bogota-677';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3115140209', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LUDIKA CLUB  (IDRD-CLUB-ludika-club-1430)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ludika-club-1430';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LUDIKA CLUB',
      'Presidente: CARLOS ALBERTO GUTIERREZ PACHECO. Deporte(s): Ajedrez. Localidad: Barrios Unidos. Resolución R-D Nº 1430. Vigente hasta 2027-10-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3184151967',
      'carlos.gutierrez.ludika@gmail.com',
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ludika-club-1430',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ludika-club-1430', v_school_id, '{"resolucion_rd": "1430", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2022", "fecha_fin": "2027-10-25", "presidente": "CARLOS ALBERTO GUTIERREZ PACHECO", "localidad": "Barrios Unidos", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALBERTO GUTIERREZ PACHECO. Deporte(s): Ajedrez. Localidad: Barrios Unidos. Resolución R-D Nº 1430. Vigente hasta 2027-10-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3184151967', phone),
      email       = COALESCE('carlos.gutierrez.ludika@gmail.com', email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1430", "resolucion_actualizacion": null, "fecha_inicio": "25-10-2022", "fecha_fin": "2027-10-25", "presidente": "CARLOS ALBERTO GUTIERREZ PACHECO", "localidad": "Barrios Unidos", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ludika-club-1430';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3184151967', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LOTOS ALL STARS  (IDRD-CLUB-club-deportivo-lotos-all-stars-1314)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-lotos-all-stars-1314';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LOTOS ALL STARS',
      'Presidente: DIANA CAROLINA DIAZ ROMERO. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 1314. Vigente hasta 2029-09-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3134038044',
      'lotosallstars@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-lotos-all-stars-1314',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-lotos-all-stars-1314', v_school_id, '{"resolucion_rd": "1314", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2024", "fecha_fin": "2029-09-23", "presidente": "DIANA CAROLINA DIAZ ROMERO", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA CAROLINA DIAZ ROMERO. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 1314. Vigente hasta 2029-09-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134038044', phone),
      email       = COALESCE('lotosallstars@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1314", "resolucion_actualizacion": null, "fecha_inicio": "23-09-2024", "fecha_fin": "2029-09-23", "presidente": "DIANA CAROLINA DIAZ ROMERO", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-lotos-all-stars-1314';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3134038044', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CBA BASKETBALL  (IDRD-CLUB-club-deportivo-cba-basketball-228)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cba-basketball-228';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CBA BASKETBALL',
      'Presidente: MANUEL GUILLERMO MERA QUICENO. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 228. Vigente hasta 2028-03-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3209455722',
      'clubdeportivobasketball@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cba-basketball-228',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cba-basketball-228', v_school_id, '{"resolucion_rd": "228", "resolucion_actualizacion": null, "fecha_inicio": "20-03-2023", "fecha_fin": "2028-03-19", "presidente": "MANUEL GUILLERMO MERA QUICENO", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL GUILLERMO MERA QUICENO. Deporte(s): Baloncesto. Localidad: Usme. Resolución R-D Nº 228. Vigente hasta 2028-03-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209455722', phone),
      email       = COALESCE('clubdeportivobasketball@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "228", "resolucion_actualizacion": null, "fecha_inicio": "20-03-2023", "fecha_fin": "2028-03-19", "presidente": "MANUEL GUILLERMO MERA QUICENO", "localidad": "Usme", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cba-basketball-228';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3209455722', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO EMPRESARIAL SAUZALITO  (IDRD-CLUB-club-deportivo-empresarial-sauzalito-030)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-empresarial-sauzalito-030';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO EMPRESARIAL SAUZALITO',
      'Presidente: JOSE LUIS CORTES ARBELAEZ. Deporte(s): Taekwondo, Patinaje, Fútbol, Tenis, Natación. Localidad: Fontibón. Resolución R-D Nº 030 / actualización Nº 030. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3104831922',
      'escuelasauzalito@gmail.com',
      ARRAY['Taekwondo','Patinaje','Fútbol','Tenis','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-empresarial-sauzalito-030',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-empresarial-sauzalito-030', v_school_id, '{"resolucion_rd": "030", "resolucion_actualizacion": "030", "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JOSE LUIS CORTES ARBELAEZ", "localidad": "Fontibón", "sports": ["Taekwondo", "Patinaje", "Fútbol", "Tenis", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS CORTES ARBELAEZ. Deporte(s): Taekwondo, Patinaje, Fútbol, Tenis, Natación. Localidad: Fontibón. Resolución R-D Nº 030 / actualización Nº 030. Vigente hasta 2030-01-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3104831922', phone),
      email       = COALESCE('escuelasauzalito@gmail.com', email),
      sports      = ARRAY['Taekwondo','Patinaje','Fútbol','Tenis','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "030", "resolucion_actualizacion": "030", "fecha_inicio": "30-01-2025", "fecha_fin": "2030-01-30", "presidente": "JOSE LUIS CORTES ARBELAEZ", "localidad": "Fontibón", "sports": ["Taekwondo", "Patinaje", "Fútbol", "Tenis", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-empresarial-sauzalito-030';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3104831922', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BOGOTÃ SKATEBOARDING CLUB  (IDRD-CLUB-bogota-skateboarding-club-277)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bogota-skateboarding-club-277';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOGOTÃ SKATEBOARDING CLUB',
      'Presidente: DALLANI ARNALDO RODRIGUEZ ORTIZ. Deporte(s): Skateboarding. Localidad: Kennedy. Resolución R-D Nº 277. Vigente hasta 2028-03-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3202285149',
      'dallarodriguez@outlook.com',
      ARRAY['Skateboarding']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bogota-skateboarding-club-277',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bogota-skateboarding-club-277', v_school_id, '{"resolucion_rd": "277", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2023", "fecha_fin": "2028-03-28", "presidente": "DALLANI ARNALDO RODRIGUEZ ORTIZ", "localidad": "Kennedy", "sports": ["Skateboarding"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DALLANI ARNALDO RODRIGUEZ ORTIZ. Deporte(s): Skateboarding. Localidad: Kennedy. Resolución R-D Nº 277. Vigente hasta 2028-03-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202285149', phone),
      email       = COALESCE('dallarodriguez@outlook.com', email),
      sports      = ARRAY['Skateboarding']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "277", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2023", "fecha_fin": "2028-03-28", "presidente": "DALLANI ARNALDO RODRIGUEZ ORTIZ", "localidad": "Kennedy", "sports": ["Skateboarding"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bogota-skateboarding-club-277';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3202285149', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BAILAYA-FSDâ  (IDRD-CLUB-bailaya-fsda-276)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bailaya-fsda-276';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BAILAYA-FSDâ',
      'Presidente: CHERYL LYNN CONTRERAS LARA. Deporte(s): Baile Deportivo. Localidad: Tunjuelito. Resolución R-D Nº 276. Vigente hasta 2028-03-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3127227141',
      'bailayafsd@yahoo.com',
      ARRAY['Baile Deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bailaya-fsda-276',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bailaya-fsda-276', v_school_id, '{"resolucion_rd": "276", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2023", "fecha_fin": "2028-03-28", "presidente": "CHERYL LYNN CONTRERAS LARA", "localidad": "Tunjuelito", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CHERYL LYNN CONTRERAS LARA. Deporte(s): Baile Deportivo. Localidad: Tunjuelito. Resolución R-D Nº 276. Vigente hasta 2028-03-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3127227141', phone),
      email       = COALESCE('bailayafsd@yahoo.com', email),
      sports      = ARRAY['Baile Deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "276", "resolucion_actualizacion": null, "fecha_inicio": "29-03-2023", "fecha_fin": "2028-03-28", "presidente": "CHERYL LYNN CONTRERAS LARA", "localidad": "Tunjuelito", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bailaya-fsda-276';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3127227141', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BLUE SEALS  (IDRD-CLUB-blue-seals-282)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-blue-seals-282';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BLUE SEALS',
      'Presidente: ALEJANDRO RODRIGUEZ TRIVIÃO. Deporte(s): Natación. Localidad: Fontibón. Resolución R-D Nº 282. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3043773142',
      NULL,
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'blue-seals-282',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-blue-seals-282', v_school_id, '{"resolucion_rd": "282", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "ALEJANDRO RODRIGUEZ TRIVIÃO", "localidad": "Fontibón", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALEJANDRO RODRIGUEZ TRIVIÃO. Deporte(s): Natación. Localidad: Fontibón. Resolución R-D Nº 282. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043773142', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "282", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "ALEJANDRO RODRIGUEZ TRIVIÃO", "localidad": "Fontibón", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-blue-seals-282';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3043773142', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ZÃMAN FUTBOL CLUB  (IDRD-CLUB-zaman-futbol-club-284)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-zaman-futbol-club-284';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ZÃMAN FUTBOL CLUB',
      'Presidente: DIEGO ARMANDO BASTO RENGIFO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 284. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '7440365',
      'dbasto@zamanfc.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'zaman-futbol-club-284',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-zaman-futbol-club-284', v_school_id, '{"resolucion_rd": "284", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "DIEGO ARMANDO BASTO RENGIFO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ARMANDO BASTO RENGIFO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 284. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7440365', phone),
      email       = COALESCE('dbasto@zamanfc.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "284", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "DIEGO ARMANDO BASTO RENGIFO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-zaman-futbol-club-284';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '7440365', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BALONCESTO CELTAS BOGOTÃ CBC  (IDRD-CLUB-baloncesto-celtas-bogota-cbc-288)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-baloncesto-celtas-bogota-cbc-288';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BALONCESTO CELTAS BOGOTÃ CBC',
      'Presidente: JEISON EDEN SUAREZ QUIMBAYA. Deporte(s): Baloncesto. Localidad: Antonio Nariño. Resolución R-D Nº 288. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3168209569',
      'celtasbasketballclub@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'baloncesto-celtas-bogota-cbc-288',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-baloncesto-celtas-bogota-cbc-288', v_school_id, '{"resolucion_rd": "288", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "JEISON EDEN SUAREZ QUIMBAYA", "localidad": "Antonio Nariño", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JEISON EDEN SUAREZ QUIMBAYA. Deporte(s): Baloncesto. Localidad: Antonio Nariño. Resolución R-D Nº 288. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3168209569', phone),
      email       = COALESCE('celtasbasketballclub@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "288", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "JEISON EDEN SUAREZ QUIMBAYA", "localidad": "Antonio Nariño", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-baloncesto-celtas-bogota-cbc-288';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3168209569', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PANTHER SKATE BOGOTA  (IDRD-CLUB-panther-skate-bogota-286)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-panther-skate-bogota-286';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PANTHER SKATE BOGOTA',
      'Presidente: MIGUEL ANGEL SANCHEZ PEDRAZA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 286. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3212891521',
      'panther.skate1@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'panther-skate-bogota-286',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-panther-skate-bogota-286', v_school_id, '{"resolucion_rd": "286", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "MIGUEL ANGEL SANCHEZ PEDRAZA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL SANCHEZ PEDRAZA. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 286. Vigente hasta 2028-03-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212891521', phone),
      email       = COALESCE('panther.skate1@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "286", "resolucion_actualizacion": null, "fecha_inicio": "31-03-2023", "fecha_fin": "2028-03-30", "presidente": "MIGUEL ANGEL SANCHEZ PEDRAZA", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-panther-skate-bogota-286';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3212891521', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DISTRITO CAPITAL AMARILLO Y NEGRO  (IDRD-CLUB-distrito-capital-amarillo-y-negro-309)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-distrito-capital-amarillo-y-negro-309';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DISTRITO CAPITAL AMARILLO Y NEGRO',
      'Presidente: FELIPE MEDINA MATAMOROS. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 309. Vigente hasta 2028-04-10. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3012987629',
      'clubdeportivodistritocapital@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'distrito-capital-amarillo-y-negro-309',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-distrito-capital-amarillo-y-negro-309', v_school_id, '{"resolucion_rd": "309", "resolucion_actualizacion": null, "fecha_inicio": "11-04-2023", "fecha_fin": "2028-04-10", "presidente": "FELIPE MEDINA MATAMOROS", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FELIPE MEDINA MATAMOROS. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 309. Vigente hasta 2028-04-10. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012987629', phone),
      email       = COALESCE('clubdeportivodistritocapital@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "309", "resolucion_actualizacion": null, "fecha_inicio": "11-04-2023", "fecha_fin": "2028-04-10", "presidente": "FELIPE MEDINA MATAMOROS", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-distrito-capital-amarillo-y-negro-309';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3012987629', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SHAZAM  (IDRD-CLUB-shazam-318)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-shazam-318';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SHAZAM',
      'Presidente: YURY TATIANA RODRIGUEZ COTRINA. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 318. Vigente hasta 2028-04-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3144090165',
      'f.p.s.zhazan@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'shazam-318',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-shazam-318', v_school_id, '{"resolucion_rd": "318", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2023", "fecha_fin": "2028-04-11", "presidente": "YURY TATIANA RODRIGUEZ COTRINA", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YURY TATIANA RODRIGUEZ COTRINA. Deporte(s): Patinaje. Localidad: Bosa. Resolución R-D Nº 318. Vigente hasta 2028-04-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144090165', phone),
      email       = COALESCE('f.p.s.zhazan@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "318", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2023", "fecha_fin": "2028-04-11", "presidente": "YURY TATIANA RODRIGUEZ COTRINA", "localidad": "Bosa", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-shazam-318';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3144090165', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATFUTSALCO  (IDRD-CLUB-atfutsalco-320)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atfutsalco-320';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATFUTSALCO',
      'Presidente: JOHAN SEBASTIAN CAPERA PRIETO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 320. Vigente hasta 2028-04-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3142670217',
      'sebasprieto17@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atfutsalco-320',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atfutsalco-320', v_school_id, '{"resolucion_rd": "320", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2023", "fecha_fin": "2028-04-11", "presidente": "JOHAN SEBASTIAN CAPERA PRIETO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHAN SEBASTIAN CAPERA PRIETO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 320. Vigente hasta 2028-04-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142670217', phone),
      email       = COALESCE('sebasprieto17@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "320", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2023", "fecha_fin": "2028-04-11", "presidente": "JOHAN SEBASTIAN CAPERA PRIETO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atfutsalco-320';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3142670217', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TAEKWONDO KUMGANG  (IDRD-CLUB-taekwondo-kumgang-317)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taekwondo-kumgang-317';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEKWONDO KUMGANG',
      'Presidente: MARTHA ESPERANZA CUBIDES AMAYA. Deporte(s): Taekwondo. Localidad: Antonio Nariño. Resolución R-D Nº 317. Vigente hasta 2028-04-11. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3107762017',
      'clubtkdkumgang@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taekwondo-kumgang-317',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taekwondo-kumgang-317', v_school_id, '{"resolucion_rd": "317", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2023", "fecha_fin": "2028-04-11", "presidente": "MARTHA ESPERANZA CUBIDES AMAYA", "localidad": "Antonio Nariño", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARTHA ESPERANZA CUBIDES AMAYA. Deporte(s): Taekwondo. Localidad: Antonio Nariño. Resolución R-D Nº 317. Vigente hasta 2028-04-11. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107762017', phone),
      email       = COALESCE('clubtkdkumgang@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "317", "resolucion_actualizacion": null, "fecha_inicio": "12-04-2023", "fecha_fin": "2028-04-11", "presidente": "MARTHA ESPERANZA CUBIDES AMAYA", "localidad": "Antonio Nariño", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taekwondo-kumgang-317';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3107762017', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JAGUAR MUAY THAI  (IDRD-CLUB-jaguar-muay-thai-348)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-jaguar-muay-thai-348';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JAGUAR MUAY THAI',
      'Presidente: ANDRÃS FELIPE DÃVILA YEPES. Deporte(s): Boxeo. Localidad: Chapinero. Resolución R-D Nº 348. Vigente hasta 2028-04-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3227628103',
      'jaguar.rzmuaythai@gmail.com',
      ARRAY['Boxeo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'jaguar-muay-thai-348',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-jaguar-muay-thai-348', v_school_id, '{"resolucion_rd": "348", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2023", "fecha_fin": "2028-04-23", "presidente": "ANDRÃS FELIPE DÃVILA YEPES", "localidad": "Chapinero", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRÃS FELIPE DÃVILA YEPES. Deporte(s): Boxeo. Localidad: Chapinero. Resolución R-D Nº 348. Vigente hasta 2028-04-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3227628103', phone),
      email       = COALESCE('jaguar.rzmuaythai@gmail.com', email),
      sports      = ARRAY['Boxeo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "348", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2023", "fecha_fin": "2028-04-23", "presidente": "ANDRÃS FELIPE DÃVILA YEPES", "localidad": "Chapinero", "sports": ["Boxeo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-jaguar-muay-thai-348';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3227628103', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RUSSI BIKE TEAM  (IDRD-CLUB-russi-bike-team-358)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-russi-bike-team-358';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RUSSI BIKE TEAM',
      'Presidente: MARIO OSWALDO TOVAR BOHORQUEZ. Deporte(s): Ciclismo. Localidad: Barrios Unidos. Resolución R-D Nº 358. Vigente hasta 2028-04-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3112943835',
      NULL,
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'russi-bike-team-358',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-russi-bike-team-358', v_school_id, '{"resolucion_rd": "358", "resolucion_actualizacion": null, "fecha_inicio": "25-04-2023", "fecha_fin": "2028-04-24", "presidente": "MARIO OSWALDO TOVAR BOHORQUEZ", "localidad": "Barrios Unidos", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIO OSWALDO TOVAR BOHORQUEZ. Deporte(s): Ciclismo. Localidad: Barrios Unidos. Resolución R-D Nº 358. Vigente hasta 2028-04-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112943835', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "358", "resolucion_actualizacion": null, "fecha_inicio": "25-04-2023", "fecha_fin": "2028-04-24", "presidente": "MARIO OSWALDO TOVAR BOHORQUEZ", "localidad": "Barrios Unidos", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-russi-bike-team-358';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3112943835', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SPORTING MSâ  (IDRD-CLUB-sporting-msa-349)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-sporting-msa-349';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SPORTING MSâ',
      'Presidente: MARIA DEL PILAR SINTI HERNANDEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 349. Vigente hasta 2028-04-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3118963799',
      'pilarsinti01@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'sporting-msa-349',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-sporting-msa-349', v_school_id, '{"resolucion_rd": "349", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2023", "fecha_fin": "2028-04-23", "presidente": "MARIA DEL PILAR SINTI HERNANDEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA DEL PILAR SINTI HERNANDEZ. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 349. Vigente hasta 2028-04-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118963799', phone),
      email       = COALESCE('pilarsinti01@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "349", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2023", "fecha_fin": "2028-04-23", "presidente": "MARIA DEL PILAR SINTI HERNANDEZ", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-sporting-msa-349';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3118963799', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VALHALA FÃTBOL CLUB  (IDRD-CLUB-valhala-fatbol-club-352)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-valhala-fatbol-club-352';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VALHALA FÃTBOL CLUB',
      'Presidente: CRISTIAN FELIPE CRUZ ACOSTA. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 352. Vigente hasta 2028-04-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3118771806',
      'valhalafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'valhala-fatbol-club-352',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-valhala-fatbol-club-352', v_school_id, '{"resolucion_rd": "352", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2023", "fecha_fin": "2028-04-23", "presidente": "CRISTIAN FELIPE CRUZ ACOSTA", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTIAN FELIPE CRUZ ACOSTA. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 352. Vigente hasta 2028-04-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118771806', phone),
      email       = COALESCE('valhalafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "352", "resolucion_actualizacion": null, "fecha_inicio": "24-04-2023", "fecha_fin": "2028-04-23", "presidente": "CRISTIAN FELIPE CRUZ ACOSTA", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-valhala-fatbol-club-352';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3118771806', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ACADEMIA SABANA 3A,  (IDRD-CLUB-club-deportivo-academia-sabana-3a-418)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-sabana-3a-418';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ACADEMIA SABANA 3A,',
      'Presidente: FREYSER ANTONIO MENA RENTERIA. Deporte(s): Baloncesto, Fútbol, Natación. Localidad: Puente Aranda. Resolución R-D Nº 418 / actualización Nº 418. Vigente hasta 2028-04-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3054830058',
      'administracion@academia3a.com.co',
      ARRAY['Baloncesto','Fútbol','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-academia-sabana-3a-418',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-academia-sabana-3a-418', v_school_id, '{"resolucion_rd": "418", "resolucion_actualizacion": "418", "fecha_inicio": "25-04-2023", "fecha_fin": "2028-04-24", "presidente": "FREYSER ANTONIO MENA RENTERIA", "localidad": "Puente Aranda", "sports": ["Baloncesto", "Fútbol", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FREYSER ANTONIO MENA RENTERIA. Deporte(s): Baloncesto, Fútbol, Natación. Localidad: Puente Aranda. Resolución R-D Nº 418 / actualización Nº 418. Vigente hasta 2028-04-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3054830058', phone),
      email       = COALESCE('administracion@academia3a.com.co', email),
      sports      = ARRAY['Baloncesto','Fútbol','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "418", "resolucion_actualizacion": "418", "fecha_inicio": "25-04-2023", "fecha_fin": "2028-04-24", "presidente": "FREYSER ANTONIO MENA RENTERIA", "localidad": "Puente Aranda", "sports": ["Baloncesto", "Fútbol", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-academia-sabana-3a-418';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3054830058', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KOREAN KI TAEKWONDO CLUB  (IDRD-CLUB-korean-ki-taekwondo-club-385)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-korean-ki-taekwondo-club-385';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KOREAN KI TAEKWONDO CLUB',
      'Presidente: JOHN FRANKLIN MACHADO MORALES. Deporte(s): Taekwondo. Localidad: Barrios Unidos. Resolución R-D Nº 385. Vigente hasta 2028-04-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3173776418',
      'koreanki.tkdcolombia@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'korean-ki-taekwondo-club-385',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-korean-ki-taekwondo-club-385', v_school_id, '{"resolucion_rd": "385", "resolucion_actualizacion": null, "fecha_inicio": "01-05-2023", "fecha_fin": "2028-04-30", "presidente": "JOHN FRANKLIN MACHADO MORALES", "localidad": "Barrios Unidos", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN FRANKLIN MACHADO MORALES. Deporte(s): Taekwondo. Localidad: Barrios Unidos. Resolución R-D Nº 385. Vigente hasta 2028-04-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3173776418', phone),
      email       = COALESCE('koreanki.tkdcolombia@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "385", "resolucion_actualizacion": null, "fecha_inicio": "01-05-2023", "fecha_fin": "2028-04-30", "presidente": "JOHN FRANKLIN MACHADO MORALES", "localidad": "Barrios Unidos", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-korean-ki-taekwondo-club-385';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3173776418', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BULLDOGâS D.C  (IDRD-CLUB-bulldogas-dc-386)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bulldogas-dc-386';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BULLDOGâS D.C',
      'Presidente: GERMAN DAVID SASTOQUE LINARES. Deporte(s): Football Americano. Localidad: Bosa. Resolución R-D Nº 386. Vigente hasta 2028-04-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3028655585',
      'bulldogsdc2021@gmail.com',
      ARRAY['Football Americano']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bulldogas-dc-386',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bulldogas-dc-386', v_school_id, '{"resolucion_rd": "386", "resolucion_actualizacion": null, "fecha_inicio": "01-05-2023", "fecha_fin": "2028-04-30", "presidente": "GERMAN DAVID SASTOQUE LINARES", "localidad": "Bosa", "sports": ["Football Americano"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GERMAN DAVID SASTOQUE LINARES. Deporte(s): Football Americano. Localidad: Bosa. Resolución R-D Nº 386. Vigente hasta 2028-04-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3028655585', phone),
      email       = COALESCE('bulldogsdc2021@gmail.com', email),
      sports      = ARRAY['Football Americano']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "386", "resolucion_actualizacion": null, "fecha_inicio": "01-05-2023", "fecha_fin": "2028-04-30", "presidente": "GERMAN DAVID SASTOQUE LINARES", "localidad": "Bosa", "sports": ["Football Americano"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bulldogas-dc-386';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3028655585', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RIAÃO TENNIS CLUB  (IDRD-CLUB-riaao-tennis-club-387)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-riaao-tennis-club-387';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RIAÃO TENNIS CLUB',
      'Presidente: JASON DAVID RIAÃO MARTÃNEZ. Deporte(s): Tenis. Localidad: Kennedy. Resolución R-D Nº 387. Vigente hasta 2028-05-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3124573986',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'riaao-tennis-club-387',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-riaao-tennis-club-387', v_school_id, '{"resolucion_rd": "387", "resolucion_actualizacion": null, "fecha_inicio": "02-05-2023", "fecha_fin": "2028-05-01", "presidente": "JASON DAVID RIAÃO MARTÃNEZ", "localidad": "Kennedy", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JASON DAVID RIAÃO MARTÃNEZ. Deporte(s): Tenis. Localidad: Kennedy. Resolución R-D Nº 387. Vigente hasta 2028-05-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124573986', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "387", "resolucion_actualizacion": null, "fecha_inicio": "02-05-2023", "fecha_fin": "2028-05-01", "presidente": "JASON DAVID RIAÃO MARTÃNEZ", "localidad": "Kennedy", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-riaao-tennis-club-387';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3124573986', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETISMO FENNIX SPORT  (IDRD-CLUB-atletismo-fennix-sport-403)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletismo-fennix-sport-403';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETISMO FENNIX SPORT',
      'Presidente: MARCELA CUESTA CAICEDO. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 403. Vigente hasta 2028-05-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3117499127',
      'clubdeatletismofenix@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletismo-fennix-sport-403',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletismo-fennix-sport-403', v_school_id, '{"resolucion_rd": "403", "resolucion_actualizacion": null, "fecha_inicio": "03-05-2023", "fecha_fin": "2028-05-02", "presidente": "MARCELA CUESTA CAICEDO", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARCELA CUESTA CAICEDO. Deporte(s): Atletismo. Localidad: Engativá. Resolución R-D Nº 403. Vigente hasta 2028-05-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3117499127', phone),
      email       = COALESCE('clubdeatletismofenix@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "403", "resolucion_actualizacion": null, "fecha_inicio": "03-05-2023", "fecha_fin": "2028-05-02", "presidente": "MARCELA CUESTA CAICEDO", "localidad": "Engativá", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletismo-fennix-sport-403';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3117499127', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- AGUILAS GONZALEZ F.C.  (IDRD-CLUB-aguilas-gonzalez-fc-402)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-aguilas-gonzalez-fc-402';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'AGUILAS GONZALEZ F.C.',
      'Presidente: MONICA MARIA GONZALEZ FLOREZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 402. Vigente hasta 2028-05-02. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3164183845',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'aguilas-gonzalez-fc-402',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-aguilas-gonzalez-fc-402', v_school_id, '{"resolucion_rd": "402", "resolucion_actualizacion": null, "fecha_inicio": "03-05-2023", "fecha_fin": "2028-05-02", "presidente": "MONICA MARIA GONZALEZ FLOREZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MONICA MARIA GONZALEZ FLOREZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 402. Vigente hasta 2028-05-02. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3164183845', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "402", "resolucion_actualizacion": null, "fecha_inicio": "03-05-2023", "fecha_fin": "2028-05-02", "presidente": "MONICA MARIA GONZALEZ FLOREZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-aguilas-gonzalez-fc-402';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3164183845', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FRAPON BOGOTÃ perteneciente a la entidad no deportiva FRATERNIDAD DE P  (IDRD-CLUB-frapon-bogota-perteneciente-a-la-entidad-419)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-frapon-bogota-perteneciente-a-la-entidad-419';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FRAPON BOGOTÃ perteneciente a la entidad no deportiva FRATERNIDAD DE P',
      'Presidente: DIEGO MARTINEZ RONDERO. Deporte(s): Discapacidad Fã­Sica. Localidad: Fontibón. Resolución R-D Nº 419. Vigente hasta 2028-05-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '2853534',
      'informacion@frapon.org-presidencia',
      ARRAY['Discapacidad Fã­Sica']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'frapon-bogota-perteneciente-a-la-entidad-419',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-frapon-bogota-perteneciente-a-la-entidad-419', v_school_id, '{"resolucion_rd": "419", "resolucion_actualizacion": null, "fecha_inicio": "10-05-2023", "fecha_fin": "2028-05-09", "presidente": "DIEGO MARTINEZ RONDERO", "localidad": "Fontibón", "sports": ["Discapacidad Fã­Sica"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO MARTINEZ RONDERO. Deporte(s): Discapacidad Fã­Sica. Localidad: Fontibón. Resolución R-D Nº 419. Vigente hasta 2028-05-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2853534', phone),
      email       = COALESCE('informacion@frapon.org-presidencia', email),
      sports      = ARRAY['Discapacidad Fã­Sica']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "419", "resolucion_actualizacion": null, "fecha_inicio": "10-05-2023", "fecha_fin": "2028-05-09", "presidente": "DIEGO MARTINEZ RONDERO", "localidad": "Fontibón", "sports": ["Discapacidad Fã­Sica"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-frapon-bogota-perteneciente-a-la-entidad-419';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '2853534', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- IKAROS BASKETBALL  (IDRD-CLUB-ikaros-basketball-422)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ikaros-basketball-422';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'IKAROS BASKETBALL',
      'Presidente: DEIVID HARLEY URREA LOPEZ. Deporte(s): Baloncesto. Localidad: Bosa. Resolución R-D Nº 422. Vigente hasta 2028-05-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3108156202',
      NULL,
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ikaros-basketball-422',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ikaros-basketball-422', v_school_id, '{"resolucion_rd": "422", "resolucion_actualizacion": null, "fecha_inicio": "08-05-2023", "fecha_fin": "2028-05-07", "presidente": "DEIVID HARLEY URREA LOPEZ", "localidad": "Bosa", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DEIVID HARLEY URREA LOPEZ. Deporte(s): Baloncesto. Localidad: Bosa. Resolución R-D Nº 422. Vigente hasta 2028-05-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3108156202', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "422", "resolucion_actualizacion": null, "fecha_inicio": "08-05-2023", "fecha_fin": "2028-05-07", "presidente": "DEIVID HARLEY URREA LOPEZ", "localidad": "Bosa", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ikaros-basketball-422';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3108156202', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ACADEMIA DE VOLEIBOL ALSACIA - AVA  (IDRD-CLUB-academia-de-voleibol-alsacia---ava-420)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-academia-de-voleibol-alsacia---ava-420';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ACADEMIA DE VOLEIBOL ALSACIA - AVA',
      'Presidente: EDISSON EDUARDO SERNA UPEGUI. Resolución R-D Nº 420. Vigente hasta 2028-05-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3203660880',
      NULL,
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'academia-de-voleibol-alsacia---ava-420',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-academia-de-voleibol-alsacia---ava-420', v_school_id, '{"resolucion_rd": "420", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2023", "fecha_fin": "2028-05-08", "presidente": "EDISSON EDUARDO SERNA UPEGUI", "localidad": null, "sports": [], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDISSON EDUARDO SERNA UPEGUI. Resolución R-D Nº 420. Vigente hasta 2028-05-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203660880', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "420", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2023", "fecha_fin": "2028-05-08", "presidente": "EDISSON EDUARDO SERNA UPEGUI", "localidad": null, "sports": [], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-academia-de-voleibol-alsacia---ava-420';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ACADEMIA DE VOLEIBOL ALSACIA - AVA  (IDRD-CLUB-academia-de-voleibol-alsacia---ava-420-2)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-academia-de-voleibol-alsacia---ava-420-2';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ACADEMIA DE VOLEIBOL ALSACIA - AVA',
      'Presidente: EDISSON EDUARDO SERNA UPEGUI. Resolución R-D Nº 420. Vigente hasta 2028-05-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3203660880',
      NULL,
      ARRAY[]::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'academia-de-voleibol-alsacia---ava-420',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-academia-de-voleibol-alsacia---ava-420-2', v_school_id, '{"resolucion_rd": "420", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2023", "fecha_fin": "2028-05-08", "presidente": "EDISSON EDUARDO SERNA UPEGUI", "localidad": null, "sports": [], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDISSON EDUARDO SERNA UPEGUI. Resolución R-D Nº 420. Vigente hasta 2028-05-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203660880', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY[]::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "420", "resolucion_actualizacion": null, "fecha_inicio": "09-05-2023", "fecha_fin": "2028-05-08", "presidente": "EDISSON EDUARDO SERNA UPEGUI", "localidad": null, "sports": [], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-academia-de-voleibol-alsacia---ava-420-2';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- BAZINGA ULTIMATEÃ¢â¬Â  (IDRD-CLUB-bazinga-ultimateaaa-445)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bazinga-ultimateaaa-445';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BAZINGA ULTIMATEÃ¢â¬Â',
      'Presidente: LEANIS ZARIFE DIAB ROLDAN. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 445. Vigente hasta 2028-05-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3153810304',
      'bazingabangultimate@gmail.com',
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bazinga-ultimateaaa-445',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bazinga-ultimateaaa-445', v_school_id, '{"resolucion_rd": "445", "resolucion_actualizacion": null, "fecha_inicio": "16-05-2023", "fecha_fin": "2028-05-15", "presidente": "LEANIS ZARIFE DIAB ROLDAN", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LEANIS ZARIFE DIAB ROLDAN. Deporte(s): Ultimate. Localidad: Usaquén. Resolución R-D Nº 445. Vigente hasta 2028-05-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3153810304', phone),
      email       = COALESCE('bazingabangultimate@gmail.com', email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "445", "resolucion_actualizacion": null, "fecha_inicio": "16-05-2023", "fecha_fin": "2028-05-15", "presidente": "LEANIS ZARIFE DIAB ROLDAN", "localidad": "Usaquén", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bazinga-ultimateaaa-445';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3153810304', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FÃNIX HAPKIDO  (IDRD-CLUB-fanix-hapkido-467)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fanix-hapkido-467';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FÃNIX HAPKIDO',
      'Presidente: ANGIE MILENA GUERRERO SÃNCHEZ. Deporte(s): Hapkido. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 467. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3195735861',
      'clubfenixhapkido@gmail.com',
      ARRAY['Hapkido']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fanix-hapkido-467',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fanix-hapkido-467', v_school_id, '{"resolucion_rd": "467", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "ANGIE MILENA GUERRERO SÃNCHEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANGIE MILENA GUERRERO SÃNCHEZ. Deporte(s): Hapkido. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 467. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3195735861', phone),
      email       = COALESCE('clubfenixhapkido@gmail.com', email),
      sports      = ARRAY['Hapkido']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "467", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "ANGIE MILENA GUERRERO SÃNCHEZ", "localidad": "Rafael Uribe Uribe", "sports": ["Hapkido"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fanix-hapkido-467';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3195735861', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- THE KING SPORT  (IDRD-CLUB-the-king-sport-469)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-the-king-sport-469';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'THE KING SPORT',
      'Presidente: ANDRES EDUARDO ESPINOSA BARBOSA. Deporte(s): Natación. Localidad: Bosa. Resolución R-D Nº 469. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3045438537',
      'escthekingsports@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'the-king-sport-469',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-the-king-sport-469', v_school_id, '{"resolucion_rd": "469", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "ANDRES EDUARDO ESPINOSA BARBOSA", "localidad": "Bosa", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES EDUARDO ESPINOSA BARBOSA. Deporte(s): Natación. Localidad: Bosa. Resolución R-D Nº 469. Vigente hasta 2028-05-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3045438537', phone),
      email       = COALESCE('escthekingsports@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "469", "resolucion_actualizacion": null, "fecha_inicio": "19-05-2023", "fecha_fin": "2028-05-18", "presidente": "ANDRES EDUARDO ESPINOSA BARBOSA", "localidad": "Bosa", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-the-king-sport-469';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3045438537', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DS ULTIMATE CLUB  (IDRD-CLUB-ds-ultimate-club-476)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ds-ultimate-club-476';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DS ULTIMATE CLUB',
      'Presidente: LUIS ALFREDO HUERTAS PUERTO. Deporte(s): Ultimate. Localidad: Fontibón. Resolución R-D Nº 476. Vigente hasta 2028-05-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3102848547',
      NULL,
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ds-ultimate-club-476',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ds-ultimate-club-476', v_school_id, '{"resolucion_rd": "476", "resolucion_actualizacion": null, "fecha_inicio": "23-05-2023", "fecha_fin": "2028-05-22", "presidente": "LUIS ALFREDO HUERTAS PUERTO", "localidad": "Fontibón", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALFREDO HUERTAS PUERTO. Deporte(s): Ultimate. Localidad: Fontibón. Resolución R-D Nº 476. Vigente hasta 2028-05-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3102848547', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "476", "resolucion_actualizacion": null, "fecha_inicio": "23-05-2023", "fecha_fin": "2028-05-22", "presidente": "LUIS ALFREDO HUERTAS PUERTO", "localidad": "Fontibón", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ds-ultimate-club-476';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3102848547', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- PABLO VI ULTIMATE CLUB  (IDRD-CLUB-pablo-vi-ultimate-club-507)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-pablo-vi-ultimate-club-507';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'PABLO VI ULTIMATE CLUB',
      'Presidente: ANA MARÃA GÃMEZ ALVAREZ. Deporte(s): Ultimate. Localidad: Teusaquillo. Resolución R-D Nº 507. Vigente hasta 2028-05-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '2210808',
      NULL,
      ARRAY['Ultimate']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'pablo-vi-ultimate-club-507',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-pablo-vi-ultimate-club-507', v_school_id, '{"resolucion_rd": "507", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2023", "fecha_fin": "2028-05-23", "presidente": "ANA MARÃA GÃMEZ ALVAREZ", "localidad": "Teusaquillo", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA MARÃA GÃMEZ ALVAREZ. Deporte(s): Ultimate. Localidad: Teusaquillo. Resolución R-D Nº 507. Vigente hasta 2028-05-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('2210808', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ultimate']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "507", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2023", "fecha_fin": "2028-05-23", "presidente": "ANA MARÃA GÃMEZ ALVAREZ", "localidad": "Teusaquillo", "sports": ["Ultimate"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-pablo-vi-ultimate-club-507';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '2210808', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ULTIMATE CHEER COLOMBIA  (IDRD-CLUB-ultimate-cheer-colombia-510)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ultimate-cheer-colombia-510';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ULTIMATE CHEER COLOMBIA',
      'Presidente: SANTIAGO ALBERTO GOMEZ SUAREZ. Deporte(s): Porrismo. Localidad: Usme. Resolución R-D Nº 510. Vigente hasta 2028-05-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3193207025',
      'santiagoalbertogomez@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ultimate-cheer-colombia-510',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ultimate-cheer-colombia-510', v_school_id, '{"resolucion_rd": "510", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2023", "fecha_fin": "2028-05-23", "presidente": "SANTIAGO ALBERTO GOMEZ SUAREZ", "localidad": "Usme", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANTIAGO ALBERTO GOMEZ SUAREZ. Deporte(s): Porrismo. Localidad: Usme. Resolución R-D Nº 510. Vigente hasta 2028-05-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193207025', phone),
      email       = COALESCE('santiagoalbertogomez@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "510", "resolucion_actualizacion": null, "fecha_inicio": "24-05-2023", "fecha_fin": "2028-05-23", "presidente": "SANTIAGO ALBERTO GOMEZ SUAREZ", "localidad": "Usme", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ultimate-cheer-colombia-510';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3193207025', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPITANES BASKETBALL BOGOTÃ  (IDRD-CLUB-capitanes-basketball-bogota-508)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capitanes-basketball-bogota-508';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPITANES BASKETBALL BOGOTÃ',
      'Presidente: JAIRO ANTONIO MENDOZA VALENCIA. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 508. Vigente hasta 2028-05-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3138125328',
      'sumajestad668@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capitanes-basketball-bogota-508',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capitanes-basketball-bogota-508', v_school_id, '{"resolucion_rd": "508", "resolucion_actualizacion": null, "fecha_inicio": "25-05-2023", "fecha_fin": "2028-05-24", "presidente": "JAIRO ANTONIO MENDOZA VALENCIA", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAIRO ANTONIO MENDOZA VALENCIA. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 508. Vigente hasta 2028-05-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138125328', phone),
      email       = COALESCE('sumajestad668@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "508", "resolucion_actualizacion": null, "fecha_inicio": "25-05-2023", "fecha_fin": "2028-05-24", "presidente": "JAIRO ANTONIO MENDOZA VALENCIA", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capitanes-basketball-bogota-508';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3138125328', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLÃTICO MALLORCA D.C  (IDRD-CLUB-atlatico-mallorca-dc-515)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atlatico-mallorca-dc-515';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLÃTICO MALLORCA D.C',
      'Presidente: JUAN CARLOS SÃNCHEZ DÃAZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 515. Vigente hasta 2028-05-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3106690997',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atlatico-mallorca-dc-515',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atlatico-mallorca-dc-515', v_school_id, '{"resolucion_rd": "515", "resolucion_actualizacion": null, "fecha_inicio": "26-05-2023", "fecha_fin": "2028-05-25", "presidente": "JUAN CARLOS SÃNCHEZ DÃAZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS SÃNCHEZ DÃAZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 515. Vigente hasta 2028-05-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106690997', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "515", "resolucion_actualizacion": null, "fecha_inicio": "26-05-2023", "fecha_fin": "2028-05-25", "presidente": "JUAN CARLOS SÃNCHEZ DÃAZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atlatico-mallorca-dc-515';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3106690997', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ACADEMIA DE ARQUEROS CAMILO VARGAS  (IDRD-CLUB-academia-de-arqueros-camilo-vargas-516)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-academia-de-arqueros-camilo-vargas-516';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ACADEMIA DE ARQUEROS CAMILO VARGAS',
      'Presidente: VANESSA CAROLINA VARGAS GIL. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 516. Vigente hasta 2028-05-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3213920856',
      'academiacamilovargas@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'academia-de-arqueros-camilo-vargas-516',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-academia-de-arqueros-camilo-vargas-516', v_school_id, '{"resolucion_rd": "516", "resolucion_actualizacion": null, "fecha_inicio": "26-05-2023", "fecha_fin": "2028-05-25", "presidente": "VANESSA CAROLINA VARGAS GIL", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VANESSA CAROLINA VARGAS GIL. Deporte(s): Fútbol. Localidad: Puente Aranda. Resolución R-D Nº 516. Vigente hasta 2028-05-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213920856', phone),
      email       = COALESCE('academiacamilovargas@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "516", "resolucion_actualizacion": null, "fecha_inicio": "26-05-2023", "fecha_fin": "2028-05-25", "presidente": "VANESSA CAROLINA VARGAS GIL", "localidad": "Puente Aranda", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-academia-de-arqueros-camilo-vargas-516';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3213920856', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BODHIDHARMA  (IDRD-CLUB-bodhidharma-482)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bodhidharma-482';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BODHIDHARMA',
      'Presidente: OSCAR LEONARDO QUINTERO SARMIENTO. Deporte(s): Wushu. Localidad: Fontibón. Resolución R-D Nº 482. Vigente hasta 2028-06-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3188686958',
      'bodhidharmaclub@gmail.com',
      ARRAY['Wushu']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bodhidharma-482',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bodhidharma-482', v_school_id, '{"resolucion_rd": "482", "resolucion_actualizacion": null, "fecha_inicio": "06-06-2023", "fecha_fin": "2028-06-05", "presidente": "OSCAR LEONARDO QUINTERO SARMIENTO", "localidad": "Fontibón", "sports": ["Wushu"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR LEONARDO QUINTERO SARMIENTO. Deporte(s): Wushu. Localidad: Fontibón. Resolución R-D Nº 482. Vigente hasta 2028-06-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3188686958', phone),
      email       = COALESCE('bodhidharmaclub@gmail.com', email),
      sports      = ARRAY['Wushu']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "482", "resolucion_actualizacion": null, "fecha_inicio": "06-06-2023", "fecha_fin": "2028-06-05", "presidente": "OSCAR LEONARDO QUINTERO SARMIENTO", "localidad": "Fontibón", "sports": ["Wushu"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bodhidharma-482';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3188686958', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DARUMA  (IDRD-CLUB-daruma-564)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-daruma-564';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DARUMA',
      'Presidente: JASON ALEXANDER NIETO PINTO. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 564. Vigente hasta 2028-05-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3105619481',
      'clubtaekwondodaruma@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'daruma-564',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-daruma-564', v_school_id, '{"resolucion_rd": "564", "resolucion_actualizacion": null, "fecha_inicio": "01-06-2023", "fecha_fin": "2028-05-31", "presidente": "JASON ALEXANDER NIETO PINTO", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JASON ALEXANDER NIETO PINTO. Deporte(s): Taekwondo. Localidad: Ciudad Bolívar. Resolución R-D Nº 564. Vigente hasta 2028-05-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3105619481', phone),
      email       = COALESCE('clubtaekwondodaruma@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "564", "resolucion_actualizacion": null, "fecha_inicio": "01-06-2023", "fecha_fin": "2028-05-31", "presidente": "JASON ALEXANDER NIETO PINTO", "localidad": "Ciudad Bolívar", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-daruma-564';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3105619481', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MEDICOS BOGOTÃ  (IDRD-CLUB-medicos-bogota-590)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-medicos-bogota-590';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MEDICOS BOGOTÃ',
      'Presidente: PAUL ALEJANDRO MENDEZ PATARROYO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 590. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3002412401',
      'club.medicos.bogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'medicos-bogota-590',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-medicos-bogota-590', v_school_id, '{"resolucion_rd": "590", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "PAUL ALEJANDRO MENDEZ PATARROYO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAUL ALEJANDRO MENDEZ PATARROYO. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 590. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3002412401', phone),
      email       = COALESCE('club.medicos.bogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "590", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "PAUL ALEJANDRO MENDEZ PATARROYO", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-medicos-bogota-590';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3002412401', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO ORIÃN perteneciente a la entidad no deportiva Corporaci  (IDRD-CLUB-club-deportivo-orian-perteneciente-a-la--589)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-orian-perteneciente-a-la--589';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO ORIÃN perteneciente a la entidad no deportiva Corporaci',
      'Presidente: ANA MARÃA COLLAZOS ZORRILLA. Deporte(s): Natación, Triatlon, Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 589. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3123676284',
      'cluborionbogota@gmail.com',
      ARRAY['Natación','Triatlon','Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-orian-perteneciente-a-la--589',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-orian-perteneciente-a-la--589', v_school_id, '{"resolucion_rd": "589", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "ANA MARÃA COLLAZOS ZORRILLA", "localidad": "Barrios Unidos", "sports": ["Natación", "Triatlon", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA MARÃA COLLAZOS ZORRILLA. Deporte(s): Natación, Triatlon, Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 589. Vigente hasta 2028-06-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123676284', phone),
      email       = COALESCE('cluborionbogota@gmail.com', email),
      sports      = ARRAY['Natación','Triatlon','Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "589", "resolucion_actualizacion": null, "fecha_inicio": "09-06-2023", "fecha_fin": "2028-06-08", "presidente": "ANA MARÃA COLLAZOS ZORRILLA", "localidad": "Barrios Unidos", "sports": ["Natación", "Triatlon", "Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-orian-perteneciente-a-la--589';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3123676284', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL LEONES  (IDRD-CLUB-real-leones-609)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-leones-609';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL LEONES',
      'Presidente: ANDRES CAMILO TUNJUELO VELANDIA. Deporte(s): Fútbol. Resolución R-D Nº 609. Vigente hasta 2028-06-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3193823247',
      'camilo-06@live.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-leones-609',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-leones-609', v_school_id, '{"resolucion_rd": "609", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2023", "fecha_fin": "2028-06-04", "presidente": "ANDRES CAMILO TUNJUELO VELANDIA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES CAMILO TUNJUELO VELANDIA. Deporte(s): Fútbol. Resolución R-D Nº 609. Vigente hasta 2028-06-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3193823247', phone),
      email       = COALESCE('camilo-06@live.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "609", "resolucion_actualizacion": null, "fecha_inicio": "05-06-2023", "fecha_fin": "2028-06-04", "presidente": "ANDRES CAMILO TUNJUELO VELANDIA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-leones-609';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO SPEED FORCE CLUB  (IDRD-CLUB-club-deportivo-speed-force-club-610)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-speed-force-club-610';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO SPEED FORCE CLUB',
      'Presidente: CARLOS ALBERTO RUIZ OVALLE. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 610 / actualización Nº 939. Vigente hasta 2028-06-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3915931',
      'speedforcecolombia@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-speed-force-club-610',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-speed-force-club-610', v_school_id, '{"resolucion_rd": "610", "resolucion_actualizacion": "939", "fecha_inicio": "14-06-2023", "fecha_fin": "2028-06-13", "presidente": "CARLOS ALBERTO RUIZ OVALLE", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALBERTO RUIZ OVALLE. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 610 / actualización Nº 939. Vigente hasta 2028-06-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3915931', phone),
      email       = COALESCE('speedforcecolombia@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "610", "resolucion_actualizacion": "939", "fecha_inicio": "14-06-2023", "fecha_fin": "2028-06-13", "presidente": "CARLOS ALBERTO RUIZ OVALLE", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-speed-force-club-610';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3915931', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- USAQUEN SUBA ASOCIADOS FUTBOL CLUB  (IDRD-CLUB-usaquen-suba-asociados-futbol-club-617)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-usaquen-suba-asociados-futbol-club-617';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'USAQUEN SUBA ASOCIADOS FUTBOL CLUB',
      'Presidente: HECTOR ARGUELLO BRAVO. Deporte(s): Fútbol. Resolución R-D Nº 617. Vigente hasta 2028-06-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3016907008',
      'hectorar28@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'usaquen-suba-asociados-futbol-club-617',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-usaquen-suba-asociados-futbol-club-617', v_school_id, '{"resolucion_rd": "617", "resolucion_actualizacion": null, "fecha_inicio": "13-06-2023", "fecha_fin": "2028-06-12", "presidente": "HECTOR ARGUELLO BRAVO", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HECTOR ARGUELLO BRAVO. Deporte(s): Fútbol. Resolución R-D Nº 617. Vigente hasta 2028-06-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3016907008', phone),
      email       = COALESCE('hectorar28@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "617", "resolucion_actualizacion": null, "fecha_inicio": "13-06-2023", "fecha_fin": "2028-06-12", "presidente": "HECTOR ARGUELLO BRAVO", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-usaquen-suba-asociados-futbol-club-617';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- DREAMERS GYMNASTICS perteneciente a la entidad no deportiva INVERSION  (IDRD-CLUB-dreamers-gymnastics-perteneciente-a-la-e-619)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dreamers-gymnastics-perteneciente-a-la-e-619';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DREAMERS GYMNASTICS perteneciente a la entidad no deportiva INVERSION',
      'Presidente: EDNA CONSTANZA HERRERA PARRADO. Deporte(s): Gimnasia. Localidad: Usaquén. Resolución R-D Nº 619. Vigente hasta 2028-06-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '6017327027',
      NULL,
      ARRAY['Gimnasia']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dreamers-gymnastics-perteneciente-a-la-e-619',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dreamers-gymnastics-perteneciente-a-la-e-619', v_school_id, '{"resolucion_rd": "619", "resolucion_actualizacion": null, "fecha_inicio": "13-06-2023", "fecha_fin": "2028-06-12", "presidente": "EDNA CONSTANZA HERRERA PARRADO", "localidad": "Usaquén", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDNA CONSTANZA HERRERA PARRADO. Deporte(s): Gimnasia. Localidad: Usaquén. Resolución R-D Nº 619. Vigente hasta 2028-06-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6017327027', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Gimnasia']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "619", "resolucion_actualizacion": null, "fecha_inicio": "13-06-2023", "fecha_fin": "2028-06-12", "presidente": "EDNA CONSTANZA HERRERA PARRADO", "localidad": "Usaquén", "sports": ["Gimnasia"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dreamers-gymnastics-perteneciente-a-la-e-619';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '6017327027', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SEAHAWKS ALL STARS  (IDRD-CLUB-seahawks-all-stars-622)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-seahawks-all-stars-622';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SEAHAWKS ALL STARS',
      'Presidente: FERNANDO OSORNO ACOSTA. Deporte(s): Porrismo. Localidad: Usaquén. Resolución R-D Nº 622. Vigente hasta 2028-06-13. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '6016294740',
      'seahawkscheerandgym@outlook.es',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'seahawks-all-stars-622',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-seahawks-all-stars-622', v_school_id, '{"resolucion_rd": "622", "resolucion_actualizacion": null, "fecha_inicio": "14-06-2023", "fecha_fin": "2028-06-13", "presidente": "FERNANDO OSORNO ACOSTA", "localidad": "Usaquén", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: FERNANDO OSORNO ACOSTA. Deporte(s): Porrismo. Localidad: Usaquén. Resolución R-D Nº 622. Vigente hasta 2028-06-13. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6016294740', phone),
      email       = COALESCE('seahawkscheerandgym@outlook.es', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "622", "resolucion_actualizacion": null, "fecha_inicio": "14-06-2023", "fecha_fin": "2028-06-13", "presidente": "FERNANDO OSORNO ACOSTA", "localidad": "Usaquén", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-seahawks-all-stars-622';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '6016294740', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REVOLUCIÃN F.S  (IDRD-CLUB-revolucian-fs-1034)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-revolucian-fs-1034';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REVOLUCIÃN F.S',
      'Presidente: JUAN CARLOS BUITRAGO RAPPI. Deporte(s): Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 1034. Vigente hasta 2028-09-07. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3203873543',
      'revolucionfts@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'revolucian-fs-1034',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-revolucian-fs-1034', v_school_id, '{"resolucion_rd": "1034", "resolucion_actualizacion": null, "fecha_inicio": "08-09-2023", "fecha_fin": "2028-09-07", "presidente": "JUAN CARLOS BUITRAGO RAPPI", "localidad": "Bosa", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN CARLOS BUITRAGO RAPPI. Deporte(s): Fútbol de salón. Localidad: Bosa. Resolución R-D Nº 1034. Vigente hasta 2028-09-07. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203873543', phone),
      email       = COALESCE('revolucionfts@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1034", "resolucion_actualizacion": null, "fecha_inicio": "08-09-2023", "fecha_fin": "2028-09-07", "presidente": "JUAN CARLOS BUITRAGO RAPPI", "localidad": "Bosa", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-revolucian-fs-1034';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3203873543', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CHOMBO FUTBOL CLUB  (IDRD-CLUB-chombo-futbol-club-805)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-chombo-futbol-club-805';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CHOMBO FUTBOL CLUB',
      'Presidente: EDINSON VALENCIA GARCIA. Deporte(s): Fútbol. Resolución R-D Nº 805. Vigente hasta 2028-07-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      NULL,
      '3203873543',
      'edchombo@yahoo.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'chombo-futbol-club-805',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-chombo-futbol-club-805', v_school_id, '{"resolucion_rd": "805", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2023", "fecha_fin": "2028-07-24", "presidente": "EDINSON VALENCIA GARCIA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: EDINSON VALENCIA GARCIA. Deporte(s): Fútbol. Resolución R-D Nº 805. Vigente hasta 2028-07-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3203873543', phone),
      email       = COALESCE('edchombo@yahoo.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "805", "resolucion_actualizacion": null, "fecha_inicio": "25-07-2023", "fecha_fin": "2028-07-24", "presidente": "EDINSON VALENCIA GARCIA", "localidad": null, "sports": ["Fútbol"], "geo_source": "not_found"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-chombo-futbol-club-805';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)
END $$;

-- ─────────────────────────────────────────────────────────
-- ETERNALS FUTBOL CLUB  (IDRD-CLUB-eternals-futbol-club-618)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-eternals-futbol-club-618';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ETERNALS FUTBOL CLUB',
      'Presidente: LUIS YESID MARTINEZ CALDERON. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 618. Vigente hasta 2028-06-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3133706573',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'eternals-futbol-club-618',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-eternals-futbol-club-618', v_school_id, '{"resolucion_rd": "618", "resolucion_actualizacion": null, "fecha_inicio": "16-06-2023", "fecha_fin": "2028-06-15", "presidente": "LUIS YESID MARTINEZ CALDERON", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS YESID MARTINEZ CALDERON. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 618. Vigente hasta 2028-06-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3133706573', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "618", "resolucion_actualizacion": null, "fecha_inicio": "16-06-2023", "fecha_fin": "2028-06-15", "presidente": "LUIS YESID MARTINEZ CALDERON", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-eternals-futbol-club-618';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3133706573', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ARMONISS SKATE  (IDRD-CLUB-armoniss-skate-684)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-armoniss-skate-684';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ARMONISS SKATE',
      'Presidente: YESSICA ALEJANDRA MONTAÃEZ SIERRA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 684. Vigente hasta 2028-06-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3112499330',
      'erudachi@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'armoniss-skate-684',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-armoniss-skate-684', v_school_id, '{"resolucion_rd": "684", "resolucion_actualizacion": null, "fecha_inicio": "23-06-2023", "fecha_fin": "2028-06-22", "presidente": "YESSICA ALEJANDRA MONTAÃEZ SIERRA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: YESSICA ALEJANDRA MONTAÃEZ SIERRA. Deporte(s): Patinaje. Localidad: Puente Aranda. Resolución R-D Nº 684. Vigente hasta 2028-06-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112499330', phone),
      email       = COALESCE('erudachi@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "684", "resolucion_actualizacion": null, "fecha_inicio": "23-06-2023", "fecha_fin": "2028-06-22", "presidente": "YESSICA ALEJANDRA MONTAÃEZ SIERRA", "localidad": "Puente Aranda", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-armoniss-skate-684';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3112499330', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CLUB PADEL POINT  (IDRD-CLUB-club-deportivo-club-padel-point-707)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-club-padel-point-707';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CLUB PADEL POINT',
      'Presidente: JUAN PABLO SALAZAR GOMEZ. Deporte(s): Tenis, Padel. Localidad: Suba. Resolución R-D Nº 707 / actualización Nº 1476. Vigente hasta 2028-07-03. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3178450001',
      'padelpointsas@gmail.com',
      ARRAY['Tenis','Padel']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-club-padel-point-707',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-club-padel-point-707', v_school_id, '{"resolucion_rd": "707", "resolucion_actualizacion": "1476", "fecha_inicio": "04-07-2023", "fecha_fin": "2028-07-03", "presidente": "JUAN PABLO SALAZAR GOMEZ", "localidad": "Suba", "sports": ["Tenis", "Padel"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN PABLO SALAZAR GOMEZ. Deporte(s): Tenis, Padel. Localidad: Suba. Resolución R-D Nº 707 / actualización Nº 1476. Vigente hasta 2028-07-03. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3178450001', phone),
      email       = COALESCE('padelpointsas@gmail.com', email),
      sports      = ARRAY['Tenis','Padel']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "707", "resolucion_actualizacion": "1476", "fecha_inicio": "04-07-2023", "fecha_fin": "2028-07-03", "presidente": "JUAN PABLO SALAZAR GOMEZ", "localidad": "Suba", "sports": ["Tenis", "Padel"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-club-padel-point-707';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3178450001', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLÃTICO ESTUDIANTES  (IDRD-CLUB-atlatico-estudiantes-724)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atlatico-estudiantes-724';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLÃTICO ESTUDIANTES',
      'Presidente: IRMA YANIRA CALDERÃN QUINTERO. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 724. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3213941246',
      'atleticoestudiantes2005@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atlatico-estudiantes-724',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atlatico-estudiantes-724', v_school_id, '{"resolucion_rd": "724", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "IRMA YANIRA CALDERÃN QUINTERO", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: IRMA YANIRA CALDERÃN QUINTERO. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 724. Vigente hasta 2028-07-04. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3213941246', phone),
      email       = COALESCE('atleticoestudiantes2005@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "724", "resolucion_actualizacion": null, "fecha_inicio": "05-07-2023", "fecha_fin": "2028-07-04", "presidente": "IRMA YANIRA CALDERÃN QUINTERO", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atlatico-estudiantes-724';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3213941246', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VICTORY SPORTS 01  (IDRD-CLUB-victory-sports-01-745)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-victory-sports-01-745';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VICTORY SPORTS 01',
      'Presidente: JOHN JAIDER AVILA ARÃAS,. Deporte(s): Ajedrez, Baloncesto, Bowling, Fútbol, Fútbol de salón, Tenis. Localidad: Teusaquillo. Resolución R-D Nº 745. Vigente hasta 2028-07-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '6012492142',
      'clubfights2004@gmail.com',
      ARRAY['Ajedrez','Baloncesto','Bowling','Fútbol','Fútbol de salón','Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'victory-sports-01-745',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-victory-sports-01-745', v_school_id, '{"resolucion_rd": "745", "resolucion_actualizacion": null, "fecha_inicio": "10-07-2023", "fecha_fin": "2028-07-09", "presidente": "JOHN JAIDER AVILA ARÃAS,", "localidad": "Teusaquillo", "sports": ["Ajedrez", "Baloncesto", "Bowling", "Fútbol", "Fútbol de salón", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOHN JAIDER AVILA ARÃAS,. Deporte(s): Ajedrez, Baloncesto, Bowling, Fútbol, Fútbol de salón, Tenis. Localidad: Teusaquillo. Resolución R-D Nº 745. Vigente hasta 2028-07-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6012492142', phone),
      email       = COALESCE('clubfights2004@gmail.com', email),
      sports      = ARRAY['Ajedrez','Baloncesto','Bowling','Fútbol','Fútbol de salón','Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "745", "resolucion_actualizacion": null, "fecha_inicio": "10-07-2023", "fecha_fin": "2028-07-09", "presidente": "JOHN JAIDER AVILA ARÃAS,", "localidad": "Teusaquillo", "sports": ["Ajedrez", "Baloncesto", "Bowling", "Fútbol", "Fútbol de salón", "Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-victory-sports-01-745';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '6012492142', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- BOGOTÃ TISCHTENNIS  (IDRD-CLUB-bogota-tischtennis-766)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bogota-tischtennis-766';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BOGOTÃ TISCHTENNIS',
      'Presidente: SERGIO DANIEL CAHO RODRÃGUEZ. Deporte(s): Tenis. Localidad: Puente Aranda. Resolución R-D Nº 766. Vigente hasta 2028-07-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3232405522',
      'trosk@outlook.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bogota-tischtennis-766',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bogota-tischtennis-766', v_school_id, '{"resolucion_rd": "766", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2023", "fecha_fin": "2028-07-18", "presidente": "SERGIO DANIEL CAHO RODRÃGUEZ", "localidad": "Puente Aranda", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SERGIO DANIEL CAHO RODRÃGUEZ. Deporte(s): Tenis. Localidad: Puente Aranda. Resolución R-D Nº 766. Vigente hasta 2028-07-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3232405522', phone),
      email       = COALESCE('trosk@outlook.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "766", "resolucion_actualizacion": null, "fecha_inicio": "19-07-2023", "fecha_fin": "2028-07-18", "presidente": "SERGIO DANIEL CAHO RODRÃGUEZ", "localidad": "Puente Aranda", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bogota-tischtennis-766';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3232405522', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LEGION SKATE  (IDRD-CLUB-legion-skate-795)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-legion-skate-795';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEGION SKATE',
      'Presidente: PAUL SANCHEZ OSPINA. Deporte(s): Skateboarding. Localidad: Suba. Resolución R-D Nº 795. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3044835514',
      'miportalurbano@gmail.com',
      ARRAY['Skateboarding']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'legion-skate-795',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-legion-skate-795', v_school_id, '{"resolucion_rd": "795", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "PAUL SANCHEZ OSPINA", "localidad": "Suba", "sports": ["Skateboarding"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAUL SANCHEZ OSPINA. Deporte(s): Skateboarding. Localidad: Suba. Resolución R-D Nº 795. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3044835514', phone),
      email       = COALESCE('miportalurbano@gmail.com', email),
      sports      = ARRAY['Skateboarding']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "795", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "PAUL SANCHEZ OSPINA", "localidad": "Suba", "sports": ["Skateboarding"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-legion-skate-795';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3044835514', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TALENTOS AMERICA F.C  (IDRD-CLUB-talentos-america-fc-798)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-talentos-america-fc-798';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TALENTOS AMERICA F.C',
      'Presidente: NICOLAS FLOREZ PACHON. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 798. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3115994139',
      'americadelsurfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'talentos-america-fc-798',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-talentos-america-fc-798', v_school_id, '{"resolucion_rd": "798", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "NICOLAS FLOREZ PACHON", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS FLOREZ PACHON. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 798. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3115994139', phone),
      email       = COALESCE('americadelsurfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "798", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "NICOLAS FLOREZ PACHON", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-talentos-america-fc-798';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3115994139', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RAPA FUTBOL PROMOTORA  (IDRD-CLUB-rapa-futbol-promotora-794)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-rapa-futbol-promotora-794';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RAPA FUTBOL PROMOTORA',
      'Presidente: ROBERTO ANDRES PIÃâEROS ALCALA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 794. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3012833018',
      'rapafutbol19@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'rapa-futbol-promotora-794',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-rapa-futbol-promotora-794', v_school_id, '{"resolucion_rd": "794", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "ROBERTO ANDRES PIÃâEROS ALCALA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROBERTO ANDRES PIÃâEROS ALCALA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 794. Vigente hasta 2028-07-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3012833018', phone),
      email       = COALESCE('rapafutbol19@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "794", "resolucion_actualizacion": null, "fecha_inicio": "24-07-2023", "fecha_fin": "2028-07-23", "presidente": "ROBERTO ANDRES PIÃâEROS ALCALA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-rapa-futbol-promotora-794';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3012833018', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO S.Y.L.D SPORT  (IDRD-CLUB-club-deportivo-syld-sport-840)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-syld-sport-840';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO S.Y.L.D SPORT',
      'Presidente: NELSON ENRIQUE HURTADO PARRA. Deporte(s): Fútbol de salón, Fútbol, Tenis, Patinaje, Karate, Natación. Localidad: Engativá. Resolución R-D Nº 840. Vigente hasta 2028-07-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3204186641',
      'formacionsyld@gmail.com',
      ARRAY['Fútbol de salón','Fútbol','Tenis','Patinaje','Karate','Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-syld-sport-840',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-syld-sport-840', v_school_id, '{"resolucion_rd": "840", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2023", "fecha_fin": "2028-07-30", "presidente": "NELSON ENRIQUE HURTADO PARRA", "localidad": "Engativá", "sports": ["Fútbol de salón", "Fútbol", "Tenis", "Patinaje", "Karate", "Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NELSON ENRIQUE HURTADO PARRA. Deporte(s): Fútbol de salón, Fútbol, Tenis, Patinaje, Karate, Natación. Localidad: Engativá. Resolución R-D Nº 840. Vigente hasta 2028-07-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204186641', phone),
      email       = COALESCE('formacionsyld@gmail.com', email),
      sports      = ARRAY['Fútbol de salón','Fútbol','Tenis','Patinaje','Karate','Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "840", "resolucion_actualizacion": null, "fecha_inicio": "31-07-2023", "fecha_fin": "2028-07-30", "presidente": "NELSON ENRIQUE HURTADO PARRA", "localidad": "Engativá", "sports": ["Fútbol de salón", "Fútbol", "Tenis", "Patinaje", "Karate", "Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-syld-sport-840';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3204186641', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- HENDUMO  (IDRD-CLUB-hendumo-886)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-hendumo-886';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'HENDUMO',
      'Presidente: HENRY ALBERTO DUARTE MORENO. Deporte(s): Ajedrez. Localidad: Ciudad Bolívar. Resolución R-D Nº 886. Vigente hasta 2028-08-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3183801965',
      NULL,
      ARRAY['Ajedrez']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'hendumo-886',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-hendumo-886', v_school_id, '{"resolucion_rd": "886", "resolucion_actualizacion": null, "fecha_inicio": "09-08-2023", "fecha_fin": "2028-08-08", "presidente": "HENRY ALBERTO DUARTE MORENO", "localidad": "Ciudad Bolívar", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HENRY ALBERTO DUARTE MORENO. Deporte(s): Ajedrez. Localidad: Ciudad Bolívar. Resolución R-D Nº 886. Vigente hasta 2028-08-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183801965', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Ajedrez']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "886", "resolucion_actualizacion": null, "fecha_inicio": "09-08-2023", "fecha_fin": "2028-08-08", "presidente": "HENRY ALBERTO DUARTE MORENO", "localidad": "Ciudad Bolívar", "sports": ["Ajedrez"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-hendumo-886';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3183801965', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO AA PRO  (IDRD-CLUB-club-deportivo-aa-pro-891)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-aa-pro-891';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO AA PRO',
      'Presidente: JUAN ANGEL RIOS MELENDEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 891. Vigente hasta 2028-08-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3132043837',
      'aaprobmxracing@gmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-aa-pro-891',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-aa-pro-891', v_school_id, '{"resolucion_rd": "891", "resolucion_actualizacion": null, "fecha_inicio": "09-08-2023", "fecha_fin": "2028-08-08", "presidente": "JUAN ANGEL RIOS MELENDEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUAN ANGEL RIOS MELENDEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 891. Vigente hasta 2028-08-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132043837', phone),
      email       = COALESCE('aaprobmxracing@gmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "891", "resolucion_actualizacion": null, "fecha_inicio": "09-08-2023", "fecha_fin": "2028-08-08", "presidente": "JUAN ANGEL RIOS MELENDEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-aa-pro-891';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3132043837', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- WIZARD BASKETBALL CLUB  (IDRD-CLUB-wizard-basketball-club-892)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-wizard-basketball-club-892';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'WIZARD BASKETBALL CLUB',
      'Presidente: JAVIER LEONARDO GONZALEZ MUÃOZ. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 892. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3112450728',
      'wizardbasketball5@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'wizard-basketball-club-892',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-wizard-basketball-club-892', v_school_id, '{"resolucion_rd": "892", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "JAVIER LEONARDO GONZALEZ MUÃOZ", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JAVIER LEONARDO GONZALEZ MUÃOZ. Deporte(s): Baloncesto. Localidad: Engativá. Resolución R-D Nº 892. Vigente hasta 2028-08-09. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3112450728', phone),
      email       = COALESCE('wizardbasketball5@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "892", "resolucion_actualizacion": null, "fecha_inicio": "10-08-2023", "fecha_fin": "2028-08-09", "presidente": "JAVIER LEONARDO GONZALEZ MUÃOZ", "localidad": "Engativá", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-wizard-basketball-club-892';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3112450728', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KICK BOXING BAKATA  (IDRD-CLUB-kick-boxing-bakata-895)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kick-boxing-bakata-895';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KICK BOXING BAKATA',
      'Presidente: ALDEMAR AMAYA AVILA. Deporte(s): Kick Boxing. Localidad: Engativá. Resolución R-D Nº 895. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3232367278',
      NULL,
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kick-boxing-bakata-895',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kick-boxing-bakata-895', v_school_id, '{"resolucion_rd": "895", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "ALDEMAR AMAYA AVILA", "localidad": "Engativá", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ALDEMAR AMAYA AVILA. Deporte(s): Kick Boxing. Localidad: Engativá. Resolución R-D Nº 895. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3232367278', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "895", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "ALDEMAR AMAYA AVILA", "localidad": "Engativá", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kick-boxing-bakata-895';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3232367278', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KICK BOXING FIRMNESS CLUB  (IDRD-CLUB-kick-boxing-firmness-club-899)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kick-boxing-firmness-club-899';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KICK BOXING FIRMNESS CLUB',
      'Presidente: DIANA PATRICIA HERRERA MALDONADO. Deporte(s): Kick Boxing. Localidad: Suba. Resolución R-D Nº 899. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3014338867',
      'jhonsetsierra@gmail.com',
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kick-boxing-firmness-club-899',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kick-boxing-firmness-club-899', v_school_id, '{"resolucion_rd": "899", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "DIANA PATRICIA HERRERA MALDONADO", "localidad": "Suba", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIANA PATRICIA HERRERA MALDONADO. Deporte(s): Kick Boxing. Localidad: Suba. Resolución R-D Nº 899. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3014338867', phone),
      email       = COALESCE('jhonsetsierra@gmail.com', email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "899", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "DIANA PATRICIA HERRERA MALDONADO", "localidad": "Suba", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kick-boxing-firmness-club-899';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3014338867', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TIGER SHARKS  (IDRD-CLUB-tiger-sharks-914)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tiger-sharks-914';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TIGER SHARKS',
      'Presidente: ELVIRA ALEJANDRA ORTIZ CARDONA. Deporte(s): Triatlon. Localidad: Teusaquillo. Resolución R-D Nº 914. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '3202162380',
      'lobeabogados2@gmail.com',
      ARRAY['Triatlon']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tiger-sharks-914',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tiger-sharks-914', v_school_id, '{"resolucion_rd": "914", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "ELVIRA ALEJANDRA ORTIZ CARDONA", "localidad": "Teusaquillo", "sports": ["Triatlon"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELVIRA ALEJANDRA ORTIZ CARDONA. Deporte(s): Triatlon. Localidad: Teusaquillo. Resolución R-D Nº 914. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3202162380', phone),
      email       = COALESCE('lobeabogados2@gmail.com', email),
      sports      = ARRAY['Triatlon']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "914", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "ELVIRA ALEJANDRA ORTIZ CARDONA", "localidad": "Teusaquillo", "sports": ["Triatlon"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tiger-sharks-914';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '3202162380', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- JUVENTUD RM  (IDRD-CLUB-juventud-rm-917)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-juventud-rm-917';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'JUVENTUD RM',
      'Presidente: CRISTHIAN CAMILO RODRIGUEZ MORA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 917. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3022045385',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'juventud-rm-917',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-juventud-rm-917', v_school_id, '{"resolucion_rd": "917", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "CRISTHIAN CAMILO RODRIGUEZ MORA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CRISTHIAN CAMILO RODRIGUEZ MORA. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 917. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3022045385', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "917", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "CRISTHIAN CAMILO RODRIGUEZ MORA", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-juventud-rm-917';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3022045385', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REAL ÌS BASKETBALL CLUB  (IDRD-CLUB-real-is-basketball-club-920)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-real-is-basketball-club-920';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REAL ÌS BASKETBALL CLUB',
      'Presidente: MIGUEL ANGEL CHACON HINCAPIE. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 920. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3185169426',
      'realsbaloncesto@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'real-is-basketball-club-920',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-real-is-basketball-club-920', v_school_id, '{"resolucion_rd": "920", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "MIGUEL ANGEL CHACON HINCAPIE", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ANGEL CHACON HINCAPIE. Deporte(s): Baloncesto. Localidad: Suba. Resolución R-D Nº 920. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3185169426', phone),
      email       = COALESCE('realsbaloncesto@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "920", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "MIGUEL ANGEL CHACON HINCAPIE", "localidad": "Suba", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-real-is-basketball-club-920';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3185169426', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DRAGONFLY ALLSTARS  (IDRD-CLUB-dragonfly-allstars-926)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dragonfly-allstars-926';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DRAGONFLY ALLSTARS',
      'Presidente: SANDRA LILIANA CHOACHI CASTAÃEDA. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 926. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3007345541',
      'clubdeportivodragonflyallstars@gmail.com',
      ARRAY['Porrismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dragonfly-allstars-926',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dragonfly-allstars-926', v_school_id, '{"resolucion_rd": "926", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "SANDRA LILIANA CHOACHI CASTAÃEDA", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SANDRA LILIANA CHOACHI CASTAÃEDA. Deporte(s): Porrismo. Localidad: Kennedy. Resolución R-D Nº 926. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3007345541', phone),
      email       = COALESCE('clubdeportivodragonflyallstars@gmail.com', email),
      sports      = ARRAY['Porrismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "926", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "SANDRA LILIANA CHOACHI CASTAÃEDA", "localidad": "Kennedy", "sports": ["Porrismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dragonfly-allstars-926';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3007345541', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TITAN MAX BOGOTÃ  (IDRD-CLUB-titan-max-bogota-927)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-titan-max-bogota-927';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TITAN MAX BOGOTÃ',
      'Presidente: seÃ±or IVAN JAVIER TOBASIA RODRIGUEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 927. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3136656067',
      'clubdeportivotm@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'titan-max-bogota-927',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-titan-max-bogota-927', v_school_id, '{"resolucion_rd": "927", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "seÃ±or IVAN JAVIER TOBASIA RODRIGUEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: seÃ±or IVAN JAVIER TOBASIA RODRIGUEZ. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 927. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3136656067', phone),
      email       = COALESCE('clubdeportivotm@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "927", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "seÃ±or IVAN JAVIER TOBASIA RODRIGUEZ", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-titan-max-bogota-927';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3136656067', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COOPROSPERANDO JUNTOS  (IDRD-CLUB-cooprosperando-juntos-915)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cooprosperando-juntos-915';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COOPROSPERANDO JUNTOS',
      'Presidente: CARLOS ALBERTO LOZANO MIER. Deporte(s): Ecuestre. Localidad: Suba. Resolución R-D Nº 915. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '7496609',
      'cooprosperandojuntos9@gmail.com',
      ARRAY['Ecuestre']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cooprosperando-juntos-915',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cooprosperando-juntos-915', v_school_id, '{"resolucion_rd": "915", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "CARLOS ALBERTO LOZANO MIER", "localidad": "Suba", "sports": ["Ecuestre"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ALBERTO LOZANO MIER. Deporte(s): Ecuestre. Localidad: Suba. Resolución R-D Nº 915. Vigente hasta 2028-08-14. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('7496609', phone),
      email       = COALESCE('cooprosperandojuntos9@gmail.com', email),
      sports      = ARRAY['Ecuestre']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "915", "resolucion_actualizacion": null, "fecha_inicio": "15-08-2023", "fecha_fin": "2028-08-14", "presidente": "CARLOS ALBERTO LOZANO MIER", "localidad": "Suba", "sports": ["Ecuestre"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cooprosperando-juntos-915';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '7496609', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GIGANTES DEL SOCCER FC  (IDRD-CLUB-gigantes-del-soccer-fc-924)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gigantes-del-soccer-fc-924';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GIGANTES DEL SOCCER FC',
      'Presidente: CARLOS CAICEDO CAICEDO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 924. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3132053220',
      'gigantesdelsoccerfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gigantes-del-soccer-fc-924',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gigantes-del-soccer-fc-924', v_school_id, '{"resolucion_rd": "924", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "CARLOS CAICEDO CAICEDO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS CAICEDO CAICEDO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 924. Vigente hasta 2028-08-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3132053220', phone),
      email       = COALESCE('gigantesdelsoccerfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "924", "resolucion_actualizacion": null, "fecha_inicio": "16-08-2023", "fecha_fin": "2028-08-15", "presidente": "CARLOS CAICEDO CAICEDO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gigantes-del-soccer-fc-924';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3132053220', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- RAYOS BOGOTÃ  (IDRD-CLUB-rayos-bogota-940)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-rayos-bogota-940';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'RAYOS BOGOTÃ',
      'Presidente: DIEGO ALEXANDER IRREÃO RODRIGUEZ. Deporte(s): Patinaje. Localidad: Santa Fe. Resolución R-D Nº 940. Vigente hasta 2028-08-17. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Santa Fe',
      '3147692551',
      NULL,
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'rayos-bogota-940',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-rayos-bogota-940', v_school_id, '{"resolucion_rd": "940", "resolucion_actualizacion": null, "fecha_inicio": "18-08-2023", "fecha_fin": "2028-08-17", "presidente": "DIEGO ALEXANDER IRREÃO RODRIGUEZ", "localidad": "Santa Fe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DIEGO ALEXANDER IRREÃO RODRIGUEZ. Deporte(s): Patinaje. Localidad: Santa Fe. Resolución R-D Nº 940. Vigente hasta 2028-08-17. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3147692551', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "940", "resolucion_actualizacion": null, "fecha_inicio": "18-08-2023", "fecha_fin": "2028-08-17", "presidente": "DIEGO ALEXANDER IRREÃO RODRIGUEZ", "localidad": "Santa Fe", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-rayos-bogota-940';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Santa Fe', 'Bogotá', '3147692551', 4.6017892, -74.0791799, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KICK BOXING DO JANG  (IDRD-CLUB-kick-boxing-do-jang-932)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kick-boxing-do-jang-932';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KICK BOXING DO JANG',
      'Presidente: MARIO ANDRES CASTRO COTRINO. Deporte(s): Kick Boxing. Localidad: Suba. Resolución R-D Nº 932. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3167562971',
      'guaneme@yahoo.es',
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kick-boxing-do-jang-932',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kick-boxing-do-jang-932', v_school_id, '{"resolucion_rd": "932", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "MARIO ANDRES CASTRO COTRINO", "localidad": "Suba", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIO ANDRES CASTRO COTRINO. Deporte(s): Kick Boxing. Localidad: Suba. Resolución R-D Nº 932. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3167562971', phone),
      email       = COALESCE('guaneme@yahoo.es', email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "932", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "MARIO ANDRES CASTRO COTRINO", "localidad": "Suba", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kick-boxing-do-jang-932';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3167562971', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA ROMA SUBA  (IDRD-CLUB-la-roma-suba-933)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-roma-suba-933';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA ROMA SUBA',
      'Presidente: ROGER QUIÃONES CORREA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 933. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3212826974',
      'romasoccer@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-roma-suba-933',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-roma-suba-933', v_school_id, '{"resolucion_rd": "933", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "ROGER QUIÃONES CORREA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ROGER QUIÃONES CORREA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 933. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3212826974', phone),
      email       = COALESCE('romasoccer@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "933", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "ROGER QUIÃONES CORREA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-roma-suba-933';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3212826974', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CUELLAR ÌS TENIS CLUB  (IDRD-CLUB-cuellar-is-tenis-club-942)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-cuellar-is-tenis-club-942';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CUELLAR ÌS TENIS CLUB',
      'Presidente: PAULA GYSSEL CUELLAR MORENO. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 942. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3057454353',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'cuellar-is-tenis-club-942',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-cuellar-is-tenis-club-942', v_school_id, '{"resolucion_rd": "942", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "PAULA GYSSEL CUELLAR MORENO", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PAULA GYSSEL CUELLAR MORENO. Deporte(s): Tenis. Localidad: Fontibón. Resolución R-D Nº 942. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057454353', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "942", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "PAULA GYSSEL CUELLAR MORENO", "localidad": "Fontibón", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-cuellar-is-tenis-club-942';
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
-- LEONES ZION FC  (IDRD-CLUB-leones-zion-fc-943)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-leones-zion-fc-943';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEONES ZION FC',
      'Presidente: HENRY ANDRES GONZALEZ CORRALES. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 943. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '6019245326',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'leones-zion-fc-943',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-leones-zion-fc-943', v_school_id, '{"resolucion_rd": "943", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "HENRY ANDRES GONZALEZ CORRALES", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HENRY ANDRES GONZALEZ CORRALES. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 943. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6019245326', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "943", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "HENRY ANDRES GONZALEZ CORRALES", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-leones-zion-fc-943';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '6019245326', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- AJJAX  (IDRD-CLUB-ajjax-944)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ajjax-944';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'AJJAX',
      'Presidente: ELIANA PATRICIA TELLO BETANCOURT. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 944. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3024110554',
      'ajjaxpatinaje@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ajjax-944',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ajjax-944', v_school_id, '{"resolucion_rd": "944", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "ELIANA PATRICIA TELLO BETANCOURT", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ELIANA PATRICIA TELLO BETANCOURT. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 944. Vigente hasta 2028-08-20. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3024110554', phone),
      email       = COALESCE('ajjaxpatinaje@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "944", "resolucion_actualizacion": null, "fecha_inicio": "21-08-2023", "fecha_fin": "2028-08-20", "presidente": "ELIANA PATRICIA TELLO BETANCOURT", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ajjax-944';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3024110554', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GUERREROS BOGOTA FC  (IDRD-CLUB-guerreros-bogota-fc-965)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-guerreros-bogota-fc-965';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GUERREROS BOGOTA FC',
      'Presidente: CARLOS ARTURO ZABALA GALINDO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 965. Vigente hasta 2028-08-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3232429331',
      'cdguerrerosbogotafc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'guerreros-bogota-fc-965',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-guerreros-bogota-fc-965', v_school_id, '{"resolucion_rd": "965", "resolucion_actualizacion": null, "fecha_inicio": "24-08-2023", "fecha_fin": "2028-08-23", "presidente": "CARLOS ARTURO ZABALA GALINDO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO ZABALA GALINDO. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 965. Vigente hasta 2028-08-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3232429331', phone),
      email       = COALESCE('cdguerrerosbogotafc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "965", "resolucion_actualizacion": null, "fecha_inicio": "24-08-2023", "fecha_fin": "2028-08-23", "presidente": "CARLOS ARTURO ZABALA GALINDO", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-guerreros-bogota-fc-965';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3232429331', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DISTRITO NUEVA ERA F.C  (IDRD-CLUB-distrito-nueva-era-fc-916)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-distrito-nueva-era-fc-916';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DISTRITO NUEVA ERA F.C',
      'Presidente: BRAYAM SEBASTIAN ROJAS HERNÃNDEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 916. Vigente hasta 2028-08-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3214702763',
      'clubdeportivonuevaerafs2018@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'distrito-nueva-era-fc-916',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-distrito-nueva-era-fc-916', v_school_id, '{"resolucion_rd": "916", "resolucion_actualizacion": null, "fecha_inicio": "25-08-2023", "fecha_fin": "2028-08-24", "presidente": "BRAYAM SEBASTIAN ROJAS HERNÃNDEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BRAYAM SEBASTIAN ROJAS HERNÃNDEZ. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 916. Vigente hasta 2028-08-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214702763', phone),
      email       = COALESCE('clubdeportivonuevaerafs2018@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "916", "resolucion_actualizacion": null, "fecha_inicio": "25-08-2023", "fecha_fin": "2028-08-24", "presidente": "BRAYAM SEBASTIAN ROJAS HERNÃNDEZ", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-distrito-nueva-era-fc-916';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3214702763', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SUPER X BMX  (IDRD-CLUB-super-x-bmx-976)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-super-x-bmx-976';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SUPER X BMX',
      'Presidente: ISABELLA GARZON BOHORQUEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 976. Vigente hasta 2028-08-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3103742361',
      'isabellagb99@outlook.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'super-x-bmx-976',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-super-x-bmx-976', v_school_id, '{"resolucion_rd": "976", "resolucion_actualizacion": null, "fecha_inicio": "29-08-2023", "fecha_fin": "2028-08-28", "presidente": "ISABELLA GARZON BOHORQUEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ISABELLA GARZON BOHORQUEZ. Deporte(s): Ciclismo. Localidad: Engativá. Resolución R-D Nº 976. Vigente hasta 2028-08-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103742361', phone),
      email       = COALESCE('isabellagb99@outlook.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "976", "resolucion_actualizacion": null, "fecha_inicio": "29-08-2023", "fecha_fin": "2028-08-28", "presidente": "ISABELLA GARZON BOHORQUEZ", "localidad": "Engativá", "sports": ["Ciclismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-super-x-bmx-976';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3103742361', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- SUPER X BMX  (IDRD-CLUB-super-x-bmx-977)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-super-x-bmx-977';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SUPER X BMX',
      'Presidente: MANUEL OSWALDO BALLESTEROS BELTRAN. Deporte(s): Tenis. Localidad: Chapinero. Resolución R-D Nº 977. Vigente hasta 2028-08-28. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Chapinero',
      '3175668392',
      'whiteballtt@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'super-x-bmx-977',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-super-x-bmx-977', v_school_id, '{"resolucion_rd": "977", "resolucion_actualizacion": null, "fecha_inicio": "29-08-2023", "fecha_fin": "2028-08-28", "presidente": "MANUEL OSWALDO BALLESTEROS BELTRAN", "localidad": "Chapinero", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MANUEL OSWALDO BALLESTEROS BELTRAN. Deporte(s): Tenis. Localidad: Chapinero. Resolución R-D Nº 977. Vigente hasta 2028-08-28. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3175668392', phone),
      email       = COALESCE('whiteballtt@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "977", "resolucion_actualizacion": null, "fecha_inicio": "29-08-2023", "fecha_fin": "2028-08-28", "presidente": "MANUEL OSWALDO BALLESTEROS BELTRAN", "localidad": "Chapinero", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-super-x-bmx-977';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Chapinero', 'Bogotá', '3175668392', 4.6365850, -74.0650204, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO LIBERTY TEAM  (IDRD-CLUB-club-deportivo-liberty-team-535)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-liberty-team-535';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO LIBERTY TEAM',
      'Presidente: SEBASTIAN FERRUCHO ROMERO. Deporte(s): Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 535. Vigente hasta 2030-05-30. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3103174109',
      'libertybasketballclub@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-liberty-team-535',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-liberty-team-535', v_school_id, '{"resolucion_rd": "535", "resolucion_actualizacion": null, "fecha_inicio": "30-05-2025", "fecha_fin": "2030-05-30", "presidente": "SEBASTIAN FERRUCHO ROMERO", "localidad": "San Cristóbal", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SEBASTIAN FERRUCHO ROMERO. Deporte(s): Baloncesto. Localidad: San Cristóbal. Resolución R-D Nº 535. Vigente hasta 2030-05-30. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103174109', phone),
      email       = COALESCE('libertybasketballclub@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "535", "resolucion_actualizacion": null, "fecha_inicio": "30-05-2025", "fecha_fin": "2030-05-30", "presidente": "SEBASTIAN FERRUCHO ROMERO", "localidad": "San Cristóbal", "sports": ["Baloncesto"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-liberty-team-535';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3103174109', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- COLOMBIA TENIS ENTER  (IDRD-CLUB-colombia-tenis-enter-1053)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-colombia-tenis-enter-1053';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'COLOMBIA TENIS ENTER',
      'Presidente: VICTOR JAVIER RAMIREZ ROBAYO. Deporte(s): Tenis. Localidad: Tunjuelito. Resolución R-D Nº 1053. Vigente hasta 2028-09-12. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3134316444',
      'clubcolombiatenisenter@gmail.com',
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'colombia-tenis-enter-1053',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-colombia-tenis-enter-1053', v_school_id, '{"resolucion_rd": "1053", "resolucion_actualizacion": null, "fecha_inicio": "13-09-2023", "fecha_fin": "2028-09-12", "presidente": "VICTOR JAVIER RAMIREZ ROBAYO", "localidad": "Tunjuelito", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: VICTOR JAVIER RAMIREZ ROBAYO. Deporte(s): Tenis. Localidad: Tunjuelito. Resolución R-D Nº 1053. Vigente hasta 2028-09-12. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3134316444', phone),
      email       = COALESCE('clubcolombiatenisenter@gmail.com', email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1053", "resolucion_actualizacion": null, "fecha_inicio": "13-09-2023", "fecha_fin": "2028-09-12", "presidente": "VICTOR JAVIER RAMIREZ ROBAYO", "localidad": "Tunjuelito", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-colombia-tenis-enter-1053';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3134316444', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- UNIÃN LANCEROS BOGOTÃ  (IDRD-CLUB-unian-lanceros-bogota-1068)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-unian-lanceros-bogota-1068';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'UNIÃN LANCEROS BOGOTÃ',
      'Presidente: HENRY EDUARDO DIAZ GARCIA. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1068. Vigente hasta 2028-09-18. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3246543105',
      'jesus-19890@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'unian-lanceros-bogota-1068',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-unian-lanceros-bogota-1068', v_school_id, '{"resolucion_rd": "1068", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2023", "fecha_fin": "2028-09-18", "presidente": "HENRY EDUARDO DIAZ GARCIA", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HENRY EDUARDO DIAZ GARCIA. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1068. Vigente hasta 2028-09-18. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3246543105', phone),
      email       = COALESCE('jesus-19890@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1068", "resolucion_actualizacion": null, "fecha_inicio": "19-09-2023", "fecha_fin": "2028-09-18", "presidente": "HENRY EDUARDO DIAZ GARCIA", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-unian-lanceros-bogota-1068';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3246543105', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO S.E.O  (IDRD-CLUB-club-deportivo-seo-1079)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-seo-1079';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO S.E.O',
      'Presidente: HUMBERTO VALENZUELA BELTRAN. Deporte(s): Fútbol de salón. Localidad: Puente Aranda. Resolución R-D Nº 1079. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '4745550',
      'sports.events.org@gmail.com',
      ARRAY['Fútbol de salón']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-seo-1079',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-seo-1079', v_school_id, '{"resolucion_rd": "1079", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "HUMBERTO VALENZUELA BELTRAN", "localidad": "Puente Aranda", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: HUMBERTO VALENZUELA BELTRAN. Deporte(s): Fútbol de salón. Localidad: Puente Aranda. Resolución R-D Nº 1079. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('4745550', phone),
      email       = COALESCE('sports.events.org@gmail.com', email),
      sports      = ARRAY['Fútbol de salón']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1079", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "HUMBERTO VALENZUELA BELTRAN", "localidad": "Puente Aranda", "sports": ["Fútbol de salón"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-seo-1079';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '4745550', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CTIGERS  (IDRD-CLUB-ctigers-1080)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-ctigers-1080';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CTIGERS',
      'Presidente: PEDRO LEONARDO DIMAS GARCIA. Deporte(s): Taekwondo. Localidad: San Cristóbal. Resolución R-D Nº 1080. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3043954586',
      'nidanax@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'ctigers-1080',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-ctigers-1080', v_school_id, '{"resolucion_rd": "1080", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "PEDRO LEONARDO DIMAS GARCIA", "localidad": "San Cristóbal", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO LEONARDO DIMAS GARCIA. Deporte(s): Taekwondo. Localidad: San Cristóbal. Resolución R-D Nº 1080. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3043954586', phone),
      email       = COALESCE('nidanax@hotmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1080", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "PEDRO LEONARDO DIMAS GARCIA", "localidad": "San Cristóbal", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-ctigers-1080';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3043954586', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- REVOLUTION SOCCER F.C  (IDRD-CLUB-revolution-soccer-fc-1081)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-revolution-soccer-fc-1081';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'REVOLUTION SOCCER F.C',
      'Presidente: MICHAEL ANDRES URREGO CAMARGO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1081. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3118425388',
      'acrevolutionsoccer@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'revolution-soccer-fc-1081',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-revolution-soccer-fc-1081', v_school_id, '{"resolucion_rd": "1081", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "MICHAEL ANDRES URREGO CAMARGO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MICHAEL ANDRES URREGO CAMARGO. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1081. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3118425388', phone),
      email       = COALESCE('acrevolutionsoccer@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1081", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "MICHAEL ANDRES URREGO CAMARGO", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-revolution-soccer-fc-1081';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3118425388', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO DE ESCALADA LA GUACA  (IDRD-CLUB-club-deportivo-de-escalada-la-guaca-1084)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-escalada-la-guaca-1084';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO DE ESCALADA LA GUACA',
      'Presidente: TATIANA LIZETH BOGOTA BARRERA. Deporte(s): Escalada Deportiva. Localidad: Teusaquillo. Resolución R-D Nº 1084. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Teusaquillo',
      '6017722198',
      'guacaescaladabogota@gmail.com',
      ARRAY['Escalada Deportiva']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-de-escalada-la-guaca-1084',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-de-escalada-la-guaca-1084', v_school_id, '{"resolucion_rd": "1084", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "TATIANA LIZETH BOGOTA BARRERA", "localidad": "Teusaquillo", "sports": ["Escalada Deportiva"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: TATIANA LIZETH BOGOTA BARRERA. Deporte(s): Escalada Deportiva. Localidad: Teusaquillo. Resolución R-D Nº 1084. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('6017722198', phone),
      email       = COALESCE('guacaescaladabogota@gmail.com', email),
      sports      = ARRAY['Escalada Deportiva']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1084", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "TATIANA LIZETH BOGOTA BARRERA", "localidad": "Teusaquillo", "sports": ["Escalada Deportiva"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-de-escalada-la-guaca-1084';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Teusaquillo', 'Bogotá', '6017722198', 4.6286663, -74.0752959, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- GL SPORTS  (IDRD-CLUB-gl-sports-1088)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-gl-sports-1088';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'GL SPORTS',
      'Presidente: DERLY NATHALY LOPEZ MORA. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1088. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3188206876',
      'centrodeportivogl@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'gl-sports-1088',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-gl-sports-1088', v_school_id, '{"resolucion_rd": "1088", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "DERLY NATHALY LOPEZ MORA", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: DERLY NATHALY LOPEZ MORA. Deporte(s): Taekwondo. Localidad: Suba. Resolución R-D Nº 1088. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3188206876', phone),
      email       = COALESCE('centrodeportivogl@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1088", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "DERLY NATHALY LOPEZ MORA", "localidad": "Suba", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-gl-sports-1088';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3188206876', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TENIS NORMALOP  (IDRD-CLUB-tenis-normalop-1091)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-tenis-normalop-1091';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TENIS NORMALOP',
      'Presidente: NORMA YISELA FLAUTERO LOPEZ. Deporte(s): Tenis. Localidad: Usaquén. Resolución R-D Nº 1091. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3103420430',
      NULL,
      ARRAY['Tenis']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'tenis-normalop-1091',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-tenis-normalop-1091', v_school_id, '{"resolucion_rd": "1091", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "NORMA YISELA FLAUTERO LOPEZ", "localidad": "Usaquén", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NORMA YISELA FLAUTERO LOPEZ. Deporte(s): Tenis. Localidad: Usaquén. Resolución R-D Nº 1091. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103420430', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Tenis']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1091", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "NORMA YISELA FLAUTERO LOPEZ", "localidad": "Usaquén", "sports": ["Tenis"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-tenis-normalop-1091';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3103420430', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO CAZUCÃÂ FÃÅ¡TBOL CLUB  (IDRD-CLUB-club-deportivo-cazucaa-faatbol-club-357)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-cazucaa-faatbol-club-357';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO CAZUCÃÂ FÃÅ¡TBOL CLUB',
      'Presidente: JOSE DAVID OSORIO CASTRO. Deporte(s): Karts. Localidad: Barrios Unidos. Resolución R-D Nº 357 / actualización Nº 978. Vigente hasta 2030-04-22. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3046670842',
      'david.osorio@tiempodejuego.org',
      ARRAY['Karts']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-cazucaa-faatbol-club-357',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-cazucaa-faatbol-club-357', v_school_id, '{"resolucion_rd": "357", "resolucion_actualizacion": "978", "fecha_inicio": "22-04-2025", "fecha_fin": "2030-04-22", "presidente": "JOSE DAVID OSORIO CASTRO", "localidad": "Barrios Unidos", "sports": ["Karts"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE DAVID OSORIO CASTRO. Deporte(s): Karts. Localidad: Barrios Unidos. Resolución R-D Nº 357 / actualización Nº 978. Vigente hasta 2030-04-22. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3046670842', phone),
      email       = COALESCE('david.osorio@tiempodejuego.org', email),
      sports      = ARRAY['Karts']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "357", "resolucion_actualizacion": "978", "fecha_inicio": "22-04-2025", "fecha_fin": "2030-04-22", "presidente": "JOSE DAVID OSORIO CASTRO", "localidad": "Barrios Unidos", "sports": ["Karts"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-cazucaa-faatbol-club-357';
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
-- BAYERN EVOLUTION F.C  (IDRD-CLUB-bayern-evolution-fc-1098)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-bayern-evolution-fc-1098';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'BAYERN EVOLUTION F.C',
      'Presidente: PEDRO NEL SUESCUN RODRIGUEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1098. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3106999175',
      'bayern.evolution.fc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'bayern-evolution-fc-1098',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-bayern-evolution-fc-1098', v_school_id, '{"resolucion_rd": "1098", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "PEDRO NEL SUESCUN RODRIGUEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: PEDRO NEL SUESCUN RODRIGUEZ. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1098. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3106999175', phone),
      email       = COALESCE('bayern.evolution.fc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1098", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "PEDRO NEL SUESCUN RODRIGUEZ", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-bayern-evolution-fc-1098';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3106999175', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- AT MY HOUSE PROJECT  (IDRD-CLUB-at-my-house-project-1101)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-at-my-house-project-1101';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'AT MY HOUSE PROJECT',
      'Presidente: JOSE LUIS CUESTA RAMIREZ. Deporte(s): Baile Deportivo. Localidad: Antonio Nariño. Resolución R-D Nº 1101. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Antonio Nariño',
      '3214301495',
      'atmyhouseproject@gmail.com',
      ARRAY['Baile Deportivo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'at-my-house-project-1101',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-at-my-house-project-1101', v_school_id, '{"resolucion_rd": "1101", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "JOSE LUIS CUESTA RAMIREZ", "localidad": "Antonio Nariño", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JOSE LUIS CUESTA RAMIREZ. Deporte(s): Baile Deportivo. Localidad: Antonio Nariño. Resolución R-D Nº 1101. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214301495', phone),
      email       = COALESCE('atmyhouseproject@gmail.com', email),
      sports      = ARRAY['Baile Deportivo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1101", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "JOSE LUIS CUESTA RAMIREZ", "localidad": "Antonio Nariño", "sports": ["Baile Deportivo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-at-my-house-project-1101';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Antonio Nariño', 'Bogotá', '3214301495', 4.6256951, -74.0872914, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCALADA EL TOP  (IDRD-CLUB-escalada-el-top-1107)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-escalada-el-top-1107';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCALADA EL TOP',
      'Presidente: JUDIT ESTER NOREÃA TORRES. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1107. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3008009561',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'escalada-el-top-1107',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-escalada-el-top-1107', v_school_id, '{"resolucion_rd": "1107", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "JUDIT ESTER NOREÃA TORRES", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JUDIT ESTER NOREÃA TORRES. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1107. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008009561', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1107", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "JUDIT ESTER NOREÃA TORRES", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-escalada-el-top-1107';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3008009561', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KICK BOXING BROTHERS FITNESS  (IDRD-CLUB-kick-boxing-brothers-fitness-1110)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kick-boxing-brothers-fitness-1110';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KICK BOXING BROTHERS FITNESS',
      'Presidente: BAYRON RODRIGUEZ RUNZA. Deporte(s): Kick Boxing. Localidad: Engativá. Resolución R-D Nº 1110. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3022292031',
      NULL,
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kick-boxing-brothers-fitness-1110',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kick-boxing-brothers-fitness-1110', v_school_id, '{"resolucion_rd": "1110", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "BAYRON RODRIGUEZ RUNZA", "localidad": "Engativá", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BAYRON RODRIGUEZ RUNZA. Deporte(s): Kick Boxing. Localidad: Engativá. Resolución R-D Nº 1110. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3022292031', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1110", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "BAYRON RODRIGUEZ RUNZA", "localidad": "Engativá", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kick-boxing-brothers-fitness-1110';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3022292031', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FITNESS SPORT  (IDRD-CLUB-fitness-sport-1111)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-fitness-sport-1111';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FITNESS SPORT',
      'Presidente: OSCAR IVAN ACOSTA RODRIGUEZ. Deporte(s): Natación. Localidad: Tunjuelito. Resolución R-D Nº 1111. Vigente hasta 2028-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3142206217',
      'oscarinverxa@hotmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'fitness-sport-1111',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-fitness-sport-1111', v_school_id, '{"resolucion_rd": "1111", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2023", "fecha_fin": "2028-09-24", "presidente": "OSCAR IVAN ACOSTA RODRIGUEZ", "localidad": "Tunjuelito", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: OSCAR IVAN ACOSTA RODRIGUEZ. Deporte(s): Natación. Localidad: Tunjuelito. Resolución R-D Nº 1111. Vigente hasta 2028-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3142206217', phone),
      email       = COALESCE('oscarinverxa@hotmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1111", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2023", "fecha_fin": "2028-09-24", "presidente": "OSCAR IVAN ACOSTA RODRIGUEZ", "localidad": "Tunjuelito", "sports": ["Natación"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-fitness-sport-1111';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3142206217', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CAPITAL SK  (IDRD-CLUB-capital-sk-1115)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-capital-sk-1115';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CAPITAL SK',
      'Presidente: MARIA FERNANDA PINILLA RODRIGUEZ. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1115. Vigente hasta 2028-09-24. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3163087496',
      'clubdeportivocapitalsk@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'capital-sk-1115',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-capital-sk-1115', v_school_id, '{"resolucion_rd": "1115", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2023", "fecha_fin": "2028-09-24", "presidente": "MARIA FERNANDA PINILLA RODRIGUEZ", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIA FERNANDA PINILLA RODRIGUEZ. Deporte(s): Patinaje. Localidad: Ciudad Bolívar. Resolución R-D Nº 1115. Vigente hasta 2028-09-24. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3163087496', phone),
      email       = COALESCE('clubdeportivocapitalsk@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1115", "resolucion_actualizacion": null, "fecha_inicio": "25-09-2023", "fecha_fin": "2028-09-24", "presidente": "MARIA FERNANDA PINILLA RODRIGUEZ", "localidad": "Ciudad Bolívar", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-capital-sk-1115';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3163087496', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CITY F.C AZUL Y BLANCO  (IDRD-CLUB-city-fc-azul-y-blanco-1102)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-city-fc-azul-y-blanco-1102';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CITY F.C AZUL Y BLANCO',
      'Presidente: ANDRES FERNEY AGUDELO BAUTISTA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1102. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Bosa',
      '3008662613',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'city-fc-azul-y-blanco-1102',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-city-fc-azul-y-blanco-1102', v_school_id, '{"resolucion_rd": "1102", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "ANDRES FERNEY AGUDELO BAUTISTA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANDRES FERNEY AGUDELO BAUTISTA. Deporte(s): Fútbol. Localidad: Bosa. Resolución R-D Nº 1102. Vigente hasta 2028-09-21. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008662613', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1102", "resolucion_actualizacion": null, "fecha_inicio": "22-09-2023", "fecha_fin": "2028-09-21", "presidente": "ANDRES FERNEY AGUDELO BAUTISTA", "localidad": "Bosa", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-city-fc-azul-y-blanco-1102';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Bosa', 'Bogotá', '3008662613', 4.5968789, -74.1809427, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLÃTICO MILAN  (IDRD-CLUB-atlatico-milan-1140)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atlatico-milan-1140';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLÃTICO MILAN',
      'Presidente: CARLOS JOAU GARCIA FONSECA. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1140. Vigente hasta 2028-09-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3107978059',
      'milanbogotaromario@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atlatico-milan-1140',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atlatico-milan-1140', v_school_id, '{"resolucion_rd": "1140", "resolucion_actualizacion": null, "fecha_inicio": "26-09-2023", "fecha_fin": "2028-09-25", "presidente": "CARLOS JOAU GARCIA FONSECA", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS JOAU GARCIA FONSECA. Deporte(s): Fútbol. Localidad: San Cristóbal. Resolución R-D Nº 1140. Vigente hasta 2028-09-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3107978059', phone),
      email       = COALESCE('milanbogotaromario@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1140", "resolucion_actualizacion": null, "fecha_inicio": "26-09-2023", "fecha_fin": "2028-09-25", "presidente": "CARLOS JOAU GARCIA FONSECA", "localidad": "San Cristóbal", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atlatico-milan-1140';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3107978059', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CLUB DEPORTIVO C&T  (IDRD-CLUB-club-deportivo-ct-1128)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-club-deportivo-ct-1128';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CLUB DEPORTIVO C&T',
      'Presidente: CARLOS ARTURO GÃMEZ SANTISTEBAN. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1128. Vigente hasta 2028-09-25. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usme',
      '3204137995',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'club-deportivo-ct-1128',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-club-deportivo-ct-1128', v_school_id, '{"resolucion_rd": "1128", "resolucion_actualizacion": null, "fecha_inicio": "26-09-2023", "fecha_fin": "2028-09-25", "presidente": "CARLOS ARTURO GÃMEZ SANTISTEBAN", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CARLOS ARTURO GÃMEZ SANTISTEBAN. Deporte(s): Fútbol. Localidad: Usme. Resolución R-D Nº 1128. Vigente hasta 2028-09-25. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204137995', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1128", "resolucion_actualizacion": null, "fecha_inicio": "26-09-2023", "fecha_fin": "2028-09-25", "presidente": "CARLOS ARTURO GÃMEZ SANTISTEBAN", "localidad": "Usme", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-club-deportivo-ct-1128';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usme', 'Bogotá', '3204137995', 4.5081097, -74.1143194, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- KICK BOXING SUPREME  (IDRD-CLUB-kick-boxing-supreme-1160)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-kick-boxing-supreme-1160';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'KICK BOXING SUPREME',
      'Presidente: SERGIO SALAMANCA RENTERIA. Deporte(s): Kick Boxing. Localidad: Puente Aranda. Resolución R-D Nº 1160. Vigente hasta 2028-09-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Puente Aranda',
      '3214043594',
      'ssalamancae79@gmail.com',
      ARRAY['Kick Boxing']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'kick-boxing-supreme-1160',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-kick-boxing-supreme-1160', v_school_id, '{"resolucion_rd": "1160", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2023", "fecha_fin": "2028-09-26", "presidente": "SERGIO SALAMANCA RENTERIA", "localidad": "Puente Aranda", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: SERGIO SALAMANCA RENTERIA. Deporte(s): Kick Boxing. Localidad: Puente Aranda. Resolución R-D Nº 1160. Vigente hasta 2028-09-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3214043594', phone),
      email       = COALESCE('ssalamancae79@gmail.com', email),
      sports      = ARRAY['Kick Boxing']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1160", "resolucion_actualizacion": null, "fecha_inicio": "27-09-2023", "fecha_fin": "2028-09-26", "presidente": "SERGIO SALAMANCA RENTERIA", "localidad": "Puente Aranda", "sports": ["Kick Boxing"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-kick-boxing-supreme-1160';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Puente Aranda', 'Bogotá', '3214043594', 4.6344035, -74.1083568, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MODELO TEAM  (IDRD-CLUB-modelo-team-1196)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-modelo-team-1196';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MODELO TEAM',
      'Presidente: MARIANA CARDENAS CATAÃO. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 1196. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Barrios Unidos',
      '3123925731',
      'teamodelonorte1@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'modelo-team-1196',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-modelo-team-1196', v_school_id, '{"resolucion_rd": "1196", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "MARIANA CARDENAS CATAÃO", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MARIANA CARDENAS CATAÃO. Deporte(s): Fútbol. Localidad: Barrios Unidos. Resolución R-D Nº 1196. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3123925731', phone),
      email       = COALESCE('teamodelonorte1@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1196", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "MARIANA CARDENAS CATAÃO", "localidad": "Barrios Unidos", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-modelo-team-1196';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrios Unidos', 'Bogotá', '3123925731', 4.6553520, -74.0775920, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LEON DE ORO  (IDRD-CLUB-leon-de-oro-1198)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-leon-de-oro-1198';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEON DE ORO',
      'Presidente: JHONATAN ERNESTO CORTES MARIN. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1198. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Ciudad Bolívar',
      '3138341900',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'leon-de-oro-1198',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-leon-de-oro-1198', v_school_id, '{"resolucion_rd": "1198", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "JHONATAN ERNESTO CORTES MARIN", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: JHONATAN ERNESTO CORTES MARIN. Deporte(s): Fútbol. Localidad: Ciudad Bolívar. Resolución R-D Nº 1198. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3138341900', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1198", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "JHONATAN ERNESTO CORTES MARIN", "localidad": "Ciudad Bolívar", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-leon-de-oro-1198';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Ciudad Bolívar', 'Bogotá', '3138341900', 4.5681900, -74.1540483, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LA HERMANDAD  (IDRD-CLUB-la-hermandad-1200)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-la-hermandad-1200';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LA HERMANDAD',
      'Presidente: BRANDON ESTID ESCOBAR DIAZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1200. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Kennedy',
      '3204705212',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'la-hermandad-1200',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-la-hermandad-1200', v_school_id, '{"resolucion_rd": "1200", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "BRANDON ESTID ESCOBAR DIAZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: BRANDON ESTID ESCOBAR DIAZ. Deporte(s): Fútbol. Localidad: Kennedy. Resolución R-D Nº 1200. Vigente hasta 2028-10-05. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3204705212', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1200", "resolucion_actualizacion": null, "fecha_inicio": "06-10-2023", "fecha_fin": "2028-10-05", "presidente": "BRANDON ESTID ESCOBAR DIAZ", "localidad": "Kennedy", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-la-hermandad-1200';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Kennedy', 'Bogotá', '3204705212', 4.6317782, -74.1538873, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- INTEGRARTE F.C  (IDRD-CLUB-integrarte-fc-1195)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-integrarte-fc-1195';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INTEGRARTE F.C',
      'Presidente: ANA LUCIA RUBIO AMAYA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1195. Vigente hasta 2028-10-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3228143489',
      'fcintegrarte@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'integrarte-fc-1195',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-integrarte-fc-1195', v_school_id, '{"resolucion_rd": "1195", "resolucion_actualizacion": null, "fecha_inicio": "09-10-2023", "fecha_fin": "2028-10-08", "presidente": "ANA LUCIA RUBIO AMAYA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: ANA LUCIA RUBIO AMAYA. Deporte(s): Fútbol. Localidad: Suba. Resolución R-D Nº 1195. Vigente hasta 2028-10-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3228143489', phone),
      email       = COALESCE('fcintegrarte@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1195", "resolucion_actualizacion": null, "fecha_inicio": "09-10-2023", "fecha_fin": "2028-10-08", "presidente": "ANA LUCIA RUBIO AMAYA", "localidad": "Suba", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-integrarte-fc-1195';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3228143489', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- VENUS SKATE PATINAJE ARTISTICO  (IDRD-CLUB-venus-skate-patinaje-artistico-1141)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-venus-skate-patinaje-artistico-1141';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'VENUS SKATE PATINAJE ARTISTICO',
      'Presidente: GUSTAVO ADOLFO SOTO VELASCO. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 1141. Vigente hasta 2028-10-15. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3183540857',
      'gustavosotovelasco@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'venus-skate-patinaje-artistico-1141',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-venus-skate-patinaje-artistico-1141', v_school_id, '{"resolucion_rd": "1141", "resolucion_actualizacion": null, "fecha_inicio": "16-10-2023", "fecha_fin": "2028-10-15", "presidente": "GUSTAVO ADOLFO SOTO VELASCO", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: GUSTAVO ADOLFO SOTO VELASCO. Deporte(s): Patinaje. Localidad: Usaquén. Resolución R-D Nº 1141. Vigente hasta 2028-10-15. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3183540857', phone),
      email       = COALESCE('gustavosotovelasco@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1141", "resolucion_actualizacion": null, "fecha_inicio": "16-10-2023", "fecha_fin": "2028-10-15", "presidente": "GUSTAVO ADOLFO SOTO VELASCO", "localidad": "Usaquén", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-venus-skate-patinaje-artistico-1141';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3183540857', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- FOR-CAMP  (IDRD-CLUB-for-camp-1241)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-for-camp-1241';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'FOR-CAMP',
      'Presidente: LUIS ALEJANDRO NOSSA QUIROGA. Deporte(s): Atletismo. Localidad: San Cristóbal. Resolución R-D Nº 1241. Vigente hasta 2028-10-16. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'San Cristóbal',
      '3507790776',
      'alenosq007@gmail.com',
      ARRAY['Atletismo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'for-camp-1241',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-for-camp-1241', v_school_id, '{"resolucion_rd": "1241", "resolucion_actualizacion": null, "fecha_inicio": "17-10-2023", "fecha_fin": "2028-10-16", "presidente": "LUIS ALEJANDRO NOSSA QUIROGA", "localidad": "San Cristóbal", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LUIS ALEJANDRO NOSSA QUIROGA. Deporte(s): Atletismo. Localidad: San Cristóbal. Resolución R-D Nº 1241. Vigente hasta 2028-10-16. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3507790776', phone),
      email       = COALESCE('alenosq007@gmail.com', email),
      sports      = ARRAY['Atletismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1241", "resolucion_actualizacion": null, "fecha_inicio": "17-10-2023", "fecha_fin": "2028-10-16", "presidente": "LUIS ALEJANDRO NOSSA QUIROGA", "localidad": "San Cristóbal", "sports": ["Atletismo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-for-camp-1241';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'San Cristóbal', 'Bogotá', '3507790776', 4.5685350, -74.0944791, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- LEBUT FC  (IDRD-CLUB-lebut-fc-1267)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-lebut-fc-1267';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'LEBUT FC',
      'Presidente: RANDOLF DAVID SILVERA CABRERA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1267. Vigente hasta 2028-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Usaquén',
      '3124461161',
      'lebutfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'lebut-fc-1267',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-lebut-fc-1267', v_school_id, '{"resolucion_rd": "1267", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2023", "fecha_fin": "2028-10-19", "presidente": "RANDOLF DAVID SILVERA CABRERA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RANDOLF DAVID SILVERA CABRERA. Deporte(s): Fútbol. Localidad: Usaquén. Resolución R-D Nº 1267. Vigente hasta 2028-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3124461161', phone),
      email       = COALESCE('lebutfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1267", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2023", "fecha_fin": "2028-10-19", "presidente": "RANDOLF DAVID SILVERA CABRERA", "localidad": "Usaquén", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-lebut-fc-1267';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Usaquén', 'Bogotá', '3124461161', 4.6930109, -74.0316832, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- DM BOGOTÃ  (IDRD-CLUB-dm-bogota-1270)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-dm-bogota-1270';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'DM BOGOTÃ',
      'Presidente: seÃ±or DIEGO CAMILO PARRA MELLIZO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1270. Vigente hasta 2028-10-19. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3144040257',
      'teambogotadc@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'dm-bogota-1270',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-dm-bogota-1270', v_school_id, '{"resolucion_rd": "1270", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2023", "fecha_fin": "2028-10-19", "presidente": "seÃ±or DIEGO CAMILO PARRA MELLIZO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: seÃ±or DIEGO CAMILO PARRA MELLIZO. Deporte(s): Patinaje. Localidad: Engativá. Resolución R-D Nº 1270. Vigente hasta 2028-10-19. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3144040257', phone),
      email       = COALESCE('teambogotadc@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1270", "resolucion_actualizacion": null, "fecha_inicio": "20-10-2023", "fecha_fin": "2028-10-19", "presidente": "seÃ±or DIEGO CAMILO PARRA MELLIZO", "localidad": "Engativá", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-dm-bogota-1270';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3144040257', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- ATLETICO BOGOTA  (IDRD-CLUB-atletico-bogota-1300)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-atletico-bogota-1300';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ATLETICO BOGOTA',
      'Presidente: NICOLAS ANDRES RAMIREZ HERRERA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1300. Vigente hasta 2028-10-23. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Tunjuelito',
      '3209082508',
      NULL,
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'atletico-bogota-1300',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-atletico-bogota-1300', v_school_id, '{"resolucion_rd": "1300", "resolucion_actualizacion": null, "fecha_inicio": "24-10-2023", "fecha_fin": "2028-10-23", "presidente": "NICOLAS ANDRES RAMIREZ HERRERA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: NICOLAS ANDRES RAMIREZ HERRERA. Deporte(s): Fútbol. Localidad: Tunjuelito. Resolución R-D Nº 1300. Vigente hasta 2028-10-23. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3209082508', phone),
      email       = COALESCE(NULL, email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1300", "resolucion_actualizacion": null, "fecha_inicio": "24-10-2023", "fecha_fin": "2028-10-23", "presidente": "NICOLAS ANDRES RAMIREZ HERRERA", "localidad": "Tunjuelito", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-atletico-bogota-1300';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Tunjuelito', 'Bogotá', '3209082508', 4.5584337, -74.1284975, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- MAGA F.C  (IDRD-CLUB-maga-fc-1337)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-maga-fc-1337';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'MAGA F.C',
      'Presidente: MIGUEL ESTEBAN GARCÃA SANTANA. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1337. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Rafael Uribe Uribe',
      '3103307356',
      'clubdeportivomaga.c23@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'maga-fc-1337',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-maga-fc-1337', v_school_id, '{"resolucion_rd": "1337", "resolucion_actualizacion": null, "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "MIGUEL ESTEBAN GARCÃA SANTANA", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: MIGUEL ESTEBAN GARCÃA SANTANA. Deporte(s): Fútbol. Localidad: Rafael Uribe Uribe. Resolución R-D Nº 1337. Vigente hasta 2028-10-31. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3103307356', phone),
      email       = COALESCE('clubdeportivomaga.c23@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1337", "resolucion_actualizacion": null, "fecha_inicio": "01-11-2023", "fecha_fin": "2028-10-31", "presidente": "MIGUEL ESTEBAN GARCÃA SANTANA", "localidad": "Rafael Uribe Uribe", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-maga-fc-1337';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Rafael Uribe Uribe', 'Bogotá', '3103307356', 4.5733208, -74.1220602, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- CASELL FÃTBOL CLUB  (IDRD-CLUB-casell-fatbol-club-1339)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-casell-fatbol-club-1339';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'CASELL FÃTBOL CLUB',
      'Presidente: CAMILO ANDRÃS CASTILLA AGUILERA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1339. Vigente hasta 2028-10-26. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Engativá',
      '3057966766',
      'casellfutbolclub13@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'casell-fatbol-club-1339',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-casell-fatbol-club-1339', v_school_id, '{"resolucion_rd": "1339", "resolucion_actualizacion": null, "fecha_inicio": "27-10-2023", "fecha_fin": "2028-10-26", "presidente": "CAMILO ANDRÃS CASTILLA AGUILERA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: CAMILO ANDRÃS CASTILLA AGUILERA. Deporte(s): Fútbol. Localidad: Engativá. Resolución R-D Nº 1339. Vigente hasta 2028-10-26. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3057966766', phone),
      email       = COALESCE('casellfutbolclub13@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1339", "resolucion_actualizacion": null, "fecha_inicio": "27-10-2023", "fecha_fin": "2028-10-26", "presidente": "CAMILO ANDRÃS CASTILLA AGUILERA", "localidad": "Engativá", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-casell-fatbol-club-1339';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Engativá', 'Bogotá', '3057966766', 4.7140581, -74.1386323, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- EL DORADO 1987  (IDRD-CLUB-el-dorado-1987-1348)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-el-dorado-1987-1348';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'EL DORADO 1987',
      'Presidente: WILFER HUMBERTO DIAZ TAPIAS. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1348. Vigente hasta 2028-11-01. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3186082144',
      'transformemosbogota@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'el-dorado-1987-1348',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-el-dorado-1987-1348', v_school_id, '{"resolucion_rd": "1348", "resolucion_actualizacion": null, "fecha_inicio": "02-11-2023", "fecha_fin": "2028-11-01", "presidente": "WILFER HUMBERTO DIAZ TAPIAS", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: WILFER HUMBERTO DIAZ TAPIAS. Deporte(s): Fútbol. Localidad: Fontibón. Resolución R-D Nº 1348. Vigente hasta 2028-11-01. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3186082144', phone),
      email       = COALESCE('transformemosbogota@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1348", "resolucion_actualizacion": null, "fecha_inicio": "02-11-2023", "fecha_fin": "2028-11-01", "presidente": "WILFER HUMBERTO DIAZ TAPIAS", "localidad": "Fontibón", "sports": ["Fútbol"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-el-dorado-1987-1348';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3186082144', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- TAEKWONDO TAIDO  (IDRD-CLUB-taekwondo-taido-1377)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-taekwondo-taido-1377';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'TAEKWONDO TAIDO',
      'Presidente: RICHARD OSWALDO JAMAICA LASSO. Deporte(s): Taekwondo. Localidad: Fontibón. Resolución R-D Nº 1377. Vigente hasta 2028-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Fontibón',
      '3045679303',
      'taekwondotaido@gmail.com',
      ARRAY['Taekwondo']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'taekwondo-taido-1377',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-taekwondo-taido-1377', v_school_id, '{"resolucion_rd": "1377", "resolucion_actualizacion": null, "fecha_inicio": "09-11-2023", "fecha_fin": "2028-11-08", "presidente": "RICHARD OSWALDO JAMAICA LASSO", "localidad": "Fontibón", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: RICHARD OSWALDO JAMAICA LASSO. Deporte(s): Taekwondo. Localidad: Fontibón. Resolución R-D Nº 1377. Vigente hasta 2028-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3045679303', phone),
      email       = COALESCE('taekwondotaido@gmail.com', email),
      sports      = ARRAY['Taekwondo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1377", "resolucion_actualizacion": null, "fecha_inicio": "09-11-2023", "fecha_fin": "2028-11-08", "presidente": "RICHARD OSWALDO JAMAICA LASSO", "localidad": "Fontibón", "sports": ["Taekwondo"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-taekwondo-taido-1377';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Fontibón', 'Bogotá', '3045679303', 4.6732943, -74.1447464, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- ─────────────────────────────────────────────────────────
-- NEW WORLD SKATE  (IDRD-CLUB-new-world-skate-1373)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-CLUB-new-world-skate-1373';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'NEW WORLD SKATE',
      'Presidente: LILIAN JAZMIN BUITRAGO SUAREZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1373. Vigente hasta 2028-11-08. Club deportivo registrado ante el IDRD Bogotá',
      'club',
      'Bogotá',
      'Suba',
      '3008349628',
      'new.world.skate.club@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (registro oficial IDRD)
      false, -- is_demo
      'new-world-skate-1373',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_clubes_2026', 'IDRD-CLUB-new-world-skate-1373', v_school_id, '{"resolucion_rd": "1373", "resolucion_actualizacion": null, "fecha_inicio": "09-11-2023", "fecha_fin": "2028-11-08", "presidente": "LILIAN JAZMIN BUITRAGO SUAREZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = 'Presidente: LILIAN JAZMIN BUITRAGO SUAREZ. Deporte(s): Patinaje. Localidad: Suba. Resolución R-D Nº 1373. Vigente hasta 2028-11-08. Club deportivo registrado ante el IDRD Bogotá',
      phone       = COALESCE('3008349628', phone),
      email       = COALESCE('new.world.skate.club@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
    UPDATE public.external_school_imports SET raw_payload = '{"resolucion_rd": "1373", "resolucion_actualizacion": null, "fecha_inicio": "09-11-2023", "fecha_fin": "2028-11-08", "presidente": "LILIAN JAZMIN BUITRAGO SUAREZ", "localidad": "Suba", "sports": ["Patinaje"], "geo_source": "localidad_centroid"}'::jsonb, updated_at = now() WHERE external_ref = 'IDRD-CLUB-new-world-skate-1373';
  END IF;

  -- school_settings: REQUERIDO para aparecer en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Suba', 'Bogotá', '3008349628', 4.7501539, -74.0880740, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;
