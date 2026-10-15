-- =============================================================================
-- 20261014162158_pizarra_equipos_rivales.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014125632
-- Objetivo: M6b de docs/specs/pizarra-m6-paridad-tacticalpad.md — «Configuración
--   de los equipos» de la pizarra (propio y rival) y «Equipos almacenados».
--
--   1. match_lineups.teams / team_tactical_presets.teams   jsonb NULL por jugada:
--      nombre, escudo, colores, estilo de ficha, qué mostrar, portero distinto,
--      tamaño global. NULL = el aspecto de siempre (cero regresión). La forma
--      fina la valida el BFF (school/tacticalTeamsShapes.ts); acá solo un CHECK
--      de tipo y tamaño para frenar basura.
--   2. public.tactical_rival_teams   rivales guardados por escuela: nombre,
--      sigla, 3 colores (hex con CHECK), escudo genérico (jsonb: forma + diseño
--      + iniciales; NUNCA una imagen subida), estilo de ficha y plantilla del
--      rival = [{number, alias}] ≤ 30. SOLO número y alias: nunca datos reales
--      de menores de otra escuela (alias ≤ 16, 2 palabras, sin dígitos raros).
--   3. RLS: leen quienes TRABAJAN en la escuela (user_staff_school_ids());
--      escriben los de táctica (user_tactical_edit_school_ids()), cada comando
--      con su policy y WITH CHECK; anon sin nada.
--
-- ── Radio medido contra la base viva (2026-10-14, una lectura puntual) ───────
--   · tactical_rival_teams no existe; ni match_lineups ni team_tactical_presets
--     tienen columna `teams`. Nada choca.
--   · match_lineups: 97 filas; team_tactical_presets: 12. ADD COLUMN NULL sin
--     default = solo catálogo, no reescribe la tabla. Ninguna fila cambia de
--     aspecto: todas quedan con teams NULL = el dibujo de siempre.
--   · Mientras esta migración no esté aplicada, el BFF lee y escribe sin la
--     columna (mismo patrón que `frames`) y la ruta de rivales responde 503
--     «todavía no disponible»: la pizarra no se rompe.
--   · Quién escribe rivales: los mismos de la táctica de hoy (owner, coach,
--     super_admin + coaches de school_staff). Quién lee: staff. Padres y
--     atletas: nada (no lo necesitan y es información de juego del club).
--
-- Depende de: helpers user_staff_school_ids() (20260812182000) y
-- user_tactical_edit_school_ids() (20260925170001), set_updated_at().
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

SET LOCAL lock_timeout = '5s';

-- ─── 0. Dependencias ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.user_tactical_edit_school_ids()') IS NULL
     OR to_regprocedure('public.user_staff_school_ids()') IS NULL THEN
    RAISE EXCEPTION 'Faltan los helpers de RLS user_staff_school_ids() / user_tactical_edit_school_ids().';
  END IF;
END $$;

-- ─── 1. teams por jugada ────────────────────────────────────────────────────
ALTER TABLE public.match_lineups ADD COLUMN IF NOT EXISTS teams jsonb;
ALTER TABLE public.team_tactical_presets ADD COLUMN IF NOT EXISTS teams jsonb;

ALTER TABLE public.match_lineups DROP CONSTRAINT IF EXISTS match_lineups_teams_shape_check;
ALTER TABLE public.match_lineups ADD CONSTRAINT match_lineups_teams_shape_check CHECK (
  teams IS NULL OR (jsonb_typeof(teams) = 'object' AND pg_column_size(teams) <= 16384)
);
ALTER TABLE public.team_tactical_presets DROP CONSTRAINT IF EXISTS team_tactical_presets_teams_shape_check;
ALTER TABLE public.team_tactical_presets ADD CONSTRAINT team_tactical_presets_teams_shape_check CHECK (
  teams IS NULL OR (jsonb_typeof(teams) = 'object' AND pg_column_size(teams) <= 16384)
);

COMMENT ON COLUMN public.match_lineups.teams IS
  'Pizarra M6b: configuración de los dos equipos de la jugada {v, home, away, player_scale, object_scale, export_names}. NULL = aspecto de siempre. Forma validada por el BFF (tacticalTeamsShapes.ts).';
COMMENT ON COLUMN public.team_tactical_presets.teams IS
  'Pizarra M6b: igual que match_lineups.teams, para Mis jugadas.';

-- ─── 2. Validación de la plantilla del rival ────────────────────────────────
-- [{number 0-99, alias 1-16}] ≤ 30, números sin repetir, alias de máximo dos
-- palabras con letras/números/espacio/punto/guion/apóstrofo. Es un FRENO de
-- forma (el BFF valida lo mismo con mensajes); no puede ver si un alias es un
-- nombre real: por eso el tope de 16 caracteres y 2 palabras.
CREATE OR REPLACE FUNCTION public.tactical_rival_roster_ok(p_roster jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT jsonb_typeof(p_roster) = 'array'
     AND jsonb_array_length(p_roster) <= 30
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_roster) e
        WHERE jsonb_typeof(e) <> 'object'
           OR (SELECT count(*) FROM jsonb_object_keys(e) k WHERE k NOT IN ('number', 'alias')) > 0
           OR jsonb_typeof(e -> 'number') <> 'number'
           OR (e ->> 'number') !~ '^[0-9]{1,2}$'
           OR (e ? 'alias' AND (
                 jsonb_typeof(e -> 'alias') <> 'string'
                 OR char_length(e ->> 'alias') NOT BETWEEN 1 AND 16
                 OR (e ->> 'alias') !~ '^[[:alpha:][:digit:] .''-]+$'
                 OR array_length(regexp_split_to_array(btrim(e ->> 'alias'), '\s+'), 1) > 2))
     )
     AND (SELECT count(DISTINCT e ->> 'number') FROM jsonb_array_elements(p_roster) e)
         = jsonb_array_length(p_roster);
$$;

REVOKE ALL ON FUNCTION public.tactical_rival_roster_ok(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tactical_rival_roster_ok(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.tactical_rival_roster_ok(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_rival_roster_ok(jsonb) TO service_role;

-- ─── 3. tactical_rival_teams ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tactical_rival_teams (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  short_name       text CHECK (short_name IS NULL OR short_name ~ '^[[:alpha:][:digit:]]{1,4}$'),
  color_primary    text NOT NULL CHECK (color_primary ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary  text NOT NULL CHECK (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  color_number     text NOT NULL CHECK (color_number ~ '^#[0-9a-fA-F]{6}$'),
  -- Escudo GENÉRICO: {shape, design, initials}. Nunca una URL ni una imagen.
  crest            jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
                     jsonb_typeof(crest) = 'object'
                     AND NOT crest ? 'url' AND NOT crest ? 'image'
                     AND pg_column_size(crest) <= 512),
  chip_style       text NOT NULL DEFAULT 'disc'
                   CHECK (chip_style IN ('disc', 'jersey', 'stripes_v', 'stripes_h', 'silhouette')),
  roster           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (public.tactical_rival_roster_ok(roster)),
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tactical_rival_teams IS
  'Pizarra M6b «Equipos almacenados»: rivales guardados por escuela. Plantilla = solo número y alias (nunca datos de menores de otra escuela). Escudo genérico, sin imágenes.';

CREATE UNIQUE INDEX IF NOT EXISTS tactical_rival_teams_school_name_uq
  ON public.tactical_rival_teams (school_id, lower(btrim(name)));

DROP TRIGGER IF EXISTS tactical_rival_teams_set_updated_at ON public.tactical_rival_teams;
CREATE TRIGGER tactical_rival_teams_set_updated_at
  BEFORE UPDATE ON public.tactical_rival_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. Privilegios y RLS ───────────────────────────────────────────────────
ALTER TABLE public.tactical_rival_teams ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tactical_rival_teams FROM PUBLIC;
REVOKE ALL ON public.tactical_rival_teams FROM anon;
REVOKE ALL ON public.tactical_rival_teams FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_rival_teams TO authenticated;
GRANT ALL ON public.tactical_rival_teams TO service_role;

-- Leer: quien trabaja en la escuela (sin padres ni atletas).
DROP POLICY IF EXISTS tactical_rival_teams_select ON public.tactical_rival_teams;
CREATE POLICY tactical_rival_teams_select ON public.tactical_rival_teams
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.user_staff_school_ids()));

-- Escribir: táctica (owner/coach/super_admin + coaches de school_staff).
-- created_by debe ser quien inserta: no se firma a nombre de otro.
DROP POLICY IF EXISTS tactical_rival_teams_insert ON public.tactical_rival_teams;
CREATE POLICY tactical_rival_teams_insert ON public.tactical_rival_teams
  FOR INSERT TO authenticated
  WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids())
              AND (created_by IS NULL OR created_by = auth.uid()));

DROP POLICY IF EXISTS tactical_rival_teams_update ON public.tactical_rival_teams;
CREATE POLICY tactical_rival_teams_update ON public.tactical_rival_teams
  FOR UPDATE TO authenticated
  USING (school_id = ANY (public.user_tactical_edit_school_ids()))
  WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS tactical_rival_teams_delete ON public.tactical_rival_teams;
CREATE POLICY tactical_rival_teams_delete ON public.tactical_rival_teams
  FOR DELETE TO authenticated
  USING (school_id = ANY (public.user_tactical_edit_school_ids()));

COMMIT;
