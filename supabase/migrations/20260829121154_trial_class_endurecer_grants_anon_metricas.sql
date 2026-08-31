-- =============================================================================
-- 20260829121154_trial_class_endurecer_grants_anon.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260829120423
-- Objetivo: hallazgo real, verificado en vivo tras aplicar 20260829115629 —
--   la versión de 4 parámetros de trial_class_self_has_active_plan (la que
--   agrega p_unregistered_athlete_id) quedó con EXECUTE para `anon` y
--   `authenticated` (proacl confirmado con pg_proc.proacl), pese a que esa
--   misma migración incluía un REVOKE explícito para esa firma exacta.
--
--   No se pudo determinar la causa raíz con certeza (no hay forma de
--   inspeccionar el historial de privilegios desde acá) — puede ser un
--   default privilege del esquema aplicándose después del REVOKE, o algo
--   específico de cómo se ejecutó esa migración. Lo que sí se verificó: el
--   resto de las ~19 funciones trial_class_* creadas/tocadas en esta sesión
--   SÍ quedaron correctamente restringidas a service_role — este fue un
--   caso aislado, encontrado por una re-verificación de rutina después de
--   aplicar 20260829120423, no por sospecha de algo puntual.
--
--   Riesgo real mientras estuvo expuesta: un anónimo podía llamar
--   /rest/v1/rpc/trial_class_self_has_active_plan con cualquier
--   child_id/user_id/unregistered_athlete_id y aprender si esa persona
--   tiene un plan real activo en una escuela — fuga de membresía, sin
--   escritura de por medio. Ya cerrado a mano en la base antes de esta
--   migración (verificado con has_function_privilege); esta migración deja
--   el cierre con rastro en el repo, mismo patrón que SEG-21.
--
--   Se revoca explícito TAMBIÉN a la versión de 3 parámetros — ya estaba
--   bien, pero es la misma función y merece quedar documentada junto a su
--   hermana en esta migración de endurecimiento.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · REVOKE a los TRES: PUBLIC, anon y authenticated — son grants
--     independientes, revocar uno deja vivos los otros (SEG-3).
-- =============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.trial_class_self_has_active_plan(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_has_active_plan(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.trial_class_self_has_active_plan(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_has_active_plan(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;
