-- =============================================================================
-- 20260827190429_clases_de_prueba_revoke_anon.sql
-- Autor: judegor99   Fecha: 2026-08-28   Versión anterior: 20260827184021
-- Objetivo: hardening post-deploy de las RPCs de "Agenda de Clases de Prueba"
--   (20260827184021_clases_de_prueba_agenda.sql). get_advisors (security)
--   reportó las 4 funciones como ejecutables por `anon` además de
--   `authenticated` — los default privileges de este proyecto conceden
--   EXECUTE a anon en cada función nueva (gotcha documentado en CLAUDE.md
--   §"GRANT EXECUTE": "REVOKE ALL FROM PUBLIC no alcanza"). No son
--   explotables (cada una corta con is_school_admin() -> RAISE EXCEPTION si
--   no hay sesión válida), pero se cierra la superficie igual.
-- =============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.trial_class_save_settings(uuid, boolean, numeric, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trial_class_get_joint_slots(uuid, uuid, uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trial_class_create_booking(uuid, uuid, uuid, date, time, time, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trial_class_update_status(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.trial_class_save_settings(uuid, boolean, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_get_joint_slots(uuid, uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_create_booking(uuid, uuid, uuid, date, time, time, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_update_status(uuid, text, text) TO authenticated;

COMMIT;
