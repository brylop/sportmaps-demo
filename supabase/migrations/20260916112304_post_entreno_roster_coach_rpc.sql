-- =============================================================================
-- 20260916112304_post_entreno_roster_coach_rpc.sql
-- Autor: brylop   Fecha: 2026-09-16   Versión anterior: 20260916103807
-- Objetivo: fix de un bug real encontrado grabando el video de manual del
-- coach — docs/specs/evaluacion-post-entrenamiento.md
--
-- CoachPostTrainingRatingDialog.tsx consulta attendance_records directo con
-- el cliente (RLS del caller), embebiendo children(...) y profiles(...). Dos
-- problemas encontrados en vivo:
--
--   1. attendance_records.user_id referencia auth.users, no public.profiles
--      (schema preexistente, sin migración en este repo) — PostgREST no puede
--      resolver el embed profiles(...) y devuelve PGRST200 (400), tumbando la
--      consulta COMPLETA. El diálogo mostraba "0 de 0 calificados" siempre
--      que hubiera al menos un atleta con user_id (atleta adulto).
--
--   2. La policy de SELECT "Coaches can view attendance for their teams"
--      (preexistente, sin migración en este repo — deriva de la misma familia
--      de bugs que [[project_carmel_coach_teams]]: "coach_id de teams ≠
--      auth.uid()") compara team_coaches.coach_id = auth.uid(). Pero
--      team_coaches.coach_id es school_staff.id, NO el auth uid del coach
--      (confirmado contra submit_post_training_coach_rating, que sí resuelve
--      bien: school_staff.coach_auth_id = auth.uid() → team_coaches.coach_id
--      = ese school_staff.id). Resultado: NINGÚN coach asignado por
--      team_coaches (el modelo estándar multi-coach) puede leer
--      attendance_records de su propio equipo por RLS — el diálogo quedaba
--      en "0 de 0" incluso después de arreglar el embed.
--
-- La policy de RLS no se toca acá: corregirla es un cambio de blast radius
-- mayor (afecta cualquier lectura de attendance_records desde el cliente,
-- no solo este diálogo) que requiere medir el radio primero (CLAUDE.md).
-- Se resuelve puntual, para este flujo, con una RPC SECURITY DEFINER que
-- reutiliza EXACTAMENTE la misma verificación de autorización que ya usa
-- submit_post_training_coach_rating.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.get_post_training_pending_roster(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_session  record;
    v_coach_id uuid;
    v_result   jsonb;
BEGIN
    SELECT s.* INTO v_session FROM public.attendance_sessions s WHERE s.id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesión no encontrada.' USING ERRCODE = 'P0002';
    END IF;

    -- Misma verificación que submit_post_training_coach_rating: coach del
    -- equipo vía team_coaches, resolviendo school_staff.coach_auth_id.
    SELECT ss.id INTO v_coach_id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.school_id = v_session.school_id
       AND ss.status = 'active';

    IF v_coach_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.team_coaches tc
         WHERE tc.team_id = v_session.team_id AND tc.coach_id = v_coach_id
    ) THEN
        RAISE EXCEPTION 'No autorizado: no eres coach de este equipo.' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'child_id', ar.child_id,
               'user_id', ar.user_id,
               'full_name', COALESCE(c.full_name, p.full_name, 'Deportista'),
               'avatar_url', COALESCE(c.avatar_url, p.avatar_url)
           )), '[]'::jsonb)
      INTO v_result
      FROM public.attendance_records ar
      LEFT JOIN public.children c ON c.id = ar.child_id
      LEFT JOIN public.profiles p ON p.id = ar.user_id
     WHERE ar.session_id = p_session_id
       AND ar.status IN ('present', 'late');

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_post_training_pending_roster(uuid) IS
    'Roster de presentes/tarde de una sesión para el diálogo de rating del '
    'coach (CoachPostTrainingRatingDialog.tsx). SECURITY DEFINER: la query '
    'directa del cliente contra attendance_records fallaba en dos capas — '
    'embed roto a profiles (PGRST200) y policy de SELECT que compara '
    'team_coaches.coach_id (school_staff.id) contra auth.uid(). Misma '
    'verificación de autorización que submit_post_training_coach_rating.';

REVOKE ALL ON FUNCTION public.get_post_training_pending_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_post_training_pending_roster(uuid) TO authenticated;

COMMIT;
