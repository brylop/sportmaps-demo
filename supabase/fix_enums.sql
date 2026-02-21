-- ============================================================
-- FIX: Actualizar Enum user_role para incluir los nuevos valores
-- ============================================================

-- Intentar agregar 'school' si no existe
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'school';

-- Intentar agregar 'wellness_professional' si no existe
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'wellness_professional';

-- Intentar agregar 'store_owner' si no existe
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'store_owner';

-- Opcional: Si quieres renombrar 'school_admin' a 'school' (no soportado directamente en ALTER TYPE, se requiere hack)
-- Mejor simplemente agregamos los nuevos.

-- Verificación rápida
DO $$
BEGIN
    RAISE NOTICE 'Enum user_role actualizado correctamente.';
END $$;
