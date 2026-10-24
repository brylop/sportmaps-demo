-- =============================================================================
-- 20261023202219_teams_sport_modality.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-24   Versión anterior: 20261023194135
-- Objetivo: guardar la modalidad de fútbol del equipo (11, 7 o 5) para que la
--   pizarra táctica abra la cancha correcta sin depender de que el nombre diga
--   «F7». Hoy teams.sport es texto libre con el NOMBRE del deporte ("Fútbol") y
--   las categorías y sport_configs lo buscan por ese nombre exacto, así que no
--   se puede escribir «Fútbol 7» ahí sin romperlas.
-- Alcance: una columna nullable con CHECK. NULL = como hasta hoy (la modalidad se
--   deduce del nombre del equipo). Sin backfill, sin RLS nueva (la columna cae
--   bajo las policies existentes de teams), sin funciones.
-- Reversa: ALTER TABLE public.teams DROP COLUMN sport_modality; (en migración nueva).
-- =============================================================================

BEGIN;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS sport_modality text;

ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_sport_modality_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_sport_modality_check
  CHECK (sport_modality IS NULL OR sport_modality IN ('11', '7', '5'));

COMMENT ON COLUMN public.teams.sport_modality IS
  'Modalidad de fútbol del equipo: 11, 7 o 5. NULL = no declarada (se deduce del nombre). Solo aplica a deporte Fútbol.';

COMMIT;
