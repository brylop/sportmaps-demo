-- =============================================================================
-- SCRIPT DE PRUEBA: SIMULACIÓN DE REGISTRO DE ESCUELA (Versión Compatible)
-- =============================================================================
-- Removiendo columnas internas de auth que pueden variar entre versiones.

DO $test$ 
DECLARE
  v_test_user_id uuid := gen_random_uuid();
  v_role_name_result text;
  v_role_id_result uuid;
BEGIN
  -- 1. Insertar usuario de prueba (Solo columnas esenciales)
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    v_test_user_id, 
    'test_school_v4@sportmaps.demo',
    '{"full_name": "Escuela Prueba V4", "role": "academia"}'::jsonb
  );

  -- 2. Verificar el perfil creado en public.profiles
  SELECT role, role_id INTO v_role_name_result, v_role_id_result
  FROM public.profiles
  WHERE id = v_test_user_id;

  RAISE NOTICE '--- RESULTADOS DE ASIGNACIÓN ---';
  RAISE NOTICE 'Rol (Enum) en Perfil: %', v_role_name_result;
  RAISE NOTICE 'Rol ID (UUID) en Perfil: %', v_role_id_result;

  -- 3. Limpieza
  DELETE FROM public.profiles WHERE id = v_test_user_id;
  DELETE FROM auth.users WHERE id = v_test_user_id;

END $test$;
