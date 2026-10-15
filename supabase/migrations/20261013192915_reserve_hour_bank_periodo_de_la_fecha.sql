-- =============================================================================
-- 20261013192915_reserve_hour_bank_periodo_de_la_fecha.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013192856
-- Objetivo (spec docs/specs/dreamers-cierre-total.md F1):
--   1. reserve_hour_bank descontaba del periodo de HOY y no del de la fecha
--      reservada: reservar el 1-nov desde octubre gastaba horas de octubre (y
--      al cerrar la visita de noviembre se liberaba en otro periodo).
--      → get_or_open_hour_bank_period_at(enrollment, fecha) (nueva) con la
--        lógica; la de 1 argumento conserva firma/ACL y delega con fecha NULL
--        (= hoy). Se respeta el gate hours_plan_enabled (20260915101557).
--   2. El generador de horas de más (generate_hour_bank_overage_suggestions)
--      sugería cargos a inscripciones canceladas y a personal de la escuela
--      (caso: $419.188 a la inscripción cancelada 2992a5ee de la dueña).
--      → excluye e.status='cancelled' y _hour_bank_es_personal_de_escuela().
--      Las sugerencias ya creadas NO se tocan (descartarlas es decisión de la escuela).
--
-- Cuerpos VIVOS de producción (md5 sin CR):
--   get_or_open_hour_bank_period            b9cf634a5173942de5275f6b7cbee275
--   reserve_hour_bank                       99cd6147467b2bfa17f9a00750bad17c
--   generate_hour_bank_overage_suggestions  2f375f7fdfc569ff9f8b917fff29ad6e
-- ACL viva de las tres: EXECUTE solo postgres y service_role. Las nuevas igual.
-- =============================================================================

BEGIN;

DO $guard$
DECLARE
    v_md5 text;
BEGIN
    SELECT md5(replace(p.prosrc, E'\r', '')) INTO v_md5
      FROM pg_proc p
     WHERE p.oid = 'public.get_or_open_hour_bank_period(uuid)'::regprocedure;
    IF v_md5 IS DISTINCT FROM 'b9cf634a5173942de5275f6b7cbee275'
       AND v_md5 IS DISTINCT FROM '1e6c66bc0dde46337eb7bb3b2a6f6701' THEN
        RAISE EXCEPTION 'get_or_open_hour_bank_period cambió en la base (md5 %); revisar antes de reemplazar', v_md5;
    END IF;
END
$guard$;

DO $guard$
DECLARE
    v_md5 text;
BEGIN
    SELECT md5(replace(p.prosrc, E'\r', '')) INTO v_md5
      FROM pg_proc p
     WHERE p.oid = 'public.reserve_hour_bank(uuid, date, uuid, integer)'::regprocedure;
    IF v_md5 IS DISTINCT FROM '99cd6147467b2bfa17f9a00750bad17c'
       AND v_md5 IS DISTINCT FROM 'd09e79c0d5702601f7f9652fb63bac1d' THEN
        RAISE EXCEPTION 'reserve_hour_bank cambió en la base (md5 %); revisar antes de reemplazar', v_md5;
    END IF;
END
$guard$;

DO $guard$
DECLARE
    v_md5 text;
BEGIN
    SELECT md5(replace(p.prosrc, E'\r', '')) INTO v_md5
      FROM pg_proc p
     WHERE p.oid = 'public.generate_hour_bank_overage_suggestions()'::regprocedure;
    IF v_md5 IS DISTINCT FROM '2f375f7fdfc569ff9f8b917fff29ad6e'
       AND v_md5 IS DISTINCT FROM 'ee980e3628c0f0191a18b319f32b066b' THEN
        RAISE EXCEPTION 'generate_hour_bank_overage_suggestions cambió en la base (md5 %); revisar antes de reemplazar', v_md5;
    END IF;
END
$guard$;

-- 1. Periodo de una fecha ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_open_hour_bank_period_at(p_enrollment_id uuid, p_fecha date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_enr           record;
    v_included      integer;
    v_enabled       boolean;
    v_cycle         text;
    v_today         date;
    v_period_start  date;
    v_period_end    date;
    v_period_id     uuid;
BEGIN
    SELECT e.id, e.school_id, e.start_date, e.offering_plan_id
      INTO v_enr
      FROM public.enrollments e
     WHERE e.id = p_enrollment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'get_or_open_hour_bank_period_at: enrollment % no existe', p_enrollment_id;
    END IF;

    IF v_enr.offering_plan_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT op.included_minutes_per_period
      INTO v_included
      FROM public.offering_plans op
     WHERE op.id = v_enr.offering_plan_id;

    IF v_included IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(ss.hours_plan_enabled, false)
      INTO v_enabled
      FROM public.school_settings ss
     WHERE ss.school_id = v_enr.school_id;

    IF NOT v_enabled THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(ss.billing_cycle_type, 'fixed_calendar')
      INTO v_cycle
      FROM public.school_settings ss
     WHERE ss.school_id = v_enr.school_id;

    -- 20261013192915: el periodo es el de la FECHA pedida (p. ej. el día
    -- reservado); NULL = hoy en Bogotá (comportamiento de la versión de 1 arg).
    v_today := COALESCE(p_fecha, (now() AT TIME ZONE 'America/Bogota')::date);

    IF v_cycle = 'rolling_30' THEN
        v_period_start := v_enr.start_date
            + (30 * FLOOR(GREATEST(0, v_today - v_enr.start_date) / 30.0))::int;
        v_period_end := v_period_start + 29;
    ELSE
        v_period_start := date_trunc('month', v_today)::date;
        v_period_end   := (date_trunc('month', v_today) + interval '1 month' - interval '1 day')::date;
    END IF;

    INSERT INTO public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes)
    VALUES (p_enrollment_id, v_enr.school_id, v_period_start, v_period_end, v_included)
    ON CONFLICT (enrollment_id, period_start) DO NOTHING;

    SELECT id INTO v_period_id
      FROM public.hour_bank_periods
     WHERE enrollment_id = p_enrollment_id
       AND period_start = v_period_start;

    RETURN v_period_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_or_open_hour_bank_period_at(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_open_hour_bank_period_at(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.get_or_open_hour_bank_period(p_enrollment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
    -- 20261013192915: la lógica vive en get_or_open_hour_bank_period_at; esta
    -- firma se conserva para sus llamadores (access-api.ts, access-adms.ts,
    -- public-booking.routes.ts) y abre/devuelve el periodo de HOY (Bogotá).
    RETURN public.get_or_open_hour_bank_period_at(p_enrollment_id, NULL::date);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_or_open_hour_bank_period(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_open_hour_bank_period(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_hour_bank(p_enrollment_id uuid, p_reservation_date date, p_created_by uuid DEFAULT NULL::uuid, p_minutes_override integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_school_id        uuid;
    v_offering_plan_id uuid;
    v_plan_block       integer;
    v_block_minutes    integer;
    v_period_id        uuid;
    v_move             jsonb;
    v_reservation_id   uuid;
BEGIN
    SELECT school_id, offering_plan_id
      INTO v_school_id, v_offering_plan_id
      FROM public.enrollments
     WHERE id = p_enrollment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('reserved', false, 'reason', 'enrollment_not_found');
    END IF;

    IF p_minutes_override IS NOT NULL THEN
        IF p_minutes_override <= 0 THEN
            RETURN jsonb_build_object('reserved', false, 'reason', 'invalid_minutes_override');
        END IF;
        v_block_minutes := p_minutes_override;
    ELSE
        IF v_offering_plan_id IS NOT NULL THEN
            SELECT session_block_minutes INTO v_plan_block
              FROM public.offering_plans
             WHERE id = v_offering_plan_id;
        END IF;

        SELECT COALESCE(v_plan_block, ss.hours_session_block_minutes, 120)
          INTO v_block_minutes
          FROM public.school_settings ss
         WHERE ss.school_id = v_school_id;

        v_block_minutes := COALESCE(v_block_minutes, v_plan_block, 120);
    END IF;

    -- 20261013192915: descuenta del periodo del DÍA RESERVADO, no del de hoy
    -- (reservar el 1-nov desde octubre consumía saldo de octubre).
    v_period_id := public.get_or_open_hour_bank_period_at(p_enrollment_id, p_reservation_date);
    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('reserved', false, 'reason', 'not_hours_plan');
    END IF;

    v_move := public.move_hour_bank(v_period_id, v_block_minutes, 0);

    IF NOT (v_move->>'moved')::boolean THEN
        RETURN v_move || jsonb_build_object('reserved', false);
    END IF;

    INSERT INTO public.hour_bank_reservations
        (school_id, enrollment_id, period_id, reservation_date, minutes, status, created_by)
    VALUES
        (v_school_id, p_enrollment_id, v_period_id, p_reservation_date, v_block_minutes, 'confirmed', p_created_by)
    RETURNING id INTO v_reservation_id;

    RETURN v_move || jsonb_build_object(
        'reserved',        true,
        'reservation_id',  v_reservation_id,
        'minutes',         v_block_minutes
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_hour_bank(uuid, date, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_hour_bank(uuid, date, uuid, integer) TO service_role;

-- 2. Horas de más: sin canceladas ni personal ---------------------------------
CREATE OR REPLACE FUNCTION public._hour_bank_es_personal_de_escuela(p_enrollment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
    -- ¿La persona de esta inscripción trabaja en (o es dueña de) la escuela?
    -- Adulto con cuenta → por profile (owner_id, school_members activos con rol
    -- de personal, school_staff.coach_auth_id). Atleta sin cuenta → por su
    -- perfil vinculado o por correo (contra la escuela, su dueño y school_staff
    -- activos). Un menor (child_id) nunca es personal.
    WITH x AS (
        SELECT e.school_id,
               COALESCE(e.user_id, ua.linked_profile_id) AS profile_id,
               lower(NULLIF(btrim(COALESCE(pr.email, ua.email)), '')) AS email
          FROM public.enrollments e
          LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
          LEFT JOIN public.profiles pr ON pr.id = COALESCE(e.user_id, ua.linked_profile_id)
         WHERE e.id = p_enrollment_id
           AND e.child_id IS NULL
    )
    SELECT COALESCE(bool_or(
               EXISTS (SELECT 1 FROM public.schools s
                        WHERE s.id = x.school_id
                          AND (s.owner_id = x.profile_id
                               OR (x.email IS NOT NULL AND lower(s.email) = x.email)
                               OR (x.email IS NOT NULL AND EXISTS (
                                       SELECT 1 FROM public.profiles o
                                        WHERE o.id = s.owner_id AND lower(o.email) = x.email))))
            OR EXISTS (SELECT 1 FROM public.school_members sm
                        WHERE sm.school_id = x.school_id
                          AND sm.profile_id = x.profile_id
                          AND sm.status = 'active'
                          AND sm.role IN ('owner', 'admin', 'school_admin', 'coach', 'staff'))
            OR EXISTS (SELECT 1 FROM public.school_staff st
                        WHERE st.school_id = x.school_id
                          AND st.status = 'active'
                          AND (st.coach_auth_id = x.profile_id
                               OR (x.email IS NOT NULL AND lower(st.email) = x.email)))
           ), false)
      FROM x;
$function$;

REVOKE ALL ON FUNCTION public._hour_bank_es_personal_de_escuela(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._hour_bank_es_personal_de_escuela(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_hour_bank_overage_suggestions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_today    date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_period   record;
  v_calc     record;
  v_id       uuid;
  v_name     text;
  v_created  integer := 0;
  v_skipped  integer := 0;
  v_notified integer := 0;
  v_months   text[] := ARRAY['enero','febrero','marzo','abril','mayo','junio','julio',
                             'agosto','septiembre','octubre','noviembre','diciembre'];
BEGIN
  FOR v_period IN
    SELECT p.id, p.period_start
      FROM public.hour_bank_periods p
      JOIN public.school_settings ss
        ON ss.school_id = p.school_id
       AND ss.hours_plan_enabled
       AND ss.hour_bank_overage_charges_enabled
      -- 20261013192915: ni inscripciones canceladas ni personal de la escuela
      -- (dueña/admin/coach/staff). Caso real: $419.188 sugeridos a la
      -- inscripción cancelada 2992a5ee de la dueña de Dreamers.
      JOIN public.enrollments e
        ON e.id = p.enrollment_id
       AND e.status <> 'cancelled'
     WHERE p.period_end < v_today
       AND NOT public._hour_bank_es_personal_de_escuela(p.enrollment_id)
       AND p.consumed_minutes > p.included_minutes
       AND NOT EXISTS (SELECT 1 FROM public.hour_bank_overage_charges c
                        WHERE c.period_id = p.id)
       -- Visitas sin cerrar o esperando la corrección del owner (D-8): el
       -- consumo todavía puede cambiar. Se reintenta la noche siguiente.
       AND NOT EXISTS (SELECT 1 FROM public.hour_bank_visits v
                        WHERE v.period_id = p.id
                          AND v.status IN ('open', 'pending_review'))
     ORDER BY p.period_start
  LOOP
    SELECT * INTO v_calc FROM public.hour_bank_overage_calc(v_period.id);
    IF NOT FOUND OR v_calc.amount IS NULL OR v_calc.amount <= 0 THEN
      v_skipped := v_skipped + 1;   -- sin precio / sin minutos incluidos
      CONTINUE;
    END IF;

    v_id := NULL;
    INSERT INTO public.hour_bank_overage_charges (
      school_id, period_id, enrollment_id, included_minutes, consumed_minutes,
      overage_minutes, billable_hours, hourly_rate, amount, rounding, plan_price
    ) VALUES (
      v_calc.school_id, v_period.id, v_calc.enrollment_id, v_calc.included_minutes,
      v_calc.consumed_minutes, v_calc.overage_minutes, v_calc.billable_hours,
      v_calc.hourly_rate, v_calc.amount, v_calc.rounding, v_calc.plan_price
    )
    ON CONFLICT (period_id) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      CONTINUE;   -- otra corrida concurrente ya la creó
    END IF;
    v_created := v_created + 1;

    -- Un aviso al owner por fila nueva. Defensivo: un fallo de notificación
    -- no revierte la sugerencia (mismo patrón que D-10 en 20260905124655).
    BEGIN
      SELECT COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')
        INTO v_name
        FROM public.enrollments e
        LEFT JOIN public.children c               ON c.id  = e.child_id
        LEFT JOIN public.profiles pr              ON pr.id = e.user_id
        LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
       WHERE e.id = v_calc.enrollment_id;

      INSERT INTO public.notifications (user_id, school_id, type, category, title, message, link, data)
      SELECT s.owner_id, v_calc.school_id, 'hour_bank_overage_charge', 'payment',
             '⏱️ Horas por encima del plan — cobro por confirmar',
             format('%s usó %s min de %s incluidos en %s %s. Cobro sugerido: %s h × $%s = $%s. Confírmalo o descártalo en Control de acceso.',
                    COALESCE(v_name, 'Atleta'), v_calc.consumed_minutes, v_calc.included_minutes,
                    v_months[extract(month FROM v_period.period_start)::int],
                    extract(year FROM v_period.period_start)::int,
                    public.hour_bank_fmt_es(v_calc.billable_hours),
                    public.hour_bank_fmt_es(v_calc.hourly_rate),
                    public.hour_bank_fmt_es(v_calc.amount)),
             '/school/access-control',
             jsonb_build_object('overage_charge_id', v_id, 'period_id', v_period.id,
                                'amount', v_calc.amount)
        FROM public.schools s
       WHERE s.id = v_calc.school_id
         AND s.owner_id IS NOT NULL;
      IF FOUND THEN v_notified := v_notified + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped,
                            'notified', v_notified, 'as_of', v_today);
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_hour_bank_overage_suggestions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_hour_bank_overage_suggestions() TO service_role;

COMMIT;
