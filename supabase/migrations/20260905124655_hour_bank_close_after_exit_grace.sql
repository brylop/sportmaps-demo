-- =============================================================================
-- 20260905124655_hour_bank_close_after_exit_grace.sql
-- Autor: judegor99   Fecha: 2026-09-05   Versión anterior: 20260905121531
-- Objetivo: bug real encontrado en vivo en Dreamers (Edna, 2026-09-05): salió
-- a las 12:36, el segmento quedó con `exited_at` correcto, pero la visita
-- siguió `status='open'` sin facturar 9+ minutos después.
--
-- Causa: auto_close_stale_hour_bank_visits() (migración 20260827174032) solo
-- corta una visita 'open' cuando se cumple el cutoff de SEGURIDAD — hora de
-- cierre del día o hours_max_visit_minutes (6h) desde started_at. Si el
-- último segmento YA tiene una salida real, no hay ninguna razón de negocio
-- para esperar esas horas: ya se sabe la hora exacta de salida. Antes de este
-- fix, una visita normal (entra, sale, no vuelve) se quedaba sin facturar
-- hasta la noche o hasta 6h después de haber entrado — nunca "perdida", pero
-- con una demora de horas que no tiene sentido cuando el dato ya está.
--
-- Fix: agrega un tercer candidato a v_cutoff — `último segmento.exited_at +
-- hours_reentry_merge_minutes` — que aplica SOLO cuando ya hay una salida real
-- registrada. Es el mismo criterio que ya usa trackHourBankVisit en
-- access-adms.ts (F3) para decidir "reentrada corta, fusiona" vs "visita
-- terminada, cierra": si pasó esa ventana sin una nueva entrada, ya no hay
-- ambigüedad, se cierra y factura ahora, sin esperar el cutoff largo. No
-- duplica el bloque de cierre/facturación — solo amplía qué cuenta como
-- "está stale", el resto de la función (cerrar+facturar vs pending_review)
-- sigue exactamente igual.
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
    v_exit_cutoff       timestamptz;
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
               ss.hours_entry_grace_minutes, ss.hours_exit_grace_minutes,
               ss.hours_reentry_merge_minutes
          FROM public.hour_bank_visits hbv
          JOIN public.school_settings ss ON ss.school_id = hbv.school_id
         WHERE hbv.status = 'open'
           AND ss.hours_plan_enabled = true
           FOR UPDATE OF hbv SKIP LOCKED
    LOOP
        SELECT id, exited_at
          INTO v_last_seg_id, v_last_seg_exited
          FROM public.hour_bank_visit_segments
         WHERE visit_id = v_visit.id
         ORDER BY entered_at DESC
         LIMIT 1;

        -- Mismo ancla de siempre para el cutoff de seguridad: el DÍA EN QUE
        -- ARRANCÓ la visita, no "hoy".
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

        -- FIX 2026-09-05: si ya hay salida real registrada, un cutoff mucho más
        -- corto también cuenta — no hace falta esperar la hora de cierre ni las
        -- 6h de seguridad cuando ya se sabe la hora exacta en que se fue.
        IF v_last_seg_exited IS NOT NULL THEN
            v_exit_cutoff := v_last_seg_exited + make_interval(mins => v_visit.hours_reentry_merge_minutes);
            IF v_now >= v_exit_cutoff AND (v_cutoff IS NULL OR v_exit_cutoff < v_cutoff) THEN
                v_cutoff := v_exit_cutoff;
            END IF;
        END IF;

        IF v_cutoff IS NULL THEN
            CONTINUE; -- todavía no está stale, se deja abierta
        END IF;

        IF v_last_seg_exited IS NOT NULL THEN
            -- Caso normal: el atleta YA marcó salida real. Se cierra y factura
            -- de una, mismo cómputo de gracia que closeHourBankVisit (access-adms.ts).
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
    'Cron: para hour_bank_visits open, cierra+factura apenas se sepa la hora real '
    'de salida y pase hours_reentry_merge_minutes sin una nueva entrada (fix '
    '2026-09-05 — antes esperaba el cutoff largo de hours_closing_time/'
    'hours_max_visit_minutes incluso con salida real ya conocida). Para quien '
    'nunca marcó salida, sigue aplicando el cutoff largo de siempre + '
    'pending_review (D-8). Restringida a service_role.';

GRANT EXECUTE ON FUNCTION public.auto_close_stale_hour_bank_visits() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
