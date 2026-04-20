-- =========================================================================
-- Diagnostico: verifica que tablas existen en tu Supabase
-- Corre esto primero para ver que relacion tenemos disponible
-- =========================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'schools', 'school_branches', 'school_settings', 'school_members', 'school_staff',
    'programs', 'teams', 'children', 'students', 'classes',
    'enrollments', 'team_members', 'facilities', 'sports_categories'
  )
ORDER BY table_name;

-- Tambien muestra todas las tablas publicas para referencia
SELECT '---- TODAS LAS TABLAS PUBLICAS ----' AS separator;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
