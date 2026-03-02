
-- =============================================================================
-- REPARACIÓN DE JULIAN GOMEZ (PASO MANUAL RECOMENDADO)
-- =============================================================================

-- 1. Forzar el rol de Padre en la tabla de perfiles
UPDATE public.profiles
SET 
  role = 'parent',
  role_id = (SELECT id FROM public.roles WHERE name = 'parent' LIMIT 1),
  updated_at = NOW()
WHERE full_name ILIKE '%Julian Gomez%' OR email = 'juligrios1999@gmail.com';

-- 2. Verificar que el trigger esté correcto (v4 ha sido desplegado)
-- El trigger v4 evitará que futuros cambios rompan esto.

-- 3. IMPORTANTE: En el Frontend hay que limpiar el caché.
-- Si el usuario ya está logueado, su sesión podría tener el rol 'athlete' en los metadatos.
-- El script de reparación de AuthContext.tsx evitará que se sobreescriba en el futuro.
