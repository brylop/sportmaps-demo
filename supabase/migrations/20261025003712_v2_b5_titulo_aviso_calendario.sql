-- =============================================================================
-- 20261025003712_v2_b5_titulo_aviso_calendario.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261025003708
-- Objetivo: B5 del contrato docs/specs/entrenador-deportista-v2.md — el aviso
--           de calendario decía «📅 Nuevo entrenamiento: PARTIDO LIGA
--           PREJUVENIL». Debe decir el tipo REAL del evento.
--
-- Causa (medida en la base viva, 2026-10-25): fn_notify_calendar_event
-- (20260925134721) arma el título desde calendar_events.event_type, y el
-- evento quedó guardado como 'training' aunque es un partido. Hay 95 eventos
-- 'training' y 4 de ellos tienen título de partido/torneo/liga; 'competition'
-- (14) y 'match' (10) sí se nombran bien. El dato mal tipado viene del
-- formulario de calendario (tipo por defecto «entrenamiento»), que NO es de
-- este agente (CalendarPage.tsx es de la sesión principal): queda anotado.
--
-- Arreglo (solo la función del trigger, mismo trigger, misma firma):
--   1. Si event_type es genérico ('training' u 'other') y el TÍTULO dice qué es,
--      manda el título: partido / amistoso / «vs» → partido; torneo / copa /
--      liga / festival / competencia → competencia; reunión → reunión;
--      evaluación / prueba → evaluación; taller → taller. Un 'match' o
--      'competition' guardado bien no se reinterpreta.
--   2. Si el título ya empieza con la palabra del tipo, no se repite:
--      «📅 Nuevo partido: LIGA PREJUVENIL» en vez de «… partido: PARTIDO LIGA …»,
--      «📅 Nueva reunión de padres», «📅 Nuevo partido vs Monster».
--   (Cancelado pasa de «📅 Cancelado: entrenamiento X» a «📅 Cancelado: entrenamiento: X».)
--   3. data.event_type sigue siendo el valor guardado; se agrega data.tipo_aviso
--      con el tipo inferido (para el frontend).
--   Lo demás (destinatarios, cuándo avisa, mensajes) queda igual al cuerpo vivo,
--   verificado contra pg_proc el 2026-10-25.
--
-- RADIO: solo avisos FUTUROS (INSERT/UPDATE/DELETE de calendar_events). Ninguna
-- fila existente cambia. 4 eventos de la base cambiarían de título si se
-- re-editaran.
--
-- VERIFICACIÓN (después de aplicar; ver también el informe del agente):
--   select public._calendar_event_kind('training', 'PARTIDO LIGA PREJUVENIL');   -- partido
--   select public._calendar_event_kind('match', 'Entreno previo');              -- partido
--   select public._calendar_event_kind('training', 'Entreno de técnica');       -- entrenamiento
--
-- REVERSA: re-crear public.fn_notify_calendar_event con el cuerpo de
--   20260925134721 (§3) tal cual y DROP FUNCTION public._calendar_event_kind(text, text).
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

-- ─── 1. El tipo que se le dice a la familia ─────────────────────────────────
CREATE OR REPLACE FUNCTION public._calendar_event_kind(p_event_type text, p_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH t AS (
    SELECT lower(translate(COALESCE(p_title, ''), 'ÁÉÍÓÚáéíóúÜü', 'AEIOUaeiouUu')) AS s
  )
  SELECT CASE
    WHEN p_event_type = 'match'       THEN 'partido'
    WHEN p_event_type = 'competition' THEN 'competencia'
    WHEN p_event_type = 'meeting'     THEN 'reunión'
    WHEN p_event_type = 'evaluation'  THEN 'evaluación'
    WHEN p_event_type = 'workshop'    THEN 'taller'
    WHEN p_event_type IN ('training', 'other') OR p_event_type IS NULL THEN
      CASE
        WHEN t.s ~ '(^|[^a-z])(partidos?|amistosos?|juegos?)([^a-z]|$)' OR t.s ~ '(^|[^a-z])vs\.?([^a-z]|$)' THEN 'partido'
        WHEN t.s ~ '(^|[^a-z])(torneos?|copas?|ligas?|festival(es)?|competencias?|campeonatos?|interclubes)([^a-z]|$)' THEN 'competencia'
        WHEN t.s ~ '(^|[^a-z])(reunion(es)?|asambleas?)([^a-z]|$)'  THEN 'reunión'
        WHEN t.s ~ '(^|[^a-z])(evaluacion(es)?|pruebas?)([^a-z]|$)' THEN 'evaluación'
        WHEN t.s ~ '(^|[^a-z])talle(r|res)([^a-z]|$)'               THEN 'taller'
        WHEN p_event_type = 'training'                       THEN 'entrenamiento'
        ELSE 'evento'
      END
    ELSE 'evento'
  END
  FROM t;
$$;
COMMENT ON FUNCTION public._calendar_event_kind(text, text) IS
  'Tipo de evento para el aviso a familias. Un training/other cuyo título dice partido, '
  'torneo, reunión… se nombra por el título (B5 V2).';
-- Función pura sin datos; solo la usa el trigger. Se cierra igual (trampa 3).
REVOKE ALL ON FUNCTION public._calendar_event_kind(text, text) FROM PUBLIC, anon, authenticated;

-- ─── 2. El aviso ────────────────────────────────────────────────────────────
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
  v_nombre  text;
  v_resto   text;
  v_frase   text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  IF v_row.school_id IS NULL OR v_row.event_type = 'staff_meeting' THEN
    RETURN NULL;
  END IF;

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

    -- B5: el tipo real (el título manda si el event_type es genérico).
    v_tipo := public._calendar_event_kind(v_row.event_type, v_row.title);

    -- La frase «tipo + nombre» sin repetir la palabra del tipo:
    --   «PARTIDO LIGA PREJUVENIL» → «partido: LIGA PREJUVENIL»
    --   «Partido vs Monster»      → «partido vs Monster»
    --   «Reunión de padres»       → «reunión de padres»
    --   «Copa Ciudad» (training)  → «competencia: Copa Ciudad»
    v_nombre := NULLIF(btrim(v_row.title), '');
    v_frase  := v_tipo || COALESCE(': ' || v_nombre, '');
    IF v_nombre IS NOT NULL
       AND lower(translate(v_nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'))
           ~ ('^' || translate(v_tipo, 'áéíóú', 'aeiou') || '([^a-z]|$)') THEN
      v_resto := btrim(substr(v_nombre, char_length(v_tipo) + 1));
      IF lower(v_resto) ~ '^(de|del|con|para|en|vs\.?|a|al|y|contra|frente)([^a-z]|$)' THEN
        v_frase := v_tipo || ' ' || v_resto;
      ELSE
        v_resto := NULLIF(btrim(regexp_replace(v_resto, '^[\s:\-–·]+', '')), '');
        v_frase := v_tipo || COALESCE(': ' || v_resto, '');
      END IF;
    END IF;

    v_cuando := to_char(v_row.start_time AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY')
      || CASE
           WHEN COALESCE(v_row.all_day, false) THEN ' (todo el día)'
           ELSE ' de ' || to_char(v_row.start_time AT TIME ZONE 'America/Bogota', 'HH24:MI')
             || ' a '  || to_char(v_row.end_time   AT TIME ZONE 'America/Bogota', 'HH24:MI')
         END;

    IF TG_OP = 'INSERT' THEN
      v_op := 'created';
      v_titulo  := '📅 ' || CASE WHEN v_tipo IN ('competencia', 'reunión', 'evaluación') THEN 'Nueva ' ELSE 'Nuevo ' END
                   || v_frase;
      v_mensaje := v_school || ' · ' || v_destino || ': ' || v_tipo
                   || COALESCE(' «' || NULLIF(btrim(v_row.title), '') || '»', '')
                   || ' el ' || v_cuando
                   || COALESCE(', en ' || v_lugar, '') || '.';
    ELSIF TG_OP = 'UPDATE' THEN
      v_op := 'updated';
      v_titulo  := '📅 Cambio en ' || v_frase;
      v_mensaje := v_school || ' · ' || v_destino || ': ' || v_tipo
                   || COALESCE(' «' || NULLIF(btrim(v_row.title), '') || '»', '')
                   || ' ahora es el ' || v_cuando
                   || COALESCE(', en ' || v_lugar, '') || '.';
    ELSE
      v_op := 'cancelled';
      v_titulo  := '📅 Cancelado: ' || v_frase;
      v_mensaje := v_school || ' · ' || v_destino || ': se canceló ' || v_tipo
                   || COALESCE(' «' || NULLIF(btrim(v_row.title), '') || '»', '')
                   || ' que era el ' || v_cuando || '.';
    END IF;

    INSERT INTO public.notifications (user_id, school_id, type, category, title, message, link, data)
    SELECT r, v_row.school_id, 'info', 'calendar', v_titulo, v_mensaje, '/calendar',
           jsonb_build_object('event_id', v_row.id, 'team_id', v_row.team_id, 'op', v_op,
                              'start_time', v_row.start_time, 'event_type', v_row.event_type,
                              'tipo_aviso', v_tipo)
      FROM public.calendar_event_recipients(v_row.school_id, v_row.team_id, v_row.user_id) AS r;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[calendar_events] aviso a familias falló en % (%): %', TG_OP, v_row.id, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

COMMIT;
