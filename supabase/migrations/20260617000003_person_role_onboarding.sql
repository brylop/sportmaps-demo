-- ============================================================
-- SPORTMAPS — Onboarding obligatorio para roles "persona"
-- Propósito:
--   Habilitar el gate de onboarding full-screen para athlete, parent,
--   coach y wellness_professional (igual que school/trainer/vendor/
--   organizer ya lo tienen). El gate vive en el frontend (DashboardPage)
--   y usa profiles.onboarding_completed + RPC complete_onboarding().
--
--   Esta migración:
--     1. BACKFILL: los usuarios EXISTENTES de estos 4 roles se marcan como
--        onboarding completado, para no quedar atrapados en el nuevo gate.
--        Los nuevos signups entran con onboarding_completed=false (default
--        de la columna) → verán el wizard una vez.
--     2. CREA/REEMPLAZA complete_onboarding(): la columna onboarding_completed
--        sí existe en la BD, pero la función nunca se aplicó a esta instancia
--        (vivía solo en frontend/supabase/migrations). La (re)creamos aquí de
--        forma idempotente — los wizards la invocan al finalizar.
--     3. GRANT EXECUTE a authenticated (PostgREST necesita el grant explícito
--        para exponer el RPC).
-- Fecha: 2026-06-17
-- ============================================================

BEGIN;

-- 1. Backfill: no atrapar a los usuarios persona ya existentes.
UPDATE public.profiles
   SET onboarding_completed = true,
       updated_at           = now()
 WHERE role IN ('athlete', 'parent', 'coach', 'wellness_professional')
   AND onboarding_completed IS DISTINCT FROM true;

-- 2. (Re)crear la función de cierre de onboarding. SET search_path explícito
--    (regla del proyecto para toda CREATE FUNCTION). SECURITY DEFINER porque
--    el caller actualiza su propia fila vía auth.uid().
CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  UPDATE public.profiles
     SET onboarding_completed = true,
         updated_at           = now()
   WHERE id = auth.uid();
END;
$function$;

-- 3. Asegurar que authenticated pueda ejecutar el RPC.
GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;

COMMIT;

-- Refrescar el cache de PostgREST para exponer el RPC recién creado.
NOTIFY pgrst, 'reload schema';
