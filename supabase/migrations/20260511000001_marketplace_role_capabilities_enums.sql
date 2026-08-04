-- ============================================================
-- SPORTMAPS MARKETPLACE — R1.1 (parte 1/2)
-- Extender enums user_role y vendor_type para soportar:
--   - external_vendor (vendedor puro / marca / tienda externa)
--   - personal_trainer (entrenador personal, vende sesiones por su cuenta)
--   - coach (vendor_type para coaches que activan Mi Tienda)
--
-- Defensivo: si vendor_type no existe (BD desincronizada con la
-- migracion base 20260416000001), lo creamos antes de extenderlo.
--
-- IMPORTANTE: ALTER TYPE ADD VALUE puede coexistir con la creacion
-- del tipo en la misma transaccion, pero el USO de los nuevos valores
-- como literales debe diferirse a la parte 2 (que es otra transaccion).
-- ============================================================


-- ============================================================
-- 1. Asegurar que vendor_type existe (defensivo)
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.vendor_type AS ENUM ('store', 'wellness', 'school');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- 2. user_role: identidad principal del usuario
-- ============================================================

DO $$ BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'external_vendor';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'personal_trainer';
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- 3. vendor_type: tipo de perfil de venta
-- ============================================================

DO $$ BEGIN
    ALTER TYPE public.vendor_type ADD VALUE IF NOT EXISTS 'personal_trainer';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE public.vendor_type ADD VALUE IF NOT EXISTS 'coach';
EXCEPTION WHEN duplicate_object THEN null; END $$;
