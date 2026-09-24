-- =============================================================================
-- 20260924102935_tactical_situation_arqueros.sql
-- Autor: brylop   Fecha: 2026-09-24   Versión anterior: 20260924102932
-- Objetivo: nueva situación táctica 'arqueros' en team_tactical_presets
-- (plantillas guardadas de la pizarra). Carmel Club creó hoy un grupo de
-- arqueros con su propio entrenador (Yohan Casas) y la lista de situaciones
-- (ataque / defensa / presión / transición / córner / tiro libre / penalti)
-- no tenía dónde guardar un trabajo específico de portería.
--
-- Lado frontend/BFF, mismo commit: TacticalSituation (footballQueries.ts),
-- SITUATION_LABEL (TacticalBoard.tsx), VALID_SITUATIONS (bff football.ts) y
-- la opción "Arqueros" en el componente de bloque de SessionFormDialog.tsx
-- (ese campo vive en JSON, sin CHECK en la base). Solo se amplía la lista:
-- las 5 plantillas existentes siguen válidas.
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

ALTER TABLE public.team_tactical_presets
    DROP CONSTRAINT team_tactical_presets_situation_check;

ALTER TABLE public.team_tactical_presets
    ADD CONSTRAINT team_tactical_presets_situation_check CHECK (situation IN (
        'ataque', 'defensa', 'presion', 'transicion',
        'corner', 'tiro_libre', 'penalti',
        'arqueros'
    ));

COMMIT;
