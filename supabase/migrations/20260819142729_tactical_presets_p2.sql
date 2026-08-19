-- =============================================================================
-- 20260819142729_tactical_presets_p2.sql
-- Autor: judegor99   Fecha: 2026-08-19   Versión anterior: 20260819142728
-- (Renumerada al sincronizar con origin/develop -- escrita originalmente el
-- 2026-08-18 como 20260818123316, ver docs/plan-p2-estrategias-guardadas.md.)
-- Objetivo: plantillas tácticas guardadas (P2a/P2b) -- formaciones
-- reutilizables con nombre y situación (ataque/defensa/balón parado), sin
-- atarse a un partido concreto. Ver docs/plan-p2-estrategias-guardadas.md.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- A diferencia de P0 (20260814182011), esto SÍ es tabla nueva: un preset no
-- está atado a un source_type/source_id de match_lineups, vive entre fechas.
-- RLS y grants calcados de match_lineups (20260812182000) -- mismo módulo,
-- mismo nivel de autorización (STAFF_ROLES vía BFF, sin restringir a admin).
--
-- D8 del plan: slots guarda SOLO layout ({slot_label,x,y}), sin subject_id --
-- un preset viejo nunca intenta ubicar en silencio a un jugador que ya no
-- está en la plantilla.

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.team_tactical_presets (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id      uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    name         text        NOT NULL CHECK (length(btrim(name)) > 0),
    situation    text        NOT NULL CHECK (situation = ANY (ARRAY[
                     'ataque','defensa','presion','transicion',
                     'corner','tiro_libre','penalti'
                 ])),
    slots        jsonb       NOT NULL,
    created_by   uuid        NOT NULL REFERENCES public.profiles(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_tactical_presets_team ON public.team_tactical_presets (team_id);
CREATE INDEX IF NOT EXISTS idx_team_tactical_presets_school ON public.team_tactical_presets (school_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'team_tactical_presets'
          AND t.tgname = 'update_team_tactical_presets_updated_at' AND NOT t.tgisinternal
    ) THEN
        CREATE TRIGGER update_team_tactical_presets_updated_at
            BEFORE UPDATE ON public.team_tactical_presets
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

ALTER TABLE public.team_tactical_presets ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    v_defs text[][] := ARRAY[
        ARRAY['team_tactical_presets', 'team_tactical_presets_select',
              'CREATE POLICY "team_tactical_presets_select" ON public.team_tactical_presets '
              'FOR SELECT USING (school_id = ANY (public.user_school_ids()))'],
        ARRAY['team_tactical_presets', 'team_tactical_presets_insert',
              'CREATE POLICY "team_tactical_presets_insert" ON public.team_tactical_presets '
              'FOR INSERT WITH CHECK (school_id = ANY (public.user_school_ids()) OR created_by = auth.uid())'],
        ARRAY['team_tactical_presets', 'team_tactical_presets_update',
              'CREATE POLICY "team_tactical_presets_update" ON public.team_tactical_presets '
              'FOR UPDATE USING (school_id = ANY (public.user_school_ids())) '
              'WITH CHECK (school_id = ANY (public.user_school_ids()))'],
        ARRAY['team_tactical_presets', 'team_tactical_presets_delete',
              'CREATE POLICY "team_tactical_presets_delete" ON public.team_tactical_presets '
              'FOR DELETE USING (school_id = ANY (public.user_school_ids()))']
    ];
    i int;
BEGIN
    FOR i IN 1 .. array_length(v_defs, 1) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_defs[i][1] AND policyname = v_defs[i][2]
        ) THEN
            EXECUTE v_defs[i][3];
        END IF;
    END LOOP;
END $$;

-- Deliberadamente SIN GRANT a anon -- mismo criterio que match_lineups.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE
            ON public.team_tactical_presets
            TO authenticated, service_role;
    END IF;
END $$;

COMMIT;
