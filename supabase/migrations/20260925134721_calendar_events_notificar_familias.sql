-- =============================================================================
-- 20260925134721_calendar_events_notificar_familias.sql
-- Autor: brylop   Fecha: 2026-09-25   Versión anterior: 20260924111620
-- Objetivo: avisar a las familias cuando la escuela o el entrenador publica,
--           cambia o cancela algo en el calendario (entrenamiento, partido,
--           competencia, reunión, evaluación, taller). Hasta hoy el evento se
--           guardaba y nadie se enteraba: ni in-app, ni push. Pedido de
--           Athletic League (2026-09-25): "toda notificación de información
--           debe llegar, todo lo que haga la escuela o los entrenadores".
-- =============================================================================
-- Cómo funciona:
--   · Trigger AFTER INSERT/UPDATE/DELETE en calendar_events. Solo eventos con
--     school_id (para un equipo o para toda la escuela). Lo privado no avisa y
--     las reuniones de staff tampoco (no son para las familias).
--   · Destinatarios = la misma noción de "familia" que usa la RLS de lectura
--     (calendar_family_team_ids / calendar_family_school_ids), pero al revés:
--     dado el equipo (o la escuela) → adultos inscritos, acudientes de menores
--     inscritos o con equipo en la ficha, y para eventos de toda la escuela
--     también los school_members parent/athlete activos. Nunca el creador.
--   · Escribe en public.notifications con category='calendar': de ahí lo toma
--     el bell in-app (Realtime) y el despachador de push (trigger
--     enqueue_notification_delivery). No manda correo ni WhatsApp.
--   · En UPDATE solo avisa si cambió fecha, hora, lugar, título o destino.
--   · Cualquier fallo del aviso se registra con WARNING y NO bloquea la agenda.
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- 1. Categoría nueva para el despachador. El CHECK vivo es una lista cerrada:
--    sin esto el INSERT del trigger rompería con 23514.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check
  CHECK (category = ANY (ARRAY[
    'payment','installment','glosa','enrollment','access','qr','marketplace',
    'equipment','system','support','tournament','post_training','calendar'
  ]));

-- 2. A quién le importa un evento de un equipo (o de toda la escuela).
CREATE OR REPLACE FUNCTION public.calendar_event_recipients(
  p_school_id uuid,
  p_team_id   uuid,
  p_exclude   uuid
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT DISTINCT r.uid
  FROM (
    -- Adultos inscritos en el equipo (o en la escuela, si es para todos).
    SELECT e.user_id AS uid
      FROM public.enrollments e
     WHERE e.status IN ('active', 'pending', 'paused')
       AND e.user_id IS NOT NULL
       AND ((p_team_id IS NOT NULL AND e.team_id = p_team_id)
            OR (p_team_id IS NULL AND e.school_id = p_school_id))
    UNION
    -- Acudientes de menores inscritos.
    SELECT c.parent_id
      FROM public.enrollments e
      JOIN public.children c ON c.id = e.child_id
     WHERE e.status IN ('active', 'pending', 'paused')
       AND c.parent_id IS NOT NULL
       AND ((p_team_id IS NOT NULL AND e.team_id = p_team_id)
            OR (p_team_id IS NULL AND e.school_id = p_school_id))
    UNION
    -- Acudientes de menores con equipo/escuela en la ficha, sin inscripción formal.
    SELECT c.parent_id
      FROM public.children c
     WHERE c.is_active
       AND c.parent_id IS NOT NULL
       AND ((p_team_id IS NOT NULL AND c.team_id = p_team_id)
            OR (p_team_id IS NULL AND c.school_id = p_school_id))
    UNION
    -- Para toda la escuela: cualquier familia miembro activa.
    SELECT sm.profile_id
      FROM public.school_members sm
     WHERE p_team_id IS NULL
       AND sm.school_id = p_school_id
       AND sm.status = 'active'
       AND sm.role IN ('parent', 'athlete')
  ) r
  WHERE r.uid IS NOT NULL
    AND r.uid IS DISTINCT FROM p_exclude;
$$;

-- Solo la llama el trigger (definer). Los default privileges le darían EXECUTE
-- a authenticated: se revoca explícito (CLAUDE.md, trampa 3).
REVOKE ALL ON FUNCTION public.calendar_event_recipients(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 3. El aviso.
CREATE OR REPLACE FUNCTION public.fn_notify_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row     public.calendar_events;
  v_school  text;
  v_team    text;
  v_tipo    text;
  v_cuando  text;
  v_titulo  text;
  v_mensaje text;
  v_op      text;
  v_destino text;
  v_lugar   text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  -- Lo privado (sin escuela) no avisa; las reuniones de staff no son para familias.
  IF v_row.school_id IS NULL OR v_row.event_type = 'staff_meeting' THEN
    RETURN NULL;
  END IF;

  -- En UPDATE solo si cambió algo que a la familia le importa.
  IF TG_OP = 'UPDATE'
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.end_time   IS NOT DISTINCT FROM OLD.end_time
     AND NEW.location   IS NOT DISTINCT FROM OLD.location
     AND NEW.title      IS NOT DISTINCT FROM OLD.title
     AND NEW.team_id    IS NOT DISTINCT FROM OLD.team_id
     AND NEW.school_id  IS NOT DISTINCT FROM OLD.school_id THEN
    RETURN NULL;
  END IF;

  BEGIN
    SELECT btrim(name) INTO v_school FROM public.schools WHERE id = v_row.school_id;
    IF v_row.team_id IS NOT NULL THEN
      SELECT btrim(name) INTO v_team FROM public.teams WHERE id = v_row.team_id;
    END IF;
    v_destino := COALESCE(v_team, 'toda la escuela');
    v_lugar   := NULLIF(btrim(COALESCE(v_row.location, '')), '');

    v_tipo := CASE v_row.event_type
      WHEN 'training'    THEN 'entrenamiento'
      WHEN 'match'       THEN 'partido'
      WHEN 'competition' THEN 'competencia'
      WHEN 'meeting'     THEN 'reunión'
      WHEN 'evaluation'  THEN 'evaluación'
      WHEN 'workshop'    THEN 'taller'
      ELSE 'evento'
    END;

    v_cuando := to_char(v_row.start_time AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY')
      || CASE
           WHEN COALESCE(v_row.all_day, false) THEN ' (todo el día)'
           ELSE ' de ' || to_char(v_row.start_time AT TIME ZONE 'America/Bogota', 'HH24:MI')
             || ' a '  || to_char(v_row.end_time   AT TIME ZONE 'America/Bogota', 'HH24:MI')
         END;

    IF TG_OP = 'INSERT' THEN
      v_op := 'created';
      v_titulo  := '📅 ' || CASE WHEN v_tipo IN ('competencia', 'reunión', 'evaluación') THEN 'Nueva ' ELSE 'Nuevo ' END
                   || v_tipo || COALESCE(': ' || NULLIF(btrim(v_row.title), ''), '');
      v_mensaje := v_school || ' · ' || v_destino || ': ' || v_tipo
                   || COALESCE(' «' || NULLIF(btrim(v_row.title), '') || '»', '')
                   || ' el ' || v_cuando
                   || COALESCE(', en ' || v_lugar, '') || '.';
    ELSIF TG_OP = 'UPDATE' THEN
      v_op := 'updated';
      v_titulo  := '📅 Cambio en ' || v_tipo || COALESCE(': ' || NULLIF(btrim(v_row.title), ''), '');
      v_mensaje := v_school || ' · ' || v_destino || ': ' || v_tipo
                   || COALESCE(' «' || NULLIF(btrim(v_row.title), '') || '»', '')
                   || ' ahora es el ' || v_cuando
                   || COALESCE(', en ' || v_lugar, '') || '.';
    ELSE
      v_op := 'cancelled';
      v_titulo  := '📅 Cancelado: ' || v_tipo || COALESCE(' ' || NULLIF(btrim(v_row.title), ''), '');
      v_mensaje := v_school || ' · ' || v_destino || ': se canceló ' || v_tipo
                   || COALESCE(' «' || NULLIF(btrim(v_row.title), '') || '»', '')
                   || ' que era el ' || v_cuando || '.';
    END IF;

    INSERT INTO public.notifications (user_id, school_id, type, category, title, message, link, data)
    SELECT r, v_row.school_id, 'info', 'calendar', v_titulo, v_mensaje, '/calendar',
           jsonb_build_object('event_id', v_row.id, 'team_id', v_row.team_id, 'op', v_op,
                              'start_time', v_row.start_time, 'event_type', v_row.event_type)
      FROM public.calendar_event_recipients(v_row.school_id, v_row.team_id, v_row.user_id) AS r;
  EXCEPTION WHEN OTHERS THEN
    -- Nunca bloquear la agenda por un aviso: queda en el log y se sigue.
    RAISE WARNING '[calendar_events] aviso a familias falló en % (%): %', TG_OP, v_row.id, SQLERRM;
  END;

  RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora.
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_calendar_event ON public.calendar_events;
CREATE TRIGGER trg_notify_calendar_event
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_calendar_event();

COMMIT;

-- Verificación:
--   select tgname, tgenabled from pg_trigger where tgname = 'trg_notify_calendar_event';
--   select proacl from pg_proc where proname = 'calendar_event_recipients';   -- sin authenticated
--   -- crear un evento de equipo desde la app y mirar public.notifications
--   -- where category = 'calendar' order by created_at desc;
