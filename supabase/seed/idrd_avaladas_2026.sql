-- ============================================================
-- SPORTMAPS — Escuelas avaladas IDRD Bogota 2026 (auto-generado)
--
-- Origen: 02-escuelas-avaladas-2026-abril.xlsx
-- Generado por scripts/import_idrd_schools.py
-- Idempotente: usa external_school_imports(external_ref) UNIQUE
-- para evitar duplicados en re-runs.
-- ============================================================

BEGIN;

-- Tabla auxiliar de mapeo external_ref -> school_id
CREATE TABLE IF NOT EXISTS public.external_school_imports (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source        text NOT NULL,           -- 'idrd_bogota_2026'
    external_ref  text NOT NULL UNIQUE,    -- 'IDRD-AVAL-635'
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    raw_payload   jsonb,
    imported_at   timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_external_school_imports_source ON public.external_school_imports(source);
ALTER TABLE public.external_school_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "esi_super_admin_select" ON public.external_school_imports;
CREATE POLICY "esi_super_admin_select" ON public.external_school_imports FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')));

-- =====================  INSERTS  ============================

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA 369  (IDRD-AVAL-635)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-635';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA 369',
      'Director(a): MARIA FERNANDA PIÑEROS VILLALOBOS. Profesor(a): JUAN BAUTISTA FRANCO ARANDA. Escenario: PARQUE TIMIZA SEGUNDO SECTOR CALLE 40H SUR NO. 72R. Horarios: MARTES (4-6PM) VIERNES (4-6PM) SABADO (11-1PM) SOMINGO (8-10AM). Escuela avalada por IDRD Bogotá (Aval Nº 635)',
      'academy',
      'Bogotá',
      'CARRERA 24 No. 71-25',
      '3202310050',
      'treseisnuevemj@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-369-635',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-635', v_school_id, '{"aval": 635, "director": "MARIA FERNANDA PIÑEROS VILLALOBOS", "profesor": "JUAN BAUTISTA FRANCO ARANDA", "localidades": ["Barrios Unidos"], "barrio": "LOS ALCAZARES", "total_alumnos": 22, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): MARIA FERNANDA PIÑEROS VILLALOBOS. Profesor(a): JUAN BAUTISTA FRANCO ARANDA. Escenario: PARQUE TIMIZA SEGUNDO SECTOR CALLE 40H SUR NO. 72R. Horarios: MARTES (4-6PM) VIERNES (4-6PM) SABADO (11-1PM) SOMINGO (8-10AM). Escuela avalada por IDRD Bogotá (Aval Nº 635)',
      phone       = COALESCE('3202310050', phone),
      email       = COALESCE('treseisnuevemj@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE TIMIZA SEGUNDO SECTOR CALLE 40H SUR NO. 72R',
    'Bogotá',
    '3202310050',
    4.6553520, -74.0775920,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA MADRID FC  (IDRD-AVAL-124)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-124';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA MADRID FC',
      'Director(a): CARLOS ANDRES SERRANO. Profesor(a): JULIAN CAMILO APONTE. Escenario: PARQUE LA SERENA CARRERA 86 No. 90A-00. Horarios: SABADOS DE 8 A 10 AM DOMINGOS 10 A 12 M. Escuela avalada por IDRD Bogotá (Aval Nº 124)',
      'academy',
      'Bogotá',
      'DIAGONAL 86A No. 101-40 COMPARTIR BOCHICA ETAPA III INT 16 AP 101',
      '3213576746',
      'escueladeportivamadridfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-madrid-fc-124',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-124', v_school_id, '{"aval": 124, "director": "CARLOS ANDRES SERRANO", "profesor": "JULIAN CAMILO APONTE", "localidades": ["Engativá"], "barrio": "SERENA", "total_alumnos": 40, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CARLOS ANDRES SERRANO. Profesor(a): JULIAN CAMILO APONTE. Escenario: PARQUE LA SERENA CARRERA 86 No. 90A-00. Horarios: SABADOS DE 8 A 10 AM DOMINGOS 10 A 12 M. Escuela avalada por IDRD Bogotá (Aval Nº 124)',
      phone       = COALESCE('3213576746', phone),
      email       = COALESCE('escueladeportivamadridfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE LA SERENA CARRERA 86 No. 90A-00',
    'Bogotá',
    '3213576746',
    4.7096978, -74.0925608,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA COBOS  (IDRD-AVAL-131)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-131';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA COBOS',
      'Director(a): MARIA LUCERO ORTIZ NIETO. Profesor(a): JONNATHAN EDUARDO HERNANDEZ BEDOYA. Escenario: PARQUE EL JAZMIN CALLE 1G No. 41A- 39. Horarios: SABADOS Y DOMINGOS DE 10 A 12 M. Escuela avalada por IDRD Bogotá (Aval Nº 131)',
      'academy',
      'Bogotá',
      'CALLE 1D No. 40D-25',
      '3002752349',
      'cobosdc@outlook.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-cobos-131',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-131', v_school_id, '{"aval": 131, "director": "MARIA LUCERO ORTIZ NIETO", "profesor": "JONNATHAN EDUARDO HERNANDEZ BEDOYA", "localidades": ["Puente Aranda"], "barrio": "JAZMIN", "total_alumnos": 20, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): MARIA LUCERO ORTIZ NIETO. Profesor(a): JONNATHAN EDUARDO HERNANDEZ BEDOYA. Escenario: PARQUE EL JAZMIN CALLE 1G No. 41A- 39. Horarios: SABADOS Y DOMINGOS DE 10 A 12 M. Escuela avalada por IDRD Bogotá (Aval Nº 131)',
      phone       = COALESCE('3002752349', phone),
      email       = COALESCE('cobosdc@outlook.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE EL JAZMIN CALLE 1G No. 41A- 39',
    'Bogotá',
    '3002752349',
    4.6111503, -74.1143944,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA INTEGRAL BOGOTA  (IDRD-AVAL-134)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-134';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA INTEGRAL BOGOTA',
      'Director(a): OSCAR MARTINEZ GOMEZ. Profesor(a): OSCAR DAVID MARTINEZ. Escenario: PARQUE EL TUNAL Y CANCHA SINTETICA 14 DE MAYO. Horarios: PARQUE EL TUNAL SABADOS Y DOMINGOS DE 9 A 11 AM CANCHA SINTETICA 14 DE MAYO SABADOS Y DOMINGOS DE 9 A 11 AM. Escuela avalada por IDRD Bogotá (Aval Nº 134)',
      'academy',
      'Bogotá',
      'CARRERA 19B NO. 50A- 22 SUR',
      '3023217863',
      'escuelaintegraldebogota2009@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-integral-bogota-134',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-134', v_school_id, '{"aval": 134, "director": "OSCAR MARTINEZ GOMEZ", "profesor": "OSCAR DAVID MARTINEZ", "localidades": ["Tunjuelito"], "barrio": "TUNAL", "total_alumnos": 103, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): OSCAR MARTINEZ GOMEZ. Profesor(a): OSCAR DAVID MARTINEZ. Escenario: PARQUE EL TUNAL Y CANCHA SINTETICA 14 DE MAYO. Horarios: PARQUE EL TUNAL SABADOS Y DOMINGOS DE 9 A 11 AM CANCHA SINTETICA 14 DE MAYO SABADOS Y DOMINGOS DE 9 A 11 AM. Escuela avalada por IDRD Bogotá (Aval Nº 134)',
      phone       = COALESCE('3023217863', phone),
      email       = COALESCE('escuelaintegraldebogota2009@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE EL TUNAL Y CANCHA SINTETICA 14 DE MAYO',
    'Bogotá',
    '3023217863',
    4.5684954, -74.1397493,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA COP COLOMBIA INTERNACIONAL  (IDRD-AVAL-135)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-135';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA COP COLOMBIA INTERNACIONAL',
      'Director(a): ANA CAROLINA FLOREZ PEREZ. Profesor(a): CRISTIAN ANDRES SOTO GUZMAN. Escenario: PARQUE LA AURORA II CARRERA 3A NO. 71F 51 SUR. Horarios: SABADOS, DOMINGOS Y FESTIVOS DE 6 A 8 AM. Escuela avalada por IDRD Bogotá (Aval Nº 135)',
      'academy',
      'Bogotá',
      'TRANSVERSAL 14 P BIS No. 68A 97 SUR BARRIO COSTA RICA',
      '3107768910',
      'copcolombiainternacional@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-cop-colombia-internacional-135',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-135', v_school_id, '{"aval": 135, "director": "ANA CAROLINA FLOREZ PEREZ", "profesor": "CRISTIAN ANDRES SOTO GUZMAN", "localidades": ["Usme"], "barrio": "LA AURORA", "total_alumnos": 97, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): ANA CAROLINA FLOREZ PEREZ. Profesor(a): CRISTIAN ANDRES SOTO GUZMAN. Escenario: PARQUE LA AURORA II CARRERA 3A NO. 71F 51 SUR. Horarios: SABADOS, DOMINGOS Y FESTIVOS DE 6 A 8 AM. Escuela avalada por IDRD Bogotá (Aval Nº 135)',
      phone       = COALESCE('3107768910', phone),
      email       = COALESCE('copcolombiainternacional@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE LA AURORA II CARRERA 3A NO. 71F 51 SUR',
    'Bogotá',
    '3107768910',
    4.5231879, -74.1228126,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA LEONES ZION  (IDRD-AVAL-200)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-200';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA LEONES ZION',
      'Director(a): SANDRA PATRICIA CELY ORTIZ. Profesor(a): HENRY ANDRES GONZALEZ CORRALES. Escenario: AV Boyaca No. 142 A 55. Horarios: lunes de 4 a 6pm Miercoles de 4 a 6 Vierenes de 4 a 6 pm y Sabados de 8 a 10 am. Escuela avalada por IDRD Bogotá (Aval Nº 200)',
      'academy',
      'Bogotá',
      'CALLE 58D No. 48B 15',
      '3124255117',
      'leones.zion@outlook.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-leones-zion-200',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-200', v_school_id, '{"aval": 200, "director": "SANDRA PATRICIA CELY ORTIZ", "profesor": "HENRY ANDRES GONZALEZ CORRALES", "localidades": ["Suba"], "barrio": "", "total_alumnos": 24, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): SANDRA PATRICIA CELY ORTIZ. Profesor(a): HENRY ANDRES GONZALEZ CORRALES. Escenario: AV Boyaca No. 142 A 55. Horarios: lunes de 4 a 6pm Miercoles de 4 a 6 Vierenes de 4 a 6 pm y Sabados de 8 a 10 am. Escuela avalada por IDRD Bogotá (Aval Nº 200)',
      phone       = COALESCE('3124255117', phone),
      email       = COALESCE('leones.zion@outlook.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'AV Boyaca No. 142 A 55',
    'Bogotá',
    '3124255117',
    4.7501539, -74.0880740,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA INTEGRAL ATLANTIDA  (IDRD-AVAL-295)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-295';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA INTEGRAL ATLANTIDA',
      'Director(a): LUZ AMPARO PINEDA BAQUERO. Profesor(a): RICARDO ANDRES SOLANO RIVERA. Escenario: CALLE 34 BIS SUR No. 88D -12 PARQUE PATIO BONITO. Horarios: SABADOS DE 8 A 10 AM Y 10 A 12M. Escuela avalada por IDRD Bogotá (Aval Nº 295)',
      'academy',
      'Bogotá',
      'AVENIDA CARRERA 86 No. 38D - 69 SUR',
      '3212803903',
      'escueladenatacionatlantida@hotmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-integral-atlantida-295',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-295', v_school_id, '{"aval": 295, "director": "LUZ AMPARO PINEDA BAQUERO", "profesor": "RICARDO ANDRES SOLANO RIVERA", "localidades": ["Kennedy"], "barrio": "PATIO BONITO", "total_alumnos": 15, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): LUZ AMPARO PINEDA BAQUERO. Profesor(a): RICARDO ANDRES SOLANO RIVERA. Escenario: CALLE 34 BIS SUR No. 88D -12 PARQUE PATIO BONITO. Horarios: SABADOS DE 8 A 10 AM Y 10 A 12M. Escuela avalada por IDRD Bogotá (Aval Nº 295)',
      phone       = COALESCE('3212803903', phone),
      email       = COALESCE('escueladenatacionatlantida@hotmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CALLE 34 BIS SUR No. 88D -12 PARQUE PATIO BONITO',
    'Bogotá',
    '3212803903',
    4.6404294, -74.1692832,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA SPEED BIKE BMX  (IDRD-AVAL-157)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-157';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA SPEED BIKE BMX',
      'Director(a): DORA GONZALEZ VALENCIA. Profesor(a): JUAN DAVID AGUIRRE GONZALEZ. Escenario: PARQUE SAN ANDRES CALLE82 No. 100A-91 BOCHICA II. Horarios: SABADOS Y DOMINGOS DE 9 A 11 AM. Escuela avalada por IDRD Bogotá (Aval Nº 157)',
      'academy',
      'Bogotá',
      'CALLE 78F No. 105- 30 GARCES NAVAS',
      '3102469215',
      'speed.bike@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-speed-bike-bmx-157',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-157', v_school_id, '{"aval": 157, "director": "DORA GONZALEZ VALENCIA", "profesor": "JUAN DAVID AGUIRRE GONZALEZ", "localidades": ["Engativá"], "barrio": "BOCHICA", "total_alumnos": 29, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): DORA GONZALEZ VALENCIA. Profesor(a): JUAN DAVID AGUIRRE GONZALEZ. Escenario: PARQUE SAN ANDRES CALLE82 No. 100A-91 BOCHICA II. Horarios: SABADOS Y DOMINGOS DE 9 A 11 AM. Escuela avalada por IDRD Bogotá (Aval Nº 157)',
      phone       = COALESCE('3102469215', phone),
      email       = COALESCE('speed.bike@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE SAN ANDRES CALLE82 No. 100A-91 BOCHICA II',
    'Bogotá',
    '3102469215',
    4.7157693, -74.1087116,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE PATINAJE EL DORADO  (IDRD-AVAL-381)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-381';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE PATINAJE EL DORADO',
      'Director(a): CONSUELO MEDINA POMPEYO. Profesor(a): GUSTAVO ADOLFO RAMIREZ MEDINA. Escenario: PRIMERA DE MAYO CALLE 18B SUR #5-13. Horarios: SABADOS 4-6PM Y DOMINGOS 7-9AM. Escuela avalada por IDRD Bogotá (Aval Nº 381)',
      'academy',
      'Bogotá',
      'CARRERA 91#20A-75 INT APTO 104',
      '3132347070',
      'gusramirezmed@hotmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-patinaje-el-dorado-381',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-381', v_school_id, '{"aval": 381, "director": "CONSUELO MEDINA POMPEYO", "profesor": "GUSTAVO ADOLFO RAMIREZ MEDINA", "localidades": ["San Cristóbal"], "barrio": "San Cristóbal", "total_alumnos": 24, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CONSUELO MEDINA POMPEYO. Profesor(a): GUSTAVO ADOLFO RAMIREZ MEDINA. Escenario: PRIMERA DE MAYO CALLE 18B SUR #5-13. Horarios: SABADOS 4-6PM Y DOMINGOS 7-9AM. Escuela avalada por IDRD Bogotá (Aval Nº 381)',
      phone       = COALESCE('3132347070', phone),
      email       = COALESCE('gusramirezmed@hotmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PRIMERA DE MAYO CALLE 18B SUR #5-13',
    'Bogotá',
    '3132347070',
    4.5736933, -74.0961123,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA MASTER CLASS TENIS  (IDRD-AVAL-383)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-383';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA MASTER CLASS TENIS',
      'Director(a): YAQUELINE VANEGAS RIVERA. Profesor(a): CRISANTO TORO ROJAS. Escenario: CARRERA 92# 87A -60 IED SIMON BOLIVAR. Horarios: JUEVES DE 8Am 9:30 / 9:30am 11am / 11am a 12MD ---- sabados 8Am 9:30 -- 10am a 11:30. Escuela avalada por IDRD Bogotá (Aval Nº 383)',
      'academy',
      'Bogotá',
      'CARRERA118 B #89 -28 INT 11 APTO 101',
      '6032181',
      'turieduvan@yahoo.es',
      ARRAY['Tenis de campo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-master-class-tenis-383',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-383', v_school_id, '{"aval": 383, "director": "YAQUELINE VANEGAS RIVERA", "profesor": "CRISANTO TORO ROJAS", "localidades": ["Engativá"], "barrio": "Engativá", "total_alumnos": 14, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): YAQUELINE VANEGAS RIVERA. Profesor(a): CRISANTO TORO ROJAS. Escenario: CARRERA 92# 87A -60 IED SIMON BOLIVAR. Horarios: JUEVES DE 8Am 9:30 / 9:30am 11am / 11am a 12MD ---- sabados 8Am 9:30 -- 10am a 11:30. Escuela avalada por IDRD Bogotá (Aval Nº 383)',
      phone       = COALESCE('6032181', phone),
      email       = COALESCE('turieduvan@yahoo.es', email),
      sports      = ARRAY['Tenis de campo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CARRERA 92# 87A -60 IED SIMON BOLIVAR',
    'Bogotá',
    '6032181',
    4.7086571, -74.1096470,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACIÓN DEPORTIVA FAMILIA  (IDRD-AVAL-475)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-475';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACIÓN DEPORTIVA FAMILIA',
      'Director(a): LORSY PATRICIA CORTES VALENCIA. Profesor(a): EDWIN ORLANDO HERRERA YARA. Escenario: AV CENTENARIO CARRERA 115A -07 Fontibón. Horarios: SABADOS Y DOMINGOS 8AM A 10AM. Escuela avalada por IDRD Bogotá (Aval Nº 475)',
      'academy',
      'Bogotá',
      'CARRERA 94A -#6 -40 TORRE 14 APTO 103',
      '3202385532',
      'lorcycortes@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-familia-475',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-475', v_school_id, '{"aval": 475, "director": "LORSY PATRICIA CORTES VALENCIA", "profesor": "EDWIN ORLANDO HERRERA YARA", "localidades": ["Kennedy"], "barrio": "Kennedy", "total_alumnos": 30, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): LORSY PATRICIA CORTES VALENCIA. Profesor(a): EDWIN ORLANDO HERRERA YARA. Escenario: AV CENTENARIO CARRERA 115A -07 Fontibón. Horarios: SABADOS Y DOMINGOS 8AM A 10AM. Escuela avalada por IDRD Bogotá (Aval Nº 475)',
      phone       = COALESCE('3202385532', phone),
      email       = COALESCE('lorcycortes@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'AV CENTENARIO CARRERA 115A -07 Fontibón',
    'Bogotá',
    '3202385532',
    4.6317782, -74.1538873,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACIÓN DEPORTIVA OCTOPUS  (IDRD-AVAL-479)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-479';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACIÓN DEPORTIVA OCTOPUS',
      'Director(a): SERGIO MAURICIO CASTAÑEDA TOVAR. Profesor(a): JAIME ENRIQUE CASTAÑEDA TOVAR. Escenario: CARRERA 86 CON CALLE 90a. Horarios: JUEVES 10AM A 12MD. Escuela avalada por IDRD Bogotá (Aval Nº 479)',
      'academy',
      'Bogotá',
      'CALLE 77#77A 63PISO 2',
      '3125820034',
      'octopusnatacion@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-octopus-479',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-479', v_school_id, '{"aval": 479, "director": "SERGIO MAURICIO CASTAÑEDA TOVAR", "profesor": "JAIME ENRIQUE CASTAÑEDA TOVAR", "localidades": ["Engativá"], "barrio": "Engativá", "total_alumnos": 14, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): SERGIO MAURICIO CASTAÑEDA TOVAR. Profesor(a): JAIME ENRIQUE CASTAÑEDA TOVAR. Escenario: CARRERA 86 CON CALLE 90a. Horarios: JUEVES 10AM A 12MD. Escuela avalada por IDRD Bogotá (Aval Nº 479)',
      phone       = COALESCE('3125820034', phone),
      email       = COALESCE('octopusnatacion@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CARRERA 86 CON CALLE 90a',
    'Bogotá',
    '3125820034',
    4.7086571, -74.1096470,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE CICLISMO JP JUVENTUDES AL PEDAL  (IDRD-AVAL-484)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-484';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE CICLISMO JP JUVENTUDES AL PEDAL',
      'Director(a): LUIS GIOVANNI ROJAS CARDENAS. Profesor(a): JORGE ENRIQUE PEÑA MALAGON. Escenario: VELODROMO 1° DE MAYO. Horarios: LUNES A SABADO DE 9AM A 11AM / 3PM A 5PM. Escuela avalada por IDRD Bogotá (Aval Nº 484)',
      'academy',
      'Bogotá',
      'CARRERA 5 # 19 -39 SUR',
      '3155216927',
      'luigiro1908@hotmail.com',
      ARRAY['Ciclismo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-ciclismo-jp-juventudes-al-pedal-484',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-484', v_school_id, '{"aval": 484, "director": "LUIS GIOVANNI ROJAS CARDENAS", "profesor": "JORGE ENRIQUE PEÑA MALAGON", "localidades": ["San Cristóbal"], "barrio": "San Cristóbal", "total_alumnos": 16, "geo_source": "sede+barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): LUIS GIOVANNI ROJAS CARDENAS. Profesor(a): JORGE ENRIQUE PEÑA MALAGON. Escenario: VELODROMO 1° DE MAYO. Horarios: LUNES A SABADO DE 9AM A 11AM / 3PM A 5PM. Escuela avalada por IDRD Bogotá (Aval Nº 484)',
      phone       = COALESCE('3155216927', phone),
      email       = COALESCE('luigiro1908@hotmail.com', email),
      sports      = ARRAY['Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'VELODROMO 1° DE MAYO',
    'Bogotá',
    '3155216927',
    4.5708080, -74.0913670,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACIÓN DEPORTIVA TENNIS JYEM  (IDRD-AVAL-398)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-398';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACIÓN DEPORTIVA TENNIS JYEM',
      'Director(a): EDWIN JAVIER MUÑOZ CARRANZA. Profesor(a): YORK FELIPE SASTRE BAUTISTA. Escenario: PARQUE TIMIZA. Horarios: SABADOS Y DOMINGOS 7 AM A 10AM. Escuela avalada por IDRD Bogotá (Aval Nº 398)',
      'academy',
      'Bogotá',
      'Calle 37 A No. 9 A - 34 Sur,',
      '3185638890',
      'bogotatennisjyem@hotmail.com',
      ARRAY['Tenis de campo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-tennis-jyem-398',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-398', v_school_id, '{"aval": 398, "director": "EDWIN JAVIER MUÑOZ CARRANZA", "profesor": "YORK FELIPE SASTRE BAUTISTA", "localidades": ["Kennedy"], "barrio": "Kennedy", "total_alumnos": 14, "geo_source": "escenario+barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): EDWIN JAVIER MUÑOZ CARRANZA. Profesor(a): YORK FELIPE SASTRE BAUTISTA. Escenario: PARQUE TIMIZA. Horarios: SABADOS Y DOMINGOS 7 AM A 10AM. Escuela avalada por IDRD Bogotá (Aval Nº 398)',
      phone       = COALESCE('3185638890', phone),
      email       = COALESCE('bogotatennisjyem@hotmail.com', email),
      sports      = ARRAY['Tenis de campo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE TIMIZA',
    'Bogotá',
    '3185638890',
    4.6104610, -74.1565348,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACIÓN DEPORTIVA LA BARCA  (IDRD-AVAL-413)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-413';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACIÓN DEPORTIVA LA BARCA',
      'Director(a): CARLOS ANDRES CAJAMARCA MEDINA. Profesor(a): PAULA KATHERINE CASAS SUAREZ. Escenario: PARQUE TIMIZA II SECTOR. Horarios: Sábados (12:30 a 2pm) Domingos (11 a 12:30md). Escuela avalada por IDRD Bogotá (Aval Nº 413)',
      'academy',
      'Bogotá',
      'CARRERA 54# 37-30',
      '3208814227',
      'escueladeportivalabarca@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-la-barca-413',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-413', v_school_id, '{"aval": 413, "director": "CARLOS ANDRES CAJAMARCA MEDINA", "profesor": "PAULA KATHERINE CASAS SUAREZ", "localidades": ["Rafael Uribe Uribe"], "barrio": "Rafael Uribe Uribe", "total_alumnos": 14, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CARLOS ANDRES CAJAMARCA MEDINA. Profesor(a): PAULA KATHERINE CASAS SUAREZ. Escenario: PARQUE TIMIZA II SECTOR. Horarios: Sábados (12:30 a 2pm) Domingos (11 a 12:30md). Escuela avalada por IDRD Bogotá (Aval Nº 413)',
      phone       = COALESCE('3208814227', phone),
      email       = COALESCE('escueladeportivalabarca@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE TIMIZA II SECTOR',
    'Bogotá',
    '3208814227',
    4.5733208, -74.1220602,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION SKATE BOGOTA  (IDRD-AVAL-412)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-412';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION SKATE BOGOTA',
      'Director(a): YOHANNA HERRERA MATEUS. Profesor(a): SANDRA MILENA HERRERA MATEUS. Escenario: CALLE 1G# 41A-39 PARQUE JAZMIN. Horarios: SABADOS Y DOMINGOS 10 AM A 12MD. Escuela avalada por IDRD Bogotá (Aval Nº 412)',
      'academy',
      'Bogotá',
      'CALLE 62SUR #37-20 APTO 527',
      '3002128210',
      'yoherrerama@unal.edu.co',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-skate-bogota-412',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-412', v_school_id, '{"aval": 412, "director": "YOHANNA HERRERA MATEUS", "profesor": "SANDRA MILENA HERRERA MATEUS", "localidades": ["Puente Aranda"], "barrio": "Puente Aranda", "total_alumnos": 20, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): YOHANNA HERRERA MATEUS. Profesor(a): SANDRA MILENA HERRERA MATEUS. Escenario: CALLE 1G# 41A-39 PARQUE JAZMIN. Horarios: SABADOS Y DOMINGOS 10 AM A 12MD. Escuela avalada por IDRD Bogotá (Aval Nº 412)',
      phone       = COALESCE('3002128210', phone),
      email       = COALESCE('yoherrerama@unal.edu.co', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CALLE 1G# 41A-39 PARQUE JAZMIN',
    'Bogotá',
    '3002128210',
    4.6317620, -74.1085116,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA OLIMPO BOGOTA  (IDRD-AVAL-415)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-415';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA OLIMPO BOGOTA',
      'Director(a): JEFFERSON VARGAS RONCANCIO. Profesor(a): JHON MICHAEL SILVA. Escenario: 1. PARQUE VALLES DE CAFAM 2. PARQUE LA AURORA. Horarios: 1. MARTES, JUEVES Y VIERNES DE 5PM A 6PM - SABADOS Y DOMINGOS DE 11AM A 12PM 2. SABADOS Y DOMINGOS DE 3PM A 4PM. Escuela avalada por IDRD Bogotá (Aval Nº 415)',
      'academy',
      'Bogotá',
      'CALLE 76 A SUR NO. 14 - 55 INT 1',
      '3125285781',
      'jeffersonvargas1214@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-olimpo-bogota-415',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-415', v_school_id, '{"aval": 415, "director": "JEFFERSON VARGAS RONCANCIO", "profesor": "JHON MICHAEL SILVA", "localidades": ["Usme"], "barrio": "1. VALLES DE CAFAM 2. LA AURORA", "total_alumnos": 80, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JEFFERSON VARGAS RONCANCIO. Profesor(a): JHON MICHAEL SILVA. Escenario: 1. PARQUE VALLES DE CAFAM 2. PARQUE LA AURORA. Horarios: 1. MARTES, JUEVES Y VIERNES DE 5PM A 6PM - SABADOS Y DOMINGOS DE 11AM A 12PM 2. SABADOS Y DOMINGOS DE 3PM A 4PM. Escuela avalada por IDRD Bogotá (Aval Nº 415)',
      phone       = COALESCE('3125285781', phone),
      email       = COALESCE('jeffersonvargas1214@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    '1. PARQUE VALLES DE CAFAM 2. PARQUE LA AURORA',
    'Bogotá',
    '3125285781',
    4.5081097, -74.1143194,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA INTERNACIONAL CAMPEONES  (IDRD-AVAL-463)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-463';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA INTERNACIONAL CAMPEONES',
      'Director(a): INES VALDERRAMA LOZANO. Profesor(a): YUBER IVAN HERRERA. Escenario: CALLLE 63B 27D -70. Horarios: SABADOS Y DOMINGOS 9 AM A 11AM Y 10AM A 12MD. Escuela avalada por IDRD Bogotá (Aval Nº 463)',
      'academy',
      'Bogotá',
      'AV BOYACA #64H -65 BLOQ 6 APTO 102',
      '3003644662',
      'futbolintercampeones@gmail.com',
      ARRAY['Fútbol','Baloncesto']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-internacional-campeones-463',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-463', v_school_id, '{"aval": 463, "director": "INES VALDERRAMA LOZANO", "profesor": "YUBER IVAN HERRERA", "localidades": ["Engativá"], "barrio": "Engativá", "total_alumnos": 60, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): INES VALDERRAMA LOZANO. Profesor(a): YUBER IVAN HERRERA. Escenario: CALLLE 63B 27D -70. Horarios: SABADOS Y DOMINGOS 9 AM A 11AM Y 10AM A 12MD. Escuela avalada por IDRD Bogotá (Aval Nº 463)',
      phone       = COALESCE('3003644662', phone),
      email       = COALESCE('futbolintercampeones@gmail.com', email),
      sports      = ARRAY['Fútbol','Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CALLLE 63B 27D -70',
    'Bogotá',
    '3003644662',
    4.7086571, -74.1096470,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACIÓN DEPORTIVA OFICIAL AMERICA DE CALI - BOGOTA  (IDRD-AVAL-468)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-468';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACIÓN DEPORTIVA OFICIAL AMERICA DE CALI - BOGOTA',
      'Director(a): JUAN JOSE BELLINI VICTORIA. Profesor(a): DEIVY FREDERY FONSECA CAMACHO. Escenario: CALLE 213 54 - 88. Horarios: MIERCOLES 4PM A 6PM - SABADO Y DOMINGO 8AM A 10AM. Escuela avalada por IDRD Bogotá (Aval Nº 468)',
      'academy',
      'Bogotá',
      'CALLE 127BIS 46 -30',
      '3132636436',
      'jjb@juanjosebellini.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-oficial-america-de-cali---bog-468',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-468', v_school_id, '{"aval": 468, "director": "JUAN JOSE BELLINI VICTORIA", "profesor": "DEIVY FREDERY FONSECA CAMACHO", "localidades": ["Usaquén"], "barrio": "USAQUÉN", "total_alumnos": 24, "geo_source": "escenario+barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JUAN JOSE BELLINI VICTORIA. Profesor(a): DEIVY FREDERY FONSECA CAMACHO. Escenario: CALLE 213 54 - 88. Horarios: MIERCOLES 4PM A 6PM - SABADO Y DOMINGO 8AM A 10AM. Escuela avalada por IDRD Bogotá (Aval Nº 468)',
      phone       = COALESCE('3132636436', phone),
      email       = COALESCE('jjb@juanjosebellini.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CALLE 213 54 - 88',
    'Bogotá',
    '3132636436',
    4.6794209, -74.0378676,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE OFRMACION DEPORTIVA CRECER PATIN 2000  (IDRD-AVAL-575)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-575';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE OFRMACION DEPORTIVA CRECER PATIN 2000',
      'Director(a): YAMILE ISLENA PARRADO SABOGAL. Profesor(a): MIGUEL ERNESTO NIÑO. Escenario: PARQUE CAYETANO CAÑIZARES PARQUE TIMIZA II SECTOR. Horarios: PARQUE CAYETANO CAÑIZARES SABADOS Y DOMINGOS DE 7:30 A 9:30 AM MARTES DE 4:00 A 6:00 PM PARQUE TIMIZA SABADOS Y DOMINGOS DE 9:00 A 11:00 AM VIERNES DE 3:00 A 5:00 PM. Escuela avalada por IDRD Bogotá (Aval Nº 575)',
      'academy',
      'Bogotá',
      'CARRERA 81C BIS NO. 51C 47 SUR',
      '3133616908',
      'escuelacrecerpatin2000@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-ofrmacion-deportiva-crecer-patin-2000-575',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-575', v_school_id, '{"aval": 575, "director": "YAMILE ISLENA PARRADO SABOGAL", "profesor": "MIGUEL ERNESTO NIÑO", "localidades": ["Kennedy"], "barrio": "TIMIZA", "total_alumnos": 16, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): YAMILE ISLENA PARRADO SABOGAL. Profesor(a): MIGUEL ERNESTO NIÑO. Escenario: PARQUE CAYETANO CAÑIZARES PARQUE TIMIZA II SECTOR. Horarios: PARQUE CAYETANO CAÑIZARES SABADOS Y DOMINGOS DE 7:30 A 9:30 AM MARTES DE 4:00 A 6:00 PM PARQUE TIMIZA SABADOS Y DOMINGOS DE 9:00 A 11:00 AM VIERNES DE 3:00 A 5:00 PM. Escuela avalada por IDRD Bogotá (Aval Nº 575)',
      phone       = COALESCE('3133616908', phone),
      email       = COALESCE('escuelacrecerpatin2000@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE CAYETANO CAÑIZARES PARQUE TIMIZA II SECTOR',
    'Bogotá',
    '3133616908',
    4.6090014, -74.1616336,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA AGUAS Y VELOCIDAD  (IDRD-AVAL-587)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-587';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA AGUAS Y VELOCIDAD',
      'Director(a): JEISSON RAMIREZ ROZO. Profesor(a): JUAN SEBASTIAN RODRIGUEZ LESMES. Escenario: PISCINAS DEL PARQUE VIRREY. Horarios: SABADOS DE 9 A 10 AM DOMINGOS DE 11 A 12M. Escuela avalada por IDRD Bogotá (Aval Nº 587)',
      'academy',
      'Bogotá',
      'CARRERA 2A ESTE No. 48X 12 sur',
      '3134360072',
      'natacion.patinaje@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-aguas-y-velocidad-587',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-587', v_school_id, '{"aval": 587, "director": "JEISSON RAMIREZ ROZO", "profesor": "JUAN SEBASTIAN RODRIGUEZ LESMES", "localidades": ["Usme"], "barrio": "VIRREY SUR", "total_alumnos": 14, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JEISSON RAMIREZ ROZO. Profesor(a): JUAN SEBASTIAN RODRIGUEZ LESMES. Escenario: PISCINAS DEL PARQUE VIRREY. Horarios: SABADOS DE 9 A 10 AM DOMINGOS DE 11 A 12M. Escuela avalada por IDRD Bogotá (Aval Nº 587)',
      phone       = COALESCE('3134360072', phone),
      email       = COALESCE('natacion.patinaje@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PISCINAS DEL PARQUE VIRREY',
    'Bogotá',
    '3134360072',
    4.5009302, -74.1120363,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA DE FÚTBOL MILAN CRH  (IDRD-AVAL-588)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-588';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA DE FÚTBOL MILAN CRH',
      'Director(a): CHRISTIAN RAUL HIGUERA HURTADO. Profesor(a): DANIEL STEVEN ZAMORA CHOCONTA. Escenario: POLIDEPORTIVO LA ESTANCIA. Horarios: SABADOS Y DOMINGOS DE 10 A 12 M. Escuela avalada por IDRD Bogotá (Aval Nº 588)',
      'academy',
      'Bogotá',
      'CARRERA 72 R No. 42G- 03 sur casa',
      '3202215770',
      'clubdeportivomilancrh@hotmail.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-de-futbol-milan-crh-588',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-588', v_school_id, '{"aval": 588, "director": "CHRISTIAN RAUL HIGUERA HURTADO", "profesor": "DANIEL STEVEN ZAMORA CHOCONTA", "localidades": ["Ciudad Bolívar"], "barrio": "ESTANCIA", "total_alumnos": 40, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CHRISTIAN RAUL HIGUERA HURTADO. Profesor(a): DANIEL STEVEN ZAMORA CHOCONTA. Escenario: POLIDEPORTIVO LA ESTANCIA. Horarios: SABADOS Y DOMINGOS DE 10 A 12 M. Escuela avalada por IDRD Bogotá (Aval Nº 588)',
      phone       = COALESCE('3202215770', phone),
      email       = COALESCE('clubdeportivomilancrh@hotmail.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'POLIDEPORTIVO LA ESTANCIA',
    'Bogotá',
    '3202215770',
    4.7521669, -74.0301895,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA SAB  (IDRD-AVAL-595)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-595';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA SAB',
      'Director(a): LAURA MILENA CUBILLOS ROMERO. Profesor(a): CAROL NATALY GUERRA QUINTERO. Escenario: PARQUE PUBLICO VECINAL CIUDAD SALITRE ETAPA 1. Horarios: SABADOS Y DOMINGOS DE 7 A 9 AM. Escuela avalada por IDRD Bogotá (Aval Nº 595)',
      'academy',
      'Bogotá',
      'CALLE 65A # 80-55',
      '3114776181',
      'escueladepatinajesab@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-sab-595',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-595', v_school_id, '{"aval": 595, "director": "LAURA MILENA CUBILLOS ROMERO", "profesor": "CAROL NATALY GUERRA QUINTERO", "localidades": ["Fontibón"], "barrio": "CIUDAD SALITRE", "total_alumnos": 14, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): LAURA MILENA CUBILLOS ROMERO. Profesor(a): CAROL NATALY GUERRA QUINTERO. Escenario: PARQUE PUBLICO VECINAL CIUDAD SALITRE ETAPA 1. Horarios: SABADOS Y DOMINGOS DE 7 A 9 AM. Escuela avalada por IDRD Bogotá (Aval Nº 595)',
      phone       = COALESCE('3114776181', phone),
      email       = COALESCE('escueladepatinajesab@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE PUBLICO VECINAL CIUDAD SALITRE ETAPA 1',
    'Bogotá',
    '3114776181',
    4.6520593, -74.1102113,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA PINGUINOS  (IDRD-AVAL-630)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-630';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA PINGUINOS',
      'Director(a): JOSE FERNANDO CHINGATE LEDESMAS. Profesor(a): MANUEL ANDRES GARZON AREVALO. Escenario: PARQUE MEISSEN. Horarios: SABADOS DE 9 A 10 AM. Escuela avalada por IDRD Bogotá (Aval Nº 630)',
      'academy',
      'Bogotá',
      'CARRERA 61 D NP. 52-37 SUR',
      '3124490229',
      'pinguinos.e.d@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-pinguinos-630',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-630', v_school_id, '{"aval": 630, "director": "JOSE FERNANDO CHINGATE LEDESMAS", "profesor": "MANUEL ANDRES GARZON AREVALO", "localidades": ["Ciudad Bolívar"], "barrio": "MEISSEN", "total_alumnos": 14, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JOSE FERNANDO CHINGATE LEDESMAS. Profesor(a): MANUEL ANDRES GARZON AREVALO. Escenario: PARQUE MEISSEN. Horarios: SABADOS DE 9 A 10 AM. Escuela avalada por IDRD Bogotá (Aval Nº 630)',
      phone       = COALESCE('3124490229', phone),
      email       = COALESCE('pinguinos.e.d@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE MEISSEN',
    'Bogotá',
    '3124490229',
    4.5576590, -74.1360247,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA ELITE  (IDRD-AVAL-679)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-679';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA ELITE',
      'Director(a): CARLOS FIDEL MEJIA VELASCO. Profesor(a): GERMAN DARIO MEJIA VELASCO. Escenario: PARQUE SAN ANDRES. Horarios: SABADOS Y DOMINGOS DE 8:00 A 11:45 AM. Escuela avalada por IDRD Bogotá (Aval Nº 679)',
      'academy',
      'Bogotá',
      'CALLE 127 NO. 53A-48 PORT 4 APTO 316',
      '3115675515',
      'carlosftenis@yahoo.es',
      ARRAY['Tenis de campo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-elite-679',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-679', v_school_id, '{"aval": 679, "director": "CARLOS FIDEL MEJIA VELASCO", "profesor": "GERMAN DARIO MEJIA VELASCO", "localidades": ["Engativá"], "barrio": "CORTIJO", "total_alumnos": 14, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CARLOS FIDEL MEJIA VELASCO. Profesor(a): GERMAN DARIO MEJIA VELASCO. Escenario: PARQUE SAN ANDRES. Horarios: SABADOS Y DOMINGOS DE 8:00 A 11:45 AM. Escuela avalada por IDRD Bogotá (Aval Nº 679)',
      phone       = COALESCE('3115675515', phone),
      email       = COALESCE('carlosftenis@yahoo.es', email),
      sports      = ARRAY['Tenis de campo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE SAN ANDRES',
    'Bogotá',
    '3115675515',
    4.7128895, -74.1107896,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA LOWENFELD  (IDRD-AVAL-732)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-732';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA LOWENFELD',
      'Director(a): JUAN FELIPE RAMOS GOMEZ. Profesor(a): JOSE ESTEBAN PERILLA CAMARGO. Escenario: PARQUE PRINCIPAL DE NORMANDIA. Horarios: SABADOS DE 9 A 10 AM DOMINGOS DE 8 A 9 AM. Escuela avalada por IDRD Bogotá (Aval Nº 732)',
      'academy',
      'Bogotá',
      'CALLE 52A No. 74-20',
      '3023747010',
      'lowenfeldfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-lowenfeld-732',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-732', v_school_id, '{"aval": 732, "director": "JUAN FELIPE RAMOS GOMEZ", "profesor": "JOSE ESTEBAN PERILLA CAMARGO", "localidades": ["Engativá"], "barrio": "NORMANDIA", "total_alumnos": 24, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JUAN FELIPE RAMOS GOMEZ. Profesor(a): JOSE ESTEBAN PERILLA CAMARGO. Escenario: PARQUE PRINCIPAL DE NORMANDIA. Horarios: SABADOS DE 9 A 10 AM DOMINGOS DE 8 A 9 AM. Escuela avalada por IDRD Bogotá (Aval Nº 732)',
      phone       = COALESCE('3023747010', phone),
      email       = COALESCE('lowenfeldfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE PRINCIPAL DE NORMANDIA',
    'Bogotá',
    '3023747010',
    4.6660832, -74.1068245,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA F.S.P.  (IDRD-AVAL-9)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-9';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA F.S.P.',
      'Director(a): ANDRES FELIPE USSA CUBIDES. Profesor(a): YURY TATIANA RODRIGUEZ COTRINA. Escenario: PARQUE EL RECREO. Horarios: SABADOS Y DOMINGOS DE 10 A 12M. Escuela avalada por IDRD Bogotá (Aval Nº 9)',
      'academy',
      'Bogotá',
      'CARRERA 98B No. 69.49 SUR',
      '3144090165',
      'f.p.s.zhazan@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-fsp-9',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-9', v_school_id, '{"aval": 9, "director": "ANDRES FELIPE USSA CUBIDES", "profesor": "YURY TATIANA RODRIGUEZ COTRINA", "localidades": ["Bosa"], "barrio": "EL RECREO", "total_alumnos": 24, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): ANDRES FELIPE USSA CUBIDES. Profesor(a): YURY TATIANA RODRIGUEZ COTRINA. Escenario: PARQUE EL RECREO. Horarios: SABADOS Y DOMINGOS DE 10 A 12M. Escuela avalada por IDRD Bogotá (Aval Nº 9)',
      phone       = COALESCE('3144090165', phone),
      email       = COALESCE('f.p.s.zhazan@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE EL RECREO',
    'Bogotá',
    '3144090165',
    4.7466070, -74.0314295,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA TALENTOS DE LA SABANA  (IDRD-AVAL-49)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-49';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA TALENTOS DE LA SABANA',
      'Director(a): MARIA XIMENA HERNANDEZ BLANCO. Profesor(a): MARIA CAMILA RINCON RODRIGUEZ. Escenario: PARQUE ALTA BLANCA. Horarios: LUNES Y MIERCOLES DE 4:30 A 6:00PM MARTES Y JUEVES DE 5:30 A 7:00PM SABADO Y DOMINGO DE 8:00 A 9:30 AM. Escuela avalada por IDRD Bogotá (Aval Nº 49)',
      'academy',
      'Bogotá',
      'CALLE 156 B # 8 -89',
      '3158723072',
      'hmariaximena@hotmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-talentos-de-la-sabana-49',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-49', v_school_id, '{"aval": 49, "director": "MARIA XIMENA HERNANDEZ BLANCO", "profesor": "MARIA CAMILA RINCON RODRIGUEZ", "localidades": ["Usaquén"], "barrio": "ALTA BLANCA", "total_alumnos": 24, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): MARIA XIMENA HERNANDEZ BLANCO. Profesor(a): MARIA CAMILA RINCON RODRIGUEZ. Escenario: PARQUE ALTA BLANCA. Horarios: LUNES Y MIERCOLES DE 4:30 A 6:00PM MARTES Y JUEVES DE 5:30 A 7:00PM SABADO Y DOMINGO DE 8:00 A 9:30 AM. Escuela avalada por IDRD Bogotá (Aval Nº 49)',
      phone       = COALESCE('3158723072', phone),
      email       = COALESCE('hmariaximena@hotmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE ALTA BLANCA',
    'Bogotá',
    '3158723072',
    4.7342063, -74.0287030,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA NUEVA VIDA  (IDRD-AVAL-50)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-50';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA NUEVA VIDA',
      'Director(a): RUBEN DARIO ROBLES SANDOVAL,. Profesor(a): PAULO DARIO ROBLES MORENO. Escenario: PRD. Horarios: SABADOS Y DOMINGO DE 10:30 A 12:30. Escuela avalada por IDRD Bogotá (Aval Nº 50)',
      'academy',
      'Bogotá',
      'CARRERA 1021 # 69 -35',
      '3023677416',
      'nuevavida_8@yahoo.es',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-nueva-vida-50',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-50', v_school_id, '{"aval": 50, "director": "RUBEN DARIO ROBLES SANDOVAL,", "profesor": "PAULO DARIO ROBLES MORENO", "localidades": ["Engativá"], "barrio": "Engativá", "total_alumnos": 24, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): RUBEN DARIO ROBLES SANDOVAL,. Profesor(a): PAULO DARIO ROBLES MORENO. Escenario: PRD. Horarios: SABADOS Y DOMINGO DE 10:30 A 12:30. Escuela avalada por IDRD Bogotá (Aval Nº 50)',
      phone       = COALESCE('3023677416', phone),
      email       = COALESCE('nuevavida_8@yahoo.es', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PRD',
    'Bogotá',
    '3023677416',
    4.7086571, -74.1096470,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION PATINAJE APOLO SKATE  (IDRD-AVAL-57)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-57';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION PATINAJE APOLO SKATE',
      'Director(a): TERESA APACHE BERMUDEZ. Profesor(a): DIEGO FERNANDO APOLINAR MARTINEZ. Escenario: PARQUE FONTANAR DEL RIO. Horarios: SABADO Y DOMINGO DE 10 A 12 m. Escuela avalada por IDRD Bogotá (Aval Nº 57)',
      'academy',
      'Bogotá',
      'CALLE 143 A # 141 D 15 LOTE 6 CASA 25',
      '3125485565',
      'teresaapache2014@gmail.com',
      ARRAY['Patinaje artístico']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-patinaje-apolo-skate-57',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-57', v_school_id, '{"aval": 57, "director": "TERESA APACHE BERMUDEZ", "profesor": "DIEGO FERNANDO APOLINAR MARTINEZ", "localidades": ["Suba"], "barrio": "FONTANAR DEL RIO", "total_alumnos": 16, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): TERESA APACHE BERMUDEZ. Profesor(a): DIEGO FERNANDO APOLINAR MARTINEZ. Escenario: PARQUE FONTANAR DEL RIO. Horarios: SABADO Y DOMINGO DE 10 A 12 m. Escuela avalada por IDRD Bogotá (Aval Nº 57)',
      phone       = COALESCE('3125485565', phone),
      email       = COALESCE('teresaapache2014@gmail.com', email),
      sports      = ARRAY['Patinaje artístico']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE FONTANAR DEL RIO',
    'Bogotá',
    '3125485565',
    4.7563711, -74.1112877,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA NOTTINGHAM  (IDRD-AVAL-90)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-90';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA NOTTINGHAM',
      'Director(a): LIBARDO ARISTOBULO GARZON SAAVEDRA. Profesor(a): RICARDO FAJARDO. Escenario: PARQUE OLAYA HERRERA COLEGIO RESTREPO MILLAN. Horarios: PARQUE OLAYA HERRERA SABADOS DE 8 A 12 M COLEGIO RESTREPO MILLAN DOMINGOS DE 8 A 10 AM. Escuela avalada por IDRD Bogotá (Aval Nº 90)',
      'academy',
      'Bogotá',
      'CARRERA 24 A BIS No. 42 - 21 SUR',
      '3209013471',
      'liga46@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-nottingham-90',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-90', v_school_id, '{"aval": 90, "director": "LIBARDO ARISTOBULO GARZON SAAVEDRA", "profesor": "RICARDO FAJARDO", "localidades": ["Rafael Uribe Uribe"], "barrio": "OLAYA", "total_alumnos": 45, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): LIBARDO ARISTOBULO GARZON SAAVEDRA. Profesor(a): RICARDO FAJARDO. Escenario: PARQUE OLAYA HERRERA COLEGIO RESTREPO MILLAN. Horarios: PARQUE OLAYA HERRERA SABADOS DE 8 A 12 M COLEGIO RESTREPO MILLAN DOMINGOS DE 8 A 10 AM. Escuela avalada por IDRD Bogotá (Aval Nº 90)',
      phone       = COALESCE('3209013471', phone),
      email       = COALESCE('liga46@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE OLAYA HERRERA COLEGIO RESTREPO MILLAN',
    'Bogotá',
    '3209013471',
    4.5818778, -74.1071606,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA MASTER TENIS  (IDRD-AVAL-108)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-108';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA MASTER TENIS',
      'Director(a): PEDRO JULIO PIRACHICAN ALAGUNA. Profesor(a): FLOR MARINA MARTINEZ. Escenario: PARQUETIMIZA VILLA DEL RIO. Horarios: SABADOS Y DOMINGOS DE 10:00 AM A 1:00 PM. Escuela avalada por IDRD Bogotá (Aval Nº 108)',
      'academy',
      'Bogotá',
      'CALLE 143 No. 113C - 50 INT 20 APT 380',
      '3105635495',
      'pedrotenis25@gmail.com',
      ARRAY['Tenis de campo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-master-tenis-108',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-108', v_school_id, '{"aval": 108, "director": "PEDRO JULIO PIRACHICAN ALAGUNA", "profesor": "FLOR MARINA MARTINEZ", "localidades": ["Kennedy"], "barrio": "TIMIZA", "total_alumnos": 16, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): PEDRO JULIO PIRACHICAN ALAGUNA. Profesor(a): FLOR MARINA MARTINEZ. Escenario: PARQUETIMIZA VILLA DEL RIO. Horarios: SABADOS Y DOMINGOS DE 10:00 AM A 1:00 PM. Escuela avalada por IDRD Bogotá (Aval Nº 108)',
      phone       = COALESCE('3105635495', phone),
      email       = COALESCE('pedrotenis25@gmail.com', email),
      sports      = ARRAY['Tenis de campo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUETIMIZA VILLA DEL RIO',
    'Bogotá',
    '3105635495',
    4.6090014, -74.1616336,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA NATACIÓN NAUTICO  (IDRD-AVAL-110)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-110';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA NATACIÓN NAUTICO',
      'Director(a): MARTHA ISABEL SUAREZ BENITEZ. Profesor(a): CARLOS ALBERTO ARCOS. Escenario: 1. PARQUE ZONAL VIRREY SUR 2. PARQUE AUTOPISTA SUR 3. PARQUE CANDELARIA LA NUEVA. Horarios: 1. MARTES Y VIERNES DE 4PM A 5PM - SABADOS DE 8AM A 12PM Y DE 3PM A 5PM - DOMINGOS DE 8AM A 12PM 2. SABADOS Y DOMINGOS DE 10AM A 12PM 3. MIERCOLES DE 3PM A 5PM - SABADOS DE 3PM A 5PM. Escuela avalada por IDRD Bogotá (Aval Nº 110)',
      'academy',
      'Bogotá',
      'CALLE 65 C SUR # 11-50',
      '3142410164',
      'ferchito_61@hotmail.es',
      ARRAY['Natación']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-natacion-nautico-110',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-110', v_school_id, '{"aval": 110, "director": "MARTHA ISABEL SUAREZ BENITEZ", "profesor": "CARLOS ALBERTO ARCOS", "localidades": ["Usme", "Bosa", "Ciudad Bolívar"], "barrio": "1. VIRREY SUR 2. AUTOPISTA SUR 3. CANDELARIA LA NUEVA", "total_alumnos": 37, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): MARTHA ISABEL SUAREZ BENITEZ. Profesor(a): CARLOS ALBERTO ARCOS. Escenario: 1. PARQUE ZONAL VIRREY SUR 2. PARQUE AUTOPISTA SUR 3. PARQUE CANDELARIA LA NUEVA. Horarios: 1. MARTES Y VIERNES DE 4PM A 5PM - SABADOS DE 8AM A 12PM Y DE 3PM A 5PM - DOMINGOS DE 8AM A 12PM 2. SABADOS Y DOMINGOS DE 10AM A 12PM 3. MIERCOLES DE 3PM A 5PM - SABADOS DE 3PM A 5PM. Escuela avalada por IDRD Bogotá (Aval Nº 110)',
      phone       = COALESCE('3142410164', phone),
      email       = COALESCE('ferchito_61@hotmail.es', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    '1. PARQUE ZONAL VIRREY SUR 2. PARQUE AUTOPISTA SUR 3. PARQUE CANDELARIA LA NUEVA',
    'Bogotá',
    '3142410164',
    4.5081097, -74.1143194,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA COLSKATER  (IDRD-AVAL-111)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-111';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA COLSKATER',
      'Director(a): OMAR YESID GUTIERREZ HERRAN. Profesor(a): WALTER ALBEIRO SARRIA CERINZA. Escenario: POLIDEPORTIVO LA GAITANA PARQUE FONTANAR DEL RIO. Horarios: POLIDEPORTIVO LA GAITANA MARTES Y JUEVES DE 4 A 6 PM SABADOS Y DOMINGOS DE 1 A 3 PM PARQUE FONTANAR DEL RIO MARTES DE 4 A 6 PM SABADOS Y DOMINGOS DE 11 A 1 PM. Escuela avalada por IDRD Bogotá (Aval Nº 111)',
      'academy',
      'Bogotá',
      'CARRERA 93A #129B - 95',
      '3142410691',
      'colskater@hotmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-colskater-111',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-111', v_school_id, '{"aval": 111, "director": "OMAR YESID GUTIERREZ HERRAN", "profesor": "WALTER ALBEIRO SARRIA CERINZA", "localidades": ["Suba"], "barrio": "GAITANA Y COMPARTIR", "total_alumnos": 24, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): OMAR YESID GUTIERREZ HERRAN. Profesor(a): WALTER ALBEIRO SARRIA CERINZA. Escenario: POLIDEPORTIVO LA GAITANA PARQUE FONTANAR DEL RIO. Horarios: POLIDEPORTIVO LA GAITANA MARTES Y JUEVES DE 4 A 6 PM SABADOS Y DOMINGOS DE 1 A 3 PM PARQUE FONTANAR DEL RIO MARTES DE 4 A 6 PM SABADOS Y DOMINGOS DE 11 A 1 PM. Escuela avalada por IDRD Bogotá (Aval Nº 111)',
      phone       = COALESCE('3142410691', phone),
      email       = COALESCE('colskater@hotmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'POLIDEPORTIVO LA GAITANA PARQUE FONTANAR DEL RIO',
    'Bogotá',
    '3142410691',
    4.7501539, -74.0880740,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA AGUAS Y VELOCIDAD  (IDRD-AVAL-206)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-206';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA AGUAS Y VELOCIDAD',
      'Director(a): JEISSON RAMIREZ ROZO. Profesor(a): LAURA DANIELA FANDIÑO SEGURA. Escenario: CALLE 11 NO. 67A - 15. Horarios: SABADOS Y DOMINGOS DE 8 A 10 AM. Escuela avalada por IDRD Bogotá (Aval Nº 206)',
      'academy',
      'Bogotá',
      'CARRERA 2A ESTE No. 48X 12 sur',
      '3134360072',
      'natacion.patinaje@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-aguas-y-velocidad-206',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-206', v_school_id, '{"aval": 206, "director": "JEISSON RAMIREZ ROZO", "profesor": "LAURA DANIELA FANDIÑO SEGURA", "localidades": ["Usme"], "barrio": "DANUBIO AZUL", "total_alumnos": 14, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JEISSON RAMIREZ ROZO. Profesor(a): LAURA DANIELA FANDIÑO SEGURA. Escenario: CALLE 11 NO. 67A - 15. Horarios: SABADOS Y DOMINGOS DE 8 A 10 AM. Escuela avalada por IDRD Bogotá (Aval Nº 206)',
      phone       = COALESCE('3134360072', phone),
      email       = COALESCE('natacion.patinaje@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CALLE 11 NO. 67A - 15',
    'Bogotá',
    '3134360072',
    4.5378613, -74.1149935,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA INTEGRAL NOGAL  (IDRD-AVAL-303)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-303';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA INTEGRAL NOGAL',
      'Director(a): HERLEING ARMANDO VALBUENA MAHECHA. Profesor(a): JESSICA PAOLA OQUENDO LOPEZ. Escenario: PARQUE EL JAZMIN CALLE 1G NO. 41A 39 PARQUE VELODROMO PRIMERA DE MAYO CARRERA 5 NO. 19-20 SUR. Horarios: PARQUE EL JAZMIN SABADOS Y DOMINGOS DE 8 A 10 AM PARQUE VELODROMO PRIMERA DE MAYO SABADOS Y DOMINGOS DE 11 A 1PM. Escuela avalada por IDRD Bogotá (Aval Nº 303)',
      'academy',
      'Bogotá',
      'CARRERA 42 NO. 1B- 09',
      '3003857727',
      'patinajennc@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-integral-nogal-303',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-303', v_school_id, '{"aval": 303, "director": "HERLEING ARMANDO VALBUENA MAHECHA", "profesor": "JESSICA PAOLA OQUENDO LOPEZ", "localidades": ["Puente Aranda San Cristóbal"], "barrio": "Puente Aranda San Cristóbal", "total_alumnos": 21, "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): HERLEING ARMANDO VALBUENA MAHECHA. Profesor(a): JESSICA PAOLA OQUENDO LOPEZ. Escenario: PARQUE EL JAZMIN CALLE 1G NO. 41A 39 PARQUE VELODROMO PRIMERA DE MAYO CARRERA 5 NO. 19-20 SUR. Horarios: PARQUE EL JAZMIN SABADOS Y DOMINGOS DE 8 A 10 AM PARQUE VELODROMO PRIMERA DE MAYO SABADOS Y DOMINGOS DE 11 A 1PM. Escuela avalada por IDRD Bogotá (Aval Nº 303)',
      phone       = COALESCE('3003857727', phone),
      email       = COALESCE('patinajennc@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin lat/lng confiable: NO crear branch (no aparecera en mapa)
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA COLOSAL  (IDRD-AVAL-345)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-345';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA COLOSAL',
      'Director(a): JULY ANDREA NIETO. Profesor(a): JEANPIER SMITH RUIZ NIETO. Escenario: PARQUE BRASILIA. Horarios: MARTES DE 3:00PM - 5:00PM SABADOS DE 10:00AM - 12:00 MEDIODIA. Escuela avalada por IDRD Bogotá (Aval Nº 345)',
      'academy',
      'Bogotá',
      'CARRERA 104 # 65 46 SUR CASA 297',
      '3214058876',
      'yuly.nieto297@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-colosal-345',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-345', v_school_id, '{"aval": 345, "director": "JULY ANDREA NIETO", "profesor": "JEANPIER SMITH RUIZ NIETO", "localidades": ["Bosa"], "barrio": "EL RECREO", "total_alumnos": 15, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JULY ANDREA NIETO. Profesor(a): JEANPIER SMITH RUIZ NIETO. Escenario: PARQUE BRASILIA. Horarios: MARTES DE 3:00PM - 5:00PM SABADOS DE 10:00AM - 12:00 MEDIODIA. Escuela avalada por IDRD Bogotá (Aval Nº 345)',
      phone       = COALESCE('3214058876', phone),
      email       = COALESCE('yuly.nieto297@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE BRASILIA',
    'Bogotá',
    '3214058876',
    4.6185636, -74.1124707,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA ISRAEL VILORIA  (IDRD-AVAL-409)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-409';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA ISRAEL VILORIA',
      'Director(a): ISRAEL FRANCISCO VILORIA LINERO. Profesor(a): BRAYAN CAMILO MARTINEZ RAVELO. Escenario: PARQUE VILLA ALSACIA CALLE 11B BIS NO. 72A - 59. Horarios: SABADOS Y DOMINGOS 12 A 2 PM. Escuela avalada por IDRD Bogotá (Aval Nº 409)',
      'academy',
      'Bogotá',
      'TRANVERSAL 78D NO. 10D - 37',
      '3155350645',
      'johism24@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-israel-viloria-409',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-409', v_school_id, '{"aval": 409, "director": "ISRAEL FRANCISCO VILORIA LINERO", "profesor": "BRAYAN CAMILO MARTINEZ RAVELO", "localidades": ["Kennedy"], "barrio": "VILLA ALSACIA", "total_alumnos": 28, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): ISRAEL FRANCISCO VILORIA LINERO. Profesor(a): BRAYAN CAMILO MARTINEZ RAVELO. Escenario: PARQUE VILLA ALSACIA CALLE 11B BIS NO. 72A - 59. Horarios: SABADOS Y DOMINGOS 12 A 2 PM. Escuela avalada por IDRD Bogotá (Aval Nº 409)',
      phone       = COALESCE('3155350645', phone),
      email       = COALESCE('johism24@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE VILLA ALSACIA CALLE 11B BIS NO. 72A - 59',
    'Bogotá',
    '3155350645',
    4.6426293, -74.1367690,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA SPEED FORCE  (IDRD-AVAL-421)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-421';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA SPEED FORCE',
      'Director(a): CARLOS ALBERTO RUIZ OVALLE. Profesor(a): CARLOS ALBERTO RUIZ OVALLE. Escenario: PARQUE SAN ANDRES. Horarios: MARTES Y JUEVES DE 2:00 -4:00 PM. Escuela avalada por IDRD Bogotá (Aval Nº 421)',
      'academy',
      'Bogotá',
      'CARERRA 112 G # 86 B 60 INTERIOR 10 APTO 301',
      '3202548372',
      'speedforcecolombia@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-speed-force-421',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-421', v_school_id, '{"aval": 421, "director": "CARLOS ALBERTO RUIZ OVALLE", "profesor": "CARLOS ALBERTO RUIZ OVALLE", "localidades": ["Engativá"], "barrio": "BOCHICA", "total_alumnos": 21, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CARLOS ALBERTO RUIZ OVALLE. Profesor(a): CARLOS ALBERTO RUIZ OVALLE. Escenario: PARQUE SAN ANDRES. Horarios: MARTES Y JUEVES DE 2:00 -4:00 PM. Escuela avalada por IDRD Bogotá (Aval Nº 421)',
      phone       = COALESCE('3202548372', phone),
      email       = COALESCE('speedforcecolombia@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE SAN ANDRES',
    'Bogotá',
    '3202548372',
    4.7128895, -74.1107896,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA VERONA  (IDRD-AVAL-588)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-588';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA VERONA',
      'Director(a): ANDRES FELIPE ARIAS TAMAYO. Profesor(a): HECTOR JAVIER MORA BELLO. Escenario: PARQUE LA GAITANA CARRERA 125 NO. 132A - 06. Horarios: SABADOS Y DOMINGOS DE 10 A 12M. Escuela avalada por IDRD Bogotá (Aval Nº 588)',
      'academy',
      'Bogotá',
      'CARRERA 125 B NO. 131A - 46',
      '3106953612',
      'profesvfcsg@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-verona-588',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-588', v_school_id, '{"aval": 588, "director": "ANDRES FELIPE ARIAS TAMAYO", "profesor": "HECTOR JAVIER MORA BELLO", "localidades": ["Suba"], "barrio": "LA GAITANA", "total_alumnos": 20, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): ANDRES FELIPE ARIAS TAMAYO. Profesor(a): HECTOR JAVIER MORA BELLO. Escenario: PARQUE LA GAITANA CARRERA 125 NO. 132A - 06. Horarios: SABADOS Y DOMINGOS DE 10 A 12M. Escuela avalada por IDRD Bogotá (Aval Nº 588)',
      phone       = COALESCE('3106953612', phone),
      email       = COALESCE('profesvfcsg@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE LA GAITANA CARRERA 125 NO. 132A - 06',
    'Bogotá',
    '3106953612',
    4.7413965, -74.1129959,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA PATINSONS  (IDRD-AVAL-944)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-944';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA PATINSONS',
      'Director(a): JOAN SEBASTIAN GARCÍA GALINDO. Profesor(a): GRACE MARCELA MARTINEZ LEÓN. Escenario: PARQUE EL JAZMIN. Horarios: SABADOS Y DOMINGOS DE 11AM A 1 PM. Escuela avalada por IDRD Bogotá (Aval Nº 944)',
      'academy',
      'Bogotá',
      'TRANSVERSAL 52B NO. 2-29 APT 401',
      '3212471191',
      'escuelapatinsons@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-patinsons-944',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-944', v_school_id, '{"aval": 944, "director": "JOAN SEBASTIAN GARCÍA GALINDO", "profesor": "GRACE MARCELA MARTINEZ LEÓN", "localidades": ["Puente Aranda"], "barrio": "JAZMIN", "total_alumnos": 15, "geo_source": "escenario+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JOAN SEBASTIAN GARCÍA GALINDO. Profesor(a): GRACE MARCELA MARTINEZ LEÓN. Escenario: PARQUE EL JAZMIN. Horarios: SABADOS Y DOMINGOS DE 11AM A 1 PM. Escuela avalada por IDRD Bogotá (Aval Nº 944)',
      phone       = COALESCE('3212471191', phone),
      email       = COALESCE('escuelapatinsons@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE EL JAZMIN',
    'Bogotá',
    '3212471191',
    4.6095456, -74.1160196,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA ATLANTES  (IDRD-AVAL-1529)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1529';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA ATLANTES',
      'Director(a): EDWIN ARBEY BETANCOURTH GUIZA. Profesor(a): LEIDY PARRA ROA. Escenario: PISTA DE PATINAJE EL RECREO. Horarios: MIERCOLES. VIERNES Y DOMINGOS DE 4:00- 5:00PM - 2:00- 3:00PM. Escuela avalada por IDRD Bogotá (Aval Nº 1529)',
      'academy',
      'Bogotá',
      'CALLE 62 B SUR # 91 A 11',
      '3046401274',
      'eltallerdelosatlantes@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-atlantes-1529',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1529', v_school_id, '{"aval": 1529, "director": "EDWIN ARBEY BETANCOURTH GUIZA", "profesor": "LEIDY PARRA ROA", "localidades": ["Bosa"], "barrio": "EL RECREO", "total_alumnos": 33, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): EDWIN ARBEY BETANCOURTH GUIZA. Profesor(a): LEIDY PARRA ROA. Escenario: PISTA DE PATINAJE EL RECREO. Horarios: MIERCOLES. VIERNES Y DOMINGOS DE 4:00- 5:00PM - 2:00- 3:00PM. Escuela avalada por IDRD Bogotá (Aval Nº 1529)',
      phone       = COALESCE('3046401274', phone),
      email       = COALESCE('eltallerdelosatlantes@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PISTA DE PATINAJE EL RECREO',
    'Bogotá',
    '3046401274',
    4.6362601, -74.2022077,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA CHECHY BAENA  (IDRD-AVAL-692)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-692';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA CHECHY BAENA',
      'Director(a): CECILIA MARGARITA BUENA GUZMAN. Profesor(a): JOSE EDUARDO ESTRADA. Escenario: VELODROMO PRIMERA DE MAYO CARRERA 5 NO. 19-20 PRD EL SALITRE CRA 60 NO. 63-75. Horarios: VELODROMO PRIMERA DE MAYO 6 A 8 AM PRD EL SALITRE 6 A 8 AM. Escuela avalada por IDRD Bogotá (Aval Nº 692)',
      'academy',
      'Bogotá',
      'COLISEO CAYETANO CAÑIZARES CALLE 41B SUR LOCAL 5',
      '3134779409',
      'escuelachechybaena@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-chechy-baena-692',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-692', v_school_id, '{"aval": 692, "director": "CECILIA MARGARITA BUENA GUZMAN", "profesor": "JOSE EDUARDO ESTRADA", "localidades": ["San Cristóbal", "Barrios Unidos"], "barrio": "20 DE JULIO Y QUIRINAL", "total_alumnos": 39, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CECILIA MARGARITA BUENA GUZMAN. Profesor(a): JOSE EDUARDO ESTRADA. Escenario: VELODROMO PRIMERA DE MAYO CARRERA 5 NO. 19-20 PRD EL SALITRE CRA 60 NO. 63-75. Horarios: VELODROMO PRIMERA DE MAYO 6 A 8 AM PRD EL SALITRE 6 A 8 AM. Escuela avalada por IDRD Bogotá (Aval Nº 692)',
      phone       = COALESCE('3134779409', phone),
      email       = COALESCE('escuelachechybaena@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'VELODROMO PRIMERA DE MAYO CARRERA 5 NO. 19-20 PRD EL SALITRE CRA 60 NO. 63-75',
    'Bogotá',
    '3134779409',
    4.5685350, -74.0944791,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA SYLD  (IDRD-AVAL-798)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-798';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA SYLD',
      'Director(a): NELSON ENRIQUE HURTADO PARRA. Profesor(a): EDWIN GERARDO HERRERA MARTA. Escenario: PARQUE SAUZALITO AV CALLE 24 NO. 68D23. Horarios: SABADOS Y DOMINGOS 9 A 11 - 10 A 11 - 12 A 1. Escuela avalada por IDRD Bogotá (Aval Nº 798)',
      'academy',
      'Bogotá',
      'CALLE 65 BIS NO. 86-50',
      '3204186641',
      'formacionsyld@gmail.com',
      ARRAY['Natación','Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-syld-798',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-798', v_school_id, '{"aval": 798, "director": "NELSON ENRIQUE HURTADO PARRA", "profesor": "EDWIN GERARDO HERRERA MARTA", "localidades": ["Fontibón"], "barrio": "SALITRE", "total_alumnos": 17, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): NELSON ENRIQUE HURTADO PARRA. Profesor(a): EDWIN GERARDO HERRERA MARTA. Escenario: PARQUE SAUZALITO AV CALLE 24 NO. 68D23. Horarios: SABADOS Y DOMINGOS 9 A 11 - 10 A 11 - 12 A 1. Escuela avalada por IDRD Bogotá (Aval Nº 798)',
      phone       = COALESCE('3204186641', phone),
      email       = COALESCE('formacionsyld@gmail.com', email),
      sports      = ARRAY['Natación','Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE SAUZALITO AV CALLE 24 NO. 68D23',
    'Bogotá',
    '3204186641',
    4.6729745, -74.1171786,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA TENISLAND  (IDRD-AVAL-82)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-82';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA TENISLAND',
      'Director(a): CRISANTO TORO ROJAS. Profesor(a): JHONATAN ALEXANDER TOPIA. Escenario: PARQUE SAN ANDRES - CALLE 87 NO. 103F50. Horarios: LUNES Y MIERCOLES 4 A 5:30 PM. Escuela avalada por IDRD Bogotá (Aval Nº 82)',
      'academy',
      'Bogotá',
      'CALLE 87NO. 86A33',
      '3115065742',
      'crisanto1212@yahoo.es',
      ARRAY['Tenis de campo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-tenisland-82',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-82', v_school_id, '{"aval": 82, "director": "CRISANTO TORO ROJAS", "profesor": "JHONATAN ALEXANDER TOPIA", "localidades": ["Engativá"], "barrio": "BOLIVIA", "total_alumnos": 10, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CRISANTO TORO ROJAS. Profesor(a): JHONATAN ALEXANDER TOPIA. Escenario: PARQUE SAN ANDRES - CALLE 87 NO. 103F50. Horarios: LUNES Y MIERCOLES 4 A 5:30 PM. Escuela avalada por IDRD Bogotá (Aval Nº 82)',
      phone       = COALESCE('3115065742', phone),
      email       = COALESCE('crisanto1212@yahoo.es', email),
      sports      = ARRAY['Tenis de campo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE SAN ANDRES - CALLE 87 NO. 103F50',
    'Bogotá',
    '3115065742',
    4.7174048, -74.1140025,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA IGUARAN  (IDRD-AVAL-101)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-101';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA IGUARAN',
      'Director(a): FRANCISCO ALBERTO ROZO. Profesor(a): MIGUEL AGEL OSPINA LEON. Escenario: 1. PARQUE CASTILLA 2. PARQUE BOCHICA 3. PARQUE ESTRUCTURANTE BONANZA. Horarios: 1. SABADOS DE 1PM A 3PM - DOMINGOS DE 7AM A 9AM 2. JUEVES DE 4PM A 6PM - SABADOS Y DOMINGOS DE 7AM A 9AM 3. DOMINGO DE 10AM A 12PM. Escuela avalada por IDRD Bogotá (Aval Nº 101)',
      'academy',
      'Bogotá',
      'CALLE 49 A # 69 A-15',
      '3223355518',
      'fundacion@iguaran.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-iguaran-101',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-101', v_school_id, '{"aval": 101, "director": "FRANCISCO ALBERTO ROZO", "profesor": "MIGUEL AGEL OSPINA LEON", "localidades": ["Kennedy", "Engativá"], "barrio": "1. CASTILLA 2. BOCHICA 3. BONANZA", "total_alumnos": 18, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): FRANCISCO ALBERTO ROZO. Profesor(a): MIGUEL AGEL OSPINA LEON. Escenario: 1. PARQUE CASTILLA 2. PARQUE BOCHICA 3. PARQUE ESTRUCTURANTE BONANZA. Horarios: 1. SABADOS DE 1PM A 3PM - DOMINGOS DE 7AM A 9AM 2. JUEVES DE 4PM A 6PM - SABADOS Y DOMINGOS DE 7AM A 9AM 3. DOMINGO DE 10AM A 12PM. Escuela avalada por IDRD Bogotá (Aval Nº 101)',
      phone       = COALESCE('3223355518', phone),
      email       = COALESCE('fundacion@iguaran.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    '1. PARQUE CASTILLA 2. PARQUE BOCHICA 3. PARQUE ESTRUCTURANTE BONANZA',
    'Bogotá',
    '3223355518',
    4.6317782, -74.1538873,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA CROSSROLL SPEED  (IDRD-AVAL-135)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-135';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA CROSSROLL SPEED',
      'Director(a): MONICA ALEJANDRA ROJAS ESQUIVEL. Profesor(a): JOSE ALBEIRO ROMERO BASALLO. Escenario: PARQUE EL RECREO (CRA 102 CON CALLE 69A SUR). Horarios: MARTES (5 A 7 PM) SABADO Y DOMINGO (12 A 2 PM). Escuela avalada por IDRD Bogotá (Aval Nº 135)',
      'academy',
      'Bogotá',
      'CARRERA 91D No. 54D-20 Sur',
      '3502189408',
      'patinajecrossroll@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-crossroll-speed-135',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-135', v_school_id, '{"aval": 135, "director": "MONICA ALEJANDRA ROJAS ESQUIVEL", "profesor": "JOSE ALBEIRO ROMERO BASALLO", "localidades": ["Bosa"], "barrio": "Bosa EL RECREO", "total_alumnos": 20, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): MONICA ALEJANDRA ROJAS ESQUIVEL. Profesor(a): JOSE ALBEIRO ROMERO BASALLO. Escenario: PARQUE EL RECREO (CRA 102 CON CALLE 69A SUR). Horarios: MARTES (5 A 7 PM) SABADO Y DOMINGO (12 A 2 PM). Escuela avalada por IDRD Bogotá (Aval Nº 135)',
      phone       = COALESCE('3502189408', phone),
      email       = COALESCE('patinajecrossroll@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE EL RECREO (CRA 102 CON CALLE 69A SUR)',
    'Bogotá',
    '3502189408',
    4.6371319, -74.2002411,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA INTEGRAL DE CICLISMO Y PATINAJE ROBERTO OSO SANCHEZ  (IDRD-AVAL-251)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-251';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA INTEGRAL DE CICLISMO Y PATINAJE ROBERTO OSO SANCHEZ',
      'Director(a): CAMILO EDUARDO CANTOR TIRIA. Profesor(a): MARTHA LUZ LOPEZ LOZANO. Escenario: VELODROMO PRIMERA DE MAYO PARQUE EL JAZMIN. Horarios: PATINAJE VELODROMO PRIMERA DE MAYO MARTES Y JUEVES (4-6PM) PATINAJE PARQUE EL JAZMIN SABADOS (8-10 AM) Y (3-5PM) CICLISMO VELODROMO PRIMERA DE MAYO MARTES Y JUEVES (4-6PM). Escuela avalada por IDRD Bogotá (Aval Nº 251)',
      'academy',
      'Bogotá',
      'CARRERA 51B NO. 16-21 SUR INT 54',
      '3144464526',
      'escuelaintegralrobertoososanchez@hotmail.com',
      ARRAY['Patinaje de carreras','Ciclismo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-integral-de-ciclismo-y-patinaje-roberto-oso-sanchez-251',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-251', v_school_id, '{"aval": 251, "director": "CAMILO EDUARDO CANTOR TIRIA", "profesor": "MARTHA LUZ LOPEZ LOZANO", "localidades": ["San Cristóbal", "Puente Aranda"], "barrio": "JAZMIN Y 20 DE JULIO", "total_alumnos": 32, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CAMILO EDUARDO CANTOR TIRIA. Profesor(a): MARTHA LUZ LOPEZ LOZANO. Escenario: VELODROMO PRIMERA DE MAYO PARQUE EL JAZMIN. Horarios: PATINAJE VELODROMO PRIMERA DE MAYO MARTES Y JUEVES (4-6PM) PATINAJE PARQUE EL JAZMIN SABADOS (8-10 AM) Y (3-5PM) CICLISMO VELODROMO PRIMERA DE MAYO MARTES Y JUEVES (4-6PM). Escuela avalada por IDRD Bogotá (Aval Nº 251)',
      phone       = COALESCE('3144464526', phone),
      email       = COALESCE('escuelaintegralrobertoososanchez@hotmail.com', email),
      sports      = ARRAY['Patinaje de carreras','Ciclismo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'VELODROMO PRIMERA DE MAYO PARQUE EL JAZMIN',
    'Bogotá',
    '3144464526',
    4.5685350, -74.0944791,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA COLOMBIANA DE FÚTBOL ECOFÚTBOL  (IDRD-AVAL-356)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-356';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA COLOMBIANA DE FÚTBOL ECOFÚTBOL',
      'Director(a): GABRIEL MACEDONIO PARRAGA REYES. Profesor(a): MANUEL VICENTE ALVARADO MURCIA. Escenario: PARQUE TOBERIN. Horarios: SABADOS Y DOMINGOS (8-10 AM). Escuela avalada por IDRD Bogotá (Aval Nº 356)',
      'academy',
      'Bogotá',
      'CARRERA 138 NO. 161-70 INT 2',
      '3212368309',
      'ecofutbol@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-colombiana-de-futbol-ecofutbol-356',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-356', v_school_id, '{"aval": 356, "director": "GABRIEL MACEDONIO PARRAGA REYES", "profesor": "MANUEL VICENTE ALVARADO MURCIA", "localidades": ["Usaquén"], "barrio": "TOBERIN", "total_alumnos": 20, "geo_source": "escenario+barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): GABRIEL MACEDONIO PARRAGA REYES. Profesor(a): MANUEL VICENTE ALVARADO MURCIA. Escenario: PARQUE TOBERIN. Horarios: SABADOS Y DOMINGOS (8-10 AM). Escuela avalada por IDRD Bogotá (Aval Nº 356)',
      phone       = COALESCE('3212368309', phone),
      email       = COALESCE('ecofutbol@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE TOBERIN',
    'Bogotá',
    '3212368309',
    4.7442999, -74.0398154,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA RAYO  (IDRD-AVAL-360)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-360';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA RAYO',
      'Director(a): JOHN GERARDO HUERTAS ROJAS. Profesor(a): EDGARDO DAZA RODRIGUEZ. Escenario: PARQUE LA GAITANA CARRERA 125 NO. 132A - 06. Horarios: SABADOS Y DOMINGOS (12 A 2PM). Escuela avalada por IDRD Bogotá (Aval Nº 360)',
      'academy',
      'Bogotá',
      'TRANSVERSAL 126 NO. 133-11',
      '3144451445',
      'rayo_vallecas@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-rayo-360',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-360', v_school_id, '{"aval": 360, "director": "JOHN GERARDO HUERTAS ROJAS", "profesor": "EDGARDO DAZA RODRIGUEZ", "localidades": ["Suba"], "barrio": "LA GAITANA", "total_alumnos": 25, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JOHN GERARDO HUERTAS ROJAS. Profesor(a): EDGARDO DAZA RODRIGUEZ. Escenario: PARQUE LA GAITANA CARRERA 125 NO. 132A - 06. Horarios: SABADOS Y DOMINGOS (12 A 2PM). Escuela avalada por IDRD Bogotá (Aval Nº 360)',
      phone       = COALESCE('3144451445', phone),
      email       = COALESCE('rayo_vallecas@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE LA GAITANA CARRERA 125 NO. 132A - 06',
    'Bogotá',
    '3144451445',
    4.7413965, -74.1129959,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA STAR CHAMPIONS  (IDRD-AVAL-890)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-890';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA STAR CHAMPIONS',
      'Director(a): EDUAR FERNANDO CAMACHO GUTIERREZ. Profesor(a): EDINSON FABIAN PIRACON SARMIENTO. Escenario: PARQUE SAN ANDRES CALLE 82 NO. 100A-51. Horarios: SABADOS Y DOMINGOS (8-10) (11-1). Escuela avalada por IDRD Bogotá (Aval Nº 890)',
      'academy',
      'Bogotá',
      'CALLE 130 B NO. 104-08',
      '3124325932',
      'eduartenis2009@hotmail.com',
      ARRAY['Tenis de campo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-star-champions-890',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-890', v_school_id, '{"aval": 890, "director": "EDUAR FERNANDO CAMACHO GUTIERREZ", "profesor": "EDINSON FABIAN PIRACON SARMIENTO", "localidades": ["Engativá"], "barrio": "CORTIJO", "total_alumnos": 9, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): EDUAR FERNANDO CAMACHO GUTIERREZ. Profesor(a): EDINSON FABIAN PIRACON SARMIENTO. Escenario: PARQUE SAN ANDRES CALLE 82 NO. 100A-51. Horarios: SABADOS Y DOMINGOS (8-10) (11-1). Escuela avalada por IDRD Bogotá (Aval Nº 890)',
      phone       = COALESCE('3124325932', phone),
      email       = COALESCE('eduartenis2009@hotmail.com', email),
      sports      = ARRAY['Tenis de campo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE SAN ANDRES CALLE 82 NO. 100A-51',
    'Bogotá',
    '3124325932',
    4.7262961, -74.1204414,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA LONDON  (IDRD-AVAL-266)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-266';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA LONDON',
      'Director(a): EDWIN SNEIDER AREVALO VELASQUEZ. Profesor(a): ORLANDO CARDENAS SANCHEZ. Escenario: PARQUE AUTOPISTA SUR - PAVCO CARA 75 NO. 94 SUR. Horarios: SABADOS Y DOMINGOS (7-9 AM). Escuela avalada por IDRD Bogotá (Aval Nº 266)',
      'academy',
      'Bogotá',
      'CALLE 62 SUR NO. 71H - 16',
      '3163940591',
      'edwinarevalo18@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-london-266',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-266', v_school_id, '{"aval": 266, "director": "EDWIN SNEIDER AREVALO VELASQUEZ", "profesor": "ORLANDO CARDENAS SANCHEZ", "localidades": ["Bosa"], "barrio": "VILLA DEL RIO", "total_alumnos": 16, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): EDWIN SNEIDER AREVALO VELASQUEZ. Profesor(a): ORLANDO CARDENAS SANCHEZ. Escenario: PARQUE AUTOPISTA SUR - PAVCO CARA 75 NO. 94 SUR. Horarios: SABADOS Y DOMINGOS (7-9 AM). Escuela avalada por IDRD Bogotá (Aval Nº 266)',
      phone       = COALESCE('3163940591', phone),
      email       = COALESCE('edwinarevalo18@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE AUTOPISTA SUR - PAVCO CARA 75 NO. 94 SUR',
    'Bogotá',
    '3163940591',
    4.6010702, -74.1589094,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA OPTIMA SPORT  (IDRD-AVAL-393)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-393';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA OPTIMA SPORT',
      'Director(a): AIDA MARCELA VENEGAS ROJAS. Profesor(a): ELKIN FABIAN QUITO. Escenario: PARQUE JUAN AMARILLO AC 90 - PARQUE SAN ANDRES CALLE 82 # 100 A 91. Horarios: SABADOS Y DOMINGOS 8:00 AM - 1:00 PM. Escuela avalada por IDRD Bogotá (Aval Nº 393)',
      'academy',
      'Bogotá',
      'CARRERA 93 No. 75 - 65',
      '3103433318',
      'optimasporttenis@gmail.com',
      ARRAY['Tenis de campo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-optima-sport-393',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-393', v_school_id, '{"aval": 393, "director": "AIDA MARCELA VENEGAS ROJAS", "profesor": "ELKIN FABIAN QUITO", "localidades": ["Engativá"], "barrio": "CORTIJO", "total_alumnos": 31, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): AIDA MARCELA VENEGAS ROJAS. Profesor(a): ELKIN FABIAN QUITO. Escenario: PARQUE JUAN AMARILLO AC 90 - PARQUE SAN ANDRES CALLE 82 # 100 A 91. Horarios: SABADOS Y DOMINGOS 8:00 AM - 1:00 PM. Escuela avalada por IDRD Bogotá (Aval Nº 393)',
      phone       = COALESCE('3103433318', phone),
      email       = COALESCE('optimasporttenis@gmail.com', email),
      sports      = ARRAY['Tenis de campo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE JUAN AMARILLO AC 90 - PARQUE SAN ANDRES CALLE 82 # 100 A 91',
    'Bogotá',
    '3103433318',
    4.7262961, -74.1204414,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA JLM SKATE  (IDRD-AVAL-1398)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1398';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA JLM SKATE',
      'Director(a): CAMILO ANDRES ROZO SUEZSCA. Profesor(a): JEFFERSON VARGAS AGUAZACO. Escenario: PARQUE FONTANAR DEL RIO Calle 144 c #141. Horarios: Martes - Jueves 4:00 - 6:00pm Sabados y Domingos 9:00 - 11:00 am. Escuela avalada por IDRD Bogotá (Aval Nº 1398)',
      'academy',
      'Bogotá',
      'Transversal 126 A # 132 B 61',
      '3152129056',
      'ljmskate1@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-jlm-skate-1398',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1398', v_school_id, '{"aval": 1398, "director": "CAMILO ANDRES ROZO SUEZSCA", "profesor": "JEFFERSON VARGAS AGUAZACO", "localidades": ["Suba"], "barrio": "FONTANAR DEL RIO", "total_alumnos": 47, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CAMILO ANDRES ROZO SUEZSCA. Profesor(a): JEFFERSON VARGAS AGUAZACO. Escenario: PARQUE FONTANAR DEL RIO Calle 144 c #141. Horarios: Martes - Jueves 4:00 - 6:00pm Sabados y Domingos 9:00 - 11:00 am. Escuela avalada por IDRD Bogotá (Aval Nº 1398)',
      phone       = COALESCE('3152129056', phone),
      email       = COALESCE('ljmskate1@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE FONTANAR DEL RIO Calle 144 c #141',
    'Bogotá',
    '3152129056',
    4.7573232, -74.1118150,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA LA ROCA  (IDRD-AVAL-1488)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1488';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA LA ROCA',
      'Director(a): JHON EWARD DIAZ MAECHA. Profesor(a): STEFANY DAYANA FLOREZ. Escenario: PARQUE SAN ANDRES CALLE 82 # 100 A 91. Horarios: LUNES 6:00 - 8:00 PM MARTES 4:00- 5:00PM MIERCOLES 5:00- 7:00 PM VIERNES 4:00 - 5:00PM SABADOS 6:00- 7:00AM DOMINGOS 12:00 - 1:30PM. Escuela avalada por IDRD Bogotá (Aval Nº 1488)',
      'academy',
      'Bogotá',
      'CALLE 86 # 114 - 76 TORRE4 APTO 504',
      '3012413479',
      'laroca.formaciondeportiva@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-la-roca-1488',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1488', v_school_id, '{"aval": 1488, "director": "JHON EWARD DIAZ MAECHA", "profesor": "STEFANY DAYANA FLOREZ", "localidades": ["Engativá"], "barrio": "BOCHICA", "total_alumnos": 18, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JHON EWARD DIAZ MAECHA. Profesor(a): STEFANY DAYANA FLOREZ. Escenario: PARQUE SAN ANDRES CALLE 82 # 100 A 91. Horarios: LUNES 6:00 - 8:00 PM MARTES 4:00- 5:00PM MIERCOLES 5:00- 7:00 PM VIERNES 4:00 - 5:00PM SABADOS 6:00- 7:00AM DOMINGOS 12:00 - 1:30PM. Escuela avalada por IDRD Bogotá (Aval Nº 1488)',
      phone       = COALESCE('3012413479', phone),
      email       = COALESCE('laroca.formaciondeportiva@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE SAN ANDRES CALLE 82 # 100 A 91',
    'Bogotá',
    '3012413479',
    4.7157693, -74.1087116,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA RECREO DEPORTIVA CAMALEON  (IDRD-AVAL-1614)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1614';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA RECREO DEPORTIVA CAMALEON',
      'Director(a): JOSE ALFONSO RIAÑO HUERFANO. Profesor(a): JAVIER ALEXANDER JIMENEZ. Escenario: PARQUE ALTA BLANCA CALLE 156 NO. 8-36. Horarios: LUNES Y MIERCOLES (5 A 6 PM) SABADOS (7-8 AM). Escuela avalada por IDRD Bogotá (Aval Nº 1614)',
      'academy',
      'Bogotá',
      'CALLE 180 BIS NO. 7D-72',
      '3203428541',
      'escuelacamaleon@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-recreo-deportiva-camaleon-1614',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1614', v_school_id, '{"aval": 1614, "director": "JOSE ALFONSO RIAÑO HUERFANO", "profesor": "JAVIER ALEXANDER JIMENEZ", "localidades": ["Usaquén"], "barrio": "USAQUÉN", "total_alumnos": 22, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JOSE ALFONSO RIAÑO HUERFANO. Profesor(a): JAVIER ALEXANDER JIMENEZ. Escenario: PARQUE ALTA BLANCA CALLE 156 NO. 8-36. Horarios: LUNES Y MIERCOLES (5 A 6 PM) SABADOS (7-8 AM). Escuela avalada por IDRD Bogotá (Aval Nº 1614)',
      phone       = COALESCE('3203428541', phone),
      email       = COALESCE('escuelacamaleon@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE ALTA BLANCA CALLE 156 NO. 8-36',
    'Bogotá',
    '3203428541',
    4.6952190, -74.0309322,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA BARZA SOCCER  (IDRD-AVAL-38)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-38';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA BARZA SOCCER',
      'Director(a): RUBEN DARIO RAMIREZ MARTINEZ. Profesor(a): JESUS PINZON. Escenario: PARQUE SAN ANDRES CALLE 82 # 100 A 91. Horarios: SABADO (11-12:30) DOMINGO (10:00 A 12:00). Escuela avalada por IDRD Bogotá (Aval Nº 38)',
      'academy',
      'Bogotá',
      'DIAGONAL 82 G NO. 75-29 /501',
      '3178847391',
      'rubendramirez7@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-barza-soccer-38',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-38', v_school_id, '{"aval": 38, "director": "RUBEN DARIO RAMIREZ MARTINEZ", "profesor": "JESUS PINZON", "localidades": ["Engativá"], "barrio": "Engativá", "total_alumnos": 14, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): RUBEN DARIO RAMIREZ MARTINEZ. Profesor(a): JESUS PINZON. Escenario: PARQUE SAN ANDRES CALLE 82 # 100 A 91. Horarios: SABADO (11-12:30) DOMINGO (10:00 A 12:00). Escuela avalada por IDRD Bogotá (Aval Nº 38)',
      phone       = COALESCE('3178847391', phone),
      email       = COALESCE('rubendramirez7@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE SAN ANDRES CALLE 82 # 100 A 91',
    'Bogotá',
    '3178847391',
    4.7086571, -74.1096470,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA AFS TRAINER  (IDRD-AVAL-628)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-628';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA AFS TRAINER',
      'Director(a): LEYDY KATHERI DUARTE ARIZA. Profesor(a): GLORIA ESTELLA FERRUCHO DIAZ. Escenario: PARQUE AUTOPISTA SUR CARRERA 72 NO. 57H - 94 SUR PARQUE MEISSEN CALLE 62 BIS SUR NO. 16C - 40. Horarios: PARQUE AUTOPISTA (SABADOS DE 3 A 4 PM) Y (DOMINGOS DE 2 A 3 PM) PARQUE MEISSEN ( SABADO DE 7 A 8 AM Y DE 3 A 4 PM) (DOMINGOS DE 10 A 11 AM). Escuela avalada por IDRD Bogotá (Aval Nº 628)',
      'academy',
      'Bogotá',
      'CALLE 63 SUR NO. 16D-13',
      '3227505770',
      'efs.trainer@gmail.com',
      ARRAY['Natación']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-afs-trainer-628',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-628', v_school_id, '{"aval": 628, "director": "LEYDY KATHERI DUARTE ARIZA", "profesor": "GLORIA ESTELLA FERRUCHO DIAZ", "localidades": ["Ciudad Bolívar"], "barrio": "VILLA DEL RIO Y MEISSEN", "total_alumnos": 16, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): LEYDY KATHERI DUARTE ARIZA. Profesor(a): GLORIA ESTELLA FERRUCHO DIAZ. Escenario: PARQUE AUTOPISTA SUR CARRERA 72 NO. 57H - 94 SUR PARQUE MEISSEN CALLE 62 BIS SUR NO. 16C - 40. Horarios: PARQUE AUTOPISTA (SABADOS DE 3 A 4 PM) Y (DOMINGOS DE 2 A 3 PM) PARQUE MEISSEN ( SABADO DE 7 A 8 AM Y DE 3 A 4 PM) (DOMINGOS DE 10 A 11 AM). Escuela avalada por IDRD Bogotá (Aval Nº 628)',
      phone       = COALESCE('3227505770', phone),
      email       = COALESCE('efs.trainer@gmail.com', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE AUTOPISTA SUR CARRERA 72 NO. 57H - 94 SUR PARQUE MEISSEN CALLE 62 BIS SUR NO. 16C - 40',
    'Bogotá',
    '3227505770',
    4.5681900, -74.1540483,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA UNION BLAUGRANA  (IDRD-AVAL-670)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-670';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA UNION BLAUGRANA',
      'Director(a): OMAR VALDERRAMA RODRIGUEZ. Profesor(a): JUAN PABLO MEDINA. Escenario: NUEVO MILENIO CARRERA 11NO. 67A 66 SUR. Horarios: SABADOS Y DOMINGOS (8-10 AM). Escuela avalada por IDRD Bogotá (Aval Nº 670)',
      'academy',
      'Bogotá',
      'CARRERA 11 NO. 67 A 66 SUR T9 APT 201',
      '3107903382',
      'omar1190@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-union-blaugrana-670',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-670', v_school_id, '{"aval": 670, "director": "OMAR VALDERRAMA RODRIGUEZ", "profesor": "JUAN PABLO MEDINA", "localidades": ["Usme"], "barrio": "FISCALA", "total_alumnos": 32, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): OMAR VALDERRAMA RODRIGUEZ. Profesor(a): JUAN PABLO MEDINA. Escenario: NUEVO MILENIO CARRERA 11NO. 67A 66 SUR. Horarios: SABADOS Y DOMINGOS (8-10 AM). Escuela avalada por IDRD Bogotá (Aval Nº 670)',
      phone       = COALESCE('3107903382', phone),
      email       = COALESCE('omar1190@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'NUEVO MILENIO CARRERA 11NO. 67A 66 SUR',
    'Bogotá',
    '3107903382',
    4.5302808, -74.1068158,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA ROLLING SPACE  (IDRD-AVAL-679)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-679';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA ROLLING SPACE',
      'Director(a): JEIMMY ANDREA COLORADO ECHEVERRÍA. Profesor(a): NA. Escenario: PARQUE VILLAMAYOR CARRERA 34C CALLE 38 SUR. Horarios: SABADOS Y DOMINGOS (10-12M) MARTES Y JUEVES (4-6PM). Escuela avalada por IDRD Bogotá (Aval Nº 679)',
      'academy',
      'Bogotá',
      'CALLE 43 A NO. 9-16',
      '3143539141',
      'andrea1pat.ac@gmail.com',
      ARRAY['Patinaje artístico']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-rolling-space-679',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-679', v_school_id, '{"aval": 679, "director": "JEIMMY ANDREA COLORADO ECHEVERRÍA", "profesor": "NA", "localidades": ["Antonio Nariño"], "barrio": "ANTONIO NARIÑO", "total_alumnos": 25, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JEIMMY ANDREA COLORADO ECHEVERRÍA. Profesor(a): NA. Escenario: PARQUE VILLAMAYOR CARRERA 34C CALLE 38 SUR. Horarios: SABADOS Y DOMINGOS (10-12M) MARTES Y JUEVES (4-6PM). Escuela avalada por IDRD Bogotá (Aval Nº 679)',
      phone       = COALESCE('3143539141', phone),
      email       = COALESCE('andrea1pat.ac@gmail.com', email),
      sports      = ARRAY['Patinaje artístico']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE VILLAMAYOR CARRERA 34C CALLE 38 SUR',
    'Bogotá',
    '3143539141',
    4.5863246, -74.0999962,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA GOLDEN TUNAL  (IDRD-AVAL-1021)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1021';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA GOLDEN TUNAL',
      'Director(a): OSCAR ANDRES PACAVITA VELASQUEZ. Profesor(a): DEIVED PACAVITA GALINDEZ. Escenario: PARQUE VECINAL URBANIZACION TUNAL II. Horarios: MARTES, JUEVES Y SABADO (4 A 7PM). Escuela avalada por IDRD Bogotá (Aval Nº 1021)',
      'academy',
      'Bogotá',
      'DIAGONAL 52Z NO. 31-82 SUR',
      '3204270196',
      'oscarandres37@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-golden-tunal-1021',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1021', v_school_id, '{"aval": 1021, "director": "OSCAR ANDRES PACAVITA VELASQUEZ", "profesor": "DEIVED PACAVITA GALINDEZ", "localidades": ["Tunjuelito"], "barrio": "Tunjuelito", "total_alumnos": 30, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): OSCAR ANDRES PACAVITA VELASQUEZ. Profesor(a): DEIVED PACAVITA GALINDEZ. Escenario: PARQUE VECINAL URBANIZACION TUNAL II. Horarios: MARTES, JUEVES Y SABADO (4 A 7PM). Escuela avalada por IDRD Bogotá (Aval Nº 1021)',
      phone       = COALESCE('3204270196', phone),
      email       = COALESCE('oscarandres37@hotmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE VECINAL URBANIZACION TUNAL II',
    'Bogotá',
    '3204270196',
    4.5627675, -74.1271328,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA LOS AMIGOS  (IDRD-AVAL-1131)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1131';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA LOS AMIGOS',
      'Director(a): YATHSON ALBERTO CRUZ RESTREPO. Profesor(a): DIEGO ALEJANDRO JEREZ HERRERA. Escenario: PARQUE URBANIZACION MOLINOS 2 TRANVERSAL 5 CALLE 48L SUR URBANIZACION CIUDADA HAYUELOS CALLE 19A CARRERA 80A. Horarios: PARQUE URBANIZACION MOLINOS (SAB 12 A 2PM) (DOM 10 A 12M) URBANIZACION CIUDADA HAYUELOS (SAB 12 A 2PM) (DOM 11:30 A 1:30 PM). Escuela avalada por IDRD Bogotá (Aval Nº 1131)',
      'academy',
      'Bogotá',
      'CARRERA 60B BIS NO. 22-51',
      '3208163282',
      'clubdeportivo10losamigosfc@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-los-amigos-1131',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1131', v_school_id, '{"aval": 1131, "director": "YATHSON ALBERTO CRUZ RESTREPO", "profesor": "DIEGO ALEJANDRO JEREZ HERRERA", "localidades": ["Rafael Uribe Uribe Fontibón"], "barrio": "MOLINOS HAYUELOS", "total_alumnos": 35, "geo_source": "not_found"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): YATHSON ALBERTO CRUZ RESTREPO. Profesor(a): DIEGO ALEJANDRO JEREZ HERRERA. Escenario: PARQUE URBANIZACION MOLINOS 2 TRANVERSAL 5 CALLE 48L SUR URBANIZACION CIUDADA HAYUELOS CALLE 19A CARRERA 80A. Horarios: PARQUE URBANIZACION MOLINOS (SAB 12 A 2PM) (DOM 10 A 12M) URBANIZACION CIUDADA HAYUELOS (SAB 12 A 2PM) (DOM 11:30 A 1:30 PM). Escuela avalada por IDRD Bogotá (Aval Nº 1131)',
      phone       = COALESCE('3208163282', phone),
      email       = COALESCE('clubdeportivo10losamigosfc@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sin lat/lng confiable: NO crear branch (no aparecera en mapa)
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA MAGIC KIDS  (IDRD-AVAL-1346)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1346';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA MAGIC KIDS',
      'Director(a): YANIRA CILENA VILLAMARIN. Profesor(a): VERONICA XIMENA SANCHEZ. Escenario: PARQUE LAGO TIMIZA CARRERA 72N BIS CALLE 40H SUR. Horarios: JUEVES (4-6 PM) DOMINGO (6:30 A 8:30 AM). Escuela avalada por IDRD Bogotá (Aval Nº 1346)',
      'academy',
      'Bogotá',
      'CARRERA 72N BIS CALLE 40H SUR',
      '3143533190',
      'clubmagicpatinaje@gmail.com',
      ARRAY['Patinaje de carreras']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-magic-kids-1346',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1346', v_school_id, '{"aval": 1346, "director": "YANIRA CILENA VILLAMARIN", "profesor": "VERONICA XIMENA SANCHEZ", "localidades": ["Kennedy"], "barrio": "LAGO TIMIZA", "total_alumnos": 19, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): YANIRA CILENA VILLAMARIN. Profesor(a): VERONICA XIMENA SANCHEZ. Escenario: PARQUE LAGO TIMIZA CARRERA 72N BIS CALLE 40H SUR. Horarios: JUEVES (4-6 PM) DOMINGO (6:30 A 8:30 AM). Escuela avalada por IDRD Bogotá (Aval Nº 1346)',
      phone       = COALESCE('3143533190', phone),
      email       = COALESCE('clubmagicpatinaje@gmail.com', email),
      sports      = ARRAY['Patinaje de carreras']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE LAGO TIMIZA CARRERA 72N BIS CALLE 40H SUR',
    'Bogotá',
    '3143533190',
    4.6079676, -74.1521525,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA TENIS ENTR  (IDRD-AVAL-1662)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1662';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA TENIS ENTR',
      'Director(a): VICTOR JAVIER RAMIREZ ROBAYO. Profesor(a): JOSE LUIS GARCÍA RUIZ. Escenario: CALLE 48C SUR NO. 22D-81. Horarios: SABADOS Y DOMINGOS DE 11AM A 1PM. Escuela avalada por IDRD Bogotá (Aval Nº 1662)',
      'academy',
      'Bogotá',
      'CARRERA 24C NO. 54SUR 60 INT 3 APT 503',
      '3134316444',
      'escuelanacionaldetenis.entr@gmail.com',
      ARRAY['Tenis de campo']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-tenis-entr-1662',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1662', v_school_id, '{"aval": 1662, "director": "VICTOR JAVIER RAMIREZ ROBAYO", "profesor": "JOSE LUIS GARCÍA RUIZ", "localidades": ["Tunjuelito"], "barrio": "Tunjuelito", "total_alumnos": 36, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): VICTOR JAVIER RAMIREZ ROBAYO. Profesor(a): JOSE LUIS GARCÍA RUIZ. Escenario: CALLE 48C SUR NO. 22D-81. Horarios: SABADOS Y DOMINGOS DE 11AM A 1PM. Escuela avalada por IDRD Bogotá (Aval Nº 1662)',
      phone       = COALESCE('3134316444', phone),
      email       = COALESCE('escuelanacionaldetenis.entr@gmail.com', email),
      sports      = ARRAY['Tenis de campo']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CALLE 48C SUR NO. 22D-81',
    'Bogotá',
    '3134316444',
    4.5627675, -74.1271328,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA COLACHO MILLOS  (IDRD-AVAL-1663)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1663';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA COLACHO MILLOS',
      'Director(a): CESAR AUGUSTO CALDERON VILLARRAGA. Profesor(a): MICHAEL ANDRES CASTRO GUZMAN. Escenario: PARQUE LAGO TIMIZA CARRERA 72N BIS CALLE 40H SUR. Horarios: SABADO (8-10AM) DOMINGO (10-12M). Escuela avalada por IDRD Bogotá (Aval Nº 1663)',
      'academy',
      'Bogotá',
      'CALLE 57B SUR NO. 64-30',
      '3102060439',
      'cesar_deportes@hotmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-colacho-millos-1663',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1663', v_school_id, '{"aval": 1663, "director": "CESAR AUGUSTO CALDERON VILLARRAGA", "profesor": "MICHAEL ANDRES CASTRO GUZMAN", "localidades": ["Kennedy"], "barrio": "VILLA DEL RIO", "total_alumnos": 18, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): CESAR AUGUSTO CALDERON VILLARRAGA. Profesor(a): MICHAEL ANDRES CASTRO GUZMAN. Escenario: PARQUE LAGO TIMIZA CARRERA 72N BIS CALLE 40H SUR. Horarios: SABADO (8-10AM) DOMINGO (10-12M). Escuela avalada por IDRD Bogotá (Aval Nº 1663)',
      phone       = COALESCE('3102060439', phone),
      email       = COALESCE('cesar_deportes@hotmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE LAGO TIMIZA CARRERA 72N BIS CALLE 40H SUR',
    'Bogotá',
    '3102060439',
    4.5980130, -74.1527065,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA COLSUBSIDIO  (IDRD-AVAL-203)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-203';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA COLSUBSIDIO',
      'Director(a): MARIA ANGELICA BELLO MORENO. Profesor(a): GILMA LEONOR JARA LARA. Escenario: CLUB EL CUBO Avenida carrera 30 # 52-77. Horarios: DIFERENTES HORARIOS PARA CADA DEPORTE Y SEDES. Escuela avalada por IDRD Bogotá (Aval Nº 203)',
      'academy',
      'Bogotá',
      'CLUB EL CUBO Avenida carrera 30 # 52-77',
      '3102651445',
      'escuelas.deportivas@colsubsidio.com',
      ARRAY['Baloncesto','Baile deportivo','Bolos','Fútbol','Karate','Natación','Patinaje','Squash','Taekwondo','Tenis','Tenis de mesa','Voleibol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-colsubsidio-203',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-203', v_school_id, '{"aval": 203, "director": "MARIA ANGELICA BELLO MORENO", "profesor": "GILMA LEONOR JARA LARA", "localidades": ["Chapinero"], "barrio": "TEUSAQUILLO", "total_alumnos": 6405, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): MARIA ANGELICA BELLO MORENO. Profesor(a): GILMA LEONOR JARA LARA. Escenario: CLUB EL CUBO Avenida carrera 30 # 52-77. Horarios: DIFERENTES HORARIOS PARA CADA DEPORTE Y SEDES. Escuela avalada por IDRD Bogotá (Aval Nº 203)',
      phone       = COALESCE('3102651445', phone),
      email       = COALESCE('escuelas.deportivas@colsubsidio.com', email),
      sports      = ARRAY['Baloncesto','Baile deportivo','Bolos','Fútbol','Karate','Natación','Patinaje','Squash','Taekwondo','Tenis','Tenis de mesa','Voleibol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CLUB EL CUBO Avenida carrera 30 # 52-77',
    'Bogotá',
    '3102651445',
    4.6274669, -74.0667094,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA WAKANDA BASKETBALL  (IDRD-AVAL-249)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-249';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA WAKANDA BASKETBALL',
      'Director(a): YESSICA LORENA OBREGON LEON. Profesor(a): JUAN CARLOS ROBLEDO RAMIREZ. Escenario: PARQUE HEROES DE COLOMIA CARRERA 74 NO. 163-74. Horarios: SABADOS Y DOMINGOS DE (8 - 12M). Escuela avalada por IDRD Bogotá (Aval Nº 249)',
      'academy',
      'Bogotá',
      'CARRERA 8D NO. 191-15 T7 OF 308',
      '3173293855',
      'jessiobreleon@gmail.com',
      ARRAY['Baloncesto']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-wakanda-basketball-249',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-249', v_school_id, '{"aval": 249, "director": "YESSICA LORENA OBREGON LEON", "profesor": "JUAN CARLOS ROBLEDO RAMIREZ", "localidades": ["Suba"], "barrio": "Suba", "total_alumnos": 15, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): YESSICA LORENA OBREGON LEON. Profesor(a): JUAN CARLOS ROBLEDO RAMIREZ. Escenario: PARQUE HEROES DE COLOMIA CARRERA 74 NO. 163-74. Horarios: SABADOS Y DOMINGOS DE (8 - 12M). Escuela avalada por IDRD Bogotá (Aval Nº 249)',
      phone       = COALESCE('3173293855', phone),
      email       = COALESCE('jessiobreleon@gmail.com', email),
      sports      = ARRAY['Baloncesto']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE HEROES DE COLOMIA CARRERA 74 NO. 163-74',
    'Bogotá',
    '3173293855',
    4.8099319, -74.0351818,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA BURBUJAS  (IDRD-AVAL-1685)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1685';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA BURBUJAS',
      'Director(a): LUIS HUMBERTO OSPINA LOPEZ. Profesor(a): GUSTAVO ADOLFO PATIÑO GOMEZ. Escenario: CARRERA 56 NO. 169A-38. Horarios: LUNES A JUEVES (8 A 6PM) SABADO Y DOMINGO (7 A 1PM). Escuela avalada por IDRD Bogotá (Aval Nº 1685)',
      'academy',
      'Bogotá',
      'CARRERA 56 NO. 169A-38',
      '6016898339',
      'burbujas1a@yahoo.es',
      ARRAY['Natación']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-burbujas-1685',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1685', v_school_id, '{"aval": 1685, "director": "LUIS HUMBERTO OSPINA LOPEZ", "profesor": "GUSTAVO ADOLFO PATIÑO GOMEZ", "localidades": ["Suba"], "barrio": "Suba", "total_alumnos": 20, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): LUIS HUMBERTO OSPINA LOPEZ. Profesor(a): GUSTAVO ADOLFO PATIÑO GOMEZ. Escenario: CARRERA 56 NO. 169A-38. Horarios: LUNES A JUEVES (8 A 6PM) SABADO Y DOMINGO (7 A 1PM). Escuela avalada por IDRD Bogotá (Aval Nº 1685)',
      phone       = COALESCE('6016898339', phone),
      email       = COALESCE('burbujas1a@yahoo.es', email),
      sports      = ARRAY['Natación']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'CARRERA 56 NO. 169A-38',
    'Bogotá',
    '6016898339',
    4.8099319, -74.0351818,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA REAL SCORPIONS  (IDRD-AVAL-1680)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-1680';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA REAL SCORPIONS',
      'Director(a): JUAN FELIPE LOPEZ OCHOA. Profesor(a): GUSTAVO ADOLFO CARVAJAL. Escenario: POLIDEPORTIVO NUEVO MUZU CARRERA 61B NO. 52A SUR 50. Horarios: SABADOS Y DOMINGOS (8 A 10 AM). Escuela avalada por IDRD Bogotá (Aval Nº 1680)',
      'academy',
      'Bogotá',
      'CARRERA 60C NO. 49A-20 SUR',
      '3108673587',
      'escueladefutbolrealscorpion@gmail.com',
      ARRAY['Fútbol']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-real-scorpions-1680',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-1680', v_school_id, '{"aval": 1680, "director": "JUAN FELIPE LOPEZ OCHOA", "profesor": "GUSTAVO ADOLFO CARVAJAL", "localidades": ["Tunjuelito"], "barrio": "Tunjuelito", "total_alumnos": 33, "geo_source": "barrio+localidad"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JUAN FELIPE LOPEZ OCHOA. Profesor(a): GUSTAVO ADOLFO CARVAJAL. Escenario: POLIDEPORTIVO NUEVO MUZU CARRERA 61B NO. 52A SUR 50. Horarios: SABADOS Y DOMINGOS (8 A 10 AM). Escuela avalada por IDRD Bogotá (Aval Nº 1680)',
      phone       = COALESCE('3108673587', phone),
      email       = COALESCE('escueladefutbolrealscorpion@gmail.com', email),
      sports      = ARRAY['Fútbol']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'POLIDEPORTIVO NUEVO MUZU CARRERA 61B NO. 52A SUR 50',
    'Bogotá',
    '3108673587',
    4.5627675, -74.1271328,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────
-- ESCUELA DE FORMACION DEPORTIVA RAPTORS  (IDRD-AVAL-60)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'IDRD-AVAL-60';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email,
      sports, verified, is_demo, slug, onboarding_status
    ) VALUES (
      'ESCUELA DE FORMACION DEPORTIVA RAPTORS',
      'Director(a): JOSE ALBEIRO ROMERO BASALLO. Profesor(a): MONICA ALEJANDRA ROJAS ESQUIVEL. Escenario: PARQUE EL PORVENIR AVENIDA CALLE 54 SUR CARRERA 79 Y 99 PARQUE EL TIMIZA CARRERA 72 N BIS CON CALLE 40H SUR. Horarios: PARQUE EL PORVENIR LUNES Y VIERNES (4-6 PM) PARQUE EL TIMIZA MIERCOLES (4-6PM) Y SABADOS (8-10AM). Escuela avalada por IDRD Bogotá (Aval Nº 60)',
      'academy',
      'Bogotá',
      'CARRERA 91 D 34 SUR',
      '3212616852',
      'escueladepatinajeenbosa@gmail.com',
      ARRAY['Patinaje']::text[],
      true,  -- verified (avalada IDRD)
      false, -- is_demo
      'escuela-de-formacion-deportiva-raptors-60',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('idrd_bogota_2026', 'IDRD-AVAL-60', v_school_id, '{"aval": 60, "director": "JOSE ALBEIRO ROMERO BASALLO", "profesor": "MONICA ALEJANDRA ROJAS ESQUIVEL", "localidades": ["Bosa"], "barrio": "Bosa PORVENIR Y TIMIZA", "total_alumnos": 19, "geo_source": "localidad+bogota"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    -- Actualizar campos que pueden cambiar entre versiones
    UPDATE public.schools SET
      description = 'Director(a): JOSE ALBEIRO ROMERO BASALLO. Profesor(a): MONICA ALEJANDRA ROJAS ESQUIVEL. Escenario: PARQUE EL PORVENIR AVENIDA CALLE 54 SUR CARRERA 79 Y 99 PARQUE EL TIMIZA CARRERA 72 N BIS CON CALLE 40H SUR. Horarios: PARQUE EL PORVENIR LUNES Y VIERNES (4-6 PM) PARQUE EL TIMIZA MIERCOLES (4-6PM) Y SABADOS (8-10AM). Escuela avalada por IDRD Bogotá (Aval Nº 60)',
      phone       = COALESCE('3212616852', phone),
      email       = COALESCE('escueladepatinajeenbosa@gmail.com', email),
      sports      = ARRAY['Patinaje']::text[],
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  -- school_settings: REQUERIDO para que aparezca en /explorar
  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)
  ON CONFLICT (school_id) DO NOTHING;
  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  -- Sede principal (lat/lng del escenario de practica)
  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  VALUES (
    v_school_id, 'Sede Principal',
    'PARQUE EL PORVENIR AVENIDA CALLE 54 SUR CARRERA 79 Y 99 PARQUE EL TIMIZA CARRERA 72 N BIS CON CALLE 40H SUR',
    'Bogotá',
    '3212616852',
    4.5968789, -74.1809427,
    true, 'active'
  )
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;
