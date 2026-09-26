-- =============================================================================
-- 20260925170002_mesociclo_closing_review_merge.sql
-- Autor: judegor99   Fecha: 2026-09-25   Versión anterior: 20260925170001
-- Objetivo: "Cierre del Mesociclo" (MesocycleSection.tsx) tiene 3 textareas
-- (Fortalezas / Aspectos a mejorar / Notas) que comparten UNA sola columna
-- jsonb (training_mesocycles.closing_review). Cada onBlur guardaba así:
--   mutate({ ...closing, strengths: valor })
-- con `closing` capturado por closure al renderizar. Si el coach llena dos
-- campos seguido (flujo normal: tabular de un textarea al siguiente), el
-- segundo guardado puede salir antes de que el primero haga su ida-vuelta +
-- refetch -- `closing` todavía no se actualizó, así que el segundo mutate
-- manda de vuelta el valor VIEJO del primer campo, pisándolo en silencio.
-- Esta RPC hace el merge EN LA BASE (closing_review || p_patch), así el
-- cliente nunca necesita conocer el resto de los campos para guardar uno
-- solo -- elimina la carrera en la fuente, no la parchea en React.
--
-- SECURITY INVOKER (default, no DEFINER): corre con los permisos de quien
-- llama, así que la policy training_mesocycles_update (school_id = ANY
-- (user_staff_school_ids())) sigue aplicando tal cual -- no hace falta
-- duplicar esa autorización adentro de la función.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.merge_mesocycle_closing_review(p_mesocycle_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE sql
SET search_path = pg_catalog, public, pg_temp
AS $function$
  UPDATE public.training_mesocycles
     SET closing_review = COALESCE(closing_review, '{}'::jsonb) || p_patch
   WHERE id = p_mesocycle_id
  RETURNING closing_review;
$function$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.merge_mesocycle_closing_review(uuid, jsonb) TO authenticated;
    END IF;
END $$;

COMMIT;
