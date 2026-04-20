-- =========================================================================
-- Ver que migraciones estan aplicadas en Supabase
-- Corre esto en el SQL Editor
-- =========================================================================

-- 1. Migraciones aplicadas en este Supabase (ordenadas)
SELECT version, name, statements IS NOT NULL AS has_statements
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 2. Solo los nombres/versiones (para comparar con tu carpeta local)
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;

-- 3. Conteo total
SELECT COUNT(*) AS total_migraciones_aplicadas FROM supabase_migrations.schema_migrations;
