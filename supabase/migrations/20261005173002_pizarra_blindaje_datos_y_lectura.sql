-- =============================================================================
-- 20261005173002_pizarra_blindaje_datos_y_lectura.sql
-- Autor: judegor99   Fecha: 2026-10-05   Versión anterior: 20261005173001
-- Objetivo: cierra dos hallazgos de la auditoría de la pizarra táctica
--   (plan 2026-10-04, B16/B17) que ningún escaneo de forma detecta.
--
--   1. DATOS. `slots`/`arrows` (jsonb) no tenían ninguna restricción: ni que
--      fueran una lista, ni un tope de tamaño. El único filtro era el BFF
--      (`footballShapes.ts`) y el límite global de 5 MB del body — un cliente
--      que hablara directo con la base, o un bug, podía guardar basura o un
--      jsonb de megas que el frontend después intenta dibujar. Se agregan
--      CHECKs con los MISMOS topes del BFF (300 figuras, 40 slots, nombre 80).
--      Además, el nombre de una plantilla no era único: se podían crear
--      "Salida de balón" ×5 en el mismo equipo y situación sin forma de
--      distinguirlas. Índice único por (equipo, situación, nombre normalizado).
--
--   2. LECTURA. `team_tactical_presets_select` y los SELECT de
--      `match_lineups`/`match_lineup_players`/`football_match_events` usaban
--      `user_school_ids()` = CUALQUIER miembro activo, padres y atletas
--      incluidos: un padre con su sesión podía leer por REST las plantillas
--      tácticas, las alineaciones y los dibujos del cuerpo técnico de TODOS
--      los equipos de la escuela. El BFF ya las limitaba a staff, pero la
--      base no. Pasan a `user_staff_school_ids()` (quien TRABAJA en la
--      escuela). Se conservan las ramas de "lo mío": un atleta/padre sigue
--      viendo las alineaciones y eventos donde participa él o su hijo.
--
-- Medido contra la base viva el 2026-10-04 ANTES de escribir esto:
--   · team_tactical_presets: 9 filas, todas con slots/arrows tipo array,
--     máx. 11 slots, 14 figuras, nombre ≤25 caracteres, 0 duplicados de
--     (team_id, situation, nombre) → ningún CHECK ni el índice rechaza filas
--     existentes, no hace falta renombrar nada.
--   · match_lineups: 58 filas, todas con arrows tipo array, máx. 52 figuras.
--   · Nada fuera del BFF (service_role) lee estas 4 tablas: ni el frontend ni
--     otros servicios usan el cliente con el JWT del usuario sobre ellas
--     (grep de frontend/src y bff/src) → acotar la lectura de las policies no
--     le quita nada a ninguna pantalla.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Policies PERMISIVAS que se suman con OR: se reescribe la ÚNICA policy
--     de SELECT de cada tabla (verificado contra pg_policies).
--   · `user_staff_school_ids()` = no parent/athlete; escritura y lectura
--     operativa. No se toca ninguna policy de escritura.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. Datos: forma y tope de slots / arrows / nombre ──────────────────────
ALTER TABLE public.team_tactical_presets
    ADD CONSTRAINT team_tactical_presets_slots_chk
        CHECK (jsonb_typeof(slots) = 'array' AND jsonb_array_length(slots) <= 40),
    ADD CONSTRAINT team_tactical_presets_arrows_chk
        CHECK (jsonb_typeof(arrows) = 'array' AND jsonb_array_length(arrows) <= 300),
    ADD CONSTRAINT team_tactical_presets_name_len_chk
        CHECK (length(btrim(name)) <= 80);

ALTER TABLE public.match_lineups
    ADD CONSTRAINT match_lineups_arrows_chk
        CHECK (jsonb_typeof(arrows) = 'array' AND jsonb_array_length(arrows) <= 300);

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_tactical_presets_team_situation_name
    ON public.team_tactical_presets (team_id, situation, lower(btrim(name)));

-- ─── 2. Lectura: de "cualquier miembro" a "quien trabaja en la escuela" ─────
DROP POLICY IF EXISTS "team_tactical_presets_select" ON public.team_tactical_presets;
CREATE POLICY "team_tactical_presets_select" ON public.team_tactical_presets
    FOR SELECT TO authenticated
    USING (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));

DROP POLICY IF EXISTS "match_lineups_select" ON public.match_lineups;
CREATE POLICY "match_lineups_select" ON public.match_lineups
    FOR SELECT
    USING (
        school_id = ANY (public.user_staff_school_ids())
        OR EXISTS (
            SELECT 1
              FROM public.match_lineup_players mlp
             WHERE mlp.lineup_id = match_lineups.id
               AND (
                    (mlp.subject_type = 'profile' AND mlp.subject_id = auth.uid())
                 OR (mlp.subject_type = 'child' AND public.is_parent_of_child(mlp.subject_id))
               )
        )
    );

DROP POLICY IF EXISTS "match_lineup_players_select" ON public.match_lineup_players;
CREATE POLICY "match_lineup_players_select" ON public.match_lineup_players
    FOR SELECT
    USING (
        school_id = ANY (public.user_staff_school_ids())
        OR (subject_type = 'profile' AND subject_id = auth.uid())
        OR (subject_type = 'child' AND public.is_parent_of_child(subject_id))
    );

DROP POLICY IF EXISTS "football_match_events_select" ON public.football_match_events;
CREATE POLICY "football_match_events_select" ON public.football_match_events
    FOR SELECT
    USING (
        school_id = ANY (public.user_staff_school_ids())
        OR (subject_type = 'profile' AND subject_id = auth.uid())
        OR (subject_type = 'child' AND public.is_parent_of_child(subject_id))
    );

COMMIT;

NOTIFY pgrst, 'reload schema';
