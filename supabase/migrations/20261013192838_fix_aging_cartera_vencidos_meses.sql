-- =============================================================================
-- 20261013192838_fix_aging_cartera_vencidos_meses.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013170553
-- Objetivo: la cartera por antigüedad (get_payment_aging_report) contaba cada
--   cobro vivo como un «mes» (inscripción + seguro + mensualidad del mismo mes
--   = «3+ meses») e incluía cobros que todavía no vencían (la mensualidad del
--   05/11 aparecía como deuda el 13/10). Spec: docs/specs/dreamers-cierre-total.md F1.
--
--   · Vencido = COALESCE(due_date, día 1 del periodo, created_at) < hoy (Bogotá).
--   · meses_debidos = periodos distintos vencidos; el bucket sale de ahí.
--   · periodos_debidos sin repetidos. cuotas_debidas se mantiene (informativo).
--   · Bloque nuevo `por_vencer` {count, monto}: lo vivo (pending/overdue/partial)
--     cuya fecha efectiva es >= hoy. Las claves de antes no cambian de forma.
--
-- Parte del cuerpo VIVO de producción (md5 sin CR d2e3ccc2152a06d57f81caa04cf7887e).
-- ACL viva: postgres, service_role, authenticated (EXECUTE). Se conserva.
-- =============================================================================

BEGIN;

DO $guard$
DECLARE
    v_md5 text;
BEGIN
    SELECT md5(replace(p.prosrc, E'\r', '')) INTO v_md5
      FROM pg_proc p
     WHERE p.oid = 'public.get_payment_aging_report(uuid, uuid)'::regprocedure;
    -- Se acepta el cuerpo viejo (primera aplicación) o el de esta migración (re-ejecución).
    IF v_md5 IS DISTINCT FROM 'd2e3ccc2152a06d57f81caa04cf7887e'
       AND v_md5 IS DISTINCT FROM '244123209042f442ef576ecd526d1123' THEN
        RAISE EXCEPTION 'get_payment_aging_report cambió en la base (md5 %); revisar antes de reemplazar', v_md5;
    END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.get_payment_aging_report(p_school_id uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_caller  uuid := auth.uid();
    v_today   date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_items   jsonb;
    v_sin_atleta int;
    v_en_revision jsonb;
    v_en_disputa  jsonb;
    v_sin_canal   jsonb;
    v_por_vencer  jsonb;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado para ver la cartera de esta escuela.';
    END IF;

    -- 20261013192838: «vencido» = fecha efectiva < hoy. La fecha efectiva es el
    -- vencimiento; sin vencimiento, el día 1 del periodo; sin periodo, la
    -- creación del cobro. Lo que vence hoy o después va a `por_vencer`.
    WITH vivos AS (
        SELECT
            p.*,
            COALESCE(
                p.due_date,
                CASE WHEN p.period_year IS NOT NULL AND p.period_month IS NOT NULL
                     THEN make_date(p.period_year::int, p.period_month::int, 1) END,
                (p.created_at AT TIME ZONE 'America/Bogota')::date
            ) AS fecha_efectiva,
            CASE
                WHEN p.child_id IS NOT NULL THEN 'child:' || p.child_id::text
                WHEN p.unregistered_athlete_id IS NOT NULL THEN 'unreg:' || p.unregistered_athlete_id::text
                WHEN COALESCE(p.user_id, p.parent_id) IS NOT NULL THEN 'adult:' || COALESCE(p.user_id, p.parent_id)::text
                ELSE NULL
            END AS akey
        FROM public.payments p
        WHERE p.school_id = p_school_id
          AND p.status IN ('pending', 'overdue', 'partial')
          AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id)
    ),
    deuda AS (
        SELECT v.*,
               -- Mes al que pertenece el cobro: el periodo; sin periodo, el mes de la fecha efectiva.
               make_date(
                   COALESCE(v.period_year::int,  extract(year  from v.fecha_efectiva)::int),
                   COALESCE(v.period_month::int, extract(month from v.fecha_efectiva)::int),
                   1
               ) AS periodo
          FROM vivos v
         WHERE v.fecha_efectiva < v_today
    ),
    por_atleta AS (
        SELECT
            akey,
            max(child_id::text)::uuid                    AS child_id,
            max(unregistered_athlete_id::text)::uuid     AS unregistered_athlete_id,
            max(COALESCE(user_id, parent_id)::text)::uuid AS adult_id,
            max(branch_id::text)::uuid                    AS branch_id,
            count(*)                                      AS cuotas_debidas,
            count(DISTINCT periodo)                       AS meses_debidos,
            min(periodo)                                  AS periodo_mas_antiguo,
            (SELECT jsonb_agg(to_char(x.per, 'MM/YYYY') ORDER BY x.per)
               FROM (SELECT DISTINCT unnest(array_agg(periodo)) AS per) x) AS periodos_debidos,
            sum(amount - COALESCE(amount_paid, 0))        AS monto_pendiente,
            min(fecha_efectiva)                           AS vencimiento_mas_antiguo
        FROM deuda
        WHERE akey IS NOT NULL
        GROUP BY akey
    )
    SELECT
        COALESCE(jsonb_agg(jsonb_build_object(
            'athlete',            COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta'),
            'tipo',                CASE
                                       WHEN pa.child_id IS NOT NULL THEN 'menor'
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN 'no_registrado'
                                       ELSE 'adulto'
                                   END,
            -- Ids de identidad — nuevos (para el drill-down, §3.4).
            'child_id',                  pa.child_id,
            'adult_id',                  pa.adult_id,
            'unregistered_athlete_id',   pa.unregistered_athlete_id,
            'branch_id',           pa.branch_id,
            'cuotas_debidas',      pa.cuotas_debidas,
            'meses_debidos',       pa.meses_debidos,
            'periodo_mas_antiguo', to_char(pa.periodo_mas_antiguo, 'MM/YYYY'),
            'periodos_debidos',    pa.periodos_debidos,
            'monto_pendiente',     pa.monto_pendiente,
            'bucket',              CASE
                                       WHEN pa.meses_debidos = 1 THEN '1 mes'
                                       WHEN pa.meses_debidos = 2 THEN '2 meses'
                                       ELSE '3+ meses'
                                   END,
            'canal_automatico',    CASE
                                       WHEN pa.child_id IS NOT NULL THEN c.parent_id IS NOT NULL
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN false
                                       ELSE true
                                   END,
            'contacto_manual',     CASE
                                       WHEN pa.child_id IS NOT NULL AND c.parent_id IS NULL THEN
                                           jsonb_build_object(
                                               'nombre',   c.parent_name_temp,
                                               'telefono', c.parent_phone_temp,
                                               'email',    c.parent_email_temp
                                           )
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN
                                           jsonb_build_object('nombre', NULL, 'telefono', ua.phone, 'email', ua.email)
                                       ELSE NULL
                                   END,
            'clases_desde_vencimiento', (
                SELECT count(*)
                FROM public.attendance_records ar
                WHERE ar.school_id = p_school_id
                  AND ar.status IN ('present', 'late')
                  AND ar.attendance_date > pa.vencimiento_mas_antiguo
                  AND (
                        (pa.child_id IS NOT NULL AND ar.child_id = pa.child_id)
                     OR (pa.unregistered_athlete_id IS NOT NULL AND ar.unregistered_athlete_id = pa.unregistered_athlete_id)
                     OR (pa.child_id IS NULL AND pa.unregistered_athlete_id IS NULL AND ar.user_id = pa.adult_id)
                  )
            )
        ) ORDER BY pa.meses_debidos DESC, pa.monto_pendiente DESC), '[]'::jsonb)
    INTO v_items
    FROM por_atleta pa
    LEFT JOIN public.children              c  ON c.id  = pa.child_id
    LEFT JOIN public.profiles              pr ON pr.id = pa.adult_id
    LEFT JOIN public.unregistered_athletes ua ON ua.id = pa.unregistered_athlete_id;

    -- Por vencer: vivo con fecha efectiva >= hoy (no es deuda todavía).
    SELECT jsonb_build_object('count', count(*), 'monto', COALESCE(sum(p.amount - COALESCE(p.amount_paid, 0)), 0))
      INTO v_por_vencer
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status IN ('pending', 'overdue', 'partial')
      AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id)
      AND COALESCE(
              p.due_date,
              CASE WHEN p.period_year IS NOT NULL AND p.period_month IS NOT NULL
                   THEN make_date(p.period_year::int, p.period_month::int, 1) END,
              (p.created_at AT TIME ZONE 'America/Bogota')::date
          ) >= v_today;

    SELECT count(*) INTO v_sin_atleta
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status IN ('pending', 'overdue', 'partial')
      AND p.child_id IS NULL AND p.user_id IS NULL
      AND p.parent_id IS NULL AND p.unregistered_athlete_id IS NULL;

    SELECT jsonb_build_object('count', count(*), 'monto', COALESCE(sum(p.amount - COALESCE(p.amount_paid, 0)), 0))
      INTO v_en_revision
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status = 'awaiting_approval'
      AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id);

    SELECT jsonb_build_object('count', count(*), 'monto', COALESCE(sum(p.amount - COALESCE(p.amount_paid, 0)), 0))
      INTO v_en_disputa
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status = 'glosado'
      AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id);

    SELECT jsonb_build_object(
               'atletas', count(*) FILTER (WHERE NOT (i->>'canal_automatico')::boolean),
               'monto',   COALESCE(sum((i->>'monto_pendiente')::numeric)
                                    FILTER (WHERE NOT (i->>'canal_automatico')::boolean), 0)
           )
      INTO v_sin_canal
    FROM jsonb_array_elements(v_items) i;

    RETURN jsonb_build_object(
        'school_id',           p_school_id,
        'branch_id',           p_branch_id,
        'generated_at',        v_today,
        'count',               jsonb_array_length(v_items),
        'items',               v_items,
        'sin_atleta_identificable', v_sin_atleta,
        'en_revision',         v_en_revision,
        'en_disputa',          v_en_disputa,
        'sin_canal_automatico', v_sin_canal,
        'por_vencer',          v_por_vencer
    );
END;
$function$;

-- ACL viva: EXECUTE a postgres, service_role, authenticated (sin anon/PUBLIC).
REVOKE ALL ON FUNCTION public.get_payment_aging_report(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_aging_report(uuid, uuid) TO authenticated, service_role;

COMMIT;
