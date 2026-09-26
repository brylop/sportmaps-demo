-- =============================================================================
-- 20260925170001_metricas_futbol_rls_fixes.sql
-- Autor: judegor99   Fecha: 2026-09-25   Versión anterior: 20260925140545
-- Objetivo: cierra 3 hallazgos de la auditoría de "Métricas y Rendimiento"
-- (mesociclos/sesiones/tablero táctico/resultados de fútbol):
--   1. match_lineups_insert/update tenían "OR created_by = auth.uid()" -- ese
--      término lo satisface CUALQUIER usuario autenticado (created_by es un
--      valor que el propio cliente manda), así que el check de
--      user_staff_school_ids() quedaba anulado: cualquier cuenta con sesión
--      válida -- de cualquier escuela, incluso un padre o atleta -- podía
--      crear una fila de match_lineups para el equipo que quisiera. El BFF
--      siempre manda created_by = user.id, ese OR no protegía nada real.
--   2. anon seguía con INSERT/UPDATE/DELETE/SELECT en 5 tablas de antes del
--      cierre SEG-23 (que no fue retroactivo): match_results, match_lineups,
--      match_lineup_players, football_match_events, training_sessions. RLS
--      ya bloquea a anon (todo depende de auth.uid(), NULL sin sesión), pero
--      no debería depender solo de eso.
--   3. El BFF (bff/src/routes/school/football.ts, TACTICAL_EDIT_ROLES) ya
--      documentaba la intención real: "Editar el tablero táctico (alineación,
--      plantillas guardadas, flechas) es SOLO de owner/coach" -- pero RLS
--      usaba user_staff_school_ids(), que TAMBIÉN deja pasar a admin/
--      school_admin/staff. Un admin no puede tocar táctica por la UI (el BFF
--      lo bloquea) pero una escritura directa contra Supabase sí lo dejaría
--      -- RLS no reflejaba la regla real. Se agrega una función de alcance
--      nueva, angosta, para las 4 tablas de táctica (match_lineups,
--      match_lineup_players, football_match_events, team_tactical_presets),
--      espejo exacto de TACTICAL_EDIT_ROLES.
--
-- No toca match_results_delete/training_plans_delete (excluyen a 'coach' a
-- propósito, a diferencia de insert/update) -- ese hueco es de UI (el botón
-- de borrar no se ocultaba para coach), se corrige en el frontend, no acá.
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

-- ─── 1. Función de alcance para edición de táctica ──────────────────────────
-- Espejo de user_staff_school_ids() (20260812182000) pero angosta a
-- owner/coach/super_admin -- calca TACTICAL_EDIT_ROLES del BFF. Un coach sin
-- fila en school_members (solo school_staff) sigue entrando por las mismas
-- 3 uniones que ya usa user_staff_school_ids(): son coaches por definición,
-- no hace falta filtrarlos por rol.
CREATE OR REPLACE FUNCTION public.user_tactical_edit_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT COALESCE(ARRAY(
    SELECT sm.school_id
      FROM public.school_members sm
     WHERE sm.profile_id = auth.uid()
       AND sm.status = 'active'
       AND sm.role IN ('owner', 'coach', 'super_admin')
    UNION
    SELECT ss.school_id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.status = 'active'
    UNION
    SELECT ss.school_id
      FROM public.school_staff ss
      JOIN auth.users au ON LOWER(au.email) = LOWER(ss.email)
     WHERE au.id = auth.uid()
       AND ss.coach_auth_id IS NULL
       AND ss.status = 'active'
    UNION
    SELECT s.id
      FROM public.schools s
     WHERE s.owner_id = auth.uid()
  ), '{}'::uuid[]);
$function$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.user_tactical_edit_school_ids() TO authenticated;
    END IF;
END $$;

-- ─── 2. match_lineups: sacar el bypass, angostar a edición de táctica ───────
DROP POLICY IF EXISTS "match_lineups_insert" ON public.match_lineups;
CREATE POLICY "match_lineups_insert" ON public.match_lineups
    FOR INSERT WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS "match_lineups_update" ON public.match_lineups;
CREATE POLICY "match_lineups_update" ON public.match_lineups
    FOR UPDATE USING (school_id = ANY (public.user_tactical_edit_school_ids()))
    WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS "match_lineups_delete" ON public.match_lineups;
CREATE POLICY "match_lineups_delete" ON public.match_lineups
    FOR DELETE USING (school_id = ANY (public.user_tactical_edit_school_ids()));

-- ─── 3. match_lineup_players: mismo angostamiento ───────────────────────────
DROP POLICY IF EXISTS "match_lineup_players_insert" ON public.match_lineup_players;
CREATE POLICY "match_lineup_players_insert" ON public.match_lineup_players
    FOR INSERT WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS "match_lineup_players_update" ON public.match_lineup_players;
CREATE POLICY "match_lineup_players_update" ON public.match_lineup_players
    FOR UPDATE USING (school_id = ANY (public.user_tactical_edit_school_ids()))
    WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS "match_lineup_players_delete" ON public.match_lineup_players;
CREATE POLICY "match_lineup_players_delete" ON public.match_lineup_players
    FOR DELETE USING (school_id = ANY (public.user_tactical_edit_school_ids()));

-- ─── 4. football_match_events: mismo angostamiento ──────────────────────────
DROP POLICY IF EXISTS "football_match_events_insert" ON public.football_match_events;
CREATE POLICY "football_match_events_insert" ON public.football_match_events
    FOR INSERT WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS "football_match_events_update" ON public.football_match_events;
CREATE POLICY "football_match_events_update" ON public.football_match_events
    FOR UPDATE USING (school_id = ANY (public.user_tactical_edit_school_ids()))
    WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS "football_match_events_delete" ON public.football_match_events;
CREATE POLICY "football_match_events_delete" ON public.football_match_events
    FOR DELETE USING (school_id = ANY (public.user_tactical_edit_school_ids()));

-- ─── 5. team_tactical_presets: mismo angostamiento ──────────────────────────
DROP POLICY IF EXISTS "team_tactical_presets_insert" ON public.team_tactical_presets;
CREATE POLICY "team_tactical_presets_insert" ON public.team_tactical_presets
    FOR INSERT WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS "team_tactical_presets_update" ON public.team_tactical_presets;
CREATE POLICY "team_tactical_presets_update" ON public.team_tactical_presets
    FOR UPDATE USING (school_id = ANY (public.user_tactical_edit_school_ids()))
    WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS "team_tactical_presets_delete" ON public.team_tactical_presets;
CREATE POLICY "team_tactical_presets_delete" ON public.team_tactical_presets
    FOR DELETE USING (school_id = ANY (public.user_tactical_edit_school_ids()));

-- ─── 6. match_results_admin_all: I3 -- FOR ALL sin WITH CHECK ───────────────
-- El USING ya era seguro para INSERT (referencia team_id -> school_id, no una
-- columna del usuario), pero dejarlo explícito es lo que pide el invariante
-- I3 y lo que ya hacen el resto de policies de esta tabla.
ALTER POLICY "match_results_admin_all" ON public.match_results
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.teams
         WHERE teams.id = match_results.team_id
           AND public.is_school_admin(teams.school_id)
    ));

-- ─── 7. Revocar el GRANT a anon que quedó de antes de SEG-23 ────────────────
-- No retroactivo cuando se cerró (2026-08-31, ver memoria del proyecto) --
-- estas 5 tablas son de 2026-08-12/28, antes de ese default privilege fix.
-- RLS ya bloquea a anon hoy (todo depende de auth.uid()), esto es la red de
-- seguridad que no debería faltar igual.
REVOKE ALL ON public.match_results FROM anon;
REVOKE ALL ON public.match_lineups FROM anon;
REVOKE ALL ON public.match_lineup_players FROM anon;
REVOKE ALL ON public.football_match_events FROM anon;
REVOKE ALL ON public.training_sessions FROM anon;

COMMIT;
