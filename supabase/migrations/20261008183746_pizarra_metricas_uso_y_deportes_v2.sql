-- =============================================================================
-- 20261008183746_pizarra_metricas_uso_y_deportes_v2.sql
-- Reemplaza a 20261008155459_pizarra_metricas_uso_y_deportes.sql (NO aplicarla): sus policies usan
-- `x = ANY ((SELECT fn()))`, que Postgres lee como subconsulta y falla con 42883
-- «operator does not exist: uuid = uuid[]» (falló al aplicarla el 2026-10-08).
-- Único cambio: ANY ((SELECT public.<fn>())) → ANY ((SELECT public.<fn>())::uuid[]).
-- Mismo arreglo que 20261006104251 / 20261006104254.
-- =============================================================================

-- =============================================================================
-- 20261008155459_pizarra_metricas_uso_y_deportes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008155457
-- Objetivo: T0 de docs/specs/pizarra-nivel-tacticalpad.md — métrica de uso de la
--   pizarra táctica (abrir, guardar, reproducir, exportar, compartir, biblioteca,
--   cuadros) para decidir T5-T7 con datos. La regla de T7 (vista 3D) es:
--   ≥20 aperturas/semana, ≥3 escuelas y ≥5 coaches.
--
--   · tactical_board_events: una fila por evento. RLS sin policies de escritura:
--     el único camino de INSERT es la RPC log_tactical_board_event.
--   · log_tactical_board_event: SECURITY DEFINER, exige que el caller sea STAFF
--     de la escuela (user_staff_school_ids(); padres y atletas no registran).
--     Antirrebote: ignora el mismo usuario+evento+equipo dentro de 10 s.
--   · v_tactical_board_usage_weekly (security_invoker): resumen semanal con las
--     columnas del gate de T7. Respeta la RLS de la tabla: un admin ve sus
--     escuelas; el super admin ve el total (el número que decide T7).
--
--   T4 (deportes): NO hay objeto de BD para deportes en esta migración. El deporte
--   se deriva en el cliente (lib/school/tacticalSports.ts) a partir de
--   teams.sport, que hoy es texto libre ("Fútbol", "Voleibol", "Baloncesto"…, 26
--   valores distintos en vivo) y por eso NO se le pone CHECK ahí. En esta tabla
--   `sport` guarda la clave del catálogo del cliente (p. ej. 'football11',
--   'futsal', 'volleyball'); se acota solo por largo para que no sea un vertedero.
--   Si el catálogo se cierra, el CHECK de valores va en una migración nueva.
--
--   Helpers verificados vivos en pg_proc (2026-10-08): user_staff_school_ids(),
--   user_admin_school_ids(), is_super_admin(). No existían objetos con los
--   nombres tactical_board_events / log_tactical_board_event /
--   v_tactical_board_usage_weekly.
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

-- -----------------------------------------------------------------------------
-- 1. Tabla de eventos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tactical_board_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id     uuid        REFERENCES public.teams(id) ON DELETE SET NULL,
  event       text        NOT NULL,
  source_type text,
  sport       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_board_events_event_check CHECK (event IN (
    'open', 'save', 'play', 'export_png', 'export_pdf', 'export_video',
    'share', 'library_save', 'library_insert', 'frame_add'
  )),
  CONSTRAINT tactical_board_events_source_type_len CHECK (source_type IS NULL OR char_length(source_type) <= 40),
  CONSTRAINT tactical_board_events_sport_len       CHECK (sport IS NULL OR char_length(sport) <= 40)
);

COMMENT ON TABLE public.tactical_board_events IS
  'T0 pizarra táctica: métrica de uso. INSERT solo vía RPC log_tactical_board_event. Spec: docs/specs/pizarra-nivel-tacticalpad.md';
COMMENT ON COLUMN public.tactical_board_events.sport IS
  'Clave del catálogo de deportes del cliente (lib/school/tacticalSports.ts), no teams.sport crudo.';

-- Resumen semanal por escuela y antirrebote de la RPC.
CREATE INDEX IF NOT EXISTS tactical_board_events_school_created_idx
  ON public.tactical_board_events (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tactical_board_events_user_event_created_idx
  ON public.tactical_board_events (user_id, event, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. RLS: solo lectura para admin de la escuela y super admin. Sin policies de
--    INSERT/UPDATE/DELETE: con RLS activa, authenticated no puede escribir directo.
-- -----------------------------------------------------------------------------
ALTER TABLE public.tactical_board_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tactical_board_events FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_board_events FROM authenticated;
GRANT SELECT ON public.tactical_board_events TO authenticated;

DROP POLICY IF EXISTS tactical_board_events_select_admin ON public.tactical_board_events;
CREATE POLICY tactical_board_events_select_admin
  ON public.tactical_board_events
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- 3. RPC de registro
--    Devuelve true si insertó; false si se ignoró (sin sesión, no es staff,
--    evento desconocido o antirrebote). No lanza: el cliente es fire-and-forget
--    y no tiene sentido llenar los logs con errores de una métrica.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_tactical_board_event(
  p_school_id   uuid,
  p_event       text,
  p_team_id     uuid DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_sport       text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_team uuid := p_team_id;
BEGIN
  IF v_uid IS NULL OR p_school_id IS NULL OR p_event IS NULL THEN
    RETURN false;
  END IF;

  IF p_event NOT IN ('open', 'save', 'play', 'export_png', 'export_pdf', 'export_video',
                     'share', 'library_save', 'library_insert', 'frame_add') THEN
    RETURN false;
  END IF;

  -- Solo quien TRABAJA en la escuela (sin padres ni atletas).
  IF NOT (p_school_id = ANY (public.user_staff_school_ids())) THEN
    RETURN false;
  END IF;

  -- Un equipo de otra escuela no se registra (se guarda el evento sin equipo).
  IF v_team IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = v_team AND t.school_id = p_school_id
  ) THEN
    v_team := NULL;
  END IF;

  -- Antirrebote: mismo usuario + evento + equipo dentro de 10 s.
  IF EXISTS (
    SELECT 1
      FROM public.tactical_board_events e
     WHERE e.user_id = v_uid
       AND e.event = p_event
       AND e.team_id IS NOT DISTINCT FROM v_team
       AND e.created_at > now() - interval '10 seconds'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.tactical_board_events (school_id, user_id, team_id, event, source_type, sport)
  VALUES (
    p_school_id,
    v_uid,
    v_team,
    p_event,
    left(nullif(btrim(p_source_type), ''), 40),
    left(nullif(btrim(p_sport), ''), 40)
  );

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) IS
  'T0 pizarra: registra un evento de uso. Exige staff de la escuela; antirrebote 10 s por usuario+evento+equipo.';

-- Los default privileges del esquema dan EXECUTE a authenticated/anon: revocar explícito.
REVOKE ALL ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Vista semanal + gate de T7
--    security_invoker: hereda la RLS de la tabla (admin ve sus escuelas; el
--    gate global solo es significativo para el super admin). Semana ISO (lunes)
--    en hora de Colombia.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_tactical_board_usage_weekly
WITH (security_invoker = true)
AS
SELECT
  (date_trunc('week', e.created_at AT TIME ZONE 'America/Bogota'))::date AS week,
  count(DISTINCT e.school_id)                                             AS schools,
  count(DISTINCT e.user_id)                                               AS coaches,
  count(*) FILTER (WHERE e.event = 'open')                                AS opens,
  count(*) FILTER (WHERE e.event = 'save')                                AS saves,
  count(*) FILTER (WHERE e.event = 'play')                                AS plays,
  count(*) FILTER (WHERE e.event IN ('export_png', 'export_pdf', 'export_video')) AS exports,
  count(*) FILTER (WHERE e.event = 'share')                               AS shares,
  count(*) FILTER (WHERE e.event IN ('library_save', 'library_insert'))   AS library_uses,
  -- Gate de T7 (vista 3D): ≥20 aperturas/semana, ≥3 escuelas, ≥5 coaches.
  (count(*) FILTER (WHERE e.event = 'open') >= 20)                        AS gate_opens_ok,
  (count(DISTINCT e.school_id) >= 3)                                      AS gate_schools_ok,
  (count(DISTINCT e.user_id) >= 5)                                        AS gate_coaches_ok,
  (    count(*) FILTER (WHERE e.event = 'open') >= 20
   AND count(DISTINCT e.school_id) >= 3
   AND count(DISTINCT e.user_id) >= 5)                                    AS t7_gate_met
FROM public.tactical_board_events e
GROUP BY 1;

COMMENT ON VIEW public.v_tactical_board_usage_weekly IS
  'T0 pizarra: uso semanal y gate de T7 (≥20 aperturas, ≥3 escuelas, ≥5 coaches). security_invoker: respeta la RLS de tactical_board_events.';

REVOKE ALL ON public.v_tactical_board_usage_weekly FROM PUBLIC, anon;
GRANT SELECT ON public.v_tactical_board_usage_weekly TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación post-aplicación (manual):
--   select cmd, policyname, roles, qual, with_check from pg_policies where tablename = 'tactical_board_events';
--   select proacl, proconfig from pg_proc where proname = 'log_tactical_board_event';
--   set local role anon; select count(*) from public.tactical_board_events;   -- debe fallar (permission denied)
--   npm run seguridad:invariantes
-- -----------------------------------------------------------------------------
