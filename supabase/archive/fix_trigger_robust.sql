
-- =============================================================================
-- SOLUCIÓN DEFINITIVA: TRIGGER DE REGISTRO Y ROLES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role_id uuid;
  v_role_name text;
  v_full_name text;
  v_phone text;
BEGIN
  -- 1. Extraer metadatos con COALESCE para evitar nulos
  v_role_name := LOWER(TRIM(COALESCE(new.raw_user_meta_data->>'role', 'athlete')));
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario');
  v_phone := new.raw_user_meta_data->>'phone';

  -- 2. Normalización de seguridad (Mapeo Frontend -> DB)
  -- Si el frontend manda 'school', mapeamos a 'school_admin'
  IF v_role_name = 'school' THEN
    v_role_name := 'school_admin';
  END IF;

  -- 3. Buscar el ID correspondiente en la tabla roles
  SELECT id INTO v_role_id FROM public.roles WHERE LOWER(name) = v_role_name LIMIT 1;

  -- 4. Fallback de seguridad si el rol no existe
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'athlete' LIMIT 1;
    v_role_name := 'athlete';
  END IF;

  -- 5. Inserción en la tabla profiles
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role,        -- Columna de texto para compatibilidad legacy
    role_id,     -- FK a la tabla de roles para el nuevo esquema
    phone, 
    onboarding_completed,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_role_name,
    v_role_id,
    v_phone,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    role_id = EXCLUDED.role_id,
    updated_at = NOW();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-vincular el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
