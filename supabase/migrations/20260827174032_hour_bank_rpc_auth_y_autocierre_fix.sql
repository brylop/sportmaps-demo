-- =============================================================================
-- 20260827174032_hour_bank_rpc_auth_y_autocierre_fix.sql
-- Autor: brylop   Fecha: 2026-08-27   Versión anterior: 20260827172229
-- Objetivo: dos correcciones al banco de horas de Dreamers (b882f5d, 21-ago),
-- encontradas en revisión de seguridad/correctitud el 2026-08-27 (memoria
-- project_hour_bank_security_gaps). Ninguna toca datos existentes — `false` en
-- todas las escuelas hoy, cero visitas activas afectadas.
--
-- FIX A — Autorización de los 5 RPCs del banco de horas.
--   get_or_open_hour_bank_period, move_hour_bank, auto_close_stale_hour_bank_visits,
--   reserve_hour_bank y cancel_hour_bank_reservation son SECURITY DEFINER con
--   GRANT EXECUTE TO authenticated, pero NINGUNA valida auth.uid() contra el
--   dueño real del period_id/enrollment_id/reservation_id que reciben — el
--   único control de autorización vive en el BFF (canManageHourBankEnrollment).
--   El frontend no llama estos 5 RPCs directo hoy (verificado por grep en
--   frontend/src), pero el patrón de llamar RPCs vía supabase.rpc() desde el
--   cliente ya existe en otras pantallas de la app — nada impide que un
--   usuario autenticado de CUALQUIERA de las 368 escuelas llame
--   move_hour_bank/reserve_hour_bank/cancel_hour_bank_reservation con un
--   period_id/enrollment_id/reservation_id ajeno y mueva saldo de otra
--   familia. Fix: restringir las 5 a service_role — el único caller
--   legítimo hoy es el BFF (bff/src/config/supabase.ts usa
--   SUPABASE_SERVICE_ROLE_KEY en el único cliente de todo el proceso). Se
--   revoca de PUBLIC explícito (no alcanza con revocar solo de anon/
--   authenticated — Postgres otorga EXECUTE a PUBLIC por default en cada
--   función nueva, memoria feedback_revoke_execute_from_public).
--
-- FIX B — El auto-cierre mandaba casi TODAS las visitas normales a revisión
--   manual, no solo las anómalas. auto_close_stale_hour_bank_visits() solo
--   miraba hour_bank_visits.status='open', sin distinguir "el atleta ya
--   marcó salida real (hour_bank_visit_segments.exited_at IS NOT NULL) y
--   solo falta materializar el cierre" de "nunca marcó salida" — con el
--   patrón típico de una visita al día, la primera condición es la mayoría
--   de los casos, no la excepción. Fix: si el último segmento ya tiene salida
--   real, se cierra y factura de una (mismo cómputo de gracia que
--   closeHourBankVisit en bff/src/routes/access-adms.ts) — SIN pasar por
--   pending_review. Solo el caso genuino de "nunca marcó salida" sigue yendo
--   a revisión del owner con el cutoff de siempre. Cambia el tipo de retorno
--   de integer a jsonb ({closed, pending_review}) para que el job pueda
--   loguear ambos números por separado — requiere DROP porque Postgres no
--   permite CREATE OR REPLACE cambiando el tipo de retorno.
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

-- =============================================================================
-- FIX A — restringir los 5 RPCs a service_role
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.get_or_open_hour_bank_period(uuid)
  FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.move_hour_bank(uuid, integer, integer)
  FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.auto_close_stale_hour_bank_visits()
  FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.reserve_hour_bank(uuid, date, uuid)
  FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_hour_bank_reservation(uuid)
  FROM PUBLIC, authenticated, anon;

GRANT EXECUTE ON FUNCTION public.get_or_open_hour_bank_period(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_hour_bank(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_hour_bank(uuid, date, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_hour_bank_reservation(uuid) TO service_role;
-- auto_close_stale_hour_bank_visits() se re-crea más abajo (FIX B, cambia de
-- integer a jsonb) — su GRANT a service_role va junto a esa creación, no acá,
-- para no otorgar sobre una función que esta misma migración va a DROPear.

-- =============================================================================
-- FIX B — auto-cierre: solo pending_review para quien NUNCA marcó salida
-- =============================================================================

DROP FUNCTION public.auto_close_stale_hour_bank_visits();

CREATE OR REPLACE FUNCTION public.auto_close_stale_hour_bank_visits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_visit             record;
    v_now               timestamptz := now();
    v_start_date        date;
    v_closing_instant   timestamptz;
    v_max_instant       timestamptz;
    v_cutoff            timestamptz;
    v_closed_count      integer := 0;
    v_review_count      integer := 0;
    v_last_seg_id       uuid;
    v_last_seg_exited   timestamptz;
    v_raw_minutes       integer;
    v_billed_minutes    integer;
    v_reservation_id    uuid;
    v_reservation_min   integer;
    v_move              jsonb;
    v_athlete_name      text;
BEGIN
    FOR v_visit IN
        SELECT hbv.id, hbv.enrollment_id, hbv.school_id, hbv.period_id, hbv.started_at,
               ss.hours_closing_time, ss.hours_max_visit_minutes,
               ss.hours_entry_grace_minutes, ss.hours_exit_grace_minutes
          FROM public.hour_bank_visits hbv
          JOIN public.school_settings ss ON ss.school_id = hbv.school_id
         WHERE hbv.status = 'open'
           AND ss.hours_plan_enabled = true
           FOR UPDATE OF hbv SKIP LOCKED
    LOOP
        -- Mismo ancla de siempre: el DÍA EN QUE ARRANCÓ la visita, no "hoy".
        v_start_date      := (v_visit.started_at AT TIME ZONE 'America/Bogota')::date;
        v_closing_instant := (v_start_date + v_visit.hours_closing_time) AT TIME ZONE 'America/Bogota';
        v_max_instant     := v_visit.started_at + make_interval(mins => v_visit.hours_max_visit_minutes);

        v_cutoff := NULL;
        IF v_now >= v_closing_instant THEN
            v_cutoff := v_closing_instant;
        END IF;
        IF v_now >= v_max_instant AND (v_cutoff IS NULL OR v_max_instant < v_cutoff) THEN
            v_cutoff := v_max_instant;
        END IF;

        IF v_cutoff IS NULL THEN
            CONTINUE; -- todavía no está stale, se deja abierta
        END IF;

        SELECT id, exited_at
          INTO v_last_seg_id, v_last_seg_exited
          FROM public.hour_bank_visit_segments
         WHERE visit_id = v_visit.id
         ORDER BY entered_at DESC
         LIMIT 1;

        IF v_last_seg_exited IS NOT NULL THEN
            -- Caso normal: el atleta YA marcó salida real. Esto no es una
            -- anomalía — solo esperaba la próxima entrada o este cron para
            -- materializar el cierre. Se cierra y factura de una, mismo
            -- cómputo de gracia que closeHourBankVisit (access-adms.ts).
            -- ROUND exige numeric, no double precision (lo que da EXTRACT/división) —
            -- sin el cast, "function round(double precision) does not exist".
            SELECT COALESCE(SUM(GREATEST(0, ROUND((EXTRACT(EPOCH FROM (exited_at - entered_at)) / 60)::numeric))), 0)::integer
              INTO v_raw_minutes
              FROM public.hour_bank_visit_segments
             WHERE visit_id = v_visit.id
               AND exited_at IS NOT NULL;

            v_billed_minutes := GREATEST(0, v_raw_minutes - v_visit.hours_entry_grace_minutes - v_visit.hours_exit_grace_minutes);

            SELECT id, minutes INTO v_reservation_id, v_reservation_min
              FROM public.hour_bank_reservations
             WHERE enrollment_id = v_visit.enrollment_id
               AND reservation_date = v_start_date
               AND status = 'confirmed'
             LIMIT 1;

            SELECT public.move_hour_bank(
                       v_visit.period_id,
                       CASE WHEN v_reservation_id IS NOT NULL THEN -v_reservation_min ELSE 0 END,
                       v_billed_minutes
                   )
              INTO v_move;

            IF v_reservation_id IS NOT NULL THEN
                UPDATE public.hour_bank_reservations
                   SET status = 'fulfilled', updated_at = now()
                 WHERE id = v_reservation_id;
            END IF;

            UPDATE public.hour_bank_visits
               SET status = 'closed', ended_at = v_last_seg_exited,
                   billed_minutes = v_billed_minutes, updated_at = now()
             WHERE id = v_visit.id;

            v_closed_count := v_closed_count + 1;

            -- D-10: mismo aviso de excedente que closeHourBankVisit — solo
            -- notifica, sin bloqueo automático. Defensivo: un fallo acá no
            -- debe tumbar el cierre/facturación ya aplicados arriba.
            IF COALESCE((v_move->>'available_minutes')::integer, 0) < 0 THEN
                BEGIN
                    SELECT COALESCE(p.full_name, c.full_name, ua.full_name, 'Atleta')
                      INTO v_athlete_name
                      FROM public.enrollments e
                      LEFT JOIN public.profiles p ON p.id = e.user_id
                      LEFT JOIN public.children c ON c.id = e.child_id
                      LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
                     WHERE e.id = v_visit.enrollment_id;

                    INSERT INTO public.notifications (user_id, school_id, type, title, message, link)
                    SELECT s.owner_id, v_visit.school_id, 'hour_bank_overage',
                           '⏱️ Banco de horas — saldo excedido',
                           format('%s consumió %s min y dejó el banco del período en %s min (excedido).',
                                  COALESCE(v_athlete_name, 'Atleta'), v_billed_minutes,
                                  (v_move->>'available_minutes')),
                           '/school/access-control'
                      FROM public.schools s
                     WHERE s.id = v_visit.school_id
                       AND s.owner_id IS NOT NULL;
                EXCEPTION WHEN OTHERS THEN
                    NULL; -- nunca revertir el cierre/facturación por un fallo de notificación
                END;
            END IF;
        ELSE
            -- Caso anómalo real: nunca marcó salida. Cutoff de siempre +
            -- revisión del owner (D-8), sin facturar todavía.
            UPDATE public.hour_bank_visit_segments
               SET exited_at = v_cutoff
             WHERE id = v_last_seg_id
               AND exited_at IS NULL;

            UPDATE public.hour_bank_visits
               SET status = 'pending_review', auto_closed = true,
                   ended_at = v_cutoff, updated_at = now()
             WHERE id = v_visit.id;

            v_review_count := v_review_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('closed', v_closed_count, 'pending_review', v_review_count);
END;
$$;

COMMENT ON FUNCTION public.auto_close_stale_hour_bank_visits() IS
    'Cron: para hour_bank_visits open que pasaron hours_closing_time/hours_max_visit_minutes, '
    'distingue dos casos — (1) último segmento con salida real ya registrada: cierra y factura '
    'de una (mismo cómputo que closeHourBankVisit), NUNCA pending_review; (2) nunca marcó salida: '
    'aplica cutoff y manda a pending_review para que el owner corrija (D-8). Antes de este fix '
    '(20260827174032) TODO caso caía en (2), inutilizando la facturación automática para el uso '
    'típico de una visita diaria. Restringida a service_role — ver FIX A arriba.';

GRANT EXECUTE ON FUNCTION public.auto_close_stale_hour_bank_visits() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
