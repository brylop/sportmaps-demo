-- =============================================================================
-- 20260918130753_post_entreno_roster_incluye_no_registrados.sql
-- Autor: brylop   Fecha: 2026-09-18   Versión anterior: 20260918130622
-- Objetivo: get_post_training_pending_roster (20260916112304) no cruza
--   attendance_records.unregistered_athlete_id contra public.unregistered_
--   athletes. Toda atleta sin cuenta (ficha cargada por la escuela, sin
--   child_id ni user_id) llegaba con full_name NULL → caía al fallback
--   'Deportista', y como CoachPostTrainingRatingDialog.tsx usa
--   `child_id ?? user_id` como key, TODAS esas filas colapsaban bajo la misma
--   key undefined: solo se veía una tarjeta "Deportista" en vez de una por
--   cada atleta sin cuenta. Reportado en Besser (Duvan Daza, prejuvenil
--   femenino): Ana Moyano, Victoria Briceño y Sara Pimiento no aparecían al
--   evaluar el entreno.
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
               'unregistered_athlete_id', ar.unregistered_athlete_id,
               'full_name', COALESCE(c.full_name, p.full_name, u.full_name, 'Deportista'),
               'avatar_url', COALESCE(c.avatar_url, p.avatar_url)
           )), '[]'::jsonb)
      INTO v_result
      FROM public.attendance_records ar
      LEFT JOIN public.children c ON c.id = ar.child_id
      LEFT JOIN public.profiles p ON p.id = ar.user_id
      LEFT JOIN public.unregistered_athletes u ON u.id = ar.unregistered_athlete_id
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
    'verificación de autorización que submit_post_training_coach_rating. '
    'Incluye unregistered_athletes: atletas sin cuenta también deben salir '
    'con su nombre real, no colapsados bajo "Deportista".';

REVOKE ALL ON FUNCTION public.get_post_training_pending_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_post_training_pending_roster(uuid) TO authenticated;

COMMIT;
