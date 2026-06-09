-- ============================================================
-- SPORTMAPS — Entidades deportivas oficiales 2025/2026
-- Fuente: Directorios oficiales Mindeporte/Coldeportes
-- (Institutos Dept/Mun 2026 + Federaciones 2025 + Asociaciones 2025)
-- Generado por scripts/import_entidades_deportivas.py
-- ============================================================

BEGIN;

-- INSTITUTO DEPARTAMENTAL DE DEPORTE Y RECREACIÓN DEL AMAZONAS (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTE Y RECREACIÓN DEL AMAZONAS',
      'DIRECTORA: ROSITA CABRERA ANGULO. Ente departamental de deporte. AMAZONAS.',
      'academy',
      'AMAZONAS',
      NULL,
      '098592-7000',
      'indeportes@amazonas.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deporte-y-recreacion-del-amazonas-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES AMAZONAS", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTORA: ROSITA CABRERA ANGULO. Ente departamental de deporte. AMAZONAS.', description),
      phone       = COALESCE('098592-7000', phone),
      email       = COALESCE('indeportes@amazonas.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'AMAZONAS',
         '098592-7000', -1.3052990, -71.4659212, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTES DE ANTIOQUIA (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTES DE ANTIOQUIA',
      'GERENTE: SANTIAGO VALENCIA GONZALES. Ente departamental de deporte. ANTIOQUIA.',
      'academy',
      'ANTIOQUIA',
      NULL,
      '+ 57 (604) 5200890 Ext. 1000',
      'contactenos@indeportesantioquia.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deportes-de-antioquia-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES ANTIOQUIA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: SANTIAGO VALENCIA GONZALES. Ente departamental de deporte. ANTIOQUIA.', description),
      phone       = COALESCE('+ 57 (604) 5200890 Ext. 1000', phone),
      email       = COALESCE('contactenos@indeportesantioquia.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'ANTIOQUIA',
         '+ 57 (604) 5200890 Ext. 1000', 7.0000085, -75.5000086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DEL DEPORTE Y LA RECREACIÓN DE ARAUCA (INST-DEP-instituto-departamental-del-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-del-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DEL DEPORTE Y LA RECREACIÓN DE ARAUCA',
      'DIRECTOR: IVAN HUMBERTO MANOSALVA ROMERO. Ente departamental de deporte. ARAUCA.',
      'academy',
      'ARAUCA',
      NULL,
      '+57 (607) 8854650',
      'secretaria@inder-arauca.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-del-deporte-y-la-recreacion-de-arauc-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-del-de', v_school_id, '{"kind": "instituto", "acronym": "INDER ARAUCA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: IVAN HUMBERTO MANOSALVA ROMERO. Ente departamental de deporte. ARAUCA.', description),
      phone       = COALESCE('+57 (607) 8854650', phone),
      email       = COALESCE('secretaria@inder-arauca.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'ARAUCA',
         '+57 (607) 8854650', 6.6666755, -71.0000086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE RECREACIÓN Y DEPORTE DEL ATLÁNTICO (INST-DEP-instituto-departamental-de-rec)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-rec';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE RECREACIÓN Y DEPORTE DEL ATLÁNTICO',
      'DIRECTOR: IVAN ALBERTO URQUIJO OSORIO. Ente departamental de deporte. ATLÁNTICO.',
      'academy',
      'ATLÁNTICO',
      NULL,
      '+ 57 (605) 331 9013',
      'director@inderatlantico.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-recreacion-y-deporte-del-atlantic-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-rec', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES ATLANTICO", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: IVAN ALBERTO URQUIJO OSORIO. Ente departamental de deporte. ATLÁNTICO.', description),
      phone       = COALESCE('+ 57 (605) 331 9013', phone),
      email       = COALESCE('director@inderatlantico.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'ATLÁNTICO',
         '+ 57 (605) 331 9013', 10.6773422, -74.9718666, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTES Y RECREACIÓN DE BOLÍVAR (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTES Y RECREACIÓN DE BOLÍVAR',
      'GERENTE: JULIO CESAR MORELOS NASSI. Ente departamental de deporte. BOLÍVAR.',
      'academy',
      'BOLÍVAR',
      NULL,
      '075-6424629 075- 6424630 075- 6424633',
      'iderbolgerencia@gmail.com',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deportes-y-recreacion-de-bolivar-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "IDERBOL", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: JULIO CESAR MORELOS NASSI. Ente departamental de deporte. BOLÍVAR.', description),
      phone       = COALESCE('075-6424629 075- 6424630 075- 6424633', phone),
      email       = COALESCE('iderbolgerencia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'BOLÍVAR',
         '075-6424629 075- 6424630 075- 6424633', 9.3660477, -74.8023636, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DEL DEPORTE DE BOYACÁ (INST-DEP-instituto-departamental-del-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-del-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DEL DEPORTE DE BOYACÁ',
      'GERENTE: MIGUEL FERNANDO LÓPEZ SARMIENTO. Ente departamental de deporte. BOYACÁ.',
      'academy',
      'BOYACÁ',
      NULL,
      '+ 57 (608) 742 2365',
      'gerenciageneral@ indeportesboyaca.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-del-deporte-de-boyaca-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-del-de', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES BOYACÁ", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: MIGUEL FERNANDO LÓPEZ SARMIENTO. Ente departamental de deporte. BOYACÁ.', description),
      phone       = COALESCE('+ 57 (608) 742 2365', phone),
      email       = COALESCE('gerenciageneral@ indeportesboyaca.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'BOYACÁ',
         '+ 57 (608) 742 2365', 5.6278979, -72.8268617, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE CULTURA, DEPORTE Y TURISMO DEL CAQUETÁ (INST-DEP-instituto-departamental-de-cul)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-cul';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE CULTURA, DEPORTE Y TURISMO DEL CAQUETÁ',
      'DIRECTOR: WILLIAM ARMANDO PARRA. Ente departamental de deporte. CAQUETA.',
      'academy',
      'CAQUETA',
      NULL,
      '4354150 Ext. 108',
      'wparra@icdtcaqueta.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-cultura-deporte-y-turismo-del-caq-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-cul', v_school_id, '{"kind": "instituto", "acronym": "ICDT CAQUETA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: WILLIAM ARMANDO PARRA. Ente departamental de deporte. CAQUETA.', description),
      phone       = COALESCE('4354150 Ext. 108', phone),
      email       = COALESCE('wparra@icdtcaqueta.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CAQUETA',
         '4354150 Ext. 108', 1.1153385, -74.1056838, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO PARA LA RECREACIÓN, EL DEPORTE, LA EDUCACIÓN EXTRAESCOLAR Y EL APROVECHAMIENTO DEL TIEMPO LIBRE EN EL DEPARTAMENTO DE CASANARE (INST-DEP-instituto-para-la-recreacion-e)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-para-la-recreacion-e';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO PARA LA RECREACIÓN, EL DEPORTE, LA EDUCACIÓN EXTRAESCOLAR Y EL APROVECHAMIENTO DEL TIEMPO LIBRE EN EL DEPARTAMENTO DE CASANARE',
      'GERENTE: RUBIEL VARGAS PINTO. Ente departamental de deporte. CASANARE.',
      'academy',
      'CASANARE',
      NULL,
      '+ 57 (8) 6353638',
      'gerente@indercas-casanare.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-para-la-recreacion-el-deporte-la-educacion-extraes-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-para-la-recreacion-e', v_school_id, '{"kind": "instituto", "acronym": "INDERCAS", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: RUBIEL VARGAS PINTO. Ente departamental de deporte. CASANARE.', description),
      phone       = COALESCE('+ 57 (8) 6353638', phone),
      email       = COALESCE('gerente@indercas-casanare.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CASANARE',
         '+ 57 (8) 6353638', 5.5000085, -71.5000086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTES DEL CAUCA (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTES DEL CAUCA',
      'GERENTE: TAYRO ALEXANDER LOPEZ GOMEZ. Ente departamental de deporte. CAUCA.',
      'academy',
      'CAUCA',
      NULL,
      '+ 57 (602) 832 3926',
      'gerencia@indeportescauca.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deportes-del-cauca-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES CAUCA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: TAYRO ALEXANDER LOPEZ GOMEZ. Ente departamental de deporte. CAUCA.', description),
      phone       = COALESCE('+ 57 (602) 832 3926', phone),
      email       = COALESCE('gerencia@indeportescauca.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CAUCA',
         '+ 57 (602) 832 3926', 2.7156450, -76.6626650, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTES DE CÓRDOBA (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTES DE CÓRDOBA',
      'DIRECTOR: LUIS GABRIEL ALDANA DUMAR. Ente departamental de deporte. CÓRDOBA.',
      'academy',
      'CÓRDOBA',
      NULL,
      '+57 (4) 7893032',
      'indeportes@cordoba.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deportes-de-cordoba-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES CÓRDOBA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: LUIS GABRIEL ALDANA DUMAR. Ente departamental de deporte. CÓRDOBA.', description),
      phone       = COALESCE('+57 (4) 7893032', phone),
      email       = COALESCE('indeportes@cordoba.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CÓRDOBA',
         '+57 (4) 7893032', 8.3344713, -75.6666238, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL PARA LA RECREACIÓN Y EL DEPORTE DE CUNDINAMARCA (INST-DEP-instituto-departamental-para-l)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-para-l';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL PARA LA RECREACIÓN Y EL DEPORTE DE CUNDINAMARCA',
      'GERENTE: LUZ MARINA CHUQUEN GONZALEZ. Ente departamental de deporte. CUNDINAMARCA.',
      'academy',
      'CUNDINAMARCA',
      NULL,
      '+ 57 (1) 7491205',
      'notificaciones.indeportes@cundinamarca.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-para-la-recreacion-y-el-deporte-de-c-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-para-l', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES CUNDINAMARCA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: LUZ MARINA CHUQUEN GONZALEZ. Ente departamental de deporte. CUNDINAMARCA.', description),
      phone       = COALESCE('+ 57 (1) 7491205', phone),
      email       = COALESCE('notificaciones.indeportes@cundinamarca.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CUNDINAMARCA',
         '+ 57 (1) 7491205', 4.7831994, -73.6731282, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE RECREACION Y DEPORTE DEL GUAINÍA (INST-DEP-instituto-departamental-de-rec)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-rec';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE RECREACION Y DEPORTE DEL GUAINÍA',
      'DIRECTOR: WILFREDO MIGUEL TORRES NUÑEZ. Ente departamental de deporte. GUAINIA.',
      'academy',
      'GUAINIA',
      NULL,
      '+ 57 78-5656073',
      'contactenos@inder-guainia.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-recreacion-y-deporte-del-guainia-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-rec', v_school_id, '{"kind": "instituto", "acronym": "INDER GUAINÍA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: WILFREDO MIGUEL TORRES NUÑEZ. Ente departamental de deporte. GUAINIA.', description),
      phone       = COALESCE('+ 57 78-5656073', phone),
      email       = COALESCE('contactenos@inder-guainia.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'GUAINIA',
         '+ 57 78-5656073', 2.5000086, -69.0000086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DEL DEPORTE, LA RECREACIÓN, EL APROVECHAMIENTO DEL TIEMPO LIBRE Y LA EDUCACIÓN EXTRAESCOLAR DEL GUAVIARE (INST-DEP-instituto-departamental-del-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-del-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DEL DEPORTE, LA RECREACIÓN, EL APROVECHAMIENTO DEL TIEMPO LIBRE Y LA EDUCACIÓN EXTRAESCOLAR DEL GUAVIARE',
      'DIRECTOR: JEFERSSON ADRIAN GOMEZ GONZALEZ. Ente departamental de deporte. GUAVIARE.',
      'academy',
      'GUAVIARE',
      NULL,
      '+ 57 (608) 584 0226',
      'inderg@guaviare.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-del-deporte-la-recreacion-el-aprovec-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-del-de', v_school_id, '{"kind": "instituto", "acronym": "INDERG", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: JEFERSSON ADRIAN GOMEZ GONZALEZ. Ente departamental de deporte. GUAVIARE.', description),
      phone       = COALESCE('+ 57 (608) 584 0226', phone),
      email       = COALESCE('inderg@guaviare.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'GUAVIARE',
         '+ 57 (608) 584 0226', 1.7899198, -72.3761784, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DEL DEPORTE, LA EDUCACIÓN FÍSICA, LA RECREACIÓN Y EL APROVECHAMIENTO DEL TIEMPO LIBRE DEL HUILA (INST-DEP-instituto-departamental-del-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-del-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DEL DEPORTE, LA EDUCACIÓN FÍSICA, LA RECREACIÓN Y EL APROVECHAMIENTO DEL TIEMPO LIBRE DEL HUILA',
      'DIRECTOR: FELIPE VICTORIA BARRAGÁN. Ente departamental de deporte. HUILA.',
      'academy',
      'HUILA',
      NULL,
      '+ 57 (8) 875 0423 + 57 (8) 875 0439',
      'director@inderhuila.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-del-deporte-la-educacion-fisica-la-r-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-del-de', v_school_id, '{"kind": "instituto", "acronym": "INDERHUILA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: FELIPE VICTORIA BARRAGÁN. Ente departamental de deporte. HUILA.', description),
      phone       = COALESCE('+ 57 (8) 875 0423 + 57 (8) 875 0439', phone),
      email       = COALESCE('director@inderhuila.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'HUILA',
         '+ 57 (8) 875 0423 + 57 (8) 875 0439', 2.4738993, -75.5900113, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTES DE LA GUAJIRA (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTES DE LA GUAJIRA',
      'DIRECTOR: BARTOLO MANUEL GOMEZ ASIS. Ente departamental de deporte. LA GUAJIRA.',
      'academy',
      'LA GUAJIRA',
      NULL,
      '+ 57 (5) 728 3727 + 57 (5) 728 3695',
      'direccioniddg@laguajira.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deportes-de-la-guajira-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "IDDG", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: BARTOLO MANUEL GOMEZ ASIS. Ente departamental de deporte. LA GUAJIRA.', description),
      phone       = COALESCE('+ 57 (5) 728 3727 + 57 (5) 728 3695', phone),
      email       = COALESCE('direccioniddg@laguajira.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'LA GUAJIRA',
         '+ 57 (5) 728 3727 + 57 (5) 728 3695', 11.4354118, -72.9002161, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTES DEL MAGDALENA (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTES DEL MAGDALENA',
      'DIRECTORA: DANIELA SUAREZ TOLOZA. Ente departamental de deporte. MAGDALENA.',
      'academy',
      'MAGDALENA',
      NULL,
      '+57 (605) 431 1148',
      'direccion@indermagdalena.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deportes-del-magdalena-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES MAGDALENA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTORA: DANIELA SUAREZ TOLOZA. Ente departamental de deporte. MAGDALENA.', description),
      phone       = COALESCE('+57 (605) 431 1148', phone),
      email       = COALESCE('direccion@indermagdalena.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'MAGDALENA',
         '+57 (605) 431 1148', 10.5808075, -74.0685669, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTE Y RECREACIÓN DEL META (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTE Y RECREACIÓN DEL META',
      'DIRECTOR: LUIS CARLOS LONDOÑO VARGAS. Ente departamental de deporte. META.',
      'academy',
      'META',
      NULL,
      '+57 (608) 670 1465',
      'director@idermeta.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deporte-y-recreacion-del-meta-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "IDERMETA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: LUIS CARLOS LONDOÑO VARGAS. Ente departamental de deporte. META.', description),
      phone       = COALESCE('+57 (608) 670 1465', phone),
      email       = COALESCE('director@idermeta.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'META',
         '+57 (608) 670 1465', 3.5000086, -73.0000086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL PARA EL DEPORTE DE NORTE DE SANTANDER (INST-DEP-instituto-departamental-para-e)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-para-e';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL PARA EL DEPORTE DE NORTE DE SANTANDER',
      'DIRECTORA: LEIDY JANETH ORTIZ CONTRERAS. Ente departamental de deporte. NORTE DE SANTANDER.',
      'academy',
      'NORTE DE SANTANDER',
      NULL,
      '+57 607 5784957',
      'indenorte@nortedesantander.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-para-el-deporte-de-norte-de-santande-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-para-e', v_school_id, '{"kind": "instituto", "acronym": "INDENORTE", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTORA: LEIDY JANETH ORTIZ CONTRERAS. Ente departamental de deporte. NORTE DE SANTANDER.', description),
      phone       = COALESCE('+57 607 5784957', phone),
      email       = COALESCE('indenorte@nortedesantander.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'NORTE DE SANTANDER',
         '+57 607 5784957', 8.4417924, -73.0492505, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DE CULTURA, DEPORTES, LA EDUCACIÓN FÍSICA Y LA RECREACIÓN DEL DEPARTAMENTO DEL PUTUMAYO (INST-DEP-instituto-de-cultura-deportes-)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-de-cultura-deportes-';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DE CULTURA, DEPORTES, LA EDUCACIÓN FÍSICA Y LA RECREACIÓN DEL DEPARTAMENTO DEL PUTUMAYO',
      'GERENTE: FREDY ALEXANDER ROMO DÍAZ. Ente departamental de deporte. PUTUMAYO.',
      'academy',
      'PUTUMAYO',
      NULL,
      '+57 (8) 4201239',
      'contacto@indercultura-putumayo.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-de-cultura-deportes-la-educacion-fisica-y-la-recre-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-de-cultura-deportes-', v_school_id, '{"kind": "instituto", "acronym": "INDERCULTURA PUTUMAYO", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: FREDY ALEXANDER ROMO DÍAZ. Ente departamental de deporte. PUTUMAYO.', description),
      phone       = COALESCE('+57 (8) 4201239', phone),
      email       = COALESCE('contacto@indercultura-putumayo.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'PUTUMAYO',
         '+57 (8) 4201239', 0.5000086, -76.0000086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DEL DEPORTE Y RECREACIÓN DEL QUINDIO (INST-DEP-instituto-departamental-del-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-del-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DEL DEPORTE Y RECREACIÓN DEL QUINDIO',
      'GERENTE: CAMILO JOSE ORTIZ MONTERO. Ente departamental de deporte. QUINDÍO.',
      'academy',
      'QUINDÍO',
      NULL,
      '6744 1775 01 8000 511 814',
      'gerencia@indeportesquindio.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-del-deporte-y-recreacion-del-quindio-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-del-de', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES QUINDIO", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: CAMILO JOSE ORTIZ MONTERO. Ente departamental de deporte. QUINDÍO.', description),
      phone       = COALESCE('6744 1775 01 8000 511 814', phone),
      email       = COALESCE('gerencia@indeportesquindio.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'QUINDÍO',
         '6744 1775 01 8000 511 814', 4.4028313, -75.7025795, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE RECREACIÓN Y DEPORTES DE SANTANDER (INST-DEP-instituto-departamental-de-rec)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-rec';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE RECREACIÓN Y DEPORTES DE SANTANDER',
      'DIRECTOR: ARIEL FERNANDO ROJAS RODRIGUEZ. Ente departamental de deporte. SANTANDER.',
      'academy',
      'SANTANDER',
      NULL,
      '+57 (7) 605 9213',
      'direcciongeneral@indersantander.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-recreacion-y-deportes-de-santande-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-rec', v_school_id, '{"kind": "instituto", "acronym": "INDER SANTANDER", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: ARIEL FERNANDO ROJAS RODRIGUEZ. Ente departamental de deporte. SANTANDER.', description),
      phone       = COALESCE('+57 (7) 605 9213', phone),
      email       = COALESCE('direcciongeneral@indersantander.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'SANTANDER',
         '+57 (7) 605 9213', 7.0000085, -73.2500086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTES Y RECREACIÓN DE SUCRE (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTES Y RECREACIÓN DE SUCRE',
      'DIRECTOR: SAMUEL DAVID ALVAREZ LEÓN. Ente departamental de deporte. SUCRE.',
      'academy',
      'SUCRE',
      NULL,
      '2744995 - 2806580',
      'indersucre@sucre.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deportes-y-recreacion-de-sucre-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "INDER SUCRE", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: SAMUEL DAVID ALVAREZ LEÓN. Ente departamental de deporte. SUCRE.', description),
      phone       = COALESCE('2744995 - 2806580', phone),
      email       = COALESCE('indersucre@sucre.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'SUCRE',
         '2744995 - 2806580', 9.0000000, -75.0000000, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTES DEL TOLIMA (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTES DEL TOLIMA',
      'GERENTE: FRANCY LILIANA SALAZAR QUIÑONES. Ente departamental de deporte. TOLIMA.',
      'academy',
      'TOLIMA',
      NULL,
      '+ 57 (8) 262 1620 + 57 (8) 261 0137',
      'indeportestolima@indeportes-tolima.com',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deportes-del-tolima-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "INDEPORTES TOLIMA", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: FRANCY LILIANA SALAZAR QUIÑONES. Ente departamental de deporte. TOLIMA.', description),
      phone       = COALESCE('+ 57 (8) 262 1620 + 57 (8) 261 0137', phone),
      email       = COALESCE('indeportestolima@indeportes-tolima.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'TOLIMA',
         '+ 57 (8) 262 1620 + 57 (8) 261 0137', 4.0355786, -75.2086642, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTE, CULTURA Y RECREACIÓN DEL VAUPÉS (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTE, CULTURA Y RECREACIÓN DEL VAUPÉS',
      'DIRECTOR: SANTIAGO LOZANO VELEZ. Ente departamental de deporte. VAUPÉS.',
      'academy',
      'VAUPÉS',
      NULL,
      '+57 3209392582',
      'idder@vaupes.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deporte-cultura-y-recreacion-del--inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "IDDER VAUPÉS", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: SANTIAGO LOZANO VELEZ. Ente departamental de deporte. VAUPÉS.', description),
      phone       = COALESCE('+57 3209392582', phone),
      email       = COALESCE('idder@vaupes.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'VAUPÉS',
         '+57 3209392582', 0.4228124, -70.9468372, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEPARTAMENTAL DE DEPORTE Y RECREACIÓN DE VILLAVICENCIO (INST-DEP-instituto-departamental-de-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-departamental-de-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEPARTAMENTAL DE DEPORTE Y RECREACIÓN DE VILLAVICENCIO',
      'DIRECTOR: JOSIMAR BRAYN LÓPEZ BURGOS. Ente departamental de deporte. VILLAVICENCIO.',
      'academy',
      'VILLAVICENCIO',
      NULL,
      '+57 (8) 6631062',
      'direccion@IMDERVillavicencio.gov.co direccionGeneral.IMDER@outlook.com',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-departamental-de-deporte-y-recreacion-de-villavice-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-departamental-de-dep', v_school_id, '{"kind": "instituto", "acronym": "IMDER", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: JOSIMAR BRAYN LÓPEZ BURGOS. Ente departamental de deporte. VILLAVICENCIO.', description),
      phone       = COALESCE('+57 (8) 6631062', phone),
      email       = COALESCE('direccion@IMDERVillavicencio.gov.co direccionGeneral.IMDER@outlook.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'VILLAVICENCIO',
         '+57 (8) 6631062', 4.1114595, -73.4967836, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEL DEPORTE, LA EDUCACIÓN FÍSICA Y LA RECREACIÓN DEL VALLE DEL CAUCA (INST-DEP-instituto-del-deporte-la-educa)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-del-deporte-la-educa';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEL DEPORTE, LA EDUCACIÓN FÍSICA Y LA RECREACIÓN DEL VALLE DEL CAUCA',
      'GERENTE: ANA MILENA OROZCO CAÑAS. Ente departamental de deporte. VALLE DEL CAUCA.',
      'academy',
      'VALLE DEL CAUCA',
      NULL,
      '+57 (602) 5569242',
      'gerencia@indervalle.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-del-deporte-la-educacion-fisica-y-la-recreacion-de-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-del-deporte-la-educa', v_school_id, '{"kind": "instituto", "acronym": "INDERVALLE", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: ANA MILENA OROZCO CAÑAS. Ente departamental de deporte. VALLE DEL CAUCA.', description),
      phone       = COALESCE('+57 (602) 5569242', phone),
      email       = COALESCE('gerencia@indervalle.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'VALLE DEL CAUCA',
         '+57 (602) 5569242', 3.6984053, -76.5501996, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DEL DEPORTE LA EDUCACIÓN FÍSICA Y LA RECREACION DEL CHOCO (INST-DEP-instituto-del-deporte-la-educa)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-DEP-instituto-del-deporte-la-educa';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DEL DEPORTE LA EDUCACIÓN FÍSICA Y LA RECREACION DEL CHOCO',
      'DIRECTOR: JORGE LUIS ÁNGEL CÓRDOBA. Ente departamental de deporte. CHOCÓ.',
      'academy',
      'CHOCÓ',
      NULL,
      '+57 31333333333',
      'direccion@indecho.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-del-deporte-la-educacion-fisica-y-la-recreacion-de-inst-dep',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-DEP-instituto-del-deporte-la-educa', v_school_id, '{"kind": "instituto", "acronym": "INDECHO", "level": "Departamental"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: JORGE LUIS ÁNGEL CÓRDOBA. Ente departamental de deporte. CHOCÓ.', description),
      phone       = COALESCE('+57 31333333333', phone),
      email       = COALESCE('direccion@indecho.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CHOCÓ',
         '+57 31333333333', 6.0000085, -77.0000086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL DEL DEPORTE Y LA RECREACIÓN DE ARMENIA (INST-MUN-instituto-municipal-del-deport)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-del-deport';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL DEL DEPORTE Y LA RECREACIÓN DE ARMENIA',
      'DIRECTOR: WILSON FRANCISCO HERRERA OSORIO. Ente municipal/distrital de deporte. ARMENIA.',
      'academy',
      'ARMENIA',
      NULL,
      '+57 (606) 7478888',
      'direccion@imdera.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-del-deporte-y-la-recreacion-de-armenia-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-del-deport', v_school_id, '{"kind": "instituto", "acronym": "IMDERA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: WILSON FRANCISCO HERRERA OSORIO. Ente municipal/distrital de deporte. ARMENIA.', description),
      phone       = COALESCE('+57 (606) 7478888', phone),
      email       = COALESCE('direccion@imdera.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'ARMENIA',
         '+57 (606) 7478888', 4.4919894, -75.7413961, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DISTRITAL DE RECREACIÓN Y DEPORTES DE BARRANQUILLA (INST-MUN-secretaria-distrital-de-recrea)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-distrital-de-recrea';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DISTRITAL DE RECREACIÓN Y DEPORTES DE BARRANQUILLA',
      'SECRETARIO: DANIEL FERNANDO TRUJILLO TOVAR. Ente distrital de deporte. BARRANQUILLA.',
      'academy',
      'BARRANQUILLA',
      NULL,
      '+ 57 (605) 4010205 + 57 (605) 3161400',
      NULL,
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-distrital-de-recreacion-y-deportes-de-barranquill-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-distrital-de-recrea', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: DANIEL FERNANDO TRUJILLO TOVAR. Ente distrital de deporte. BARRANQUILLA.', description),
      phone       = COALESCE('+ 57 (605) 4010205 + 57 (605) 3161400', phone),
      email       = COALESCE(NULL, email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'BARRANQUILLA',
         '+ 57 (605) 4010205 + 57 (605) 3161400', 10.9938599, -74.7926118, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DISTRITAL DE RECREACIÓN Y EL DEPORTE DE BOGOTÁ (INST-MUN-instituto-distrital-de-recreac)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-distrital-de-recreac';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DISTRITAL DE RECREACIÓN Y EL DEPORTE DE BOGOTÁ',
      'DIRECTOR: DANIEL GARCÍA CAÑON. Ente distrital de deporte. BOGOTÁ.',
      'academy',
      'BOGOTÁ',
      NULL,
      '+ 57 (601) 6605400 Ext. 251 - 252',
      'daniel.garciac@idrd.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-distrital-de-recreacion-y-el-deporte-de-bogota-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-distrital-de-recreac', v_school_id, '{"kind": "instituto", "acronym": "IDRD", "level": "Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: DANIEL GARCÍA CAÑON. Ente distrital de deporte. BOGOTÁ.', description),
      phone       = COALESCE('+ 57 (601) 6605400 Ext. 251 - 252', phone),
      email       = COALESCE('daniel.garciac@idrd.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'BOGOTÁ',
         '+ 57 (601) 6605400 Ext. 251 - 252', 4.6533817, -74.0836331, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTE, RECREACIÓN Y ACTIVIDAD FÍSICA DE CALDAS (INST-MUN-secretaria-de-deporte-recreaci)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deporte-recreaci';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTE, RECREACIÓN Y ACTIVIDAD FÍSICA DE CALDAS',
      'SECRETARIO DE DEPORTE: ANDRES DUQUE OSORIO. Ente municipal/distrital de deporte. CALDAS.',
      'academy',
      'CALDAS',
      NULL,
      '+ 57 68 98 2444 + 57 76 8810104',
      'andresduqueosorio@gmail.com',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deporte-recreacion-y-actividad-fisica-de-calda-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deporte-recreaci', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO DE DEPORTE: ANDRES DUQUE OSORIO. Ente municipal/distrital de deporte. CALDAS.', description),
      phone       = COALESCE('+ 57 68 98 2444 + 57 76 8810104', phone),
      email       = COALESCE('andresduqueosorio@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CALDAS',
         '+ 57 68 98 2444 + 57 76 8810104', 5.3302514, -75.2873471, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DISTRITAL DE DEPORTE Y RECREACION DE CARTAGENA (INST-MUN-instituto-distrital-de-deporte)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-distrital-de-deporte';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DISTRITAL DE DEPORTE Y RECREACION DE CARTAGENA',
      'DIRECTOR: CAMPO ELIAS TEHERAN HUMANEZ. Ente distrital de deporte. CARTAGENA.',
      'academy',
      'CARTAGENA',
      NULL,
      '+ 57 (605) 641 1370',
      'direccion@ider.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-distrital-de-deporte-y-recreacion-de-cartagena-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-distrital-de-deporte', v_school_id, '{"kind": "instituto", "acronym": "IDER CARTAGENA", "level": "Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: CAMPO ELIAS TEHERAN HUMANEZ. Ente distrital de deporte. CARTAGENA.', description),
      phone       = COALESCE('+ 57 (605) 641 1370', phone),
      email       = COALESCE('direccion@ider.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CARTAGENA',
         '+ 57 (605) 641 1370', 10.4265566, -75.5441671, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE RECREACIÓN Y DEPORTES DEL CESAR (INST-MUN-secretaria-de-recreacion-y-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-recreacion-y-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE RECREACIÓN Y DEPORTES DEL CESAR',
      'SECRETARIA: RAYSA MILENA QUINTERO. Ente municipal/distrital de deporte. CESAR.',
      'academy',
      'CESAR',
      NULL,
      '+ 57 (605) 588 5602',
      'deportes@cesar.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-recreacion-y-deportes-del-cesar-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-recreacion-y-dep', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIA: RAYSA MILENA QUINTERO. Ente municipal/distrital de deporte. CESAR.', description),
      phone       = COALESCE('+ 57 (605) 588 5602', phone),
      email       = COALESCE('deportes@cesar.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CESAR',
         '+ 57 (605) 588 5602', 9.3333415, -73.5000086, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL PARA LA RECREACIÓN Y EL DEPORTE CÚCUTA (INST-MUN-instituto-municipal-para-la-re)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-para-la-re';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL PARA LA RECREACIÓN Y EL DEPORTE CÚCUTA',
      'DIRECTOR: JORGE WILLIAM CORREA MONROY. Ente municipal/distrital de deporte. CÚCUTA.',
      'academy',
      'CÚCUTA',
      NULL,
      '+ 57 (7) 589 3625 +57 (7) 589 3203',
      'imrdcucuta@live.com',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-para-la-recreacion-y-el-deporte-cucuta-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-para-la-re', v_school_id, '{"kind": "instituto", "acronym": "IMRD CÚCUTA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: JORGE WILLIAM CORREA MONROY. Ente municipal/distrital de deporte. CÚCUTA.', description),
      phone       = COALESCE('+ 57 (7) 589 3625 +57 (7) 589 3203', phone),
      email       = COALESCE('imrdcucuta@live.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CÚCUTA',
         '+ 57 (7) 589 3625 +57 (7) 589 3203', 8.0776187, -72.4689002, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACION DE IBAGUÉ (INST-MUN-instituto-municipal-para-el-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-para-el-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACION DE IBAGUÉ',
      'GERENTE: FELIPE ROBERTO LA ROTA GARCÍA. Ente municipal/distrital de deporte. IBAGUÉ.',
      'academy',
      'IBAGUÉ',
      NULL,
      'NO REGISTRA',
      'ibagueimdri@imdri.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-para-el-deporte-y-la-recreacion-de-ibagu-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-para-el-de', v_school_id, '{"kind": "instituto", "acronym": "IMDRI", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: FELIPE ROBERTO LA ROTA GARCÍA. Ente municipal/distrital de deporte. IBAGUÉ.', description),
      phone       = COALESCE('NO REGISTRA', phone),
      email       = COALESCE('ibagueimdri@imdri.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'IBAGUÉ',
         'NO REGISTRA', 4.4386033, -75.2108857, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE RECREACIÓN Y DEPORTES - GOBERNACIÓN DE NARIÑO (INST-MUN-secretaria-de-recreacion-y-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-recreacion-y-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE RECREACIÓN Y DEPORTES - GOBERNACIÓN DE NARIÑO',
      'SECRETARIO: JHON JAIRO PRECIADO. Ente municipal/distrital de deporte. NARIÑO.',
      'academy',
      'NARIÑO',
      NULL,
      '(602) 733 2133',
      'contactenos@narino.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-recreacion-y-deportes---gobernacion-de-narino-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-recreacion-y-dep', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: JHON JAIRO PRECIADO. Ente municipal/distrital de deporte. NARIÑO.', description),
      phone       = COALESCE('(602) 733 2133', phone),
      email       = COALESCE('contactenos@narino.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'NARIÑO',
         '(602) 733 2133', 1.5842268, -77.8585766, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL PARA LA RECREACION Y EL DEPORTE DE PASTO (INST-MUN-instituto-municipal-para-la-re)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-para-la-re';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL PARA LA RECREACION Y EL DEPORTE DE PASTO',
      'DIRECTORA: CLAUDIA MARCELA CANO RODRÍGUEZ. Ente municipal/distrital de deporte. PASTO.',
      'academy',
      'PASTO',
      NULL,
      '+57(602) 721 4442',
      'direccion@pastodeporte.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-para-la-recreacion-y-el-deporte-de-pasto-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-para-la-re', v_school_id, '{"kind": "instituto", "acronym": "PASTO DEPORTE", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTORA: CLAUDIA MARCELA CANO RODRÍGUEZ. Ente municipal/distrital de deporte. PASTO.', description),
      phone       = COALESCE('+57(602) 721 4442', phone),
      email       = COALESCE('direccion@pastodeporte.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'PASTO',
         '+57(602) 721 4442', 1.2140275, -77.2785096, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTES Y RECREACION DE PEREIRA (INST-MUN-secretaria-de-deportes-y-recre)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deportes-y-recre';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTES Y RECREACION DE PEREIRA',
      'SECRETARIA: SANDRA MILENA GRAJALES OCAMPO. Ente municipal/distrital de deporte. PEREIRA.',
      'academy',
      'PEREIRA',
      NULL,
      '+57(1) 316 1800',
      'secretariadeportes@pereira.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deportes-y-recreacion-de-pereira-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deportes-y-recre', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIA: SANDRA MILENA GRAJALES OCAMPO. Ente municipal/distrital de deporte. PEREIRA.', description),
      phone       = COALESCE('+57(1) 316 1800', phone),
      email       = COALESCE('secretariadeportes@pereira.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'PEREIRA',
         '+57(1) 316 1800', 4.7854606, -75.7883220, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTE, RECREACIÓN Y CULTURA DE RISARALDA (INST-MUN-secretaria-de-deporte-recreaci)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deporte-recreaci';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTE, RECREACIÓN Y CULTURA DE RISARALDA',
      'SECRETARIO: LUIS EDUARDO DUQUE SANZ. Ente municipal/distrital de deporte. RISARALDA.',
      'academy',
      'RISARALDA',
      NULL,
      '+57 (6) 339 8300',
      'luise.duque@risaralda.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deporte-recreacion-y-cultura-de-risaralda-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deporte-recreaci', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: LUIS EDUARDO DUQUE SANZ. Ente municipal/distrital de deporte. RISARALDA.', description),
      phone       = COALESCE('+57 (6) 339 8300', phone),
      email       = COALESCE('luise.duque@risaralda.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'RISARALDA',
         '+57 (6) 339 8300', 5.2102948, -75.9842236, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTES Y RECREACIÓN DE LA GOBERNACIÓN DEL ARCHIPIÉLAGO DE SAN ANDRES (INST-MUN-secretaria-de-deportes-y-recre)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deportes-y-recre';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTES Y RECREACIÓN DE LA GOBERNACIÓN DEL ARCHIPIÉLAGO DE SAN ANDRES',
      'SECRETARIO: CHARLE CARREÑO CORPUS. Ente municipal/distrital de deporte. SAN ANDRÉS.',
      'academy',
      'SAN ANDRÉS',
      NULL,
      '+57 (8) 513 0801',
      'servicioalcuidadano@sanandres.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deportes-y-recreacion-de-la-gobernacion-del-ar-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deportes-y-recre', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: CHARLE CARREÑO CORPUS. Ente municipal/distrital de deporte. SAN ANDRÉS.', description),
      phone       = COALESCE('+57 (8) 513 0801', phone),
      email       = COALESCE('servicioalcuidadano@sanandres.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'SAN ANDRÉS',
         '+57 (8) 513 0801', 12.5375979, -81.7204155, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACIÓN DE SINCELEJO (INST-MUN-instituto-municipal-para-el-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-para-el-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACIÓN DE SINCELEJO',
      'GERENTE: ROBINSO GOMEZ LADEUS. Ente municipal/distrital de deporte. SINCELEJO.',
      'academy',
      'SINCELEJO',
      NULL,
      '+57 (5) 2805700',
      'contactenos@imder-sincelejo.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-para-el-deporte-y-la-recreacion-de-since-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-para-el-de', v_school_id, '{"kind": "instituto", "acronym": "IMDER SINCELEJO", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('GERENTE: ROBINSO GOMEZ LADEUS. Ente municipal/distrital de deporte. SINCELEJO.', description),
      phone       = COALESCE('+57 (5) 2805700', phone),
      email       = COALESCE('contactenos@imder-sincelejo.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'SINCELEJO',
         '+57 (5) 2805700', 9.2973386, -75.3926601, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL DE DEPORTE Y RECREACIÓN DE VALLEDUPAR (INST-MUN-instituto-municipal-de-deporte)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-de-deporte';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL DE DEPORTE Y RECREACIÓN DE VALLEDUPAR',
      'DIRECTOR: ALINSON ARMANDO GONZALES ESCORCIA. Ente municipal/distrital de deporte. VALLEDUPAR.',
      'academy',
      'VALLEDUPAR',
      NULL,
      '+57 (5) 562 3279',
      'deportes@indervalledupar.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-de-deporte-y-recreacion-de-valledupar-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-de-deporte', v_school_id, '{"kind": "instituto", "acronym": "INDER VALLEDUPAR", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: ALINSON ARMANDO GONZALES ESCORCIA. Ente municipal/distrital de deporte. VALLEDUPAR.', description),
      phone       = COALESCE('+57 (5) 562 3279', phone),
      email       = COALESCE('deportes@indervalledupar.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'VALLEDUPAR',
         '+57 (5) 562 3279', 10.4651733, -73.2529512, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DISTRITAL DEL DEPORTE, LA RECREACIÓN Y EL TIEMPO LIBRE DE BUENAVENTURA (INST-MUN-instituto-distrital-del-deport)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-distrital-del-deport';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DISTRITAL DEL DEPORTE, LA RECREACIÓN Y EL TIEMPO LIBRE DE BUENAVENTURA',
      'DIRECTOR: FERNEY GUSTAVO ASPRILLA GOMEZ. Ente distrital de deporte. BUENAVENTURA.',
      'academy',
      'BUENAVENTURA',
      NULL,
      '241 5654',
      'inderbuenaventura@hotmail.com',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-distrital-del-deporte-la-recreacion-y-el-tiempo-li-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-distrital-del-deport', v_school_id, '{"kind": "instituto", "acronym": "INDERBUENAVENTURA", "level": "Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: FERNEY GUSTAVO ASPRILLA GOMEZ. Ente distrital de deporte. BUENAVENTURA.', description),
      phone       = COALESCE('241 5654', phone),
      email       = COALESCE('inderbuenaventura@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'BUENAVENTURA',
         '241 5654', 3.8881929, -77.0738324, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTES Y RECREACION DE QUIBDÓ (INST-MUN-secretaria-de-deportes-y-recre)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deportes-y-recre';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTES Y RECREACION DE QUIBDÓ',
      'SECRETARIO: PEDRO JOSE MOSQUERA AGUALIMPIA. Ente municipal/distrital de deporte. QUÍBDO.',
      'academy',
      'QUÍBDO',
      NULL,
      '+57 (604) 672 2069',
      'deporte@quibdo-choco.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deportes-y-recreacion-de-quibdo-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deportes-y-recre', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: PEDRO JOSE MOSQUERA AGUALIMPIA. Ente municipal/distrital de deporte. QUÍBDO.', description),
      phone       = COALESCE('+57 (604) 672 2069', phone),
      email       = COALESCE('deporte@quibdo-choco.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'QUÍBDO',
         '+57 (604) 672 2069', 5.6912838, -76.6531337, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTE, CULTURA Y EDUCACIÓN DE LETICIA (INST-MUN-secretaria-de-deporte-cultura-)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deporte-cultura-';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTE, CULTURA Y EDUCACIÓN DE LETICIA',
      'SECRETARIO: ALEX EDUARDO MANJARRÉS VILLAMIL. Ente municipal/distrital de deporte. LETICIA.',
      'academy',
      'LETICIA',
      NULL,
      '+57 (8) 5928064',
      'educacion@leticia-amazonas.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deporte-cultura-y-educacion-de-leticia-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deporte-cultura-', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: ALEX EDUARDO MANJARRÉS VILLAMIL. Ente municipal/distrital de deporte. LETICIA.', description),
      phone       = COALESCE('+57 (8) 5928064', phone),
      email       = COALESCE('educacion@leticia-amazonas.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'LETICIA',
         '+57 (8) 5928064', -4.2129211, -69.9425963, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTE, CULTURA Y EDUCACIÓN DE INIRIDA (INST-MUN-secretaria-de-deporte-cultura-)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deporte-cultura-';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTE, CULTURA Y EDUCACIÓN DE INIRIDA',
      'SECRETARIA: ELIZABEHT GARCIA. Ente municipal/distrital de deporte. INIRIDA.',
      'academy',
      'INIRIDA',
      NULL,
      '+57 (8) 5656065',
      'secreeducacion@inirida-guainia.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deporte-cultura-y-educacion-de-inirida-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deporte-cultura-', v_school_id, '{"kind": "instituto", "acronym": "IMDER INIRIDA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIA: ELIZABEHT GARCIA. Ente municipal/distrital de deporte. INIRIDA.', description),
      phone       = COALESCE('+57 (8) 5656065', phone),
      email       = COALESCE('secreeducacion@inirida-guainia.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'INIRIDA',
         '+57 (8) 5656065', 3.8650368, -67.9259848, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL DE DEPORTE Y RECREACIÓN DE PUERTO CARREÑO (INST-MUN-instituto-municipal-de-deporte)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-de-deporte';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL DE DEPORTE Y RECREACIÓN DE PUERTO CARREÑO',
      'COORDINADOR: JORGE JELVEZ LÓPEZ VILLAMIZAR. Ente municipal/distrital de deporte. PUERTO CARREÑO.',
      'academy',
      'PUERTO CARREÑO',
      NULL,
      'NO REGISTRA',
      'INSTITUTOMUNICIPALIMDER2025@GMAIL.COM',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-de-deporte-y-recreacion-de-puerto-carren-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-de-deporte', v_school_id, '{"kind": "instituto", "acronym": "IMDER PUERTO CARREÑO", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('COORDINADOR: JORGE JELVEZ LÓPEZ VILLAMIZAR. Ente municipal/distrital de deporte. PUERTO CARREÑO.', description),
      phone       = COALESCE('NO REGISTRA', phone),
      email       = COALESCE('INSTITUTOMUNICIPALIMDER2025@GMAIL.COM', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'PUERTO CARREÑO',
         'NO REGISTRA', 6.1909225, -67.4841891, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL DE DEPORTES Y RECREACIÓN DE MITU (INST-MUN-instituto-municipal-de-deporte)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-de-deporte';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL DE DEPORTES Y RECREACIÓN DE MITU',
      'DIRECTOR: MARCOS EMILIO GARCIA. Ente municipal/distrital de deporte. MITÚ.',
      'academy',
      'MITÚ',
      NULL,
      'NO REGISTRA',
      'imder@mitu-vaupes.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-de-deportes-y-recreacion-de-mitu-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-de-deporte', v_school_id, '{"kind": "instituto", "acronym": "IMDER MITU", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: MARCOS EMILIO GARCIA. Ente municipal/distrital de deporte. MITÚ.', description),
      phone       = COALESCE('NO REGISTRA', phone),
      email       = COALESCE('imder@mitu-vaupes.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'MITÚ',
         'NO REGISTRA', 1.2587328, -70.2366439, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DISTRITAL DE SANTA MARTA PARA LA RECREACION Y EL DEPORTE (INST-MUN-instituto-distrital-de-santa-m)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-distrital-de-santa-m';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DISTRITAL DE SANTA MARTA PARA LA RECREACION Y EL DEPORTE',
      'DIRECTOR: HIDERALDO ALTAIR ESPINOZA VILORIA. Ente distrital de deporte. SANTA MARTA.',
      'academy',
      'SANTA MARTA',
      NULL,
      'NO REGISTRA',
      'instituto@inredsantamarta.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-distrital-de-santa-marta-para-la-recreacion-y-el-d-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-distrital-de-santa-m', v_school_id, '{"kind": "instituto", "acronym": "INRED", "level": "Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: HIDERALDO ALTAIR ESPINOZA VILORIA. Ente distrital de deporte. SANTA MARTA.', description),
      phone       = COALESCE('NO REGISTRA', phone),
      email       = COALESCE('instituto@inredsantamarta.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'SANTA MARTA',
         'NO REGISTRA', 11.2320944, -74.1950916, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACIÓN DE MONTERÍA (INST-MUN-instituto-municipal-para-el-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-para-el-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACIÓN DE MONTERÍA',
      'DIRECTOR: GERMAN QUINTERO MENDOZA. Ente municipal/distrital de deporte. MONTERÍA.',
      'academy',
      'MONTERÍA',
      NULL,
      'NO REGISTRA',
      'director@imdermonteria.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-para-el-deporte-y-la-recreacion-de-monte-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-para-el-de', v_school_id, '{"kind": "instituto", "acronym": "IMDER MONTERÍA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: GERMAN QUINTERO MENDOZA. Ente municipal/distrital de deporte. MONTERÍA.', description),
      phone       = COALESCE('NO REGISTRA', phone),
      email       = COALESCE('director@imdermonteria.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'MONTERÍA',
         'NO REGISTRA', 8.6046053, -75.9783203, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTE Y CULTURA DE PROVIDENCIA (INST-MUN-secretaria-de-deporte-y-cultur)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deporte-y-cultur';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTE Y CULTURA DE PROVIDENCIA',
      'SECRETARIO: GENCARLO FERREIRA MITCHELL. Ente municipal/distrital de deporte. PROVIDENCIA.',
      'academy',
      'PROVIDENCIA',
      NULL,
      'NO REGISTRA',
      'Geancarlofere5@hotmail.com',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deporte-y-cultura-de-providencia-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deporte-y-cultur', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: GENCARLO FERREIRA MITCHELL. Ente municipal/distrital de deporte. PROVIDENCIA.', description),
      phone       = COALESCE('NO REGISTRA', phone),
      email       = COALESCE('Geancarlofere5@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'PROVIDENCIA',
         'NO REGISTRA', 13.3531166, -81.3749889, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACIÓN DE FLORENCIA (INST-MUN-instituto-municipal-para-el-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-para-el-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACIÓN DE FLORENCIA',
      'Secretario: JUAN MIGUEL VARGAS GARCIA. Ente municipal/distrital de deporte. FLORENCIA.',
      'academy',
      'FLORENCIA',
      NULL,
      '+57 (8) 4351547',
      'seculdeporte@florencia-caqueta.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-para-el-deporte-y-la-recreacion-de-flore-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-para-el-de', v_school_id, '{"kind": "instituto", "acronym": "INSTITUTO MUNICIPAL PARA EL DEPORTE Y LA RECREACIÓN DE FLORENCIA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Secretario: JUAN MIGUEL VARGAS GARCIA. Ente municipal/distrital de deporte. FLORENCIA.', description),
      phone       = COALESCE('+57 (8) 4351547', phone),
      email       = COALESCE('seculdeporte@florencia-caqueta.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'FLORENCIA',
         '+57 (8) 4351547', 1.6158666, -75.6143045, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTES Y RECREACION DE NEIVA (INST-MUN-secretaria-de-deportes-y-recre)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deportes-y-recre';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTES Y RECREACION DE NEIVA',
      'SECRETARIO: JUAN CAMILO MUÑOZ LOSADA. Ente municipal/distrital de deporte. NEIVA.',
      'academy',
      'NEIVA',
      NULL,
      '+57 (8) 8755046',
      'secretariadeportesyrecreacion@alcaldianeiva.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deportes-y-recreacion-de-neiva-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deportes-y-recre', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: JUAN CAMILO MUÑOZ LOSADA. Ente municipal/distrital de deporte. NEIVA.', description),
      phone       = COALESCE('+57 (8) 8755046', phone),
      email       = COALESCE('secretariadeportesyrecreacion@alcaldianeiva.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'NEIVA',
         '+57 (8) 8755046', 2.9257038, -75.2893937, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARÍA DE EDUCACIÓN, CULTURA Y DEPORTES MUNICIPAL DE MOCOA (INST-MUN-secretaria-de-educacion-cultur)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-educacion-cultur';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARÍA DE EDUCACIÓN, CULTURA Y DEPORTES MUNICIPAL DE MOCOA',
      'SECRETARIO: MARIA FERNANDA ALVAREZ LUNA. Ente municipal/distrital de deporte. MOCOA.',
      'academy',
      'MOCOA',
      NULL,
      '+57 (8) 4204676',
      'educacion@mocoa-putumayo.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-educacion-cultura-y-deportes-municipal-de-moco-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-educacion-cultur', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: MARIA FERNANDA ALVAREZ LUNA. Ente municipal/distrital de deporte. MOCOA.', description),
      phone       = COALESCE('+57 (8) 4204676', phone),
      email       = COALESCE('educacion@mocoa-putumayo.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'MOCOA',
         '+57 (8) 4204676', 1.1466295, -76.6482327, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE EDUCACIÓN, CULTURA, DEPORTE Y RECREACIÓN (INST-MUN-secretaria-de-educacion-cultur)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-educacion-cultur';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE EDUCACIÓN, CULTURA, DEPORTE Y RECREACIÓN',
      'SECRETARIO: AQUILINO ENRIQUE ESCOBAR CERRANO. Ente municipal/distrital de deporte. ARAUCA CAPITAL.',
      'academy',
      'ARAUCA CAPITAL',
      NULL,
      'NO REGISTRA',
      'unideportes@arauca-arauca.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-educacion-cultura-deporte-y-recreacion-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-educacion-cultur', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: AQUILINO ENRIQUE ESCOBAR CERRANO. Ente municipal/distrital de deporte. ARAUCA CAPITAL.', description),
      phone       = COALESCE('NO REGISTRA', phone),
      email       = COALESCE('unideportes@arauca-arauca.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- INSTITUTO MUNICIPAL PARA LA RECREACIÓN Y EL DEPORTE DE SAN JOSE DEL GUAVIARE (INST-MUN-instituto-municipal-para-la-re)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-para-la-re';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL PARA LA RECREACIÓN Y EL DEPORTE DE SAN JOSE DEL GUAVIARE',
      'DIRECTOR: JHON ALEXANDER NIETO. Ente municipal/distrital de deporte. SAN JOSE DEL GUAVIARE.',
      'academy',
      'SAN JOSE DEL GUAVIARE',
      NULL,
      '+57 (8) 5840226',
      'imdes@sanjosedelguaviare-guaviare.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-para-la-recreacion-y-el-deporte-de-san-j-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-para-la-re', v_school_id, '{"kind": "instituto", "acronym": "IMDES", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: JHON ALEXANDER NIETO. Ente municipal/distrital de deporte. SAN JOSE DEL GUAVIARE.', description),
      phone       = COALESCE('+57 (8) 5840226', phone),
      email       = COALESCE('imdes@sanjosedelguaviare-guaviare.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'SAN JOSE DEL GUAVIARE',
         '+57 (8) 5840226', 2.5716141, -72.6426515, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO MUNICIPAL DE DEPORTE Y RECREACIÓN DE MEDELLÍN (INST-MUN-instituto-municipal-de-deporte)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-municipal-de-deporte';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO MUNICIPAL DE DEPORTE Y RECREACIÓN DE MEDELLÍN',
      'DIRECTOR: EDUARDO SILVA MELUK. Ente municipal/distrital de deporte. MEDELLIN.',
      'academy',
      'MEDELLIN',
      NULL,
      '+57 (604) 3699000',
      'eduardo.silva@inder.gov.co atencion.ciudadano@inder.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-municipal-de-deporte-y-recreacion-de-medellin-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-municipal-de-deporte', v_school_id, '{"kind": "instituto", "acronym": "INDER MEDELLÍN", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: EDUARDO SILVA MELUK. Ente municipal/distrital de deporte. MEDELLIN.', description),
      phone       = COALESCE('+57 (604) 3699000', phone),
      email       = COALESCE('eduardo.silva@inder.gov.co atencion.ciudadano@inder.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'MEDELLIN',
         '+57 (604) 3699000', 6.2697324, -75.6025597, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTE DE MANIZALES (INST-MUN-secretaria-de-deporte-de-maniz)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deporte-de-maniz';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTE DE MANIZALES',
      'SECRETARIO: DIEGO FERNANDO ESPINOSA BEJUMEA. Ente municipal/distrital de deporte. MANIZALES.',
      'academy',
      'MANIZALES',
      NULL,
      '+57 (606) 8879700',
      'diego.espinosa@manizales.gov.co contacto@manizales.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deporte-de-manizales-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deporte-de-maniz', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: DIEGO FERNANDO ESPINOSA BEJUMEA. Ente municipal/distrital de deporte. MANIZALES.', description),
      phone       = COALESCE('+57 (606) 8879700', phone),
      email       = COALESCE('diego.espinosa@manizales.gov.co contacto@manizales.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'MANIZALES',
         '+57 (606) 8879700', 5.0743694, -75.5081167, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARÍA DEL DEPORTE Y LA RECREACIÓN DE SANTIAGO DE CALI (INST-MUN-secretaria-del-deporte-y-la-re)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-del-deporte-y-la-re';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARÍA DEL DEPORTE Y LA RECREACIÓN DE SANTIAGO DE CALI',
      'SECRETARIO DE DEPORTES Y RECREACIÓN: ALEXANDER CAMACHO ERAZO. Ente municipal/distrital de deporte. CALI.',
      'academy',
      'CALI',
      NULL,
      '+57 (602) 5141190',
      'alexander.camacho@cali.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-del-deporte-y-la-recreacion-de-santiago-de-cali-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-del-deporte-y-la-re', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO DE DEPORTES Y RECREACIÓN: ALEXANDER CAMACHO ERAZO. Ente municipal/distrital de deporte. CALI.', description),
      phone       = COALESCE('+57 (602) 5141190', phone),
      email       = COALESCE('alexander.camacho@cali.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'CALI',
         '+57 (602) 5141190', 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTES Y RECREACILÓN DE QUIBDÓ (INST-MUN-secretaria-de-deportes-y-recre)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deportes-y-recre';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTES Y RECREACILÓN DE QUIBDÓ',
      'SECRETARIO: PEDRO JOSE MOSQUERA AGUALIMPIA. Ente municipal/distrital de deporte. QUIBDÓ.',
      'academy',
      'QUIBDÓ',
      NULL,
      'NO REGISTRA',
      'deporte@quibdo-choco.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deportes-y-recreacilon-de-quibdo-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deportes-y-recre', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: PEDRO JOSE MOSQUERA AGUALIMPIA. Ente municipal/distrital de deporte. QUIBDÓ.', description),
      phone       = COALESCE('NO REGISTRA', phone),
      email       = COALESCE('deporte@quibdo-choco.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'QUIBDÓ',
         'NO REGISTRA', 5.6912838, -76.6531337, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- SECRETARIA DE DEPORTES Y RECREACION DE POPAYAN (INST-MUN-secretaria-de-deportes-y-recre)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-secretaria-de-deportes-y-recre';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'SECRETARIA DE DEPORTES Y RECREACION DE POPAYAN',
      'SECRETARIO: JESÚS MAURICIO MARTÍNEZ SOLANO. Ente municipal/distrital de deporte. POPAYAN.',
      'academy',
      'POPAYAN',
      NULL,
      '+57 3214965013',
      'oficinadeportes@popayan.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'secretaria-de-deportes-y-recreacion-de-popayan-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-secretaria-de-deportes-y-recre', v_school_id, '{"kind": "instituto", "acronym": "NO REGISTRA", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('SECRETARIO: JESÚS MAURICIO MARTÍNEZ SOLANO. Ente municipal/distrital de deporte. POPAYAN.', description),
      phone       = COALESCE('+57 3214965013', phone),
      email       = COALESCE('oficinadeportes@popayan.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'POPAYAN',
         '+57 3214965013', 2.4431455, -76.5463299, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- INSTITUTO DE LA JUVENTUD, EL DEPORTE Y LA RECREACIÓN DE BUCARAMANGA (INST-MUN-instituto-de-la-juventud-el-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'INST-MUN-instituto-de-la-juventud-el-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'INSTITUTO DE LA JUVENTUD, EL DEPORTE Y LA RECREACIÓN DE BUCARAMANGA',
      'DIRECTOR: LUIS GONZALO GÓMEZ GUERRERO. Ente municipal/distrital de deporte. BUCARAMANGA.',
      'academy',
      'BUCARAMANGA',
      NULL,
      '+57 (607) 6854594',
      'ventanillaunica@inderbu.gov.co',
      ARRAY['Multideporte']::text[],
      true, false,
      'instituto-de-la-juventud-el-deporte-y-la-recreacion-de-bucar-inst-mun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'INST-MUN-instituto-de-la-juventud-el-de', v_school_id, '{"kind": "instituto", "acronym": "INDERBU", "level": "Municipal/Distrital"}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('DIRECTOR: LUIS GONZALO GÓMEZ GUERRERO. Ente municipal/distrital de deporte. BUCARAMANGA.', description),
      phone       = COALESCE('+57 (607) 6854594', phone),
      email       = COALESCE('ventanillaunica@inderbu.gov.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         NULL, 'BUCARAMANGA',
         '+57 (607) 6854594', 7.1669842, -73.1047294, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Actividades Subacuaticas (FED-federacion-colombiana-de-actividades-sub)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-actividades-sub';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Actividades Subacuaticas',
      'Federación deportiva colombiana. Representante: William Orlando Peña. NIT: 890315463 - 9.',
      'academy',
      'BOGOTA D.C.',
      'Calle 45 No. 66 B - 15 Barrio Salitre Greco',
      '7223495',
      'fedecas.colombia@gmail.com',
      ARRAY['Actividades Subacuaticas']::text[],
      true, false,
      'federacion-colombiana-de-actividades-subacuaticas-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-actividades-sub', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: William Orlando Peña. NIT: 890315463 - 9.', description),
      phone       = COALESCE('7223495', phone),
      email       = COALESCE('fedecas.colombia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 45 No. 66 B - 15 Barrio Salitre Greco', 'BOGOTA D.C.',
         '7223495', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Ajedrez (FED-federacion-colombiana-de-ajedrez)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-ajedrez';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Ajedrez',
      'Federación deportiva colombiana. Representante: Weymar Fernando Muñoz Muñoz. NIT: 860016595 - 0.',
      'academy',
      'Bogotá D.C',
      'Transversal 21 BIS No. 60 - 35',
      '7040063',
      'fecodaz@gmail.com',
      ARRAY['Ajedrez']::text[],
      true, false,
      'federacion-colombiana-de-ajedrez-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-ajedrez', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Weymar Fernando Muñoz Muñoz. NIT: 860016595 - 0.', description),
      phone       = COALESCE('7040063', phone),
      email       = COALESCE('fecodaz@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Transversal 21 BIS No. 60 - 35', 'Bogotá D.C',
         '7040063', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion De Arqueros De Colombia (FED-federacion-de-arqueros-de-colombia)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-de-arqueros-de-colombia';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion De Arqueros De Colombia',
      'Federación deportiva colombiana. Representante: Maria Emma Gaviria Piedrahita. NIT: 811030815 - 6.',
      'academy',
      'Medellín',
      'Carrera 66 B No. 31 A 15 Unidad Deportiva de Belén',
      '2659510',
      'fedearco@gmail.com',
      ARRAY['Arqueros De Colombia']::text[],
      true, false,
      'federacion-de-arqueros-de-colombia-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-de-arqueros-de-colombia', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Maria Emma Gaviria Piedrahita. NIT: 811030815 - 6.', description),
      phone       = COALESCE('2659510', phone),
      email       = COALESCE('fedearco@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 66 B No. 31 A 15 Unidad Deportiva de Belén', 'Medellín',
         '2659510', 6.2697324, -75.6025597, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Atletismo (FED-federacion-colombiana-de-atletismo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-atletismo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Atletismo',
      'Federación deportiva colombiana. Representante: Felix Enrique Marrugo Torres. NIT: 860075776 - 9.',
      'academy',
      'Bogotá D.C',
      'Carrera 66 A No. 42 - 34 Salitre El Greco',
      '3843027',
      'fedeatletismo@fecodatle.com',
      ARRAY['Atletismo']::text[],
      true, false,
      'federacion-colombiana-de-atletismo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-atletismo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Felix Enrique Marrugo Torres. NIT: 860075776 - 9.', description),
      phone       = COALESCE('3843027', phone),
      email       = COALESCE('fedeatletismo@fecodatle.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 66 A No. 42 - 34 Salitre El Greco', 'Bogotá D.C',
         '3843027', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Automovilismo Deportivo (FED-federacion-colombiana-de-automovilismo-d)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-automovilismo-d';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Automovilismo Deportivo',
      'Federación deportiva colombiana. Representante: Francisco Lazaro Soto Gonzalez. NIT: 860047439 - 2.',
      'academy',
      'Bogotá D.C',
      'Calle 121 No. 7A-65 Barrio Santa Bárbara Oriental',
      '6194162',
      'deportivo@fedeautos.com.co',
      ARRAY['Automovilismo Deportivo']::text[],
      true, false,
      'federacion-colombiana-de-automovilismo-deportivo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-automovilismo-d', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Francisco Lazaro Soto Gonzalez. NIT: 860047439 - 2.', description),
      phone       = COALESCE('6194162', phone),
      email       = COALESCE('deportivo@fedeautos.com.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 121 No. 7A-65 Barrio Santa Bárbara Oriental', 'Bogotá D.C',
         '6194162', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Badminton (FED-federacion-colombiana-de-badminton)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-badminton';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Badminton',
      'Federación deportiva colombiana. Representante: Jose Gustavo Aleman Olarte. NIT: 900094889 - 8.',
      'academy',
      'Bogotá D.C',
      'Transversal 21 Bis No. 60-35 Barrio San Luis',
      '3106669210',
      'badmintoncolombia@gmail.com',
      ARRAY['Badminton']::text[],
      true, false,
      'federacion-colombiana-de-badminton-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-badminton', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Jose Gustavo Aleman Olarte. NIT: 900094889 - 8.', description),
      phone       = COALESCE('3106669210', phone),
      email       = COALESCE('badmintoncolombia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Transversal 21 Bis No. 60-35 Barrio San Luis', 'Bogotá D.C',
         '3106669210', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Danza Y Baile Deportivo (FED-federacion-colombiana-de-danza-y-baile-d)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-danza-y-baile-d';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Danza Y Baile Deportivo',
      'Federación deportiva colombiana. Representante: Gloria Viviana Burbano Hernandez. NIT: 900856525 - 3.',
      'academy',
      'Cali',
      'Estadio Olímpico Pascual Guerrero, Mezanine – Entrada Maratón Sur',
      '3166174942',
      'fedecolbaile@gmail.com',
      ARRAY['Danza Y Baile Deportivo']::text[],
      true, false,
      'federacion-colombiana-de-danza-y-baile-deportivo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-danza-y-baile-d', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Gloria Viviana Burbano Hernandez. NIT: 900856525 - 3.', description),
      phone       = COALESCE('3166174942', phone),
      email       = COALESCE('fedecolbaile@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Estadio Olímpico Pascual Guerrero, Mezanine – Entrada Maratón Sur', 'Cali',
         '3166174942', 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Baloncesto (FED-federacion-colombiana-de-baloncesto)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-baloncesto';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Baloncesto',
      'Federación deportiva colombiana. Representante: John Mario Tejada Cadavid. NIT: 860038199 - 1.',
      'academy',
      'Bogotá D.C',
      'Carrera 16 No. 37-20 Barrio Teusaquillo',
      '3023766365',
      'fecolcesto@hotmail.com',
      ARRAY['Baloncesto']::text[],
      true, false,
      'federacion-colombiana-de-baloncesto-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-baloncesto', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: John Mario Tejada Cadavid. NIT: 860038199 - 1.', description),
      phone       = COALESCE('3023766365', phone),
      email       = COALESCE('fecolcesto@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 16 No. 37-20 Barrio Teusaquillo', 'Bogotá D.C',
         '3023766365', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Balonmano (FED-federacion-colombiana-de-balonmano)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-balonmano';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Balonmano',
      'Federación deportiva colombiana. Representante: Pedro Jose Martinez Puerto. NIT: 900359754 - 1.',
      'academy',
      'Cali',
      'Carrera 36 No. 5B 3 - 62 Piso No. 2 - Oficina 201 Barrio San Fernando',
      '3154751683',
      'federacioncolombiabalonmano@gmail.com',
      ARRAY['Balonmano']::text[],
      true, false,
      'federacion-colombiana-de-balonmano-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-balonmano', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Pedro Jose Martinez Puerto. NIT: 900359754 - 1.', description),
      phone       = COALESCE('3154751683', phone),
      email       = COALESCE('federacioncolombiabalonmano@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 36 No. 5B 3 - 62 Piso No. 2 - Oficina 201 Barrio San Fernando', 'Cali',
         '3154751683', 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Beisbol (FED-federacion-colombiana-de-beisbol)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-beisbol';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Beisbol',
      'Federación deportiva colombiana. Representante: Mauricio Farid Char Yidi. NIT: 890480480 - 1.',
      'academy',
      'Cartagena',
      'La Matuna, Edificio Concasa Oficina 404',
      '6785659',
      'b.col@wbsc.org',
      ARRAY['Beisbol']::text[],
      true, false,
      'federacion-colombiana-de-beisbol-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-beisbol', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Mauricio Farid Char Yidi. NIT: 890480480 - 1.', description),
      phone       = COALESCE('6785659', phone),
      email       = COALESCE('b.col@wbsc.org', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'La Matuna, Edificio Concasa Oficina 404', 'Cartagena',
         '6785659', 10.4265566, -75.5441671, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Billar (FED-federacion-colombiana-de-billar)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-billar';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Billar',
      'Federación deportiva colombiana. Representante: Carolina Portela Contreras. NIT: 860061869 - 4.',
      'academy',
      'Bogotá D.C',
      'Carrera 28 A No. 39 A 30 Barrio Teusaquillo',
      '2068904',
      'fcbillar@hotmail.com',
      ARRAY['Billar']::text[],
      true, false,
      'federacion-colombiana-de-billar-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-billar', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Carolina Portela Contreras. NIT: 860061869 - 4.', description),
      phone       = COALESCE('2068904', phone),
      email       = COALESCE('fcbillar@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 28 A No. 39 A 30 Barrio Teusaquillo', 'Bogotá D.C',
         '2068904', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Bowling (FED-federacion-colombiana-de-bowling)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-bowling';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Bowling',
      'Federación deportiva colombiana. Representante: Diana Milena Ramírez Aruajo. NIT: 860533073 - 5.',
      'academy',
      'BOGOTA D.C.',
      'Avenida Calle 63 No. 68 - 99 segundo piso -Unidad Deportiva el Salitre.',
      '2501525',
      'fedecobol@hotmail.com',
      ARRAY['Bowling']::text[],
      true, false,
      'federacion-colombiana-de-bowling-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-bowling', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Diana Milena Ramírez Aruajo. NIT: 860533073 - 5.', description),
      phone       = COALESCE('2501525', phone),
      email       = COALESCE('fedecobol@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Avenida Calle 63 No. 68 - 99 segundo piso -Unidad Deportiva el Salitre.', 'BOGOTA D.C.',
         '2501525', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Boxeo (FED-federacion-colombiana-de-boxeo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-boxeo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Boxeo',
      'Federación deportiva colombiana. Representante: Alberto Jose Torres Martinez. NIT: 800231411 - 7.',
      'academy',
      'Cartagena',
      'Paseo Bolívar Carrera 17 Casa del Deporte Gimnasio Centro Alto Rendimiento Boxeo Cartagena; Carrera 38 No. 52-52 Edificio JT Oficina 1',
      '3002077468',
      'fecolbox@gmail.com',
      ARRAY['Boxeo']::text[],
      true, false,
      'federacion-colombiana-de-boxeo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-boxeo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Alberto Jose Torres Martinez. NIT: 800231411 - 7.', description),
      phone       = COALESCE('3002077468', phone),
      email       = COALESCE('fecolbox@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Paseo Bolívar Carrera 17 Casa del Deporte Gimnasio Centro Alto Rendimiento Boxeo Cartagena; Carrera 38 No. 52-52 Edificio JT Oficina 1', 'Cartagena',
         '3002077468', 10.4265566, -75.5441671, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Bridge (FED-federacion-colombiana-de-bridge)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-bridge';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Bridge',
      'Federación deportiva colombiana. Representante: Elsa Ramirez De Castillo. NIT: .',
      'academy',
      'Colombia',
      NULL,
      NULL,
      NULL,
      ARRAY['Bridge']::text[],
      true, false,
      'federacion-colombiana-de-bridge-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-bridge', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Elsa Ramirez De Castillo. NIT: .', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Federacion Colombiana De Canotaje (FED-federacion-colombiana-de-canotaje)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-canotaje';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Canotaje',
      'Federación deportiva colombiana. Representante: Juan Cristobal Mojica Lopez. NIT: 830083646 - 4.',
      'academy',
      'Bogotá D.C',
      'Transversal 21 Bis No. 60-35 Barrio San Luis',
      NULL,
      'canotajecolombia20@gmail.com',
      ARRAY['Canotaje']::text[],
      true, false,
      'federacion-colombiana-de-canotaje-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-canotaje', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Juan Cristobal Mojica Lopez. NIT: 830083646 - 4.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('canotajecolombia20@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Transversal 21 Bis No. 60-35 Barrio San Luis', 'Bogotá D.C',
         NULL, 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Ciclismo (FED-federacion-colombiana-de-ciclismo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-ciclismo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Ciclismo',
      'Federación deportiva colombiana. Representante: Rubén Darío Galeano Berdugo. NIT: 860020863 - 5.',
      'academy',
      'Bogotá D.C',
      'Carrera 46 No. 60-80 Barrio Nicolás de Federmán',
      '2210607',
      'secretario@federacioncolombianadeciclismo.com',
      ARRAY['Ciclismo']::text[],
      true, false,
      'federacion-colombiana-de-ciclismo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-ciclismo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Rubén Darío Galeano Berdugo. NIT: 860020863 - 5.', description),
      phone       = COALESCE('2210607', phone),
      email       = COALESCE('secretario@federacioncolombianadeciclismo.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 46 No. 60-80 Barrio Nicolás de Federmán', 'Bogotá D.C',
         '2210607', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Coleo (FED-federacion-colombiana-de-coleo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-coleo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Coleo',
      'Federación deportiva colombiana. Representante: Juan Efrain Oropeza Cuevas. NIT: 822003697 - 9.',
      'academy',
      'Villavicencio',
      'Calle 41 A No. 26-27 Barrio La Grama',
      '3134674020',
      'fedecoleo@hotmail.com',
      ARRAY['Coleo']::text[],
      true, false,
      'federacion-colombiana-de-coleo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-coleo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Juan Efrain Oropeza Cuevas. NIT: 822003697 - 9.', description),
      phone       = COALESCE('3134674020', phone),
      email       = COALESCE('fedecoleo@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 41 A No. 26-27 Barrio La Grama', 'Villavicencio',
         '3134674020', 4.1114595, -73.4967836, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Deportes Aereos (FED-federacion-colombiana-de-deportes-aereos)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-deportes-aereos';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Deportes Aereos',
      'Federación deportiva colombiana. Representante: Hector Jairo Arboleda Suarez. NIT: 830066529 - 9.',
      'academy',
      'Bogotá D.C',
      'Carrera 26 Nro. 72 - 73 – Oficina 301',
      '3148660361',
      'fedeasistente@gmail.com',
      ARRAY['Deportes Aereos']::text[],
      true, false,
      'federacion-colombiana-de-deportes-aereos-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-deportes-aereos', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Hector Jairo Arboleda Suarez. NIT: 830066529 - 9.', description),
      phone       = COALESCE('3148660361', phone),
      email       = COALESCE('fedeasistente@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 26 Nro. 72 - 73 – Oficina 301', 'Bogotá D.C',
         '3148660361', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Disco Volador (FED-federacion-colombiana-de-disco-volador)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-disco-volador';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Disco Volador',
      'Federación deportiva colombiana. Representante: Ana Rosa Rodriguez Hernandez. NIT: 901154209 - 1.',
      'academy',
      'Bogotá D.C',
      'Carrera 66 A No. 42-34 2o. Piso Barrios Unidos',
      '3108040843',
      'fecodv@gmail.com',
      ARRAY['Disco Volador']::text[],
      true, false,
      'federacion-colombiana-de-disco-volador-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-disco-volador', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Ana Rosa Rodriguez Hernandez. NIT: 901154209 - 1.', description),
      phone       = COALESCE('3108040843', phone),
      email       = COALESCE('fecodv@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 66 A No. 42-34 2o. Piso Barrios Unidos', 'Bogotá D.C',
         '3108040843', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Fuerzas Armadas (FED-fuerzas-armadas)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-fuerzas-armadas';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Fuerzas Armadas',
      'Federación deportiva colombiana. Representante: Mario Enrique Vargas Camacho. NIT: No Aplica.',
      'academy',
      'Colombia',
      NULL,
      NULL,
      NULL,
      ARRAY['Multideporte']::text[],
      true, false,
      'fuerzas-armadas-fed-fuer',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-fuerzas-armadas', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Mario Enrique Vargas Camacho. NIT: No Aplica.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Federacion Ecuestre De Colombia (FED-federacion-ecuestre-de-colombia)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-ecuestre-de-colombia';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Ecuestre De Colombia',
      'Federación deportiva colombiana. Representante: Mauricio Bermudez Acuña. NIT: 860025991 - 2.',
      'academy',
      'BOGOTA D.C.',
      'Calle 98 No. 21-36 Oficina 602',
      '6181276',
      'info@fedecuestre.com',
      ARRAY['Ecuestre De Colombia']::text[],
      true, false,
      'federacion-ecuestre-de-colombia-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-ecuestre-de-colombia', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Mauricio Bermudez Acuña. NIT: 860025991 - 2.', description),
      phone       = COALESCE('6181276', phone),
      email       = COALESCE('info@fedecuestre.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 98 No. 21-36 Oficina 602', 'BOGOTA D.C.',
         '6181276', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Escalada Deportiva (FED-federacion-colombiana-de-escalada-deport)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-escalada-deport';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Escalada Deportiva',
      'Federación deportiva colombiana. Representante: Helia Lizette Manrique Piramanrique. NIT: 900645499 - 4.',
      'academy',
      'Bogotá D.C',
      'Cra 21 No 50-34',
      '3052655345',
      'federacioncolombianaescalada@gmail.com',
      ARRAY['Escalada Deportiva']::text[],
      true, false,
      'federacion-colombiana-de-escalada-deportiva-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-escalada-deport', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Helia Lizette Manrique Piramanrique. NIT: 900645499 - 4.', description),
      phone       = COALESCE('3052655345', phone),
      email       = COALESCE('federacioncolombianaescalada@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Cra 21 No 50-34', 'Bogotá D.C',
         '3052655345', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Esgrima (FED-federacion-colombiana-de-esgrima)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-esgrima';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Esgrima',
      'Federación deportiva colombiana. Representante: William Eulogio Gonzáles Taborda. NIT: 830016532 - 8.',
      'academy',
      'Bogotá D.C',
      'Diagonal 35 Bis No. 19-31 Piso 4º.- Park Way',
      '3230301',
      'fcesgrimacol@gmail.com',
      ARRAY['Esgrima']::text[],
      true, false,
      'federacion-colombiana-de-esgrima-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-esgrima', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: William Eulogio Gonzáles Taborda. NIT: 830016532 - 8.', description),
      phone       = COALESCE('3230301', phone),
      email       = COALESCE('fcesgrimacol@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Diagonal 35 Bis No. 19-31 Piso 4º.- Park Way', 'Bogotá D.C',
         '3230301', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Esqui Nautico Y Wakeboard (FED-federacion-colombiana-de-esqui-nautico-y)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-esqui-nautico-y';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Esqui Nautico Y Wakeboard',
      'Federación deportiva colombiana. Representante: Juan Carlos Osorio Turbay. NIT: 860503520 - 8.',
      'academy',
      'Bogotá D.C',
      'Calle 45 No. 66 B 15 Edificio de las Federaciones',
      '3133665582',
      'info@fedesqui.com.co',
      ARRAY['Esqui Nautico Y Wakeboard']::text[],
      true, false,
      'federacion-colombiana-de-esqui-nautico-y-wakeboard-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-esqui-nautico-y', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Juan Carlos Osorio Turbay. NIT: 860503520 - 8.', description),
      phone       = COALESCE('3133665582', phone),
      email       = COALESCE('info@fedesqui.com.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 45 No. 66 B 15 Edificio de las Federaciones', 'Bogotá D.C',
         '3133665582', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Fisicoculturismo (FED-federacion-colombiana-de-fisicoculturism)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-fisicoculturism';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Fisicoculturismo',
      'Federación deportiva colombiana. Representante: Carlos Gregorio Cifuentes Garcia. NIT: 900134600 - 1.',
      'academy',
      'PALMIRA',
      'Calle 12 C No. 24 A - 119',
      '3013186010',
      'fedefisicoifbb@gmail.com',
      ARRAY['Fisicoculturismo']::text[],
      true, false,
      'federacion-colombiana-de-fisicoculturismo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-fisicoculturism', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Carlos Gregorio Cifuentes Garcia. NIT: 900134600 - 1.', description),
      phone       = COALESCE('3013186010', phone),
      email       = COALESCE('fedefisicoifbb@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 12 C No. 24 A - 119', 'PALMIRA',
         '3013186010', 3.5308373, -76.2988048, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Futbol (FED-federacion-colombiana-de-futbol)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-futbol';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Futbol',
      'Federación deportiva colombiana. Representante: Ramon De Jesus Jesurun Franco. NIT: 860033879 - 9.',
      'academy',
      'BOGOTA D.C.',
      'Carrera 45 A No. 94-06',
      '5185501',
      'info@fcf.com.co',
      ARRAY['Futbol']::text[],
      true, false,
      'federacion-colombiana-de-futbol-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-futbol', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Ramon De Jesus Jesurun Franco. NIT: 860033879 - 9.', description),
      phone       = COALESCE('5185501', phone),
      email       = COALESCE('info@fcf.com.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 45 A No. 94-06', 'BOGOTA D.C.',
         '5185501', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Futbol De Salon (FED-federacion-colombiana-de-futbol-de-salon)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-futbol-de-salon';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Futbol De Salon',
      'Federación deportiva colombiana. Representante: Cristobal Estupiñan Garcia. NIT: 860052688 - 1.',
      'academy',
      'Bogotá D.C',
      'Carrera 26 A No. 61C - 07 Barrio El Campín',
      NULL,
      'fecolfutsal@gmail.com',
      ARRAY['Futbol De Salon']::text[],
      true, false,
      'federacion-colombiana-de-futbol-de-salon-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-futbol-de-salon', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Cristobal Estupiñan Garcia. NIT: 860052688 - 1.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('fecolfutsal@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 26 A No. 61C - 07 Barrio El Campín', 'Bogotá D.C',
         NULL, 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Gimnasia (FED-federacion-colombiana-de-gimnasia)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-gimnasia';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Gimnasia',
      'Federación deportiva colombiana. Representante: Samir Portillo Diaz. NIT: 860535259 - 7.',
      'academy',
      'Bogotá D.C',
      'Transversal 21 Bis No. 60-35 Barrio San Luis',
      '3103433090',
      'fedecolg@yahoo.com',
      ARRAY['Gimnasia']::text[],
      true, false,
      'federacion-colombiana-de-gimnasia-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-gimnasia', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Samir Portillo Diaz. NIT: 860535259 - 7.', description),
      phone       = COALESCE('3103433090', phone),
      email       = COALESCE('fedecolg@yahoo.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Transversal 21 Bis No. 60-35 Barrio San Luis', 'Bogotá D.C',
         '3103433090', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Golf (FED-federacion-colombiana-de-golf)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-golf';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Golf',
      'Federación deportiva colombiana. Representante: Fabio Javier Villamizar Zurek. NIT: 860006815 - 3.',
      'academy',
      'Bogotá D.C',
      'Carrera 7 No. 72 – 64 Interior 26',
      '3107664',
      'fedegolf@federacioncolombianadegolf.com',
      ARRAY['Golf']::text[],
      true, false,
      'federacion-colombiana-de-golf-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-golf', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Fabio Javier Villamizar Zurek. NIT: 860006815 - 3.', description),
      phone       = COALESCE('3107664', phone),
      email       = COALESCE('fedegolf@federacioncolombianadegolf.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 7 No. 72 – 64 Interior 26', 'Bogotá D.C',
         '3107664', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Hapkido (FED-federacion-colombiana-de-hapkido)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-hapkido';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Hapkido',
      'Federación deportiva colombiana. Representante: Nathalia Saray Carreño Gomez. NIT: 801005111 - 8.',
      'academy',
      'ARMENIA',
      'Coliseo del Café, Calle 3N Carrera 19, Planta baja local 1',
      '3176797393',
      'fedecolhap.presidente@gmail.com',
      ARRAY['Hapkido']::text[],
      true, false,
      'federacion-colombiana-de-hapkido-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-hapkido', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Nathalia Saray Carreño Gomez. NIT: 801005111 - 8.', description),
      phone       = COALESCE('3176797393', phone),
      email       = COALESCE('fedecolhap.presidente@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Coliseo del Café, Calle 3N Carrera 19, Planta baja local 1', 'ARMENIA',
         '3176797393', 4.4919894, -75.7413961, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Hockey Sobre Cesped (FED-federacion-colombiana-de-hockey-sobre-ce)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-hockey-sobre-ce';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Hockey Sobre Cesped',
      'Federación deportiva colombiana. Representante: Sin Representante Inscrito. NIT: 900965565 - 5.',
      'academy',
      'Bogotá D.C',
      'No reporta',
      '3168706454',
      'colombiahockey@gmail.com',
      ARRAY['Hockey Sobre Cesped']::text[],
      true, false,
      'federacion-colombiana-de-hockey-sobre-cesped-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-hockey-sobre-ce', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Sin Representante Inscrito. NIT: 900965565 - 5.', description),
      phone       = COALESCE('3168706454', phone),
      email       = COALESCE('colombiahockey@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'No reporta', 'Bogotá D.C',
         '3168706454', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Hockeyh Sobre Hielo (FED-federacion-colombiana-de-hockeyh-sobre-h)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-hockeyh-sobre-h';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Hockeyh Sobre Hielo',
      'Federación deportiva colombiana. Representante: Daniel Fierro Torres. NIT: 901321472 - 9.',
      'academy',
      'Bogotá D.C',
      'Calle 145 A No. 19-34 Oficina 204',
      '6484488',
      'daniel@fedehockey.com',
      ARRAY['Hockeyh Sobre Hielo']::text[],
      true, false,
      'federacion-colombiana-de-hockeyh-sobre-hielo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-hockeyh-sobre-h', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Daniel Fierro Torres. NIT: 901321472 - 9.', description),
      phone       = COALESCE('6484488', phone),
      email       = COALESCE('daniel@fedehockey.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 145 A No. 19-34 Oficina 204', 'Bogotá D.C',
         '6484488', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Jiujitsu (FED-federacion-colombiana-de-jiujitsu)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-jiujitsu';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Jiujitsu',
      'Federación deportiva colombiana. Representante: John Edison Cajamarca Sarmiento. NIT: 900123386 - 0.',
      'academy',
      'Bogotá D.C',
      'Diagonal 35 Bis No. 19-31 4º. Piso',
      '4020581',
      'jiujitsucolombia@hotmail.com',
      ARRAY['Jiujitsu']::text[],
      true, false,
      'federacion-colombiana-de-jiujitsu-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-jiujitsu', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: John Edison Cajamarca Sarmiento. NIT: 900123386 - 0.', description),
      phone       = COALESCE('4020581', phone),
      email       = COALESCE('jiujitsucolombia@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Diagonal 35 Bis No. 19-31 4º. Piso', 'Bogotá D.C',
         '4020581', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Judo (FED-federacion-colombiana-de-judo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-judo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Judo',
      'Federación deportiva colombiana. Representante: Wilson Leonardo Figueroa Melo. NIT: 860532945 - 8.',
      'academy',
      'Bogotá D.C',
      'Carrera 66 A No. 42 - 34 Salitre El Greco',
      '3154015201',
      'oficina@fecoljudo.org.co',
      ARRAY['Judo']::text[],
      true, false,
      'federacion-colombiana-de-judo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-judo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Wilson Leonardo Figueroa Melo. NIT: 860532945 - 8.', description),
      phone       = COALESCE('3154015201', phone),
      email       = COALESCE('oficina@fecoljudo.org.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 66 A No. 42 - 34 Salitre El Greco', 'Bogotá D.C',
         '3154015201', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Karate Do (FED-federacion-colombiana-de-karate-do)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-karate-do';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Karate Do',
      'Federación deportiva colombiana. Representante: Nuvis Del Carmen Negrete Vega. NIT: 800101126 - 5.',
      'academy',
      'Bogotá D.C',
      'Diagonal 35 Bis No. 19-31 Piso 4º',
      '3380596',
      'fckcolombiakarate@gmail.com',
      ARRAY['Karate Do']::text[],
      true, false,
      'federacion-colombiana-de-karate-do-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-karate-do', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Nuvis Del Carmen Negrete Vega. NIT: 800101126 - 5.', description),
      phone       = COALESCE('3380596', phone),
      email       = COALESCE('fckcolombiakarate@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Diagonal 35 Bis No. 19-31 Piso 4º', 'Bogotá D.C',
         '3380596', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Karts (FED-federacion-colombiana-de-karts)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-karts';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Karts',
      'Federación deportiva colombiana. Representante: Jorge Humberto Cortes Bonilla. NIT: 860065896 - 1.',
      'academy',
      'Bogotá D.C',
      'Calle 102 A No. 49 A 24',
      '3112519719',
      'fedekart2013@gmail.com',
      ARRAY['Karts']::text[],
      true, false,
      'federacion-colombiana-de-karts-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-karts', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Jorge Humberto Cortes Bonilla. NIT: 860065896 - 1.', description),
      phone       = COALESCE('3112519719', phone),
      email       = COALESCE('fedekart2013@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 102 A No. 49 A 24', 'Bogotá D.C',
         '3112519719', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Kick Boxing (FED-federacion-colombiana-de-kick-boxing)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-kick-boxing';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Kick Boxing',
      'Federación deportiva colombiana. Representante: . NIT: .',
      'academy',
      'Colombia',
      NULL,
      NULL,
      NULL,
      ARRAY['Kick Boxing']::text[],
      true, false,
      'federacion-colombiana-de-kick-boxing-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-kick-boxing', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: . NIT: .', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

END $$;

-- Federacion Colombiana De Levantamineto De Pesas (FED-federacion-colombiana-de-levantamineto-d)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-levantamineto-d';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Levantamineto De Pesas',
      'Federación deportiva colombiana. Representante: William Guillermo Peña Rodriguez. NIT: 890480912 - 1.',
      'academy',
      'Cali',
      'No reporta',
      NULL,
      'fedepesascolombia@gmail.com',
      ARRAY['Levantamineto De Pesas']::text[],
      true, false,
      'federacion-colombiana-de-levantamineto-de-pesas-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-levantamineto-d', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: William Guillermo Peña Rodriguez. NIT: 890480912 - 1.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('fedepesascolombia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'No reporta', 'Cali',
         NULL, 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Levantamiento De Potencia (FED-federacion-colombiana-de-levantamiento-d)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-levantamiento-d';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Levantamiento De Potencia',
      'Federación deportiva colombiana. Representante: Alberto Diaz Hoyos. NIT: 901250556 - 3.',
      'academy',
      'Valledupar',
      'Calle 11 Nº 19c-05 coliseo Julio Monsalvo Castilla',
      '3195551079',
      'potenciacolombia@hotmail.com',
      ARRAY['Levantamiento De Potencia']::text[],
      true, false,
      'federacion-colombiana-de-levantamiento-de-potencia-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-levantamiento-d', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Alberto Diaz Hoyos. NIT: 901250556 - 3.', description),
      phone       = COALESCE('3195551079', phone),
      email       = COALESCE('potenciacolombia@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 11 Nº 19c-05 coliseo Julio Monsalvo Castilla', 'Valledupar',
         '3195551079', 10.4651733, -73.2529512, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Lucha (FED-federacion-colombiana-de-lucha)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-lucha';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Lucha',
      'Federación deportiva colombiana. Representante: Fanny Margarita Echeverry Zuluaga. NIT: 890310137 - 1.',
      'academy',
      'Medellín',
      'Calle 9B Sur No. 25-161',
      '3147005889',
      'fedeluchacol2@gmail.com',
      ARRAY['Lucha']::text[],
      true, false,
      'federacion-colombiana-de-lucha-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-lucha', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Fanny Margarita Echeverry Zuluaga. NIT: 890310137 - 1.', description),
      phone       = COALESCE('3147005889', phone),
      email       = COALESCE('fedeluchacol2@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 9B Sur No. 25-161', 'Medellín',
         '3147005889', 6.2007374, -75.5914761, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Motocicliso (FED-federacion-colombiana-de-motocicliso)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-motocicliso';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Motocicliso',
      'Federación deportiva colombiana. Representante: Carlos Andres Ramirez Buitrago. NIT: 800176937 - 3.',
      'academy',
      'Bogotá D.C',
      'Calle 45 No. 66 B-15 (Salitre El Greco)',
      '2887081',
      'fedemoto@fedemoto.org',
      ARRAY['Motocicliso']::text[],
      true, false,
      'federacion-colombiana-de-motocicliso-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-motocicliso', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Carlos Andres Ramirez Buitrago. NIT: 800176937 - 3.', description),
      phone       = COALESCE('2887081', phone),
      email       = COALESCE('fedemoto@fedemoto.org', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 45 No. 66 B-15 (Salitre El Greco)', 'Bogotá D.C',
         '2887081', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Motonautica (FED-federacion-colombiana-de-motonautica)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-motonautica';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Motonautica',
      'Federación deportiva colombiana. Representante: Victor Alonso Dominguez Alzate. NIT: 811022609 - 1.',
      'academy',
      'Bogotá D.C',
      'Diagonal 35 Bis No. 19-31 Edificio de Federaciones',
      '8615229',
      'presidencia@federacioncolombianademotonautica.com',
      ARRAY['Motonautica']::text[],
      true, false,
      'federacion-colombiana-de-motonautica-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-motonautica', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Victor Alonso Dominguez Alzate. NIT: 811022609 - 1.', description),
      phone       = COALESCE('8615229', phone),
      email       = COALESCE('presidencia@federacioncolombianademotonautica.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Diagonal 35 Bis No. 19-31 Edificio de Federaciones', 'Bogotá D.C',
         '8615229', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Natacion (FED-federacion-colombiana-de-natacion)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-natacion';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Natacion',
      'Federación deportiva colombiana. Representante: Jorge Enrique Soto Roldan. NIT: 890308001 - 0.',
      'academy',
      'Cali',
      'Calle 9 B No. 27-49 Barrio Champagñat',
      '8890366',
      'fecolnat@fecna.com.co',
      ARRAY['Natacion']::text[],
      true, false,
      'federacion-colombiana-de-natacion-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-natacion', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Jorge Enrique Soto Roldan. NIT: 890308001 - 0.', description),
      phone       = COALESCE('8890366', phone),
      email       = COALESCE('fecolnat@fecna.com.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 9 B No. 27-49 Barrio Champagñat', 'Cali',
         '8890366', 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Orientacion (FED-federacion-colombiana-de-orientacion)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-orientacion';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Orientacion',
      'Federación deportiva colombiana. Representante: Jose Fernando Gomez Rueda. NIT: 804013044 - 7.',
      'academy',
      'Bogotá D.C',
      'Casa de las Federaciones - Diagonal 36 Bis No. 19-31',
      NULL,
      'josefergr@hotmail.com',
      ARRAY['Orientacion']::text[],
      true, false,
      'federacion-colombiana-de-orientacion-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-orientacion', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Jose Fernando Gomez Rueda. NIT: 804013044 - 7.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('josefergr@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Casa de las Federaciones - Diagonal 36 Bis No. 19-31', 'Bogotá D.C',
         NULL, 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Patinaje (FED-federacion-colombiana-de-patinaje)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-patinaje';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Patinaje',
      'Federación deportiva colombiana. Representante: Alberto Herrera Ayala. NIT: 860077223 - 7.',
      'academy',
      'Bogotá D.C',
      'Carrera 74 No. 25 F 10 Barrio Modelia',
      '31689348916',
      'info@fedepatin.org.co',
      ARRAY['Patinaje']::text[],
      true, false,
      'federacion-colombiana-de-patinaje-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-patinaje', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Alberto Herrera Ayala. NIT: 860077223 - 7.', description),
      phone       = COALESCE('31689348916', phone),
      email       = COALESCE('info@fedepatin.org.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 74 No. 25 F 10 Barrio Modelia', 'Bogotá D.C',
         '31689348916', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Porrismo (FED-federacion-colombiana-de-porrismo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-porrismo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Porrismo',
      'Federación deportiva colombiana. Representante: Diana Maria Llano Castrillon. NIT: 901057369 - 6.',
      'academy',
      'Bogotá D.C',
      'Calle 145 No. 13A-19, Edificio la Alborada, Apto 50',
      '4451808',
      'fedecolcheer@gmail.com',
      ARRAY['Porrismo']::text[],
      true, false,
      'federacion-colombiana-de-porrismo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-porrismo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Diana Maria Llano Castrillon. NIT: 901057369 - 6.', description),
      phone       = COALESCE('4451808', phone),
      email       = COALESCE('fedecolcheer@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 145 No. 13A-19, Edificio la Alborada, Apto 50', 'Bogotá D.C',
         '4451808', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Poker (FED-federacion-colombiana-de-poker)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-poker';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Poker',
      'Federación deportiva colombiana. Representante: Johann David Ibáñez Diaz. NIT: 901927117-0.',
      'academy',
      'Valledupar',
      'Manzana C, casa 25 mirador de la Sierra 4',
      '3017692312',
      'juridica.fedepoker@gmail.com',
      ARRAY['Poker']::text[],
      true, false,
      'federacion-colombiana-de-poker-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-poker', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Johann David Ibáñez Diaz. NIT: 901927117-0.', description),
      phone       = COALESCE('3017692312', phone),
      email       = COALESCE('juridica.fedepoker@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Manzana C, casa 25 mirador de la Sierra 4', 'Valledupar',
         '3017692312', 10.4651733, -73.2529512, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Racquetball (FED-federacion-colombiana-de-racquetball)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-racquetball';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Racquetball',
      'Federación deportiva colombiana. Representante: Sin Representante Inscrito. NIT: 830130695 - 7.',
      'academy',
      'Bogotá D.C',
      'Calle 122 No. 22-18',
      NULL,
      NULL,
      ARRAY['Racquetball']::text[],
      true, false,
      'federacion-colombiana-de-racquetball-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-racquetball', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Sin Representante Inscrito. NIT: 830130695 - 7.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE(NULL, email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 122 No. 22-18', 'Bogotá D.C',
         NULL, 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Remo (FED-federacion-colombiana-de-remo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-remo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Remo',
      'Federación deportiva colombiana. Representante: Sin Representante Inscrito. NIT: 907375567 - 1.',
      'academy',
      'Cali',
      'No reporta',
      NULL,
      'comiteprovisionalfederacioncol@gmail.com',
      ARRAY['Remo']::text[],
      true, false,
      'federacion-colombiana-de-remo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-remo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Sin Representante Inscrito. NIT: 907375567 - 1.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('comiteprovisionalfederacioncol@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'No reporta', 'Cali',
         NULL, 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Rugby (FED-federacion-colombiana-de-rugby)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-rugby';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Rugby',
      'Federación deportiva colombiana. Representante: Rafael Armando Lozano Altahona. NIT: 900429096 - 4.',
      'academy',
      'Medellín',
      'Calle 48 No. 70-180 Barrio Estadio',
      '3176987877',
      'presidente@colombia.rugby',
      ARRAY['Rugby']::text[],
      true, false,
      'federacion-colombiana-de-rugby-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-rugby', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Rafael Armando Lozano Altahona. NIT: 900429096 - 4.', description),
      phone       = COALESCE('3176987877', phone),
      email       = COALESCE('presidente@colombia.rugby', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 48 No. 70-180 Barrio Estadio', 'Medellín',
         '3176987877', 6.2697324, -75.6025597, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Sambo (FED-federacion-colombiana-de-sambo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-sambo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Sambo',
      'Federación deportiva colombiana. Representante: Carlos Julio Lopez Feliz. NIT: 900262915 - 2.',
      'academy',
      'Villavicencio',
      'Carrera 16c 23a No.108B 3 Barrio Olímpico',
      '3003890355',
      'federacioncolombianadesambo@gmail.com',
      ARRAY['Sambo']::text[],
      true, false,
      'federacion-colombiana-de-sambo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-sambo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Carlos Julio Lopez Feliz. NIT: 900262915 - 2.', description),
      phone       = COALESCE('3003890355', phone),
      email       = COALESCE('federacioncolombianadesambo@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 16c 23a No.108B 3 Barrio Olímpico', 'Villavicencio',
         '3003890355', 4.1114595, -73.4967836, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Savate (FED-federacion-colombiana-de-savate)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-savate';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Savate',
      'Federación deportiva colombiana. Representante: Benigno Alfonso Quintero Rengifo. NIT: 901239083 - 7.',
      'academy',
      'Ibagué',
      'Barrio El Salado, Urbanización Los Lagos Mz F Casa No. 6',
      '3204633830',
      'savatecolombia@hotmail.com',
      ARRAY['Savate']::text[],
      true, false,
      'federacion-colombiana-de-savate-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-savate', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Benigno Alfonso Quintero Rengifo. NIT: 901239083 - 7.', description),
      phone       = COALESCE('3204633830', phone),
      email       = COALESCE('savatecolombia@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Barrio El Salado, Urbanización Los Lagos Mz F Casa No. 6', 'Ibagué',
         '3204633830', 4.4386033, -75.2108857, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Softbol (FED-federacion-colombiana-de-softbol)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-softbol';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Softbol',
      'Federación deportiva colombiana. Representante: Eduin De Jesus Diaz Pajaro. NIT: 890401221 - 1.',
      'academy',
      'Cartagena',
      'Estadio de Sóft-Ball Barrio Chiquinquirá',
      NULL,
      'presidencia@fedesoftbol.org',
      ARRAY['Softbol']::text[],
      true, false,
      'federacion-colombiana-de-softbol-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-softbol', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Eduin De Jesus Diaz Pajaro. NIT: 890401221 - 1.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('presidencia@fedesoftbol.org', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Estadio de Sóft-Ball Barrio Chiquinquirá', 'Cartagena',
         NULL, 10.4265566, -75.5441671, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Squash (FED-federacion-colombiana-de-squash)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-squash';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Squash',
      'Federación deportiva colombiana. Representante: Miguel Angel Pedraza Jaimes. NIT: 800045466 - 4.',
      'academy',
      'Bogotá D.C',
      'Calle 45 No. 66 B-15 Barrio Salitre El Greco',
      '7731169',
      'contactenos@squascolombia.org.co',
      ARRAY['Squash']::text[],
      true, false,
      'federacion-colombiana-de-squash-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-squash', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Miguel Angel Pedraza Jaimes. NIT: 800045466 - 4.', description),
      phone       = COALESCE('7731169', phone),
      email       = COALESCE('contactenos@squascolombia.org.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 45 No. 66 B-15 Barrio Salitre El Greco', 'Bogotá D.C',
         '7731169', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Surf (FED-federacion-colombiana-de-surf)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-surf';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Surf',
      'Federación deportiva colombiana. Representante: Andres Alberto Porras Villamil. NIT: 901091612 - 5.',
      'academy',
      'Cartagena',
      'Isla de Tierrabomba Calle Principal Cabaña Vista Hermosa',
      NULL,
      'fedecolsurf@gmail.com',
      ARRAY['Surf']::text[],
      true, false,
      'federacion-colombiana-de-surf-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-surf', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Andres Alberto Porras Villamil. NIT: 901091612 - 5.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('fedecolsurf@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Isla de Tierrabomba Calle Principal Cabaña Vista Hermosa', 'Cartagena',
         NULL, 10.4265566, -75.5441671, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Taekwondo (FED-federacion-colombiana-de-taekwondo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-taekwondo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Taekwondo',
      'Federación deportiva colombiana. Representante: Rene Forero Tavera. NIT: 860524134 - 8.',
      'academy',
      'Bogotá D.C',
      'Transversal 21 Bis No. 60-35',
      '3019718',
      'tkd_colombia@hotmail.com',
      ARRAY['Taekwondo']::text[],
      true, false,
      'federacion-colombiana-de-taekwondo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-taekwondo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Rene Forero Tavera. NIT: 860524134 - 8.', description),
      phone       = COALESCE('3019718', phone),
      email       = COALESCE('tkd_colombia@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Transversal 21 Bis No. 60-35', 'Bogotá D.C',
         '3019718', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Tejo (FED-federacion-colombiana-de-tejo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-tejo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Tejo',
      'Federación deportiva colombiana. Representante: Plinio Mendoza Salamanca. NIT: 800078980 - 0.',
      'academy',
      'Bogotá D.C',
      'Carrera 28 A No. 39 A - 30 Barrio La Soledad',
      '3018409',
      'fedetejocol@hotmail.com',
      ARRAY['Tejo']::text[],
      true, false,
      'federacion-colombiana-de-tejo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-tejo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Plinio Mendoza Salamanca. NIT: 800078980 - 0.', description),
      phone       = COALESCE('3018409', phone),
      email       = COALESCE('fedetejocol@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 28 A No. 39 A - 30 Barrio La Soledad', 'Bogotá D.C',
         '3018409', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Tenis (FED-federacion-colombiana-de-tenis)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-tenis';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Tenis',
      'Federación deportiva colombiana. Representante: Pablo Felipe Robledo Del Castillo. NIT: 860030468 - 1.',
      'academy',
      'Bogotá D.C',
      'Diagonal 35 Bis No. 19-31 Barrio La Soledad',
      '5635414',
      'comunicaciones@fedecoltenis.com',
      ARRAY['Tenis']::text[],
      true, false,
      'federacion-colombiana-de-tenis-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-tenis', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Pablo Felipe Robledo Del Castillo. NIT: 860030468 - 1.', description),
      phone       = COALESCE('5635414', phone),
      email       = COALESCE('comunicaciones@fedecoltenis.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Diagonal 35 Bis No. 19-31 Barrio La Soledad', 'Bogotá D.C',
         '5635414', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Tenis De Mesa (FED-federacion-colombiana-de-tenis-de-mesa)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-tenis-de-mesa';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Tenis De Mesa',
      'Federación deportiva colombiana. Representante: Carlos Andres Figueroa Marin. NIT: 890106273 - 1.',
      'academy',
      'Bogotá D.C',
      'Diagonal 35 Bis No. 19-31 Piso 2º.',
      '3134435',
      'fctmcolombia@gmail.com',
      ARRAY['Tenis De Mesa']::text[],
      true, false,
      'federacion-colombiana-de-tenis-de-mesa-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-tenis-de-mesa', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Carlos Andres Figueroa Marin. NIT: 890106273 - 1.', description),
      phone       = COALESCE('3134435', phone),
      email       = COALESCE('fctmcolombia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Diagonal 35 Bis No. 19-31 Piso 2º.', 'Bogotá D.C',
         '3134435', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Tiro Y Caza Deportiva (FED-federacion-colombiana-de-tiro-y-caza-dep)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-tiro-y-caza-dep';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Tiro Y Caza Deportiva',
      'Federación deportiva colombiana. Representante: Alex Tanaka Kuratomi. NIT: 860008926 - 1.',
      'academy',
      'Bogotá D.C',
      'Calle 44 No. 54-11 Oficina 201',
      '3153849',
      'gerenecia@fedetirocol.com',
      ARRAY['Tiro Y Caza Deportiva']::text[],
      true, false,
      'federacion-colombiana-de-tiro-y-caza-deportiva-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-tiro-y-caza-dep', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Alex Tanaka Kuratomi. NIT: 860008926 - 1.', description),
      phone       = COALESCE('3153849', phone),
      email       = COALESCE('gerenecia@fedetirocol.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 44 No. 54-11 Oficina 201', 'Bogotá D.C',
         '3153849', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Triatlon (FED-federacion-colombiana-de-triatlon)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-triatlon';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Triatlon',
      'Federación deportiva colombiana. Representante: Juan Manuel Velasco Diez. NIT: 800009065 - 1.',
      'academy',
      'Cali',
      'Calle 6 Oeste No. 24F-13',
      '5560559',
      'Fedecoltri@fedecoltri.com',
      ARRAY['Triatlon']::text[],
      true, false,
      'federacion-colombiana-de-triatlon-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-triatlon', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Juan Manuel Velasco Diez. NIT: 800009065 - 1.', description),
      phone       = COALESCE('5560559', phone),
      email       = COALESCE('Fedecoltri@fedecoltri.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 6 Oeste No. 24F-13', 'Cali',
         '5560559', 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Vela (FED-federacion-colombiana-de-vela)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-vela';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Vela',
      'Federación deportiva colombiana. Representante: Maria Carolina Latorre Lopez. NIT: 860045920 - 5.',
      'academy',
      'Bogotá D.C',
      'Diagonal 35B No. 19 – 31 1er. Piso',
      NULL,
      'info@fedevelacolombia.org',
      ARRAY['Vela']::text[],
      true, false,
      'federacion-colombiana-de-vela-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-vela', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Maria Carolina Latorre Lopez. NIT: 860045920 - 5.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('info@fedevelacolombia.org', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Diagonal 35B No. 19 – 31 1er. Piso', 'Bogotá D.C',
         NULL, 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Voleibol (FED-federacion-colombiana-de-voleibol)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-voleibol';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Voleibol',
      'Federación deportiva colombiana. Representante: Felix Mauricio Antolinez Diaz. NIT: 860045666 - 9.',
      'academy',
      'Bogotá D.C',
      'Transversal 21 Bis No. 60-35 Barrio San Luis',
      '7559135',
      'fcv@fedevoleicol.com',
      ARRAY['Voleibol']::text[],
      true, false,
      'federacion-colombiana-de-voleibol-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-voleibol', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Felix Mauricio Antolinez Diaz. NIT: 860045666 - 9.', description),
      phone       = COALESCE('7559135', phone),
      email       = COALESCE('fcv@fedevoleicol.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Transversal 21 Bis No. 60-35 Barrio San Luis', 'Bogotá D.C',
         '7559135', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Wushu (FED-federacion-colombiana-de-wushu)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-wushu';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Wushu',
      'Federación deportiva colombiana. Representante: Luz Etnis Rodriguez Gomez. NIT: 809011909 - 1.',
      'academy',
      'Ibagué',
      'Calle 18 No. 16-30 Urbanización La Aurora',
      NULL,
      'federacioncolombianadewushu@gmail.com',
      ARRAY['Wushu']::text[],
      true, false,
      'federacion-colombiana-de-wushu-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-wushu', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Luz Etnis Rodriguez Gomez. NIT: 809011909 - 1.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('federacioncolombianadewushu@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 18 No. 16-30 Urbanización La Aurora', 'Ibagué',
         NULL, 4.4386033, -75.2108857, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion De Deporte Especial De Colombia (FED-federacion-de-deporte-especial-de-colomb)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-de-deporte-especial-de-colomb';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion De Deporte Especial De Colombia',
      'Federación deportiva colombiana. Representante: Bitalia Zenith Maestre Molina. NIT: 900119861 - 2.',
      'academy',
      'Bogotá D.C',
      'Carrera 13 A No. 87-34',
      NULL,
      'fedesoficial@gmail.com',
      ARRAY['Deporte Especial De Colombia']::text[],
      true, false,
      'federacion-de-deporte-especial-de-colombia-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-de-deporte-especial-de-colomb', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Bitalia Zenith Maestre Molina. NIT: 900119861 - 2.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('fedesoficial@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 13 A No. 87-34', 'Bogotá D.C',
         NULL, 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Deportes Para Personas Con Discapacidad Fisica (FED-federacion-colombiana-de-deportes-para-p)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-deportes-para-p';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Deportes Para Personas Con Discapacidad Fisica',
      'Federación deportiva colombiana. Representante: Alcibíades Serrato Rayo. NIT: 860502936-3.',
      'academy',
      'Bogotá D.C',
      'Carrera 28A #49A - 11 Apto. 101 Barrio Benalcázar Norte',
      '3207330501',
      'Presidenciafedesir2021@gmail.com',
      ARRAY['Deportes Para Personas Con Discapacidad Fisica']::text[],
      true, false,
      'federacion-colombiana-de-deportes-para-personas-con-discapac-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-deportes-para-p', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Alcibíades Serrato Rayo. NIT: 860502936-3.', description),
      phone       = COALESCE('3207330501', phone),
      email       = COALESCE('Presidenciafedesir2021@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 28A #49A - 11 Apto. 101 Barrio Benalcázar Norte', 'Bogotá D.C',
         '3207330501', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion De Deportes De Discapacidad Visual (FED-federacion-de-deportes-de-discapacidad-v)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-de-deportes-de-discapacidad-v';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion De Deportes De Discapacidad Visual',
      'Federación deportiva colombiana. Representante: Jose Domingo Bernal. NIT: 830084506 - 0.',
      'academy',
      'Bogotá D.C',
      'Carrera 79 D No. 42a - 42 Sur',
      '3106992777',
      'fedelivcolombia1@gmail.com',
      ARRAY['Deportes De Discapacidad Visual']::text[],
      true, false,
      'federacion-de-deportes-de-discapacidad-visual-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-de-deportes-de-discapacidad-v', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Jose Domingo Bernal. NIT: 830084506 - 0.', description),
      phone       = COALESCE('3106992777', phone),
      email       = COALESCE('fedelivcolombia1@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 79 D No. 42a - 42 Sur', 'Bogotá D.C',
         '3106992777', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Deportistas Con Paralisis Cerebral (FED-federacion-colombiana-de-deportistas-con)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-deportistas-con';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Deportistas Con Paralisis Cerebral',
      'Federación deportiva colombiana. Representante: Sin Representante Inscrito. NIT: 900225642 - 1.',
      'academy',
      'Bogotá D.C',
      'Calle 25 No. 35-39 Edificio C 4 - Apto. 608 Centro Nariño',
      '3144320259',
      'joselo0809@gmail.com',
      ARRAY['Deportistas Con Paralisis Cerebral']::text[],
      true, false,
      'federacion-colombiana-de-deportistas-con-paralisis-cerebral-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-deportistas-con', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Sin Representante Inscrito. NIT: 900225642 - 1.', description),
      phone       = COALESCE('3144320259', phone),
      email       = COALESCE('joselo0809@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 25 No. 35-39 Edificio C 4 - Apto. 608 Centro Nariño', 'Bogotá D.C',
         '3144320259', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Deportes Para Sordos (FED-federacion-colombiana-de-deportes-para-s)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-deportes-para-s';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Deportes Para Sordos',
      'Federación deportiva colombiana. Representante: Jhon Fredy Martinez Paz. NIT: 890311688 - 0.',
      'academy',
      'Bogotá D.C',
      'Calle 63 No. 59 A 06 Centro de Alto Rendimiento',
      '3138582867',
      'fecoldes.sordos@gmail.com',
      ARRAY['Deportes Para Sordos']::text[],
      true, false,
      'federacion-colombiana-de-deportes-para-sordos-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-deportes-para-s', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Jhon Fredy Martinez Paz. NIT: 890311688 - 0.', description),
      phone       = COALESCE('3138582867', phone),
      email       = COALESCE('fecoldes.sordos@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 63 No. 59 A 06 Centro de Alto Rendimiento', 'Bogotá D.C',
         '3138582867', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Boccia (FED-federacion-colombiana-de-boccia)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-boccia';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Boccia',
      'Federación deportiva colombiana. Representante: Diana Marcela Ortiz Acevedo. NIT: 901531133 - 8.',
      'academy',
      'Cali',
      'Calle 2 No. 66 B 89 AP 405',
      NULL,
      'fecolboccia@gmail.com',
      ARRAY['Boccia']::text[],
      true, false,
      'federacion-colombiana-de-boccia-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-boccia', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Diana Marcela Ortiz Acevedo. NIT: 901531133 - 8.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('fecolboccia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 2 No. 66 B 89 AP 405', 'Cali',
         NULL, 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Para-Atletismo (FED-federacion-colombiana-de-para-atletismo)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-para-atletismo';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Para-Atletismo',
      'Federación deportiva colombiana. Representante: Dayra Faisury Dorado Gomez. NIT: 901547618 - 8.',
      'academy',
      'Cali',
      'Carrera 85 C No. 28 - 66 CA 34',
      '3160273060',
      'servicioalcliente@fecolparaatletismo.com',
      ARRAY['Para-Atletismo']::text[],
      true, false,
      'federacion-colombiana-de-para-atletismo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-para-atletismo', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Dayra Faisury Dorado Gomez. NIT: 901547618 - 8.', description),
      phone       = COALESCE('3160273060', phone),
      email       = COALESCE('servicioalcliente@fecolparaatletismo.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 85 C No. 28 - 66 CA 34', 'Cali',
         '3160273060', 3.4108435, -76.5812127, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana Deportiva De Rugby En Silla De Ruedas (FED-federacion-colombiana-deportiva-de-rugby)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-deportiva-de-rugby';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana Deportiva De Rugby En Silla De Ruedas',
      'Federación deportiva colombiana. Representante: Adriana Natali Rincon Gonzalez. NIT: 901558620 - 0.',
      'academy',
      'Bogotá D.C',
      'Carrera 40 B No. 10 - 85 Sur',
      '3123211939',
      'quadrugbycolombia@gmail.com',
      ARRAY['Deportiva De Rugby En Silla De Ruedas']::text[],
      true, false,
      'federacion-colombiana-deportiva-de-rugby-en-silla-de-ruedas-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-deportiva-de-rugby', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Adriana Natali Rincon Gonzalez. NIT: 901558620 - 0.', description),
      phone       = COALESCE('3123211939', phone),
      email       = COALESCE('quadrugbycolombia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 40 B No. 10 - 85 Sur', 'Bogotá D.C',
         '3123211939', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Paranatacion (FED-federacion-colombiana-de-paranatacion)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-paranatacion';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Paranatacion',
      'Federación deportiva colombiana. Representante: Carlos Josue Barbosa Torres. NIT: 901559015 - 9.',
      'academy',
      'Bogotá D.C',
      'Calle 79 A No. 66-40 Interior 1 Apto. 301',
      '3112570982',
      'fedeparanatacion@gmail.com',
      ARRAY['Paranatacion']::text[],
      true, false,
      'federacion-colombiana-de-paranatacion-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-paranatacion', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Carlos Josue Barbosa Torres. NIT: 901559015 - 9.', description),
      phone       = COALESCE('3112570982', phone),
      email       = COALESCE('fedeparanatacion@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 79 A No. 66-40 Interior 1 Apto. 301', 'Bogotá D.C',
         '3112570982', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Futbol Pc (FED-federacion-colombiana-de-futbol-pc)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-futbol-pc';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Futbol Pc',
      'Federación deportiva colombiana. Representante: Gustavo Alonso Henao Chica. NIT: 901591522 - 6.',
      'academy',
      'MEDELLIN',
      'Carrera 70 No. 48-100 Coliseo de Combate',
      '3137042516',
      'futbolpcfederacioncolombiana@gmail.com',
      ARRAY['Futbol Pc']::text[],
      true, false,
      'federacion-colombiana-de-futbol-pc-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-futbol-pc', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Gustavo Alonso Henao Chica. NIT: 901591522 - 6.', description),
      phone       = COALESCE('3137042516', phone),
      email       = COALESCE('futbolpcfederacioncolombiana@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 70 No. 48-100 Coliseo de Combate', 'MEDELLIN',
         '3137042516', 6.2697324, -75.6025597, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Paravoleibol (FED-federacion-colombiana-de-paravoleibol)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-paravoleibol';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Paravoleibol',
      'Federación deportiva colombiana. Representante: John Carlos Rojas Leon. NIT: 901601776 - 4.',
      'academy',
      'Bogotá D.C',
      'Calle 70 D BIS No. 111 A 20',
      '6457897',
      'fecolparavoleibol@gmail.com',
      ARRAY['Paravoleibol']::text[],
      true, false,
      'federacion-colombiana-de-paravoleibol-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-paravoleibol', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: John Carlos Rojas Leon. NIT: 901601776 - 4.', description),
      phone       = COALESCE('6457897', phone),
      email       = COALESCE('fecolparavoleibol@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 70 D BIS No. 111 A 20', 'Bogotá D.C',
         '6457897', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Baloncesto En Silla De Ruedas -Bsrcolombia (FED-federacion-colombiana-de-baloncesto-en-s)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-baloncesto-en-s';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Baloncesto En Silla De Ruedas -Bsrcolombia',
      'Federación deportiva colombiana. Representante: Luis Alberto Ninco Sanchez. NIT: 901615397 - 7.',
      'academy',
      'Bogotá D.C',
      'Carrera 71 B No. 64C-07 BRR Engativá',
      '3105604219',
      'federacionbsrcolombia@gmail.com',
      ARRAY['Baloncesto En Silla De Ruedas -Bsrcolombia']::text[],
      true, false,
      'federacion-colombiana-de-baloncesto-en-silla-de-ruedas--bsrc-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-baloncesto-en-s', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Luis Alberto Ninco Sanchez. NIT: 901615397 - 7.', description),
      phone       = COALESCE('3105604219', phone),
      email       = COALESCE('federacionbsrcolombia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 71 B No. 64C-07 BRR Engativá', 'Bogotá D.C',
         '3105604219', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Para Powerlifting (FED-federacion-colombiana-de-para-powerlifti)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-para-powerlifti';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Para Powerlifting',
      'Federación deportiva colombiana. Representante: Francisco Tulio Palomeque Palacio. NIT: 901673841 - 3.',
      'academy',
      'Bogotá D.C',
      'Carrera 76 No. 64 A 32 Piso 1 Barrio El Encanto',
      '3117382909',
      'fcparapower@gmail.com',
      ARRAY['Para Powerlifting']::text[],
      true, false,
      'federacion-colombiana-de-para-powerlifting-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-para-powerlifti', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Francisco Tulio Palomeque Palacio. NIT: 901673841 - 3.', description),
      phone       = COALESCE('3117382909', phone),
      email       = COALESCE('fcparapower@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 76 No. 64 A 32 Piso 1 Barrio El Encanto', 'Bogotá D.C',
         '3117382909', 4.2834715, -74.1753606, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Muay Thai (FED-federacion-colombiana-de-muay-thai)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-muay-thai';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Muay Thai',
      'Federación deportiva colombiana. Representante: Paola Vallejo Gutiérrez. NIT: 901845165 - 1.',
      'academy',
      'Florencia',
      'Módulo 5 Estadio Alberto Buitrago Hoyos',
      '3232325122',
      'colombianademuaythaifederacion@gmail.com',
      ARRAY['Muay Thai']::text[],
      true, false,
      'federacion-colombiana-de-muay-thai-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-muay-thai', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Paola Vallejo Gutiérrez. NIT: 901845165 - 1.', description),
      phone       = COALESCE('3232325122', phone),
      email       = COALESCE('colombianademuaythaifederacion@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Módulo 5 Estadio Alberto Buitrago Hoyos', 'Florencia',
         '3232325122', 1.6158666, -75.6143045, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Federacion Colombiana De Tiro Paradeportivo (FED-federacion-colombiana-de-tiro-paradeport)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'FED-federacion-colombiana-de-tiro-paradeport';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Federacion Colombiana De Tiro Paradeportivo',
      'Federación deportiva colombiana. Representante: Fernan Leon Henao Mejia. NIT: 901895953 - 2.',
      'academy',
      'Guarne',
      'Carrera 53 No. 46 A - 368',
      '3017378003',
      'fedeparatirocol@gmail.com',
      ARRAY['Tiro Paradeportivo']::text[],
      true, false,
      'federacion-colombiana-de-tiro-paradeportivo-fed-fede',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'FED-federacion-colombiana-de-tiro-paradeport', v_school_id, '{"kind": "federacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Federación deportiva colombiana. Representante: Fernan Leon Henao Mejia. NIT: 901895953 - 2.', description),
      phone       = COALESCE('3017378003', phone),
      email       = COALESCE('fedeparatirocol@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 53 No. 46 A - 368', 'Guarne',
         '3017378003', 6.2800171, -75.4426875, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Asociacion Colombiana De Artes Marciales Mixtas (ASOC-asociacion-colombiana-de-artes-marciales)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-asociacion-colombiana-de-artes-marciales';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Asociacion Colombiana De Artes Marciales Mixtas',
      'Asociación deportiva recreativa. Representante: Jaime S. Barón Cuervo.',
      'academy',
      'BOGOTA',
      'Cra 110a - 86 A-28',
      '3102426074',
      'ocamcolombia@gmail.com',
      ARRAY['Artes Marciales Mixtas']::text[],
      true, false,
      'asociacion-colombiana-de-artes-marciales-mixtas-asoc-aso',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-asociacion-colombiana-de-artes-marciales', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: Jaime S. Barón Cuervo.', description),
      phone       = COALESCE('3102426074', phone),
      email       = COALESCE('ocamcolombia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Cra 110a - 86 A-28', 'BOGOTA',
         '3102426074', 4.7113928, -74.1251311, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Asociacion Colombiana De Atletismo Senior Master (ASOC-asociacion-colombiana-de-atletismo-senio)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-asociacion-colombiana-de-atletismo-senio';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Asociacion Colombiana De Atletismo Senior Master',
      'Asociación deportiva recreativa. Representante: Octavio Niño Quintero.',
      'academy',
      'BOGOTA',
      'Cra 66 a - 42-34',
      '315438048',
      'Atlemaster25@hotmail.com',
      ARRAY['Atletismo Senior Master']::text[],
      true, false,
      'asociacion-colombiana-de-atletismo-senior-master-asoc-aso',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-asociacion-colombiana-de-atletismo-senio', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: Octavio Niño Quintero.', description),
      phone       = COALESCE('315438048', phone),
      email       = COALESCE('Atlemaster25@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Cra 66 a - 42-34', 'BOGOTA',
         '315438048', 4.6533817, -74.0836331, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Asociacion Colombiana De Ciclismo Senior Master (ASOC-asociacion-colombiana-de-ciclismo-senior)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-asociacion-colombiana-de-ciclismo-senior';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Asociacion Colombiana De Ciclismo Senior Master',
      'Asociación deportiva recreativa. Representante: Jose Ismael Ortega Araque.',
      'academy',
      'BOGOTA',
      'Calle 32B - 23-73 Sur',
      '3103414227',
      'ciclismomastercolombia@gmail.com',
      ARRAY['Ciclismo Senior Master']::text[],
      true, false,
      'asociacion-colombiana-de-ciclismo-senior-master-asoc-aso',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-asociacion-colombiana-de-ciclismo-senior', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: Jose Ismael Ortega Araque.', description),
      phone       = COALESCE('3103414227', phone),
      email       = COALESCE('ciclismomastercolombia@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 32B - 23-73 Sur', 'BOGOTA',
         '3103414227', 4.5683643, -74.1031444, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Asociacion Colombiana De Golfistas Senior De Colombia (ASOC-asociacion-colombiana-de-golfistas-senio)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-asociacion-colombiana-de-golfistas-senio';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Asociacion Colombiana De Golfistas Senior De Colombia',
      'Asociación deportiva recreativa. Representante: Sean Desmind Gennon Polo.',
      'academy',
      'BOGOTA',
      'Calle 93 # 14 – 20 Oficina 703',
      '2667459',
      'asosenior@asosenior.net',
      ARRAY['Golfistas Senior De Colombia']::text[],
      true, false,
      'asociacion-colombiana-de-golfistas-senior-de-colombia-asoc-aso',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-asociacion-colombiana-de-golfistas-senio', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: Sean Desmind Gennon Polo.', description),
      phone       = COALESCE('2667459', phone),
      email       = COALESCE('asosenior@asosenior.net', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 93 # 14 – 20 Oficina 703', 'BOGOTA',
         '2667459', 4.6533817, -74.0836331, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Asociacion Colombiana De Guias Scouts De Colombia (ASOC-asociacion-colombiana-de-guias-scouts-de)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-asociacion-colombiana-de-guias-scouts-de';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Asociacion Colombiana De Guias Scouts De Colombia',
      'Asociación deportiva recreativa. Representante: No Registra.',
      'academy',
      'BOGOTA',
      'Av Caracas 69-74 piso 9',
      '2554413',
      'secretarianacional@guiasscoutscolombia.org',
      ARRAY['Guias Scouts De Colombia']::text[],
      true, false,
      'asociacion-colombiana-de-guias-scouts-de-colombia-asoc-aso',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-asociacion-colombiana-de-guias-scouts-de', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: No Registra.', description),
      phone       = COALESCE('2554413', phone),
      email       = COALESCE('secretarianacional@guiasscoutscolombia.org', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Av Caracas 69-74 piso 9', 'BOGOTA',
         '2554413', 4.6533817, -74.0836331, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Asociacion Colombiana De Minifutbol (ASOC-asociacion-colombiana-de-minifutbol)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-asociacion-colombiana-de-minifutbol';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Asociacion Colombiana De Minifutbol',
      'Asociación deportiva recreativa. Representante: Carlos Andres Porras Sierra.',
      'academy',
      'BOGOTA',
      'Calle 48L - 5G - 20 Sur INT 4 Manzana 7',
      '3115517470',
      'sevenleague@hotmail.com',
      ARRAY['Minifutbol']::text[],
      true, false,
      'asociacion-colombiana-de-minifutbol-asoc-aso',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-asociacion-colombiana-de-minifutbol', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: Carlos Andres Porras Sierra.', description),
      phone       = COALESCE('3115517470', phone),
      email       = COALESCE('sevenleague@hotmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 48L - 5G - 20 Sur INT 4 Manzana 7', 'BOGOTA',
         '3115517470', 4.6533817, -74.0836331, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Asociacion Colombiana De Paint Ball Tactico (ASOC-asociacion-colombiana-de-paint-ball-tact)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-asociacion-colombiana-de-paint-ball-tact';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Asociacion Colombiana De Paint Ball Tactico',
      'Asociación deportiva recreativa. Representante: No Registra.',
      'academy',
      'BOGOTA',
      'Calle 23c- Int apto',
      '3013383340',
      'sugerencias.colpatac@gmail.com',
      ARRAY['Paint Ball Tactico']::text[],
      true, false,
      'asociacion-colombiana-de-paint-ball-tactico-asoc-aso',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-asociacion-colombiana-de-paint-ball-tact', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: No Registra.', description),
      phone       = COALESCE('3013383340', phone),
      email       = COALESCE('sugerencias.colpatac@gmail.com', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 23c- Int apto', 'BOGOTA',
         '3013383340', 4.6533817, -74.0836331, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Asociacion Colombiana De Scouts (ASOC-asociacion-colombiana-de-scouts)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-asociacion-colombiana-de-scouts';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Asociacion Colombiana De Scouts',
      'Asociación deportiva recreativa. Representante: Leonel Raúl Poveda Hernández.',
      'academy',
      'BOGOTA',
      'Cra 47 - 91-96',
      '7035060',
      'Oficina.nacional@scout.org.co',
      ARRAY['Scouts']::text[],
      true, false,
      'asociacion-colombiana-de-scouts-asoc-aso',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-asociacion-colombiana-de-scouts', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: Leonel Raúl Poveda Hernández.', description),
      phone       = COALESCE('7035060', phone),
      email       = COALESCE('Oficina.nacional@scout.org.co', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Cra 47 - 91-96', 'BOGOTA',
         '7035060', 4.6533817, -74.0836331, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Fundacion Colombianan De Tiempo Libre Y Recreacion Funlibre (ASOC-fundacion-colombianan-de-tiempo-libre-y-)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-fundacion-colombianan-de-tiempo-libre-y-';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Fundacion Colombianan De Tiempo Libre Y Recreacion Funlibre',
      'Asociación deportiva recreativa. Representante: No Registra.',
      'academy',
      'BOGOTA',
      'Carrera 25 C No 74 – 74',
      NULL,
      'Info@funlibre.org',
      ARRAY['Multideporte']::text[],
      true, false,
      'fundacion-colombianan-de-tiempo-libre-y-recreacion-funlibre-asoc-fun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-fundacion-colombianan-de-tiempo-libre-y-', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: No Registra.', description),
      phone       = COALESCE(NULL, phone),
      email       = COALESCE('Info@funlibre.org', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Carrera 25 C No 74 – 74', 'BOGOTA',
         NULL, 4.6533817, -74.0836331, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

-- Fundacion Hogares Campesinos De Colombia (ASOC-fundacion-hogares-campesinos-de-colombia)
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = 'ASOC-fundacion-hogares-campesinos-de-colombia';
  IF v_existing IS NULL THEN
    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      'Fundacion Hogares Campesinos De Colombia',
      'Asociación deportiva recreativa. Representante: Jaime Alfonso Quinceno.',
      'academy',
      'BOGOTA',
      'Calle 70a - 17-27',
      '3216455226',
      'administracion@hogaresjuvenilescampesinos.org',
      ARRAY['Multideporte']::text[],
      true, false,
      'fundacion-hogares-campesinos-de-colombia-asoc-fun',
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('mindeporte_entidades_2025_2026', 'ASOC-fundacion-hogares-campesinos-de-colombia', v_school_id, '{"kind": "asociacion", "acronym": null, "level": null}'::jsonb);
  ELSE
    v_school_id := v_existing;
    UPDATE public.schools SET
      description = COALESCE('Asociación deportiva recreativa. Representante: Jaime Alfonso Quinceno.', description),
      phone       = COALESCE('3216455226', phone),
      email       = COALESCE('administracion@hogaresjuvenilescampesinos.org', email),
      verified    = true,
      updated_at  = now()
    WHERE id = v_school_id;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         'Calle 70a - 17-27', 'BOGOTA',
         '3216455226', 4.6559840, -74.0602796, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

COMMIT;