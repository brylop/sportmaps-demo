-- =============================================================================
-- SEPARATE ATHLETE AND PARENT ROLES
-- =============================================================================

BEGIN;

-- 1. Update 'athlete' role: Remove ' / Padre' from display name
UPDATE public.roles
SET 
    display_name = 'Deportista',
    description = 'Perfil de deportista, reservas y tienda'
WHERE name = 'athlete';

-- 2. Update 'parent' role: Make visible and set correct display name
UPDATE public.roles
SET 
    display_name = 'Padre',
    description = 'Gestión de hijos y pagos',
    is_visible = true
WHERE name = 'parent';

COMMIT;
