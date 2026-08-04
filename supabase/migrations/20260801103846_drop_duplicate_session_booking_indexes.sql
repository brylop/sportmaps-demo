-- =============================================================================
-- 20260801103846_drop_duplicate_session_booking_indexes.sql
-- Autor: brylop   Fecha: 2026-08-01   Versión anterior: 20260801102331
-- Objetivo: borrar tres índices únicos DUPLICADOS EXACTOS en session_bookings.
-- =============================================================================
-- La tabla tiene el mismo índice único creado dos veces, con nombres distintos,
-- en las tres ramas de atleta. Definiciones idénticas:
--
--   session_bookings_unique_active_child      == uq_active_booking_child_session
--   session_bookings_unique_active_user       == uq_active_booking_user_session
--   uq_session_bookings_unregistered_active   == uq_active_booking_unreg_session
--
--   btree (session_id, <atleta>) WHERE status <> 'cancelled' AND <atleta> IS NOT NULL
--
-- Cada reserva paga el costo de escribir los seis. Sobreviven los
-- `uq_active_booking_*` por consistencia de nombre entre las tres ramas.
--
-- La garantía NO cambia: sigue habiendo un único índice por rama que impide
-- reservar dos veces la misma sesión (el doble clic del padre). Es lo que hace
-- que el `+1` del BFF no pueda cobrar dos veces la misma reserva.
--
-- Se usa DROP INDEX IF EXISTS y no CONCURRENTLY a propósito: son índices
-- redundantes, el que cubre la restricción se queda en pie, y CONCURRENTLY no
-- puede correr dentro de una transacción.
--
-- Plan: docs/plan-asistencia-y-creditos-de-sesion.md (fase F-C).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- Guardia: si el gemelo que debe sobrevivir no existiera, no se borra nada.
-- Antes dejar el duplicado que quedarse sin la restricción.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'uq_active_booking_child_session') THEN
        DROP INDEX IF EXISTS public.session_bookings_unique_active_child;
    ELSE
        RAISE WARNING 'uq_active_booking_child_session no existe: se conserva session_bookings_unique_active_child';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'uq_active_booking_user_session') THEN
        DROP INDEX IF EXISTS public.session_bookings_unique_active_user;
    ELSE
        RAISE WARNING 'uq_active_booking_user_session no existe: se conserva session_bookings_unique_active_user';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'uq_active_booking_unreg_session') THEN
        DROP INDEX IF EXISTS public.uq_session_bookings_unregistered_active;
    ELSE
        RAISE WARNING 'uq_active_booking_unreg_session no existe: se conserva uq_session_bookings_unregistered_active';
    END IF;
END $$;

COMMIT;

-- Verificación (correr aparte; el editor de Supabase no muestra los RAISE):
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'session_bookings'
--      AND indexdef LIKE '%session_id%' ORDER BY indexname;
--   Esperado: idx_session_bookings_session, uq_active_booking_child_session,
--             uq_active_booking_unreg_session, uq_active_booking_user_session.
