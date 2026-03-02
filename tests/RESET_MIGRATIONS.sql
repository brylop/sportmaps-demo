-- ==============================================================================
-- MIGRATION HISTORY RESET SCRIPT
-- Fecha: 2026-02-17
-- Autor: Antigravity AI Agent
-- Descripción: Limpia el historial de migraciones en la base de datos remota.
--              ESTO NO BORRA DATOS NI TABLAS. Solo borra el registro de "qué migraciones se aplicaron".
--              Permite ejecutar 'npx supabase db pull' desde cero para sincronizar el esquema actual.
-- ==============================================================================

DELETE FROM supabase_migrations;
