-- =============================================================================
-- 20260917162556_enrollment_intake_unregistered_athlete.sql
-- Autor: brylop   Fecha: 2026-09-17   Versión anterior: 20260917133748
-- Objetivo: fase 4 de docs/specs/alta-atleta-por-foto-hoja-matricula.md — el
--   inbox de revisión crea el atleta llamando a POST /students/create-one
--   (que ya trae la detección de duplicados y la guardia de mayor de edad).
--   Para un deportista MAYOR de edad, ese endpoint crea la fila en
--   `unregistered_athletes` (type: 'unregistered_adult'), no en `children` —
--   pero `enrollment_form_intake.child_id` solo puede apuntar a `children`.
--   Sin esta columna, el caso adulto (la hoja real de Dynasty adjunta al
--   plan es justo un adulto de 30 años) no se puede marcar como aprobado.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
-- =============================================================================

BEGIN;

ALTER TABLE public.enrollment_form_intake
    ADD COLUMN unregistered_athlete_id uuid REFERENCES public.unregistered_athletes(id);

COMMENT ON COLUMN public.enrollment_form_intake.unregistered_athlete_id IS
    'Alternativa a child_id para el deportista mayor de edad: create-one lo crea '
    'en unregistered_athletes (type unregistered_adult), no en children. '
    'Exactamente una de las dos columnas se llena al aprobar, nunca ambas.';

COMMIT;
