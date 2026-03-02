-- MIGRACIÓN DE ROLES: DE ENUM A TABLA (Simplificada y Corregida)
-- =====================================================
-- 1. Crear tabla de roles
-- 2. Poblar con valores del ENUM actual + metadatos
-- 3. Vincular profiles a la nueva tabla
-- 4. Actualizar políticas RLS
-- =====================================================

BEGIN;

-- 1. Crear tabla 'roles'
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, -- 'school', 'coach', etc.
    display_name TEXT NOT NULL, -- 'Academia', 'Entrenador'
    description TEXT,
    is_visible BOOLEAN DEFAULT true, -- Si se muestra en el registro
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar que RLS esté habilitado
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Política: Todo el mundo puede leer roles visibles (para el registro)
DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public.roles;
CREATE POLICY "Roles are viewable by everyone" 
ON public.roles FOR SELECT 
USING (true);

-- 2. Poblar tabla con los valores actuales
-- Mapeamos los valores del ENUM user_role a filas
INSERT INTO public.roles (name, display_name, description, is_visible) VALUES
('athlete', 'Deportista / Padre', 'Reservas, tienda y perfil de deportista', true),
('coach', 'Entrenador', 'Gestión de clases, agenda y pagos', true),
('admin', 'Academia / Centro', 'Gestión completa de escuela deportiva', true), -- Ojo: DB usa school_admin, Frontend dice 'school'
('super_admin', 'Administrador', 'Control total del sistema', false),
('wellness_professional', 'Profesional de Salud', 'Fisioterapia y nutrición', true),
('store_owner', 'Vendedor', 'Marketplace y tienda', true),
('organizer', 'Organizador', 'Eventos y torneos', true),
('parent', 'Padre (Legacy)', 'Rol fusionado con Deportista', false)
ON CONFLICT (name) DO NOTHING; 

-- 3. Modificar tabla 'profiles'
-- Añadimos la columna, pero permitimos NULL temporalmente para la migración
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);

-- Migración de datos: Actualizar role_id basado en el enum 'role' antiguo
UPDATE public.profiles p
SET role_id = r.id
FROM public.roles r
WHERE p.role::text = r.name;

-- 4. Actualizar RLS en tablas clave
-- Usamos una función en PUBLIC. Primero la borramos para evitar conflictos de firmas.
DROP FUNCTION IF EXISTS public.has_role(text);

CREATE OR REPLACE FUNCTION public.has_role(req_role text) 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name = req_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTA: Las políticas RLS existentes que usan `auth.uid()` seguirán funcionando,
-- pero para nuevas tablas deberías usar `public.has_role('school')`.

COMMIT;
