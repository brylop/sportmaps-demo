
-- =============================================================================
-- REPARACIÓN TOTAL: DISPARADOR DE REGISTRO V4 (ULTRA-STABLE)
-- =============================================================================

-- 1. Asegurar que los Enums tengan todos los valores posibles para evitar errores 500
DO $$ 
BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'school_admin';
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'school';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Función de disparo mejorada
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role_id uuid;
  v_role_name text;
  v_legacy_role text;
  v_full_name text;
  v_phone text;
BEGIN
  -- Extraer metadatos
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario');
  v_phone := new.raw_user_meta_data->>'phone';
  v_role_name := LOWER(TRIM(COALESCE(new.raw_user_meta_data->>'role', 'athlete')));

  -- Mapeo inteligente de roles (Frontend -> DB Enum y DB Roles table)
  IF v_role_name IN ('school', 'school_admin') THEN
    v_role_name := 'school_admin';
    v_legacy_role := 'school'; -- Fallback por si el enum prefiere el corto
  ELSIF v_role_name IN ('admin', 'super_admin') THEN
    v_role_name := 'super_admin';
    v_legacy_role := 'admin';
  ELSE
    v_legacy_role := v_role_name;
  END IF;

  -- 3. Buscar el UUID del rol
  SELECT id INTO v_role_id FROM public.roles WHERE LOWER(name) = v_role_name LIMIT 1;
  
  -- Si no encuentra con el largo, intentar con el corto
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE LOWER(name) = v_legacy_role LIMIT 1;
  END IF;

  -- Fallback final a athlete
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'athlete' LIMIT 1;
    v_role_name := 'athlete';
    v_legacy_role := 'athlete';
  END IF;

  -- 4. INSERT O UPDATE resiliente
  BEGIN
    INSERT INTO public.profiles (
      id, 
      email, 
      full_name, 
      role, 
      role_id, 
      phone, 
      onboarding_completed,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      new.email,
      v_full_name,
      v_legacy_role::user_role, -- Intentamos el corto primero
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
  EXCEPTION WHEN OTHERS THEN
    -- Si falla por el enum o cualquier cosa, intentamos un insert mínimo para no bloquear el registro
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, v_full_name, 'athlete')
    ON CONFLICT (id) DO NOTHING;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-vincular
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
