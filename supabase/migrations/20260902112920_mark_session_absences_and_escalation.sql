-- =============================================================================
-- 20260902112920_mark_session_absences_and_escalation.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902112738
-- Objetivo: Pieza D del spec de asistencia (docs/specs/asistencia-rapida-checkin.md
-- §4.2-4.3) — al finalizar una sesión de equipo, a quien tenía inscripción
-- activa y NO quedó con ningún registro se lo marca `absent`/`no_show`, se
-- avisa al padre (o al atleta adulto), y si acumula
-- `school_settings.absence_alert_threshold` ausencias SEGUIDAS se escala al
-- dueño de la escuela. Es UNA sola función, no dos — la llama tanto el PATCH
-- /session/:id/finalize (finalización manual del coach) como
-- `auto_finalize_stale_sessions()` (cron de sesiones olvidadas), para no
-- duplicar la lógica de "quién estaba citado" en TypeScript y en SQL a la vez.
--
-- Idempotente por diseño: el `NOT EXISTS` contra attendance_records evita
-- doble-inserción si esta función corre dos veces sobre la misma sesión (ej.
-- alguien la finaliza a mano después de que el cron ya la cerró).
--
-- Nunca toca crédito de plan — la ausencia no descuenta ni devuelve nada, a
-- diferencia del check-in por torniquete/QR (checkInPresenceFromEvent en el
-- BFF). Son cosas distintas: faltar no es "gastar una clase".
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

CREATE OR REPLACE FUNCTION public.mark_session_absences(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_session       record;
  v_threshold     int;
  v_marked        int := 0;
  v_athlete       record;
  v_dest          uuid;
  v_consecutive   int;
  v_owner         uuid;
  v_nombre        text;
BEGIN
  SELECT id, school_id, team_id, session_date
    INTO v_session
    FROM public.attendance_sessions
   WHERE id = p_session_id;

  -- Sin equipo no hay roster esperado contra qué comparar (ej. sesiones de
  -- instalación/facility) — no hay ausencia que inventar.
  IF NOT FOUND OR v_session.team_id IS NULL THEN
    RETURN jsonb_build_object('marked', 0);
  END IF;

  SELECT COALESCE(ss.absence_alert_threshold, 2) INTO v_threshold
    FROM public.school_settings ss
   WHERE ss.school_id = v_session.school_id;
  v_threshold := COALESCE(v_threshold, 2);

  FOR v_athlete IN
    SELECT e.child_id, e.user_id, e.unregistered_athlete_id
      FROM public.enrollments e
     WHERE e.team_id = v_session.team_id
       AND e.status = 'active'
       AND NOT EXISTS (
             SELECT 1 FROM public.attendance_records ar
              WHERE ar.session_id = p_session_id
                AND ar.child_id                IS NOT DISTINCT FROM e.child_id
                AND ar.user_id                 IS NOT DISTINCT FROM e.user_id
                AND ar.unregistered_athlete_id IS NOT DISTINCT FROM e.unregistered_athlete_id
           )
  LOOP
    INSERT INTO public.attendance_records (
      school_id, child_id, user_id, unregistered_athlete_id,
      team_id, session_id, attendance_date, status, check_in_method
    ) VALUES (
      v_session.school_id, v_athlete.child_id, v_athlete.user_id, v_athlete.unregistered_athlete_id,
      v_session.team_id, p_session_id, v_session.session_date, 'absent', 'no_show'
    );
    v_marked := v_marked + 1;

    -- Aviso al padre (menor) o al propio atleta (adulto). El atleta sin
    -- cuenta no tiene a quién avisarle directo — la escuela lo ve igual en
    -- el reporte de asistencia.
    v_dest := NULL;
    IF v_athlete.child_id IS NOT NULL THEN
      SELECT parent_id INTO v_dest FROM public.children WHERE id = v_athlete.child_id;
    ELSIF v_athlete.user_id IS NOT NULL THEN
      v_dest := v_athlete.user_id;
    END IF;

    IF v_dest IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, school_id, type, title, message, link)
      VALUES (
        v_dest, v_session.school_id, 'attendance_absent',
        'Asistencia',
        'No llegó al entrenamiento del ' || to_char(v_session.session_date, 'DD/MM/YYYY') || '.',
        '/my-attendance'
      );
    END IF;

    -- Ausencias consecutivas hasta esta sesión inclusive (mismo equipo). Se
    -- escala UNA sola vez, justo al cruzar el umbral — no en cada ausencia
    -- posterior, para no repetir el aviso al admin cada semana.
    SELECT COUNT(*) INTO v_consecutive
      FROM (
        SELECT ar2.status
          FROM public.attendance_records ar2
          JOIN public.attendance_sessions s2 ON s2.id = ar2.session_id
         WHERE s2.team_id = v_session.team_id
           AND ar2.child_id                IS NOT DISTINCT FROM v_athlete.child_id
           AND ar2.user_id                 IS NOT DISTINCT FROM v_athlete.user_id
           AND ar2.unregistered_athlete_id IS NOT DISTINCT FROM v_athlete.unregistered_athlete_id
           AND s2.session_date <= v_session.session_date
         ORDER BY s2.session_date DESC
         LIMIT v_threshold
      ) recientes
     WHERE recientes.status = 'absent';

    IF v_consecutive = v_threshold THEN
      SELECT owner_id INTO v_owner FROM public.schools WHERE id = v_session.school_id;
      IF v_owner IS NOT NULL THEN
        SELECT COALESCE(
                 (SELECT full_name FROM public.children WHERE id = v_athlete.child_id),
                 (SELECT full_name FROM public.profiles WHERE id = v_athlete.user_id),
                 (SELECT full_name FROM public.unregistered_athletes WHERE id = v_athlete.unregistered_athlete_id),
                 'Un deportista'
               ) INTO v_nombre;

        INSERT INTO public.notifications (user_id, school_id, type, title, message, link)
        VALUES (
          v_owner, v_session.school_id, 'attendance_risk',
          '⚠️ Deportista en riesgo',
          v_nombre || ' lleva ' || v_consecutive || ' entrenamientos seguidos sin venir.',
          '/school/attendance'
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('marked', v_marked);
END;
$$;

COMMENT ON FUNCTION public.mark_session_absences(uuid) IS
  'Marca absent/no_show a quien tenía inscripción activa en el equipo de la sesión y no quedó con registro. Avisa al padre/atleta, y escala al dueño de la escuela al cruzar school_settings.absence_alert_threshold ausencias seguidas. Idempotente. Llamada desde PATCH /session/:id/finalize (BFF) y desde auto_finalize_stale_sessions() (cron).';

REVOKE ALL ON FUNCTION public.mark_session_absences(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_session_absences(uuid) TO service_role;

-- ── auto_finalize_stale_sessions(): ahora también marca ausencias ──────────
-- Antes solo ponía finalized=true (mig. drift, no versionada hasta ahora).
-- Se versiona acá completa, con el paso nuevo agregado, para sacarla del
-- drift de una vez.
CREATE OR REPLACE FUNCTION public.auto_finalize_stale_sessions()
RETURNS TABLE(sessions_finalized integer, school_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_count       int := 0;
  v_school_ids  uuid[] := ARRAY[]::uuid[];
  v_session     record;
BEGIN
  FOR v_session IN
    SELECT id, school_id
      FROM public.attendance_sessions
     WHERE finalized = false
       AND session_date < CURRENT_DATE
  LOOP
    UPDATE public.attendance_sessions
       SET finalized    = true,
           finalized_at = (session_date + COALESCE(end_time, '23:59:00'::time))::timestamptz,
           finalized_by = NULL,
           updated_at   = now()
     WHERE id = v_session.id;

    v_count := v_count + 1;
    IF NOT (v_session.school_id = ANY (v_school_ids)) THEN
      v_school_ids := array_append(v_school_ids, v_session.school_id);
    END IF;

    -- Nunca debe frenar el cierre masivo: una sesión con datos raros no debe
    -- tumbar el resto.
    BEGIN
      PERFORM public.mark_session_absences(v_session.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'mark_session_absences falló para sesión %: %', v_session.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_count, COALESCE(array_length(v_school_ids, 1), 0);
END;
$$;

COMMENT ON FUNCTION public.auto_finalize_stale_sessions() IS
  'Cierra sesiones de días anteriores que nadie finalizó, y marca las ausencias de cada una (mark_session_absences). Versionada 2026-09-02 (antes vivía como drift sin marcar ausencias). Ejecutada a diario por pg_cron.';

REVOKE ALL ON FUNCTION public.auto_finalize_stale_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_finalize_stale_sessions() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT proname, proacl FROM pg_proc
 WHERE proname IN ('mark_session_absences', 'auto_finalize_stale_sessions')
   AND pronamespace = 'public'::regnamespace;
