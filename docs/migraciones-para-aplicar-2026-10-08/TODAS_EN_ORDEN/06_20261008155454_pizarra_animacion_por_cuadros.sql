-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 06 de 14 (orden obligatorio).

-- =============================================================================
-- 20261008155454_pizarra_animacion_por_cuadros.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008154654
-- Objetivo: la jugada animada por cuadros (spec docs/specs/pizarra-nivel-tacticalpad.md
--   T1). Una jugada pasa a ser una lista de cuadros con las posiciones de los
--   jugadores, el balón y las figuras de cada momento.
-- =============================================================================
-- Retrocompatible:
--   · `frames` es NULL en todas las filas existentes. Sin cuadros, la jugada es un
--     solo cuadro armado con match_lineup_players + arrows, igual que hoy.
--   · Con cuadros, el cuadro 1 se sigue escribiendo en las columnas de siempre
--     (lo hace el BFF), así que la miniatura, el PDF y los clientes viejos ven la
--     posición inicial sin enterarse de la animación.
-- Sin cambios de RLS: las columnas nuevas quedan bajo las policies existentes de
-- cada tabla (lectura staff, escritura de alineaciones vía BFF).
-- Topes (también los valida el BFF): 30 cuadros y ~512 KB por jugada, para que
-- una jugada no infle la base (Supabase Free).
-- =============================================================================

BEGIN;

ALTER TABLE public.match_lineups
  ADD COLUMN IF NOT EXISTS frames jsonb;

ALTER TABLE public.team_tactical_presets
  ADD COLUMN IF NOT EXISTS frames jsonb;

ALTER TABLE public.match_lineups
  DROP CONSTRAINT IF EXISTS match_lineups_frames_shape_check;
ALTER TABLE public.match_lineups
  ADD CONSTRAINT match_lineups_frames_shape_check CHECK (
    frames IS NULL OR (
      jsonb_typeof(frames) = 'array'
      AND jsonb_array_length(frames) BETWEEN 1 AND 30
      AND pg_column_size(frames) <= 524288
    )
  );

ALTER TABLE public.team_tactical_presets
  DROP CONSTRAINT IF EXISTS team_tactical_presets_frames_shape_check;
ALTER TABLE public.team_tactical_presets
  ADD CONSTRAINT team_tactical_presets_frames_shape_check CHECK (
    frames IS NULL OR (
      jsonb_typeof(frames) = 'array'
      AND jsonb_array_length(frames) BETWEEN 1 AND 30
      AND pg_column_size(frames) <= 524288
    )
  );

COMMENT ON COLUMN public.match_lineups.frames IS
  'Jugada animada: [{id, duration_ms, players:[{key,x,y}], ball:{x,y}|null, arrows:[...]}]. NULL = un solo cuadro (columnas de siempre). El cuadro 1 se replica en match_lineup_players/arrows.';
COMMENT ON COLUMN public.team_tactical_presets.frames IS
  'Mis jugadas animadas: mismo formato que match_lineups.frames, con key = slot_label.';

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261008155454', '20261008155454_pizarra_animacion_por_cuadros', 'sql-editor 2026-10-08') on conflict (version) do nothing;
