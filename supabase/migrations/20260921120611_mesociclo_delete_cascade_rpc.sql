-- =============================================================================
-- 20260921120611_mesociclo_delete_cascade_rpc.sql
-- Autor: brylop   Fecha: 2026-09-21   Versión anterior: 20260921115743
-- Objetivo: el botón "Eliminar mesociclo" agregado en la migración anterior
--   (20260921115743) hacía un DELETE directo a `training_mesocycles`, pero
--   `training_microcycles.mesocycle_id` es `ON DELETE SET NULL` (D10, a
--   propósito: un microciclo puede quedar suelto sin mesociclo). Consecuencia
--   real, encontrada al probar el propio botón antes de darlo por bueno: el
--   DELETE del mesociclo NO borra sus semanas -- quedan huérfanas con
--   `mesocycle_id=NULL`, y siguen ocupando `UNIQUE(team_id, starts_on)`. El
--   botón no resolvía el problema que lo motivó (poder reintentar un
--   mesociclo mal creado con las mismas fechas, ver 20260918124721) y el
--   texto de confirmación de la UI ("se borran sus semanas, días...") era
--   directamente falso.
--
--   Fix: RPC `delete_mesocycle_cascade(mesocycle_id)` que borra primero las
--   semanas (arrastra días por CASCADE ya existente) y después el mesociclo,
--   en la misma transacción de la función -- mismo criterio de
--   "creación/eliminación multi-fila = RPC transaccional" que ya quedó en
--   CLAUDE.md. `training_mesocycle_evaluations` ya tiene
--   `ON DELETE CASCADE` directo a `mesocycle_id`, no necesita paso aparte.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.delete_mesocycle_cascade(p_mesocycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id
    FROM public.training_mesocycles WHERE id = p_mesocycle_id;

    IF v_school_id IS NULL THEN
        RETURN;  -- ya no existe, nada que hacer (idempotente)
    END IF;

    IF NOT (v_school_id = ANY (public.user_staff_school_ids())) THEN
        RAISE EXCEPTION 'No autorizado para eliminar este mesociclo' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.training_microcycles WHERE mesocycle_id = p_mesocycle_id;
    DELETE FROM public.training_mesocycles WHERE id = p_mesocycle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_mesocycle_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_mesocycle_cascade(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
